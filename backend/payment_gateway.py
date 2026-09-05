"""
RecoverAI - Payment Execution Gateway & Test Simulator
Supports Razorpay Test Mode APIs and high-fidelity Mock Test Gateway.
Strictly test-mode only: NEVER executes real-money financial transactions.
"""

import os
import uuid
import time
import random
from typing import Dict, Any, Optional

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")


class PaymentGateway:
    def __init__(self):
        self.is_razorpay_configured = bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)
        self.client = None
        if self.is_razorpay_configured:
            try:
                import razorpay
                self.client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
            except Exception as e:
                print(f"Razorpay client init error: {e}")
                self.client = None

    def execute_action(
        self,
        action_type: str,
        transaction_id: str,
        amount: float,
        customer_email: str,
        customer_name: str,
        payment_method: str = "UPI",
        force_failure_mode: Optional[str] = None, # None, "GATEWAY_TIMEOUT", "INSUFFICIENT_FUNDS", "BANK_DOWNTIME"
        recovery_probability: float = 0.85
    ) -> Dict[str, Any]:
        """
        Executes bounded recovery action in safe test-mode.
        Returns execution result dictionary with gateway reference, status, and telemetry.
        """
        # Inject deliberate failure scenario if specified (for hackathon demo)
        if force_failure_mode:
            time.sleep(0.3)
            return {
                "status": "FAILED",
                "gateway_type": "MOCK_TEST_GATEWAY",
                "gateway_reference": f"mock_err_{uuid.uuid4().hex[:8]}",
                "recovered_amount": 0.0,
                "failure_reason": force_failure_mode,
                "error_message": f"Payment execution failed: {force_failure_mode.replace('_', ' ').title()}",
                "is_test_mode": True,
                "timestamp": time.time()
            }

        # Handle various action types
        if action_type in ["RETRY_PAYMENT", "RETRY_SUBSCRIPTION"]:
            return self._execute_payment_retry(
                transaction_id=transaction_id,
                amount=amount,
                payment_method=payment_method,
                recovery_probability=recovery_probability
            )
        elif action_type in ["SEND_PAYMENT_REMINDER", "SEND_CHECKOUT_REMINDER"]:
            return self._dispatch_payment_reminder(
                action_type=action_type,
                transaction_id=transaction_id,
                amount=amount,
                customer_email=customer_email,
                customer_name=customer_name
            )
        elif action_type == "CREATE_ESCALATION":
            return {
                "status": "ESCALATED",
                "gateway_type": "MERCHANT_OPS_ESCALATION",
                "gateway_reference": f"esc_{uuid.uuid4().hex[:8]}",
                "recovered_amount": 0.0,
                "failure_reason": None,
                "message": f"Transaction {transaction_id} escalated to high-priority merchant support ticket.",
                "is_test_mode": True,
                "timestamp": time.time()
            }
        elif action_type in ["STOP_RECOVERY", "NO_ACTION"]:
            return {
                "status": "STOPPED",
                "gateway_type": "POLICY_GUARD",
                "gateway_reference": f"stop_{uuid.uuid4().hex[:8]}",
                "recovered_amount": 0.0,
                "failure_reason": "Recovery halted by policy/model determination.",
                "is_test_mode": True,
                "timestamp": time.time()
            }
        else:
            return {
                "status": "FAILED",
                "gateway_type": "UNKNOWN",
                "gateway_reference": None,
                "recovered_amount": 0.0,
                "failure_reason": f"Unsupported action type: {action_type}",
                "is_test_mode": True,
                "timestamp": time.time()
            }

    def _execute_payment_retry(
        self,
        transaction_id: str,
        amount: float,
        payment_method: str,
        recovery_probability: float
    ) -> Dict[str, Any]:
        time.sleep(0.2) # Simulate realistic network latency
        
        # Test mode execution via Razorpay if configured
        if self.is_razorpay_configured:
            try:
                if self.client:
                    order = self.client.order.create({
                        "amount": int(amount * 100),
                        "currency": "INR",
                        "receipt": f"rcpt_{transaction_id}",
                        "notes": {"recover_ai": "true", "transaction_id": transaction_id}
                    })
                    order_id = order.get("id", f"pay_test_{uuid.uuid4().hex[:8]}")
                else:
                    import requests
                    resp = requests.post(
                        "https://api.razorpay.com/v1/orders",
                        auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
                        json={
                            "amount": int(amount * 100),
                            "currency": "INR",
                            "receipt": f"rcpt_{transaction_id}",
                            "notes": {"recover_ai": "true", "transaction_id": transaction_id}
                        },
                        timeout=5
                    )
                    order_id = resp.json().get("id", f"pay_test_{uuid.uuid4().hex[:8]}") if resp.status_code in [200, 201] else f"pay_test_{uuid.uuid4().hex[:8]}"

                return {
                    "status": "PENDING",
                    "gateway_type": "RAZORPAY_TEST_SANDBOX",
                    "gateway_reference": order_id,
                    "recovered_amount": 0.0,  # Not yet settled; awaiting customer payment
                    "failure_reason": None,
                    "is_test_mode": True,
                    "payment_stage": "ORDER_CREATED",  # Stage: Order Created → Awaiting Payment
                    "details": (
                        f"Razorpay Test Sandbox: Order {order_id} created successfully. "
                        "Recovery payment link dispatched to customer. "
                        "Revenue will be counted only on verified payment settlement."
                    ),
                    "timestamp": time.time()
                }
            except Exception as e:
                print(f"Razorpay sandbox request note: {e}")

        # High-Fidelity Mock Test Execution
        # Success is determined by the calibrated recovery probability
        roll = random.random()
        is_success = roll < recovery_probability
        
        if is_success:
            return {
                "status": "SUCCESS",
                "gateway_type": "MOCK_TEST_GATEWAY",
                "gateway_reference": f"pay_mock_{uuid.uuid4().hex[:10]}",
                "recovered_amount": float(amount),
                "failure_reason": None,
                "message": f"Test payment retry of ₹{amount:,.2f} via {payment_method} settled successfully.",
                "is_test_mode": True,
                "timestamp": time.time()
            }
        else:
            return {
                "status": "FAILED",
                "gateway_type": "MOCK_TEST_GATEWAY",
                "gateway_reference": f"err_mock_{uuid.uuid4().hex[:10]}",
                "recovered_amount": 0.0,
                "failure_reason": "Bank declined retry: Transient connection dropped",
                "message": "Payment retry did not succeed on this attempt.",
                "is_test_mode": True,
                "timestamp": time.time()
            }

    def _dispatch_payment_reminder(
        self,
        action_type: str,
        transaction_id: str,
        amount: float,
        customer_email: str,
        customer_name: str
    ) -> Dict[str, Any]:
        time.sleep(0.15)
        link_id = f"plink_test_{uuid.uuid4().hex[:8]}"
        action_desc = "Checkout recovery link" if "CHECKOUT" in action_type else "Interactive payment link"
        
        # Test simulated reminder response:
        # A portion of customers click and pay immediately in simulation
        roll = random.random()
        customer_paid_on_reminder = roll < 0.65
        
        if customer_paid_on_reminder:
            return {
                "status": "SUCCESS",
                "gateway_type": "MOCK_TEST_GATEWAY",
                "gateway_reference": link_id,
                "recovered_amount": float(amount),
                "failure_reason": None,
                "message": f"{action_desc} sent to {customer_email}. Customer authorized payment in test sandbox.",
                "is_test_mode": True,
                "timestamp": time.time()
            }
        else:
            return {
                "status": "PENDING",
                "gateway_type": "MOCK_TEST_GATEWAY",
                "gateway_reference": link_id,
                "recovered_amount": 0.0,
                "failure_reason": None,
                "message": f"{action_desc} dispatched to {customer_email}. Awaiting customer action.",
                "is_test_mode": True,
                "timestamp": time.time()
            }


payment_gateway = PaymentGateway()

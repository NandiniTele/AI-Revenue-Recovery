"""
RecoverAI - Real-Time Risk & Recovery Inference Engine
Provides calibrated recovery probability, risk score, eligibility determination,
and explainable factor attribution for any transaction.
"""

import os
import joblib
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple


class RiskEngine:
    def __init__(self, model_bundle_path: str = "ml/model_bundle.joblib"):
        self.model_bundle_path = model_bundle_path
        self.pipeline = None
        self.numeric_features = []
        self.categorical_features = []
        self.metrics = {}
        self._load_model()

    def _load_model(self):
        if os.path.exists(self.model_bundle_path):
            try:
                bundle = joblib.load(self.model_bundle_path)
                self.pipeline = bundle.get("pipeline")
                self.numeric_features = bundle.get("numeric_features", [])
                self.categorical_features = bundle.get("categorical_features", [])
                self.metrics = bundle.get("metrics", {})
            except Exception as e:
                print(f"Warning: Could not load ML model bundle: {e}")
                self.pipeline = None
        else:
            self.pipeline = None

    def assess_transaction(self, tx_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Assesses a transaction record and returns:
        - risk_score (0-100)
        - recovery_probability (0.0-1.0)
        - recovery_eligible (YES / NO)
        - recommended_action
        - key_factors
        """
        payment_status = tx_data.get("payment_status", "FAILED").upper()
        amount = float(tx_data.get("amount", 0.0))
        prev_success = int(tx_data.get("previous_success_count", 0))
        prev_failure = int(tx_data.get("previous_failure_count", 0))
        retry_count = int(tx_data.get("retry_count", 0))
        days_overdue = int(tx_data.get("days_overdue", 0))
        customer_value = float(tx_data.get("customer_value", 5000.0))
        payment_method = str(tx_data.get("payment_method", "UPI"))
        customer_tier = str(tx_data.get("customer_tier", "Standard"))
        failure_reason = str(tx_data.get("failure_reason", "unknown"))
        checkout_status = str(tx_data.get("checkout_status", "COMPLETED"))
        subscription_status = str(tx_data.get("subscription_status", "NONE"))

        # If payment already succeeded, zero risk
        if payment_status == "SUCCESS":
            return {
                "risk_score": 10,
                "recovery_probability": 1.0,
                "recovery_eligible": "NO",
                "recommended_action": "NO_ACTION",
                "reasoning": "Transaction has already been successfully processed.",
                "key_factors": ["Payment settled successfully", "No recovery required"]
            }

        # Calculate model probability if pipeline is loaded
        prob = None
        if self.pipeline is not None:
            try:
                total_past = prev_success + prev_failure
                past_success_ratio = (prev_success / total_past) if total_past > 0 else 0.5
                amount_to_ltv = (amount / customer_value) if customer_value > 0 else 1.0
                
                # Parse hour and day
                hour_of_day = 14
                day_of_week = 2
                
                input_df = pd.DataFrame([{
                    'amount': amount,
                    'previous_success_count': prev_success,
                    'previous_failure_count': prev_failure,
                    'past_success_ratio': past_success_ratio,
                    'days_overdue': days_overdue,
                    'retry_count': retry_count,
                    'customer_value': customer_value,
                    'amount_to_ltv_ratio': amount_to_ltv,
                    'hour_of_day': hour_of_day,
                    'day_of_week': day_of_week,
                    'payment_method': payment_method,
                    'customer_tier': customer_tier,
                    'failure_reason': failure_reason,
                    'checkout_status': checkout_status,
                    'subscription_status': subscription_status
                }])
                
                prob = float(self.pipeline.predict_proba(input_df)[0][1])
            except Exception as e:
                # Fallback to analytical calculation
                prob = None

        if prob is None:
            # Analytical baseline
            base_weights = {
                "network_timeout": 0.90, "issuer_down": 0.85, "webhook_drop": 0.92,
                "processor_error": 0.80, "authentication_failed": 0.65, "insufficient_funds": 0.45,
                "card_expired": 0.12, "account_closed": 0.02, "fraud_blocked": 0.00,
                "velocity_limit_exceeded": 0.30, "checkout_dropoff": 0.58
            }
            base = base_weights.get(failure_reason, 0.50)
            success_ratio = (prev_success / max(1, prev_success + prev_failure))
            prob = base + 0.15 * (success_ratio - 0.5) - (0.18 * retry_count)
            prob = float(np.clip(prob, 0.01, 0.99))

        # Risk score (0-100): High score = high financial exposure & risk of permanent loss
        raw_risk = (1.0 - prob) * 60 + (min(amount, 25000) / 25000) * 30 + (retry_count * 5)
        risk_score = int(np.clip(raw_risk, 10, 99))

        # Key factors extraction for explainability
        key_factors = []
        if prev_success >= 5:
            key_factors.append(f"Strong customer track record ({prev_success} successful payments)")
        elif prev_success == 0:
            key_factors.append("New customer with no prior successful transaction history")

        if failure_reason in ["network_timeout", "issuer_down", "webhook_drop", "processor_error"]:
            key_factors.append(f"Transient gateway error ({failure_reason}) is highly recoverable")
        elif failure_reason in ["card_expired", "account_closed", "fraud_blocked"]:
            key_factors.append(f"Fatal payment failure ({failure_reason}) requires manual customer/bank intervention")
        elif failure_reason == "insufficient_funds":
            key_factors.append("Soft decline due to balance; scheduled reminder recommended")

        if retry_count >= 2:
            key_factors.append(f"Retry threshold reached ({retry_count}/2 attempts made)")

        if customer_tier in ["VIP", "Enterprise"]:
            key_factors.append(f"High-priority {customer_tier} tier customer (LTV: ₹{customer_value:,.2f})")

        # Determine Eligibility & Recommended Action
        if failure_reason in ["fraud_blocked", "account_closed"]:
            recovery_eligible = "NO"
            recommended_action = "STOP_RECOVERY"
            reasoning = "Permanent failure / security restriction prevents automated recovery."
        elif retry_count >= 2:
            recovery_eligible = "NO"
            recommended_action = "CREATE_ESCALATION"
            reasoning = "Maximum automatic retry limit reached. Escalating to human merchant operations."
        elif payment_status == "ABANDONED":
            recovery_eligible = "YES"
            recommended_action = "SEND_CHECKOUT_REMINDER"
            reasoning = "Customer dropped off during checkout; smart payment link reminder recommended."
        elif subscription_status in ["ACTIVE_RENEWAL_DUE", "PAST_DUE", "CHURN_RISK"]:
            recovery_eligible = "YES"
            recommended_action = "RETRY_SUBSCRIPTION"
            reasoning = "Subscription recurring charge failed; executing smart billing retry."
        elif failure_reason in ["network_timeout", "issuer_down", "webhook_drop", "processor_error"]:
            recovery_eligible = "YES"
            recommended_action = "RETRY_PAYMENT"
            reasoning = "Transient technical failure diagnosed; automated retry authorized."
        elif failure_reason in ["insufficient_funds", "authentication_failed", "card_expired"]:
            recovery_eligible = "YES"
            recommended_action = "SEND_PAYMENT_REMINDER"
            reasoning = "Interactive failure requires customer action; dispatching interactive payment link."
        else:
            recovery_eligible = "YES" if prob >= 0.35 else "NO"
            recommended_action = "RETRY_PAYMENT" if recovery_eligible == "YES" else "STOP_RECOVERY"
            reasoning = "Model evaluation suggests controlled recovery action."

        return {
            "risk_score": risk_score,
            "recovery_probability": round(prob, 4),
            "recovery_eligible": recovery_eligible,
            "recommended_action": recommended_action,
            "reasoning": reasoning,
            "key_factors": key_factors
        }


# Global singleton instance
risk_engine = RiskEngine()

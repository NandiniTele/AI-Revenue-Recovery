"""
RecoverAI - AI Diagnosis Engine & Recovery Decision Agent
Orchestrates root-cause diagnosis, action selection, guardrail verification, bounded execution,
revenue calculation, stopping rule enforcement, and audit trail logging.
"""

import uuid
import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.models import (
    Transaction, Customer, RiskPrediction, AgentDecision,
    PolicyEvaluation, RecoveryAction, AuditLog, MerchantSettings
)
from ml.risk_engine import risk_engine
from backend.policy_engine import policy_engine
from backend.payment_gateway import payment_gateway


class RecoveryAgent:
    def __init__(self):
        self.risk_engine = risk_engine
        self.policy_engine = policy_engine
        self.payment_gateway = payment_gateway

    def diagnose_transaction(self, db: Session, transaction_id: str) -> Dict[str, Any]:
        """
        Diagnoses a transaction, scores revenue risk, and recommends recovery action.
        Persists RiskPrediction and AgentDecision records.
        """
        tx = db.query(Transaction).filter(Transaction.transaction_id == transaction_id).first()
        if not tx:
            raise ValueError(f"Transaction {transaction_id} not found.")

        customer = tx.customer
        
        # Prepare context payload for ML risk engine
        tx_data = {
            "payment_status": tx.payment_status,
            "amount": tx.amount,
            "previous_success_count": customer.previous_success_count if customer else 0,
            "previous_failure_count": customer.previous_failure_count if customer else 0,
            "retry_count": tx.retry_count,
            "days_overdue": tx.days_overdue,
            "customer_value": customer.customer_value if customer else 5000.0,
            "payment_method": tx.payment_method,
            "customer_tier": customer.customer_tier if customer else "Standard",
            "failure_reason": tx.failure_reason,
            "checkout_status": tx.checkout_status,
            "subscription_status": tx.subscription_status
        }

        assessment = self.risk_engine.assess_transaction(tx_data)
        
        # Generate rich human-readable diagnosis text
        diagnosis_text = (
            f"Customer {customer.customer_name if customer else 'Unknown'} ({customer.customer_tier if customer else 'Standard'} tier) "
            f"has {customer.previous_success_count if customer else 0} historical successful payments. "
            f"Current transaction of ₹{tx.amount:,.2f} via {tx.payment_method} failed with code '{tx.failure_reason}'. "
            f"Model predicts {assessment['recovery_probability'] * 100:.1f}% recovery likelihood."
        )

        # Store or update RiskPrediction in DB
        risk_pred = db.query(RiskPrediction).filter(RiskPrediction.transaction_id == tx.transaction_id).first()
        if not risk_pred:
            risk_pred = RiskPrediction(
                transaction_id=tx.transaction_id,
                risk_score=assessment["risk_score"],
                recovery_probability=assessment["recovery_probability"],
                recovery_eligible=assessment["recovery_eligible"],
                key_factors_json=assessment["key_factors"]
            )
            db.add(risk_pred)
        else:
            risk_pred.risk_score = assessment["risk_score"]
            risk_pred.recovery_probability = assessment["recovery_probability"]
            risk_pred.recovery_eligible = assessment["recovery_eligible"]
            risk_pred.key_factors_json = assessment["key_factors"]

        # Build safety rule string dynamically from live merchant settings
        _settings_for_rule = db.query(MerchantSettings).first()
        _max_r = _settings_for_rule.max_retries_allowed if _settings_for_rule else 2
        _cooldown_h = _settings_for_rule.retry_cooldown_hours if _settings_for_rule else 24
        safety_rule_str = f"Policy Max Retries = {_max_r} | Cooldown = {_cooldown_h}h"

        # Store or update AgentDecision in DB
        decision = db.query(AgentDecision).filter(AgentDecision.transaction_id == tx.transaction_id).first()
        if not decision:
            decision = AgentDecision(
                transaction_id=tx.transaction_id,
                diagnosis_text=diagnosis_text,
                selected_action=assessment["recommended_action"],
                reasoning=assessment["reasoning"],
                applicable_safety_rule=safety_rule_str
            )
            db.add(decision)
        else:
            decision.diagnosis_text = diagnosis_text
            decision.selected_action = assessment["recommended_action"]
            decision.reasoning = assessment["reasoning"]

        tx.current_state = "DIAGNOSED"
        db.commit()
        db.refresh(tx)

        return {
            "transaction_id": tx.transaction_id,
            "risk_score": assessment["risk_score"],
            "recovery_probability": assessment["recovery_probability"],
            "recovery_eligible": assessment["recovery_eligible"],
            "recommended_action": assessment["recommended_action"],
            "diagnosis_text": diagnosis_text,
            "reasoning": assessment["reasoning"],
            "key_factors": assessment["key_factors"],
            "applicable_safety_rule": safety_rule_str
        }


    def execute_recovery(
        self,
        db: Session,
        transaction_id: str,
        override_action: Optional[str] = None,
        force_failure_mode: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes bounded recovery workflow:
        1. Diagnoses if not already done.
        2. Evaluates requested action against Policy & Guardrail Engine.
        3. If BLOCKED -> Logs policy block, triggers escalation/stop, logs to AuditLog.
        4. If APPROVED -> Dispatches test payment/reminder, calculates recovered revenue, updates DB, logs to AuditLog.
        """
        tx = db.query(Transaction).filter(Transaction.transaction_id == transaction_id).first()
        if not tx:
            raise ValueError(f"Transaction {transaction_id} not found.")

        customer = tx.customer
        diagnosis = self.diagnose_transaction(db, transaction_id)
        action_to_attempt = override_action or diagnosis["recommended_action"]

        # Step 2: Policy & Guardrail Layer Check (MANDATORY)
        settings = db.query(MerchantSettings).first()
        is_approved, rule_name, rule_reason, next_action = self.policy_engine.evaluate(
            db=db,
            transaction=tx,
            action_requested=action_to_attempt,
            settings=settings
        )

        # Record Policy Evaluation in DB
        policy_eval = PolicyEvaluation(
            transaction_id=tx.transaction_id,
            action_requested=action_to_attempt,
            policy_verdict="APPROVED" if is_approved else "BLOCKED",
            rule_triggered=rule_name,
            details=rule_reason
        )
        db.add(policy_eval)

        audit_id = f"AUD_{uuid.uuid4().hex[:10].upper()}"

        if not is_approved:
            # Policy blocked the action!
            tx.current_state = "BLOCKED" if next_action != "CREATE_ESCALATION" else "ESCALATED"
            
            # Create Audit Log
            audit_entry = AuditLog(
                audit_id=audit_id,
                logged_at=datetime.datetime.utcnow(),
                transaction_id=tx.transaction_id,
                agent_decision=action_to_attempt,
                reason=rule_reason,
                risk_score=diagnosis["risk_score"],
                action_requested=action_to_attempt,
                policy_result="BLOCKED",
                action_executed=None,
                execution_result="BLOCKED",
                recovered_amount=0.0,
                failure_reason=rule_name,
                next_action=next_action or "STOP_RECOVERY",
                details_json={
                    "rule_triggered": rule_name,
                    "explanation": rule_reason,
                    "retry_count": tx.retry_count,
                    "max_retries_allowed": settings.max_retries_allowed if settings else 2
                }
            )
            db.add(audit_entry)
            db.commit()

            return {
                "audit_id": audit_id,
                "transaction_id": tx.transaction_id,
                "policy_result": "BLOCKED",
                "rule_triggered": rule_name,
                "reason": rule_reason,
                "action_executed": None,
                "execution_result": "BLOCKED",
                "recovered_amount": 0.0,
                "next_action": next_action or "STOP_RECOVERY",
                "current_state": tx.current_state
            }

        # Step 3: Approved - Execute Test Action via Gateway
        gateway_result = self.payment_gateway.execute_action(
            action_type=action_to_attempt,
            transaction_id=tx.transaction_id,
            amount=tx.amount,
            customer_email=customer.customer_email if customer else "customer@example.com",
            customer_name=customer.customer_name if customer else "Customer",
            payment_method=tx.payment_method,
            force_failure_mode=force_failure_mode,
            recovery_probability=diagnosis["recovery_probability"]
        )

        exec_status = gateway_result["status"]
        recovered_amt = gateway_result["recovered_amount"]
        next_step = None

        # Update Transaction & Customer states
        if exec_status == "SUCCESS":
            tx.is_recovered = True
            tx.recovered_amount = recovered_amt
            tx.payment_status = "SUCCESS"
            tx.current_state = "RECOVERED"
            next_step = "COMPLETED"
            if customer:
                customer.previous_success_count += 1
        elif exec_status == "FAILED":
            tx.retry_count += 1
            if tx.retry_count >= (settings.max_retries_allowed if settings else 2):
                tx.current_state = "ESCALATED"
                next_step = "CREATE_ESCALATION"
            else:
                tx.current_state = "ACTION_PENDING"
                next_step = "SCHEDULE_COOLDOWN_RETRY"
        elif exec_status == "ESCALATED":
            tx.current_state = "ESCALATED"
            next_step = "MERCHANT_OPS_ASSIGNED"
        elif exec_status == "STOPPED":
            tx.current_state = "STOPPED"
            next_step = "ARCHIVED"
        else: # PENDING
            tx.current_state = "ACTION_PENDING"
            next_step = "WAIT_CUSTOMER_ACTION"

        # Update customer last contacted timestamp if reminder
        if "REMINDER" in action_to_attempt and customer:
            customer.last_contacted_at = datetime.datetime.utcnow()

        # Record RecoveryAction in DB
        rec_action = RecoveryAction(
            transaction_id=tx.transaction_id,
            action_type=action_to_attempt,
            gateway_type=gateway_result.get("gateway_type", "MOCK_TEST_GATEWAY"),
            status=exec_status,
            recovered_amount=recovered_amt,
            gateway_reference=gateway_result.get("gateway_reference"),
            failure_details=gateway_result.get("failure_reason") or gateway_result.get("error_message")
        )
        db.add(rec_action)

        # Record AuditLog in DB
        audit_entry = AuditLog(
            audit_id=audit_id,
            logged_at=datetime.datetime.utcnow(),
            transaction_id=tx.transaction_id,
            agent_decision=action_to_attempt,
            reason=diagnosis["reasoning"],
            risk_score=diagnosis["risk_score"],
            action_requested=action_to_attempt,
            policy_result="APPROVED",
            action_executed=action_to_attempt,
            execution_result=exec_status,
            recovered_amount=recovered_amt,
            failure_reason=gateway_result.get("failure_reason"),
            next_action=next_step,
            details_json={
                "gateway_type": gateway_result.get("gateway_type"),
                "gateway_reference": gateway_result.get("gateway_reference"),
                "is_test_mode": True,
                "retry_count_after": tx.retry_count,
                "message": gateway_result.get("message") or gateway_result.get("error_message")
            }
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(tx)

        return {
            "audit_id": audit_id,
            "transaction_id": tx.transaction_id,
            "policy_result": "APPROVED",
            "rule_triggered": rule_name,
            "action_executed": action_to_attempt,
            "execution_result": exec_status,
            "recovered_amount": recovered_amt,
            "gateway_reference": gateway_result.get("gateway_reference"),
            "failure_reason": gateway_result.get("failure_reason"),
            "next_action": next_step,
            "current_state": tx.current_state,
            "message": gateway_result.get("message") or gateway_result.get("error_message")
        }


recovery_agent = RecoveryAgent()

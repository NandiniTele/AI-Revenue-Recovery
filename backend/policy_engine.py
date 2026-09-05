"""
RecoverAI - Policy & Guardrail Engine
Enforces strict stopping rules, retry boundaries, safety caps, and compliance checks.
The AI agent is NEVER allowed to bypass this policy engine.
"""

import datetime
from typing import Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from backend.models import Transaction, Customer, MerchantSettings, PolicyEvaluation


class PolicyEngine:
    """
    Evaluates requested actions against merchant business rules and safety guardrails.
    Returns: (is_approved: bool, rule_triggered: str, reason: str, next_action: Optional[str])
    """

    @staticmethod
    def evaluate(
        db: Session,
        transaction: Transaction,
        action_requested: str,
        settings: Optional[MerchantSettings] = None
    ) -> Tuple[bool, str, str, Optional[str]]:
        if settings is None:
            settings = db.query(MerchantSettings).first()
            if not settings:
                settings = MerchantSettings()

        # 1. Success Guard: Do NOT perform recovery on already successful transactions
        if transaction.payment_status == "SUCCESS" or transaction.is_recovered:
            return (
                False,
                "RULE_ALREADY_SUCCESSFUL",
                f"Transaction {transaction.transaction_id} has already succeeded or been recovered. Further action forbidden.",
                "NO_ACTION"
            )

        # 2. Maximum Payment Retries Guard (Mandatory Stopping Rule)
        max_retries = settings.max_retries_allowed
        if action_requested in ["RETRY_PAYMENT", "RETRY_SUBSCRIPTION"]:
            if transaction.retry_count >= max_retries:
                return (
                    False,
                    "RULE_MAX_RETRIES_EXCEEDED",
                    f"Retry limit reached ({transaction.retry_count}/{max_retries} attempts). Automated retry blocked by policy to prevent card spam & bank penalty.",
                    "CREATE_ESCALATION"
                )

        # 3. Fatal/Permanent Decline Guard
        fatal_reasons = ["fraud_blocked", "account_closed"]
        if transaction.failure_reason in fatal_reasons:
            if action_requested in ["RETRY_PAYMENT", "RETRY_SUBSCRIPTION"]:
                return (
                    False,
                    "RULE_FATAL_FAILURE_NO_RETRY",
                    f"Failure reason '{transaction.failure_reason}' is fatal/security-blocked. Automated retries are prohibited.",
                    "CREATE_ESCALATION"
                )

        # 4. Expired Card Guard
        if transaction.failure_reason == "card_expired" and action_requested in ["RETRY_PAYMENT", "RETRY_SUBSCRIPTION"]:
            return (
                False,
                "RULE_EXPIRED_CARD_UPDATE_REQUIRED",
                "Cannot retry transaction on expired card without updated payment credentials.",
                "SEND_PAYMENT_REMINDER"
            )

        # 5. Customer Contact Cooldown Guard (Prevent SMS/Email Spam)
        if action_requested in ["SEND_PAYMENT_REMINDER", "SEND_CHECKOUT_REMINDER"]:
            customer = transaction.customer
            if customer and customer.last_contacted_at:
                hours_since_contact = (datetime.datetime.utcnow() - customer.last_contacted_at).total_seconds() / 3600.0
                if hours_since_contact < settings.retry_cooldown_hours:
                    return (
                        False,
                        "RULE_CUSTOMER_COOLDOWN_ACTIVE",
                        f"Customer {customer.customer_name} was contacted {hours_since_contact:.1f}h ago (Cooldown policy: {settings.retry_cooldown_hours}h). Blocked to avoid spam.",
                        "STOP_RECOVERY"
                    )

        # 6. High-Value Safety Threshold Guard
        if action_requested == "RETRY_PAYMENT" and transaction.amount > settings.high_value_manual_threshold:
            # Over threshold requires escalation or flagged approval
            return (
                False,
                "RULE_HIGH_VALUE_MANUAL_REVIEW",
                f"Transaction amount (₹{transaction.amount:,.2f}) exceeds auto-recovery threshold (₹{settings.high_value_manual_threshold:,.2f}). Requires merchant supervisor review.",
                "CREATE_ESCALATION"
            )

        # 7. Quiet Hours Policy (Optional)
        if settings.quiet_hours_enabled and action_requested in ["SEND_PAYMENT_REMINDER", "SEND_CHECKOUT_REMINDER"]:
            current_hour = datetime.datetime.now().hour
            if settings.quiet_hours_start <= current_hour or current_hour < settings.quiet_hours_end:
                return (
                    False,
                    "RULE_QUIET_HOURS_ACTIVE",
                    f"Current hour ({current_hour}:00) falls within customer quiet hours ({settings.quiet_hours_start}:00 - {settings.quiet_hours_end}:00). Reminder paused.",
                    "STOP_RECOVERY"
                )

        # 8. Unrecognized / Safe Actions
        if action_requested == "NO_ACTION" or action_requested == "STOP_RECOVERY":
            return (
                True,
                "RULE_NO_ACTION_APPROVED",
                "Passive action approved. No financial API calls dispatched.",
                None
            )

        # If all guardrails passed: APPROVED
        return (
            True,
            "RULE_POLICY_APPROVED",
            f"Action '{action_requested}' complies with all {settings.merchant_name} safety policies and retry thresholds.",
            action_requested
        )


policy_engine = PolicyEngine()

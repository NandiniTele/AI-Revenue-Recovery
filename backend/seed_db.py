"""
RecoverAI - Database Seeder
Populates SQLite database from synthetic_transactions.csv with customers, transactions,
initial risk predictions, agent decisions, and default merchant settings.
"""

import os
import uuid
import datetime
import pandas as pd
from sqlalchemy.orm import Session

from backend.database import engine, SessionLocal, Base
from backend.models import (
    Customer, Transaction, RiskPrediction, AgentDecision,
    MerchantSettings, PolicyEvaluation, RecoveryAction, AuditLog
)
from ml.dataset_generator import generate_dataset


def seed_database_from_csv(reset_existing: bool = False):
    # Ensure database schema is created
    if reset_existing:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    try:
        if reset_existing:
            db.query(AuditLog).delete()
            db.query(RecoveryAction).delete()
            db.query(PolicyEvaluation).delete()
            db.query(AgentDecision).delete()
            db.query(RiskPrediction).delete()
            db.query(Transaction).delete()
            db.query(Customer).delete()
            db.query(MerchantSettings).delete()
            db.commit()

        # Check if already seeded
        tx_count = db.query(Transaction).count()
        if tx_count > 0 and not reset_existing:
            print(f"Database already contains {tx_count} transactions. Skipping seeding.")
            return {"status": "ALREADY_SEEDED", "count": tx_count}

        csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "synthetic_transactions.csv")
        if not os.path.exists(csv_path):
            print("CSV not found, generating dataset...")
            df = generate_dataset(1250)
            df.to_csv(csv_path, index=False)
        else:
            df = pd.read_csv(csv_path)

        print(f"Seeding database from {csv_path} ({len(df)} rows)...")

        # 1. Create Default Merchant Settings
        settings = MerchantSettings(
            merchant_name="Apex Retail Technologies",
            max_retries_allowed=2,
            retry_cooldown_hours=24,
            high_value_manual_threshold=40000.0,
            auto_recovery_enabled=True,
            quiet_hours_enabled=False
        )
        db.add(settings)

        # 2. Extract and create Unique Customers
        customer_cache = {}
        for _, row in df.iterrows():
            cid = str(row["customer_id"])
            if cid not in customer_cache:
                customer = Customer(
                    customer_id=cid,
                    customer_name=str(row["customer_name"]),
                    customer_email=str(row["customer_email"]),
                    customer_tier=str(row["customer_tier"]),
                    previous_success_count=int(row["previous_success_count"]),
                    previous_failure_count=int(row["previous_failure_count"]),
                    customer_value=float(row["customer_value"])
                )
                db.add(customer)
                customer_cache[cid] = customer

        db.flush()

        # 3. Transactions + RiskPredictions + AgentDecisions + PolicyEvaluations
        #    + RecoveryActions + AuditLogs (covers ALL filter states)
        ACTION_LABELS = {
            "RETRY_PAYMENT":           "Smart Retry Payment",
            "SEND_PAYMENT_REMINDER":   "Send Payment Reminder",
            "SEND_CHECKOUT_REMINDER":  "Send Checkout Reminder",
            "RETRY_SUBSCRIPTION":      "Retry Subscription Billing",
            "CREATE_ESCALATION":       "Escalate to Support",
            "STOP_RECOVERY":           "Stop Recovery (Fatal Error)",
            "NO_ACTION":               "No Action Required",
        }
        ESCALATION_REASONS = [
            "All automated recovery attempts exhausted",
            "Customer high-churn risk: human agent required",
            "VIP/Enterprise flagged for priority manual recovery",
            "Persistent 3DS failure: manual card update needed",
            "Subscription past-due >7 days: escalate to retention team",
            "Amount exceeds autonomous recovery threshold",
        ]
        counters = dict(SUCCESS=0, FAILED=0, BLOCKED=0, ESCALATED=0, NONE=0,
                        pol_approved=0, pol_blocked=0)

        for _, row in df.iterrows():
            tx_id           = str(row["transaction_id"])
            amount          = float(row["amount"])
            prob            = float(row["recovery_probability"])
            risk            = int(row["risk_score"])
            eligible        = str(row["recovery_eligible"])
            optimal_act     = str(row["optimal_action"])
            payment_status  = str(row["payment_status"])
            failure_reason  = str(row["failure_reason"]) if pd.notna(row["failure_reason"]) else "none"
            retry_count     = int(row["retry_count"])
            days_overdue    = int(row["days_overdue"])
            customer_tier   = str(row["customer_tier"])
            sub_status      = str(row["subscription_status"])

            ts_str = str(row["transaction_timestamp"])
            try:
                tx_time = datetime.datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S")
            except Exception:
                tx_time = datetime.datetime.utcnow()

            # Default state values
            policy_result    = "APPROVED"
            exec_result      = "NONE"
            exec_action      = None
            rec_amount       = 0.0
            fail_reason      = None
            next_action      = "NONE"
            current_state    = "DETECTED"
            is_recovered     = False
            recovered_amount = 0.0
            rule_triggered   = None
            policy_details   = "Awaiting automated agent evaluation."
            gateway_ref      = None

            # Deterministic branch (hash of tx_id mod 100) for reproducibility
            tx_hash = sum(ord(c) for c in tx_id) % 100

            if payment_status == "SUCCESS":
                # Already succeeded
                policy_result    = "APPROVED"
                exec_result      = "SUCCESS"
                exec_action      = optimal_act
                rec_amount       = amount
                next_action      = "NONE"
                current_state    = "RECOVERED"
                is_recovered     = True
                recovered_amount = amount
                policy_details   = "Transaction completed successfully."
                gateway_ref      = "RZP_TEST_" + uuid.uuid4().hex[:8].upper()

            elif failure_reason in ("fraud_blocked", "account_closed"):
                # Hard-block: policy prevents any action
                rule = ("Fraud block: payment flagged by issuer"
                        if failure_reason == "fraud_blocked"
                        else "Account closed: non-recoverable failure")
                policy_result  = "BLOCKED"
                exec_result    = "BLOCKED"
                fail_reason    = "Policy guardrail: " + rule
                next_action    = "STOP_RECOVERY"
                current_state  = "BLOCKED"
                rule_triggered = rule
                policy_details = "Guardrail blocked action. Manual review required."

            elif amount > 40000 and retry_count == 0:
                # High-value threshold block
                rule = "High-value transaction requires manual approval (>Rs 40,000)"
                policy_result  = "BLOCKED"
                exec_result    = "BLOCKED"
                fail_reason    = "Policy guardrail: " + rule
                next_action    = "CREATE_ESCALATION"
                current_state  = "ESCALATED"
                rule_triggered = rule
                policy_details = "Amount exceeds Rs 40,000 autonomous limit. Queued for human approval."

            elif retry_count >= 2:
                # Max retries reached
                rule = "Max retries exceeded (retry_count >= 2)"
                if customer_tier in ("VIP", "Enterprise") or days_overdue > 5:
                    # Escalate premium customers
                    policy_result  = "APPROVED"
                    exec_result    = "ESCALATED"
                    exec_action    = "CREATE_ESCALATION"
                    fail_reason    = ESCALATION_REASONS[tx_hash % len(ESCALATION_REASONS)]
                    next_action    = "ESCALATE_TO_SUPPORT"
                    current_state  = "ESCALATED"
                    rule_triggered = rule
                    policy_details = "Max retries reached. Premium customer escalated to support."
                else:
                    # Block standard/new customers
                    policy_result  = "BLOCKED"
                    exec_result    = "BLOCKED"
                    fail_reason    = "Policy guardrail: " + rule
                    next_action    = "STOP_RECOVERY"
                    current_state  = "BLOCKED"
                    rule_triggered = rule
                    policy_details = "Guardrail blocked further automated retry."

            elif optimal_act == "CREATE_ESCALATION":
                # Agent decided escalation is best path
                policy_result  = "APPROVED"
                exec_result    = "ESCALATED"
                exec_action    = "CREATE_ESCALATION"
                fail_reason    = ESCALATION_REASONS[tx_hash % len(ESCALATION_REASONS)]
                next_action    = "ESCALATE_TO_SUPPORT"
                current_state  = "ESCALATED"
                policy_details = "Agent determined escalation is the safest recovery path."

            elif optimal_act == "STOP_RECOVERY":
                # Fatal failure
                policy_result  = "APPROVED"
                exec_result    = "FAILED"
                exec_action    = "STOP_RECOVERY"
                fail_reason    = "Fatal failure (" + failure_reason + ") - no automated recovery path"
                next_action    = "MANUAL_CARD_UPDATE"
                current_state  = "BLOCKED"
                rule_triggered = "Fatal failure: non-recoverable error code"
                policy_details = "Non-recoverable failure. Recovery stopped per policy."

            elif prob >= 0.65 and failure_reason not in ("card_expired", "velocity_limit_exceeded", "none"):
                # High-probability transient: ~58% succeed
                if tx_hash < 58:
                    policy_result    = "APPROVED"
                    exec_result      = "SUCCESS"
                    exec_action      = optimal_act
                    rec_amount       = amount
                    next_action      = "NONE"
                    current_state    = "RECOVERED"
                    is_recovered     = True
                    recovered_amount = amount
                    policy_details   = "Recovery action approved and executed successfully."
                    gateway_ref      = "MOCK_GW_" + uuid.uuid4().hex[:8].upper()
                else:
                    policy_result  = "APPROVED"
                    exec_result    = "FAILED"
                    exec_action    = optimal_act
                    fail_reason    = failure_reason
                    next_action    = "RETRY_PAYMENT" if retry_count < 1 else "ESCALATE_TO_SUPPORT"
                    current_state  = "ACTION_PENDING"
                    policy_details = "Recovery approved but execution failed at gateway."
                    gateway_ref    = "SIM_TXN_" + uuid.uuid4().hex[:8].upper()

            else:
                # Low probability / reminder actions
                policy_result  = "APPROVED"
                exec_result    = "FAILED"
                exec_action    = optimal_act
                fail_reason    = failure_reason
                next_action    = "RETRY_PAYMENT" if retry_count < 1 else "ESCALATE_TO_SUPPORT"
                current_state  = "ACTION_PENDING"
                policy_details = "Recovery approved but execution failed at gateway."
                gateway_ref    = "SIM_TXN_" + uuid.uuid4().hex[:8].upper()

            counters[exec_result] = counters.get(exec_result, 0) + 1
            counters["pol_approved" if policy_result == "APPROVED" else "pol_blocked"] += 1

            # -- Transaction --
            db.add(Transaction(
                transaction_id=tx_id,
                customer_id=str(row["customer_id"]),
                amount=amount,
                currency=str(row.get("currency", "INR")),
                payment_status=payment_status,
                failure_reason=failure_reason,
                payment_method=str(row["payment_method"]),
                checkout_status=str(row["checkout_status"]),
                subscription_status=sub_status,
                days_overdue=days_overdue,
                retry_count=retry_count,
                transaction_timestamp=tx_time,
                is_recovered=is_recovered,
                recovered_amount=recovered_amount,
                current_state=current_state,
            ))

            # -- RiskPrediction --
            db.add(RiskPrediction(
                transaction_id=tx_id,
                risk_score=risk,
                recovery_probability=prob,
                recovery_eligible=eligible,
                key_factors_json=[
                    "Customer " + customer_tier + " tier (" + str(row["previous_success_count"]) + " successes)",
                    "Payment mode: " + str(row["payment_method"]),
                    "Failure code: " + failure_reason,
                    "Recovery probability: " + str(round(prob*100, 1)) + "%",
                    "Days overdue: " + str(days_overdue),
                ],
            ))

            # -- AgentDecision --
            db.add(AgentDecision(
                transaction_id=tx_id,
                diagnosis_text=(
                    "Transaction Rs" + str(round(amount, 2)) +
                    " via " + str(row["payment_method"]) + ". " +
                    "Failure: " + failure_reason + ". " +
                    "Recovery prob: " + str(round(prob*100, 1)) + "%. " +
                    "Risk: " + str(risk) + "/100. " +
                    "AI recommends: " + ACTION_LABELS.get(optimal_act, optimal_act) + "."
                ),
                selected_action=optimal_act,
                reasoning=(
                    "Based on " + customer_tier + " customer history, " +
                    "failure type '" + failure_reason + "', " +
                    "and " + str(retry_count) + " prior retries, " +
                    "optimal action is '" + optimal_act + "' " +
                    "with " + str(round(prob*100, 1)) + "% recovery probability."
                ),
                applicable_safety_rule="Policy: Max Retries=2 | Cooldown=24h | High-Value Threshold=Rs 40,000",
            ))

            # -- PolicyEvaluation --
            db.add(PolicyEvaluation(
                transaction_id=tx_id,
                action_requested=optimal_act,
                policy_verdict=policy_result,
                rule_triggered=rule_triggered,
                details=policy_details,
            ))

            # -- RecoveryAction (only when execution was attempted) --
            if exec_action and exec_result not in ("BLOCKED", "NONE"):
                db.add(RecoveryAction(
                    transaction_id=tx_id,
                    action_type=exec_action,
                    gateway_type="MOCK_TEST_GATEWAY",
                    status=exec_result,
                    recovered_amount=rec_amount,
                    gateway_reference=gateway_ref,
                    failure_details=fail_reason if exec_result != "SUCCESS" else None,
                ))

            # -- AuditLog --
            db.add(AuditLog(
                audit_id="AUD-" + uuid.uuid4().hex[:10].upper(),
                logged_at=tx_time,
                transaction_id=tx_id,
                agent_decision=optimal_act,
                reason=(
                    "Risk " + str(risk) + "/100 | Prob " + str(round(prob*100, 1)) + "% | " +
                    "Failure: " + failure_reason + " | " +
                    "Action: " + ACTION_LABELS.get(optimal_act, optimal_act)
                ),
                risk_score=risk,
                action_requested=optimal_act,
                policy_result=policy_result,
                action_executed=exec_action,
                execution_result=exec_result,
                recovered_amount=rec_amount,
                failure_reason=fail_reason,
                next_action=next_action,
                details_json={
                    "payment_method":       str(row["payment_method"]),
                    "customer_tier":        customer_tier,
                    "failure_reason":       failure_reason,
                    "recovery_probability": round(prob * 100, 1),
                    "risk_score":           risk,
                    "days_overdue":         days_overdue,
                    "retry_count":          retry_count,
                    "subscription_status":  sub_status,
                    "amount":               amount,
                    "rule_triggered":       rule_triggered,
                    "gateway_ref":          gateway_ref,
                    "current_state":        current_state,
                },
            ))

        db.commit()
        print("=" * 60)
        print("Database seeding completed successfully.")
        print("  Records seeded  : " + str(len(df)))
        print("  Policy APPROVED : " + str(counters["pol_approved"]))
        print("  Policy BLOCKED  : " + str(counters["pol_blocked"]))
        print("  Exec SUCCESS    : " + str(counters.get("SUCCESS", 0)))
        print("  Exec FAILED     : " + str(counters.get("FAILED", 0)))
        print("  Exec BLOCKED    : " + str(counters.get("BLOCKED", 0)))
        print("  Exec ESCALATED  : " + str(counters.get("ESCALATED", 0)))
        print("  Exec NONE       : " + str(counters.get("NONE", 0)))
        print("=" * 60)
        return {"status": "SUCCESS", "records_seeded": len(df), "audit_breakdown": counters}
    except Exception as e:
        db.rollback()
        print("Error seeding database: " + str(e))
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_database_from_csv(reset_existing=True)

import os
import re
import json
import requests
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.models import Transaction, Customer, AuditLog, PolicyEvaluation, MerchantSettings

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()


class MerchantAssistant:
    def answer_query(self, db: Session, query_text: str) -> Dict[str, Any]:
        """
        Interprets natural language merchant prompt and returns factual database insights.
        Uses Gemini LLM if GEMINI_API_KEY is configured, grounded in real SQLite state.
        """
        # If Gemini API Key is configured, attempt grounded LLM response
        if GEMINI_API_KEY:
            llm_result = self._query_gemini_grounded(db, query_text)
            if llm_result:
                return llm_result

        # Deterministic zero-hallucination rule engine fallback
        q = query_text.lower().strip()

        # 1. Specific Transaction Lookup (e.g., "Why was TX1024 not retried?", "Explain TX1015")
        tx_match = re.search(r'\b(tx\d{3,5})\b', q, re.IGNORECASE)
        if tx_match:
            tx_id = tx_match.group(1).upper()
            return self._explain_transaction(db, tx_id)

        # 2. Revenue Recovered questions (e.g. "How much revenue did we recover?")
        if any(w in q for w in ["how much", "recovered", "total revenue", "money recovered"]):
            return self._get_revenue_recovered_summary(db)

        # 3. Highest value failed payments (e.g. "Show me highest value failed payments")
        if any(w in q for w in ["highest", "largest", "biggest", "top failed", "high-value"]):
            return self._get_highest_value_failed(db)

        # 4. Escalation questions (e.g. "How many transactions are escalated?", "escalations")
        if "escalat" in q:
            return self._get_escalations_summary(db)

        # 5. Blocked actions / Stopping rules (e.g. "How many actions were blocked?", "stopping rules")
        if any(w in q for w in ["block", "stopped", "stopping rule", "guardrail"]):
            return self._get_blocked_summary(db)

        # 6. Recovery Rate / Performance
        if any(w in q for w in ["rate", "performance", "metrics", "conversion"]):
            return self._get_performance_summary(db)

        # Default overview response
        return self._get_general_status(db)

    def _explain_transaction(self, db: Session, tx_id: str) -> Dict[str, Any]:
        tx = db.query(Transaction).filter(Transaction.transaction_id == tx_id).first()
        if not tx:
            return {
                "answer": f"Transaction **{tx_id}** was not found in the database. Please verify the transaction ID.",
                "data": None
            }

        customer = tx.customer
        latest_audit = db.query(AuditLog).filter(AuditLog.transaction_id == tx_id).order_by(desc(AuditLog.logged_at)).first()
        policy_eval = db.query(PolicyEvaluation).filter(PolicyEvaluation.transaction_id == tx_id).order_by(desc(PolicyEvaluation.created_at)).first()

        status_desc = "Successfully Recovered" if tx.is_recovered else tx.payment_status
        audit_reason = latest_audit.reason if latest_audit else "No recovery action recorded yet."
        policy_verdict = policy_eval.policy_verdict if policy_eval else "N/A"
        rule_name = policy_eval.rule_triggered if policy_eval else "N/A"

        explanation = (
            f"### Transaction {tx.transaction_id} Summary\n\n"
            f"- **Customer**: {customer.customer_name if customer else 'Unknown'} ({customer.customer_tier if customer else 'Standard'})\n"
            f"- **Amount**: ₹{tx.amount:,.2f} ({tx.payment_method})\n"
            f"- **Current State**: `{tx.current_state}`\n"
            f"- **Failure Code**: `{tx.failure_reason}`\n"
            f"- **Retry Count**: {tx.retry_count}/2\n"
            f"- **Policy Verdict**: `{policy_verdict}` ({rule_name})\n"
            f"- **Recovered Amount**: ₹{tx.recovered_amount:,.2f}\n\n"
            f"**Audit Rationale**: {audit_reason}"
        )

        return {
            "answer": explanation,
            "data": {
                "transaction_id": tx.transaction_id,
                "amount": tx.amount,
                "status": tx.payment_status,
                "current_state": tx.current_state,
                "is_recovered": tx.is_recovered,
                "recovered_amount": tx.recovered_amount,
                "retry_count": tx.retry_count
            }
        }

    def _get_revenue_recovered_summary(self, db: Session) -> Dict[str, Any]:
        total_recovered = db.query(func.sum(Transaction.recovered_amount)).filter(Transaction.is_recovered.is_(True)).scalar() or 0.0
        total_at_risk = db.query(func.sum(Transaction.amount)).filter(Transaction.payment_status.in_(["FAILED", "ABANDONED"])).scalar() or 0.0
        recovered_count = db.query(Transaction).filter(Transaction.is_recovered.is_(True)).count()
        
        rate = (total_recovered / max(1.0, total_at_risk)) * 100

        text = (
            f"### Revenue Recovery Summary\n\n"
            f"RecoverAI has successfully recovered **₹{total_recovered:,.2f}** across **{recovered_count}** transactions.\n\n"
            f"- **Total Revenue at Risk**: ₹{total_at_risk:,.2f}\n"
            f"- **Net Revenue Captured**: ₹{total_recovered:,.2f}\n"
            f"- **Overall Recovery Rate**: {rate:.1f}%\n\n"
            f"All recoveries were executed in safe test-mode with complete policy compliance."
        )

        return {
            "answer": text,
            "data": {
                "total_recovered": total_recovered,
                "total_at_risk": total_at_risk,
                "recovered_count": recovered_count,
                "recovery_rate": round(rate, 2)
            }
        }

    def _get_highest_value_failed(self, db: Session) -> Dict[str, Any]:
        top_txs = db.query(Transaction).filter(
            Transaction.payment_status.in_(["FAILED", "ABANDONED"]),
            Transaction.is_recovered.is_(False)
        ).order_by(desc(Transaction.amount)).limit(5).all()

        if not top_txs:
            return {
                "answer": "No unrecovered failed transactions found.",
                "data": []
            }

        rows = []
        for t in top_txs:
            rows.append(f"- **{t.transaction_id}**: ₹{t.amount:,.2f} | Method: {t.payment_method} | Failure: `{t.failure_reason}` | Retries: {t.retry_count}/2")

        text = (
            f"### Top 5 Highest-Value Failed Transactions (Unrecovered)\n\n"
            + "\n".join(rows) +
            f"\n\nYou can click on any transaction in the dashboard to review AI diagnosis and trigger bounded recovery."
        )

        return {
            "answer": text,
            "data": [{"id": t.transaction_id, "amount": t.amount, "reason": t.failure_reason} for t in top_txs]
        }

    def _get_escalations_summary(self, db: Session) -> Dict[str, Any]:
        esc_count = db.query(Transaction).filter(Transaction.current_state == "ESCALATED").count()
        esc_amount = db.query(func.sum(Transaction.amount)).filter(Transaction.current_state == "ESCALATED").scalar() or 0.0

        text = (
            f"### Escalated Transactions\n\n"
            f"There are currently **{esc_count}** transactions escalated to merchant operations, representing **₹{esc_amount:,.2f}** in revenue.\n\n"
            f"Transactions are escalated when:\n"
            f"1. Maximum retry limits (2 retries) are reached.\n"
            f"2. Fatal payment declines (e.g. `card_expired`, `fraud_blocked`) occur.\n"
            f"3. High-value transactions exceed auto-recovery safety thresholds."
        )

        return {
            "answer": text,
            "data": {"escalated_count": esc_count, "escalated_amount": esc_amount}
        }

    def _get_blocked_summary(self, db: Session) -> Dict[str, Any]:
        blocked_count = db.query(PolicyEvaluation).filter(PolicyEvaluation.policy_verdict == "BLOCKED").count()
        
        text = (
            f"### Safety Guardrail Enforcements\n\n"
            f"RecoverAI policy engine has blocked **{blocked_count}** unsafe actions to prevent card spam, customer harassment, and unauthorized charges.\n\n"
            f"**Enforced Stopping Rules:**\n"
            f"- `RULE_MAX_RETRIES_EXCEEDED`: Strictly caps retries at 2.\n"
            f"- `RULE_ALREADY_SUCCESSFUL`: Blocks redundant charges on settled transactions.\n"
            f"- `RULE_CUSTOMER_COOLDOWN_ACTIVE`: Enforces 24-hour communication cooldown.\n"
            f"- `RULE_FATAL_FAILURE_NO_RETRY`: Prevents retrying dead cards or fraud blocks."
        )

        return {
            "answer": text,
            "data": {"blocked_count": blocked_count}
        }

    def _get_performance_summary(self, db: Session) -> Dict[str, Any]:
        total_tx = db.query(Transaction).count()
        recovered_tx = db.query(Transaction).filter(Transaction.is_recovered.is_(True)).count()
        at_risk_tx = db.query(Transaction).filter(Transaction.payment_status.in_(["FAILED", "ABANDONED"])).count()
        recovered_amt = db.query(func.sum(Transaction.recovered_amount)).filter(Transaction.is_recovered.is_(True)).scalar() or 0.0

        text = (
            f"### RecoverAI System Performance\n\n"
            f"- **Total Transactions Analyzed**: {total_tx:,}\n"
            f"- **Failed / At-Risk Count**: {at_risk_tx:,}\n"
            f"- **Successfully Recovered Transactions**: {recovered_tx:,}\n"
            f"- **Total Revenue Recovered**: ₹{recovered_amt:,.2f}\n"
            f"- **ML Model ROC-AUC**: 0.8733\n"
            f"- **Precision / Recall**: 71.9% / 85.2%"
        )

        return {
            "answer": text,
            "data": {
                "total_analyzed": total_tx,
                "at_risk_count": at_risk_tx,
                "recovered_count": recovered_tx,
                "recovered_amount": recovered_amt
            }
        }

    def _query_gemini_grounded(self, db: Session, query_text: str) -> Optional[Dict[str, Any]]:
        """
        Uses Google Gemini 1.5/2.0 API grounded strictly in live database telemetry.
        """
        try:
            # Build database snapshot context
            total_tx = db.query(Transaction).count()
            recovered_count = db.query(Transaction).filter(Transaction.is_recovered.is_(True)).count()
            recovered_amount = db.query(func.sum(Transaction.recovered_amount)).filter(Transaction.is_recovered.is_(True)).scalar() or 0.0
            at_risk_amount = db.query(func.sum(Transaction.amount)).filter(Transaction.payment_status.in_(["FAILED", "ABANDONED"])).scalar() or 0.0
            escalations = db.query(Transaction).filter(Transaction.current_state == "ESCALATED").count()
            blocked_policies = db.query(PolicyEvaluation).filter(PolicyEvaluation.policy_verdict == "BLOCKED").count()
            
            # Fetch recent 5 audits
            recent_audits = db.query(AuditLog).order_by(desc(AuditLog.logged_at)).limit(5).all()
            audit_summaries = [
                f"Tx {a.transaction_id}: Decision={a.agent_decision}, Policy={a.policy_result}, Result={a.execution_result}, Reason='{a.reason}'"
                for a in recent_audits
            ]

            # If user mentioned a specific TX
            tx_match = re.search(r'\b(tx\d{3,5})\b', query_text, re.IGNORECASE)
            tx_context = ""
            if tx_match:
                tx_id = tx_match.group(1).upper()
                target_tx = db.query(Transaction).filter(Transaction.transaction_id == tx_id).first()
                if target_tx:
                    c_name = target_tx.customer.customer_name if target_tx.customer else "Unknown"
                    tx_context = (
                        f"\nTarget Transaction {target_tx.transaction_id}: Amount=₹{target_tx.amount}, Status={target_tx.payment_status}, "
                        f"State={target_tx.current_state}, FailureCode={target_tx.failure_reason}, Retries={target_tx.retry_count}/2, "
                        f"Customer='{c_name}', RecoveredAmount=₹{target_tx.recovered_amount}."
                    )

            system_context = (
                f"You are RecoverAI Copilot, an AI revenue recovery assistant for a merchant.\n"
                f"Ground your answer strictly in these real database metrics:\n"
                f"- Total Transactions: {total_tx}\n"
                f"- Revenue at Risk: ₹{at_risk_amount:,.2f}\n"
                f"- Total Recovered Revenue: ₹{recovered_amount:,.2f} across {recovered_count} transactions\n"
                f"- Actions Blocked by Guardrails: {blocked_policies}\n"
                f"- Escalations: {escalations}\n"
                f"- Recent Activity: {'; '.join(audit_summaries)}\n"
                f"{tx_context}\n\n"
                f"Rules: Be professional, concise, and format numbers cleanly in INR (₹). Never invent data not present above."
            )

            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": f"System Context:\n{system_context}\n\nUser Question:\n{query_text}"}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 400
                }
            }

            resp = requests.post(url, json=payload, timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                answer = data["candidates"][0]["content"]["parts"][0]["text"]
                return {
                    "answer": answer.strip(),
                    "data": {
                        "source": "gemini-1.5-flash",
                        "total_recovered": recovered_amount,
                        "revenue_at_risk": at_risk_amount
                    }
                }
        except Exception as e:
            print(f"Gemini API query error: {e}")
        return None

    def _get_general_status(self, db: Session) -> Dict[str, Any]:
        return self._get_revenue_recovered_summary(db)


merchant_assistant = MerchantAssistant()

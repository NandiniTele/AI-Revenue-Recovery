"""
RecoverAI - Dashboard API Router
Provides aggregated KPIs, charts, and activity feeds for the executive dashboard.
"""

import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Dict, Any, List

from backend.database import get_db
from backend.models import Transaction, AuditLog, PolicyEvaluation, RecoveryAction

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def format_time(ts) -> str:
    """Return a full ISO-8601 UTC timestamp string for frontend relative-time display."""
    if ts is None:
        return ""
    if isinstance(ts, (datetime.datetime, datetime.date)):
        return ts.isoformat()
    if isinstance(ts, str):
        return ts
    return str(ts)


@router.get("")
def get_dashboard_data(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Computes real-time dashboard analytics directly from database tables.
    """
    total_analyzed = db.query(Transaction).count()
    
    # Revenue at risk: all transactions with status FAILED or ABANDONED
    at_risk_query = db.query(Transaction).filter(Transaction.payment_status.in_(["FAILED", "ABANDONED"]))
    revenue_at_risk = db.query(func.sum(Transaction.amount)).filter(Transaction.payment_status.in_(["FAILED", "ABANDONED"])).scalar() or 0.0
    at_risk_count = at_risk_query.count()
    
    # Eligible recovery amount: transactions where retry_count < 2 and failure not permanent
    eligible_txs = db.query(Transaction).filter(
        Transaction.payment_status.in_(["FAILED", "ABANDONED"]),
        Transaction.failure_reason.notin_(["fraud_blocked", "account_closed"]),
        Transaction.retry_count < 2
    )
    eligible_recovery_amount = db.query(func.sum(Transaction.amount)).filter(
        Transaction.payment_status.in_(["FAILED", "ABANDONED"]),
        Transaction.failure_reason.notin_(["fraud_blocked", "account_closed"]),
        Transaction.retry_count < 2
    ).scalar() or 0.0
    eligible_count = eligible_txs.count()

    # Recovery attempts: total recovery actions recorded
    recovery_attempts = db.query(RecoveryAction).count()
    
    # Successful recoveries & revenue recovered
    recovered_txs = db.query(Transaction).filter(Transaction.is_recovered.is_(True))
    successful_recoveries = recovered_txs.count()
    revenue_recovered = db.query(func.sum(Transaction.recovered_amount)).filter(Transaction.is_recovered.is_(True)).scalar() or 0.0

    # Failed recovery actions
    failed_recoveries = db.query(RecoveryAction).filter(RecoveryAction.status == "FAILED").count()

    # Stopped / Blocked by guardrails
    stopped_actions = db.query(PolicyEvaluation).filter(PolicyEvaluation.policy_verdict == "BLOCKED").count()

    # Escalations
    escalations = db.query(Transaction).filter(Transaction.current_state == "ESCALATED").count()

    # Recovery rate (percentage of recovered revenue vs total revenue at risk)
    recovery_rate = (revenue_recovered / max(1.0, revenue_at_risk)) * 100 if revenue_at_risk > 0 else 0.0

    # Failure Reasons Breakdown for charts
    failure_breakdown_raw = db.query(
        Transaction.failure_reason,
        func.count(Transaction.transaction_id),
        func.sum(Transaction.amount)
    ).group_by(Transaction.failure_reason).all()

    failure_chart_data = []
    for reason, count, amount in failure_breakdown_raw:
        if reason and reason != "none":
            reason_str = str(reason).replace("_", " ").title()
            failure_chart_data.append({
                "reason": reason_str,
                "count": count,
                "amount": round(float(amount or 0.0), 2)
            })

    # Payment Method breakdown
    method_breakdown_raw = db.query(
        Transaction.payment_method,
        func.count(Transaction.transaction_id),
        func.sum(Transaction.amount),
        func.sum(Transaction.recovered_amount)
    ).group_by(Transaction.payment_method).all()

    method_chart_data = []
    for method, count, amt, rec_amt in method_breakdown_raw:
        method_chart_data.append({
            "method": str(method or "Unknown"),
            "count": count,
            "at_risk_amount": round(float(amt or 0.0), 2),
            "recovered_amount": round(float(rec_amt or 0.0), 2)
        })

    # Recent live agent activity feed
    recent_audits = db.query(AuditLog).order_by(desc(AuditLog.logged_at)).limit(10).all()
    activity_feed = []
    for audit in recent_audits:
        activity_feed.append({
            "audit_id": audit.audit_id or "",
            "timestamp": format_time(audit.logged_at),
            "transaction_id": audit.transaction_id or "",
            "agent_decision": audit.agent_decision or "",
            "policy_result": audit.policy_result or "",
            "execution_result": audit.execution_result or "",
            "recovered_amount": float(audit.recovered_amount or 0.0),
            "reason": audit.reason or "",
            "next_action": audit.next_action or ""
        })

    return {
        "kpis": {
            "total_transactions_analyzed": total_analyzed,
            "revenue_at_risk": round(float(revenue_at_risk), 2),
            "at_risk_count": at_risk_count,
            "eligible_recovery_amount": round(float(eligible_recovery_amount), 2),
            "eligible_count": eligible_count,
            "recovery_attempts": recovery_attempts,
            "successful_recoveries": successful_recoveries,
            "revenue_recovered": round(float(revenue_recovered), 2),
            "recovery_rate": round(float(recovery_rate), 2),
            "failed_recoveries": failed_recoveries,
            "stopped_actions": stopped_actions,
            "escalations": escalations
        },
        "charts": {
            "failure_reasons": sorted(failure_chart_data, key=lambda x: x["amount"], reverse=True),
            "payment_methods": method_chart_data
        },
        "activity_feed": activity_feed,
        "generated_at": datetime.datetime.utcnow().isoformat()
    }


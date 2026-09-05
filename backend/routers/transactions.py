"""
RecoverAI - Transactions API Router
Handles query, filtering, sorting, pagination, and single transaction deep-dive inspection.
"""

import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, or_
from typing import Dict, Any, List, Optional

from backend.database import get_db
from backend.models import Transaction, Customer, RiskPrediction, AgentDecision, PolicyEvaluation, AuditLog, RecoveryAction

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


def format_datetime(ts) -> str:
    if ts is None:
        return ""
    if isinstance(ts, (datetime.datetime, datetime.date)):
        return ts.strftime("%Y-%m-%d %H:%M:%S")
    return str(ts)



@router.get("")
def list_transactions(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    status: Optional[str] = Query(None),
    current_state: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    min_amount: Optional[float] = Query(None),
    sort_by: str = Query("transaction_timestamp"),
    sort_order: str = Query("desc")
) -> Dict[str, Any]:
    query = db.query(Transaction).join(Customer)

    if status and status != "ALL":
        if status == "RECOVERED":
            query = query.filter(Transaction.is_recovered == True)
        elif status == "ESCALATED":
            query = query.filter(Transaction.current_state == "ESCALATED")
        else:
            query = query.filter(Transaction.payment_status == status)

    if current_state and current_state != "ALL":
        query = query.filter(Transaction.current_state == current_state)

    if payment_method and payment_method != "ALL":
        query = query.filter(Transaction.payment_method == payment_method)

    if min_amount:
        query = query.filter(Transaction.amount >= min_amount)

    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            or_(
                Transaction.transaction_id.ilike(search_fmt),
                Transaction.failure_reason.ilike(search_fmt),
                Customer.customer_name.ilike(search_fmt),
                Customer.customer_id.ilike(search_fmt),
                Customer.customer_email.ilike(search_fmt)
            )
        )

    total_count = query.count()

    # Sort
    sort_column = getattr(Transaction, sort_by, Transaction.transaction_timestamp)
    if sort_order.lower() == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))

    offset = (page - 1) * limit
    transactions = query.offset(offset).limit(limit).all()

    items = []
    for tx in transactions:
        customer = tx.customer
        risk_pred = db.query(RiskPrediction).filter(RiskPrediction.transaction_id == tx.transaction_id).first()
        decision = db.query(AgentDecision).filter(AgentDecision.transaction_id == tx.transaction_id).first()
        
        items.append({
            "transaction_id": tx.transaction_id,
            "customer_id": tx.customer_id,
            "customer_name": customer.customer_name if customer else "Unknown",
            "customer_tier": customer.customer_tier if customer else "Standard",
            "amount": tx.amount,
            "currency": tx.currency,
            "payment_status": tx.payment_status,
            "failure_reason": tx.failure_reason,
            "payment_method": tx.payment_method,
            "checkout_status": tx.checkout_status,
            "subscription_status": tx.subscription_status,
            "days_overdue": tx.days_overdue,
            "retry_count": tx.retry_count,
            "is_recovered": tx.is_recovered,
            "recovered_amount": tx.recovered_amount,
            "current_state": tx.current_state,
            "transaction_timestamp": format_datetime(tx.transaction_timestamp),
            "risk_score": risk_pred.risk_score if risk_pred else 50,
            "recovery_probability": risk_pred.recovery_probability if risk_pred else 0.5,
            "recovery_eligible": risk_pred.recovery_eligible if risk_pred else "YES",
            "recommended_action": decision.selected_action if decision else "RETRY_PAYMENT"
        })

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit
    }


@router.get("/{transaction_id}")
def get_transaction_details(transaction_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    tx = db.query(Transaction).filter(Transaction.transaction_id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail=f"Transaction {transaction_id} not found.")

    customer = tx.customer
    risk_pred = db.query(RiskPrediction).filter(RiskPrediction.transaction_id == tx.transaction_id).first()
    decision = db.query(AgentDecision).filter(AgentDecision.transaction_id == tx.transaction_id).first()
    policy_evals = db.query(PolicyEvaluation).filter(PolicyEvaluation.transaction_id == tx.transaction_id).order_by(desc(PolicyEvaluation.created_at)).all()
    actions = db.query(RecoveryAction).filter(RecoveryAction.transaction_id == tx.transaction_id).order_by(desc(RecoveryAction.created_at)).all()
    audits = db.query(AuditLog).filter(AuditLog.transaction_id == tx.transaction_id).order_by(desc(AuditLog.logged_at)).all()

    return {
        "transaction": {
            "transaction_id": tx.transaction_id,
            "amount": tx.amount,
            "currency": tx.currency,
            "payment_status": tx.payment_status,
            "failure_reason": tx.failure_reason,
            "payment_method": tx.payment_method,
            "checkout_status": tx.checkout_status,
            "subscription_status": tx.subscription_status,
            "days_overdue": tx.days_overdue,
            "retry_count": tx.retry_count,
            "is_recovered": tx.is_recovered,
            "recovered_amount": tx.recovered_amount,
            "current_state": tx.current_state,
            "transaction_timestamp": format_datetime(tx.transaction_timestamp)
        },
        "customer": {
            "customer_id": customer.customer_id if customer else None,
            "customer_name": customer.customer_name if customer else "Unknown",
            "customer_email": customer.customer_email if customer else "unknown@example.com",
            "customer_tier": customer.customer_tier if customer else "Standard",
            "previous_success_count": customer.previous_success_count if customer else 0,
            "previous_failure_count": customer.previous_failure_count if customer else 0,
            "customer_value": customer.customer_value if customer else 0.0,
            "last_contacted_at": format_datetime(customer.last_contacted_at) if customer and customer.last_contacted_at else None
        },
        "risk_prediction": {
            "risk_score": risk_pred.risk_score if risk_pred else None,
            "recovery_probability": risk_pred.recovery_probability if risk_pred else None,
            "recovery_eligible": risk_pred.recovery_eligible if risk_pred else None,
            "key_factors": risk_pred.key_factors_json if risk_pred else []
        },
        "agent_decision": {
            "diagnosis_text": decision.diagnosis_text if decision else None,
            "selected_action": decision.selected_action if decision else None,
            "reasoning": decision.reasoning if decision else None,
            "applicable_safety_rule": decision.applicable_safety_rule if decision else None
        },
        "policy_evaluations": [
            {
                "id": pe.id,
                "action_requested": pe.action_requested,
                "policy_verdict": pe.policy_verdict,
                "rule_triggered": pe.rule_triggered,
                "details": pe.details,
                "created_at": format_datetime(pe.created_at)
            } for pe in policy_evals
        ],
        "recovery_actions": [
            {
                "id": a.id,
                "action_type": a.action_type,
                "gateway_type": a.gateway_type,
                "status": a.status,
                "recovered_amount": a.recovered_amount,
                "gateway_reference": a.gateway_reference,
                "failure_details": a.failure_details,
                "created_at": format_datetime(a.created_at)
            } for a in actions
        ],
        "audit_logs": [
            {
                "audit_id": al.audit_id,
                "timestamp": format_datetime(al.logged_at),
                "agent_decision": al.agent_decision,
                "reason": al.reason,
                "risk_score": al.risk_score,
                "action_requested": al.action_requested,
                "policy_result": al.policy_result,
                "action_executed": al.action_executed,
                "execution_result": al.execution_result,
                "recovered_amount": al.recovered_amount,
                "failure_reason": al.failure_reason,
                "next_action": al.next_action,
                "details": al.details_json
            } for al in audits
        ]
    }

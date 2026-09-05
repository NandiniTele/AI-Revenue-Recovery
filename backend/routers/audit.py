"""
RecoverAI - Audit Trail API Router
Provides comprehensive immutable audit log searching, filtering, and export.
"""

import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from typing import Dict, Any, Optional

from backend.database import get_db
from backend.models import AuditLog

router = APIRouter(prefix="/api/audit", tags=["Audit Trail"])


def format_datetime(ts) -> str:
    if ts is None:
        return ""
    if isinstance(ts, (datetime.datetime, datetime.date)):
        return ts.strftime("%Y-%m-%d %H:%M:%S")
    return str(ts)


@router.get("")
def get_audit_trail(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=150),
    transaction_id: Optional[str] = Query(None),
    policy_result: Optional[str] = Query(None),
    execution_result: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
) -> Dict[str, Any]:
    query = db.query(AuditLog)

    if transaction_id:
        query = query.filter(AuditLog.transaction_id.ilike(f"%{transaction_id}%"))

    if policy_result and policy_result != "ALL":
        query = query.filter(AuditLog.policy_result == policy_result)

    if execution_result and execution_result != "ALL":
        query = query.filter(AuditLog.execution_result == execution_result)

    if action and action != "ALL":
        query = query.filter(AuditLog.action_requested == action)

    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            or_(
                AuditLog.audit_id.ilike(search_fmt),
                AuditLog.transaction_id.ilike(search_fmt),
                AuditLog.reason.ilike(search_fmt),
                AuditLog.agent_decision.ilike(search_fmt),
                AuditLog.failure_reason.ilike(search_fmt)
            )
        )

    total_count = query.count()
    offset = (page - 1) * limit
    logs = query.order_by(desc(AuditLog.logged_at)).offset(offset).limit(limit).all()

    items = []
    for log in logs:
        items.append({
            "audit_id": log.audit_id,
            "timestamp": format_datetime(log.logged_at),
            "transaction_id": log.transaction_id,
            "agent_decision": log.agent_decision,
            "reason": log.reason,
            "risk_score": log.risk_score,
            "action_requested": log.action_requested,
            "policy_result": log.policy_result,
            "action_executed": log.action_executed,
            "execution_result": log.execution_result,
            "recovered_amount": log.recovered_amount,
            "failure_reason": log.failure_reason,
            "next_action": log.next_action,
            "details": log.details_json
        })

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit
    }


@router.get("/{transaction_id}")
def get_transaction_audit_trail(transaction_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    logs = db.query(AuditLog).filter(AuditLog.transaction_id == transaction_id).order_by(desc(AuditLog.logged_at)).all()
    return {
        "transaction_id": transaction_id,
        "logs": [
            {
                "audit_id": log.audit_id,
                "timestamp": format_datetime(log.logged_at),
                "agent_decision": log.agent_decision,
                "reason": log.reason,
                "risk_score": log.risk_score,
                "action_requested": log.action_requested,
                "policy_result": log.policy_result,
                "action_executed": log.action_executed,
                "execution_result": log.execution_result,
                "recovered_amount": log.recovered_amount,
                "failure_reason": log.failure_reason,
                "next_action": log.next_action,
                "details": log.details_json
            } for log in logs
        ]
    }

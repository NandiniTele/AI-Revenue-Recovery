"""
RecoverAI - Recovery Actions API Router
Handles single-transaction intervention triggers with policy-enforced execution.
"""

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel

from backend.database import get_db
from backend.agent import recovery_agent

router = APIRouter(prefix="/api/recovery", tags=["Recovery"])


class ExecuteActionRequest(BaseModel):
    action_override: Optional[str] = None
    force_failure_mode: Optional[str] = None


@router.post("/execute/{transaction_id}")
def execute_recovery_action(
    transaction_id: str,
    req: ExecuteActionRequest = Body(default=ExecuteActionRequest()),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    try:
        return recovery_agent.execute_recovery(
            db=db,
            transaction_id=transaction_id,
            override_action=req.action_override,
            force_failure_mode=req.force_failure_mode
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recovery execution failed: {str(e)}")


@router.post("/retry/{transaction_id}")
def retry_payment(transaction_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    return execute_recovery_action(transaction_id, ExecuteActionRequest(action_override="RETRY_PAYMENT"), db)


@router.post("/remind/{transaction_id}")
def send_reminder(transaction_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    return execute_recovery_action(transaction_id, ExecuteActionRequest(action_override="SEND_PAYMENT_REMINDER"), db)


@router.post("/escalate/{transaction_id}")
def escalate_transaction(transaction_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    return execute_recovery_action(transaction_id, ExecuteActionRequest(action_override="CREATE_ESCALATION"), db)

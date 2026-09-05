"""
RecoverAI - Demo Controls & Settings API Router
Provides one-click demo reset, deliberate failure injection, and merchant guardrail settings.
"""

from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel

from backend.database import get_db
from backend.models import Transaction, MerchantSettings
from backend.agent import recovery_agent
from backend.seed_db import seed_database_from_csv

router = APIRouter(prefix="/api/demo", tags=["Demo & Settings"])


class UpdateSettingsRequest(BaseModel):
    max_retries_allowed: Optional[int] = None
    retry_cooldown_hours: Optional[int] = None
    high_value_manual_threshold: Optional[float] = None
    auto_recovery_enabled: Optional[bool] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[int] = None  # 0-23 hour (e.g. 22 = 10 PM)
    quiet_hours_end: Optional[int] = None    # 0-23 hour (e.g. 8 = 8 AM)


class InjectFailureRequest(BaseModel):
    transaction_id: str = "TX1024"
    failure_type: str = "GATEWAY_TIMEOUT"  # GATEWAY_TIMEOUT, BANK_DOWNTIME, INSUFFICIENT_FUNDS


@router.post("/reset")
def reset_demo_database(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Resets the database back to the fresh demo dataset."""
    result = seed_database_from_csv(reset_existing=True)
    return {
        "status": "SUCCESS",
        "message": "Demo database successfully reset with 1,250 transaction records.",
        "details": result
    }


@router.post("/inject-failure")
def inject_failure_scenario(req: InjectFailureRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Demonstrates graceful failure handling (Hackathon Demo Step 10).
    Forces a gateway failure, verifying that stopping rules prevent infinite retries.
    """
    tx = db.query(Transaction).filter(Transaction.transaction_id == req.transaction_id).first()
    if not tx:
        # If TX1024 not found, grab any failed transaction
        tx = db.query(Transaction).filter(Transaction.payment_status == "FAILED").first()
        if not tx:
            return {"status": "ERROR", "message": "No failed transaction available to inject failure."}

    # Execute recovery with forced failure mode
    exec_result = recovery_agent.execute_recovery(
        db=db,
        transaction_id=tx.transaction_id,
        force_failure_mode=req.failure_type
    )

    return {
        "scenario": "GRACEFUL_FAILURE_HANDLING_DEMO",
        "transaction_id": tx.transaction_id,
        "injected_error": req.failure_type,
        "execution_result": exec_result,
        "demonstration_notes": (
            f"The AI attempted payment recovery on {tx.transaction_id}, but encountered simulated '{req.failure_type}'. "
            f"Instead of retrying in a loop, the agent captured the error, incremented the retry counter ({tx.retry_count}/2), "
            f"updated the transaction state to '{tx.current_state}', and recorded the event in the audit trail."
        )
    }


@router.get("/settings")
def get_merchant_settings(db: Session = Depends(get_db)) -> Dict[str, Any]:
    settings = db.query(MerchantSettings).first()
    if not settings:
        settings = MerchantSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)

    updated_at_str = ""
    if settings.updated_at:
        if isinstance(settings.updated_at, str):
            updated_at_str = settings.updated_at
        else:
            try:
                updated_at_str = settings.updated_at.strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                updated_at_str = str(settings.updated_at)

    return {
        "merchant_name": settings.merchant_name,
        "max_retries_allowed": settings.max_retries_allowed,
        "retry_cooldown_hours": settings.retry_cooldown_hours,
        "high_value_manual_threshold": settings.high_value_manual_threshold,
        "auto_recovery_enabled": settings.auto_recovery_enabled,
        "quiet_hours_enabled": settings.quiet_hours_enabled,
        "quiet_hours_start": settings.quiet_hours_start,
        "quiet_hours_end": settings.quiet_hours_end,
        "updated_at": updated_at_str
    }



@router.post("/settings")
def update_merchant_settings(req: UpdateSettingsRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    settings = db.query(MerchantSettings).first()
    if not settings:
        settings = MerchantSettings()
        db.add(settings)

    if req.max_retries_allowed is not None:
        settings.max_retries_allowed = req.max_retries_allowed
    if req.retry_cooldown_hours is not None:
        settings.retry_cooldown_hours = req.retry_cooldown_hours
    if req.high_value_manual_threshold is not None:
        settings.high_value_manual_threshold = req.high_value_manual_threshold
    if req.auto_recovery_enabled is not None:
        settings.auto_recovery_enabled = req.auto_recovery_enabled
    if req.quiet_hours_enabled is not None:
        settings.quiet_hours_enabled = req.quiet_hours_enabled
    if req.quiet_hours_start is not None:
        settings.quiet_hours_start = req.quiet_hours_start
    if req.quiet_hours_end is not None:
        settings.quiet_hours_end = req.quiet_hours_end

    db.commit()
    db.refresh(settings)

    return {
        "status": "SUCCESS",
        "message": "Merchant guardrail settings updated.",
        "settings": {
            "max_retries_allowed": settings.max_retries_allowed,
            "retry_cooldown_hours": settings.retry_cooldown_hours,
            "high_value_manual_threshold": settings.high_value_manual_threshold,
            "auto_recovery_enabled": settings.auto_recovery_enabled,
            "quiet_hours_enabled": settings.quiet_hours_enabled,
            "quiet_hours_start": settings.quiet_hours_start,
            "quiet_hours_end": settings.quiet_hours_end
        }
    }

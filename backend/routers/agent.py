"""
RecoverAI - Agent API Router
Provides endpoints for AI transaction diagnosis and automated batch recovery runs.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from backend.database import get_db
from backend.models import Transaction
from backend.agent import recovery_agent

router = APIRouter(prefix="/api/agent", tags=["Agent"])


class BatchRecoveryRequest(BaseModel):
    batch_size: int = 50
    allow_reminders: bool = True
    include_abandoned: bool = True


@router.post("/analyze/{transaction_id}")
def analyze_transaction(transaction_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    try:
        return recovery_agent.diagnose_transaction(db, transaction_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/batch-recover")
def run_batch_recovery(req: BatchRecoveryRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Executes automated recovery workflow across a batch of eligible at-risk transactions.
    Demonstrates Track 03: Detect -> Diagnose -> Decide -> Guard -> Execute -> Measure -> Audit
    """
    # Fetch eligible unrecovered transactions
    query = db.query(Transaction).filter(
        Transaction.payment_status.in_(["FAILED", "ABANDONED"] if req.include_abandoned else ["FAILED"]),
        Transaction.is_recovered.is_(False),
        Transaction.current_state.notin_(["BLOCKED", "STOPPED", "RECOVERED"])
    ).limit(req.batch_size)

    eligible_txs = query.all()
    if not eligible_txs:
        return {
            "message": "No pending unrecovered transactions found in batch.",
            "processed_count": 0,
            "recovered_count": 0,
            "recovered_amount": 0.0,
            "blocked_count": 0,
            "escalated_count": 0,
            "results": []
        }

    results = []
    total_recovered_amount = 0.0
    recovered_count = 0
    blocked_count = 0
    escalated_count = 0
    failed_count = 0

    for tx in eligible_txs:
        try:
            res = recovery_agent.execute_recovery(db, tx.transaction_id)
            results.append(res)
            
            if res.get("execution_result") == "SUCCESS":
                recovered_count += 1
                total_recovered_amount += res.get("recovered_amount", 0.0)
            elif res.get("policy_result") == "BLOCKED":
                blocked_count += 1
                if res.get("next_action") == "CREATE_ESCALATION":
                    escalated_count += 1
            elif res.get("execution_result") == "ESCALATED":
                escalated_count += 1
            elif res.get("execution_result") == "FAILED":
                failed_count += 1
        except Exception as e:
            results.append({
                "transaction_id": tx.transaction_id,
                "error": str(e),
                "execution_result": "ERROR"
            })

    return {
        "message": f"Processed {len(eligible_txs)} transactions.",
        "processed_count": len(eligible_txs),
        "recovered_count": recovered_count,
        "recovered_amount": round(total_recovered_amount, 2),
        "blocked_count": blocked_count,
        "escalated_count": escalated_count,
        "failed_count": failed_count,
        "results": results[:20]  # Return preview of results
    }

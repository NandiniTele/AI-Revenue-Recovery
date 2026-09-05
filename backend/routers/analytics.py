"""
RecoverAI - Analytics & ML Evaluation Router
Returns real evaluation metrics computed directly on the held-out test set,
confusion matrix, false-positive business impact analysis, and feature importances.
"""

import os
import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any

from backend.database import get_db
from backend.models import Transaction, PolicyEvaluation, RecoveryAction

router = APIRouter(prefix="/api/analytics", tags=["Analytics & Evaluation"])


@router.get("")
def get_analytics_scorecard(db: Session = Depends(get_db)) -> Dict[str, Any]:
    metrics_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "ml", "ml_metrics.json")
    
    ml_data = {}
    if os.path.exists(metrics_path):
        try:
            with open(metrics_path, "r") as f:
                ml_data = json.load(f)
        except Exception:
            pass

    # Calculate safety metrics live from database
    total_policy_evals = db.query(PolicyEvaluation).count()
    blocked_count = db.query(PolicyEvaluation).filter(PolicyEvaluation.policy_verdict == "BLOCKED").count()
    approved_count = db.query(PolicyEvaluation).filter(PolicyEvaluation.policy_verdict == "APPROVED").count()

    all_evals = db.query(PolicyEvaluation).all()
    rule_counts = {}
    for pe in all_evals:
        r = pe.rule_triggered or "UNKNOWN"
        rule_counts[r] = rule_counts.get(r, 0) + 1

    rule_stats = [{"rule": k, "count": v} for k, v in sorted(rule_counts.items(), key=lambda x: x[1], reverse=True)]

    return {
        "ml_evaluation": ml_data,
        "safety_guardrails": {
            "total_evaluations": total_policy_evals,
            "actions_approved": approved_count,
            "actions_blocked": blocked_count,
            "block_rate": round((blocked_count / max(1, total_policy_evals)) * 100, 2),
            "rules_triggered": rule_stats
        }
    }

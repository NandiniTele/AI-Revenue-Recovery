"""
Unit tests for ML pipeline, dataset generation, and risk engine inference.
"""

import os
import json
import pytest
from ml.dataset_generator import generate_dataset
from ml.risk_engine import RiskEngine


def test_dataset_generation():
    df = generate_dataset(200)
    assert len(df) == 200
    assert "transaction_id" in df.columns
    assert "recovery_probability" in df.columns
    assert "actual_recoverable" in df.columns
    assert "payment_status" in df.columns


def test_ml_metrics_validity():
    metrics_path = "ml/ml_metrics.json"
    assert os.path.exists(metrics_path), "ml_metrics.json must exist"
    
    with open(metrics_path, "r") as f:
        metrics = json.load(f)
        
    eval_m = metrics.get("evaluation_metrics", {})
    assert "precision" in eval_m
    assert "recall" in eval_m
    assert "f1_score" in eval_m
    assert "roc_auc" in eval_m
    assert eval_m["roc_auc"] > 0.70, "Model ROC-AUC must be above 0.70"
    
    cm = metrics.get("confusion_matrix", {})
    assert "true_positives" in cm
    assert "false_positives" in cm


def test_risk_engine_inference():
    engine = RiskEngine("ml/model_bundle.joblib")
    
    # Test high probability case
    sample_tx = {
        "payment_status": "FAILED",
        "amount": 4999.0,
        "previous_success_count": 8,
        "previous_failure_count": 1,
        "retry_count": 0,
        "days_overdue": 1,
        "customer_value": 45000.0,
        "payment_method": "UPI",
        "customer_tier": "VIP",
        "failure_reason": "network_timeout",
        "checkout_status": "COMPLETED",
        "subscription_status": "NONE"
    }
    
    result = engine.assess_transaction(sample_tx)
    assert result["risk_score"] >= 0 and result["risk_score"] <= 100
    assert 0.0 <= result["recovery_probability"] <= 1.0
    assert result["recovery_eligible"] == "YES"
    assert result["recommended_action"] == "RETRY_PAYMENT"
    assert len(result["key_factors"]) > 0

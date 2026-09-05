"""
Integration tests for FastAPI endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["project"] == "RecoverAI – AI-Powered Revenue Recovery Agent"
    assert data["mode"] == "TEST_MODE_ONLY"


def test_dashboard_endpoint():
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert "kpis" in data
    assert "revenue_at_risk" in data["kpis"]
    assert "revenue_recovered" in data["kpis"]
    assert "charts" in data
    assert "activity_feed" in data


def test_transactions_list_endpoint():
    response = client.get("/api/transactions?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) <= 10
    assert "total" in data
    assert data["total"] > 0


def test_single_transaction_detail_endpoint():
    # Fetch first transaction
    tx_list = client.get("/api/transactions?limit=1").json()
    first_id = tx_list["items"][0]["transaction_id"]
    
    response = client.get(f"/api/transactions/{first_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["transaction"]["transaction_id"] == first_id
    assert "customer" in data
    assert "risk_prediction" in data
    assert "agent_decision" in data


def test_agent_diagnosis_endpoint():
    tx_list = client.get("/api/transactions?limit=1").json()
    first_id = tx_list["items"][0]["transaction_id"]
    
    response = client.post(f"/api/agent/analyze/{first_id}")
    assert response.status_code == 200
    data = response.json()
    assert "risk_score" in data
    assert "recovery_probability" in data
    assert "recommended_action" in data
    assert "diagnosis_text" in data


def test_audit_trail_endpoint():
    response = client.get("/api/audit?limit=15")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data


def test_analytics_endpoint():
    response = client.get("/api/analytics")
    assert response.status_code == 200
    data = response.json()
    assert "ml_evaluation" in data
    assert "safety_guardrails" in data


def test_assistant_chat_endpoint():
    response = client.post("/api/assistant/chat", json={"message": "How much revenue did we recover?"})
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "₹" in data["answer"]

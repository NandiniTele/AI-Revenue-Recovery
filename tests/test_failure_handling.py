"""
Tests for graceful failure handling and stopping rule activation.
Demonstrates:
AI chooses RETRY_PAYMENT -> Payment service fails -> API error detected ->
Agent does NOT retry indefinitely -> Action marked FAILED -> Escalation triggered -> Audit trail updated.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_graceful_failure_handling_and_escalation():
    # 1. Reset demo database to clean state
    reset_res = client.post("/api/demo/reset")
    assert reset_res.status_code == 200

    # 2. Pick a transaction with retry_count = 0 and inject failure #1
    tx_list = client.get("/api/transactions?status=FAILED&limit=50").json()
    zero_retry_txs = [t for t in tx_list["items"] if t["retry_count"] == 0]
    target_tx_id = zero_retry_txs[0]["transaction_id"]

    # First failed attempt (simulated bank downtime)
    res1 = client.post("/api/recovery/execute/" + target_tx_id, json={"force_failure_mode": "BANK_DOWNTIME"})
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["execution_result"] == "FAILED"
    assert data1["policy_result"] == "APPROVED"

    # Check updated transaction
    tx_detail1 = client.get(f"/api/transactions/{target_tx_id}").json()
    assert tx_detail1["transaction"]["retry_count"] == 1

    # Second failed attempt (reaches max limit 2)
    res2 = client.post("/api/recovery/execute/" + target_tx_id, json={"force_failure_mode": "GATEWAY_TIMEOUT"})
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["execution_result"] == "FAILED"
    assert data2["next_action"] == "CREATE_ESCALATION"

    # Check updated transaction is now escalated
    tx_detail2 = client.get(f"/api/transactions/{target_tx_id}").json()
    assert tx_detail2["transaction"]["retry_count"] == 2
    assert tx_detail2["transaction"]["current_state"] == "ESCALATED"

    # Third attempt (Requesting RETRY_PAYMENT) MUST BE BLOCKED by Policy Engine (Stopping Rule!)
    res3 = client.post("/api/recovery/execute/" + target_tx_id, json={"action_override": "RETRY_PAYMENT"})
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["policy_result"] == "BLOCKED"
    assert data3["rule_triggered"] == "RULE_MAX_RETRIES_EXCEEDED"
    assert data3["next_action"] == "CREATE_ESCALATION"

    # Verify Audit Trail recorded all 3 events
    audit_res = client.get(f"/api/audit/{target_tx_id}").json()
    logs = audit_res["logs"]
    assert len(logs) >= 3
    # Check the latest log entry is the blocked policy
    assert logs[0]["policy_result"] == "BLOCKED"
    assert "RULE_MAX_RETRIES_EXCEEDED" in logs[0]["failure_reason"]

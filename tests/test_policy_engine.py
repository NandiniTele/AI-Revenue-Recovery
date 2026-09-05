"""
Unit tests for Policy and Guardrail Engine stopping rules.
Verifies safety boundaries, retry caps, fatal decline stops, and cooldowns.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import Transaction, Customer, MerchantSettings
from backend.policy_engine import PolicyEngine


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Create dummy customer and merchant settings
    customer = Customer(
        customer_id="CUST_TEST",
        customer_name="Test User",
        customer_email="test@example.com",
        customer_tier="Standard",
        previous_success_count=5,
        previous_failure_count=1,
        customer_value=25000.0
    )
    session.add(customer)

    settings = MerchantSettings(
        merchant_name="Test Merchant",
        max_retries_allowed=2,
        retry_cooldown_hours=24,
        high_value_manual_threshold=40000.0
    )
    session.add(settings)
    session.commit()

    yield session
    session.close()


def test_rule_success_cannot_be_retried(db_session):
    tx = Transaction(
        transaction_id="TX_SUCCESS",
        customer_id="CUST_TEST",
        amount=1999.0,
        payment_status="SUCCESS",
        is_recovered=True,
        payment_method="UPI"
    )
    db_session.add(tx)
    db_session.commit()

    is_approved, rule, reason, next_action = PolicyEngine.evaluate(db_session, tx, "RETRY_PAYMENT")
    assert is_approved is False
    assert rule == "RULE_ALREADY_SUCCESSFUL"
    assert next_action == "NO_ACTION"


def test_rule_max_retries_exceeded_blocks_and_escalates(db_session):
    tx = Transaction(
        transaction_id="TX_MAX_RETRY",
        customer_id="CUST_TEST",
        amount=2999.0,
        payment_status="FAILED",
        failure_reason="network_timeout",
        retry_count=2, # Limit is 2
        payment_method="Credit Card"
    )
    db_session.add(tx)
    db_session.commit()

    is_approved, rule, reason, next_action = PolicyEngine.evaluate(db_session, tx, "RETRY_PAYMENT")
    assert is_approved is False
    assert rule == "RULE_MAX_RETRIES_EXCEEDED"
    assert next_action == "CREATE_ESCALATION"


def test_rule_fatal_failure_blocks_retry(db_session):
    tx = Transaction(
        transaction_id="TX_FATAL",
        customer_id="CUST_TEST",
        amount=4999.0,
        payment_status="FAILED",
        failure_reason="fraud_blocked",
        retry_count=0,
        payment_method="Debit Card"
    )
    db_session.add(tx)
    db_session.commit()

    is_approved, rule, reason, next_action = PolicyEngine.evaluate(db_session, tx, "RETRY_PAYMENT")
    assert is_approved is False
    assert rule == "RULE_FATAL_FAILURE_NO_RETRY"
    assert next_action == "CREATE_ESCALATION"


def test_rule_expired_card_redirects_to_reminder(db_session):
    tx = Transaction(
        transaction_id="TX_EXPIRED",
        customer_id="CUST_TEST",
        amount=999.0,
        payment_status="FAILED",
        failure_reason="card_expired",
        retry_count=0,
        payment_method="Credit Card"
    )
    db_session.add(tx)
    db_session.commit()

    is_approved, rule, reason, next_action = PolicyEngine.evaluate(db_session, tx, "RETRY_PAYMENT")
    assert is_approved is False
    assert rule == "RULE_EXPIRED_CARD_UPDATE_REQUIRED"
    assert next_action == "SEND_PAYMENT_REMINDER"


def test_rule_valid_retry_approved(db_session):
    tx = Transaction(
        transaction_id="TX_VALID",
        customer_id="CUST_TEST",
        amount=1499.0,
        payment_status="FAILED",
        failure_reason="network_timeout",
        retry_count=0,
        payment_method="UPI"
    )
    db_session.add(tx)
    db_session.commit()

    is_approved, rule, reason, next_action = PolicyEngine.evaluate(db_session, tx, "RETRY_PAYMENT")
    assert is_approved is True
    assert rule == "RULE_POLICY_APPROVED"

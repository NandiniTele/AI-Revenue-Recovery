"""
RecoverAI - SQLAlchemy Database Models
Defines complete relational schema for transactions, risk scoring, agent decisions,
policy evaluations, recovery actions, audit logs, and merchant guardrail settings.
"""

import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from backend.database import Base


class Customer(Base):
    __tablename__ = "customers"

    customer_id = Column(String(50), primary_key=True, index=True)
    customer_name = Column(String(100), nullable=False)
    customer_email = Column(String(100), nullable=False)
    customer_tier = Column(String(30), default="Standard")  # VIP, Enterprise, Standard, New
    previous_success_count = Column(Integer, default=0)
    previous_failure_count = Column(Integer, default=0)
    customer_value = Column(Float, default=0.0)  # LTV in INR
    last_contacted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    transactions = relationship("Transaction", back_populates="customer")


class Transaction(Base):
    __tablename__ = "transactions"

    transaction_id = Column(String(50), primary_key=True, index=True)
    customer_id = Column(String(50), ForeignKey("customers.customer_id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="INR")
    payment_status = Column(String(30), nullable=False, index=True)  # FAILED, SUCCESS, ABANDONED, PENDING
    failure_reason = Column(String(100), nullable=True)
    payment_method = Column(String(50), nullable=False)  # UPI, Credit Card, Debit Card, Net Banking, Wallet
    checkout_status = Column(String(50), default="COMPLETED")
    subscription_status = Column(String(50), default="NONE")
    days_overdue = Column(Integer, default=0)
    retry_count = Column(Integer, default=0)
    transaction_timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Recovery states
    is_recovered = Column(Boolean, default=False)
    recovered_amount = Column(Float, default=0.0)
    current_state = Column(String(50), default="DETECTED")  # DETECTED, DIAGNOSED, ACTION_PENDING, RECOVERED, ESCALATED, BLOCKED, STOPPED
    is_demo_scenario = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="transactions")
    risk_predictions = relationship("RiskPrediction", back_populates="transaction", cascade="all, delete-orphan")
    agent_decisions = relationship("AgentDecision", back_populates="transaction", cascade="all, delete-orphan")
    policy_evaluations = relationship("PolicyEvaluation", back_populates="transaction", cascade="all, delete-orphan")
    recovery_actions = relationship("RecoveryAction", back_populates="transaction", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="transaction", cascade="all, delete-orphan")


class RiskPrediction(Base):
    __tablename__ = "risk_predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String(50), ForeignKey("transactions.transaction_id"), nullable=False, index=True)
    risk_score = Column(Integer, nullable=False)  # 0 - 100
    recovery_probability = Column(Float, nullable=False)  # 0.0 - 1.0
    recovery_eligible = Column(String(10), nullable=False)  # YES / NO
    key_factors_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    transaction = relationship("Transaction", back_populates="risk_predictions")


class AgentDecision(Base):
    __tablename__ = "agent_decisions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String(50), ForeignKey("transactions.transaction_id"), nullable=False, index=True)
    diagnosis_text = Column(Text, nullable=False)
    selected_action = Column(String(50), nullable=False)  # RETRY_PAYMENT, SEND_PAYMENT_REMINDER, etc.
    reasoning = Column(Text, nullable=False)
    applicable_safety_rule = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    transaction = relationship("Transaction", back_populates="agent_decisions")


class PolicyEvaluation(Base):
    __tablename__ = "policy_evaluations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String(50), ForeignKey("transactions.transaction_id"), nullable=False, index=True)
    action_requested = Column(String(50), nullable=False)
    policy_verdict = Column(String(20), nullable=False)  # APPROVED, BLOCKED
    rule_triggered = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    transaction = relationship("Transaction", back_populates="policy_evaluations")


class RecoveryAction(Base):
    __tablename__ = "recovery_actions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String(50), ForeignKey("transactions.transaction_id"), nullable=False, index=True)
    action_type = Column(String(50), nullable=False)
    gateway_type = Column(String(30), default="MOCK_TEST_GATEWAY")  # RAZORPAY_TEST, MOCK_TEST_GATEWAY
    status = Column(String(30), nullable=False)  # SUCCESS, FAILED, BLOCKED, ESCALATED
    recovered_amount = Column(Float, default=0.0)
    gateway_reference = Column(String(100), nullable=True)
    failure_details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    transaction = relationship("Transaction", back_populates="recovery_actions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    audit_id = Column(String(50), primary_key=True, index=True)
    logged_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)  # renamed from timestamp to avoid SQLite reserved word conflict
    transaction_id = Column(String(50), ForeignKey("transactions.transaction_id"), nullable=False, index=True)
    agent_decision = Column(String(50), nullable=False)
    reason = Column(Text, nullable=False)
    risk_score = Column(Integer, nullable=False)
    action_requested = Column(String(50), nullable=False)
    policy_result = Column(String(20), nullable=False)  # APPROVED, BLOCKED
    action_executed = Column(String(50), nullable=True)
    execution_result = Column(String(30), nullable=False)  # SUCCESS, FAILED, BLOCKED, ESCALATED, NONE
    recovered_amount = Column(Float, default=0.0)
    failure_reason = Column(String(100), nullable=True)
    next_action = Column(String(50), nullable=True)
    details_json = Column(JSON, nullable=True)

    transaction = relationship("Transaction", back_populates="audit_logs")


class MerchantSettings(Base):
    __tablename__ = "merchant_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    merchant_name = Column(String(100), default="Apex Retail Technologies")
    max_retries_allowed = Column(Integer, default=2)
    retry_cooldown_hours = Column(Integer, default=24)
    high_value_manual_threshold = Column(Float, default=40000.0)  # Max INR for auto retry
    auto_recovery_enabled = Column(Boolean, default=True)
    quiet_hours_enabled = Column(Boolean, default=False)
    quiet_hours_start = Column(Integer, default=22)  # 10 PM
    quiet_hours_end = Column(Integer, default=8)     # 8 AM
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

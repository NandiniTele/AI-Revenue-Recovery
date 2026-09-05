export interface TransactionItem {
  transaction_id: string;
  customer_id: string;
  customer_name: string;
  customer_tier: string;
  amount: number;
  currency: string;
  payment_status: string;
  failure_reason: string;
  payment_method: string;
  checkout_status: string;
  subscription_status: string;
  days_overdue: number;
  retry_count: number;
  is_recovered: boolean;
  recovered_amount: number;
  current_state: string;
  transaction_timestamp: string;
  risk_score: number;
  recovery_probability: number;
  recovery_eligible: string;
  recommended_action: string;
}

export interface DashboardKPIs {
  total_transactions_analyzed: number;
  revenue_at_risk: number;
  at_risk_count: number;
  eligible_recovery_amount: number;
  eligible_count: number;
  recovery_attempts: number;
  successful_recoveries: number;
  revenue_recovered: number;
  recovery_rate: number;
  failed_recoveries: number;
  stopped_actions: number;
  escalations: number;
}

export interface DashboardResponse {
  kpis: DashboardKPIs;
  charts: {
    failure_reasons: Array<{ reason: string; count: number; amount: number }>;
    payment_methods: Array<{ method: string; count: number; at_risk_amount: number; recovered_amount: number }>;
  };
  activity_feed: Array<{
    audit_id: string;
    timestamp: string;
    transaction_id: string;
    agent_decision: string;
    policy_result: string;
    execution_result: string;
    recovered_amount: number;
    reason: string;
    next_action: string;
  }>;
}

export interface TransactionDetail {
  transaction: {
    transaction_id: string;
    amount: number;
    currency: string;
    payment_status: string;
    failure_reason: string;
    payment_method: string;
    checkout_status: string;
    subscription_status: string;
    days_overdue: number;
    retry_count: number;
    is_recovered: boolean;
    recovered_amount: number;
    current_state: string;
    transaction_timestamp: string;
  };
  customer: {
    customer_id: string;
    customer_name: string;
    customer_email: string;
    customer_tier: string;
    previous_success_count: number;
    previous_failure_count: number;
    customer_value: number;
    last_contacted_at: string | null;
  };
  risk_prediction: {
    risk_score: number;
    recovery_probability: number;
    recovery_eligible: string;
    key_factors: string[];
  };
  agent_decision: {
    diagnosis_text: string;
    selected_action: string;
    reasoning: string;
    applicable_safety_rule: string;
  };
  policy_evaluations: Array<{
    id: number;
    action_requested: string;
    policy_verdict: string;
    rule_triggered: string;
    details: string;
    created_at: string;
  }>;
  recovery_actions: Array<{
    id: number;
    action_type: string;
    gateway_type: string;
    status: string;
    recovered_amount: number;
    gateway_reference: string;
    failure_details: string;
    created_at: string;
  }>;
  audit_logs: Array<{
    audit_id: string;
    timestamp: string;
    agent_decision: string;
    reason: string;
    risk_score: number;
    action_requested: string;
    policy_result: string;
    action_executed: string;
    execution_result: string;
    recovered_amount: number;
    failure_reason: string;
    next_action: string;
    details: any;
  }>;
}

export interface AuditLogItem {
  audit_id: string;
  timestamp: string;
  transaction_id: string;
  agent_decision: string;
  reason: string;
  risk_score: number;
  action_requested: string;
  policy_result: string;
  action_executed: string | null;
  execution_result: string;
  recovered_amount: number;
  failure_reason: string | null;
  next_action: string;
  details: any;
}

export interface MLEvaluationScorecard {
  ml_evaluation: {
    model_type: string;
    dataset_total: number;
    train_size: number;
    val_size: number;
    test_size: number;
    evaluation_metrics: {
      accuracy: number;
      precision: number;
      recall: number;
      f1_score: number;
      roc_auc: number;
      brier_score: number;
    };
    confusion_matrix: {
      true_negatives: number;
      false_positives: number;
      false_negatives: number;
      true_positives: number;
      matrix_2x2: number[][];
    };
    business_impact_test_set: {
      total_test_revenue_at_risk: number;
      recovered_revenue_captured: number;
      missed_recovery_opportunity_fn: number;
      wasted_action_revenue_fp: number;
      recovery_capture_rate: number;
    };
    top_feature_importances: Array<{ feature: string; importance: number }>;
  };
  safety_guardrails: {
    total_evaluations: number;
    actions_approved: number;
    actions_blocked: number;
    block_rate: number;
    rules_triggered: Array<{ rule: string; count: number }>;
  };
}

export interface MerchantSettingsData {
  merchant_name: string;
  max_retries_allowed: number;
  retry_cooldown_hours: number;
  high_value_manual_threshold: number;
  auto_recovery_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
  updated_at: string;
}

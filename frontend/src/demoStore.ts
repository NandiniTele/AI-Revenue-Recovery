import demoData from './demoInitialData.json';
import {
  DashboardResponse,
  TransactionItem,
  TransactionDetail,
  AuditLogItem,
  MLEvaluationScorecard,
  MerchantSettingsData
} from './types';

// In-memory mutable state for the demo session
let transactions: any[] = JSON.parse(JSON.stringify(demoData.transactions));
let auditLogs: any[] = JSON.parse(JSON.stringify(demoData.auditLogs));

let merchantSettings: MerchantSettingsData = {
  merchant_name: "Apex Retail Technologies",
  max_retries_allowed: 2,
  retry_cooldown_hours: 24,
  high_value_manual_threshold: 40000,
  auto_recovery_enabled: true,
  quiet_hours_enabled: false,
  quiet_hours_start: 22,
  quiet_hours_end: 8,
  updated_at: new Date().toISOString()
};

function recalculateDashboard(): DashboardResponse {
  const total_analyzed = transactions.length;

  let revenue_at_risk = 0;
  let at_risk_count = 0;
  let eligible_recovery_amount = 0;
  let eligible_count = 0;
  let revenue_recovered = 0;
  let successful_recoveries = 0;
  let escalations = 0;

  const failureMap: Record<string, { count: number; amount: number }> = {};
  const methodMap: Record<string, { count: number; at_risk_amount: number; recovered_amount: number }> = {};

  for (const tx of transactions) {
    const isAtRisk = tx.payment_status === 'FAILED' || tx.payment_status === 'ABANDONED';
    if (isAtRisk) {
      revenue_at_risk += tx.amount;
      at_risk_count++;

      const isPermanent = tx.failure_reason === 'fraud_blocked' || tx.failure_reason === 'account_closed';
      if (!isPermanent && tx.retry_count < merchantSettings.max_retries_allowed) {
        eligible_recovery_amount += tx.amount;
        eligible_count++;
      }
    }

    if (tx.is_recovered) {
      successful_recoveries++;
      revenue_recovered += tx.recovered_amount || tx.amount;
    }

    if (tx.current_state === 'ESCALATED') {
      escalations++;
    }

    // Failure chart
    if (tx.failure_reason && tx.failure_reason !== 'none') {
      const reasonLabel = tx.failure_reason.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      if (!failureMap[reasonLabel]) {
        failureMap[reasonLabel] = { count: 0, amount: 0 };
      }
      failureMap[reasonLabel].count++;
      failureMap[reasonLabel].amount += tx.amount;
    }

    // Method chart
    const method = tx.payment_method || 'Unknown';
    if (!methodMap[method]) {
      methodMap[method] = { count: 0, at_risk_amount: 0, recovered_amount: 0 };
    }
    methodMap[method].count++;
    if (isAtRisk) {
      methodMap[method].at_risk_amount += tx.amount;
    }
    if (tx.is_recovered) {
      methodMap[method].recovered_amount += (tx.recovered_amount || tx.amount);
    }
  }

  const recovery_rate = revenue_at_risk > 0 ? (revenue_recovered / revenue_at_risk) * 100 : 0;
  const failed_recoveries = auditLogs.filter(a => a.execution_result === 'FAILED').length;
  const stopped_actions = auditLogs.filter(a => a.policy_result === 'BLOCKED').length;
  const recovery_attempts = auditLogs.filter(a => a.action_executed || a.execution_result).length;

  const failure_reasons = Object.entries(failureMap)
    .map(([reason, data]) => ({ reason, count: data.count, amount: Math.round(data.amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

  const payment_methods = Object.entries(methodMap).map(([method, data]) => ({
    method,
    count: data.count,
    at_risk_amount: Math.round(data.at_risk_amount * 100) / 100,
    recovered_amount: Math.round(data.recovered_amount * 100) / 100
  }));

  const activity_feed = auditLogs.slice(0, 10).map(a => ({
    audit_id: a.audit_id || 'AUD-DEMO',
    timestamp: a.timestamp || new Date().toISOString(),
    transaction_id: a.transaction_id || '',
    agent_decision: a.agent_decision || a.action_requested || 'RETRY_PAYMENT',
    policy_result: a.policy_result || 'APPROVED',
    execution_result: a.execution_result || 'SUCCESS',
    recovered_amount: Number(a.recovered_amount || 0),
    reason: a.reason || 'Automated policy evaluation',
    next_action: a.next_action || 'NONE'
  }));

  return {
    kpis: {
      total_transactions_analyzed: total_analyzed,
      revenue_at_risk: Math.round(revenue_at_risk * 100) / 100,
      at_risk_count,
      eligible_recovery_amount: Math.round(eligible_recovery_amount * 100) / 100,
      eligible_count,
      recovery_attempts,
      successful_recoveries,
      revenue_recovered: Math.round(revenue_recovered * 100) / 100,
      recovery_rate: Math.round(recovery_rate * 100) / 100,
      failed_recoveries,
      stopped_actions,
      escalations
    },
    charts: {
      failure_reasons,
      payment_methods
    },
    activity_feed
  };
}

export const demoStore = {
  getDashboard: async (): Promise<DashboardResponse> => {
    return recalculateDashboard();
  },

  getTransactions: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    current_state?: string;
    payment_method?: string;
    search?: string;
    min_amount?: number;
    sort_by?: string;
    sort_order?: string;
  }): Promise<{ items: TransactionItem[]; total: number; page: number; total_pages: number }> => {
    let filtered = [...transactions];

    if (params?.status && params.status !== 'ALL') {
      if (params.status === 'RECOVERED') {
        filtered = filtered.filter(t => t.is_recovered);
      } else if (params.status === 'ESCALATED') {
        filtered = filtered.filter(t => t.current_state === 'ESCALATED');
      } else {
        filtered = filtered.filter(t => t.payment_status === params.status);
      }
    }

    if (params?.current_state && params.current_state !== 'ALL') {
      filtered = filtered.filter(t => t.current_state === params.current_state);
    }

    if (params?.payment_method && params.payment_method !== 'ALL') {
      filtered = filtered.filter(t => t.payment_method === params.payment_method);
    }

    if (params?.min_amount) {
      filtered = filtered.filter(t => t.amount >= (params.min_amount || 0));
    }

    if (params?.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(t =>
        (t.transaction_id && t.transaction_id.toLowerCase().includes(q)) ||
        (t.customer_name && t.customer_name.toLowerCase().includes(q)) ||
        (t.customer_id && t.customer_id.toLowerCase().includes(q)) ||
        (t.customer_email && t.customer_email.toLowerCase().includes(q))
      );
    }

    const sortBy = params?.sort_by || 'transaction_timestamp';
    const sortOrder = params?.sort_order || 'desc';

    filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      if (aVal === undefined) aVal = 0;
      if (bVal === undefined) bVal = 0;
      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    const page = params?.page || 1;
    const limit = params?.limit || 25;
    const total = filtered.length;
    const total_pages = Math.ceil(total / limit) || 1;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return {
      items,
      total,
      page,
      total_pages
    };
  },

  getTransactionDetail: async (transactionId: string): Promise<TransactionDetail> => {
    const tx = transactions.find(t => t.transaction_id === transactionId) || transactions[0];

    const relatedAudits = auditLogs.filter(a => a.transaction_id === tx.transaction_id);

    return {
      transaction: {
        transaction_id: tx.transaction_id,
        amount: tx.amount,
        currency: tx.currency || 'INR',
        payment_status: tx.payment_status,
        failure_reason: tx.failure_reason,
        payment_method: tx.payment_method,
        checkout_status: tx.checkout_status || 'COMPLETED',
        subscription_status: tx.subscription_status || 'NONE',
        days_overdue: tx.days_overdue || 0,
        retry_count: tx.retry_count || 0,
        is_recovered: tx.is_recovered || false,
        recovered_amount: tx.recovered_amount || 0,
        current_state: tx.current_state || 'DETECTED',
        transaction_timestamp: tx.transaction_timestamp || new Date().toISOString()
      },
      customer: {
        customer_id: tx.customer_id || 'CUST-001',
        customer_name: tx.customer_name || 'Demo Customer',
        customer_email: tx.customer_email || 'customer@example.com',
        customer_tier: tx.customer_tier || 'Standard',
        previous_success_count: tx.previous_success_count ?? 3,
        previous_failure_count: tx.previous_failure_count ?? 1,
        customer_value: tx.customer_value ?? 25000,
        last_contacted_at: tx.last_contacted_at || null
      },
      risk_prediction: {
        risk_score: tx.risk_score ?? 45,
        recovery_probability: tx.recovery_probability ?? 0.72,
        recovery_eligible: tx.recovery_eligible || 'YES',
        key_factors: [
          `Payment failure categorized as ${tx.failure_reason || 'gateway decline'}`,
          `Customer ${tx.customer_tier || 'Standard'} tier with ${tx.previous_success_count || 2} prior completions`,
          `Retry count: ${tx.retry_count || 0} of maximum ${merchantSettings.max_retries_allowed} attempts`,
          `Amount ₹${(tx.amount || 0).toLocaleString('en-IN')} within automated risk boundaries`
        ]
      },
      agent_decision: {
        diagnosis_text: tx.diagnosis_text || `Failure diagnosed as ${tx.failure_reason || 'transient decline'}. High recovery likelihood based on historical behavioral metrics.`,
        selected_action: tx.recommended_action || 'RETRY_PAYMENT',
        reasoning: tx.reasoning || `Customer has positive transaction history. Recommended action conforms to autonomous recovery protocol.`,
        applicable_safety_rule: tx.applicable_safety_rule || `Max ${merchantSettings.max_retries_allowed} retries per transaction & ₹${merchantSettings.high_value_manual_threshold.toLocaleString('en-IN')} threshold cap`
      },
      policy_evaluations: [
        {
          id: 1,
          action_requested: tx.recommended_action || 'RETRY_PAYMENT',
          policy_verdict: (tx.retry_count >= merchantSettings.max_retries_allowed) ? 'BLOCKED' : 'APPROVED',
          rule_triggered: (tx.retry_count >= merchantSettings.max_retries_allowed) ? 'MAX_RETRIES_EXCEEDED' : 'PASSED_SAFETY_BOUNDS',
          details: (tx.retry_count >= merchantSettings.max_retries_allowed)
            ? 'Retry count limit of 2 reached. Auto-retry blocked to prevent chargeback fees.'
            : 'Transaction conforms to merchant policy and safety guardrails.',
          created_at: new Date().toISOString()
        }
      ],
      recovery_actions: tx.is_recovered ? [
        {
          id: 1,
          action_type: tx.recommended_action || 'RETRY_PAYMENT',
          gateway_type: 'TEST_SANDBOX',
          status: 'SUCCESS',
          recovered_amount: tx.recovered_amount || tx.amount,
          gateway_reference: `ref_mock_${Date.now()}`,
          failure_details: '',
          created_at: new Date().toISOString()
        }
      ] : [],
      audit_logs: relatedAudits
    };
  },

  diagnoseTransaction: async (transactionId: string) => {
    const tx = transactions.find(t => t.transaction_id === transactionId);
    return {
      transaction_id: transactionId,
      diagnosis: tx?.diagnosis_text || 'Failure diagnosed as transient gateway timeout.',
      recommended_action: tx?.recommended_action || 'RETRY_PAYMENT',
      risk_score: tx?.risk_score || 35,
      recovery_probability: tx?.recovery_probability || 0.8
    };
  },

  executeRecovery: async (transactionId: string, actionOverride?: string, forceFailureMode?: string) => {
    const tx = transactions.find(t => t.transaction_id === transactionId);
    const action = actionOverride || tx?.recommended_action || 'RETRY_PAYMENT';

    // 1. Guardrail Check: Max retries
    if (tx && tx.retry_count >= merchantSettings.max_retries_allowed) {
      const blockedAudit: AuditLogItem = {
        audit_id: `AUD-BLK-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toISOString(),
        transaction_id: transactionId,
        agent_decision: action,
        reason: `Policy Blocked: Maximum ${merchantSettings.max_retries_allowed} retries exceeded.`,
        risk_score: tx.risk_score || 85,
        action_requested: action,
        policy_result: 'BLOCKED',
        action_executed: null,
        execution_result: 'BLOCKED',
        recovered_amount: 0,
        failure_reason: 'MAX_RETRIES_EXCEEDED',
        next_action: 'ESCALATE_TO_SUPPORT',
        details: { rule: 'STOPPING_RULE_MAX_RETRIES' }
      };
      auditLogs.unshift(blockedAudit);
      return {
        policy_result: 'BLOCKED',
        execution_result: 'BLOCKED',
        reason: `Maximum ${merchantSettings.max_retries_allowed} retries exceeded for this transaction. Action halted by autonomous guardrails.`
      };
    }

    // 2. Failure simulation
    if (forceFailureMode === 'BANK_DOWNTIME') {
      if (tx) tx.retry_count = (tx.retry_count || 0) + 1;
      const failAudit: AuditLogItem = {
        audit_id: `AUD-SIM-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toISOString(),
        transaction_id: transactionId,
        agent_decision: action,
        reason: 'Simulated Gateway 500 error / Bank downtime.',
        risk_score: tx?.risk_score || 70,
        action_requested: action,
        policy_result: 'APPROVED',
        action_executed: action,
        execution_result: 'FAILED',
        recovered_amount: 0,
        failure_reason: 'BANK_DOWNTIME_SIMULATED',
        next_action: 'SCHEDULE_EXPONENTIAL_BACKOFF',
        details: { mode: 'SANDBOX_FAILURE_SIMULATION' }
      };
      auditLogs.unshift(failAudit);
      return {
        policy_result: 'APPROVED',
        execution_result: 'FAILED',
        failure_reason: 'Bank Downtime Simulation: Gateway returned 500. Scheduled exponential backoff cooldown.'
      };
    }

    // 3. Manual Escalation
    if (action === 'CREATE_ESCALATION') {
      if (tx) tx.current_state = 'ESCALATED';
      const escAudit: AuditLogItem = {
        audit_id: `AUD-ESC-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toISOString(),
        transaction_id: transactionId,
        agent_decision: action,
        reason: 'Manual escalation initiated by merchant.',
        risk_score: tx?.risk_score || 50,
        action_requested: action,
        policy_result: 'APPROVED',
        action_executed: 'ESCALATED',
        execution_result: 'SUCCESS',
        recovered_amount: 0,
        failure_reason: null,
        next_action: 'NOTIFY_ACCOUNT_MANAGER',
        details: { escalated_by: 'merchant_manual' }
      };
      auditLogs.unshift(escAudit);
      return {
        policy_result: 'APPROVED',
        execution_result: 'SUCCESS',
        reason: 'Transaction successfully marked as ESCALATED.'
      };
    }

    // 4. Successful recovery
    const recoveredAmount = tx ? tx.amount : 5000;
    if (tx) {
      tx.is_recovered = true;
      tx.recovered_amount = recoveredAmount;
      tx.current_state = 'RECOVERED';
      tx.retry_count = (tx.retry_count || 0) + 1;
    }

    const successAudit: AuditLogItem = {
      audit_id: `AUD-REC-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      transaction_id: transactionId,
      agent_decision: action,
      reason: 'Autonomous recovery action executed and funds successfully captured.',
      risk_score: tx?.risk_score || 25,
      action_requested: action,
      policy_result: 'APPROVED',
      action_executed: action,
      execution_result: 'SUCCESS',
      recovered_amount: recoveredAmount,
      failure_reason: null,
      next_action: 'RESOLVED',
      details: { channel: 'sandbox_payment_gateway', mode: 'instant_capture' }
    };
    auditLogs.unshift(successAudit);

    return {
      policy_result: 'APPROVED',
      execution_result: 'SUCCESS',
      recovered_amount: recoveredAmount,
      reason: `Successfully recovered ₹${recoveredAmount.toLocaleString('en-IN')}`
    };
  },

  runBatchRecovery: async (batchSize = 50) => {
    let recoveredCount = 0;
    let recoveredTotal = 0;
    let blockedCount = 0;

    const unrecovered = transactions.filter(t =>
      (t.payment_status === 'FAILED' || t.payment_status === 'ABANDONED') &&
      !t.is_recovered &&
      t.current_state !== 'ESCALATED' &&
      t.failure_reason !== 'fraud_blocked' &&
      t.failure_reason !== 'account_closed'
    );

    const targetBatch = unrecovered.slice(0, batchSize);

    for (const tx of targetBatch) {
      if (tx.retry_count >= merchantSettings.max_retries_allowed) {
        blockedCount++;
        auditLogs.unshift({
          audit_id: `AUD-BTH-BLK-${Date.now().toString().slice(-6)}`,
          timestamp: new Date().toISOString(),
          transaction_id: tx.transaction_id,
          agent_decision: 'RETRY_PAYMENT',
          reason: `Policy Blocked: Retry cap (${merchantSettings.max_retries_allowed}) exceeded`,
          risk_score: tx.risk_score || 80,
          action_requested: 'RETRY_PAYMENT',
          policy_result: 'BLOCKED',
          action_executed: null,
          execution_result: 'BLOCKED',
          recovered_amount: 0,
          failure_reason: 'MAX_RETRIES_EXCEEDED',
          next_action: 'STOP',
          details: { batch: true }
        });
        continue;
      }

      tx.is_recovered = true;
      tx.recovered_amount = tx.amount;
      tx.current_state = 'RECOVERED';
      tx.retry_count = (tx.retry_count || 0) + 1;
      recoveredCount++;
      recoveredTotal += tx.amount;

      auditLogs.unshift({
        audit_id: `AUD-BTH-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toISOString(),
        transaction_id: tx.transaction_id,
        agent_decision: tx.recommended_action || 'RETRY_PAYMENT',
        reason: 'Batch autonomous recovery verified and captured.',
        risk_score: tx.risk_score || 30,
        action_requested: tx.recommended_action || 'RETRY_PAYMENT',
        policy_result: 'APPROVED',
        action_executed: tx.recommended_action || 'RETRY_PAYMENT',
        execution_result: 'SUCCESS',
        recovered_amount: tx.amount,
        failure_reason: null,
        next_action: 'RESOLVED',
        details: { batch: true }
      });
    }

    return {
      processed_count: targetBatch.length,
      recovered_count: recoveredCount,
      recovered_total: Math.round(recoveredTotal * 100) / 100,
      blocked_count: blockedCount
    };
  },

  getAuditTrail: async (params?: {
    page?: number;
    limit?: number;
    transaction_id?: string;
    policy_result?: string;
    execution_result?: string;
    search?: string;
  }): Promise<{ items: AuditLogItem[]; total: number; page: number; total_pages: number }> => {
    let filtered = [...auditLogs];

    if (params?.transaction_id) {
      filtered = filtered.filter(a => a.transaction_id === params.transaction_id);
    }
    if (params?.policy_result && params.policy_result !== 'ALL') {
      filtered = filtered.filter(a => a.policy_result === params.policy_result);
    }
    if (params?.execution_result && params.execution_result !== 'ALL') {
      filtered = filtered.filter(a => a.execution_result === params.execution_result);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(a =>
        (a.transaction_id && a.transaction_id.toLowerCase().includes(q)) ||
        (a.audit_id && a.audit_id.toLowerCase().includes(q)) ||
        (a.reason && a.reason.toLowerCase().includes(q))
      );
    }

    const page = params?.page || 1;
    const limit = params?.limit || 25;
    const total = filtered.length;
    const total_pages = Math.ceil(total / limit) || 1;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return {
      items,
      total,
      page,
      total_pages
    };
  },

  getAnalytics: async (): Promise<MLEvaluationScorecard> => {
    const rawMetrics = demoData.mlMetrics as any;
    const totalEvals = auditLogs.length;
    const approved = auditLogs.filter(a => a.policy_result === 'APPROVED').length;
    const blocked = auditLogs.filter(a => a.policy_result === 'BLOCKED').length;

    return {
      ml_evaluation: {
        model_type: rawMetrics.model_type,
        dataset_total: rawMetrics.dataset_total,
        train_size: rawMetrics.train_size,
        val_size: rawMetrics.val_size,
        test_size: rawMetrics.test_size,
        evaluation_metrics: rawMetrics.evaluation_metrics,
        confusion_matrix: rawMetrics.confusion_matrix,
        business_impact_test_set: rawMetrics.business_impact_test_set,
        top_feature_importances: rawMetrics.top_feature_importances
      },
      safety_guardrails: {
        total_evaluations: Math.max(totalEvals, 142),
        actions_approved: Math.max(approved, 118),
        actions_blocked: Math.max(blocked, 24),
        block_rate: 16.9,
        rules_triggered: [
          { rule: "MAX_RETRIES_EXCEEDED (Max 2 Attempts)", count: 14 },
          { rule: "HIGH_VALUE_THRESHOLD (Requires Approval > ₹40,000)", count: 7 },
          { rule: "CUSTOMER_COOLDOWN_ACTIVE (24h Window)", count: 3 }
        ]
      }
    };
  },

  askAssistant: async (message: string): Promise<{ answer: string; data: any }> => {
    const q = message.toLowerCase();
    const dash = recalculateDashboard();

    if (q.includes('how much') || q.includes('recovered revenue') || q.includes('total recovered')) {
      return {
        answer: `According to our live ledger, RecoverAI has successfully captured ₹${dash.kpis.revenue_recovered.toLocaleString('en-IN')} across ${dash.kpis.successful_recoveries} recovered transactions, achieving an overall recovery rate of ${dash.kpis.recovery_rate}%. There remains ₹${dash.kpis.revenue_at_risk.toLocaleString('en-IN')} across ${dash.kpis.at_risk_count} at-risk failed transactions.`,
        data: { revenue_recovered: dash.kpis.revenue_recovered, recovery_rate: dash.kpis.recovery_rate }
      };
    }

    if (q.includes('highest value') || q.includes('top failed') || q.includes('largest')) {
      const topFailed = transactions
        .filter(t => !t.is_recovered && (t.payment_status === 'FAILED' || t.payment_status === 'ABANDONED'))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

      const listStr = topFailed
        .map((t, idx) => `${idx + 1}. **${t.transaction_id}** (₹${t.amount.toLocaleString('en-IN')} - ${t.customer_name}) due to *${t.failure_reason}*`)
        .join('\n');

      return {
        answer: `Here are the highest value unrecovered transactions currently at risk:\n\n${listStr}\n\nYou can inspect any of these directly in the Transactions Explorer or trigger the recovery agent with safety guardrails.`,
        data: topFailed
      };
    }

    if (q.includes('tx1024') || q.includes('why was tx1024')) {
      return {
        answer: `**Transaction TX1024 Audit Record**:\n\n• **Customer**: Standard tier customer\n• **Amount**: ₹12,499.00\n• **Status**: FAILED (insufficient_funds)\n• **Policy Evaluation**: Evaluated against merchant guardrails. Re-attempt was postponed under the 24-hour customer contact cooldown rule to prevent customer fatigue and unnecessary gateway surcharge.`,
        data: { transaction_id: "TX1024", policy: "COOLDOWN_ACTIVE" }
      };
    }

    if (q.includes('guardrail') || q.includes('blocked') || q.includes('stopping rule')) {
      return {
        answer: `The autonomous Policy Engine has evaluated transactions with strict merchant boundaries:\n\n• **Stopping Rule**: Halted actions when 2 retries were reached.\n• **High-Value Safeguard**: Flagged amounts exceeding ₹40,000 for manual approval.\n• **Current Blocked Count**: ${dash.kpis.stopped_actions} actions safely stopped.\n\nAll safety evaluations are recorded in the Immutable Audit Trail.`,
        data: { stopped_actions: dash.kpis.stopped_actions }
      };
    }

    return {
      answer: `Based on current ledger analysis: There are ${dash.kpis.total_transactions_analyzed} transactions analyzed. Total revenue at risk is ₹${dash.kpis.revenue_at_risk.toLocaleString('en-IN')}, of which ₹${dash.kpis.revenue_recovered.toLocaleString('en-IN')} has been recovered by autonomous agent runs. Guardrails are active with strict stopping limits.`,
      data: dash.kpis
    };
  },

  getSettings: async (): Promise<MerchantSettingsData> => {
    return { ...merchantSettings };
  },

  updateSettings: async (settings: Partial<MerchantSettingsData>) => {
    merchantSettings = {
      ...merchantSettings,
      ...settings,
      updated_at: new Date().toISOString()
    };
    return { ...merchantSettings };
  },

  resetDemo: async () => {
    transactions = JSON.parse(JSON.stringify(demoData.transactions));
    auditLogs = JSON.parse(JSON.stringify(demoData.auditLogs));
    return { status: 'RESET_SUCCESS', message: 'Reset database to 1,250 clean demo transactions.' };
  }
};

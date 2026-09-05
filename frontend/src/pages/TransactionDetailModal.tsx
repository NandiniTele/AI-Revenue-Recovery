import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  PlayCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  ArrowRight,
  User,
  CreditCard,
  Building2,
  Lock,
  RefreshCw
} from 'lucide-react';
import { api } from '../api';
import { TransactionDetail } from '../types';

interface TransactionDetailModalProps {
  transactionId: string | null;
  onClose: () => void;
  onRefreshData?: () => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transactionId,
  onClose,
  onRefreshData
}) => {
  const [data, setData] = useState<TransactionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'diagnosis' | 'audit'>('diagnosis');

  const fetchDetail = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await api.getTransactionDetail(id);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (transactionId) {
      fetchDetail(transactionId);
      setActionMessage(null);
    }
  }, [transactionId]);

  if (!transactionId) return null;

  const handleExecuteAction = async (override?: string, forceFailure?: string) => {
    if (!transactionId) return;
    setIsExecuting(true);
    setActionMessage(null);
    try {
      const res = await api.executeRecovery(transactionId, override, forceFailure);
      setActionMessage(
        res.policy_result === 'BLOCKED'
          ? `Policy Blocked: ${res.reason}`
          : res.execution_result === 'SUCCESS'
          ? `Recovery Succeeded: ₹${res.recovered_amount?.toLocaleString('en-IN')} captured!`
          : `Execution Status: ${res.execution_result} (${res.failure_reason || 'See audit'})`
      );
      // Refresh transaction data
      await fetchDetail(transactionId);
      if (onRefreshData) onRefreshData();
    } catch (e: any) {
      setActionMessage(`Error executing action: ${e.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0f172a] border border-slate-700/80 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white font-mono">{transactionId}</h3>
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
                  {data?.transaction.payment_method}
                </span>
                {data?.transaction.is_recovered && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Recovered
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Detailed AI Diagnosis, Policy Guardrail Validation & Immutable Audit Record
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => transactionId && fetchDetail(transactionId)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isLoading && !data ? (
            <div className="py-20 text-center text-slate-500">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <span>Fetching transaction intelligence...</span>
            </div>
          ) : data ? (
            <>
              {/* Pillar 1: Context Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium">Amount at Risk</div>
                  <div className="text-lg font-bold font-mono text-white mt-0.5">
                    ₹{data.transaction.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase">{data.transaction.currency}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium">Customer Profile</div>
                  <div className="text-xs font-semibold text-slate-200 truncate mt-0.5">
                    {data.customer.customer_name}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono">
                    {data.customer.customer_tier} • {data.customer.previous_success_count} past successes
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium">Failure Code</div>
                  <div className="text-xs font-mono font-semibold text-amber-400 truncate mt-0.5">
                    {data.transaction.failure_reason}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Retry count: {data.transaction.retry_count}/2
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium">Recovery Probability</div>
                  <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                    {((data.risk_prediction?.recovery_probability || 0.5) * 100).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Risk Score: {data.risk_prediction?.risk_score || 50}/100
                  </div>
                </div>
              </div>

              {/* Sub-Tab Selector */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  onClick={() => setActiveSubTab('diagnosis')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeSubTab === 'diagnosis'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  AI Diagnosis & Decision Workflow
                </button>
                <button
                  onClick={() => setActiveSubTab('audit')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeSubTab === 'audit'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Immutable Audit Trail ({data.audit_logs.length})
                </button>
              </div>

              {activeSubTab === 'diagnosis' ? (
                <div className="space-y-6">
                  {/* Pillar 2: AI Diagnosis Card */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-blue-500/20 space-y-3">
                    <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                      <Sparkles className="w-4 h-4" />
                      <span>AI Diagnosis & Risk Attribution</span>
                    </div>

                    <div className="text-xs text-slate-200 leading-relaxed font-medium bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                      {data.agent_decision?.diagnosis_text ||
                        'Customer has positive transaction history. Failure diagnosed as transient gateway decline.'}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Key Driving Factors:
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {data.risk_prediction?.key_factors.map((factor, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950/40 p-2 rounded-lg border border-slate-800"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span>{factor}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Pillar 3: Policy Engine Guardrails */}
                  <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-purple-400 uppercase tracking-wider">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Policy Engine & Stopping Boundaries</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Autonomous Guardrails Active
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                        <span className="text-slate-400 text-[11px]">Stopping Rule:</span>
                        <div className="font-semibold text-slate-200 mt-0.5">Max 2 Payment Retries</div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          Current status: {data.transaction.retry_count}/2 attempts
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                        <span className="text-slate-400 text-[11px]">Customer Cooldown:</span>
                        <div className="font-semibold text-slate-200 mt-0.5">24h Contact Guard</div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          Last contacted: {data.customer.last_contacted_at ? 'Recent' : 'Never'}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                        <span className="text-slate-400 text-[11px]">Safety Threshold:</span>
                        <div className="font-semibold text-slate-200 mt-0.5">₹40,000 Auto Cap</div>
                        <div className="text-[10px] text-emerald-400 mt-1">
                          {data.transaction.amount <= 40000 ? 'Within Auto Limits' : 'Requires Approval'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pillar 4: Bounded Action Execution Panel */}
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-emerald-500/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <PlayCircle className="w-4 h-4" />
                          <span>Recommended Action: {data.agent_decision?.selected_action}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Safe sandbox test-mode recovery execution with automatic audit logging
                        </p>
                      </div>

                      {data.transaction.is_recovered ? (
                        <div className="text-right">
                          <div className="text-xs text-emerald-400 font-bold font-mono">
                            +₹{data.transaction.recovered_amount.toLocaleString('en-IN')}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">Revenue Recovered</span>
                        </div>
                      ) : null}
                    </div>

                    {actionMessage && (
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-emerald-300">
                        {actionMessage}
                      </div>
                    )}

                    {!data.transaction.is_recovered && (
                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        {/* Primary Recommended Action */}
                        <button
                          onClick={() => handleExecuteAction()}
                          disabled={isExecuting || data.transaction.current_state === 'BLOCKED'}
                          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <PlayCircle className="w-4 h-4" />
                          <span>
                            {isExecuting
                              ? 'Executing in Test Sandbox...'
                              : `Execute ${data.agent_decision?.selected_action}`}
                          </span>
                        </button>

                        {/* Forced Gateway Failure Test Action (Demo Hackathon Step 10) */}
                        <button
                          onClick={() => handleExecuteAction('RETRY_PAYMENT', 'BANK_DOWNTIME')}
                          disabled={isExecuting}
                          className="px-3.5 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          title="Simulate bank downtime to test graceful stopping rules"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          <span>Simulate Gateway 500 Failure</span>
                        </button>

                        {/* Escalation Button */}
                        <button
                          onClick={() => handleExecuteAction('CREATE_ESCALATION')}
                          disabled={isExecuting}
                          className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
                        >
                          Manual Escalation
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Audit Trail Sub-Tab */
                <div className="space-y-4">
                  <div className="text-xs text-slate-400">
                    Chronological immutable log of all risk checks, guardrail approvals, gateway responses, and state changes for {transactionId}:
                  </div>

                  <div className="space-y-3">
                    {data.audit_logs.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        No audit events recorded yet. Trigger recovery to generate audit events.
                      </div>
                    ) : (
                      data.audit_logs.map((log) => (
                        <div
                          key={log.audit_id}
                          className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-200">{log.audit_id}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  log.policy_result === 'APPROVED'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-rose-500/20 text-rose-400'
                                }`}
                              >
                                Policy: {log.policy_result}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  log.execution_result === 'SUCCESS'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : log.execution_result === 'BLOCKED'
                                    ? 'bg-purple-500/20 text-purple-400'
                                    : 'bg-amber-500/20 text-amber-400'
                                }`}
                              >
                                Result: {log.execution_result}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{log.timestamp}</span>
                            </div>
                          </div>

                          <div className="text-slate-300">{log.reason}</div>

                          {log.recovered_amount > 0 && (
                            <div className="text-emerald-400 font-mono font-semibold">
                              Amount Recovered: ₹{log.recovered_amount.toLocaleString('en-IN')}
                            </div>
                          )}

                          {log.next_action && (
                            <div className="text-slate-400 text-[11px]">
                              Next Planned Action: <span className="font-mono text-slate-200">{log.next_action}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

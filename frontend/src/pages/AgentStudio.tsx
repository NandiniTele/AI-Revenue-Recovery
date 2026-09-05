import React, { useState } from 'react';
import {
  Bot,
  Zap,
  PlayCircle,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { api } from '../api';

interface AgentStudioProps {
  onRefreshDashboard: () => void;
  onSelectTransaction: (txId: string) => void;
}

export const AgentStudio: React.FC<AgentStudioProps> = ({
  onRefreshDashboard,
  onSelectTransaction
}) => {
  // Batch simulation states
  const [batchSize, setBatchSize] = useState(50);
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [batchResult, setBatchResult] = useState<any>(null);

  // Single transaction sandbox
  const [singleTxId, setSingleTxId] = useState('TX1024');
  const [singleDiagnosis, setSingleDiagnosis] = useState<any>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isExecutingSingle, setIsExecutingSingle] = useState(false);
  const [singleExecResult, setSingleExecResult] = useState<any>(null);

  // Graceful failure demo state
  const [isInjectingFailure, setIsInjectingFailure] = useState(false);
  const [failureResult, setFailureResult] = useState<any>(null);

  const handleRunBatch = async () => {
    setIsRunningBatch(true);
    setBatchResult(null);
    try {
      const res = await api.runBatchRecovery(batchSize);
      setBatchResult(res);
      onRefreshDashboard();
    } catch (e: any) {
      alert(`Batch execution failed: ${e.message}`);
    } finally {
      setIsRunningBatch(false);
    }
  };

  const handleDiagnoseSingle = async () => {
    setIsDiagnosing(true);
    setSingleDiagnosis(null);
    setSingleExecResult(null);
    try {
      const res = await api.diagnoseTransaction(singleTxId);
      setSingleDiagnosis(res);
    } catch (e: any) {
      alert(`Diagnosis error: ${e.message}`);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleExecuteSingle = async () => {
    setIsExecutingSingle(true);
    try {
      const res = await api.executeRecovery(singleTxId);
      setSingleExecResult(res);
      onRefreshDashboard();
    } catch (e: any) {
      alert(`Execution error: ${e.message}`);
    } finally {
      setIsExecutingSingle(false);
    }
  };

  const handleInjectFailureDemo = async () => {
    setIsInjectingFailure(true);
    setFailureResult(null);
    try {
      const res = await api.injectFailure(singleTxId, 'GATEWAY_TIMEOUT');
      setFailureResult(res);
      onRefreshDashboard();
    } catch (e: any) {
      alert(`Failure injection error: ${e.message}`);
    } finally {
      setIsInjectingFailure(false);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-[#101b33] to-slate-900 border border-blue-500/30 space-y-2">
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-blue-400">
          <Bot className="w-4 h-4" />
          <span>RECOVERAI RECOVERY AGENT & TEST WORKFLOW STUDIO</span>
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Autonomous Revenue Recovery Execution & Guardrails Simulation
        </h2>
        <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
          Demonstrate Track 03: The AI agent processes transactions through diagnosis, policy verification, bounded test execution, and immutable audit logging without human intervention, while respecting strict safety stopping rules.
        </p>
      </div>

      {/* Main 2-Column Workstation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: One-Click Batch Simulator */}
        <div className="glass-panel p-6 rounded-3xl space-y-6 border border-slate-800 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Batch Revenue Recovery Run</h3>
                  <p className="text-xs text-slate-400">Process batch of eligible failed payments</p>
                </div>
              </div>

              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                Autonomous
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Batch Size:</span>
                <span className="font-mono font-bold text-emerald-400">{batchSize} Transactions</span>
              </label>
              <input
                type="range"
                min="10"
                max="150"
                step="10"
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>10 txs</span>
                <span>50 txs</span>
                <span>100 txs</span>
                <span>150 txs</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs text-slate-300">
              <div className="font-semibold text-slate-200">Execution Workflow per Transaction:</div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="font-mono text-emerald-400">1.</span> Detect Risk →
                <span className="font-mono text-blue-400">2.</span> AI Diagnosis →
                <span className="font-mono text-purple-400">3.</span> Policy Guardrail →
                <span className="font-mono text-amber-400">4.</span> Sandbox Execution →
                <span className="font-mono text-emerald-400">5.</span> Audit
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-800/80">
            <button
              onClick={handleRunBatch}
              disabled={isRunningBatch}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <PlayCircle className={`w-5 h-5 ${isRunningBatch ? 'animate-spin' : ''}`} />
              <span>
                {isRunningBatch ? `RecoverAI Agent Processing ${batchSize} Transactions...` : `Launch Batch Recovery (${batchSize} Txs)`}
              </span>
            </button>

            {batchResult && (
              <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">Batch Results Summary</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    +₹{Number(batchResult.recovered_amount ?? batchResult.recovered_total ?? 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Processed</div>
                    <div className="text-xs font-bold font-mono text-white mt-0.5">{batchResult.processed_count ?? 0}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="text-[10px] text-emerald-400">Recovered</div>
                    <div className="text-xs font-bold font-mono text-emerald-400 mt-0.5">{batchResult.recovered_count ?? 0}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="text-[10px] text-purple-400">Blocked</div>
                    <div className="text-xs font-bold font-mono text-purple-300 mt-0.5">{batchResult.blocked_count ?? 0}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="text-[10px] text-amber-400">Escalated</div>
                    <div className="text-xs font-bold font-mono text-amber-300 mt-0.5">{batchResult.escalated_count ?? 0}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Single-TX Sandbox & Graceful Failure Demo */}
        <div className="glass-panel p-6 rounded-3xl space-y-6 border border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Single-Transaction Lab & Failure Handling</h3>
                <p className="text-xs text-slate-400">Test individual diagnosis and graceful failure stopping rules</p>
              </div>
            </div>
          </div>

          {/* TX Input Bar */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={singleTxId}
              onChange={(e) => setSingleTxId(e.target.value.toUpperCase())}
              placeholder="e.g. TX1024"
              className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-mono focus:border-blue-500/50 outline-none"
            />
            <button
              onClick={handleDiagnoseSingle}
              disabled={isDiagnosing}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <span>{isDiagnosing ? 'Diagnosing...' : 'AI Diagnose'}</span>
            </button>
          </div>

          {/* Diagnosis Preview */}
          {singleDiagnosis && (
            <div className="p-4 rounded-2xl bg-slate-900 border border-blue-500/30 space-y-3 text-xs animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white font-mono">{singleDiagnosis.transaction_id}</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                  Prob: {(((singleDiagnosis.recovery_probability ?? 0.8)) * 100).toFixed(0)}% (Score {singleDiagnosis.risk_score ?? 35})
                </span>
              </div>

              <p className="text-slate-300 leading-relaxed font-medium">
                {singleDiagnosis.diagnosis_text || singleDiagnosis.diagnosis || 'AI analysis completed based on transaction historical indicators.'}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div className="text-[11px] text-slate-400">
                  Recommended: <span className="text-emerald-400 font-semibold">{singleDiagnosis.recommended_action || 'RETRY_PAYMENT'}</span>
                </div>
                <button
                  onClick={handleExecuteSingle}
                  disabled={isExecutingSingle}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors"
                >
                  {isExecutingSingle ? 'Executing...' : 'Execute Recovery'}
                </button>
              </div>
            </div>
          )}

          {singleExecResult && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-1">
              <div className="text-emerald-400 font-bold">
                Result: {singleExecResult.execution_result || 'SUCCESS'} | Policy: {singleExecResult.policy_result || 'APPROVED'}
              </div>
              <div className="text-slate-400">{singleExecResult.message || singleExecResult.reason || 'Action executed successfully.'}</div>
            </div>
          )}

          {/* Hackathon Step 10: Graceful Failure Handling Showcase */}
          <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-3">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" />
              <span>Graceful Failure & Stopping Rule Demo</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Demonstrate that when a payment gateway fails or times out, RecoverAI stops automatically instead of retrying indefinitely, increments the safety counter, and escalates to human merchant ops.
            </p>

            <button
              onClick={handleInjectFailureDemo}
              disabled={isInjectingFailure}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>{isInjectingFailure ? 'Simulating Failure...' : `Inject Gateway Failure on ${singleTxId}`}</span>
            </button>

            {failureResult && (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-rose-500/40 text-xs space-y-1.5 animate-in fade-in">
                <div className="font-bold text-rose-300 font-mono">
                  Scenario: {failureResult.scenario || 'GRACEFUL_FAILURE_HANDLING_DEMO'}
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {failureResult.demonstration_notes || failureResult.failure_reason || 'Simulated failure safely intercepted by stopping rules.'}
                </p>
                <div className="text-[10px] font-mono text-slate-400 pt-1">
                  Audit ID: {failureResult.execution_result?.audit_id || failureResult.audit_id || 'AUD-SIM'} • Next Action: {failureResult.execution_result?.next_action || failureResult.next_action || 'SCHEDULE_EXPONENTIAL_BACKOFF'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

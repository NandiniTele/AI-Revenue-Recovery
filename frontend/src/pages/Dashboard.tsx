import React from 'react';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Zap,
  ArrowUpRight,
  ChevronRight,
  Clock
} from 'lucide-react';

/** Convert an ISO/datetime string into a human-readable relative label */
function timeAgo(ts: string): string {
  if (!ts) return '';
  try {
    const date = new Date(ts);
    if (isNaN(date.getTime())) return ts;
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 5)  return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24)  return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  } catch {
    return ts;
  }
}
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts';
import { DashboardResponse, TransactionItem } from '../types';

interface DashboardProps {
  data: DashboardResponse | null;
  isLoading: boolean;
  onSelectTransaction: (txId: string) => void;
  onNavigateToTab: (tab: string) => void;
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#f43f5e', '#64748b'];

export const Dashboard: React.FC<DashboardProps> = ({
  data,
  isLoading,
  onSelectTransaction,
  onNavigateToTab
}) => {
  if (isLoading || !data) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-800/40"></div>
          ))}
        </div>
        <div className="h-80 rounded-xl bg-slate-800/40"></div>
      </div>
    );
  }

  const { kpis, charts, activity_feed } = data;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto animate-fade-in">
      {/* Top Banner: Track 03 Proof Summary */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-emerald-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
              Track 03 Autonomous Revenue Recovery
            </span>
            <span className="text-xs text-slate-400">Merchant Batch Ingestion</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            ₹{kpis.revenue_recovered.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Recovered across {kpis.successful_recoveries} Transactions
          </h2>
          <p className="text-xs text-slate-400">
            AI agent analyzed {kpis.total_transactions_analyzed.toLocaleString()} records, diagnosed failure causes, enforced stopping rules, and safely executed test interventions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateToTab('agent-studio')}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
          >
            <Zap className="w-3.5 h-3.5 fill-slate-950" />
            <span>Launch Batch Simulator</span>
          </button>
          <button
            onClick={() => onNavigateToTab('audit-trail')}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          >
            <span>View Audit Logs</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Revenue Recovered */}
        <div className="glass-panel p-5 rounded-2xl glass-panel-hover glow-emerald border-emerald-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Revenue Recovered</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
              ₹{kpis.revenue_recovered.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <span className="text-emerald-400 font-semibold">{kpis.successful_recoveries}</span> successes • {kpis.recovery_rate}% capture rate
            </div>
          </div>
        </div>

        {/* Card 2: Revenue at Risk */}
        <div className="glass-panel p-5 rounded-2xl glass-panel-hover border-amber-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Revenue at Risk</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-amber-400 tracking-tight">
              ₹{kpis.revenue_at_risk.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <span>Across {kpis.at_risk_count} failed & abandoned txs</span>
            </div>
          </div>
        </div>

        {/* Card 3: Eligible Opportunity */}
        <div className="glass-panel p-5 rounded-2xl glass-panel-hover border-blue-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Eligible Recovery</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-blue-400 tracking-tight">
              ₹{kpis.eligible_recovery_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <span className="text-blue-400 font-semibold">{kpis.eligible_count}</span> eligible cases diagnosed
            </div>
          </div>
        </div>

        {/* Card 4: Policy Blocked & Escalations */}
        <div className="glass-panel p-5 rounded-2xl glass-panel-hover border-purple-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Guardrails & Safety</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-purple-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-purple-300 tracking-tight">
              {kpis.stopped_actions} <span className="text-sm font-sans font-normal text-slate-400">Blocked</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <span className="text-amber-400 font-semibold">{kpis.escalations}</span> escalations triggered
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Failure Mode Breakdown Bar Chart (2 Cols) */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Revenue at Risk by Failure Mode</h3>
              <p className="text-xs text-slate-400">Root-cause financial exposure across merchant pipeline</p>
            </div>
            <button
              onClick={() => onNavigateToTab('revenue-risk')}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
            >
              <span>Deep-dive</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={charts.failure_reasons.slice(0, 6)}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#64748b" tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                <YAxis dataKey="reason" type="category" stroke="#94a3b8" width={110} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue Exposure']}
                />
                <Bar dataKey="amount" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  {charts.failure_reasons.slice(0, 6).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Recovery (1 Col) */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Payment Rails Distribution</h3>
            <p className="text-xs text-slate-400">Method distribution across at-risk volume</p>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.payment_methods}
                  dataKey="count"
                  nameKey="method"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={4}
                >
                  {charts.payment_methods.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  formatter={(val: any, name: any) => [`${val} transactions`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
            {charts.payment_methods.map((m, idx) => (
              <div key={m.method} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                <span className="text-slate-300 font-medium truncate">{m.method}</span>
                <span className="text-slate-500 text-[11px] ml-auto">{m.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Agent Activity Feed Section */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
            <h3 className="text-sm font-semibold text-slate-200">Live Agent Decision & Audit Feed</h3>
          </div>
          <button
            onClick={() => onNavigateToTab('audit-trail')}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
          >
            <span>Full Audit Trail</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-800/80">
          {activity_feed.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No recovery actions logged yet. Run the batch simulator or execute a transaction recovery to stream real-time decisions.
            </div>
          ) : (
            activity_feed.slice(0, 5).map((log) => {
              const isSuccess = log.execution_result === 'SUCCESS';
              const isBlocked = log.policy_result === 'BLOCKED';
              const isEscalated = log.execution_result === 'ESCALATED' || log.next_action === 'CREATE_ESCALATION';

              return (
                <div
                  key={log.audit_id}
                  onClick={() => onSelectTransaction(log.transaction_id)}
                  className="py-3.5 flex items-center justify-between hover:bg-slate-800/30 px-3 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold ${
                        isSuccess
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : isBlocked
                          ? 'bg-purple-500/20 text-purple-400'
                          : isEscalated
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {isSuccess ? 'REC' : isBlocked ? 'BLK' : isEscalated ? 'ESC' : 'ERR'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-slate-200">
                          {log.transaction_id}
                        </span>
                        <span className="text-[11px] text-slate-400">•</span>
                        <span className="text-xs text-slate-300 font-medium">{log.agent_decision}</span>
                        {isBlocked && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Policy Blocked
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{log.reason}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    {log.recovered_amount > 0 ? (
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        +₹{log.recovered_amount.toLocaleString('en-IN')}
                      </div>
                    ) : (
                      <div className="text-xs font-mono text-slate-500">₹0</div>
                    )}
                    <div className="text-[10px] text-slate-500 flex items-center gap-1 justify-end mt-0.5" title={log.timestamp}>
                      <Clock className="w-3 h-3" />
                      <span>{timeAgo(log.timestamp)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

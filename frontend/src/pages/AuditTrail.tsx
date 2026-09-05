import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Code,
  Clock,
  ArrowRight
} from 'lucide-react';
import { api } from '../api';
import { AuditLogItem } from '../types';

interface AuditTrailProps {
  onSelectTransaction: (txId: string) => void;
}

export const AuditTrail: React.FC<AuditTrailProps> = ({ onSelectTransaction }) => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [policyFilter, setPolicyFilter] = useState('ALL');
  const [execFilter, setExecFilter] = useState('ALL');
  const [selectedJsonLog, setSelectedJsonLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await api.getAuditTrail({
        page,
        limit: 15,
        policy_result: policyFilter === 'ALL' ? undefined : policyFilter,
        execution_result: execFilter === 'ALL' ? undefined : execFilter,
        search: search.trim() || undefined
      });
      setLogs(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, policyFilter, execFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Compliance & Execution Audit Trail</h2>
          <p className="text-xs text-slate-400">
            Immutable chronological record of every AI detection, policy check, test-mode payment, and stopping rule activation
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search audit ID, TX ID, rule reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500/50 text-slate-200 placeholder-slate-500 outline-none"
          />
        </form>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800/80 text-xs">
          <span className="text-slate-500 text-[11px] px-2 font-medium">Policy Verdict:</span>
          {['ALL', 'APPROVED', 'BLOCKED'].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setPolicyFilter(tab);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                policyFilter === tab
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800/80 text-xs">
          <span className="text-slate-500 text-[11px] px-2 font-medium">Result:</span>
          {['ALL', 'SUCCESS', 'FAILED', 'BLOCKED', 'ESCALATED'].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setExecFilter(tab);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                execFilter === tab
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Audit ID & Timestamp</th>
                <th className="py-3.5 px-4">Transaction</th>
                <th className="py-3.5 px-4">AI Decision</th>
                <th className="py-3.5 px-4">Policy Result</th>
                <th className="py-3.5 px-4">Execution Status</th>
                <th className="py-3.5 px-4">Recovered</th>
                <th className="py-3.5 px-4">Audit Rationale</th>
                <th className="py-3.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading audit stream...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No audit records match your query.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isApproved = log.policy_result === 'APPROVED';
                  const isSuccess = log.execution_result === 'SUCCESS';

                  return (
                    <tr key={log.audit_id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Audit ID */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-200">{log.audit_id}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{log.timestamp}</span>
                        </div>
                      </td>

                      {/* Transaction ID */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => onSelectTransaction(log.transaction_id)}
                          className="font-mono font-bold text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <span>{log.transaction_id}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>

                      {/* AI Decision */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-slate-300 font-semibold">{log.agent_decision}</span>
                      </td>

                      {/* Policy Result */}
                      <td className="py-3.5 px-4">
                        {isApproved ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                            APPROVED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold">
                            BLOCKED
                          </span>
                        )}
                      </td>

                      {/* Execution Result */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isSuccess
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : log.execution_result === 'BLOCKED'
                              ? 'bg-purple-500/20 text-purple-400'
                              : log.execution_result === 'ESCALATED'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {log.execution_result}
                        </span>
                      </td>

                      {/* Recovered Amount */}
                      <td className="py-3.5 px-4 font-mono">
                        {log.recovered_amount > 0 ? (
                          <span className="font-bold text-emerald-400">
                            +₹{log.recovered_amount.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-slate-500">₹0</span>
                        )}
                      </td>

                      {/* Audit Reason */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="line-clamp-2 text-slate-300 text-[11px] leading-relaxed">{log.reason}</p>
                      </td>

                      {/* Details Inspector Button */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedJsonLog(log)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 ml-auto"
                          title="View JSON details"
                        >
                          <Code className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing Page <span className="font-semibold text-slate-200">{page}</span> of{' '}
            <span className="font-semibold text-slate-200">{totalPages}</span> ({total} audit events)
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* JSON Modal Inspector */}
      {selectedJsonLog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-200">
                Audit Payload: {selectedJsonLog.audit_id}
              </span>
              <button
                onClick={() => setSelectedJsonLog(null)}
                className="text-slate-400 hover:text-slate-200 text-xs font-medium"
              >
                Close
              </button>
            </div>
            <div className="p-4 overflow-y-auto font-mono text-[11px] text-emerald-400 bg-slate-950">
              <pre>{JSON.stringify(selectedJsonLog, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

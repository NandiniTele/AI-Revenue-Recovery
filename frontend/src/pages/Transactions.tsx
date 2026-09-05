import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { api } from '../api';
import { TransactionItem } from '../types';

interface TransactionsProps {
  onSelectTransaction: (txId: string) => void;
}

export const Transactions: React.FC<TransactionsProps> = ({ onSelectTransaction }) => {
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [paymentMethod, setPaymentMethod] = useState('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const res = await api.getTransactions({
        page,
        limit: 15,
        status: status === 'ALL' ? undefined : status,
        payment_method: paymentMethod === 'ALL' ? undefined : paymentMethod,
        search: search.trim() || undefined,
        sort_order: sortOrder
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, status, paymentMethod, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Merchant Transaction Explorer</h2>
          <p className="text-xs text-slate-400">
            {total.toLocaleString()} total transactions ingested • Filter and diagnose at-risk pipeline
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search TX ID, customer, reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 text-slate-200 placeholder-slate-500 outline-none"
            />
          </form>

          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1.5"
            title="Toggle sort order"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter Tabs & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800/80">
          {['ALL', 'FAILED', 'RECOVERED', 'ABANDONED', 'ESCALATED'].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setStatus(tab);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                status === tab
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'ALL' ? 'All Transactions' : tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={paymentMethod}
            onChange={(e) => {
              setPaymentMethod(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-300 outline-none cursor-pointer"
          >
            <option value="ALL">All Payment Methods</option>
            <option value="UPI">UPI</option>
            <option value="Credit Card">Credit Card</option>
            <option value="Debit Card">Debit Card</option>
            <option value="Net Banking">Net Banking</option>
            <option value="Wallet">Wallet</option>
          </select>
        </div>
      </div>

      {/* Transactions Data Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Transaction ID</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Failure Reason</th>
                <th className="py-3.5 px-4">Risk & Prob</th>
                <th className="py-3.5 px-4">AI Recommended</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading merchant transactions...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No transactions match current filters.
                  </td>
                </tr>
              ) : (
                items.map((tx) => {
                  const isSuccess = tx.is_recovered || tx.payment_status === 'SUCCESS';
                  const isEscalated = tx.current_state === 'ESCALATED';
                  const isBlocked = tx.current_state === 'BLOCKED';

                  return (
                    <tr
                      key={tx.transaction_id}
                      onClick={() => onSelectTransaction(tx.transaction_id)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      {/* Transaction ID */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">
                          {tx.transaction_id}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {tx.payment_method}
                        </div>
                      </td>

                      {/* Customer Profile */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-200">{tx.customer_name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[9px] font-mono px-1 py-0.2 rounded font-semibold ${
                              tx.customer_tier === 'VIP'
                                ? 'bg-amber-500/20 text-amber-300'
                                : tx.customer_tier === 'Enterprise'
                                ? 'bg-purple-500/20 text-purple-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {tx.customer_tier}
                          </span>
                          <span className="text-[10px] text-slate-500">{tx.customer_id}</span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-semibold text-slate-100">
                          ₹{tx.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </div>
                        {tx.recovered_amount > 0 && (
                          <div className="text-[10px] text-emerald-400 font-medium">
                            +₹{tx.recovered_amount.toLocaleString('en-IN')} Rec.
                          </div>
                        )}
                      </td>

                      {/* Failure Reason */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
                          {tx.failure_reason || 'none'}
                        </span>
                        {tx.retry_count > 0 && (
                          <div className="text-[10px] text-amber-400/90 mt-1 font-mono">
                            Retries: {tx.retry_count}/2
                          </div>
                        )}
                      </td>

                      {/* Risk Score & Recovery Probability */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                tx.risk_score > 70
                                  ? 'bg-rose-500'
                                  : tx.risk_score > 40
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${tx.risk_score}%` }}
                            ></div>
                          </div>
                          <span className="text-[11px] font-mono font-medium text-slate-300">
                            {tx.risk_score}
                          </span>
                        </div>
                        <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                          Prob: {(tx.recovery_probability * 100).toFixed(0)}%
                        </div>
                      </td>

                      {/* AI Decision */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-1 rounded bg-blue-950/40 border border-blue-500/30 text-[10px] font-mono font-semibold text-blue-300">
                          {tx.recommended_action}
                        </span>
                      </td>

                      {/* Current Status */}
                      <td className="py-3.5 px-4">
                        {isSuccess ? (
                          <span className="px-2 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>RECOVERED</span>
                          </span>
                        ) : isEscalated ? (
                          <span className="px-2 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] font-bold text-amber-300 flex items-center gap-1 w-fit">
                            <AlertCircle className="w-3 h-3" />
                            <span>ESCALATED</span>
                          </span>
                        ) : isBlocked ? (
                          <span className="px-2 py-1 rounded bg-purple-500/20 border border-purple-500/40 text-[10px] font-bold text-purple-300 flex items-center gap-1 w-fit">
                            <ShieldCheck className="w-3 h-3" />
                            <span>BLOCKED</span>
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded bg-rose-500/20 border border-rose-500/40 text-[10px] font-bold text-rose-300 w-fit">
                            {tx.payment_status}
                          </span>
                        )}
                      </td>

                      {/* Action trigger button */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTransaction(tx.transaction_id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 text-[11px] font-semibold transition-all"
                        >
                          Inspect
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
            <span className="font-semibold text-slate-200">{totalPages}</span> ({total} total records)
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

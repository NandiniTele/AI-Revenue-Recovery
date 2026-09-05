import React from 'react';
import {
  TrendingDown,
  AlertCircle,
  Clock,
  CreditCard,
  UserCheck,
  Zap,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { DashboardResponse } from '../types';

interface RevenueAtRiskProps {
  data: DashboardResponse | null;
  onNavigateToTransactions: () => void;
}

export const RevenueAtRisk: React.FC<RevenueAtRiskProps> = ({
  data,
  onNavigateToTransactions
}) => {
  if (!data) return null;

  const { kpis, charts } = data;

  const categories = [
    {
      title: 'Transient Gateway Declines',
      desc: 'Network timeouts, issuer downtime, webhook drops',
      potential: 'Very High (85–95%)',
      color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
      action: 'Automated Smart Retry'
    },
    {
      title: 'Checkout Cart Drop-offs',
      desc: 'Abandoned carts, OTP dropoffs, payment page exits',
      potential: 'Moderate (55–65%)',
      color: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
      action: 'Interactive Payment Link'
    },
    {
      title: 'Subscription Renewal Failures',
      desc: 'Past due recurring recurring billing charges',
      potential: 'High (70–80%)',
      color: 'border-purple-500/30 text-purple-400 bg-purple-500/10',
      action: 'Smart Billing Cycle Retry'
    },
    {
      title: 'Soft Customer Declines',
      desc: 'Insufficient balance, daily bank limit reached',
      potential: 'Moderate (40–50%)',
      color: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
      action: 'Scheduled Reminder & Cooldown'
    },
    {
      title: 'Fatal & Expired Card Declines',
      desc: 'Expired credentials, account closed, fraud blocks',
      potential: 'Low (<15%)',
      color: 'border-rose-500/30 text-rose-400 bg-rose-500/10',
      action: 'Card Update / Human Escalation'
    }
  ];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Overview Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400">
            <TrendingDown className="w-4 h-4" />
            <span>REVENUE AT RISK PIPELINE ANALYSIS</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            ₹{kpis.revenue_at_risk.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Revenue Currently at Risk
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Of this total, RecoverAI has identified <span className="font-semibold text-emerald-400 font-mono">₹{kpis.eligible_recovery_amount.toLocaleString('en-IN')} ({kpis.eligible_count} transactions)</span> as eligible for automated bounded recovery without policy violations.
          </p>
        </div>

        <button
          onClick={onNavigateToTransactions}
          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-2 shadow-lg shadow-amber-500/20 whitespace-nowrap"
        >
          <span>Explore Transactions</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Failure Category Segmentation */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
          Revenue Jeopardy by Failure Classification
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div key={cat.title} className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">{cat.title}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${cat.color}`}>
                    {cat.potential}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{cat.desc}</p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">Autonomous Action:</span>
                <span className="font-mono text-slate-300 font-semibold">{cat.action}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Failure Breakdown Table */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200">Granular Failure Code Exposure</h3>
        <div className="divide-y divide-slate-800">
          {charts.failure_reasons.map((f) => (
            <div key={f.reason} className="py-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="font-medium text-slate-200">{f.reason}</span>
                <span className="text-slate-500 text-[11px]">({f.count} transactions)</span>
              </div>

              <div className="font-mono font-bold text-slate-100">
                ₹{f.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

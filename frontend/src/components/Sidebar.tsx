import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  TrendingDown,
  Bot,
  ShieldCheck,
  History,
  LineChart,
  MessageSquareCode,
  Sparkles,
  RefreshCw
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onResetDemo: () => void;
  isResetting: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onResetDemo,
  isResetting
}) => {
  const navItems = [
    { id: 'dashboard',         label: 'Executive Overview',     icon: LayoutDashboard,   badge: null },
    { id: 'transactions',      label: 'Transactions Explorer',  icon: Receipt,           badge: 'Live' },
    { id: 'revenue-risk',      label: 'Revenue at Risk',        icon: TrendingDown,      badge: null },
    { id: 'agent-studio',      label: 'Recovery Simulator',     icon: Bot,               badge: 'Demo' },
    { id: 'policy-guardrails', label: 'Policy & Guardrails',    icon: ShieldCheck,       badge: null },
    { id: 'audit-trail',       label: 'Audit Trail',            icon: History,           badge: null },
    { id: 'ml-evaluation',     label: 'ML Evaluation & ROI',    icon: LineChart,         badge: 'Scorecard' },
    { id: 'merchant-copilot',  label: 'Merchant AI Copilot',    icon: MessageSquareCode, badge: 'Zero Hallucination' },
  ];

  return (
    <aside className="w-64 bg-[#0d1424] border-r border-slate-800/80 flex flex-col justify-between h-screen sticky top-0 select-none z-30">
      <div>
        {/* Brand Logo & Track Badge */}
        <div className="p-5 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Recover<span className="text-emerald-400">AI</span>
              </div>
              <div className="text-[10px] font-mono text-emerald-400/90 font-medium tracking-wide">
                TRACK 03 • REVENUE AGENT
              </div>
            </div>
          </div>

          <div className="mt-3 px-2.5 py-1.5 rounded-md bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="relative flex w-2 h-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-400"></span>
              </span>
              <span className="text-[11px] font-medium text-emerald-300">Policy Engine Active</span>
            </div>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
              Test Mode
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="p-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all overflow-hidden ${
                  isActive
                    ? 'nav-active-accent bg-gradient-to-r from-emerald-500/12 to-transparent text-emerald-300 border border-emerald-500/25 shadow-sm shadow-emerald-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    title={item.badge}
                    className={`ml-1 text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0 max-w-[72px] truncate ${
                      isActive
                        ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/20'
                        : 'bg-slate-800/80 text-slate-500 border border-slate-700/50'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Controls / Demo Reset */}
      <div className="p-4 border-t border-slate-800/60 bg-slate-900/40">
        <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80 mb-3">
          <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mb-1">Merchant Account</div>
          <div className="text-xs font-semibold text-slate-200 truncate">Apex Retail Technologies</div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">MID: apex_in_test_0981</div>
        </div>

        <button
          onClick={onResetDemo}
          disabled={isResetting}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-300 text-xs font-medium border border-slate-700/60 transition-all disabled:opacity-50 hover:border-slate-600"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
          <span>{isResetting ? 'Resetting Data...' : 'Reset 1.25k Demo Data'}</span>
        </button>
      </div>
    </aside>
  );
};

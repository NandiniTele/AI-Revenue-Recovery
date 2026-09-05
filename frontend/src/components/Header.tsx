import React from 'react';
import { ShieldCheck, PlayCircle, Sparkles, Database } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle: string;
  onOpenBatchDemo: () => void;
  recoveredAmount?: number;
  atRiskAmount?: number;
  totalTransactions?: number;
  isConnected?: boolean;
  isDemoMode?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onOpenBatchDemo,
  recoveredAmount = 0,
  atRiskAmount = 0,
  totalTransactions,
  isConnected = true,
  isDemoMode = false
}) => {
  return (
    <header className="sticky top-0 z-20 bg-[#0a0f1d]/95 backdrop-blur-md border-b border-slate-800/80 px-8 py-3.5 flex items-center justify-between">
      <div className="animate-fade-in">
        <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* At-Risk vs Recovered Quick Ticker */}
        <div className="hidden md:flex items-center gap-3 px-3.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
          <div>
            <span className="text-slate-500">At Risk: </span>
            <span className="font-semibold font-mono text-amber-400">
              ₹{atRiskAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="w-px h-3.5 bg-slate-700"></div>
          <div>
            <span className="text-slate-500">Recovered: </span>
            <span className="font-semibold font-mono text-emerald-400">
              ₹{recoveredAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* Connection & Dataset Status Badge */}
        {isDemoMode ? (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all bg-amber-950/40 border-amber-500/40 text-amber-300 shadow-sm shadow-amber-900/20"
            title="Interactive Demo Mode active: operating on full 1,250 transaction dataset. Connect live backend anytime via VITE_API_BASE."
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Demo Mode ({totalTransactions?.toLocaleString() || 1250} txs)</span>
          </div>
        ) : (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
            isConnected
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300 animate-pulse'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
            <span>
              {isConnected
                ? `Live API & DB Connected (${totalTransactions?.toLocaleString() || 1250} txs)`
                : 'Connecting to API...'}
            </span>
          </div>
        )}

        {/* Safety Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950/40 border border-blue-500/30 text-blue-300 text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span>Strict Guardrails</span>
        </div>

        {/* Run Recovery Agent CTA — with live pulsing dot */}
        <button
          onClick={onOpenBatchDemo}
          className="relative flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-semibold shadow-lg shadow-emerald-600/25 transition-all active:scale-95 group"
        >
          {/* Live pulsing dot */}
          <span className="relative flex w-2 h-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60"></span>
            <span className="relative inline-flex rounded-full w-2 h-2 bg-white"></span>
          </span>
          <PlayCircle className="w-4 h-4" />
          <span>Run Recovery Agent</span>
        </button>
      </div>
    </header>
  );
};

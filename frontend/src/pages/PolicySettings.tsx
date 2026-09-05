import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Save,
  CheckCircle2,
  Lock,
  Clock,
  AlertTriangle,
  Sliders,
  Sparkles
} from 'lucide-react';
import { api } from '../api';
import { MerchantSettingsData } from '../types';

export const PolicySettings: React.FC = () => {
  const [settings, setSettings] = useState<MerchantSettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form states
  const [maxRetries, setMaxRetries] = useState(2);
  const [cooldownHours, setCooldownHours] = useState(24);
  const [highValueCap, setHighValueCap] = useState(40000);
  const [autoRecovery, setAutoRecovery] = useState(true);
  const [quietHours, setQuietHours] = useState(false);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await api.getSettings();
      setSettings(res);
      setMaxRetries(res.max_retries_allowed);
      setCooldownHours(res.retry_cooldown_hours);
      setHighValueCap(res.high_value_manual_threshold);
      setAutoRecovery(res.auto_recovery_enabled);
      setQuietHours(res.quiet_hours_enabled);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await api.updateSettings({
        max_retries_allowed: maxRetries,
        retry_cooldown_hours: cooldownHours,
        high_value_manual_threshold: highValueCap,
        auto_recovery_enabled: autoRecovery,
        quiet_hours_enabled: quietHours
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e: any) {
      alert(`Save error: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-[#131b2e] to-slate-900 border border-purple-500/30 flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-purple-400">
            <ShieldCheck className="w-4 h-4" />
            <span>BOUNDED AUTONOMY & POLICY ENGINE</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Merchant Safety Guardrails & Stopping Rules
          </h2>
          <p className="text-xs text-slate-300">
            Configure hard constraints. The AI recovery agent is structurally prohibited from bypassing these boundaries.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium font-mono">
          <Lock className="w-3.5 h-3.5" />
          <span>Active Guard</span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Rule 1: Max Retries */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Max Payment Retries
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {maxRetries} Attempts
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Stopping Rule: Once this threshold is reached, payment retries are blocked immediately and automatically escalated.
            </p>
            <input
              type="range"
              min="1"
              max="4"
              step="1"
              value={maxRetries}
              onChange={(e) => setMaxRetries(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>1 retry</span>
              <span className="text-emerald-400 font-bold">2 retries (Default)</span>
              <span>3 retries</span>
              <span>4 retries</span>
            </div>
          </div>

          {/* Rule 2: Customer Contact Cooldown */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Customer Contact Cooldown
              </span>
              <span className="text-xs font-mono font-bold text-blue-400">
                {cooldownHours} Hours
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Spam Guard: Blocks reminder dispatches if the customer received a message within this window.
            </p>
            <input
              type="range"
              min="6"
              max="72"
              step="6"
              value={cooldownHours}
              onChange={(e) => setCooldownHours(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>6 hours</span>
              <span>24h (Standard)</span>
              <span>48 hours</span>
              <span>72 hours</span>
            </div>
          </div>

          {/* Rule 3: High Value Manual Review Threshold */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                High-Value Safety Cap
              </span>
              <span className="text-xs font-mono font-bold text-amber-400">
                ₹{highValueCap.toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Transactions exceeding this amount will pause autonomous execution and require supervisor sign-off.
            </p>
            <input
              type="range"
              min="10000"
              max="100000"
              step="5000"
              value={highValueCap}
              onChange={(e) => setHighValueCap(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>₹10,000</span>
              <span>₹40,000</span>
              <span>₹75,000</span>
              <span>₹1,00,000</span>
            </div>
          </div>

          {/* Rule 4: Toggles */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200">Autonomous Execution Engine</span>
                <p className="text-[11px] text-slate-400">Enable bounded auto-actions</p>
              </div>
              <input
                type="checkbox"
                checked={autoRecovery}
                onChange={(e) => setAutoRecovery(e.target.checked)}
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-200">Quiet Hours Protection</span>
                <p className="text-[11px] text-slate-400">Pause reminders between 10 PM - 8 AM</p>
              </div>
              <input
                type="checkbox"
                checked={quietHours}
                onChange={(e) => setQuietHours(e.target.checked)}
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* API Credentials & Integrations Status */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                External API Integrations (.env Configuration)
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Live Environment File
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Google Gemini API</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  Ready / Fallback Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Powers conversational natural language queries in Merchant Copilot grounded in SQLite.
              </p>
              <div className="text-[10px] font-mono text-slate-500 pt-1">
                Env Var: <code className="text-slate-300">GEMINI_API_KEY</code>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Razorpay Sandbox Gateway</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  Test Sandbox Mode
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Enables test orders & mock payment recovery dispatch in sandbox environment.
              </p>
              <div className="text-[10px] font-mono text-slate-500 pt-1">
                Env Var: <code className="text-slate-300">RAZORPAY_KEY_ID</code> & <code className="text-slate-300">RAZORPAY_KEY_SECRET</code>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-4">
          {savedSuccess && (
            <div className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>Guardrail settings updated successfully!</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="ml-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-600/25 flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Policy...' : 'Save Guardrails'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

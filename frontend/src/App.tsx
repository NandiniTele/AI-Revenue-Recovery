import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions';
import { RevenueAtRisk } from './pages/RevenueAtRisk';
import { AgentStudio } from './pages/AgentStudio';
import { PolicySettings } from './pages/PolicySettings';
import { AuditTrail } from './pages/AuditTrail';
import { MLEvaluation } from './pages/MLEvaluation';
import { MerchantCopilot } from './pages/MerchantCopilot';
import { TransactionDetailModal } from './pages/TransactionDetailModal';
import { api } from './api';
import { DashboardResponse } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setIsLoadingDashboard(true);
      const data = await api.getDashboard();
      setDashboardData(data);
      setIsConnected(true);
      setConnectionError(null);
    } catch (e: any) {
      console.error('Failed to load dashboard data:', e);
      setIsConnected(false);
      setConnectionError(e.message || 'Cannot reach FastAPI backend server. Ensure backend is running on port 8000.');
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  useEffect(() => {
    const unsubscribe = api.onModeChange((demo) => {
      setIsDemoMode(demo);
    });
    fetchDashboardData();
    return () => unsubscribe();
  }, []);

  const handleResetDemo = async () => {
    if (!confirm('Reset the database back to clean 1,250 synthetic transactions?')) return;
    setIsResetting(true);
    try {
      await api.resetDemo();
      await fetchDashboardData();
      alert('Demo data successfully reset!');
    } catch (e: any) {
      alert(`Reset failed: ${e.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return { title: 'Revenue Recovery Dashboard', subtitle: 'Real-time overview of at-risk pipelines, recovered revenue, and policy guardrails' };
      case 'transactions':
        return { title: 'Transactions Explorer', subtitle: 'Filter, inspect, and diagnose recoverable vs unrecoverable failed payments' };
      case 'revenue-risk':
        return { title: 'Revenue at Risk Analytics', subtitle: 'Granular breakdown of revenue jeopardy across failure classifications' };
      case 'agent-studio':
        return { title: 'AI Recovery Agent Simulator', subtitle: 'One-click batch recovery execution, policy stopping rules, and graceful failure testing' };
      case 'policy-guardrails':
        return { title: 'Merchant Policy & Guardrails', subtitle: 'Configure strict retry boundaries, contact cooldowns, and safety stopping limits' };
      case 'audit-trail':
        return { title: 'Immutable Audit Trail', subtitle: 'Comprehensive chronological audit log of every AI decision, policy check, and payment result' };
      case 'ml-evaluation':
        return { title: 'ML Performance & ROI Scorecard', subtitle: 'Official Track 03 metrics computed on 15% held-out test split (Precision, Recall, ROC-AUC)' };
      case 'merchant-copilot':
        return { title: 'Merchant AI Copilot', subtitle: 'Zero-hallucination natural language assistant linked directly to live SQLite tables' };
      default:
        return { title: 'RecoverAI Dashboard', subtitle: 'AI Revenue Recovery Agent' };
    }
  };

  const { title, subtitle } = getPageTitle();

  return (
    <div className="flex min-h-screen bg-[#0a0f1d] text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onResetDemo={handleResetDemo}
        isResetting={isResetting}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          subtitle={subtitle}
          onOpenBatchDemo={() => setActiveTab('agent-studio')}
          recoveredAmount={dashboardData?.kpis.revenue_recovered}
          atRiskAmount={dashboardData?.kpis.revenue_at_risk}
          totalTransactions={dashboardData?.kpis.total_transactions_analyzed}
          isConnected={isConnected}
          isDemoMode={isDemoMode}
        />

        {connectionError && !isDemoMode && (
          <div className="mx-8 mt-4 p-4 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              <span><strong>Backend Connection Error:</strong> {connectionError}</span>
            </div>
            <button
              onClick={fetchDashboardData}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
            >
              Retry Connection
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              data={dashboardData}
              isLoading={isLoadingDashboard}
              onSelectTransaction={(id) => setSelectedTxId(id)}
              onNavigateToTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'transactions' && (
            <Transactions onSelectTransaction={(id) => setSelectedTxId(id)} />
          )}

          {activeTab === 'revenue-risk' && (
            <RevenueAtRisk
              data={dashboardData}
              onNavigateToTransactions={() => setActiveTab('transactions')}
            />
          )}

          {activeTab === 'agent-studio' && (
            <AgentStudio
              onRefreshDashboard={fetchDashboardData}
              onSelectTransaction={(id) => setSelectedTxId(id)}
            />
          )}

          {activeTab === 'policy-guardrails' && (
            <PolicySettings />
          )}

          {activeTab === 'audit-trail' && (
            <AuditTrail onSelectTransaction={(id) => setSelectedTxId(id)} />
          )}

          {activeTab === 'ml-evaluation' && (
            <MLEvaluation />
          )}

          {activeTab === 'merchant-copilot' && (
            <MerchantCopilot onSelectTransaction={(id) => setSelectedTxId(id)} />
          )}
        </main>
      </div>

      {/* Deep-Dive Transaction Detail & Audit Modal */}
      <TransactionDetailModal
        transactionId={selectedTxId}
        onClose={() => setSelectedTxId(null)}
        onRefreshData={fetchDashboardData}
      />
    </div>
  );
}

export default App;

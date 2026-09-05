import {
  DashboardResponse,
  TransactionItem,
  TransactionDetail,
  AuditLogItem,
  MLEvaluationScorecard,
  MerchantSettingsData
} from './types';
import { demoStore } from './demoStore';

// Determine configured base URL (env var or default to /api)
const envApiBase = (import.meta as any).env?.VITE_API_BASE as string | undefined;
let customApiBase: string | null = typeof window !== 'undefined' ? localStorage.getItem('RECOVERAI_API_BASE') : null;
let activeApiBase = (customApiBase && customApiBase.trim()) || (envApiBase && envApiBase.trim()) || '/api';

// Demo Mode state tracker
let isDemoModeActive = false;
type ModeChangeListener = (isDemo: boolean) => void;
const modeListeners: Set<ModeChangeListener> = new Set();

function setDemoMode(active: boolean) {
  if (isDemoModeActive !== active) {
    isDemoModeActive = active;
    modeListeners.forEach(listener => {
      try {
        listener(active);
      } catch (err) {
        console.error('Mode change listener error:', err);
      }
    });
  }
}

export function isDemoMode(): boolean {
  return isDemoModeActive;
}

export function subscribeToModeChange(listener: ModeChangeListener): () => void {
  modeListeners.add(listener);
  listener(isDemoModeActive);
  return () => {
    modeListeners.delete(listener);
  };
}

export function getApiBase(): string {
  return activeApiBase;
}

export function setApiBase(url: string | null) {
  if (url && url.trim()) {
    activeApiBase = url.trim();
    localStorage.setItem('RECOVERAI_API_BASE', activeApiBase);
  } else {
    activeApiBase = envApiBase?.trim() || '/api';
    localStorage.removeItem('RECOVERAI_API_BASE');
  }
}

async function tryFetch<T>(
  endpoint: string,
  options?: RequestInit,
  fallbackFn?: () => Promise<T>,
  timeoutMs = 4000
): Promise<T> {
  const url = `${activeApiBase.replace(/\/$/, '')}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      // 404 or server error (e.g. Vercel static 404 or backend unavailable)
      throw new Error(`API returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    setDemoMode(false);
    return data as T;
  } catch (err: any) {
    clearTimeout(timer);
    console.warn(`[RecoverAI] Backend call to ${url} failed (${err.message || 'connection error'}). Using Demo Mode.`);
    setDemoMode(true);

    if (fallbackFn) {
      return await fallbackFn();
    }
    throw err;
  }
}

export const api = {
  isDemoMode: () => isDemoModeActive,
  onModeChange: subscribeToModeChange,
  getApiBase,
  setApiBase,

  getDashboard: async (): Promise<DashboardResponse> => {
    return tryFetch<DashboardResponse>(
      '/dashboard',
      { method: 'GET' },
      () => demoStore.getDashboard()
    );
  },

  getTransactions: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    current_state?: string;
    payment_method?: string;
    search?: string;
    min_amount?: number;
    sort_by?: string;
    sort_order?: string;
  }): Promise<{ items: TransactionItem[]; total: number; page: number; total_pages: number }> => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.status) query.append('status', params.status);
    if (params?.current_state) query.append('current_state', params.current_state);
    if (params?.payment_method) query.append('payment_method', params.payment_method);
    if (params?.search) query.append('search', params.search);
    if (params?.min_amount) query.append('min_amount', params.min_amount.toString());
    if (params?.sort_by) query.append('sort_by', params.sort_by);
    if (params?.sort_order) query.append('sort_order', params.sort_order);

    const qStr = query.toString();
    return tryFetch<{ items: TransactionItem[]; total: number; page: number; total_pages: number }>(
      `/transactions${qStr ? '?' + qStr : ''}`,
      { method: 'GET' },
      () => demoStore.getTransactions(params)
    );
  },

  getTransactionDetail: async (transactionId: string): Promise<TransactionDetail> => {
    return tryFetch<TransactionDetail>(
      `/transactions/${encodeURIComponent(transactionId)}`,
      { method: 'GET' },
      () => demoStore.getTransactionDetail(transactionId)
    );
  },

  diagnoseTransaction: async (transactionId: string) => {
    return tryFetch(
      `/agent/analyze/${encodeURIComponent(transactionId)}`,
      { method: 'POST' },
      () => demoStore.diagnoseTransaction(transactionId)
    );
  },

  executeRecovery: async (transactionId: string, actionOverride?: string, forceFailureMode?: string) => {
    return tryFetch(
      `/recovery/execute/${encodeURIComponent(transactionId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_override: actionOverride,
          force_failure_mode: forceFailureMode
        })
      },
      () => demoStore.executeRecovery(transactionId, actionOverride, forceFailureMode)
    );
  },

  runBatchRecovery: async (batchSize = 50) => {
    return tryFetch(
      `/agent/batch-recover`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_size: batchSize })
      },
      () => demoStore.runBatchRecovery(batchSize)
    );
  },

  getAuditTrail: async (params?: {
    page?: number;
    limit?: number;
    transaction_id?: string;
    policy_result?: string;
    execution_result?: string;
    search?: string;
  }): Promise<{ items: AuditLogItem[]; total: number; page: number; total_pages: number }> => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.transaction_id) query.append('transaction_id', params.transaction_id);
    if (params?.policy_result) query.append('policy_result', params.policy_result);
    if (params?.execution_result) query.append('execution_result', params.execution_result);
    if (params?.search) query.append('search', params.search);

    const qStr = query.toString();
    return tryFetch<{ items: AuditLogItem[]; total: number; page: number; total_pages: number }>(
      `/audit${qStr ? '?' + qStr : ''}`,
      { method: 'GET' },
      () => demoStore.getAuditTrail(params)
    );
  },

  getAnalytics: async (): Promise<MLEvaluationScorecard> => {
    return tryFetch<MLEvaluationScorecard>(
      '/analytics',
      { method: 'GET' },
      () => demoStore.getAnalytics()
    );
  },

  askAssistant: async (message: string): Promise<{ answer: string; data: any }> => {
    return tryFetch<{ answer: string; data: any }>(
      '/assistant/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      },
      () => demoStore.askAssistant(message)
    );
  },

  getSettings: async (): Promise<MerchantSettingsData> => {
    return tryFetch<MerchantSettingsData>(
      '/demo/settings',
      { method: 'GET' },
      () => demoStore.getSettings()
    );
  },

  updateSettings: async (settings: Partial<MerchantSettingsData>) => {
    return tryFetch<MerchantSettingsData>(
      '/demo/settings',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      },
      () => demoStore.updateSettings(settings)
    );
  },

  resetDemo: async () => {
    return tryFetch(
      '/demo/reset',
      { method: 'POST' },
      () => demoStore.resetDemo()
    );
  },

  injectFailure: async (transactionId = 'TX1024', failureType = 'GATEWAY_TIMEOUT') => {
    return tryFetch(
      '/demo/inject-failure',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: transactionId, failure_type: failureType })
      },
      () => demoStore.executeRecovery(transactionId, 'RETRY_PAYMENT', 'BANK_DOWNTIME')
    );
  }
};

import axios from 'axios';
import {
  Dataset,
  BatchRun,
  ReconciliationItem,
  ExceptionItem,
  ExceptionDetail,
  Investigation,
  DashboardSummary,
  FindTheMoneyResponse,
  EvaluationResult,
  CopilotResponse,
  CashForecast,
  AnomalyAlert,
  AuditLog,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  // Datasets
  generateDataset: async (name: string, recordCount: number, seed?: number, scenarios?: any): Promise<Dataset> => {
    const res = await api.post('/datasets/generate', {
      name,
      record_count: recordCount,
      seed: seed || 42,
      scenarios,
    });
    return res.data;
  },

  listDatasets: async (): Promise<Dataset[]> => {
    const res = await api.get('/datasets');
    return res.data;
  },

  // Reconciliation
  runReconciliation: async (datasetId: string, autoInvestigate = true): Promise<any> => {
    const res = await api.post('/reconciliation/run', {
      dataset_id: datasetId,
      auto_investigate: autoInvestigate,
      max_investigations: 50,
    });
    return res.data;
  },

  getBatchStatus: async (batchId: string): Promise<BatchRun> => {
    const res = await api.get(`/reconciliation/${batchId}`);
    return res.data;
  },

  getBatchItems: async (
    batchId: string,
    status?: string,
    search?: string,
    limit = 100,
    offset = 0
  ): Promise<ReconciliationItem[]> => {
    const res = await api.get(`/reconciliation/${batchId}/items`, {
      params: { status, search, limit, offset },
    });
    return res.data;
  },

  // Exceptions
  listExceptions: async (
    batchId?: string,
    severity?: string,
    status?: string,
    exceptionType?: string,
    limit = 100
  ): Promise<ExceptionItem[]> => {
    const res = await api.get('/exceptions', {
      params: { batch_id: batchId, severity, status, exception_type: exceptionType, limit },
    });
    return res.data;
  },

  getExceptionDetail: async (exceptionId: string): Promise<ExceptionDetail> => {
    const res = await api.get(`/exceptions/${exceptionId}`);
    return res.data;
  },

  investigateException: async (exceptionId: string): Promise<Investigation> => {
    const res = await api.post(`/exceptions/${exceptionId}/investigate`);
    return res.data;
  },

  approveException: async (exceptionId: string, decision: string, notes?: string): Promise<any> => {
    const res = await api.post(`/exceptions/${exceptionId}/approve`, { decision, notes });
    return res.data;
  },

  // Dashboard
  getDashboardSummary: async (batchId?: string): Promise<DashboardSummary> => {
    const res = await api.get('/dashboard/summary', { params: { batch_id: batchId } });
    return res.data;
  },

  findTheMoney: async (batchId?: string): Promise<FindTheMoneyResponse> => {
    const res = await api.get('/dashboard/find-the-money', { params: { batch_id: batchId } });
    return res.data;
  },

  explainMetric: async (metricName: string, batchId?: string): Promise<any> => {
    const res = await api.get(`/dashboard/explain/${metricName}`, { params: { batch_id: batchId } });
    return res.data;
  },

  // Evaluation
  getEvaluation: async (batchId: string): Promise<EvaluationResult> => {
    const res = await api.get(`/evaluation/${batchId}`);
    return res.data;
  },

  // Copilot
  queryCopilot: async (query: string, batchId?: string, datasetId?: string): Promise<CopilotResponse> => {
    const res = await api.post('/copilot/query', { query, batch_id: batchId, dataset_id: datasetId });
    return res.data;
  },

  // Cash & Forecast
  getCashForecast: async (datasetId?: string): Promise<CashForecast> => {
    const res = await api.get('/cash/forecast', { params: { dataset_id: datasetId } });
    return res.data;
  },

  // Anomaly
  getAnomalies: async (datasetId?: string): Promise<AnomalyAlert[]> => {
    const res = await api.get('/anomaly/alerts', { params: { dataset_id: datasetId } });
    return res.data;
  },

  // Audit
  getAuditTrail: async (batchId?: string, limit = 100): Promise<AuditLog[]> => {
    const res = await api.get('/audit', { params: { batch_id: batchId, limit } });
    return res.data;
  },

  // PDF Export
  downloadExceptionPdfUrl: (exceptionId: string): string => {
    return `${API_BASE}/exceptions/${exceptionId}/pdf`;
  },

  downloadExceptionPdf: async (exceptionId: string): Promise<void> => {
    const res = await api.get(`/exceptions/${exceptionId}/pdf`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `FINCTRL_Evidence_${exceptionId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Merchants Health Scorecard
  getMerchantsScorecard: async (batchId?: string): Promise<any> => {
    const res = await api.get('/merchants/scorecard', { params: { batch_id: batchId } });
    return res.data;
  },

  // Settlement Aging & Velocity
  getSettlementAging: async (datasetId?: string): Promise<any> => {
    const res = await api.get('/cash/settlement-aging', { params: { dataset_id: datasetId } });
    return res.data;
  },

  simulateWebhook: async (eventType = 'payment.captured', amount = 2499.0): Promise<any> => {
    const res = await api.post('/webhooks/simulate', null, {
      params: { event_type: eventType, amount },
    });
    return res.data;
  },

  syncLiveRazorpay: async (): Promise<any> => {
    const res = await api.post('/webhooks/sync-live');
    return res.data;
  },

  getLiveFeedUrl: (): string => {
    return `${API_BASE}/webhooks/live-feed`;
  },

  // Dispute & Escalation Packet
  getDisputePacket: async (exceptionId: string): Promise<any> => {
    const res = await api.get(`/exceptions/${exceptionId}/dispute-packet`);
    return res.data;
  },

  downloadDisputePdf: async (exceptionId: string): Promise<void> => {
    const res = await api.get(`/exceptions/${exceptionId}/dispute-pdf`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `FINCTRL_Dispute_Notice_${exceptionId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Double-Entry General Ledger (GL) & ERP Sync
  getBatchJournalEntries: async (batchId: string): Promise<any> => {
    const res = await api.get(`/reconciliation/${batchId}/journal-entries`);
    return res.data;
  },

  downloadGlExport: async (batchId: string, format = 'csv'): Promise<void> => {
    const res = await api.get(`/reconciliation/${batchId}/export-gl`, {
      params: { format },
      responseType: format === 'json' ? 'json' : 'blob',
    });
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `FINCTRL_General_Ledger_${batchId.substring(0, 8)}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } else {
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `FINCTRL_General_Ledger_${batchId.substring(0, 8)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    }
  },

  // Self-Healing Dynamic Matching Rules
  getRules: async (): Promise<any> => {
    const res = await api.get('/rules');
    return res.data;
  },

  getSuggestedRules: async (batchId?: string): Promise<any> => {
    const res = await api.get('/rules/suggestions', { params: { batch_id: batchId } });
    return res.data;
  },

  approveRule: async (ruleId: string): Promise<any> => {
    const res = await api.post(`/rules/${ruleId}/approve`);
    return res.data;
  },

  dismissRule: async (ruleId: string): Promise<any> => {
    const res = await api.post(`/rules/${ruleId}/dismiss`);
    return res.data;
  },

  // GSTR-2B Tax & Input Tax Credit (ITC) Reconciliation
  getGstr2bReconciliation: async (batchId?: string): Promise<any> => {
    const res = await api.get('/tax/gstr2b-reconciliation', { params: { batch_id: batchId } });
    return res.data;
  },

  downloadGstr2bCsv: async (batchId?: string): Promise<void> => {
    const res = await api.get('/tax/export-gstr2b', {
      params: { batch_id: batchId },
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `FINCTRL_GSTR2B_Reconciliation_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Dispute Recovery & Remediation Tracker
  updateDisputeStatus: async (
    exceptionId: string,
    payload: { status: string; dispute_reference?: string; recovered_amount?: number; notes?: string }
  ): Promise<any> => {
    const res = await api.post(`/exceptions/${exceptionId}/dispute-status`, payload);
    return res.data;
  },
};

export const reconciliationApi = apiService;



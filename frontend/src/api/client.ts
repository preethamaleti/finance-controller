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
};

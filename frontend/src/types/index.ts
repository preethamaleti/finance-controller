export interface ScenarioConfig {
  normal_pct: number;
  fee_mismatch_pct: number;
  refund_pct: number;
  delayed_settlement_pct: number;
  missing_settlement_pct: number;
  duplicate_record_pct: number;
  incorrect_amount_pct: number;
  complex_case_pct: number;
  unresolvable_pct: number;
}

export interface Dataset {
  id: string;
  name: string;
  record_count: number;
  created_at: string;
  scenario_config: Record<string, any>;
}

export interface BatchRun {
  id: string;
  dataset_id: string;
  status: string;
  records_total: number;
  records_processed: number;
  records_matched: number;
  records_exceptions: number;
  records_resolved: number;
  records_unresolved: number;
  total_value: number;
  matched_value: number;
  unresolved_exposure: number;
  deterministic_time_sec: number;
  ai_investigation_time_sec: number;
  total_time_sec: number;
  throughput_per_sec: number;
}

export interface ReconciliationItem {
  id: string;
  payment_id: string;
  transaction_id: string;
  payment_reference?: string;
  merchant_name: string;
  payment_amount: number;
  settlement_amount: number;
  refund_amount: number;
  fee_amount: number;
  accounted_amount: number;
  difference: number;
  status: string;
  match_level?: string;
  match_confidence: number;
  timestamp: string;
  has_exception: boolean;
  exception_id?: string;
}

export interface ExceptionItem {
  id: string;
  payment_id: string;
  transaction_id: string;
  merchant_name: string;
  exception_type: string;
  expected_amount: number;
  accounted_amount: number;
  difference: number;
  financial_exposure: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  priority_score: number;
  status: string;
  human_approval_required: boolean;
  human_approval_status: string;
  created_at: string;
  has_investigation: boolean;
}

export interface Investigation {
  id: string;
  exception_id: string;
  status: 'RESOLVED' | 'UNRESOLVED' | 'ESCALATED';
  root_cause?: string;
  financial_difference: number;
  explained_amount: number;
  confidence: number;
  evidence_records: Array<{
    type: string;
    reference?: string;
    amount?: number;
    fee_type?: string;
    reason?: string;
    [key: string]: any;
  }>;
  tools_called: string[];
  reasoning_summary: string;
  calculation_steps: string[];
  recommended_action?: string;
  duration_sec: number;
  investigated_at: string;
}

export interface ExceptionDetail extends ExceptionItem {
  payment_reference?: string;
  customer_id?: string;
  payment_method: string;
  payment_timestamp?: string;
  reconciliation_details?: Record<string, any>;
  investigation?: Investigation;
}

export interface FindTheMoneyCategory {
  category: string;
  amount: number;
  count: number;
  percentage: number;
  description: string;
}

export interface FindTheMoneyResponse {
  total_exposure: number;
  categories: FindTheMoneyCategory[];
}

export interface DashboardSummary {
  batch_id?: string;
  dataset_id?: string;
  total_records: number;
  total_transaction_value: number;
  match_rate: number;
  resolution_rate: number;
  unresolved_exposure: number;
  financial_accuracy: number;
  value_weighted_accuracy: number;
  throughput: number;
  critical_exceptions_count: number;
  status_counts: Record<string, number>;
  exposure_breakdown: FindTheMoneyResponse;
}

export interface EvaluationResult {
  batch_id: string;
  total_records: number;
  match_accuracy: number;
  exception_precision: number;
  exception_recall: number;
  f1_score: number;
  false_resolution_rate: number;
  unresolved_rate: number;
  total_financial_value: number;
  correctly_accounted_value: number;
  financial_accuracy: number;
  unexplained_exposure: number;
  value_weighted_accuracy: number;
  throughput_records_per_sec: number;
  deterministic_time_sec: number;
  ai_time_sec: number;
  total_time_sec: number;
  confusion_matrix: {
    TP: number;
    FP: number;
    FN: number;
    TN: number;
  };
  exception_distribution: Record<string, number>;
  unresolved_exceptions_report: Array<{
    exception_id: string;
    transaction_id: string;
    merchant_name: string;
    amount: number;
    exception_type: string;
    severity: string;
    reason: string;
  }>;
}

export interface CopilotResponse {
  answer: string;
  tools_used: Array<Record<string, any>>;
  citations: string[];
  metrics_context?: Record<string, any>;
}

export interface CashForecast {
  current_cash: number;
  projected_settlements_7d: number;
  projected_refunds_7d: number;
  projected_fees_7d: number;
  projected_cash_7d: number;
  projected_cash_30d: number;
  daily_forecast: Array<{
    day: number;
    date: string;
    projected_cash: number;
    inflow: number;
    outflow: number;
    net_change: number;
  }>;
  model_description: string;
}

export interface AnomalyAlert {
  id: string;
  metric: string;
  baseline_value: number;
  current_value: number;
  multiplier: number;
  severity: string;
  description: string;
  detected_at: string;
}

export interface AuditLog {
  id: string;
  batch_id?: string;
  transaction_id?: string;
  event_type: string;
  decision: string;
  tools_called: string[];
  confidence?: number;
  action_taken: string;
  timestamp: string;
}

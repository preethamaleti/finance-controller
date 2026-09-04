from decimal import Decimal
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

# Dataset Schemas
class ScenarioConfig(BaseModel):
    normal_pct: float = Field(default=70.0, description="Percentage of normal match cases")
    fee_mismatch_pct: float = Field(default=8.0, description="Fee discrepancy cases (resolvable)")
    refund_pct: float = Field(default=5.0, description="Refund accounted cases")
    delayed_settlement_pct: float = Field(default=4.0, description="Delayed settlement cases")
    missing_settlement_pct: float = Field(default=3.0, description="Missing settlement (unresolved)")
    duplicate_record_pct: float = Field(default=3.0, description="Duplicate settlement/payment")
    incorrect_amount_pct: float = Field(default=3.0, description="Incorrect settlement amount")
    complex_case_pct: float = Field(default=2.0, description="Complex multi-record cases (resolvable with investigation)")
    unresolvable_pct: float = Field(default=2.0, description="Intentionally unresolvable discrepancy")

class DatasetGenerateRequest(BaseModel):
    name: str = Field(default="Synthetic Batch", description="Dataset name")
    record_count: int = Field(default=500, ge=10, le=10000, description="Number of payment transactions to generate")
    scenarios: Optional[ScenarioConfig] = None
    seed: Optional[int] = Field(default=42, description="Random seed for reproducibility")

class DatasetResponse(BaseModel):
    id: str
    name: str
    record_count: int
    created_at: datetime
    scenario_config: Dict[str, Any]

    model_config = ConfigDict(from_attributes=True)

# Reconciliation Schemas
class ReconciliationRunRequest(BaseModel):
    dataset_id: str
    auto_investigate: bool = Field(default=True, description="Automatically run AI investigation on detected exceptions")
    max_investigations: Optional[int] = Field(default=50, description="Max exceptions to investigate with AI in batch")

class FinancialEquation(BaseModel):
    payment_amount: Decimal
    settlement_amount: Decimal
    refund_amount: Decimal
    fee_amount: Decimal
    tax_amount: Decimal
    other_adjustments: Decimal
    accounted_amount: Decimal
    difference: Decimal
    is_balanced: bool

class ReconciliationItemResponse(BaseModel):
    id: str
    payment_id: str
    transaction_id: str
    payment_reference: Optional[str] = None
    merchant_name: str
    payment_amount: Decimal
    settlement_amount: Decimal
    refund_amount: Decimal
    fee_amount: Decimal
    accounted_amount: Decimal
    difference: Decimal
    status: str
    match_level: Optional[str]
    match_confidence: float
    timestamp: datetime
    has_exception: bool
    exception_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# Exception Schemas
class ExceptionItemResponse(BaseModel):
    id: str
    payment_id: str
    transaction_id: str
    merchant_name: str
    exception_type: str
    expected_amount: Decimal
    accounted_amount: Decimal
    difference: Decimal
    financial_exposure: Decimal
    severity: str
    priority_score: float
    status: str
    human_approval_required: bool
    human_approval_status: str
    dispute_status: Optional[str] = "NOT_DISPUTED"
    recovered_amount: Optional[Decimal] = Decimal("0.00")
    created_at: datetime
    has_investigation: bool

    model_config = ConfigDict(from_attributes=True)

class InvestigationResponse(BaseModel):
    id: str
    exception_id: str
    status: str
    root_cause: Optional[str]
    financial_difference: Decimal
    explained_amount: Decimal
    confidence: float
    evidence_records: List[Dict[str, Any]]
    tools_called: List[str]
    reasoning_summary: str
    calculation_steps: List[str]
    recommended_action: Optional[str]
    duration_sec: float
    investigated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class HumanApprovalRequest(BaseModel):
    decision: str = Field(..., description="APPROVED or REJECTED")
    notes: Optional[str] = None

class DisputeStatusUpdateRequest(BaseModel):
    dispute_status: Optional[str] = None
    status: Optional[str] = None
    dispute_reference: Optional[str] = None
    recovered_amount: Optional[Decimal] = Decimal("0.00")
    notes: Optional[str] = None

    def get_effective_status(self) -> str:
        return self.dispute_status or self.status or "ESCALATED_TO_NODAL"


# Copilot Schemas
class CopilotQueryRequest(BaseModel):
    query: str
    batch_id: Optional[str] = None
    dataset_id: Optional[str] = None

class CopilotQueryResponse(BaseModel):
    answer: str
    tools_used: List[Dict[str, Any]]
    citations: List[str]
    metrics_context: Optional[Dict[str, Any]] = None
    structured_data: Optional[Any] = None
    action_result: Optional[Dict[str, Any]] = None


# Evaluation Schemas
class EvaluationResponse(BaseModel):
    batch_id: str
    total_records: int
    match_accuracy: float
    exception_precision: float
    exception_recall: float
    f1_score: float
    false_resolution_rate: float
    unresolved_rate: float
    total_financial_value: Decimal
    correctly_accounted_value: Decimal
    financial_accuracy: float
    unexplained_exposure: Decimal
    value_weighted_accuracy: float
    throughput_records_per_sec: float
    deterministic_time_sec: float
    ai_time_sec: float
    total_time_sec: float
    confusion_matrix: Dict[str, Any]
    exception_distribution: Dict[str, Any]
    unresolved_exceptions_report: List[Dict[str, Any]]

# Dashboard Schemas
class FindTheMoneyCategory(BaseModel):
    category: str
    amount: Decimal
    count: int
    percentage: float
    description: str

class FindTheMoneyResponse(BaseModel):
    total_exposure: Decimal
    categories: List[FindTheMoneyCategory]

class MetricExplanationResponse(BaseModel):
    metric_name: str
    value: str
    description: str
    formula: str
    contributing_factors: List[Dict[str, Any]]
    source_records_count: int

class DashboardSummaryResponse(BaseModel):
    batch_id: Optional[str]
    dataset_id: Optional[str]
    total_records: int
    total_transaction_value: Decimal
    match_rate: float
    resolution_rate: float
    unresolved_exposure: Decimal
    financial_accuracy: float
    value_weighted_accuracy: float
    throughput: float
    critical_exceptions_count: int
    status_counts: Dict[str, int]
    exposure_breakdown: FindTheMoneyResponse
    # Enriched evaluation fields exposed to UI
    match_accuracy: Optional[float] = None
    total_volume: Optional[Decimal] = None
    total_transactions: Optional[int] = None
    f1_score: Optional[float] = None
    false_resolution_rate: Optional[float] = None
    exception_precision: Optional[float] = None
    exception_recall: Optional[float] = None

# Cash Position & Forecasting Schemas
class CashPositionForecast(BaseModel):
    current_cash: Decimal
    projected_settlements_7d: Decimal
    projected_refunds_7d: Decimal
    projected_fees_7d: Decimal
    projected_cash_7d: Decimal
    projected_cash_30d: Decimal
    daily_forecast: List[Dict[str, Any]]
    model_description: str

# Anomaly Schemas
class AnomalyAlert(BaseModel):
    id: str
    metric: str
    baseline_value: Decimal
    current_value: Decimal
    multiplier: float
    severity: str
    description: str
    detected_at: datetime

# Audit Schemas
class AuditLogResponse(BaseModel):
    id: str
    batch_id: Optional[str]
    transaction_id: Optional[str]
    event_type: str
    decision: str
    tools_called: List[str]
    confidence: Optional[float]
    action_taken: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

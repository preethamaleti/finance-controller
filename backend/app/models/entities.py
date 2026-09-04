import datetime
from decimal import Decimal
from sqlalchemy import (
    Column, String, Integer, Numeric, DateTime, Boolean, ForeignKey, JSON, Text, Enum as SQLEnum, Index
)
from sqlalchemy.orm import relationship
from app.database import Base

class Merchant(Base):
    __tablename__ = "merchants"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), default="E-Commerce")
    risk_level = Column(String(50), default="LOW")
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.UTC))

    payments = relationship("Payment", back_populates="merchant")

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    record_count = Column(Integer, nullable=False)
    scenario_config = Column(JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.UTC))

    payments = relationship("Payment", back_populates="dataset", cascade="all, delete-orphan")
    settlements = relationship("Settlement", back_populates="dataset", cascade="all, delete-orphan")
    bank_transactions = relationship("BankTransaction", back_populates="dataset", cascade="all, delete-orphan")
    refunds = relationship("Refund", back_populates="dataset", cascade="all, delete-orphan")
    fees = relationship("Fee", back_populates="dataset", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="dataset", cascade="all, delete-orphan")
    ground_truths = relationship("GroundTruth", back_populates="dataset", cascade="all, delete-orphan")
    batch_runs = relationship("BatchRun", back_populates="dataset", cascade="all, delete-orphan")

class Payment(Base):
    __tablename__ = "payments"

    id = Column(String(64), primary_key=True)
    dataset_id = Column(String(64), ForeignKey("datasets.id"), nullable=False, index=True)
    transaction_id = Column(String(128), nullable=False, index=True)
    payment_reference = Column(String(128), index=True)
    merchant_id = Column(String(64), ForeignKey("merchants.id"), nullable=False, index=True)
    customer_id = Column(String(64), index=True)
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(10), default="INR")
    status = Column(String(50), default="CAPTURED")
    payment_method = Column(String(50), default="UPI")  # UPI, CARD, NETBANKING, WALLET
    timestamp = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.UTC))

    dataset = relationship("Dataset", back_populates="payments")
    merchant = relationship("Merchant", back_populates="payments")
    settlements = relationship("Settlement", back_populates="payment")
    refunds = relationship("Refund", back_populates="payment")
    fees = relationship("Fee", back_populates="payment")
    ground_truth = relationship("GroundTruth", back_populates="payment", uselist=False)

class Settlement(Base):
    __tablename__ = "settlements"

    id = Column(String(64), primary_key=True)
    dataset_id = Column(String(64), ForeignKey("datasets.id"), nullable=False, index=True)
    payment_id = Column(String(64), ForeignKey("payments.id"), nullable=True, index=True)
    settlement_reference = Column(String(128), index=True)
    transaction_id = Column(String(128), index=True)  # matching payment.transaction_id when matched
    bank_reference = Column(String(128), index=True)
    merchant_id = Column(String(64), ForeignKey("merchants.id"), nullable=False)
    gross_amount = Column(Numeric(15, 2), nullable=False)
    fee_amount = Column(Numeric(15, 2), default=Decimal("0.00"))
    tax_amount = Column(Numeric(15, 2), default=Decimal("0.00"))
    net_amount = Column(Numeric(15, 2), nullable=False)
    status = Column(String(50), default="SETTLED")
    settled_at = Column(DateTime, nullable=False, index=True)

    dataset = relationship("Dataset", back_populates="settlements")
    payment = relationship("Payment", back_populates="settlements")

class BankTransaction(Base):
    __tablename__ = "bank_transactions"

    id = Column(String(64), primary_key=True)
    dataset_id = Column(String(64), ForeignKey("datasets.id"), nullable=False, index=True)
    bank_reference = Column(String(128), nullable=False, index=True)
    settlement_reference = Column(String(128), index=True)
    payment_reference = Column(String(128), index=True)
    amount = Column(Numeric(15, 2), nullable=False)
    direction = Column(String(10), default="CR")  # CR (Credit) or DR (Debit)
    narrative = Column(Text)
    timestamp = Column(DateTime, nullable=False, index=True)

    dataset = relationship("Dataset", back_populates="bank_transactions")

class Refund(Base):
    __tablename__ = "refunds"

    id = Column(String(64), primary_key=True)
    dataset_id = Column(String(64), ForeignKey("datasets.id"), nullable=False, index=True)
    payment_id = Column(String(64), ForeignKey("payments.id"), nullable=True, index=True)
    refund_reference = Column(String(128), index=True)
    transaction_id = Column(String(128), index=True)
    amount = Column(Numeric(15, 2), nullable=False)
    status = Column(String(50), default="PROCESSED")
    reason = Column(String(255), default="CUSTOMER_REQUEST")
    refunded_at = Column(DateTime, nullable=False, index=True)

    dataset = relationship("Dataset", back_populates="refunds")
    payment = relationship("Payment", back_populates="refunds")

class Fee(Base):
    __tablename__ = "fees"

    id = Column(String(64), primary_key=True)
    dataset_id = Column(String(64), ForeignKey("datasets.id"), nullable=False, index=True)
    payment_id = Column(String(64), ForeignKey("payments.id"), nullable=True, index=True)
    fee_reference = Column(String(128), index=True)
    transaction_id = Column(String(128), index=True)
    fee_type = Column(String(50), default="MDR")  # MDR, INTERCHANGE, CONVENIENCE, GATEWAY
    base_amount = Column(Numeric(15, 2), nullable=False)
    tax_amount = Column(Numeric(15, 2), default=Decimal("0.00"))  # GST 18%
    total_amount = Column(Numeric(15, 2), nullable=False)
    calculated_at = Column(DateTime, nullable=False)

    dataset = relationship("Dataset", back_populates="fees")
    payment = relationship("Payment", back_populates="fees")

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String(64), primary_key=True)
    dataset_id = Column(String(64), ForeignKey("datasets.id"), nullable=False, index=True)
    payment_id = Column(String(64), ForeignKey("payments.id"), nullable=True, index=True)
    invoice_number = Column(String(128), index=True)
    merchant_id = Column(String(64), ForeignKey("merchants.id"), nullable=False)
    subtotal = Column(Numeric(15, 2), nullable=False)
    tax_total = Column(Numeric(15, 2), default=Decimal("0.00"))
    total_amount = Column(Numeric(15, 2), nullable=False)
    created_at = Column(DateTime, nullable=False)

    dataset = relationship("Dataset", back_populates="invoices")

class GroundTruth(Base):
    __tablename__ = "ground_truth"

    id = Column(String(64), primary_key=True)
    dataset_id = Column(String(64), ForeignKey("datasets.id"), nullable=False, index=True)
    payment_id = Column(String(64), ForeignKey("payments.id"), nullable=False, unique=True, index=True)
    scenario_type = Column(String(100), nullable=False)
    expected_status = Column(String(50), nullable=False) # MATCHED, MATCHED_WITH_ADJUSTMENT, RESOLVED_EXCEPTION, UNRESOLVED, INVALID_DATA
    expected_exception_type = Column(String(100), nullable=True)
    expected_root_cause = Column(String(255), nullable=True)
    is_resolvable = Column(Boolean, default=True)
    expected_difference = Column(Numeric(15, 2), default=Decimal("0.00"))
    ground_truth_details = Column(JSON, default=dict)

    dataset = relationship("Dataset", back_populates="ground_truths")
    payment = relationship("Payment", back_populates="ground_truth")

class BatchRun(Base):
    __tablename__ = "batch_runs"

    id = Column(String(64), primary_key=True)
    dataset_id = Column(String(64), ForeignKey("datasets.id"), nullable=False, index=True)
    status = Column(String(50), default="PENDING")  # PENDING, PROCESSING, COMPLETED, FAILED
    started_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.UTC))
    completed_at = Column(DateTime, nullable=True)
    
    records_total = Column(Integer, default=0)
    records_processed = Column(Integer, default=0)
    records_matched = Column(Integer, default=0)
    records_exceptions = Column(Integer, default=0)
    records_resolved = Column(Integer, default=0)
    records_unresolved = Column(Integer, default=0)
    
    total_value = Column(Numeric(15, 2), default=Decimal("0.00"))
    matched_value = Column(Numeric(15, 2), default=Decimal("0.00"))
    unresolved_exposure = Column(Numeric(15, 2), default=Decimal("0.00"))
    
    deterministic_time_sec = Column(Numeric(10, 4), default=Decimal("0.0000"))
    ai_investigation_time_sec = Column(Numeric(10, 4), default=Decimal("0.0000"))
    total_time_sec = Column(Numeric(10, 4), default=Decimal("0.0000"))
    throughput_per_sec = Column(Numeric(10, 2), default=Decimal("0.00"))

    dataset = relationship("Dataset", back_populates="batch_runs")
    reconciliation_results = relationship("ReconciliationResult", back_populates="batch_run", cascade="all, delete-orphan")
    exceptions = relationship("ExceptionRecord", back_populates="batch_run", cascade="all, delete-orphan")
    evaluation = relationship("EvaluationResult", back_populates="batch_run", uselist=False, cascade="all, delete-orphan")

class ReconciliationResult(Base):
    __tablename__ = "reconciliation_results"

    id = Column(String(64), primary_key=True)
    batch_id = Column(String(64), ForeignKey("batch_runs.id"), nullable=False, index=True)
    payment_id = Column(String(64), ForeignKey("payments.id"), nullable=False, index=True)
    
    status = Column(String(50), nullable=False) # MATCHED, MATCHED_WITH_ADJUSTMENT, RESOLVED_EXCEPTION, UNRESOLVED, INVALID_DATA
    match_level = Column(String(50), nullable=True) # LEVEL_1_EXACT_ID, LEVEL_2_REF, LEVEL_3_WINDOW, LEVEL_4_COMPOSITE, NO_MATCH
    match_confidence = Column(Numeric(5, 4), default=Decimal("0.0000"))
    
    payment_amount = Column(Numeric(15, 2), nullable=False)
    settlement_amount = Column(Numeric(15, 2), default=Decimal("0.00"))
    refund_amount = Column(Numeric(15, 2), default=Decimal("0.00"))
    fee_amount = Column(Numeric(15, 2), default=Decimal("0.00"))
    tax_amount = Column(Numeric(15, 2), default=Decimal("0.00"))
    other_adjustments = Column(Numeric(15, 2), default=Decimal("0.00"))
    accounted_amount = Column(Numeric(15, 2), default=Decimal("0.00"))
    difference = Column(Numeric(15, 2), default=Decimal("0.00"))
    
    financial_equation = Column(JSON, default=dict)
    matched_records = Column(JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.UTC))

    payment = relationship("Payment")
    batch_run = relationship("BatchRun", back_populates="reconciliation_results")
    exception_record = relationship("ExceptionRecord", back_populates="reconciliation_result", uselist=False)

class ExceptionRecord(Base):
    __tablename__ = "exceptions"

    id = Column(String(64), primary_key=True)
    batch_id = Column(String(64), ForeignKey("batch_runs.id"), nullable=False, index=True)
    reconciliation_result_id = Column(String(64), ForeignKey("reconciliation_results.id"), nullable=False, index=True)
    payment_id = Column(String(64), ForeignKey("payments.id"), nullable=False, index=True)
    
    exception_type = Column(String(100), nullable=False, index=True) # MISSING_SETTLEMENT, AMOUNT_MISMATCH, DUPLICATE_TRANSACTION, DUPLICATE_REFUND, FEE_MISMATCH, TAX_MISMATCH, DELAYED_SETTLEMENT, UNMATCHED_BANK_TRANSACTION, UNKNOWN_DISCREPANCY
    expected_amount = Column(Numeric(15, 2), nullable=False)
    accounted_amount = Column(Numeric(15, 2), nullable=False)
    difference = Column(Numeric(15, 2), nullable=False)
    financial_exposure = Column(Numeric(15, 2), nullable=False)
    
    severity = Column(String(20), default="MEDIUM") # CRITICAL, HIGH, MEDIUM, LOW
    priority_score = Column(Numeric(12, 2), default=Decimal("0.00"))
    status = Column(String(50), default="OPEN") # OPEN, INVESTIGATING, RESOLVED, UNRESOLVED, APPROVED, REJECTED
    
    human_approval_required = Column(Boolean, default=False)
    human_approval_status = Column(String(50), default="PENDING") # PENDING, APPROVED, REJECTED
    
    # Dispute Recovery Tracking
    dispute_status = Column(String(50), default="NOT_DISPUTED") # NOT_DISPUTED, ESCALATED_TO_NODAL, RECOVERED, REJECTED
    recovered_amount = Column(Numeric(15, 2), default=Decimal("0.00"))
    dispute_reference = Column(String(128), nullable=True)

    evidence = Column(JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.UTC))

    batch_run = relationship("BatchRun", back_populates="exceptions")
    reconciliation_result = relationship("ReconciliationResult", back_populates="exception_record")
    investigation = relationship("Investigation", back_populates="exception_record", uselist=False, cascade="all, delete-orphan")

class Investigation(Base):
    __tablename__ = "investigations"

    id = Column(String(64), primary_key=True)
    exception_id = Column(String(64), ForeignKey("exceptions.id"), nullable=False, unique=True, index=True)
    
    status = Column(String(50), nullable=False) # RESOLVED, UNRESOLVED, ESCALATED
    root_cause = Column(String(100), nullable=True) # PROCESSING_FEE, GST_TAX_ROUNDING, PARTIAL_REFUND, DELAYED_BATCH, UNKNOWN
    financial_difference = Column(Numeric(15, 2), default=Decimal("0.00"))
    explained_amount = Column(Numeric(15, 2), default=Decimal("0.00"))
    confidence = Column(Numeric(5, 4), default=Decimal("0.0000"))
    
    evidence_records = Column(JSON, default=list)
    tools_called = Column(JSON, default=list)
    reasoning_summary = Column(Text, nullable=False)
    calculation_steps = Column(JSON, default=list)
    recommended_action = Column(String(255), nullable=True)
    
    investigated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.UTC))
    duration_sec = Column(Numeric(8, 4), default=Decimal("0.0000"))

    exception_record = relationship("ExceptionRecord", back_populates="investigation")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(64), primary_key=True)
    batch_id = Column(String(64), ForeignKey("batch_runs.id"), nullable=True, index=True)
    exception_id = Column(String(64), ForeignKey("exceptions.id"), nullable=True, index=True)
    transaction_id = Column(String(128), index=True)
    
    event_type = Column(String(100), nullable=False) # RECONCILIATION_MATCH, EXCEPTION_DETECTED, AI_INVESTIGATION_COMPLETED, HUMAN_APPROVED, HUMAN_REJECTED
    decision = Column(String(50), nullable=False)
    evidence = Column(JSON, default=dict)
    tools_called = Column(JSON, default=list)
    financial_calculation = Column(JSON, default=dict)
    confidence = Column(Numeric(5, 4), nullable=True)
    action_taken = Column(String(255), nullable=False)
    user_id = Column(String(64), default="system")
    timestamp = Column(DateTime, default=lambda: datetime.datetime.now(datetime.UTC), index=True)

class EvaluationResult(Base):
    __tablename__ = "evaluation_results"

    id = Column(String(64), primary_key=True)
    batch_id = Column(String(64), ForeignKey("batch_runs.id"), nullable=False, unique=True, index=True)
    
    total_records = Column(Integer, nullable=False)
    match_accuracy = Column(Numeric(6, 3), nullable=False) # e.g. 96.400%
    exception_precision = Column(Numeric(6, 3), nullable=False)
    exception_recall = Column(Numeric(6, 3), nullable=False)
    f1_score = Column(Numeric(6, 3), nullable=False)
    
    false_resolution_rate = Column(Numeric(6, 3), default=Decimal("0.000"))
    unresolved_rate = Column(Numeric(6, 3), default=Decimal("0.000"))
    
    total_financial_value = Column(Numeric(18, 2), nullable=False)
    correctly_accounted_value = Column(Numeric(18, 2), nullable=False)
    financial_accuracy = Column(Numeric(6, 3), nullable=False)
    unexplained_exposure = Column(Numeric(18, 2), nullable=False)
    value_weighted_accuracy = Column(Numeric(6, 3), nullable=False)
    
    throughput_records_per_sec = Column(Numeric(10, 2), nullable=False)
    deterministic_time_sec = Column(Numeric(10, 4), nullable=False)
    ai_time_sec = Column(Numeric(10, 4), nullable=False)
    total_time_sec = Column(Numeric(10, 4), nullable=False)
    
    confusion_matrix = Column(JSON, default=dict)
    exception_distribution = Column(JSON, default=dict)
    unresolved_exceptions_report = Column(JSON, default=list)
    evaluated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.UTC))

    batch_run = relationship("BatchRun", back_populates="evaluation")


class DynamicMatchingRule(Base):
    __tablename__ = "dynamic_matching_rules"

    id = Column(String(64), primary_key=True)
    merchant_id = Column(String(64), ForeignKey("merchants.id"), nullable=True, index=True)
    rule_name = Column(String(255), nullable=False)
    rule_type = Column(String(100), nullable=False)  # CUSTOM_MDR_RATE, BANK_SETTLEMENT_WINDOW, REFUND_TIMING_TOLERANCE
    description = Column(Text, nullable=False)

    pattern_condition = Column(JSON, default=dict)  # e.g. {"merchant_id": "...", "custom_mdr_pct": 1.85, "payment_method": "UPI"}
    proposed_action = Column(JSON, default=dict)

    status = Column(String(50), default="SUGGESTED")  # SUGGESTED, ACTIVE, DISMISSED
    confidence = Column(Numeric(5, 4), default=Decimal("0.9200"))
    affected_records_count = Column(Integer, default=0)
    saved_exposure_inr = Column(Numeric(15, 2), default=Decimal("0.00"))

    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.UTC))
    approved_at = Column(DateTime, nullable=True)

    merchant = relationship("Merchant")


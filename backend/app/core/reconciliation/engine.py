import time
import uuid
import datetime
from decimal import Decimal
from typing import Dict, Any, List
from collections import defaultdict
from sqlalchemy.orm import Session

from app.models.entities import (
    Dataset, Payment, Settlement, BankTransaction,
    Refund, Fee, BatchRun, ReconciliationResult,
    ExceptionRecord, AuditLog
)
from app.core.reconciliation.matchers import MultiSourceMatcher
from app.core.reconciliation.accounting import FinancialAccountant
from app.core.reconciliation.exceptions import ExceptionClassifier

class ReconciliationEngine:
    @staticmethod
    def run_batch(
        db: Session,
        dataset_id: str,
        batch_id: str = None
    ) -> BatchRun:
        start_time = time.perf_counter()

        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")

        if not batch_id:
            batch_id = f"batch_{uuid.uuid4().hex[:10]}"

        batch_run = BatchRun(
            id=batch_id,
            dataset_id=dataset_id,
            status="PROCESSING",
            started_at=datetime.datetime.now(datetime.UTC),
            records_total=dataset.record_count
        )
        db.add(batch_run)
        db.commit()

        # Pre-fetch and index all records for maximum throughput (5000+ records in seconds)
        payments = db.query(Payment).filter(Payment.dataset_id == dataset_id).all()
        settlements = db.query(Settlement).filter(Settlement.dataset_id == dataset_id).all()
        bank_txns = db.query(BankTransaction).filter(BankTransaction.dataset_id == dataset_id).all()
        refunds = db.query(Refund).filter(Refund.dataset_id == dataset_id).all()
        fees = db.query(Fee).filter(Fee.dataset_id == dataset_id).all()

        settlements_by_txn_id = defaultdict(list)
        settlements_by_ref = defaultdict(list)
        for s in settlements:
            if s.transaction_id:
                settlements_by_txn_id[s.transaction_id].append(s)
            if s.payment_id:
                settlements_by_ref[s.payment_id].append(s)
            if s.settlement_reference:
                settlements_by_ref[s.settlement_reference].append(s)

        bank_txns_by_ref = defaultdict(list)
        bank_txns_by_pay_ref = defaultdict(list)
        for b in bank_txns:
            if b.bank_reference:
                bank_txns_by_ref[b.bank_reference].append(b)
            if b.settlement_reference:
                bank_txns_by_ref[b.settlement_reference].append(b)
            if b.payment_reference:
                bank_txns_by_pay_ref[b.payment_reference].append(b)

        refunds_by_txn_id = defaultdict(list)
        for r in refunds:
            if r.transaction_id:
                refunds_by_txn_id[r.transaction_id].append(r)
            if r.payment_id:
                refunds_by_txn_id[r.payment_id].append(r)

        fees_by_txn_id = defaultdict(list)
        for f in fees:
            if f.transaction_id:
                fees_by_txn_id[f.transaction_id].append(f)
            if f.payment_id:
                fees_by_txn_id[f.payment_id].append(f)

        recon_results_batch = []
        exceptions_batch = []
        audit_logs_batch = []

        total_value = Decimal("0.00")
        matched_value = Decimal("0.00")
        unresolved_exposure = Decimal("0.00")
        matched_count = 0
        exception_count = 0

        for payment in payments:
            total_value += payment.amount

            # 1. Match payment against settlement/bank/fee/refund sources
            match_res = MultiSourceMatcher.match_payment(
                payment=payment,
                settlements_by_txn_id=settlements_by_txn_id,
                settlements_by_ref=settlements_by_ref,
                all_settlements=settlements,
                bank_txns_by_ref=bank_txns_by_ref,
                bank_txns_by_pay_ref=bank_txns_by_pay_ref,
                refunds_by_txn_id=refunds_by_txn_id,
                fees_by_txn_id=fees_by_txn_id
            )

            # 2. Build financial equation
            equation = FinancialAccountant.calculate_equation(
                payment_amount=payment.amount,
                settlements=match_res.matched_settlements,
                refunds=match_res.matched_refunds,
                fees=match_res.matched_fees
            )

            recon_id = f"recon_{uuid.uuid4().hex[:12]}"
            
            # 3. Classify reconciliation status
            if equation.is_balanced:
                if equation.fee_amount > Decimal("0.00") or equation.refund_amount > Decimal("0.00"):
                    status = "MATCHED_WITH_ADJUSTMENT"
                else:
                    status = "MATCHED"
                matched_count += 1
                matched_value += payment.amount
            else:
                status = "OPEN_EXCEPTION"
                exception_count += 1

            recon_result = ReconciliationResult(
                id=recon_id,
                batch_id=batch_id,
                payment_id=payment.id,
                status=status,
                match_level=match_res.level,
                match_confidence=Decimal(str(round(match_res.confidence, 4))),
                payment_amount=payment.amount,
                settlement_amount=equation.settlement_amount,
                refund_amount=equation.refund_amount,
                fee_amount=equation.fee_amount,
                tax_amount=equation.tax_amount,
                other_adjustments=equation.other_adjustments,
                accounted_amount=equation.accounted_amount,
                difference=equation.difference,
                financial_equation=equation.model_dump(mode="json"),
                matched_records={
                    "settlements_count": len(match_res.matched_settlements),
                    "bank_txns_count": len(match_res.matched_bank_txns),
                    "refunds_count": len(match_res.matched_refunds),
                    "fees_count": len(match_res.matched_fees),
                }
            )
            recon_results_batch.append(recon_result)

            # 4. If unbalanced, register Exception
            if not equation.is_balanced:
                (
                    exc_type,
                    severity,
                    exposure,
                    p_score,
                    hitl_req,
                    hitl_status
                ) = ExceptionClassifier.classify_and_score(
                    payment=payment,
                    match_result=match_res,
                    equation=equation
                )

                unresolved_exposure += exposure
                exc_id = f"exc_{uuid.uuid4().hex[:12]}"
                
                exc_rec = ExceptionRecord(
                    id=exc_id,
                    batch_id=batch_id,
                    reconciliation_result_id=recon_id,
                    payment_id=payment.id,
                    exception_type=exc_type,
                    expected_amount=payment.amount,
                    accounted_amount=equation.accounted_amount,
                    difference=equation.difference,
                    financial_exposure=exposure,
                    severity=severity,
                    priority_score=p_score,
                    status="OPEN",
                    human_approval_required=hitl_req,
                    human_approval_status=hitl_status,
                    evidence={
                        "matched_level": match_res.level,
                        "matched_settlements": [s.settlement_reference for s in match_res.matched_settlements if s.settlement_reference],
                        "matched_bank_txns": [b.bank_reference for b in match_res.matched_bank_txns if b.bank_reference]
                    }
                )
                exceptions_batch.append(exc_rec)

                audit_log = AuditLog(
                    id=f"aud_{uuid.uuid4().hex[:12]}",
                    batch_id=batch_id,
                    exception_id=exc_id,
                    transaction_id=payment.transaction_id,
                    event_type="EXCEPTION_DETECTED",
                    decision="FLAGGED_FOR_INVESTIGATION",
                    evidence={"difference": str(equation.difference), "exposure": str(exposure)},
                    tools_called=[],
                    financial_calculation=equation.model_dump(mode="json"),
                    confidence=Decimal(str(match_res.confidence)),
                    action_taken=f"Exception {exc_type} generated with severity {severity}"
                )
                audit_logs_batch.append(audit_log)

        # Save all results to database
        db.bulk_save_objects(recon_results_batch)
        db.bulk_save_objects(exceptions_batch)
        db.bulk_save_objects(audit_logs_batch)

        elapsed_sec = time.perf_counter() - start_time
        throughput = len(payments) / max(elapsed_sec, 0.001)

        batch_run.status = "RECONCILED"
        batch_run.completed_at = datetime.datetime.now(datetime.UTC)
        batch_run.records_processed = len(payments)
        batch_run.records_matched = matched_count
        batch_run.records_exceptions = exception_count
        batch_run.total_value = total_value
        batch_run.matched_value = matched_value
        batch_run.unresolved_exposure = unresolved_exposure
        batch_run.deterministic_time_sec = Decimal(str(round(elapsed_sec, 4)))
        batch_run.total_time_sec = Decimal(str(round(elapsed_sec, 4)))
        batch_run.throughput_per_sec = Decimal(str(round(throughput, 2)))
        
        db.commit()
        db.refresh(batch_run)
        return batch_run

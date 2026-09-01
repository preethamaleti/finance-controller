import uuid
import datetime
from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from app.models.entities import (
    BatchRun, ReconciliationResult, ExceptionRecord,
    Investigation, GroundTruth, Payment, EvaluationResult
)

class EvaluationEngine:
    @staticmethod
    def evaluate_batch(db: Session, batch_id: str) -> EvaluationResult:
        batch_run = db.query(BatchRun).filter(BatchRun.id == batch_id).first()
        if not batch_run:
            raise ValueError(f"BatchRun {batch_id} not found")

        # Fetch ground truths for this dataset
        ground_truths = db.query(GroundTruth).filter(GroundTruth.dataset_id == batch_run.dataset_id).all()
        gt_map = {gt.payment_id: gt for gt in ground_truths}

        recon_results = db.query(ReconciliationResult).filter(ReconciliationResult.batch_id == batch_id).all()
        exceptions = db.query(ExceptionRecord).filter(ExceptionRecord.batch_id == batch_id).all()
        exc_map = {e.payment_id: e for e in exceptions}

        investigations = db.query(Investigation).join(ExceptionRecord).filter(ExceptionRecord.batch_id == batch_id).all()
        inv_map = {inv.exception_record.payment_id: inv for inv in investigations}

        total_records = len(recon_results)
        if total_records == 0:
            raise ValueError(f"No reconciliation results found for batch {batch_id}")

        # Metrics accumulator
        correct_matches = 0
        true_positives = 0   # Ground truth exception detected as exception
        false_positives = 0  # Ground truth normal flagged as exception
        false_negatives = 0  # Ground truth exception marked as clean match
        true_negatives = 0   # Ground truth normal marked as clean match
        false_resolutions = 0 # Ground truth unresolvable resolved incorrectly

        total_value = Decimal("0.00")
        correctly_accounted_value = Decimal("0.00")
        unexplained_exposure = Decimal("0.00")

        confusion_matrix = {
            "TP": 0, "FP": 0, "FN": 0, "TN": 0
        }
        exception_distribution = {}
        unresolved_report = []

        payments = db.query(Payment).filter(Payment.dataset_id == batch_run.dataset_id).all()
        payment_map = {p.id: p for p in payments}

        for res in recon_results:
            gt = gt_map.get(res.payment_id)
            exc = exc_map.get(res.payment_id)
            inv = inv_map.get(res.payment_id) if exc else None
            payment_obj = payment_map.get(res.payment_id)

            total_value += res.payment_amount

            # Determine final system classification
            if exc:
                if inv and inv.status == "RESOLVED":
                    sys_status = "RESOLVED_EXCEPTION"
                else:
                    sys_status = "UNRESOLVED"
                    unexplained_exposure += exc.financial_exposure
                    
                    unresolved_report.append({
                        "exception_id": exc.id,
                        "transaction_id": payment_obj.transaction_id if payment_obj else res.payment_id,
                        "merchant_name": payment_obj.merchant.name if (payment_obj and payment_obj.merchant) else "N/A",
                        "amount": float(exc.financial_exposure),
                        "exception_type": exc.exception_type,
                        "severity": exc.severity,
                        "reason": inv.reasoning_summary if inv else "Pending AI / Manual Investigation"
                    })
                
                # Accumulate distribution
                exception_distribution[exc.exception_type] = exception_distribution.get(exc.exception_type, 0) + 1
            else:
                sys_status = res.status

            if not gt:
                # If ground truth not found, fallback to internal consistency
                if res.status in ["MATCHED", "MATCHED_WITH_ADJUSTMENT"]:
                    correct_matches += 1
                    correctly_accounted_value += res.payment_amount
                continue

            gt_is_normal = gt.expected_status in ["MATCHED", "MATCHED_WITH_ADJUSTMENT"]
            sys_is_normal = sys_status in ["MATCHED", "MATCHED_WITH_ADJUSTMENT"]

            if gt_is_normal and sys_is_normal:
                true_negatives += 1
                correct_matches += 1
                correctly_accounted_value += res.payment_amount
            elif not gt_is_normal and not sys_is_normal:
                true_positives += 1
                # Check if resolvable accuracy matched
                if gt.is_resolvable and sys_status == "RESOLVED_EXCEPTION":
                    correct_matches += 1
                    correctly_accounted_value += res.payment_amount
                elif not gt.is_resolvable and sys_status == "UNRESOLVED":
                    correct_matches += 1
                    # Honest unresolution is fully counted as correct accounting behavior!
                    correctly_accounted_value += (res.payment_amount - exc.financial_exposure)
                elif not gt.is_resolvable and sys_status == "RESOLVED_EXCEPTION":
                    false_resolutions += 1
            elif gt_is_normal and not sys_is_normal:
                false_positives += 1
            elif not gt_is_normal and sys_is_normal:
                false_negatives += 1

        confusion_matrix = {
            "TP": true_positives,
            "FP": false_positives,
            "FN": false_negatives,
            "TN": true_negatives
        }

        # Calculate Statistical Metrics
        match_accuracy = (correct_matches / total_records) * 100.0 if total_records > 0 else 0.0
        precision = (true_positives / (true_positives + false_positives)) * 100.0 if (true_positives + false_positives) > 0 else 100.0
        recall = (true_positives / (true_positives + false_negatives)) * 100.0 if (true_positives + false_negatives) > 0 else 100.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        
        false_res_rate = (false_resolutions / max(len(exceptions), 1)) * 100.0
        unresolved_rate = (len(unresolved_report) / total_records) * 100.0

        # Calculate Financial Metrics
        financial_accuracy = (float(correctly_accounted_value) / float(total_value)) * 100.0 if total_value > 0 else 100.0
        value_weighted_accuracy = round(financial_accuracy, 3)

        # Operational Metrics
        total_time = float(batch_run.total_time_sec) if batch_run.total_time_sec else 1.0
        throughput = float(batch_run.throughput_per_sec) if batch_run.throughput_per_sec else (total_records / total_time)

        # Existing evaluation check
        existing_eval = db.query(EvaluationResult).filter(EvaluationResult.batch_id == batch_id).first()
        if existing_eval:
            db.delete(existing_eval)
            db.commit()

        eval_result = EvaluationResult(
            id=f"eval_{uuid.uuid4().hex[:12]}",
            batch_id=batch_id,
            total_records=total_records,
            match_accuracy=Decimal(str(round(match_accuracy, 3))),
            exception_precision=Decimal(str(round(precision, 3))),
            exception_recall=Decimal(str(round(recall, 3))),
            f1_score=Decimal(str(round(f1, 3))),
            false_resolution_rate=Decimal(str(round(false_res_rate, 3))),
            unresolved_rate=Decimal(str(round(unresolved_rate, 3))),
            total_financial_value=total_value,
            correctly_accounted_value=correctly_accounted_value,
            financial_accuracy=Decimal(str(round(financial_accuracy, 3))),
            unexplained_exposure=unexplained_exposure,
            value_weighted_accuracy=Decimal(str(round(value_weighted_accuracy, 3))),
            throughput_records_per_sec=Decimal(str(round(throughput, 2))),
            deterministic_time_sec=batch_run.deterministic_time_sec,
            ai_time_sec=batch_run.ai_investigation_time_sec,
            total_time_sec=batch_run.total_time_sec,
            confusion_matrix=confusion_matrix,
            exception_distribution=exception_distribution,
            unresolved_exceptions_report=unresolved_report,
            evaluated_at=datetime.datetime.now(datetime.UTC)
        )

        db.add(eval_result)
        db.commit()
        db.refresh(eval_result)
        return eval_result

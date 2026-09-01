from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.entities import BatchRun, ReconciliationResult, ExceptionRecord, Payment, Merchant
from app.schemas.schemas import ReconciliationRunRequest, ReconciliationItemResponse
from app.core.reconciliation.engine import ReconciliationEngine
from app.core.ai.investigator import AIInvestigator
from app.core.evaluation.engine import EvaluationEngine

router = APIRouter(prefix="/reconciliation", tags=["Reconciliation"])

@router.post("/run")
def run_reconciliation(req: ReconciliationRunRequest, db: Session = Depends(get_db)):
    try:
        # 1. Deterministic reconciliation pass
        batch_run = ReconciliationEngine.run_batch(
            db=db,
            dataset_id=req.dataset_id
        )

        # 2. Optional batch AI investigation pass
        if req.auto_investigate:
            exceptions = db.query(ExceptionRecord).filter(
                ExceptionRecord.batch_id == batch_run.id
            ).limit(req.max_investigations or 50).all()

            for exc in exceptions:
                AIInvestigator.investigate_exception(db=db, exception_id=exc.id)

        # 3. Batch Evaluation against hidden Ground Truth
        eval_res = EvaluationEngine.evaluate_batch(db=db, batch_id=batch_run.id)

        db.refresh(batch_run)
        return {
            "batch_id": batch_run.id,
            "status": batch_run.status,
            "records_total": batch_run.records_total,
            "records_processed": batch_run.records_processed,
            "records_matched": batch_run.records_matched,
            "records_exceptions": batch_run.records_exceptions,
            "records_resolved": batch_run.records_resolved,
            "records_unresolved": batch_run.records_unresolved,
            "total_value": float(batch_run.total_value),
            "matched_value": float(batch_run.matched_value),
            "unresolved_exposure": float(batch_run.unresolved_exposure),
            "deterministic_time_sec": float(batch_run.deterministic_time_sec),
            "ai_investigation_time_sec": float(batch_run.ai_investigation_time_sec),
            "total_time_sec": float(batch_run.total_time_sec),
            "throughput_per_sec": float(batch_run.throughput_per_sec),
            "match_accuracy": float(eval_res.match_accuracy),
            "value_weighted_accuracy": float(eval_res.value_weighted_accuracy)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{batch_id}")
def get_batch_status(batch_id: str, db: Session = Depends(get_db)):
    batch_run = db.query(BatchRun).filter(BatchRun.id == batch_id).first()
    if not batch_run:
        raise HTTPException(status_code=404, detail="Batch run not found")
    
    return {
        "id": batch_run.id,
        "dataset_id": batch_run.dataset_id,
        "status": batch_run.status,
        "records_total": batch_run.records_total,
        "records_processed": batch_run.records_processed,
        "records_matched": batch_run.records_matched,
        "records_exceptions": batch_run.records_exceptions,
        "records_resolved": batch_run.records_resolved,
        "records_unresolved": batch_run.records_unresolved,
        "total_value": float(batch_run.total_value),
        "matched_value": float(batch_run.matched_value),
        "unresolved_exposure": float(batch_run.unresolved_exposure),
        "deterministic_time_sec": float(batch_run.deterministic_time_sec),
        "ai_investigation_time_sec": float(batch_run.ai_investigation_time_sec),
        "total_time_sec": float(batch_run.total_time_sec),
        "throughput_per_sec": float(batch_run.throughput_per_sec)
    }

@router.get("/{batch_id}/items", response_model=List[ReconciliationItemResponse])
def get_batch_items(
    batch_id: str,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(ReconciliationResult).join(Payment).filter(ReconciliationResult.batch_id == batch_id)

    if status and status != "ALL":
        if status == "MATCHED":
            query = query.filter(ReconciliationResult.status.in_(["MATCHED", "MATCHED_WITH_ADJUSTMENT"]))
        elif status == "EXCEPTION":
            query = query.filter(ReconciliationResult.status == "OPEN_EXCEPTION")
        else:
            query = query.filter(ReconciliationResult.status == status)

    if search:
        query = query.filter(
            (Payment.transaction_id.ilike(f"%{search}%")) |
            (Payment.payment_reference.ilike(f"%{search}%"))
        )

    results = query.order_by(ReconciliationResult.difference.desc()).offset(offset).limit(limit).all()

    items = []
    for r in results:
        payment = db.query(Payment).filter(Payment.id == r.payment_id).first()
        merchant = db.query(Merchant).filter(Merchant.id == payment.merchant_id).first() if payment else None
        exc = db.query(ExceptionRecord).filter(ExceptionRecord.reconciliation_result_id == r.id).first()

        items.append(ReconciliationItemResponse(
            id=r.id,
            payment_id=r.payment_id,
            transaction_id=payment.transaction_id if payment else "N/A",
            payment_reference=payment.payment_reference if payment else None,
            merchant_name=merchant.name if merchant else "Unknown Merchant",
            payment_amount=r.payment_amount,
            settlement_amount=r.settlement_amount,
            refund_amount=r.refund_amount,
            fee_amount=r.fee_amount,
            accounted_amount=r.accounted_amount,
            difference=r.difference,
            status=r.status,
            match_level=r.match_level,
            match_confidence=float(r.match_confidence),
            timestamp=payment.timestamp if payment else r.created_at,
            has_exception=exc is not None,
            exception_id=exc.id if exc else None
        ))

    return items

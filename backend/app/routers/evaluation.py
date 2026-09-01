from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.entities import BatchRun, EvaluationResult
from app.schemas.schemas import EvaluationResponse
from app.core.evaluation.engine import EvaluationEngine

router = APIRouter(prefix="/evaluation", tags=["Evaluation"])

@router.get("/{batch_id}", response_model=EvaluationResponse)
def get_evaluation(batch_id: str, db: Session = Depends(get_db)):
    eval_res = db.query(EvaluationResult).filter(EvaluationResult.batch_id == batch_id).first()
    if not eval_res:
        # Generate on the fly if needed
        try:
            eval_res = EvaluationEngine.evaluate_batch(db=db, batch_id=batch_id)
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Could not evaluate batch {batch_id}: {str(e)}")

    return EvaluationResponse(
        batch_id=eval_res.batch_id,
        total_records=eval_res.total_records,
        match_accuracy=float(eval_res.match_accuracy),
        exception_precision=float(eval_res.exception_precision),
        exception_recall=float(eval_res.exception_recall),
        f1_score=float(eval_res.f1_score),
        false_resolution_rate=float(eval_res.false_resolution_rate),
        unresolved_rate=float(eval_res.unresolved_rate),
        total_financial_value=eval_res.total_financial_value,
        correctly_accounted_value=eval_res.correctly_accounted_value,
        financial_accuracy=float(eval_res.financial_accuracy),
        unexplained_exposure=eval_res.unexplained_exposure,
        value_weighted_accuracy=float(eval_res.value_weighted_accuracy),
        throughput_records_per_sec=float(eval_res.throughput_records_per_sec),
        deterministic_time_sec=float(eval_res.deterministic_time_sec),
        ai_time_sec=float(eval_res.ai_time_sec),
        total_time_sec=float(eval_res.total_time_sec),
        confusion_matrix=eval_res.confusion_matrix,
        exception_distribution=eval_res.exception_distribution,
        unresolved_exceptions_report=eval_res.unresolved_exceptions_report
    )

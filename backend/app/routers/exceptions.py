from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.entities import ExceptionRecord, Investigation, Payment, Merchant, AuditLog, ReconciliationResult
from app.schemas.schemas import ExceptionItemResponse, InvestigationResponse, HumanApprovalRequest
from app.core.ai.investigator import AIInvestigator

router = APIRouter(prefix="/exceptions", tags=["Exceptions"])

@router.get("", response_model=List[ExceptionItemResponse])
def list_exceptions(
    batch_id: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    exception_type: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(ExceptionRecord).join(Payment)

    if batch_id:
        query = query.filter(ExceptionRecord.batch_id == batch_id)
    if severity and severity != "ALL":
        query = query.filter(ExceptionRecord.severity == severity)
    if status and status != "ALL":
        query = query.filter(ExceptionRecord.status == status)
    if exception_type and exception_type != "ALL":
        query = query.filter(ExceptionRecord.exception_type == exception_type)

    exceptions = query.order_by(ExceptionRecord.priority_score.desc()).offset(offset).limit(limit).all()

    items = []
    for e in exceptions:
        payment = db.query(Payment).filter(Payment.id == e.payment_id).first()
        merchant = db.query(Merchant).filter(Merchant.id == payment.merchant_id).first() if payment else None
        inv = db.query(Investigation).filter(Investigation.exception_id == e.id).first()

        items.append(ExceptionItemResponse(
            id=e.id,
            payment_id=e.payment_id,
            transaction_id=payment.transaction_id if payment else "N/A",
            merchant_name=merchant.name if merchant else "Unknown Merchant",
            exception_type=e.exception_type,
            expected_amount=e.expected_amount,
            accounted_amount=e.accounted_amount,
            difference=e.difference,
            financial_exposure=e.financial_exposure,
            severity=e.severity,
            priority_score=float(e.priority_score),
            status=e.status,
            human_approval_required=e.human_approval_required,
            human_approval_status=e.human_approval_status,
            created_at=e.created_at,
            has_investigation=inv is not None
        ))

    return items

@router.get("/{exception_id}")
def get_exception_detail(exception_id: str, db: Session = Depends(get_db)):
    e = db.query(ExceptionRecord).filter(ExceptionRecord.id == exception_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Exception not found")

    payment = db.query(Payment).filter(Payment.id == e.payment_id).first()
    merchant = db.query(Merchant).filter(Merchant.id == payment.merchant_id).first() if payment else None
    inv = db.query(Investigation).filter(Investigation.exception_id == e.id).first()
    recon = db.query(ReconciliationResult).filter(ReconciliationResult.id == e.reconciliation_result_id).first()

    return {
        "id": e.id,
        "batch_id": e.batch_id,
        "payment_id": e.payment_id,
        "transaction_id": payment.transaction_id if payment else "N/A",
        "payment_reference": payment.payment_reference if payment else None,
        "customer_id": payment.customer_id if payment else None,
        "merchant_name": merchant.name if merchant else "Unknown",
        "payment_method": payment.payment_method if payment else "UPI",
        "payment_timestamp": payment.timestamp.isoformat() if payment and payment.timestamp else None,
        "exception_type": e.exception_type,
        "expected_amount": float(e.expected_amount),
        "accounted_amount": float(e.accounted_amount),
        "difference": float(e.difference),
        "financial_exposure": float(e.financial_exposure),
        "severity": e.severity,
        "priority_score": float(e.priority_score),
        "status": e.status,
        "human_approval_required": e.human_approval_required,
        "human_approval_status": e.human_approval_status,
        "created_at": e.created_at.isoformat(),
        "reconciliation_details": recon.financial_equation if recon else {},
        "investigation": {
            "id": inv.id,
            "status": inv.status,
            "root_cause": inv.root_cause,
            "financial_difference": float(inv.financial_difference),
            "explained_amount": float(inv.explained_amount),
            "confidence": float(inv.confidence),
            "evidence_records": inv.evidence_records,
            "tools_called": inv.tools_called,
            "reasoning_summary": inv.reasoning_summary,
            "calculation_steps": inv.calculation_steps,
            "recommended_action": inv.recommended_action,
            "duration_sec": float(inv.duration_sec),
            "investigated_at": inv.investigated_at.isoformat()
        } if inv else None
    }

@router.post("/{exception_id}/investigate", response_model=InvestigationResponse)
def trigger_investigation(exception_id: str, db: Session = Depends(get_db)):
    try:
        inv = AIInvestigator.investigate_exception(db=db, exception_id=exception_id)
        return inv
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{exception_id}/approve")
def approve_exception(exception_id: str, req: HumanApprovalRequest, db: Session = Depends(get_db)):
    e = db.query(ExceptionRecord).filter(ExceptionRecord.id == exception_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Exception not found")

    e.human_approval_status = req.decision
    if req.decision == "APPROVED":
        e.status = "RESOLVED"
    else:
        e.status = "REJECTED"

    audit = AuditLog(
        id=f"aud_hitl_{exception_id}",
        batch_id=e.batch_id,
        exception_id=e.id,
        event_type="HUMAN_APPROVAL_DECISION",
        decision=req.decision,
        evidence={"notes": req.notes},
        tools_called=[],
        action_taken=f"Finance Officer {req.decision.lower()} exception with note: {req.notes or 'None'}"
    )
    db.add(audit)
    db.commit()

    return {"message": f"Exception {exception_id} marked {req.decision}", "status": e.status}

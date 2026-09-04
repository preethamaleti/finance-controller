import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal

from app.database import get_db
from app.models.entities import ExceptionRecord, Investigation, Payment, Merchant, AuditLog, ReconciliationResult
from app.schemas.schemas import ExceptionItemResponse, InvestigationResponse, HumanApprovalRequest, DisputeStatusUpdateRequest
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
            dispute_status=e.dispute_status or "NOT_DISPUTED",
            recovered_amount=e.recovered_amount or Decimal("0.00"),
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
        "dispute_status": e.dispute_status or "NOT_DISPUTED",
        "recovered_amount": float(e.recovered_amount or 0.0),
        "dispute_reference": e.dispute_reference,
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

@router.get("/{exception_id}/pdf")
def download_exception_pdf(exception_id: str, db: Session = Depends(get_db)):
    from fastapi.responses import Response
    from app.services.pdf_report import generate_exception_pdf_report
    
    e = db.query(ExceptionRecord).filter(ExceptionRecord.id == exception_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Exception not found")

    payment = db.query(Payment).filter(Payment.id == e.payment_id).first()
    merchant = db.query(Merchant).filter(Merchant.id == payment.merchant_id).first() if payment else None
    inv = db.query(Investigation).filter(Investigation.exception_id == e.id).first()
    recon = db.query(ReconciliationResult).filter(ReconciliationResult.id == e.reconciliation_result_id).first()

    data = {
        "id": e.id,
        "batch_id": e.batch_id,
        "payment_id": e.payment_id,
        "transaction_id": payment.transaction_id if payment else "N/A",
        "payment_reference": payment.payment_reference if payment else None,
        "customer_id": payment.customer_id if payment else None,
        "merchant_name": merchant.name if merchant else "Unknown",
        "payment_method": payment.payment_method if payment else "UPI",
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
        } if inv else None
    }

    audit_logs = db.query(AuditLog).filter(AuditLog.exception_id == e.id).all()
    pdf_bytes = generate_exception_pdf_report(data, audit_logs)

    filename = f"FINCTRL_Evidence_{e.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@router.get("/{exception_id}/dispute-packet")
def get_dispute_packet(exception_id: str, db: Session = Depends(get_db)):
    """
    Returns pre-drafted legal & banking escalation metadata, email draft,
    and dispute particulars for submitting to payment aggregator / bank nodal desks.
    """
    e = db.query(ExceptionRecord).filter(ExceptionRecord.id == exception_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Exception not found")

    payment = db.query(Payment).filter(Payment.id == e.payment_id).first()
    merchant = db.query(Merchant).filter(Merchant.id == payment.merchant_id).first() if payment else None
    inv = db.query(Investigation).filter(Investigation.exception_id == e.id).first()

    txn_id = payment.transaction_id if payment else "N/A"
    order_ref = payment.payment_reference if payment else "N/A"
    merchant_name = merchant.name if merchant else "Merchant Partner"
    exposure = float(e.financial_exposure)
    exp_amt = float(e.expected_amount)
    act_amt = float(e.accounted_amount)
    root_cause = inv.root_cause if inv else "UNEXPLAINED_GATEWAY_SHORTAGE"

    subject = f"[URGENT DISPUTE] Settlement Variance of ₹{exposure:,.2f} - Txn {txn_id} (Merchant: {merchant_name})"
    email_body = (
        f"To: Nodal Dispute Operations / Razorpay Merchant Grievance Cell\n\n"
        f"Subject: {subject}\n\n"
        f"Dear Dispute Settlement Team,\n\n"
        f"We are issuing this formal notice of discrepancy regarding an unremitted settlement balance for the following captured transaction:\n\n"
        f"• Transaction Gateway ID: {txn_id}\n"
        f"• Merchant Order ID: {order_ref}\n"
        f"• Merchant Name: {merchant_name}\n"
        f"• Payment Status: CAPTURED by customer\n"
        f"• Gross Customer Captured Amount: ₹{exp_amt:,.2f}\n"
        f"• Net Payout Received: ₹{act_amt:,.2f}\n"
        f"• Disputed Net Rupee Exposure: ₹{exposure:,.2f}\n"
        f"• Identified Discrepancy Category: {e.exception_type} ({root_cause})\n\n"
        f"Audit Verification Summary:\n"
        f"Our autonomous double-entry reconciliation engine verified all MDR schedules, tax invoices, and refund files. "
        f"No authorized interchange fee or credit memo corresponds to the deduction of ₹{exposure:,.2f}.\n\n"
        f"Remediation Demanded:\n"
        f"Under regulatory payment aggregator settlement directives, please credit the outstanding shortage of ₹{exposure:,.2f} "
        f"to our designated settlement bank account within 5 business days, or furnish an itemized adjustment UTR statement.\n\n"
        f"Attached: Official Audit Evidence & Dispute Notice (FINCTRL Autonomous Financial Dossier #{e.id}).\n\n"
        f"Sincerely,\n"
        f"Treasury & Financial Operations Team\n"
        f"{merchant_name}"
    )

    return {
        "exception_id": e.id,
        "transaction_id": txn_id,
        "order_reference": order_ref,
        "merchant_name": merchant_name,
        "disputed_exposure": exposure,
        "expected_amount": exp_amt,
        "accounted_amount": act_amt,
        "exception_type": e.exception_type,
        "recipient_email": "disputes@razorpay.com, nodalofficer@acquirerbank.in",
        "email_subject": subject,
        "email_body": email_body,
        "pdf_download_url": f"/api/exceptions/{e.id}/dispute-pdf",
        "dispute_status": e.dispute_status or "NOT_DISPUTED",
        "dispute_reference": e.dispute_reference,
        "recovered_amount": float(e.recovered_amount or 0.0)
    }

@router.get("/{exception_id}/dispute-pdf")
def download_dispute_notice_pdf(exception_id: str, db: Session = Depends(get_db)):
    """
    Downloads formal legal Notice of Financial Discrepancy & Chargeback Dispute PDF.
    """
    from fastapi.responses import Response
    from app.services.pdf_report import generate_dispute_notice_pdf

    e = db.query(ExceptionRecord).filter(ExceptionRecord.id == exception_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Exception not found")

    payment = db.query(Payment).filter(Payment.id == e.payment_id).first()
    merchant = db.query(Merchant).filter(Merchant.id == payment.merchant_id).first() if payment else None
    inv = db.query(Investigation).filter(Investigation.exception_id == e.id).first()

    data = {
        "id": e.id,
        "transaction_id": payment.transaction_id if payment else "N/A",
        "payment_reference": payment.payment_reference if payment else None,
        "merchant_name": merchant.name if merchant else "Merchant Partner",
        "exception_type": e.exception_type,
        "expected_amount": float(e.expected_amount),
        "accounted_amount": float(e.accounted_amount),
        "difference": float(e.difference),
        "financial_exposure": float(e.financial_exposure),
        "severity": e.severity,
        "status": e.status,
        "investigation": {
            "root_cause": inv.root_cause if inv else "UNEXPLAINED_GATEWAY_SHORTAGE",
            "reasoning_summary": inv.reasoning_summary if inv else None
        }
    }

    pdf_bytes = generate_dispute_notice_pdf(data)
    filename = f"FINCTRL_Dispute_Notice_{e.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@router.post("/{exception_id}/dispute-status")
def update_dispute_status(exception_id: str, req: DisputeStatusUpdateRequest, db: Session = Depends(get_db)):
    """
    Updates the dispute resolution status (ESCALATED_TO_NODAL, RECOVERED, REJECTED)
    and tracks remitted recovered rupee amounts.
    """
    e = db.query(ExceptionRecord).filter(ExceptionRecord.id == exception_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Exception not found")

    effective_status = req.get_effective_status()
    e.dispute_status = effective_status
    if req.dispute_reference:
        e.dispute_reference = req.dispute_reference
    if req.recovered_amount is not None and req.recovered_amount > 0:
        e.recovered_amount = Decimal(str(req.recovered_amount))
    
    if effective_status in ["RECOVERED", "SETTLED_RECOVERED"]:
        e.status = "RESOLVED"
        e.human_approval_status = "APPROVED"

    audit = AuditLog(
        id=f"aud_disp_{uuid.uuid4().hex[:12]}",
        batch_id=e.batch_id,
        exception_id=e.id,
        event_type="DISPUTE_STATUS_CHANGE",
        decision=effective_status,
        evidence={"dispute_reference": req.dispute_reference, "recovered_amount": float(e.recovered_amount), "notes": req.notes},
        tools_called=[],
        action_taken=f"Dispute status changed to {effective_status}. Recovered: ₹{float(e.recovered_amount):,.2f}."
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"Exception {exception_id} dispute status updated to {effective_status}",
        "dispute_status": e.dispute_status,
        "dispute_reference": e.dispute_reference,
        "recovered_amount": float(e.recovered_amount),
        "exception_status": e.status
    }




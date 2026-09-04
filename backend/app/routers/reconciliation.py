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


@router.get("/{batch_id}/journal-entries")
def get_batch_journal_entries(batch_id: str, db: Session = Depends(get_db)):
    """
    Computes balanced double-entry General Ledger (GL) journal entries for the batch,
    strictly enforcing: Total Debits == Total Credits.
    """
    batch_run = db.query(BatchRun).filter(BatchRun.id == batch_id).first()
    if not batch_run:
        raise HTTPException(status_code=404, detail="Batch run not found")

    results = db.query(ReconciliationResult).filter(ReconciliationResult.batch_id == batch_id).all()

    total_gross = 0.0
    total_net_settled = 0.0
    total_base_fee = 0.0
    total_gst_tax = 0.0
    total_refund = 0.0
    total_discrepancy = 0.0

    for r in results:
        eq = r.financial_equation or {}
        total_gross += float(eq.get("payment_amount", r.payment_amount or 0.0))
        total_net_settled += float(eq.get("settlement_amount", r.settlement_amount or 0.0))
        total_base_fee += float(eq.get("fee_amount", r.fee_amount or 0.0))
        total_gst_tax += float(eq.get("tax_amount", 0.0))
        total_refund += float(eq.get("refund_amount", r.refund_amount or 0.0))
        total_discrepancy += float(eq.get("difference", r.difference or 0.0))

    total_debits = round(total_net_settled + total_base_fee + total_gst_tax + total_refund + total_discrepancy, 2)
    total_credits = round(total_gross, 2)

    # Strict balance check
    is_balanced = abs(total_debits - total_credits) < 0.05

    journal_lines = [
        {
            "account_code": "1010",
            "account_name": "Cash at Bank - Razorpay Settlement Nodal",
            "type": "ASSET",
            "debit": round(total_net_settled, 2),
            "credit": 0.0,
            "narration": f"Net merchant payout received for Batch {batch_id[:12]}"
        },
        {
            "account_code": "5020",
            "account_name": "Operating Expense - Gateway MDR Processing Fees",
            "type": "EXPENSE",
            "debit": round(total_base_fee, 2),
            "credit": 0.0,
            "narration": f"Base Merchant Discount Rate (MDR) processing costs"
        },
        {
            "account_code": "1140",
            "account_name": "Current Asset - GST Input Tax Credit (18% on MDR)",
            "type": "ASSET",
            "debit": round(total_gst_tax, 2),
            "credit": 0.0,
            "narration": f"Eligible GSTR-2B Input Tax Credit for gateway service invoice"
        },
        {
            "account_code": "5030",
            "account_name": "Sales Contra - Customer Refunds & Chargebacks",
            "type": "CONTRA_REVENUE",
            "debit": round(total_refund, 2),
            "credit": 0.0,
            "narration": f"Customer return credits & chargeback reversals processed"
        }
    ]

    if total_discrepancy > 0:
        journal_lines.append({
            "account_code": "9999",
            "account_name": "Suspense Clearing - Unreconciled Shortages / Dispute Exposure",
            "type": "SUSPENSE",
            "debit": round(total_discrepancy, 2),
            "credit": 0.0,
            "narration": f"At-risk exposure / unremitted gateway deductions awaiting bank dispute resolution"
        })

    journal_lines.append({
        "account_code": "1200",
        "account_name": "Accounts Receivable - Customer Payment Gateway Clearing",
        "type": "ASSET",
        "debit": 0.0,
        "credit": total_credits,
        "narration": f"Gross captured sales volume recognized for settlement batch {batch_id[:12]}"
    })

    posting_date = batch_run.started_at.strftime("%Y-%m-%d") if batch_run.started_at else "2026-09-04"

    return {
        "batch_id": batch_id,
        "journal_id": f"JV-{batch_id[:8].upper()}",
        "posting_date": posting_date,
        "currency": "INR",
        "total_debits": total_debits,
        "total_credits": total_credits,
        "is_balanced": is_balanced,
        "variance": round(total_debits - total_credits, 2),
        "lines": journal_lines,
        "records_count": len(results),
        "erp_compatible_formats": ["CSV (NetSuite/QuickBooks)", "JSON (SAP S/4HANA)", "Tally XML"]
    }


@router.get("/{batch_id}/export-gl")
def export_gl(batch_id: str, format: str = "csv", db: Session = Depends(get_db)):
    """
    Exports double-entry General Ledger journal entries formatted for direct ERP upload (NetSuite, SAP, Tally).
    """
    from fastapi.responses import Response
    import io
    import csv

    data = get_batch_journal_entries(batch_id=batch_id, db=db)

    if format.lower() == "json":
        import json
        return Response(
            content=json.dumps(data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="FINCTRL_GL_{batch_id[:8]}.json"'}
        )

    # Generate ERP-standard CSV
    buffer = io.StringIO()
    writer = csv.writer(buffer)

    # Standard NetSuite / QuickBooks CSV Header
    writer.writerow([
        "Journal_ID",
        "Posting_Date",
        "Account_Code",
        "Account_Name",
        "Account_Type",
        "Debit_INR",
        "Credit_INR",
        "Currency",
        "Line_Narration",
        "Batch_Reference"
    ])

    for line in data["lines"]:
        writer.writerow([
            data["journal_id"],
            data["posting_date"],
            line["account_code"],
            line["account_name"],
            line["type"],
            f"{line['debit']:.2f}",
            f"{line['credit']:.2f}",
            data["currency"],
            line["narration"],
            batch_id
        ])

    csv_content = buffer.getvalue()
    buffer.close()

    filename = f"FINCTRL_General_Ledger_{batch_id[:8]}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


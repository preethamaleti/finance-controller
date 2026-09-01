from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List

from app.database import get_db
from app.models.entities import BatchRun, ExceptionRecord, Payment, Merchant, Investigation
from app.schemas.schemas import CopilotQueryRequest, CopilotQueryResponse
from app.core.ai.provider import get_llm_provider
from app.core.ai.tools import FinanceInvestigationTools

router = APIRouter(prefix="/copilot", tags=["Copilot"])

@router.post("/query", response_model=CopilotQueryResponse)
def query_copilot(req: CopilotQueryRequest, db: Session = Depends(get_db)):
    batch_run = None
    if req.batch_id:
        batch_run = db.query(BatchRun).filter(BatchRun.id == req.batch_id).first()
    else:
        batch_run = db.query(BatchRun).order_by(BatchRun.started_at.desc()).first()

    context: Dict[str, Any] = {}
    tools_used = []
    citations = []

    if batch_run:
        # Fetch all exceptions for batch
        exceptions = db.query(ExceptionRecord).filter(ExceptionRecord.batch_id == batch_run.id).all()
        critical_exceptions = [e for e in exceptions if e.severity == "CRITICAL"]
        unresolved_exceptions = [e for e in exceptions if e.status == "UNRESOLVED"]
        
        # Sort unresolved by financial exposure descending
        unresolved_sorted = sorted(unresolved_exceptions, key=lambda x: float(x.financial_exposure), reverse=True)
        all_sorted = sorted(exceptions, key=lambda x: float(x.financial_exposure), reverse=True)

        highest_unresolved = unresolved_sorted[0] if unresolved_sorted else (all_sorted[0] if all_sorted else None)

        def serialize_exc(e: ExceptionRecord):
            payment = db.query(Payment).filter(Payment.id == e.payment_id).first()
            merchant_name = "Unknown Merchant"
            txn_id = e.payment_id
            if payment:
                txn_id = payment.transaction_id
                merchant = db.query(Merchant).filter(Merchant.id == payment.merchant_id).first()
                if merchant:
                    merchant_name = merchant.name

            inv = db.query(Investigation).filter(Investigation.exception_id == e.id).first()
            return {
                "id": e.id,
                "transaction_id": txn_id,
                "merchant_name": merchant_name,
                "financial_exposure": float(e.financial_exposure),
                "expected_amount": float(e.expected_amount),
                "accounted_amount": float(e.accounted_amount),
                "exception_type": e.exception_type,
                "severity": e.severity,
                "status": e.status,
                "reasoning": inv.reasoning_summary if inv else "Pending investigation"
            }

        top_unresolved_list = [serialize_exc(e) for e in unresolved_sorted[:15]]
        top_all_list = [serialize_exc(e) for e in all_sorted[:15]]
        highest_exc_data = serialize_exc(highest_unresolved) if highest_unresolved else None

        context = {
            "batch_id": batch_run.id,
            "total_transaction_value": float(batch_run.total_value),
            "unresolved_exposure": float(batch_run.unresolved_exposure),
            "total_records": batch_run.records_total,
            "match_rate": ((batch_run.records_matched + batch_run.records_resolved) / max(batch_run.records_total, 1)) * 100.0,
            "unresolved_count": len(unresolved_exceptions),
            "critical_exceptions_count": len(critical_exceptions),
            "throughput_records_sec": float(batch_run.throughput_per_sec),
            "highest_unresolved_transaction": highest_exc_data,
            "top_unresolved_transactions": top_unresolved_list,
            "top_exceptions": top_all_list
        }
        tools_used.append({"tool": "get_batch_context", "batch_id": batch_run.id})
        citations.append(f"Batch {batch_run.id}")

        if highest_exc_data:
            citations.append(f"Transaction {highest_exc_data['transaction_id']}")

    # Check if user asks to investigate a specific transaction ID
    q_words = req.query.split()
    for word in q_words:
        clean_word = word.strip(",.?!\"'")
        if clean_word.startswith("pay_") or clean_word.startswith("PREF-") or clean_word.startswith("TXN-") or clean_word.startswith("exc_"):
            pay_data = FinanceInvestigationTools.search_payment(db, clean_word)
            if pay_data:
                tools_used.append({"tool": "search_payment", "param": clean_word})
                citations.append(f"Payment {clean_word}")
                settle_data = FinanceInvestigationTools.search_settlement(db, clean_word)
                fees_data = FinanceInvestigationTools.search_fee(db, clean_word)
                context["queried_transaction"] = {
                    "payment": pay_data,
                    "settlements": settle_data,
                    "fees": fees_data
                }

    provider = get_llm_provider()
    answer = provider.query_copilot(user_query=req.query, context=context)

    return CopilotQueryResponse(
        answer=answer,
        tools_used=tools_used,
        citations=citations,
        metrics_context=context
    )

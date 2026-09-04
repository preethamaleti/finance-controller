import datetime
from decimal import Decimal
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.entities import Merchant, Payment, Settlement, ExceptionRecord, BatchRun, ReconciliationResult

router = APIRouter(prefix="/merchants", tags=["Merchants Health Scorecard"])

@router.get("/scorecard")
def get_merchants_scorecard(batch_id: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Returns comprehensive merchant health analytics, ranking merchants by:
    - Transaction Volume & Gross rupeee throughput
    - Exception Rate (%) and At-Risk Exposure (INR)
    - Settlement Velocity SLA (days)
    - RAG Status (Red / Amber / Green)
    """
    merchants = db.query(Merchant).all()
    if not merchants:
        return {
            "summary": {
                "total_merchants": 0,
                "high_risk_merchants_count": 0,
                "avg_exception_rate": 0.0,
                "total_merchant_exposure": 0.0
            },
            "scorecards": []
        }

    scorecards = []
    total_exposure_all = Decimal("0.00")
    total_exceptions_all = 0
    total_txns_all = 0

    for m in merchants:
        # Payments
        pay_query = db.query(Payment).filter(Payment.merchant_id == m.id)
        if batch_id:
            batch = db.query(BatchRun).filter(BatchRun.id == batch_id).first()
            if batch:
                pay_query = pay_query.filter(Payment.dataset_id == batch.dataset_id)

        payments = pay_query.all()
        total_txns = len(payments)
        gross_vol = sum((p.amount for p in payments), Decimal("0.00"))

        if total_txns == 0:
            continue

        total_txns_all += total_txns

        # Settlements for SLA calculation
        settlements = db.query(Settlement).filter(Settlement.merchant_id == m.id).all()
        sla_days_list = []
        for s in settlements:
            pay = db.query(Payment).filter(Payment.id == s.payment_id).first()
            if pay and s.settled_at and pay.timestamp:
                delta_days = (s.settled_at - pay.timestamp).total_seconds() / 86400.0
                sla_days_list.append(max(0.0, delta_days))
        
        avg_sla_days = round(sum(sla_days_list) / len(sla_days_list), 1) if sla_days_list else 1.2

        # Exceptions
        pay_ids = [p.id for p in payments]
        exc_query = db.query(ExceptionRecord).filter(ExceptionRecord.payment_id.in_(pay_ids))
        if batch_id:
            exc_query = exc_query.filter(ExceptionRecord.batch_id == batch_id)
        
        exceptions = exc_query.all()
        exc_count = len(exceptions)
        total_exceptions_all += exc_count

        unresolved_exposure = sum((e.financial_exposure for e in exceptions if e.status in ["OPEN", "UNRESOLVED", "INVESTIGATING"]), Decimal("0.00"))
        total_exposure_all += unresolved_exposure

        exc_rate = round((exc_count / total_txns) * 100.0, 2) if total_txns > 0 else 0.0

        # RAG Status determination
        if exc_rate > 15.0 or unresolved_exposure > Decimal("35000.00") or avg_sla_days > 4.0:
            rag_status = "RED"
        elif exc_rate > 6.0 or unresolved_exposure > Decimal("10000.00") or avg_sla_days > 2.5:
            rag_status = "AMBER"
        else:
            rag_status = "GREEN"

        # Most common exception types
        exc_type_counts: Dict[str, int] = {}
        for e in exceptions:
            exc_type_counts[e.exception_type] = exc_type_counts.get(e.exception_type, 0) + 1
        
        top_exc = sorted(exc_type_counts.items(), key=lambda x: x[1], reverse=True)
        top_exc_names = [t[0] for t in top_exc[:2]]

        scorecards.append({
            "merchant_id": m.id,
            "merchant_name": m.name,
            "category": m.category,
            "risk_level": m.risk_level,
            "total_transactions": total_txns,
            "gross_volume": float(gross_vol),
            "exceptions_count": exc_count,
            "exception_rate_pct": exc_rate,
            "unresolved_exposure": float(unresolved_exposure),
            "avg_settlement_sla_days": avg_sla_days,
            "rag_status": rag_status,
            "top_exception_types": top_exc_names,
            "compliance_score": round(max(0.0, 100.0 - (exc_rate * 2.5)), 1)
        })

    # Sort scorecards by highest risk exposure first
    scorecards.sort(key=lambda x: (x["rag_status"] == "RED", x["unresolved_exposure"]), reverse=True)

    avg_rate = round((total_exceptions_all / total_txns_all) * 100.0, 2) if total_txns_all > 0 else 0.0
    high_risk_count = sum(1 for s in scorecards if s["rag_status"] == "RED")

    return {
        "summary": {
            "total_merchants": len(scorecards),
            "high_risk_merchants_count": high_risk_count,
            "avg_exception_rate": avg_rate,
            "total_merchant_exposure": float(total_exposure_all)
        },
        "scorecards": scorecards
    }

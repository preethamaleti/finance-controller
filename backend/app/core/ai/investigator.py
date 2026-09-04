import time
import uuid
import datetime
from decimal import Decimal
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.entities import (
    ExceptionRecord, Investigation, AuditLog, Payment, BatchRun, ReconciliationResult
)
from app.core.ai.tools import FinanceInvestigationTools
from app.core.ai.provider import get_llm_provider
from app.core.ai.prompts import INVESTIGATION_SYSTEM_PROMPT
from app.config import settings

class AIInvestigator:
    @staticmethod
    def investigate_exception(db: Session, exception_id: str) -> Investigation:
        start_time = time.perf_counter()

        exception = db.query(ExceptionRecord).filter(ExceptionRecord.id == exception_id).first()
        if not exception:
            raise ValueError(f"Exception {exception_id} not found")

        payment = db.query(Payment).filter(Payment.id == exception.payment_id).first()
        if not payment:
            raise ValueError(f"Payment for exception {exception_id} not found")

        # 1. Execute controlled tools
        tools_called = [
            "search_payment",
            "search_settlement",
            "search_fee",
            "search_refund",
            "search_bank",
            "search_invoice"
        ]

        payment_data = FinanceInvestigationTools.search_payment(db, payment.transaction_id, dataset_id=payment.dataset_id)
        settlements_data = FinanceInvestigationTools.search_settlement(db, payment.transaction_id, dataset_id=payment.dataset_id)
        fees_data = FinanceInvestigationTools.search_fee(db, payment.transaction_id, dataset_id=payment.dataset_id)
        refunds_data = FinanceInvestigationTools.search_refund(db, payment.transaction_id, dataset_id=payment.dataset_id)
        
        bank_data = []
        if payment.payment_reference:
            bank_data = FinanceInvestigationTools.search_bank(db, payment.payment_reference, dataset_id=payment.dataset_id)
        for s in settlements_data:
            if s.get("bank_reference"):
                bank_data.extend(FinanceInvestigationTools.search_bank(db, s["bank_reference"], dataset_id=payment.dataset_id))

        invoices_data = FinanceInvestigationTools.search_invoice(db, payment.transaction_id, dataset_id=payment.dataset_id)


        tools_payload = {
            "payment": payment_data,
            "settlements": settlements_data,
            "fees": fees_data,
            "refunds": refunds_data,
            "bank_txns": bank_data,
            "invoices": invoices_data,
            "exception_details": {
                "id": exception.id,
                "type": exception.exception_type,
                "expected_amount": float(exception.expected_amount),
                "accounted_amount": float(exception.accounted_amount),
                "difference": float(exception.difference),
                "severity": exception.severity
            }
        }

        # 2. Invoke LLM / Rule provider
        provider = get_llm_provider()
        prompt_text = (
            f"Investigate discrepancy for Payment {payment.transaction_id} ({payment.payment_reference}). "
            f"Expected: ₹{float(exception.expected_amount):.2f}, Accounted: ₹{float(exception.accounted_amount):.2f}, "
            f"Difference: ₹{float(exception.difference):.2f}."
        )

        res = provider.generate_investigation(
            prompt=prompt_text,
            system_prompt=INVESTIGATION_SYSTEM_PROMPT,
            tools_data=tools_payload
        )

        duration = time.perf_counter() - start_time

        # 3. Create or update Investigation record
        inv_id = f"inv_{uuid.uuid4().hex[:12]}"
        ai_status = res.get("status", "UNRESOLVED")
        confidence = float(res.get("confidence", 0.30))

        # Enforce honest uncertainty threshold
        if confidence < settings.AI_INVESTIGATION_CONFIDENCE_THRESHOLD:
            ai_status = "UNRESOLVED"

        # Check existing
        existing_inv = db.query(Investigation).filter(Investigation.exception_id == exception_id).first()
        if existing_inv:
            db.delete(existing_inv)
            db.commit()

        investigation = Investigation(
            id=inv_id,
            exception_id=exception.id,
            status=ai_status,
            root_cause=res.get("root_cause"),
            financial_difference=Decimal(str(round(res.get("financial_difference", float(exception.difference)), 2))),
            explained_amount=Decimal(str(round(res.get("explained_amount", 0.0), 2))),
            confidence=Decimal(str(round(confidence, 4))),
            evidence_records=res.get("evidence_records", []),
            tools_called=tools_called,
            reasoning_summary=res.get("reasoning_summary", "Investigation completed."),
            calculation_steps=res.get("calculation_steps", []),
            recommended_action=res.get("recommended_action"),
            duration_sec=Decimal(str(round(duration, 4))),
            investigated_at=datetime.datetime.now(datetime.UTC)
        )
        db.add(investigation)

        # 4. Update Exception status
        if ai_status == "RESOLVED":
            exception.status = "RESOLVED"
            if not exception.human_approval_required:
                exception.human_approval_status = "AUTO_APPROVED"
        else:
            exception.status = "UNRESOLVED"

        # 5. Audit Log
        audit = AuditLog(
            id=f"aud_{uuid.uuid4().hex[:12]}",
            batch_id=exception.batch_id,
            exception_id=exception.id,
            transaction_id=payment.transaction_id,
            event_type="AI_INVESTIGATION_COMPLETED",
            decision=ai_status,
            evidence={"evidence_records": res.get("evidence_records", []), "steps": res.get("calculation_steps", [])},
            tools_called=tools_called,
            financial_calculation={
                "explained_amount": res.get("explained_amount"),
                "financial_difference": res.get("financial_difference")
            },
            confidence=Decimal(str(round(confidence, 4))),
            action_taken=f"AI concluded {ai_status} ({res.get('root_cause', 'N/A')})"
        )
        db.add(audit)

        # Update batch run metrics
        batch_run = db.query(BatchRun).filter(BatchRun.id == exception.batch_id).first()
        if batch_run:
            resolved_count = db.query(ExceptionRecord).filter(
                ExceptionRecord.batch_id == batch_run.id,
                ExceptionRecord.status == "RESOLVED"
            ).count()
            unresolved_count = db.query(ExceptionRecord).filter(
                ExceptionRecord.batch_id == batch_run.id,
                ExceptionRecord.status == "UNRESOLVED"
            ).count()
            
            batch_run.records_resolved = resolved_count
            batch_run.records_unresolved = unresolved_count
            batch_run.ai_investigation_time_sec += Decimal(str(round(duration, 4)))
            batch_run.total_time_sec = batch_run.deterministic_time_sec + batch_run.ai_investigation_time_sec

        db.commit()
        db.refresh(investigation)
        return investigation

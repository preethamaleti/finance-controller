from decimal import Decimal
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.entities import (
    Payment, Settlement, BankTransaction, Refund, Fee, Invoice, Merchant
)

class FinanceInvestigationTools:
    @staticmethod
    def search_payment(db: Session, transaction_id: str) -> Optional[Dict[str, Any]]:
        payment = db.query(Payment).filter(
            (Payment.transaction_id == transaction_id) | (Payment.id == transaction_id)
        ).first()
        if not payment:
            return None
        return {
            "id": payment.id,
            "transaction_id": payment.transaction_id,
            "payment_reference": payment.payment_reference,
            "merchant_id": payment.merchant_id,
            "customer_id": payment.customer_id,
            "amount": float(payment.amount),
            "currency": payment.currency,
            "status": payment.status,
            "payment_method": payment.payment_method,
            "timestamp": payment.timestamp.isoformat() if payment.timestamp else None
        }

    @staticmethod
    def search_settlement(db: Session, transaction_id: str) -> List[Dict[str, Any]]:
        settlements = db.query(Settlement).filter(
            (Settlement.transaction_id == transaction_id) | 
            (Settlement.payment_id == transaction_id) |
            (Settlement.settlement_reference.like(f"%{transaction_id}%"))
        ).all()
        return [
            {
                "id": s.id,
                "settlement_reference": s.settlement_reference,
                "transaction_id": s.transaction_id,
                "bank_reference": s.bank_reference,
                "gross_amount": float(s.gross_amount),
                "fee_amount": float(s.fee_amount),
                "tax_amount": float(s.tax_amount),
                "net_amount": float(s.net_amount),
                "status": s.status,
                "settled_at": s.settled_at.isoformat() if s.settled_at else None
            }
            for s in settlements
        ]

    @staticmethod
    def search_bank(db: Session, reference: str) -> List[Dict[str, Any]]:
        txns = db.query(BankTransaction).filter(
            (BankTransaction.bank_reference == reference) |
            (BankTransaction.settlement_reference == reference) |
            (BankTransaction.payment_reference == reference)
        ).all()
        return [
            {
                "id": b.id,
                "bank_reference": b.bank_reference,
                "settlement_reference": b.settlement_reference,
                "payment_reference": b.payment_reference,
                "amount": float(b.amount),
                "direction": b.direction,
                "narrative": b.narrative,
                "timestamp": b.timestamp.isoformat() if b.timestamp else None
            }
            for b in txns
        ]

    @staticmethod
    def search_refund(db: Session, transaction_id: str) -> List[Dict[str, Any]]:
        refunds = db.query(Refund).filter(
            (Refund.transaction_id == transaction_id) | 
            (Refund.payment_id == transaction_id) |
            (Refund.refund_reference.like(f"%{transaction_id}%"))
        ).all()
        return [
            {
                "id": r.id,
                "refund_reference": r.refund_reference,
                "transaction_id": r.transaction_id,
                "amount": float(r.amount),
                "status": r.status,
                "reason": r.reason,
                "refunded_at": r.refunded_at.isoformat() if r.refunded_at else None
            }
            for r in refunds
        ]

    @staticmethod
    def search_fee(db: Session, transaction_id: str) -> List[Dict[str, Any]]:
        fees = db.query(Fee).filter(
            (Fee.transaction_id == transaction_id) | 
            (Fee.payment_id == transaction_id) |
            (Fee.fee_reference.like(f"%{transaction_id}%"))
        ).all()
        return [
            {
                "id": f.id,
                "fee_reference": f.fee_reference,
                "transaction_id": f.transaction_id,
                "fee_type": f.fee_type,
                "base_amount": float(f.base_amount),
                "tax_amount": float(f.tax_amount),
                "total_amount": float(f.total_amount),
                "calculated_at": f.calculated_at.isoformat() if f.calculated_at else None
            }
            for f in fees
        ]

    @staticmethod
    def search_invoice(db: Session, transaction_id: str) -> List[Dict[str, Any]]:
        invoices = db.query(Invoice).filter(
            (Invoice.payment_id == transaction_id) | (Invoice.invoice_number.like(f"%{transaction_id}%"))
        ).all()
        return [
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "merchant_id": inv.merchant_id,
                "subtotal": float(inv.subtotal),
                "tax_total": float(inv.tax_total),
                "total_amount": float(inv.total_amount),
                "created_at": inv.created_at.isoformat() if inv.created_at else None
            }
            for inv in invoices
        ]

    @staticmethod
    def calculate_financial_difference(
        expected_amount: float,
        accounted_amount: float,
        candidate_amounts: List[float]
    ) -> Dict[str, Any]:
        """Deterministic helper for cross-checking candidate amounts against discrepancy."""
        exp = Decimal(str(expected_amount))
        acc = Decimal(str(accounted_amount))
        diff = exp - acc
        
        candidates = [Decimal(str(c)) for c in candidate_amounts]
        sum_candidates = sum(candidates)
        
        matches_exact = abs(diff - sum_candidates) < Decimal("0.01")
        return {
            "expected": float(exp),
            "accounted": float(acc),
            "difference": float(diff),
            "candidates_sum": float(sum_candidates),
            "matches_exact": matches_exact,
            "remaining_discrepancy": float(diff - sum_candidates)
        }

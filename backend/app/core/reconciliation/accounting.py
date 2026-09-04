from decimal import Decimal
from typing import Dict, Any, List
from app.schemas.schemas import FinancialEquation

class FinancialAccountant:
    @staticmethod
    def calculate_equation(
        payment_amount: Decimal,
        settlements: List[Any],
        refunds: List[Any],
        fees: List[Any],
    ) -> FinancialEquation:
        """
        Builds and balances the financial equation:
        Payment Amount = Settlement Amount + Refund Amount + Fees + Taxes + Other Adjustments
        """
        settlement_total = Decimal("0.00")
        fee_total = Decimal("0.00")
        tax_total = Decimal("0.00")
        
        # Track settlement-captured fee transaction IDs to avoid double-counting
        settlement_captured_txn_ids = set()
        
        # Calculate from settlements
        for s in settlements:
            settlement_total += s.net_amount
            fee_total += s.fee_amount
            tax_total += s.tax_amount
            # Mark this settlement's transaction as already having fee captured
            if s.transaction_id:
                settlement_captured_txn_ids.add(s.transaction_id)
            if s.payment_id:
                settlement_captured_txn_ids.add(s.payment_id)

        # Add separate fee line items only if NOT already captured via settlement
        for f in fees:
            fee_txn_id = getattr(f, 'transaction_id', None) or getattr(f, 'payment_id', None)
            if fee_txn_id and fee_txn_id not in settlement_captured_txn_ids:
                fee_total += f.base_amount
                tax_total += f.tax_amount
            elif fee_txn_id is None:
                # Orphan fee record with no transaction link — always include
                fee_total += f.base_amount
                tax_total += f.tax_amount

        # Calculate refunds
        refund_total = Decimal("0.00")
        for r in refunds:
            refund_total += r.amount

        other_adjustments = Decimal("0.00")
        accounted_total = settlement_total + refund_total + fee_total + tax_total + other_adjustments
        difference = payment_amount - accounted_total
        
        # Strict zero-threshold for float/decimal exactness
        is_balanced = abs(difference) < Decimal("0.01")
        if is_balanced:
            difference = Decimal("0.00")

        return FinancialEquation(
            payment_amount=payment_amount,
            settlement_amount=settlement_total,
            refund_amount=refund_total,
            fee_amount=fee_total,
            tax_amount=tax_total,
            other_adjustments=other_adjustments,
            accounted_amount=accounted_total,
            difference=difference,
            is_balanced=is_balanced
        )

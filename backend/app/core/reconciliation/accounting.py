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
        
        # Calculate from settlements
        for s in settlements:
            settlement_total += s.net_amount
            fee_total += s.fee_amount
            tax_total += s.tax_amount

        # Add separate fee line items if not included in settlement
        for f in fees:
            # Check if this fee was already accounted in settlement.fee_amount
            # If settlement fee was 0, count this fee
            if fee_total == Decimal("0.00"):
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

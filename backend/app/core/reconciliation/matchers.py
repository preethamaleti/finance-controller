from decimal import Decimal
from typing import Optional, List, Dict, Any
from datetime import datetime

class MatchResult:
    def __init__(
        self,
        level: str,
        confidence: float,
        matched_settlements: List[Any],
        matched_bank_txns: List[Any],
        matched_refunds: List[Any],
        matched_fees: List[Any],
        details: Dict[str, Any] = None
    ):
        self.level = level
        self.confidence = confidence
        self.matched_settlements = matched_settlements
        self.matched_bank_txns = matched_bank_txns
        self.matched_refunds = matched_refunds
        self.matched_fees = matched_fees
        self.details = details or {}

class MultiSourceMatcher:
    @staticmethod
    def match_payment(
        payment: Any,
        settlements_by_txn_id: Dict[str, List[Any]],
        settlements_by_ref: Dict[str, List[Any]],
        all_settlements: List[Any],
        bank_txns_by_ref: Dict[str, List[Any]],
        bank_txns_by_pay_ref: Dict[str, List[Any]],
        refunds_by_txn_id: Dict[str, List[Any]],
        fees_by_txn_id: Dict[str, List[Any]]
    ) -> MatchResult:
        """
        Executes Level 1 -> Level 2 -> Level 3 -> Level 4 deterministic matching.
        """
        matched_settlements = []
        matched_bank_txns = []
        matched_refunds = refunds_by_txn_id.get(payment.transaction_id, [])
        matched_fees = fees_by_txn_id.get(payment.transaction_id, [])
        
        # Level 1: Exact transaction_id matching
        if payment.transaction_id in settlements_by_txn_id:
            matched_settlements = settlements_by_txn_id[payment.transaction_id]
            for s in matched_settlements:
                if s.bank_reference and s.bank_reference in bank_txns_by_ref:
                    matched_bank_txns.extend(bank_txns_by_ref[s.bank_reference])
                elif s.settlement_reference and s.settlement_reference in bank_txns_by_ref:
                    matched_bank_txns.extend(bank_txns_by_ref[s.settlement_reference])
            
            if not matched_bank_txns and payment.payment_reference in bank_txns_by_pay_ref:
                matched_bank_txns.extend(bank_txns_by_pay_ref[payment.payment_reference])

            return MatchResult(
                level="LEVEL_1_EXACT_ID",
                confidence=1.0,
                matched_settlements=matched_settlements,
                matched_bank_txns=matched_bank_txns,
                matched_refunds=matched_refunds,
                matched_fees=matched_fees,
                details={"strategy": "Exact payment.transaction_id == settlement.transaction_id"}
            )

        # Level 2: Reference matching
        if payment.payment_reference and payment.payment_reference in settlements_by_ref:
            matched_settlements = settlements_by_ref[payment.payment_reference]
            for s in matched_settlements:
                if s.bank_reference in bank_txns_by_ref:
                    matched_bank_txns.extend(bank_txns_by_ref[s.bank_reference])
            
            return MatchResult(
                level="LEVEL_2_REFERENCE",
                confidence=0.95,
                matched_settlements=matched_settlements,
                matched_bank_txns=matched_bank_txns,
                matched_refunds=matched_refunds,
                matched_fees=matched_fees,
                details={"strategy": "payment_reference matching"}
            )

        # Level 3: Amount + Date Window (±3 days) for same merchant — tightened from 7 days for higher precision
        candidate_settlements = []
        for s in all_settlements:
            if s.merchant_id == payment.merchant_id:
                date_diff = abs((s.settled_at - payment.timestamp).total_seconds()) / 86400.0
                if date_diff <= 3.0:
                    # check if gross or net matches within 1% or exact
                    if s.gross_amount == payment.amount or s.net_amount == payment.amount:
                        candidate_settlements.append((s, date_diff))
        
        if candidate_settlements:
            # Pick closest in time
            candidate_settlements.sort(key=lambda x: x[1])
            best_settlement = candidate_settlements[0][0]
            matched_settlements = [best_settlement]
            if best_settlement.bank_reference in bank_txns_by_ref:
                matched_bank_txns.extend(bank_txns_by_ref[best_settlement.bank_reference])

            confidence = max(0.80, 0.94 - (candidate_settlements[0][1] * 0.03))
            return MatchResult(
                level="LEVEL_3_AMOUNT_DATE_WINDOW",
                confidence=round(confidence, 4),
                matched_settlements=matched_settlements,
                matched_bank_txns=matched_bank_txns,
                matched_refunds=matched_refunds,
                matched_fees=matched_fees,
                details={"strategy": "Amount match within 3-day settlement window"}
            )

        # Level 3.5: Bank UTR cross-reference — bridge via bank transactions when ID-based matching failed
        if payment.payment_reference and payment.payment_reference in bank_txns_by_pay_ref:
            bridged_bank_txns = bank_txns_by_pay_ref[payment.payment_reference]
            if bridged_bank_txns:
                # Find settlement whose bank_reference matches one of these UTR-bridged bank txns
                for bk in bridged_bank_txns:
                    if bk.bank_reference and bk.bank_reference in bank_txns_by_ref:
                        pass  # already have bank txn
                    # Try matching settlement via bank UTR
                    for s in all_settlements:
                        if s.merchant_id == payment.merchant_id and s.bank_reference == bk.bank_reference:
                            matched_settlements = [s]
                            matched_bank_txns = [bk]
                            return MatchResult(
                                level="LEVEL_3_5_BANK_UTR_BRIDGE",
                                confidence=0.88,
                                matched_settlements=matched_settlements,
                                matched_bank_txns=matched_bank_txns,
                                matched_refunds=matched_refunds,
                                matched_fees=matched_fees,
                                details={"strategy": "Bank UTR payment_reference bridge"}
                            )

        # Level 4: Composite Weighted Match
        # (Amount similarity 50%, Date proximity 30%, Payment Method similarity 20%)
        best_composite = None
        best_score = 0.0
        
        for s in all_settlements:
            if s.merchant_id != payment.merchant_id:
                continue
            
            date_diff_days = abs((s.settled_at - payment.timestamp).total_seconds()) / 86400.0
            date_score = max(0.0, 1.0 - (date_diff_days / 14.0)) # 0 to 1
            
            # Amount proximity
            amt_diff = abs(s.gross_amount - payment.amount)
            if payment.amount > Decimal("0.00"):
                amt_score = max(0.0, 1.0 - float(amt_diff / payment.amount))
            else:
                amt_score = 1.0 if amt_diff == 0 else 0.0
            
            # Payment method similarity bonus
            method_score = 0.20 if (hasattr(s, 'payment_mode') and hasattr(payment, 'payment_method') 
                                    and s.payment_mode == payment.payment_method) else 0.10
            
            score = (amt_score * 0.50) + (date_score * 0.30) + method_score
            if score > best_score and score >= 0.70:
                best_score = score
                best_composite = s
        
        if best_composite:
            matched_settlements = [best_composite]
            return MatchResult(
                level="LEVEL_4_COMPOSITE",
                confidence=round(best_score * 0.85, 4),
                matched_settlements=matched_settlements,
                matched_bank_txns=matched_bank_txns,
                matched_refunds=matched_refunds,
                matched_fees=matched_fees,
                details={"strategy": f"Composite score {best_score:.2f}"}
            )

        # No match found
        return MatchResult(
            level="NO_MATCH",
            confidence=0.0,
            matched_settlements=[],
            matched_bank_txns=[],
            matched_refunds=matched_refunds,
            matched_fees=matched_fees,
            details={"strategy": "No matching settlement found across all 4 levels"}
        )

from decimal import Decimal
from typing import Dict, Any, Tuple
from app.config import settings

SEVERITY_WEIGHTS = {
    "CRITICAL": Decimal("4.0"),
    "HIGH": Decimal("3.0"),
    "MEDIUM": Decimal("2.0"),
    "LOW": Decimal("1.0"),
}

class ExceptionClassifier:
    @staticmethod
    def classify_and_score(
        payment: Any,
        match_result: Any,
        equation: Any,
    ) -> Tuple[str, str, Decimal, Decimal, bool, str]:
        """
        Returns:
        (exception_type, severity, financial_exposure, priority_score, human_approval_required, approval_status)
        """
        # Determine Exception Type
        if match_result.level == "NO_MATCH":
            exception_type = "MISSING_SETTLEMENT"
            financial_exposure = payment.amount
        elif len(match_result.matched_settlements) > 1:
            exception_type = "DUPLICATE_TRANSACTION"
            financial_exposure = abs(equation.difference)
        elif match_result.level == "LEVEL_3_AMOUNT_DATE_WINDOW" and match_result.details.get("delay_days", 0) > 3:
            exception_type = "DELAYED_SETTLEMENT"
            financial_exposure = abs(equation.difference)
        elif equation.fee_amount == Decimal("0.00") and equation.difference > Decimal("0.00") and equation.difference < (payment.amount * Decimal("0.05")):
            exception_type = "FEE_MISMATCH"
            financial_exposure = equation.difference
        elif equation.difference > Decimal("0.00"):
            exception_type = "AMOUNT_MISMATCH"
            financial_exposure = equation.difference
        else:
            exception_type = "UNKNOWN_DISCREPANCY"
            financial_exposure = abs(equation.difference)

        # Severity Calculation
        if financial_exposure >= Decimal("50000.00"):
            severity = "CRITICAL"
        elif financial_exposure >= Decimal("10000.00"):
            severity = "HIGH"
        elif financial_exposure >= Decimal("2000.00"):
            severity = "MEDIUM"
        else:
            severity = "LOW"

        # Age Factor (Days since transaction timestamp)
        # Default age factor for recent batches = 1.0 to 2.5
        age_factor = Decimal("1.25")
        
        # Priority Score = Financial Exposure * Severity Weight * Age Factor
        severity_weight = SEVERITY_WEIGHTS.get(severity, Decimal("2.0"))
        priority_score = (financial_exposure * severity_weight * age_factor) / Decimal("100.0")

        # Human Approval Determination based on configured thresholds
        auto_thresh = Decimal(str(settings.HITL_AUTO_THRESHOLD))
        recommend_thresh = Decimal(str(settings.HITL_RECOMMEND_THRESHOLD))

        if financial_exposure > recommend_thresh:
            human_approval_required = True
            approval_status = "PENDING_MANDATORY_REVIEW"
        elif financial_exposure > auto_thresh:
            human_approval_required = True
            approval_status = "PENDING_APPROVAL"
        else:
            human_approval_required = False
            approval_status = "AUTO_RESOLVE_ELIGIBLE"

        return (
            exception_type,
            severity,
            financial_exposure,
            priority_score,
            human_approval_required,
            approval_status
        )

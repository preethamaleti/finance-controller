import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.entities import Settlement, Refund, Fee, Payment
from app.schemas.schemas import CashPositionForecast

class CashPositionManager:
    @staticmethod
    def get_forecast(db: Session, dataset_id: str = None) -> CashPositionForecast:
        # Calculate opening / settled cash
        settle_query = db.query(func.sum(Settlement.net_amount))
        refund_query = db.query(func.sum(Refund.amount))
        fee_query = db.query(func.sum(Fee.total_amount))

        if dataset_id:
            settle_query = settle_query.filter(Settlement.dataset_id == dataset_id)
            refund_query = refund_query.filter(Refund.dataset_id == dataset_id)
            fee_query = fee_query.filter(Fee.dataset_id == dataset_id)

        current_settlements = settle_query.scalar() or Decimal("0.00")
        current_refunds = refund_query.scalar() or Decimal("0.00")
        current_fees = fee_query.scalar() or Decimal("0.00")

        # Base starting treasury balance
        base_treasury = Decimal("5000000.00") # ₹50L initial
        current_cash = base_treasury + current_settlements - current_refunds - current_fees

        # Calculate daily averages for transparent deterministic forecast
        daily_settlements = (current_settlements / Decimal("14.0")) if current_settlements > 0 else Decimal("75000.00")
        daily_refunds = (current_refunds / Decimal("14.0")) if current_refunds > 0 else Decimal("4500.00")
        daily_fees = (current_fees / Decimal("14.0")) if current_fees > 0 else Decimal("2100.00")
        daily_net = daily_settlements - daily_refunds - daily_fees

        proj_settle_7d = (daily_settlements * Decimal("7.0")).quantize(Decimal("0.01"))
        proj_refund_7d = (daily_refunds * Decimal("7.0")).quantize(Decimal("0.01"))
        proj_fees_7d = (daily_fees * Decimal("7.0")).quantize(Decimal("0.01"))
        proj_cash_7d = (current_cash + (daily_net * Decimal("7.0"))).quantize(Decimal("0.01"))
        proj_cash_30d = (current_cash + (daily_net * Decimal("30.0"))).quantize(Decimal("0.01"))

        # Generate daily 30-day projection points
        today = datetime.date.today()
        daily_forecast = []
        running_bal = current_cash

        for day in range(1, 31):
            f_date = today + datetime.timedelta(days=day)
            # Add slight day-of-week factor
            dow = f_date.weekday()
            multiplier = Decimal("1.2") if dow in [4, 5] else Decimal("0.9") # higher on weekends
            
            day_settle = (daily_settlements * multiplier).quantize(Decimal("0.01"))
            day_ref = (daily_refunds * multiplier).quantize(Decimal("0.01"))
            day_fee = (daily_fees * multiplier).quantize(Decimal("0.01"))
            day_net = day_settle - day_ref - day_fee
            running_bal += day_net

            daily_forecast.append({
                "day": day,
                "date": f_date.strftime("%Y-%m-%d"),
                "projected_cash": float(running_bal),
                "inflow": float(day_settle),
                "outflow": float(day_ref + day_fee),
                "net_change": float(day_net)
            })

        return CashPositionForecast(
            current_cash=current_cash.quantize(Decimal("0.01")),
            projected_settlements_7d=proj_settle_7d,
            projected_refunds_7d=proj_refund_7d,
            projected_fees_7d=proj_fees_7d,
            projected_cash_7d=proj_cash_7d,
            projected_cash_30d=proj_cash_30d,
            daily_forecast=daily_forecast,
            model_description="Deterministic 14-day trailing volume moving-average with weekend seasonality adjustments"
        )

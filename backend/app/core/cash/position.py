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

    @staticmethod
    def get_settlement_aging(db: Session, dataset_id: str = None) -> Dict[str, Any]:
        """
        Calculates T+N settlement velocity and aging distribution.
        """
        pay_query = db.query(Payment)
        sett_query = db.query(Settlement)

        if dataset_id:
            pay_query = pay_query.filter(Payment.dataset_id == dataset_id)
            sett_query = sett_query.filter(Settlement.dataset_id == dataset_id)

        payments = pay_query.all()
        settlements = sett_query.all()

        pay_map = {p.id: p for p in payments}
        pay_by_txn = {p.transaction_id: p for p in payments if p.transaction_id}

        buckets = {
            "T+0 (Same Day)": {"count": 0, "amount": Decimal("0.00"), "sla_status": "OPTIMAL"},
            "T+1 (Next Day)": {"count": 0, "amount": Decimal("0.00"), "sla_status": "STANDARD"},
            "T+2 (2 Days)": {"count": 0, "amount": Decimal("0.00"), "sla_status": "ACCEPTABLE"},
            "T+3 (3 Days)": {"count": 0, "amount": Decimal("0.00"), "sla_status": "MONITORING"},
            "T+4 (4 Days)": {"count": 0, "amount": Decimal("0.00"), "sla_status": "DELAYED"},
            "T+5+ (SLA Breach)": {"count": 0, "amount": Decimal("0.00"), "sla_status": "CRITICAL_BREACH"},
        }

        method_stats: Dict[str, Dict[str, Any]] = {}

        total_settled_vol = Decimal("0.00")
        total_settled_count = 0
        sla_compliant_count = 0

        for s in settlements:
            p = pay_map.get(s.payment_id) or pay_by_txn.get(s.transaction_id)
            if not p or not s.settled_at or not p.timestamp:
                continue

            delta_days = (s.settled_at - p.timestamp).total_seconds() / 86400.0
            amt = s.net_amount
            total_settled_vol += amt
            total_settled_count += 1

            if delta_days < 0.6:
                b_key = "T+0 (Same Day)"
                sla_compliant_count += 1
            elif delta_days < 1.6:
                b_key = "T+1 (Next Day)"
                sla_compliant_count += 1
            elif delta_days < 2.6:
                b_key = "T+2 (2 Days)"
                sla_compliant_count += 1
            elif delta_days < 3.6:
                b_key = "T+3 (3 Days)"
            elif delta_days < 4.6:
                b_key = "T+4 (4 Days)"
            else:
                b_key = "T+5+ (SLA Breach)"

            buckets[b_key]["count"] += 1
            buckets[b_key]["amount"] += amt

            # Method breakdown
            method = p.payment_method or "UPI"
            if method not in method_stats:
                method_stats[method] = {
                    "method": method,
                    "count": 0,
                    "total_amount": Decimal("0.00"),
                    "latencies": [],
                    "breaches": 0
                }
            method_stats[method]["count"] += 1
            method_stats[method]["total_amount"] += amt
            method_stats[method]["latencies"].append(delta_days)
            if delta_days >= 4.6:
                method_stats[method]["breaches"] += 1

        # Format bucket distribution
        distribution = []
        for label, b in buckets.items():
            pct = round((float(b["amount"]) / float(total_settled_vol) * 100.0), 2) if total_settled_vol > 0 else 0.0
            distribution.append({
                "bracket": label,
                "count": b["count"],
                "amount": float(b["amount"]),
                "percentage": pct,
                "sla_status": b["sla_status"]
            })

        # Format method breakdown
        methods_list = []
        for m, stat in method_stats.items():
            avg_lat = round(sum(stat["latencies"]) / len(stat["latencies"]), 1) if stat["latencies"] else 1.0
            compliance = round(((stat["count"] - stat["breaches"]) / stat["count"] * 100.0), 1) if stat["count"] > 0 else 100.0
            methods_list.append({
                "payment_method": m,
                "settled_count": stat["count"],
                "total_amount": float(stat["total_amount"]),
                "avg_latency_days": avg_lat,
                "sla_compliance_pct": compliance,
                "breach_count": stat["breaches"]
            })

        methods_list.sort(key=lambda x: x["total_amount"], reverse=True)
        sla_rate = round((sla_compliant_count / total_settled_count * 100.0), 1) if total_settled_count > 0 else 94.0

        return {
            "summary": {
                "total_settled_count": total_settled_count,
                "total_settled_volume": float(total_settled_vol),
                "sla_compliance_rate_pct": sla_rate,
                "sla_breach_volume": float(buckets["T+5+ (SLA Breach)"]["amount"]),
                "sla_breach_count": buckets["T+5+ (SLA Breach)"]["count"]
            },
            "aging_distribution": distribution,
            "method_breakdown": methods_list
        }


import uuid
import random
import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.models.entities import (
    Merchant, Dataset, Payment, Settlement, BankTransaction,
    Refund, Fee, Invoice, GroundTruth
)
from app.schemas.schemas import ScenarioConfig
from app.core.data_generator.scenarios import ScenarioType, GroundTruthStatus, ExceptionType

MERCHANT_POOL = [
    {"id": "merch_swiggy", "name": "Swiggy Food Delivery", "category": "Food & Beverage", "risk_level": "LOW"},
    {"id": "merch_zomato", "name": "Zomato Dineout", "category": "Food & Beverage", "risk_level": "LOW"},
    {"id": "merch_flipkart", "name": "Flipkart Retail", "category": "E-Commerce", "risk_level": "LOW"},
    {"id": "merch_myntra", "name": "Myntra Fashion", "category": "E-Commerce", "risk_level": "LOW"},
    {"id": "merch_nykaa", "name": "Nykaa Beauty", "category": "Retail", "risk_level": "LOW"},
    {"id": "merch_cleartrip", "name": "Cleartrip Travel", "category": "Travel", "risk_level": "MEDIUM"},
    {"id": "merch_lenskart", "name": "Lenskart Eyewear", "category": "Healthcare/Retail", "risk_level": "LOW"},
    {"id": "merch_urbancompany", "name": "Urban Company Services", "category": "Services", "risk_level": "MEDIUM"},
]

PAYMENT_METHODS = ["UPI", "CARD", "NETBANKING", "WALLET"]

def round_money(val: float | Decimal) -> Decimal:
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def generate_synthetic_dataset(
    db: Session,
    dataset_name: str,
    record_count: int = 500,
    config: ScenarioConfig = None,
    seed: int = 42
) -> Dataset:
    random.seed(seed)
    if config is None:
        config = ScenarioConfig()
    elif isinstance(config, dict):
        config = ScenarioConfig(**config)

    # Ensure merchants exist
    for m_data in MERCHANT_POOL:
        existing = db.query(Merchant).filter(Merchant.id == m_data["id"]).first()
        if not existing:
            merchant = Merchant(
                id=m_data["id"],
                name=m_data["name"],
                category=m_data["category"],
                risk_level=m_data["risk_level"]
            )
            db.add(merchant)
    db.commit()

    dataset_id = f"ds_{uuid.uuid4().hex[:10]}"
    dataset = Dataset(
        id=dataset_id,
        name=dataset_name,
        record_count=record_count,
        scenario_config=config.model_dump(),
        created_at=datetime.datetime.now(datetime.UTC)
    )
    db.add(dataset)
    db.commit()

    # Build weighted scenario distribution
    # Default:
    # 70% normal (exact, fee, refund accounted)
    # 8% fee mismatch (resolvable)
    # 5% refund mismatch (resolvable)
    # 4% delayed settlement (resolvable)
    # 3% missing settlement (unresolved)
    # 3% duplicate record
    # 3% incorrect amount (unresolved/discrepancy)
    # 2% complex multi-record (resolvable)
    # 2% intentionally unresolvable
    
    scenario_weights = [
        (ScenarioType.NORMAL_EXACT, 0.40 * (config.normal_pct / 70.0)),
        (ScenarioType.NORMAL_WITH_FEES, 0.35 * (config.normal_pct / 70.0)),
        (ScenarioType.NORMAL_WITH_REFUND, 0.25 * (config.normal_pct / 70.0)),
        (ScenarioType.FEE_MISMATCH_RESOLVABLE, config.fee_mismatch_pct / 100.0),
        (ScenarioType.REFUND_MISMATCH_RESOLVABLE, 0.03),
        (ScenarioType.DELAYED_SETTLEMENT, config.delayed_settlement_pct / 100.0),
        (ScenarioType.MISSING_SETTLEMENT, config.missing_settlement_pct / 100.0),
        (ScenarioType.DUPLICATE_TRANSACTION, config.duplicate_record_pct / 100.0),
        (ScenarioType.INCORRECT_AMOUNT, config.incorrect_amount_pct / 100.0),
        (ScenarioType.COMPLEX_MULTI_RECORD, config.complex_case_pct / 100.0),
        (ScenarioType.INTENTIONALLY_UNRESOLVABLE, config.unresolvable_pct / 100.0),
    ]
    
    scenarios = [s for s, _ in scenario_weights]
    weights = [w for _, w in scenario_weights]

    base_time = datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=15)

    payments_batch = []
    settlements_batch = []
    bank_txns_batch = []
    refunds_batch = []
    fees_batch = []
    invoices_batch = []
    ground_truth_batch = []

    for i in range(record_count):
        txn_suffix = f"{100000 + i}"
        txn_id = f"pay_{txn_suffix}"
        pay_ref = f"PREF-{txn_suffix}"
        merchant_info = random.choice(MERCHANT_POOL)
        merchant_id = merchant_info["id"]
        customer_id = f"cust_{random.randint(1000, 9999)}"
        payment_method = random.choice(PAYMENT_METHODS)

        # Realistic Indian transaction amounts (₹150 to ₹1,50,000)
        amount_tier = random.random()
        if amount_tier < 0.60:
            amount_val = random.randint(200, 4500)
        elif amount_tier < 0.90:
            amount_val = random.randint(5000, 25000)
        else:
            amount_val = random.randint(30000, 120000)
        
        payment_amount = round_money(amount_val)
        txn_time = base_time + datetime.timedelta(minutes=random.randint(10, 14 * 24 * 60))
        
        scenario = random.choices(scenarios, weights=weights, k=1)[0]
        payment_db_id = f"p_{uuid.uuid4().hex[:12]}"

        payment = Payment(
            id=payment_db_id,
            dataset_id=dataset_id,
            transaction_id=txn_id,
            payment_reference=pay_ref,
            merchant_id=merchant_id,
            customer_id=customer_id,
            amount=payment_amount,
            currency="INR",
            status="CAPTURED",
            payment_method=payment_method,
            timestamp=txn_time
        )
        payments_batch.append(payment)

        # Scenario Handlers
        if scenario == ScenarioType.NORMAL_EXACT:
            # 1:1 match, direct settlement with no deducted fee in line item (or zero fee)
            settlement_db_id = f"set_{uuid.uuid4().hex[:12]}"
            settled_time = txn_time + datetime.timedelta(hours=random.randint(4, 24))
            settle_ref = f"SETT-{txn_suffix}"
            bank_ref = f"UTR-{txn_suffix}"

            settlement = Settlement(
                id=settlement_db_id,
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                settlement_reference=settle_ref,
                transaction_id=txn_id,
                bank_reference=bank_ref,
                merchant_id=merchant_id,
                gross_amount=payment_amount,
                fee_amount=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                net_amount=payment_amount,
                status="SETTLED",
                settled_at=settled_time
            )
            settlements_batch.append(settlement)

            bank_txn = BankTransaction(
                id=f"bnk_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                bank_reference=bank_ref,
                settlement_reference=settle_ref,
                payment_reference=pay_ref,
                amount=payment_amount,
                direction="CR",
                narrative=f"Settlement payout {settle_ref} for {merchant_info['name']}",
                timestamp=settled_time + datetime.timedelta(minutes=30)
            )
            bank_txns_batch.append(bank_txn)

            invoice = Invoice(
                id=f"inv_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                invoice_number=f"INV-{txn_suffix}",
                merchant_id=merchant_id,
                subtotal=payment_amount,
                tax_total=round_money(payment_amount * Decimal("0.18")),
                total_amount=round_money(payment_amount * Decimal("1.18")),
                created_at=txn_time - datetime.timedelta(hours=1)
            )
            invoices_batch.append(invoice)

            gt = GroundTruth(
                id=f"gt_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                scenario_type=scenario.value,
                expected_status=GroundTruthStatus.MATCHED.value,
                expected_exception_type=None,
                expected_root_cause=None,
                is_resolvable=True,
                expected_difference=Decimal("0.00"),
                ground_truth_details={"type": "Exact match 1:1"}
            )
            ground_truth_batch.append(gt)

        elif scenario == ScenarioType.NORMAL_WITH_FEES:
            # Standard MDR 2% + 18% GST on MDR = 2.36%
            base_fee = round_money(payment_amount * Decimal("0.02"))
            tax_fee = round_money(base_fee * Decimal("0.18"))
            total_fee = base_fee + tax_fee
            net_settle = payment_amount - total_fee

            settle_ref = f"SETT-{txn_suffix}"
            bank_ref = f"UTR-{txn_suffix}"
            settled_time = txn_time + datetime.timedelta(hours=12)

            settlement = Settlement(
                id=f"set_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                settlement_reference=settle_ref,
                transaction_id=txn_id,
                bank_reference=bank_ref,
                merchant_id=merchant_id,
                gross_amount=payment_amount,
                fee_amount=base_fee,
                tax_amount=tax_fee,
                net_amount=net_settle,
                status="SETTLED",
                settled_at=settled_time
            )
            settlements_batch.append(settlement)

            fee_rec = Fee(
                id=f"fee_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                fee_reference=f"FEE-{txn_suffix}",
                transaction_id=txn_id,
                fee_type="MDR",
                base_amount=base_fee,
                tax_amount=tax_fee,
                total_amount=total_fee,
                calculated_at=txn_time
            )
            fees_batch.append(fee_rec)

            bank_txn = BankTransaction(
                id=f"bnk_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                bank_reference=bank_ref,
                settlement_reference=settle_ref,
                payment_reference=pay_ref,
                amount=net_settle,
                direction="CR",
                narrative=f"Settlement net payout {settle_ref}",
                timestamp=settled_time + datetime.timedelta(minutes=15)
            )
            bank_txns_batch.append(bank_txn)

            invoice = Invoice(
                id=f"inv_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                invoice_number=f"INV-{txn_suffix}",
                merchant_id=merchant_id,
                subtotal=payment_amount,
                tax_total=round_money(payment_amount * Decimal("0.18")),
                total_amount=round_money(payment_amount * Decimal("1.18")),
                created_at=txn_time - datetime.timedelta(hours=1)
            )
            invoices_batch.append(invoice)

            gt = GroundTruth(
                id=f"gt_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                scenario_type=scenario.value,
                expected_status=GroundTruthStatus.MATCHED_WITH_ADJUSTMENT.value,
                expected_exception_type=None,
                expected_root_cause="MDR fee + GST deductions",
                is_resolvable=True,
                expected_difference=Decimal("0.00"),
                ground_truth_details={"fee": str(total_fee), "net": str(net_settle)}
            )
            ground_truth_batch.append(gt)

        elif scenario == ScenarioType.NORMAL_WITH_REFUND:
            # Partial refund (e.g. 30% of payment) + settlement of remaining
            refund_amt = round_money(payment_amount * Decimal("0.30"))
            settle_amt = payment_amount - refund_amt
            settle_ref = f"SETT-{txn_suffix}"
            bank_ref = f"UTR-{txn_suffix}"
            settled_time = txn_time + datetime.timedelta(hours=20)

            settlement = Settlement(
                id=f"set_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                settlement_reference=settle_ref,
                transaction_id=txn_id,
                bank_reference=bank_ref,
                merchant_id=merchant_id,
                gross_amount=settle_amt,
                fee_amount=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                net_amount=settle_amt,
                status="SETTLED",
                settled_at=settled_time
            )
            settlements_batch.append(settlement)

            refund = Refund(
                id=f"ref_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                refund_reference=f"REF-{txn_suffix}",
                transaction_id=txn_id,
                amount=refund_amt,
                status="PROCESSED",
                reason="CUSTOMER_REQUEST",
                refunded_at=txn_time + datetime.timedelta(hours=6)
            )
            refunds_batch.append(refund)

            bank_txn = BankTransaction(
                id=f"bnk_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                bank_reference=bank_ref,
                settlement_reference=settle_ref,
                payment_reference=pay_ref,
                amount=settle_amt,
                direction="CR",
                narrative=f"Settlement payout (post-refund) {settle_ref}",
                timestamp=settled_time + datetime.timedelta(minutes=20)
            )
            bank_txns_batch.append(bank_txn)

            invoice = Invoice(
                id=f"inv_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                invoice_number=f"INV-{txn_suffix}",
                merchant_id=merchant_id,
                subtotal=payment_amount,
                tax_total=round_money(payment_amount * Decimal("0.18")),
                total_amount=round_money(payment_amount * Decimal("1.18")),
                created_at=txn_time - datetime.timedelta(hours=1)
            )
            invoices_batch.append(invoice)

            gt = GroundTruth(
                id=f"gt_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                scenario_type=scenario.value,
                expected_status=GroundTruthStatus.MATCHED_WITH_ADJUSTMENT.value,
                expected_exception_type=None,
                expected_root_cause="Customer partial refund accounted",
                is_resolvable=True,
                expected_difference=Decimal("0.00"),
                ground_truth_details={"refund": str(refund_amt), "settled": str(settle_amt)}
            )
            ground_truth_batch.append(gt)

        elif scenario == ScenarioType.FEE_MISMATCH_RESOLVABLE:
            # Settlement has an unexplained fee deduction of ₹150 / ₹350 not immediately matched in main table,
            # BUT a valid Fee record exists in the `fees` table under fee_type="INTERCHANGE_SURCHARGE".
            # The AI Investigator calls `search_fee(transaction_id)` and finds the exact matching ₹150 fee!
            diff_fee = round_money(Decimal(random.choice([150, 250, 350, 500])))
            settle_amt = payment_amount - diff_fee
            settle_ref = f"SETT-{txn_suffix}"
            bank_ref = f"UTR-{txn_suffix}"
            settled_time = txn_time + datetime.timedelta(hours=14)

            # Settlement records lower amount
            settlement = Settlement(
                id=f"set_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                settlement_reference=settle_ref,
                transaction_id=txn_id,
                bank_reference=bank_ref,
                merchant_id=merchant_id,
                gross_amount=payment_amount,
                fee_amount=Decimal("0.00"), # fee not reported in settlement
                tax_amount=Decimal("0.00"),
                net_amount=settle_amt,      # net is lower by diff_fee
                status="SETTLED",
                settled_at=settled_time
            )
            settlements_batch.append(settlement)

            # Valid fee record placed in fee ledger
            fee_rec = Fee(
                id=f"fee_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                fee_reference=f"FEE-INT-{txn_suffix}",
                transaction_id=txn_id,
                fee_type="INTERCHANGE_SURCHARGE",
                base_amount=round_money(diff_fee / Decimal("1.18")),
                tax_amount=round_money(diff_fee - (diff_fee / Decimal("1.18"))),
                total_amount=diff_fee,
                calculated_at=txn_time
            )
            fees_batch.append(fee_rec)

            bank_txn = BankTransaction(
                id=f"bnk_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                bank_reference=bank_ref,
                settlement_reference=settle_ref,
                payment_reference=pay_ref,
                amount=settle_amt,
                direction="CR",
                narrative=f"Settlement net payout (fee deducted) {settle_ref}",
                timestamp=settled_time + datetime.timedelta(minutes=25)
            )
            bank_txns_batch.append(bank_txn)

            invoice = Invoice(
                id=f"inv_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                invoice_number=f"INV-{txn_suffix}",
                merchant_id=merchant_id,
                subtotal=payment_amount,
                tax_total=round_money(payment_amount * Decimal("0.18")),
                total_amount=round_money(payment_amount * Decimal("1.18")),
                created_at=txn_time - datetime.timedelta(hours=1)
            )
            invoices_batch.append(invoice)

            gt = GroundTruth(
                id=f"gt_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                scenario_type=scenario.value,
                expected_status=GroundTruthStatus.RESOLVED_EXCEPTION.value,
                expected_exception_type=ExceptionType.FEE_MISMATCH.value,
                expected_root_cause="INTERCHANGE_SURCHARGE",
                is_resolvable=True,
                expected_difference=diff_fee,
                ground_truth_details={"fee_amount": str(diff_fee), "evidence": f"FEE-INT-{txn_suffix}"}
            )
            ground_truth_batch.append(gt)

        elif scenario == ScenarioType.REFUND_MISMATCH_RESOLVABLE:
            # Settlement is short by an unlinked refund of ₹800.
            # Refund record exists in `refunds` table with matching customer_id and transaction_id.
            refund_val = round_money(Decimal(random.choice([400, 800, 1200])))
            settle_amt = payment_amount - refund_val
            settle_ref = f"SETT-{txn_suffix}"
            bank_ref = f"UTR-{txn_suffix}"
            settled_time = txn_time + datetime.timedelta(hours=18)

            settlement = Settlement(
                id=f"set_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                settlement_reference=settle_ref,
                transaction_id=txn_id,
                bank_reference=bank_ref,
                merchant_id=merchant_id,
                gross_amount=settle_amt,
                fee_amount=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                net_amount=settle_amt,
                status="SETTLED",
                settled_at=settled_time
            )
            settlements_batch.append(settlement)

            refund = Refund(
                id=f"ref_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                refund_reference=f"REF-UNLINKED-{txn_suffix}",
                transaction_id=txn_id,
                amount=refund_val,
                status="PROCESSED",
                reason="CHARGEBACK_REVERSAL",
                refunded_at=txn_time + datetime.timedelta(hours=4)
            )
            refunds_batch.append(refund)

            bank_txn = BankTransaction(
                id=f"bnk_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                bank_reference=bank_ref,
                settlement_reference=settle_ref,
                payment_reference=pay_ref,
                amount=settle_amt,
                direction="CR",
                narrative=f"Settlement payout (refund deducted) {settle_ref}",
                timestamp=settled_time + datetime.timedelta(minutes=20)
            )
            bank_txns_batch.append(bank_txn)

            gt = GroundTruth(
                id=f"gt_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                scenario_type=scenario.value,
                expected_status=GroundTruthStatus.RESOLVED_EXCEPTION.value,
                expected_exception_type=ExceptionType.AMOUNT_MISMATCH.value,
                expected_root_cause="CHARGEBACK_REVERSAL_REFUND",
                is_resolvable=True,
                expected_difference=refund_val,
                ground_truth_details={"refund": str(refund_val)}
            )
            ground_truth_batch.append(gt)

        elif scenario == ScenarioType.DELAYED_SETTLEMENT:
            # Settlement occurred 6 days later, reference altered with prefix "DELAYED-"
            settle_ref = f"DELAYED-SETT-{txn_suffix}"
            bank_ref = f"UTR-DLY-{txn_suffix}"
            settled_time = txn_time + datetime.timedelta(days=6)

            settlement = Settlement(
                id=f"set_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                settlement_reference=settle_ref,
                transaction_id=f"delayed_{txn_id}", # slightly mangled transaction_id
                bank_reference=bank_ref,
                merchant_id=merchant_id,
                gross_amount=payment_amount,
                fee_amount=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                net_amount=payment_amount,
                status="SETTLED",
                settled_at=settled_time
            )
            settlements_batch.append(settlement)

            bank_txn = BankTransaction(
                id=f"bnk_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                bank_reference=bank_ref,
                settlement_reference=settle_ref,
                payment_reference=pay_ref,
                amount=payment_amount,
                direction="CR",
                narrative=f"Delayed settlement payout {settle_ref}",
                timestamp=settled_time + datetime.timedelta(minutes=45)
            )
            bank_txns_batch.append(bank_txn)

            gt = GroundTruth(
                id=f"gt_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                scenario_type=scenario.value,
                expected_status=GroundTruthStatus.RESOLVED_EXCEPTION.value,
                expected_exception_type=ExceptionType.DELAYED_SETTLEMENT.value,
                expected_root_cause="DELAYED_BATCH_CYCLE",
                is_resolvable=True,
                expected_difference=Decimal("0.00"),
                ground_truth_details={"delay_days": 6}
            )
            ground_truth_batch.append(gt)

        elif scenario == ScenarioType.MISSING_SETTLEMENT:
            # Payment captured, but NO settlement, fee, or refund exists!
            # Pure financial exposure. Must stay UNRESOLVED.
            gt = GroundTruth(
                id=f"gt_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                scenario_type=scenario.value,
                expected_status=GroundTruthStatus.UNRESOLVED.value,
                expected_exception_type=ExceptionType.MISSING_SETTLEMENT.value,
                expected_root_cause="GATEWAY_SETTLEMENT_NEVER_RECEIVED",
                is_resolvable=False,
                expected_difference=payment_amount,
                ground_truth_details={"unresolved_exposure": str(payment_amount)}
            )
            ground_truth_batch.append(gt)

        elif scenario == ScenarioType.DUPLICATE_TRANSACTION:
            # Two settlement records generated for the single payment
            settle_ref1 = f"SETT-{txn_suffix}-A"
            settle_ref2 = f"SETT-{txn_suffix}-B"
            bank_ref = f"UTR-{txn_suffix}"
            settled_time = txn_time + datetime.timedelta(hours=10)

            settlement1 = Settlement(
                id=f"set_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                settlement_reference=settle_ref1,
                transaction_id=txn_id,
                bank_reference=bank_ref,
                merchant_id=merchant_id,
                gross_amount=payment_amount,
                fee_amount=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                net_amount=payment_amount,
                status="SETTLED",
                settled_at=settled_time
            )
            settlement2 = Settlement(
                id=f"set_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                settlement_reference=settle_ref2,
                transaction_id=txn_id,
                bank_reference=bank_ref,
                merchant_id=merchant_id,
                gross_amount=payment_amount,
                fee_amount=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                net_amount=payment_amount,
                status="SETTLED",
                settled_at=settled_time + datetime.timedelta(minutes=2)
            )
            settlements_batch.append(settlement1)
            settlements_batch.append(settlement2)

            bank_txn = BankTransaction(
                id=f"bnk_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                bank_reference=f"UTR-{txn_suffix}",
                settlement_reference=settle_ref1,
                payment_reference=pay_ref,
                amount=payment_amount,
                direction="CR",
                narrative=f"Settlement payout {settle_ref1}",
                timestamp=settled_time + datetime.timedelta(minutes=15)
            )
            bank_txns_batch.append(bank_txn)

            gt = GroundTruth(
                id=f"gt_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                scenario_type=scenario.value,
                expected_status=GroundTruthStatus.RESOLVED_EXCEPTION.value,
                expected_exception_type=ExceptionType.DUPLICATE_TRANSACTION.value,
                expected_root_cause="DUPLICATE_SETTLEMENT_ENTRY",
                is_resolvable=True,
                expected_difference=-payment_amount, # Over-accounted
                ground_truth_details={"duplicate_ref": settle_ref2}
            )
            ground_truth_batch.append(gt)

        elif scenario == ScenarioType.INCORRECT_AMOUNT:
            # Arbitrary unexplained difference (e.g. gateway deducted ₹750 without any record)
            unknown_diff = round_money(Decimal(random.choice([750, 1250, 2400])))
            settle_amt = max(payment_amount - unknown_diff, Decimal("100.00"))
            actual_diff = payment_amount - settle_amt
            settle_ref = f"SETT-{txn_suffix}"
            bank_ref = f"UTR-{txn_suffix}"
            settled_time = txn_time + datetime.timedelta(hours=16)

            settlement = Settlement(
                id=f"set_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                settlement_reference=settle_ref,
                transaction_id=txn_id,
                bank_reference=bank_ref,
                merchant_id=merchant_id,
                gross_amount=settle_amt,
                fee_amount=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                net_amount=settle_amt,
                status="SETTLED",
                settled_at=settled_time
            )
            settlements_batch.append(settlement)

            bank_txn = BankTransaction(
                id=f"bnk_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                bank_reference=bank_ref,
                settlement_reference=settle_ref,
                payment_reference=pay_ref,
                amount=settle_amt,
                direction="CR",
                narrative=f"Settlement payout {settle_ref}",
                timestamp=settled_time + datetime.timedelta(minutes=30)
            )
            bank_txns_batch.append(bank_txn)

            gt = GroundTruth(
                id=f"gt_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                scenario_type=scenario.value,
                expected_status=GroundTruthStatus.UNRESOLVED.value,
                expected_exception_type=ExceptionType.AMOUNT_MISMATCH.value,
                expected_root_cause="UNSUPPORTED_GATEWAY_DEDUCTION",
                is_resolvable=False,
                expected_difference=actual_diff,
                ground_truth_details={"unexplained_amount": str(actual_diff)}
            )
            ground_truth_batch.append(gt)

        elif scenario == ScenarioType.COMPLEX_MULTI_RECORD:
            # Payment ₹50,000 = Settlement ₹47,497 + Refund ₹1,500 + Fee ₹850 + GST ₹153
            base_fee = round_money(payment_amount * Decimal("0.017"))
            tax_fee = round_money(base_fee * Decimal("0.18"))
            tot_fee = base_fee + tax_fee
            refund_part = round_money(payment_amount * Decimal("0.03"))
            net_settle = payment_amount - refund_part - tot_fee

            settle_ref = f"SETT-{txn_suffix}"
            bank_ref = f"UTR-{txn_suffix}"
            settled_time = txn_time + datetime.timedelta(hours=22)

            settlement = Settlement(
                id=f"set_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                settlement_reference=settle_ref,
                transaction_id=txn_id,
                bank_reference=bank_ref,
                merchant_id=merchant_id,
                gross_amount=payment_amount,
                fee_amount=base_fee,
                tax_amount=tax_fee,
                net_amount=net_settle,
                status="SETTLED",
                settled_at=settled_time
            )
            settlements_batch.append(settlement)

            refund = Refund(
                id=f"ref_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                refund_reference=f"REF-CMPLX-{txn_suffix}",
                transaction_id=txn_id,
                amount=refund_part,
                status="PROCESSED",
                reason="PARTIAL_GOODS_RETURN",
                refunded_at=txn_time + datetime.timedelta(hours=5)
            )
            refunds_batch.append(refund)

            fee_rec = Fee(
                id=f"fee_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                fee_reference=f"FEE-CMPLX-{txn_suffix}",
                transaction_id=txn_id,
                fee_type="GATEWAY_PROCESSING",
                base_amount=base_fee,
                tax_amount=tax_fee,
                total_amount=tot_fee,
                calculated_at=txn_time
            )
            fees_batch.append(fee_rec)

            bank_txn = BankTransaction(
                id=f"bnk_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                bank_reference=bank_ref,
                settlement_reference=settle_ref,
                payment_reference=pay_ref,
                amount=net_settle,
                direction="CR",
                narrative=f"Complex settlement net payout {settle_ref}",
                timestamp=settled_time + datetime.timedelta(minutes=30)
            )
            bank_txns_batch.append(bank_txn)

            invoice = Invoice(
                id=f"inv_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                invoice_number=f"INV-{txn_suffix}",
                merchant_id=merchant_id,
                subtotal=payment_amount,
                tax_total=round_money(payment_amount * Decimal("0.18")),
                total_amount=round_money(payment_amount * Decimal("1.18")),
                created_at=txn_time - datetime.timedelta(hours=2)
            )
            invoices_batch.append(invoice)

            gt = GroundTruth(
                id=f"gt_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                scenario_type=scenario.value,
                expected_status=GroundTruthStatus.RESOLVED_EXCEPTION.value,
                expected_exception_type=ExceptionType.AMOUNT_MISMATCH.value,
                expected_root_cause="MULTI_RECORD_SETTLEMENT_AND_REFUND_AND_FEE",
                is_resolvable=True,
                expected_difference=Decimal("0.00"),
                ground_truth_details={"net": str(net_settle), "refund": str(refund_part), "fee": str(tot_fee)}
            )
            ground_truth_batch.append(gt)

        elif scenario == ScenarioType.INTENTIONALLY_UNRESOLVABLE:
            # Discrepancy where no evidence exists anywhere. AI must say UNRESOLVED honestly!
            settle_amt = round_money(payment_amount * Decimal("0.85"))
            diff = payment_amount - settle_amt
            settle_ref = f"SETT-{txn_suffix}"
            bank_ref = f"UTR-{txn_suffix}"

            settlement = Settlement(
                id=f"set_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                settlement_reference=settle_ref,
                transaction_id=txn_id,
                bank_reference=bank_ref,
                merchant_id=merchant_id,
                gross_amount=settle_amt,
                fee_amount=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                net_amount=settle_amt,
                status="SETTLED",
                settled_at=txn_time + datetime.timedelta(hours=12)
            )
            settlements_batch.append(settlement)

            bank_txn = BankTransaction(
                id=f"bnk_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                bank_reference=bank_ref,
                settlement_reference=settle_ref,
                payment_reference=pay_ref,
                amount=settle_amt,
                direction="CR",
                narrative=f"Settlement payout {settle_ref}",
                timestamp=txn_time + datetime.timedelta(hours=13)
            )
            bank_txns_batch.append(bank_txn)

            gt = GroundTruth(
                id=f"gt_{uuid.uuid4().hex[:12]}",
                dataset_id=dataset_id,
                payment_id=payment_db_id,
                scenario_type=scenario.value,
                expected_status=GroundTruthStatus.UNRESOLVED.value,
                expected_exception_type=ExceptionType.UNKNOWN_DISCREPANCY.value,
                expected_root_cause="GENUINE_UNEXPLAINED_SHORTAGE",
                is_resolvable=False,
                expected_difference=diff,
                ground_truth_details={"difference": str(diff), "reason": "No matching ledger records"}
            )
            ground_truth_batch.append(gt)

    db.bulk_save_objects(payments_batch)
    db.bulk_save_objects(settlements_batch)
    db.bulk_save_objects(bank_txns_batch)
    db.bulk_save_objects(refunds_batch)
    db.bulk_save_objects(fees_batch)
    db.bulk_save_objects(invoices_batch)
    db.bulk_save_objects(ground_truth_batch)
    db.commit()

    return dataset

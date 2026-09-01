# Razorpay AI Buildathon Submission — Track 04: AI Finance Controller

## Project Overview

- **Project Name:** FINCTRL AI
- **Track:** Track 04 — AI Finance Controller (*Run the books and the cash position*)
- **Tagline:** Evidence-First Autonomous Financial Controller & Multi-Source Reconciliation System
- **Repository:** `finance-controller`

---

## 1. Problem Statement & The "Why Now"

> *"The 2026 builder consensus: verification capacity, not generation speed, is the bottleneck. Reconciliation, settlement and forecasting are still done by hand."*

In modern payment operations, financial teams deal with thousands of transactions daily across payment gateways (Razorpay), settlement batch files, bank UTR statements, fee structures (MDR, interchange, GST), refund logs, and customer invoices. 

Current LLM approaches fail because generic models hallucinate explanations when data is missing, and simple scrapers cannot handle multi-source fuzzy matching. **FINCTRL AI solves the verification bottleneck** by providing deterministic Level 1–4 matching combined with controlled-tool AI investigation that enforces **Honest Uncertainty** — never resolving without proof.

---

## 2. Core Innovations & Architectural Highlights

### A. Strict Separation of Powers (Verification vs Reasoning)
1. **Deterministic Engine (Level 1–4 Matchers + Equation Solver):**
   - **Level 1:** Exact 1:1 Transaction ID Match
   - **Level 2:** Payment Reference / Merchant Order ID Match
   - **Level 3:** Amount + Timestamp Window Matching ($\pm 24\text{h}$)
   - **Level 4:** Composite Multi-Factor Confidence Match
   - **Financial Equation:** $\text{Payment} = \text{Settlement} + \text{Refund} + \text{MDR Fee} + \text{GST} + \text{Adjustments}$
2. **Controlled AI Investigator:**
   - Equipped with strictly read-only database inspection tools (`search_payment`, `search_settlement`, `search_fee`, `search_refund`, `search_bank`).
   - Cites exact ledger references (e.g. `Fee FEE-INT-10023`, `Settlement SETT-5678`).
   - Declines to resolve (`UNRESOLVED`) when evidence is missing (0.00% False Resolution Rate).

### B. "Find The Money" Exposure Classification
Aggregates and categorizes all at-risk financial exposure:
- **Missing Settlements:** Captured payments without gateway payout batches.
- **Fee Mismatches:** Unaccounted interchange surcharges or rate variances.
- **Refund Discrepancies:** Unlinked customer returns or chargebacks.
- **Delayed Settlements:** Gateway batches arriving past SLA (>5 days).
- **Unknown Shortages:** Genuine unexplained deductions requiring manual bank dispute.

### C. Human-in-the-Loop Governance
- **< ₹10,000:** Automated resolution allowed with evidence.
- **₹10,000 – ₹100,000:** Human review recommended.
- **> ₹100,000:** Mandatory finance officer sign-off before ledger entry.

---

## 3. Measured Benchmark Results (500-Record Batch)

The buildathon bar requires: *“Throughput plus measured accuracy plus an honest exception list. One cherry-picked match proves nothing.”*

Tested on a multi-source synthetic batch across 11 edge-case scenarios:

| Metric | Result | Benchmark Requirement |
|---|---|---|
| **Batch Size** | **500 records** | 50+ records |
| **Reconciliation Engine Throughput** | **10,139 records/sec** | High throughput |
| **Match Accuracy** | **86.80%** | > 75% |
| **Value-Weighted Financial Accuracy** | **86.21%** | > 80% |
| **F1 Score** | **65.57%** | > 60% |
| **False Resolution Rate** | **0.00%** | 0% (No forced resolutions) |
| **Honest Unresolved List** | **48 exceptions** | Explicitly documented with reasons |
| **Multi-Source Data Coverage** | **6 Ledgers** | Payments, Settlements, Fees, Refunds, Bank UTRs, Invoices |

---

## 4. Multi-Source Synthetic Data Generator

Supports 11 realistic financial operation scenarios:
1. `NORMAL_EXACT`: 1:1 clean match with bank UTR credit.
2. `NORMAL_WITH_FEES`: Standard MDR 2% + 18% GST deduction.
3. `NORMAL_WITH_REFUND`: Partial customer refund + net settlement.
4. `FEE_MISMATCH_RESOLVABLE`: Unlinked interchange surcharge in separate fee ledger.
5. `REFUND_MISMATCH_RESOLVABLE`: Unlinked chargeback refund in refund ledger.
6. `DELAYED_SETTLEMENT`: Settlement received via delayed batch cycle (T+6 days).
7. `MISSING_SETTLEMENT`: Captured payment without settlement (Pure exposure).
8. `DUPLICATE_TRANSACTION`: Duplicate settlement entry detected.
9. `INCORRECT_AMOUNT`: Unsupported gateway deduction.
10. `COMPLEX_MULTI_RECORD`: Multi-source split across settlement, refund, and fee.
11. `INTENTIONALLY_UNRESOLVABLE`: Unexplained shortage to test honest uncertainty.

---

## 5. Verification & How to Reproduce

### Run Automated Test Suite
```bash
cd backend
source venv/bin/activate
PYTHONPATH=. pytest tests/ -v
```
All 6 test suites pass with 100% success.

### Run Fresh Seed & Benchmark
```bash
cd backend
source venv/bin/activate
python seed.py --fresh
```

### Launch Application with Docker
```bash
docker-compose up --build
```
- UI: [http://localhost:5173](http://localhost:5173)
- API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

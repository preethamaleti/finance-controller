from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_api_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

def test_full_pipeline_api():
    # 1. Generate Dataset
    gen_res = client.post("/api/datasets/generate", json={"name": "End-to-End Test", "record_count": 50, "seed": 42})
    if gen_res.status_code != 200:
        print("GEN RES ERROR:", gen_res.json())
    assert gen_res.status_code == 200
    dataset = gen_res.json()
    dataset_id = dataset["id"]

    # 2. Run Reconciliation
    recon_res = client.post("/api/reconciliation/run", json={"dataset_id": dataset_id, "auto_investigate": True})
    assert recon_res.status_code == 200
    recon_data = recon_res.json()
    batch_id = recon_data["batch_id"]

    # 3. Dashboard Summary
    dash_res = client.get(f"/api/dashboard/summary?batch_id={batch_id}")
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["total_records"] == 50
    assert len(dash_data["exposure_breakdown"]["categories"]) > 0

    # 4. Exceptions List
    exc_res = client.get(f"/api/exceptions?batch_id={batch_id}")
    assert exc_res.status_code == 200
    exceptions = exc_res.json()
    assert len(exceptions) > 0

    # 5. Detail & Investigation check
    first_exc = exceptions[0]
    detail_res = client.get(f"/api/exceptions/{first_exc['id']}")
    assert detail_res.status_code == 200
    assert detail_res.json()["investigation"] is not None

    # 6. Evaluation Check
    eval_res = client.get(f"/api/evaluation/{batch_id}")
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data["match_accuracy"] > 0
    assert eval_data["value_weighted_accuracy"] > 0

    # 7. Copilot Query
    copilot_res = client.post("/api/copilot/query", json={"query": "How much is unresolved exposure?", "batch_id": batch_id})
    assert copilot_res.status_code == 200
    assert "₹" in copilot_res.json()["answer"]

    # 8. Cash Forecast
    cash_res = client.get(f"/api/cash/forecast?dataset_id={dataset_id}")
    assert cash_res.status_code == 200
    assert len(cash_res.json()["daily_forecast"]) == 30

    # 9. Double-Entry General Ledger (GL) & ERP Journal Entries
    gl_res = client.get(f"/api/reconciliation/{batch_id}/journal-entries")
    assert gl_res.status_code == 200
    gl_data = gl_res.json()
    assert gl_data["is_balanced"] is True
    assert gl_data["total_debits"] == gl_data["total_credits"]
    assert len(gl_data["lines"]) >= 4
    assert any(line["account_code"] == "1010" for line in gl_data["lines"])
    assert any(line["account_code"] == "1200" for line in gl_data["lines"])

    # 10. ERP GL CSV Export
    csv_res = client.get(f"/api/reconciliation/{batch_id}/export-gl?format=csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "Journal_ID,Posting_Date,Account_Code" in csv_res.text

    # 11. Dispute Packet & Escalation Notice
    disp_res = client.get(f"/api/exceptions/{first_exc['id']}/dispute-packet")
    assert disp_res.status_code == 200
    disp_data = disp_res.json()
    assert "disputes@razorpay.com" in disp_data["recipient_email"]
    assert len(disp_data["email_body"]) > 50
    assert disp_data["disputed_exposure"] >= 0

    # 12. Dispute Notice PDF Generation
    pdf_res = client.get(f"/api/exceptions/{first_exc['id']}/dispute-pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert len(pdf_res.content) > 500


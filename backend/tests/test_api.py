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

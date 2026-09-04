import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, SessionLocal
from app.models.entities import ExceptionRecord, DynamicMatchingRule
import uuid
from datetime import datetime

client = TestClient(app)

def test_rules_suggestions():
    # Fetch suggestions
    res = client.get("/api/rules/suggestions")
    assert res.status_code == 200
    data = res.json()
    assert "suggestions" in data
    assert isinstance(data["suggestions"], list)

def test_rules_crud_and_approval():
    db = SessionLocal()
    try:
        rule_id = str(uuid.uuid4())
        rule = DynamicMatchingRule(
            id=rule_id,
            rule_name="Test Auto-Rule",
            rule_type="CUSTOM_MDR_RATE",
            description="Test rule description",
            pattern_condition={"type": "FEE_TOLERANCE", "min_rate": 0.018},
            proposed_action={"action": "AUTO_MATCH"},
            affected_records_count=5,
            saved_exposure_inr=1200.0,
            status="SUGGESTED"
        )
        db.add(rule)
        db.commit()

        # Approve rule
        res = client.post(f"/api/rules/{rule_id}/approve")
        assert res.status_code == 200
        assert res.json()["status"] == "ACTIVE"

        # Check in rules list
        res_list = client.get("/api/rules")
        assert res_list.status_code == 200
        rules = res_list.json()["rules"]
        assert any(r["id"] == rule_id for r in rules)

        # Dismiss / delete
        res_dismiss = client.post(f"/api/rules/{rule_id}/dismiss")
        assert res_dismiss.status_code == 200
        assert res_dismiss.json()["status"] == "DISMISSED"
    finally:
        db.close()

def test_gstr2b_tax_reconciliation():
    res = client.get("/api/tax/gstr2b-reconciliation")
    assert res.status_code == 200
    data = res.json()
    assert "sac_code" in data
    assert data["sac_code"] == "997159"
    assert "invoiced_gst_amount" in data
    assert "calculated_tax_debits" in data
    assert "itc_status" in data

    # Export CSV
    res_csv = client.get("/api/tax/export-gstr2b")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    assert "Supplier_GSTIN" in res_csv.text

def test_dispute_status_lifecycle():
    db = SessionLocal()
    try:
        existing_exc = db.query(ExceptionRecord).first()
        if existing_exc:
            exc_id = existing_exc.id
        else:
            pytest.skip("No exceptions in db to test dispute lifecycle")

        # Update dispute status
        res = client.post(f"/api/exceptions/{exc_id}/dispute-status", json={
            "status": "ESCALATED_TO_GATEWAY",
            "dispute_reference": "RZP-TEST-9999",
            "recovered_amount": 10.0,
            "notes": "Escalated to nodal officer"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["dispute_status"] == "ESCALATED_TO_GATEWAY"
        assert data["dispute_reference"] == "RZP-TEST-9999"
        assert data["recovered_amount"] == 10.0

        # Verify dispute packet reflects new status
        res_packet = client.get(f"/api/exceptions/{exc_id}/dispute-packet")
        assert res_packet.status_code == 200
        packet = res_packet.json()
        assert packet["dispute_status"] == "ESCALATED_TO_GATEWAY"
        assert packet["dispute_reference"] == "RZP-TEST-9999"
    finally:
        db.close()

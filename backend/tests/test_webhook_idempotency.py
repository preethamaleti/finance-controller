import hashlib
import hmac
import json
import uuid

from fastapi.testclient import TestClient

from app.config import settings
from app.database import SessionLocal
from app.main import app
from app.models.entities import BatchRun, Dataset, Payment

client = TestClient(app)


def _post(payload: dict):
    body = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if settings.RAZORPAY_WEBHOOK_SECRET:
        headers["X-Razorpay-Signature"] = hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"), body, hashlib.sha256
        ).hexdigest()
    return client.post("/api/webhooks/razorpay", content=body, headers=headers)


def test_redelivered_payment_captured_is_applied_once():
    pay_id = f"pay_{uuid.uuid4().hex[:14]}"
    payload = {
        "entity": "event",
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": pay_id, "amount": 250000, "currency": "INR", "method": "upi"}}},
    }
    first = _post(payload)
    assert first.status_code == 200
    db = SessionLocal()
    try:
        dataset = db.query(Dataset).order_by(Dataset.created_at.desc()).first()
        batch = db.query(BatchRun).filter(BatchRun.dataset_id == dataset.id).order_by(BatchRun.started_at.desc()).first()
        total_after_first = batch.total_value
    finally:
        db.close()

    for _ in range(2):  # Razorpay retry, then /sync-live replaying the same payment
        again = _post(payload)
        assert again.status_code == 200
        assert again.json()["reconciliation_status"] == "DUPLICATE_IGNORED"

    db = SessionLocal()
    try:
        assert db.query(Payment).filter(Payment.transaction_id == pay_id).count() == 1
        batch = db.query(BatchRun).filter(BatchRun.dataset_id == dataset.id).order_by(BatchRun.started_at.desc()).first()
        assert batch.total_value == total_after_first
    finally:
        db.close()

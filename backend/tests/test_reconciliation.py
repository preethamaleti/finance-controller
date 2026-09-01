import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.entities import Dataset, Payment, Settlement, BatchRun
from app.core.data_generator.generator import generate_synthetic_dataset
from app.core.reconciliation.engine import ReconciliationEngine
from app.core.ai.investigator import AIInvestigator
from app.core.evaluation.engine import EvaluationEngine

TEST_DB_URL = "sqlite:///:memory:"

@pytest.fixture
def db_session():
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()

def test_synthetic_data_generation(db_session):
    dataset = generate_synthetic_dataset(db_session, "Test Dataset", record_count=50, seed=101)
    assert dataset.record_count == 50
    
    payments = db_session.query(Payment).filter(Payment.dataset_id == dataset.id).all()
    assert len(payments) == 50

def test_reconciliation_and_evaluation_loop(db_session):
    dataset = generate_synthetic_dataset(db_session, "Batch 100", record_count=100, seed=42)
    batch_run = ReconciliationEngine.run_batch(db_session, dataset.id)
    
    assert batch_run.records_processed == 100
    assert batch_run.records_matched > 50
    assert batch_run.records_exceptions > 0
    assert float(batch_run.throughput_per_sec) > 0.0

    eval_result = EvaluationEngine.evaluate_batch(db_session, batch_run.id)
    assert float(eval_result.match_accuracy) > 70.0
    assert float(eval_result.value_weighted_accuracy) > 80.0

def test_ai_investigation_and_honest_uncertainty(db_session):
    from app.models.entities import ExceptionRecord, GroundTruth
    
    dataset = generate_synthetic_dataset(db_session, "Investigate Batch", record_count=100, seed=77)
    batch_run = ReconciliationEngine.run_batch(db_session, dataset.id)
    
    exceptions = db_session.query(ExceptionRecord).filter(ExceptionRecord.batch_id == batch_run.id).all()
    assert len(exceptions) > 0

    resolved_count = 0
    unresolved_count = 0

    for exc in exceptions:
        inv = AIInvestigator.investigate_exception(db_session, exc.id)
        assert inv is not None
        assert inv.status in ["RESOLVED", "UNRESOLVED", "ESCALATED"]
        if inv.status == "RESOLVED":
            resolved_count += 1
            assert len(inv.evidence_records) > 0
            assert inv.explained_amount > 0
        elif inv.status == "UNRESOLVED":
            unresolved_count += 1
            assert inv.root_cause in ["UNKNOWN_DISCREPANCY", "GATEWAY_SETTLEMENT_NEVER_RECEIVED", "UNSUPPORTED_GATEWAY_DEDUCTION"]

    assert resolved_count > 0, "AI should resolve resolvable discrepancies with evidence"
    assert unresolved_count > 0, "AI must maintain honest uncertainty for unresolvable discrepancies"


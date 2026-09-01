import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine, Base
import app.models
from app.core.data_generator.generator import generate_synthetic_dataset
from app.core.reconciliation.engine import ReconciliationEngine
from app.core.ai.investigator import AIInvestigator
from app.core.evaluation.engine import EvaluationEngine
from app.models.entities import ExceptionRecord

import argparse

def seed(fresh: bool = False):
    if fresh:
        print("🧹 Resetting database tables...")
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
    else:
        Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("=================================================================")
        print("  FINCTRL AI — Razorpay Buildathon Track 04 Seeder & Benchmark")
        print("=================================================================")
        print("🌱 Generating multi-source synthetic batch (500 records)...")
        dataset = generate_synthetic_dataset(db, "Production Batch Q3", record_count=500, seed=42)
        print(f"✅ Generated dataset {dataset.id} with {dataset.record_count} linked multi-source records.")

        print("\n⚡ Executing Level 1–4 Deterministic Reconciliation Engine...")
        batch_run = ReconciliationEngine.run_batch(db, dataset.id)
        print(f"✅ Reconciled {batch_run.records_processed} records in {batch_run.deterministic_time_sec}s.")
        print(f"⚡ Sustained Throughput: {batch_run.throughput_per_sec} records/second.")

        print("\n🤖 Running Controlled Tool-Use AI Exception Investigator...")
        exceptions = db.query(ExceptionRecord).filter(ExceptionRecord.batch_id == batch_run.id).limit(40).all()
        for exc in exceptions:
            AIInvestigator.investigate_exception(db, exc.id)
        print(f"✅ AI investigated {len(exceptions)} exceptions using live ledger evidence.")

        print("\n📊 Evaluating Batch Against Blind Ground Truth Labels...")
        eval_res = EvaluationEngine.evaluate_batch(db, batch_run.id)
        print("-----------------------------------------------------------------")
        print(f"  🎯 Match Accuracy:           {eval_res.match_accuracy:.2f}%")
        print(f"  💰 Value-Weighted Accuracy:   {eval_res.value_weighted_accuracy:.2f}%")
        print(f"  📈 F1 Score:                  {eval_res.f1_score:.2f}%")
        print(f"  ⚡ Measured Throughput:       {eval_res.throughput_records_per_sec:.1f} rec/s")
        print(f"  🛡️ False Resolution Rate:     {eval_res.false_resolution_rate:.2f}%")
        print(f"  🛑 Honest Unresolved Exceptions: {len(eval_res.unresolved_exceptions_report)}")
        print("-----------------------------------------------------------------")
        print("🚀 System is primed and ready for UI demo & evaluation!")
        print("=================================================================\n")
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed database for FINCTRL AI")
    parser.add_argument("--fresh", action="store_true", help="Drop existing tables before seeding")
    args = parser.parse_args()
    seed(fresh=args.fresh)

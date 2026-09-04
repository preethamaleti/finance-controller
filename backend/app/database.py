from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_migrations():
    from sqlalchemy import text
    with engine.connect() as conn:
        for col_def in [
            "ALTER TABLE exceptions ADD COLUMN dispute_status VARCHAR(50) DEFAULT 'NOT_DISPUTED'",
            "ALTER TABLE exceptions ADD COLUMN recovered_amount NUMERIC(15, 2) DEFAULT 0.00",
            "ALTER TABLE exceptions ADD COLUMN dispute_reference VARCHAR(128)"
        ]:
            try:
                conn.execute(text(col_def))
                conn.commit()
            except Exception:
                pass


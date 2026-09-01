from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.schemas.schemas import AnomalyAlert
from app.core.anomaly.detector import AnomalyDetector

router = APIRouter(prefix="/anomaly", tags=["Anomaly"])

@router.get("/alerts", response_model=List[AnomalyAlert])
def get_anomalies(dataset_id: Optional[str] = None, db: Session = Depends(get_db)):
    return AnomalyDetector.detect_anomalies(db=db, dataset_id=dataset_id)

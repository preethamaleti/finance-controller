from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.schemas.schemas import CashPositionForecast
from app.core.cash.position import CashPositionManager

router = APIRouter(prefix="/cash", tags=["Cash"])

@router.get("/forecast", response_model=CashPositionForecast)
def get_cash_forecast(dataset_id: Optional[str] = None, db: Session = Depends(get_db)):
    return CashPositionManager.get_forecast(db=db, dataset_id=dataset_id)

@router.get("/settlement-aging")
def get_settlement_aging(dataset_id: Optional[str] = None, db: Session = Depends(get_db)):
    return CashPositionManager.get_settlement_aging(db=db, dataset_id=dataset_id)


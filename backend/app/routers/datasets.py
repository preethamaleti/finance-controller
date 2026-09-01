from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.entities import Dataset
from app.schemas.schemas import DatasetGenerateRequest, DatasetResponse
from app.core.data_generator.generator import generate_synthetic_dataset

router = APIRouter(prefix="/datasets", tags=["Datasets"])

@router.post("/generate", response_model=DatasetResponse)
def generate_dataset(req: DatasetGenerateRequest, db: Session = Depends(get_db)):
    try:
        dataset = generate_synthetic_dataset(
            db=db,
            dataset_name=req.name,
            record_count=req.record_count,
            config=req.scenarios,
            seed=req.seed or 42
        )
        return dataset
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=List[DatasetResponse])
def list_datasets(db: Session = Depends(get_db)):
    datasets = db.query(Dataset).order_by(Dataset.created_at.desc()).all()
    return datasets

@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_dataset(dataset_id: str, db: Session = Depends(get_db)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.entities import AuditLog
from app.schemas.schemas import AuditLogResponse

router = APIRouter(prefix="/audit", tags=["Audit"])

@router.get("", response_model=List[AuditLogResponse])
def get_audit_trail(
    batch_id: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if batch_id:
        query = query.filter(AuditLog.batch_id == batch_id)
    
    logs = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    return logs

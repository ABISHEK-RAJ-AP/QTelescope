from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.entities import JobRecordModel
from app.schemas.schemas import JobRecordResponse

router = APIRouter(prefix="/jobs", tags=["Execution Monitoring"])

@router.get("", response_model=List[JobRecordResponse])
def get_jobs(
    backend_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(JobRecordModel)
    if backend_id:
        query = query.filter(JobRecordModel.backend_id == backend_id)
    if status:
        query = query.filter(JobRecordModel.status == status)
    
    return query.order_by(JobRecordModel.submitted_at.desc()).limit(limit).all()

@router.get("/{job_id}", response_model=JobRecordResponse)
def get_job_detail(job_id: str, db: Session = Depends(get_db)):
    job = db.query(JobRecordModel).filter(JobRecordModel.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job record not found")
    return job

@router.get("/{job_id}/status")
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(JobRecordModel).filter(JobRecordModel.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job record not found")
    return {
        "job_id": job.job_id,
        "backend_id": job.backend_id,
        "status": job.status,
        "runtime": job.runtime,
        "failure_reason": job.failure_reason
    }

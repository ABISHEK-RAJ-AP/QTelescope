from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.entities import BackendModel, JobRecordModel
from app.schemas.schemas import JobRecordResponse
from app.analytics.job_failure_taxonomy import (
    classify_failure,
    summarize_failures,
    taxonomy_meta,
    TAXONOMY,
)

router = APIRouter(prefix="/jobs", tags=["Execution Monitoring"])


def _provider_map(db: Session) -> dict:
    rows = db.query(BackendModel.backend_id, BackendModel.provider_id).all()
    return {r.backend_id: r.provider_id for r in rows}


@router.get("/taxonomy")
def get_job_failure_taxonomy():
    return {"categories": taxonomy_meta()}


@router.get("/analytics/failures")
def get_job_failure_analytics(
    backend_id: Optional[str] = None,
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    query = db.query(JobRecordModel)
    if backend_id:
        query = query.filter(JobRecordModel.backend_id == backend_id)
    jobs = query.order_by(JobRecordModel.submitted_at.desc()).limit(limit).all()
    prov = _provider_map(db)
    return summarize_failures(jobs, prov)


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
    
    rows = query.order_by(JobRecordModel.submitted_at.desc()).limit(limit).all()
    prov = _provider_map(db)
    enriched: List[JobRecordResponse] = []
    for job in rows:
        cat = classify_failure(job.status, job.failure_reason, prov.get(job.backend_id))
        enriched.append(
            JobRecordResponse(
                job_id=job.job_id,
                backend_id=job.backend_id,
                status=job.status,
                submitted_at=job.submitted_at,
                started_at=job.started_at,
                completed_at=job.completed_at,
                runtime=job.runtime,
                failure_reason=job.failure_reason,
                failure_category=cat,
                failure_category_label=TAXONOMY[cat]["label"],
                calibration_identifier=job.calibration_identifier,
                tags=job.tags,
            )
        )
    return enriched


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

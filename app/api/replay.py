from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.analytics.temporal_replay import build_replay_timeline, get_frame
from app.core.database import get_db
from app.models.entities import BackendModel

router = APIRouter(prefix="/replay", tags=["Temporal replay"])


@router.get("/{backend_id}/timeline")
def replay_timeline(
    backend_id: str,
    limit: int = Query(80, ge=1, le=200),
    db: Session = Depends(get_db),
):
    if not db.query(BackendModel).filter(BackendModel.backend_id == backend_id).first():
        raise HTTPException(status_code=404, detail="Backend not found")
    out = build_replay_timeline(db, backend_id, limit=limit)
    if out.get("error") == "not_found":
        raise HTTPException(status_code=404, detail="Backend not found")
    return out


@router.get("/{backend_id}/frame/{index}")
def replay_frame(backend_id: str, index: int, db: Session = Depends(get_db)):
    tl = build_replay_timeline(db, backend_id)
    if tl.get("error") == "not_found":
        raise HTTPException(status_code=404, detail="Backend not found")
    frame = get_frame(tl, index)
    if not frame:
        raise HTTPException(status_code=404, detail="Frame index out of range")
    return {
        "backend_id": backend_id,
        "backend_name": tl.get("backend_name"),
        "frame": frame,
        "frame_count": tl.get("frame_count"),
    }

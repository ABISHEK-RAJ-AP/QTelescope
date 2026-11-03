from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends

from app.core.database import get_db
from app.research.evidence_assistant import answer_from_evidence
from app.research.novelty_audit import build_novelty_audit

router = APIRouter(prefix="/research", tags=["Research & evidence Q&A"])


class EvidenceQuestion(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)


@router.get("/novelty-audit")
def get_novelty_audit():
    return build_novelty_audit()


@router.get("/opportunities")
def get_research_opportunities():
    audit = build_novelty_audit()
    return {
        "opportunities": audit["research_opportunities"],
        "capability_gaps": audit["capability_gaps"],
    }


@router.post("/ask")
def ask_evidence_assistant(body: EvidenceQuestion, db: Session = Depends(get_db)):
    """Evidence-only answers from DB + audit metadata — not a generative LLM."""
    return answer_from_evidence(db, body.question)

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field

ValueKind = Literal[
    "exact",
    "calculated",
    "estimated",
    "backend_reported",
    "unavailable",
]


class EpistemicValue(BaseModel):
    value: Optional[Any] = None
    value_kind: ValueKind = "unavailable"
    method: Optional[str] = None
    tool_version: Optional[str] = None
    source_artifact_id: Optional[str] = None
    computed_at: Optional[datetime] = None
    citations: List[str] = Field(default_factory=list)
    notes: Optional[str] = None

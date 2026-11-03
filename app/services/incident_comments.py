"""Append-only incident comments (jsonl) — avoids blocking on Alembic for IMP-P3."""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "incident_comments.jsonl")


def list_comments(incident_id: str) -> List[Dict[str, Any]]:
    if not os.path.isfile(_PATH):
        return []
    out: List[Dict[str, Any]] = []
    with open(_PATH, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if row.get("incident_id") == incident_id:
                out.append(row)
    return sorted(out, key=lambda r: r.get("created_at") or "")


def add_comment(incident_id: str, *, author: str, role: str, text: str) -> Dict[str, Any]:
    os.makedirs(os.path.dirname(_PATH), exist_ok=True)
    row = {
        "comment_id": f"icmt_{uuid.uuid4().hex[:12]}",
        "incident_id": incident_id,
        "author": author,
        "role": role,
        "text": text.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    with open(_PATH, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(row) + "\n")
    return row

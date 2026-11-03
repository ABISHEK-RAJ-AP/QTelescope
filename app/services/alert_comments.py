"""Append-only alert discussion comments (jsonl)."""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "alert_comments.jsonl")


def list_comments(alert_id: str) -> List[Dict[str, Any]]:
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
            if row.get("alert_id") == alert_id:
                out.append(row)
    return sorted(out, key=lambda r: r.get("created_at") or "")


def add_comment(alert_id: str, *, author: str, role: str, text: str) -> Dict[str, Any]:
    os.makedirs(os.path.dirname(_PATH), exist_ok=True)
    row = {
        "comment_id": f"acmt_{uuid.uuid4().hex[:12]}",
        "alert_id": alert_id,
        "author": author,
        "role": role,
        "text": text.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    with open(_PATH, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(row) + "\n")
    return row

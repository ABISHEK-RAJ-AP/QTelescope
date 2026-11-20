"""Per-user concurrent session cap."""
from __future__ import annotations

import os

import pytest

from app.core import sessions as sessions_mod
from app.core.sessions import create_session, list_user_sessions


@pytest.fixture(autouse=True)
def _reset_sessions(monkeypatch):
    monkeypatch.setenv("MAX_SESSIONS_PER_USER", "2")
    monkeypatch.setattr(sessions_mod, "MAX_SESSIONS_PER_USER", 2)
    monkeypatch.setattr(sessions_mod, "_SESSIONS", {})
    yield
    sessions_mod._SESSIONS.clear()


def test_session_cap_drops_oldest():
    t1 = create_session("alice", "Operator")
    t2 = create_session("alice", "Operator")
    t3 = create_session("alice", "Operator")
    rows = list_user_sessions("alice", current_token=t3)
    assert len(rows) == 2
    assert all(r["session_id"] for r in rows)
    assert not any(t1 in str(r) for r in rows)
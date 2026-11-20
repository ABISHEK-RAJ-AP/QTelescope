"""Hybrid demo live-provider merge after credential save."""
from __future__ import annotations

import os

import pytest

from app.core import hybrid_demo as hd


def test_ensure_demo_live_provider_merges(monkeypatch):
    monkeypatch.setenv("HYBRID_DEMO_ENABLED", "true")
    monkeypatch.setenv("DEMO_LIVE_PROVIDERS", "rigetti_quantum")
    merged = hd.ensure_demo_live_provider("ibm_quantum")
    assert merged == ["ibm_quantum", "rigetti_quantum"]
    assert os.getenv("DEMO_LIVE_PROVIDERS") == "ibm_quantum,rigetti_quantum"
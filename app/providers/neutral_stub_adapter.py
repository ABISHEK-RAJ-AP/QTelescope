"""Catalog stub adapter — credentials slot + simulated lineage until a live driver ships."""
from __future__ import annotations

from typing import Any, Dict, List

from app.providers.base import BaseProviderAdapter


class NeutralStubProviderAdapter(BaseProviderAdapter):
    def __init__(self, provider_id: str, display_name: str):
        self.provider_id = provider_id
        self.display_name = display_name
        self.is_authenticated = False

    def lineage_mode(self) -> str:
        return "stub"

    def authenticate(self) -> bool:
        self.is_authenticated = False
        return False

    def discover_backends(self) -> List[Dict[str, Any]]:
        return []

    def get_backend_status(self, backend_id: str) -> Dict[str, Any]:
        return {"backend_id": backend_id, "operational_status": "UNKNOWN"}

    def get_backend_properties(self, backend_id: str) -> Dict[str, Any]:
        return {"backend_id": backend_id}

    def get_connectivity(self, backend_id: str) -> List[Dict[str, int]]:
        return []

    def get_jobs(self, backend_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        return []

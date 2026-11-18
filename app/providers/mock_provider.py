from typing import List, Dict, Any
from app.providers.base import BaseProviderAdapter
from app.core.mock_data import (
    MOCK_HARDWARE_BACKENDS,
    get_mock_backend,
    get_mock_backend_status,
    get_mock_backend_properties,
    get_mock_connectivity,
    get_mock_jobs
)
from app.core.config import settings


def mock_backends_for_provider(provider_id: str) -> List[Dict[str, Any]]:
    return [dict(b) for b in MOCK_HARDWARE_BACKENDS.values() if b.get("provider_id") == provider_id]


class ProviderScopedMockAdapter(BaseProviderAdapter):
    """Simulated catalog for a single provider — used in hybrid demo mode."""

    def __init__(self, provider_id: str):
        self.provider_id = provider_id

    def authenticate(self) -> bool:
        return True

    def lineage_mode(self) -> str:
        return "simulated"

    def discover_backends(self) -> List[Dict[str, Any]]:
        if not settings.ENABLE_MOCK_DATA:
            return []
        return mock_backends_for_provider(self.provider_id)

    def get_backend_status(self, backend_id: str) -> Dict[str, Any]:
        return get_mock_backend_status(backend_id)

    def get_backend_properties(self, backend_id: str) -> Dict[str, Any]:
        return get_mock_backend_properties(backend_id)

    def get_connectivity(self, backend_id: str) -> List[Dict[str, Any]]:
        return get_mock_connectivity(backend_id)

    def get_jobs(self, backend_id: str, limit: int = 15) -> List[Dict[str, Any]]:
        return get_mock_jobs(backend_id, limit=limit)


class MockProviderAdapter(BaseProviderAdapter):
    """
    IBM Quantum Provider Adapter Fallback using centralized mock data repository.
    """
    def authenticate(self) -> bool:
        return True

    def lineage_mode(self) -> str:
        return "simulated"

    def discover_backends(self) -> List[Dict[str, Any]]:
        if not settings.ENABLE_MOCK_DATA:
            return []
        b = get_mock_backend("ibm_brisbane")
        return [b] if b else []

    def get_backend_status(self, backend_id: str) -> Dict[str, Any]:
        return get_mock_backend_status(backend_id)

    def get_backend_properties(self, backend_id: str) -> Dict[str, Any]:
        return get_mock_backend_properties(backend_id)

    def get_connectivity(self, backend_id: str) -> List[Dict[str, Any]]:
        return get_mock_connectivity(backend_id)

    def get_jobs(self, backend_id: str, limit: int = 15) -> List[Dict[str, Any]]:
        return get_mock_jobs(backend_id, limit=limit)

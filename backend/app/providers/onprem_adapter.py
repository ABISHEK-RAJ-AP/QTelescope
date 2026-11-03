import os
from typing import List, Dict, Any
from app.providers.base import BaseProviderAdapter
from app.core.mock_data import (
    get_mock_backend,
    get_mock_backend_status,
    get_mock_backend_properties,
    get_mock_connectivity,
    get_mock_jobs
)
from app.core.config import settings

class OnPremiseProviderAdapter(BaseProviderAdapter):
    """
    C-DAC PARAM QSim & On-Premise Lab Adapter.
    Uses centralized mock data repository when live lab socket is not connected.
    """
    def __init__(self, endpoint_url: str = None):
        self.endpoint_url = endpoint_url or settings.ONPREM_QPU_URL or os.getenv("ONPREM_QPU_URL", "http://localhost:8080")
        self.is_connected = True

    def authenticate(self) -> bool:
        return True

    def discover_backends(self) -> List[Dict[str, Any]]:
        if not settings.ENABLE_MOCK_DATA:
            return []

        b = get_mock_backend("cdac_qsim_param")
        return [b] if b else []

    def get_backend_status(self, backend_id: str) -> Dict[str, Any]:
        return get_mock_backend_status(backend_id)

    def get_backend_properties(self, backend_id: str) -> Dict[str, Any]:
        return get_mock_backend_properties(backend_id)

    def get_connectivity(self, backend_id: str) -> List[Dict[str, Any]]:
        return get_mock_connectivity(backend_id)

    def get_jobs(self, backend_id: str, limit: int = 15) -> List[Dict[str, Any]]:
        return get_mock_jobs(backend_id, limit=limit)

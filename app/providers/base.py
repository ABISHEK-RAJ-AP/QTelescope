from abc import ABC, abstractmethod
from typing import List, Dict, Any

class BaseProviderAdapter(ABC):
    
    @abstractmethod
    def authenticate(self) -> bool:
        """Authenticate with provider APIs."""
        pass
    
    @abstractmethod
    def discover_backends(self) -> List[Dict[str, Any]]:
        """Discover available quantum backends and simulators."""
        pass
        
    @abstractmethod
    def get_backend_status(self, backend_id: str) -> Dict[str, Any]:
        """Fetch operational status, pending jobs, and wait times."""
        pass
        
    @abstractmethod
    def get_backend_properties(self, backend_id: str) -> Dict[str, Any]:
        """Fetch qubit properties (T1, T2, freq, readout error) and gate properties."""
        pass

    @abstractmethod
    def get_connectivity(self, backend_id: str) -> List[Dict[str, int]]:
        """Fetch coupling map connectivity edges."""
        pass

    @abstractmethod
    def get_jobs(self, backend_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Fetch recent job execution records."""
        pass

    def lineage_mode(self) -> str:
        """live | simulated | stub — override per adapter."""
        return "live"

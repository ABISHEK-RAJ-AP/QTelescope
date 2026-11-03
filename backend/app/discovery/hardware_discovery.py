import os
import logging
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.providers.base import BaseProviderAdapter
from app.providers.ibm_adapter import IBMProviderAdapter
from app.providers.rigetti_adapter import RigettiProviderAdapter
from app.providers.ionq_adapter import IonQProviderAdapter
from app.providers.onprem_adapter import OnPremiseProviderAdapter
from app.collectors.telemetry_collector import TelemetryCollector
from app.core.config import settings
from app.models.entities import BackendModel

logger = logging.getLogger("HardwareDiscoveryEngine")

class HardwareDiscoveryEngine:
    """
    Autonomous Quantum Hardware Auto-Discovery & Zero-Touch Environment Probe.
    Detects running QPUs, cloud credentials, on-prem lab controllers, and SDK environments.
    """
    
    @classmethod
    def probe_environment(cls) -> List[Tuple[str, BaseProviderAdapter, str]]:
        """
        Probes environment variables, filesystems, local ports, and SDKs.
        Returns active provider adapters with discovery provenance.
        """
        detected_providers = []

        # 1. IBM Quantum Probe (Flagship Superconducting Transmon)
        ibm_token = settings.IBM_QUANTUM_TOKEN or os.getenv("IBM_QUANTUM_TOKEN", "")
        qiskit_config_path = os.path.expanduser("~/.qiskit/qiskit-ibm.json")
        has_ibm_credentials = bool(ibm_token or os.path.exists(qiskit_config_path))
        ibm_adapter = IBMProviderAdapter(api_token=ibm_token if ibm_token else None)
        detected_providers.append(("ibm_quantum", ibm_adapter, "IBM Quantum Hardware (Cloud/REST/Runtime)" if has_ibm_credentials else "IBM Quantum Architecture"))

        # 2. On-Premise / C-DAC Lab QPU & High-Performance QSim Probe
        onprem_adapter = OnPremiseProviderAdapter(endpoint_url=settings.ONPREM_QPU_URL)
        detected_providers.append(("cdac_quantum", onprem_adapter, "C-DAC Quantum Platform / Local Lab QPU"))

        # 3. Rigetti Computing Probe (QCS / Forest Credentials)
        rigetti_key = settings.RIGETTI_API_KEY or os.getenv("RIGETTI_API_KEY", "") or os.getenv("QCS_API_KEY", "")
        qcs_config_path = os.path.expanduser("~/.qcs/config.toml")
        has_rigetti = bool(rigetti_key or os.path.exists(qcs_config_path))
        rigetti_adapter = RigettiProviderAdapter(api_key=rigetti_key if rigetti_key else None)
        detected_providers.append(("rigetti_quantum", rigetti_adapter, "Rigetti Computing (QCS Forest QPU)" if has_rigetti else "Rigetti Aspen/Ankaa Architecture"))

        # 4. IonQ Trapped-Ion Probe (IonQ Cloud / AWS Braket Key)
        ionq_key = settings.IONQ_API_KEY or os.getenv("IONQ_API_KEY", "")
        ionq_adapter = IonQProviderAdapter(api_key=ionq_key if ionq_key else None)
        detected_providers.append(("ionq_quantum", ionq_adapter, "IonQ Trapped-Ion Hardware" if ionq_key else "IonQ Forte/Aria Architecture"))

        return detected_providers

    @classmethod
    def run_auto_discovery(cls, db: Session) -> Dict[str, Any]:
        """
        Executes full auto-discovery cycle across all detected providers and
        registers live telemetry into the database.
        """
        active_providers = cls.probe_environment()
        discovered_backends_count = 0
        provider_summaries = []

        for prov_id, adapter, prov_name in active_providers:
            try:
                collector = TelemetryCollector(db, provider_adapter=adapter)
                collector.run_full_collection_cycle()
                backends = adapter.discover_backends()
                discovered_backends_count += len(backends)
                provider_summaries.append({
                    "provider_id": prov_id,
                    "provider_name": prov_name,
                    "status": "ONLINE" if len(backends) > 0 else "NO_HARDWARE",
                    "backends_detected": len(backends),
                    "backend_names": [b["backend_name"] for b in backends]
                })
            except Exception as err:
                logger.error(f"Discovery error for provider {prov_id}: {err}")
                provider_summaries.append({
                    "provider_id": prov_id,
                    "provider_name": prov_name,
                    "status": "ERROR",
                    "error": str(err)
                })

        return {
            "status": "SUCCESS",
            "total_backends_discovered": discovered_backends_count,
            "providers": provider_summaries
        }

def ensure_discovered(db: Session):
    """
    Ensures that database state matches the active ENABLE_MOCK_DATA and provider credentials.
    Runs auto-discovery automatically if:
    1. Database is completely empty.
    2. Mock data is DISABLED and database currently contains mock backends that should be pruned.
    """
    try:
        has_any_backends = db.query(BackendModel.backend_id).first() is not None
        if not has_any_backends:
            HardwareDiscoveryEngine.run_auto_discovery(db)
        elif not settings.ENABLE_MOCK_DATA:
            has_mock = db.query(BackendModel.backend_id).filter(
                BackendModel.backend_id.in_(["ibm_brisbane", "rigetti_aspen_m3", "ionq_forte", "cdac_qsim_param"])
            ).first() is not None
            if has_mock:
                HardwareDiscoveryEngine.run_auto_discovery(db)
    except Exception as err:
        logger.error(f"Error during ensure_discovered check: {err}", exc_info=True)

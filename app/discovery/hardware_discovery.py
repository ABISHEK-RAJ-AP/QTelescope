import os
import logging
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.providers.base import BaseProviderAdapter
from app.services.collector_runner import run_provider_collection
from app.services.collector_health import record_provider_run
from app.services.collector_dlq import record_failure as record_collector_dlq
from app.services.circuit_breaker import is_open as circuit_is_open, record_outcome as circuit_record
from app.core.provenance import MOCK_BACKEND_IDS, infer_collection_lineage
from app.providers.ibm_adapter import IBMProviderAdapter
from app.providers.rigetti_adapter import RigettiProviderAdapter
from app.providers.ionq_adapter import IonQProviderAdapter
from app.providers.onprem_adapter import OnPremiseProviderAdapter
from app.collectors.telemetry_collector import TelemetryCollector
from app.core.config import settings
from app.core.deployment import airgap_mode_enabled
from app.core.database import SessionLocal
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

        onprem_adapter = OnPremiseProviderAdapter(endpoint_url=settings.ONPREM_QPU_URL)
        if airgap_mode_enabled():
            return [("cdac_quantum", onprem_adapter, "C-DAC on-prem (air-gap profile)")]

        # 1. IBM Quantum Probe (Flagship Superconducting Transmon)
        ibm_token = settings.IBM_QUANTUM_TOKEN or os.getenv("IBM_QUANTUM_TOKEN", "")
        qiskit_config_path = os.path.expanduser("~/.qiskit/qiskit-ibm.json")
        has_ibm_credentials = bool(ibm_token or os.path.exists(qiskit_config_path))
        ibm_adapter = IBMProviderAdapter(api_token=ibm_token if ibm_token else None)
        detected_providers.append(("ibm_quantum", ibm_adapter, "IBM Quantum Hardware (Cloud/REST/Runtime)" if has_ibm_credentials else "IBM Quantum Architecture"))

        # 2. On-Premise / C-DAC Lab QPU & High-Performance QSim Probe
        detected_providers.append(("cdac_quantum", onprem_adapter, "C-DAC Quantum Platform / Local Lab QPU"))

        # 3. Rigetti Computing Probe (QCS / Forest Credentials)
        rigetti_key = settings.RIGETTI_API_KEY or os.getenv("RIGETTI_API_KEY", "") or os.getenv("QCS_API_KEY", "")
        qcs_config_path = os.path.expanduser("~/.qcs/config.toml")
        has_rigetti = bool(rigetti_key or os.path.exists(qcs_config_path))
        rigetti_adapter = RigettiProviderAdapter(api_key=rigetti_key if rigetti_key else None)
        detected_providers.append((
            "rigetti_quantum",
            rigetti_adapter,
            "Rigetti QCS public ISA" + (" + API token" if has_rigetti else ""),
        ))

        # 4. IonQ Trapped-Ion Probe (IonQ Cloud / AWS Braket Key)
        ionq_key = settings.IONQ_API_KEY or os.getenv("IONQ_API_KEY", "")
        ionq_adapter = IonQProviderAdapter(api_key=ionq_key if ionq_key else None)
        detected_providers.append(("ionq_quantum", ionq_adapter, "IonQ Trapped-Ion Hardware" if ionq_key else "IonQ Forte/Aria Architecture"))

        return detected_providers

    @classmethod
    def run_auto_discovery(cls, db: Session, *, trigger_type: str = "scheduled") -> Dict[str, Any]:
        """
        Executes full auto-discovery cycle across all detected providers and
        registers live telemetry into the database.
        """
        active_providers = cls.probe_environment()
        discovered_backends_count = 0
        provider_summaries = []

        for prov_id, adapter, prov_name in active_providers:
            if circuit_is_open(prov_id):
                provider_summaries.append({
                    "provider_id": prov_id,
                    "provider_name": prov_name,
                    "status": "CIRCUIT_OPEN",
                    "error": "Collector circuit open after repeated failures",
                })
                continue

            def _collect_cycle(ad=adapter) -> Dict[str, Any]:
                local_db = SessionLocal()
                try:
                    collector = TelemetryCollector(local_db, provider_adapter=ad)
                    collector.run_full_collection_cycle()
                    backends = ad.discover_backends()
                    stats = getattr(collector, "_last_cycle_stats", None)
                    return {
                        "backends": backends,
                        "lineage": getattr(collector, "_last_lineage", infer_collection_lineage(backends)),
                        "collection_stats": stats,
                    }
                finally:
                    local_db.close()

            status, outcome, duration_ms = run_provider_collection(prov_id, _collect_cycle)
            backends = outcome.get("backends", []) if status == "OK" else []
            lineage = outcome.get("lineage", "stub") if status == "OK" else None
            err_msg = outcome.get("error") if status != "OK" else None
            coll_stats = outcome.get("collection_stats") if status == "OK" else None

            record_provider_run(
                prov_id,
                status=status,
                duration_ms=duration_ms,
                backends_detected=len(backends),
                lineage=lineage,
                error=err_msg,
                backend_names=[b["backend_name"] for b in backends],
                trigger_type=trigger_type,
                collection_stats=coll_stats,
            )
            circuit_record(prov_id, status)
            if status != "OK":
                record_collector_dlq(
                    prov_id,
                    status=status,
                    error=err_msg,
                    duration_ms=duration_ms,
                )

            if status == "OK":
                discovered_backends_count += len(backends)
                provider_summaries.append({
                    "provider_id": prov_id,
                    "provider_name": prov_name,
                    "status": "ONLINE" if len(backends) > 0 else "NO_HARDWARE",
                    "backends_detected": len(backends),
                    "backend_names": [b["backend_name"] for b in backends],
                    "lineage": lineage,
                    "duration_ms": round(duration_ms, 2),
                })
            else:
                logger.error("Discovery %s for provider %s: %s", status, prov_id, err_msg)
                provider_summaries.append({
                    "provider_id": prov_id,
                    "provider_name": prov_name,
                    "status": status,
                    "error": err_msg,
                    "duration_ms": round(duration_ms, 2),
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
        elif settings.ENABLE_MOCK_DATA:
            ids = {r[0] for r in db.query(BackendModel.backend_id).all()}
            if not MOCK_BACKEND_IDS <= ids:
                HardwareDiscoveryEngine.run_auto_discovery(db)
        elif not settings.ENABLE_MOCK_DATA:
            has_mock = db.query(BackendModel.backend_id).filter(
                BackendModel.backend_id.in_(MOCK_BACKEND_IDS)
            ).first() is not None
            if has_mock:
                HardwareDiscoveryEngine.run_auto_discovery(db)
    except Exception as err:
        logger.error(f"Error during ensure_discovered check: {err}", exc_info=True)

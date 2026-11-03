import uuid
import datetime
from typing import List, Dict, Any
from app.models.entities import AlertModel

class AlertEngine:
    """
    Evaluates rule thresholds against incoming telemetry and creates structured alert events.
    """
    @staticmethod
    def evaluate_telemetry(
        backend_id: str,
        operational: bool,
        pending_jobs: int,
        calibration_freshness: str,
        calibration_age_hours: float,
        qubits_telemetry: List[Dict[str, Any]],
        existing_active_alerts: List[AlertModel]
    ) -> List[AlertModel]:
        
        new_alerts = []
        active_keys = {f"{a.resource_type}:{a.resource_id}:{a.alert_type}" for a in existing_active_alerts}
        now = datetime.datetime.utcnow()

        # Rule 1: Backend Offline
        key = f"BACKEND:{backend_id}:BACKEND_OFFLINE"
        if not operational and key not in active_keys:
            new_alerts.append(AlertModel(
                alert_id=f"alt_{uuid.uuid4().hex[:8]}",
                resource_type="BACKEND",
                resource_id=backend_id,
                alert_type="BACKEND_OFFLINE",
                severity="CRITICAL",
                message=f"Backend {backend_id} is currently offline or unreachable.",
                current_value=0.0,
                threshold_value=1.0,
                detected_at=now,
                status="ACTIVE"
            ))

        # Rule 2: Queue Congestion
        key = f"QUEUE:{backend_id}:HIGH_QUEUE"
        if pending_jobs > 50 and key not in active_keys:
            new_alerts.append(AlertModel(
                alert_id=f"alt_{uuid.uuid4().hex[:8]}",
                resource_type="QUEUE",
                resource_id=backend_id,
                alert_type="HIGH_QUEUE",
                severity="WARNING",
                message=f"Backend {backend_id} pending queue exceeded threshold ({pending_jobs} jobs pending).",
                current_value=float(pending_jobs),
                threshold_value=50.0,
                detected_at=now,
                status="ACTIVE"
            ))

        # Rule 3: Stale Calibration
        key = f"CALIBRATION:{backend_id}:STALE_CALIBRATION"
        if calibration_freshness in ["Stale", "Unknown"] and key not in active_keys:
            new_alerts.append(AlertModel(
                alert_id=f"alt_{uuid.uuid4().hex[:8]}",
                resource_type="CALIBRATION",
                resource_id=backend_id,
                alert_type="STALE_CALIBRATION",
                severity="WARNING",
                message=f"Backend {backend_id} calibration is stale ({calibration_age_hours:.1f} hours old).",
                current_value=calibration_age_hours,
                threshold_value=24.0,
                detected_at=now,
                status="ACTIVE"
            ))

        # Rule 4: Qubit Coherence T1 Drop
        for q in qubits_telemetry:
            q_idx = q.get("qubit_index")
            t1 = q.get("t1")
            if t1 and t1 < 50.0:
                key = f"QUBIT:{backend_id}_Q{q_idx}:LOW_T1"
                if key not in active_keys:
                    new_alerts.append(AlertModel(
                        alert_id=f"alt_{uuid.uuid4().hex[:8]}",
                        resource_type="QUBIT",
                        resource_id=f"{backend_id}_Q{q_idx}",
                        alert_type="LOW_T1",
                        severity="CRITICAL" if t1 < 40.0 else "WARNING",
                        message=f"Qubit Q{q_idx} on {backend_id} T1 coherence dropped to {t1:.1f} µs.",
                        current_value=t1,
                        threshold_value=50.0,
                        detected_at=now,
                        status="ACTIVE"
                    ))

        return new_alerts

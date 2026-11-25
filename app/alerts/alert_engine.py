import uuid
import datetime
from typing import Any, Dict, List, Optional

from app.models.entities import AlertModel


class AlertEngine:
    """Evaluates rule thresholds against incoming telemetry and creates structured alert events."""

    @staticmethod
    def _touch_open(
        active_by_key: Dict[str, AlertModel],
        key: str,
        *,
        message: str,
        current_value: Optional[float],
        threshold_value: Optional[float],
        now: datetime.datetime,
    ) -> None:
        alt = active_by_key.get(key)
        if not alt or (alt.status or "ACTIVE") not in ("ACTIVE", "ACKNOWLEDGED"):
            return
        alt.message = message
        if current_value is not None:
            alt.current_value = current_value
        if threshold_value is not None:
            alt.threshold_value = threshold_value
        alt.detected_at = now

    @staticmethod
    def evaluate_telemetry(
        backend_id: str,
        operational: bool,
        pending_jobs: int,
        calibration_freshness: str,
        calibration_age_hours: float,
        qubits_telemetry: List[Dict[str, Any]],
        existing_active_alerts: List[AlertModel],
        *,
        coherence: Optional[Dict[str, float]] = None,
        queue_threshold: float = 50.0,
        calibration_age_threshold: float = 24.0,
        readout_error_threshold: Optional[float] = None,
        rule_severities: Optional[Dict[str, str]] = None,
    ) -> List[AlertModel]:
        coh = coherence or {"t1_crit_us": 40.0, "t2_crit_us": 30.0, "t1_warn_us": 50.0}
        t1_crit = float(coh.get("t1_crit_us", 40.0))
        t2_crit = float(coh.get("t2_crit_us", 30.0))
        t1_warn = float(coh.get("t1_warn_us", t1_crit + 10.0))
        sev = rule_severities or {}

        new_alerts = []
        active_by_key = {
            f"{a.resource_type}:{a.resource_id}:{a.alert_type}": a
            for a in existing_active_alerts
            if (a.status or "ACTIVE") in ("ACTIVE", "ACKNOWLEDGED")
        }
        active_keys = set(active_by_key.keys())
        now = datetime.datetime.utcnow()

        # Rule 1: Backend Offline
        key = f"BACKEND:{backend_id}:BACKEND_OFFLINE"
        if not operational and key in active_keys:
            AlertEngine._touch_open(
                active_by_key,
                key,
                message=f"Backend {backend_id} is currently offline or unreachable.",
                current_value=0.0,
                threshold_value=1.0,
                now=now,
            )
        elif not operational and key not in active_keys:
            new_alerts.append(
                AlertModel(
                    alert_id=f"alt_{uuid.uuid4().hex[:8]}",
                    resource_type="BACKEND",
                    resource_id=backend_id,
                    alert_type="BACKEND_OFFLINE",
                    severity="CRITICAL",
                    message=f"Backend {backend_id} is currently offline or unreachable.",
                    current_value=0.0,
                    threshold_value=1.0,
                    detected_at=now,
                    status="ACTIVE",
                )
            )

        # Rule 2: Queue Congestion
        key = f"QUEUE:{backend_id}:HIGH_QUEUE"
        if pending_jobs is not None and pending_jobs > queue_threshold and key in active_keys:
            AlertEngine._touch_open(
                active_by_key,
                key,
                message=(
                    f"Backend {backend_id} pending queue exceeded threshold "
                    f"({pending_jobs} jobs pending, limit {queue_threshold:g})."
                ),
                current_value=float(pending_jobs),
                threshold_value=float(queue_threshold),
                now=now,
            )
        elif pending_jobs is not None and pending_jobs > queue_threshold and key not in active_keys:
            new_alerts.append(
                AlertModel(
                    alert_id=f"alt_{uuid.uuid4().hex[:8]}",
                    resource_type="QUEUE",
                    resource_id=backend_id,
                    alert_type="HIGH_QUEUE",
                    severity=sev.get("QUEUE_JOBS", "WARNING"),
                    message=(
                        f"Backend {backend_id} pending queue exceeded threshold "
                        f"({pending_jobs} jobs pending, limit {queue_threshold:g})."
                    ),
                    current_value=float(pending_jobs),
                    threshold_value=float(queue_threshold),
                    detected_at=now,
                    status="ACTIVE",
                )
            )

        # Rule 3: Stale Calibration
        key = f"CALIBRATION:{backend_id}:STALE_CALIBRATION"
        stale_by_age = calibration_age_hours is not None and calibration_age_hours > calibration_age_threshold
        stale_by_label = calibration_freshness in ("Stale", "Unknown")
        if (stale_by_age or stale_by_label) and key in active_keys:
            age_h = float(calibration_age_hours) if calibration_age_hours is not None else 0.0
            AlertEngine._touch_open(
                active_by_key,
                key,
                message=(
                    f"Backend {backend_id} calibration is stale "
                    f"({age_h:.1f} h; limit {calibration_age_threshold:g} h)."
                ),
                current_value=calibration_age_hours,
                threshold_value=float(calibration_age_threshold),
                now=now,
            )
        elif (stale_by_age or stale_by_label) and key not in active_keys:
            new_alerts.append(
                AlertModel(
                    alert_id=f"alt_{uuid.uuid4().hex[:8]}",
                    resource_type="CALIBRATION",
                    resource_id=backend_id,
                    alert_type="STALE_CALIBRATION",
                    severity=sev.get("CALIBRATION_AGE", "WARNING"),
                    message=(
                        f"Backend {backend_id} calibration is stale "
                        f"({calibration_age_hours:.1f} h; limit {calibration_age_threshold:g} h)."
                    ),
                    current_value=calibration_age_hours,
                    threshold_value=float(calibration_age_threshold),
                    detected_at=now,
                    status="ACTIVE",
                )
            )

        for q in qubits_telemetry:
            q_idx = q.get("qubit_index")
            t1 = q.get("t1")
            if t1 is not None and float(t1) < t1_warn:
                key = f"QUBIT:{backend_id}_Q{q_idx}:LOW_T1"
                t1f = float(t1)
                if key in active_keys:
                    AlertEngine._touch_open(
                        active_by_key,
                        key,
                        message=(
                            f"Qubit Q{q_idx} on {backend_id} T1 coherence is {t1f:.1f} µs "
                            f"(critical below {t1_crit:g} µs)."
                        ),
                        current_value=t1f,
                        threshold_value=t1_crit,
                        now=now,
                    )
                elif key not in active_keys:
                    sev_t1 = sev.get("T1", "CRITICAL" if t1f < t1_crit else "WARNING")
                    new_alerts.append(
                        AlertModel(
                            alert_id=f"alt_{uuid.uuid4().hex[:8]}",
                            resource_type="QUBIT",
                            resource_id=f"{backend_id}_Q{q_idx}",
                            alert_type="LOW_T1",
                            severity=sev_t1 if t1f < t1_crit else "WARNING",
                            message=(
                                f"Qubit Q{q_idx} on {backend_id} T1 coherence is {t1f:.1f} µs "
                                f"(critical below {t1_crit:g} µs)."
                            ),
                            current_value=t1f,
                            threshold_value=t1_crit,
                            detected_at=now,
                            status="ACTIVE",
                        )
                    )

            t2 = q.get("t2")
            if t2 is not None and float(t2) < t2_crit:
                key = f"QUBIT:{backend_id}_Q{q_idx}:LOW_T2"
                t2f = float(t2)
                if key in active_keys:
                    AlertEngine._touch_open(
                        active_by_key,
                        key,
                        message=(
                            f"Qubit Q{q_idx} on {backend_id} T2 coherence is {t2f:.1f} µs "
                            f"(below {t2_crit:g} µs)."
                        ),
                        current_value=t2f,
                        threshold_value=t2_crit,
                        now=now,
                    )
                elif key not in active_keys:
                    new_alerts.append(
                        AlertModel(
                            alert_id=f"alt_{uuid.uuid4().hex[:8]}",
                            resource_type="QUBIT",
                            resource_id=f"{backend_id}_Q{q_idx}",
                            alert_type="LOW_T2",
                            severity=sev.get("T2", "CRITICAL"),
                            message=(
                                f"Qubit Q{q_idx} on {backend_id} T2 coherence is {t2f:.1f} µs "
                                f"(below {t2_crit:g} µs)."
                            ),
                            current_value=t2f,
                            threshold_value=t2_crit,
                            detected_at=now,
                            status="ACTIVE",
                        )
                    )

            ro = q.get("readout_error")
            if readout_error_threshold is not None and ro is not None and float(ro) > readout_error_threshold:
                key = f"QUBIT:{backend_id}_Q{q_idx}:HIGH_READOUT"
                rof = float(ro)
                if key in active_keys:
                    AlertEngine._touch_open(
                        active_by_key,
                        key,
                        message=(
                            f"Qubit Q{q_idx} on {backend_id} readout error is {rof:.3f} "
                            f"(above {readout_error_threshold:g})."
                        ),
                        current_value=rof,
                        threshold_value=float(readout_error_threshold),
                        now=now,
                    )
                elif key not in active_keys:
                    new_alerts.append(
                        AlertModel(
                            alert_id=f"alt_{uuid.uuid4().hex[:8]}",
                            resource_type="QUBIT",
                            resource_id=f"{backend_id}_Q{q_idx}",
                            alert_type="HIGH_READOUT",
                            severity=sev.get("READOUT_ERROR", "WARNING"),
                            message=(
                                f"Qubit Q{q_idx} on {backend_id} readout error is {rof:.3f} "
                                f"(above {readout_error_threshold:g})."
                            ),
                            current_value=rof,
                            threshold_value=float(readout_error_threshold),
                            detected_at=now,
                            status="ACTIVE",
                        )
                    )

        return new_alerts

    @staticmethod
    def _alert_backend_id(alert: AlertModel) -> str:
        rid = alert.resource_id or ""
        if alert.resource_type == "QUBIT" and "_Q" in rid:
            return rid.rsplit("_Q", 1)[0]
        return rid

    @staticmethod
    def _qubit_index_from_alert(alert: AlertModel) -> Optional[int]:
        rid = alert.resource_id or ""
        if "_Q" not in rid:
            return None
        try:
            return int(rid.rsplit("_Q", 1)[1])
        except (TypeError, ValueError):
            return None

    @staticmethod
    def resolve_recovered_alerts(
        backend_id: str,
        operational: bool,
        pending_jobs: Optional[int],
        calibration_freshness: str,
        calibration_age_hours: Optional[float],
        qubits_telemetry: List[Dict[str, Any]],
        open_alerts: List[AlertModel],
        *,
        coherence: Optional[Dict[str, float]] = None,
        queue_threshold: float = 50.0,
        calibration_age_threshold: float = 24.0,
        readout_error_threshold: Optional[float] = None,
    ) -> int:
        """Auto-resolve ACTIVE alerts whose underlying condition has cleared (recovery detection)."""
        coh = coherence or {"t1_crit_us": 40.0, "t2_crit_us": 30.0, "t1_warn_us": 50.0}
        t1_crit = float(coh.get("t1_crit_us", 40.0))
        t2_crit = float(coh.get("t2_crit_us", 30.0))
        t1_warn = float(coh.get("t1_warn_us", t1_crit + 10.0))
        q_by_idx = {q.get("qubit_index"): q for q in qubits_telemetry if q.get("qubit_index") is not None}
        now = datetime.datetime.utcnow()
        resolved = 0

        stale_labels = {"Stale", "Unknown"}
        cal_stale = (
            calibration_freshness in stale_labels
            or (
                calibration_age_hours is not None
                and float(calibration_age_hours) > float(calibration_age_threshold)
            )
        )

        for alert in open_alerts:
            if (alert.status or "ACTIVE") != "ACTIVE":
                continue
            if AlertEngine._alert_backend_id(alert) != backend_id:
                continue

            recovered = False
            atype = alert.alert_type

            if atype == "BACKEND_OFFLINE":
                recovered = operational
            elif atype == "HIGH_QUEUE":
                recovered = pending_jobs is None or float(pending_jobs) <= float(queue_threshold)
            elif atype == "STALE_CALIBRATION":
                recovered = not cal_stale
            elif atype in ("LOW_T1", "LOW_T2", "HIGH_READOUT"):
                q_idx = AlertEngine._qubit_index_from_alert(alert)
                q = q_by_idx.get(q_idx) if q_idx is not None else None
                if q is None:
                    continue
                if atype == "LOW_T1":
                    t1 = q.get("t1")
                    recovered = t1 is not None and float(t1) >= t1_warn
                elif atype == "LOW_T2":
                    t2 = q.get("t2")
                    recovered = t2 is not None and float(t2) >= t2_crit
                elif atype == "HIGH_READOUT" and readout_error_threshold is not None:
                    ro = q.get("readout_error")
                    recovered = ro is not None and float(ro) <= float(readout_error_threshold)

            if recovered:
                alert.status = "RESOLVED"
                alert.resolved_at = now
                resolved += 1

        return resolved
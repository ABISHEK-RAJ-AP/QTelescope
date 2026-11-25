import datetime

from app.alerts.alert_engine import AlertEngine
from app.models.entities import AlertModel


def _active(alert_type, resource_type, resource_id, *, status="ACTIVE", current_value=1.0, threshold_value=1.0, **kwargs):
    return AlertModel(
        alert_id="alt_test",
        resource_type=resource_type,
        resource_id=resource_id,
        alert_type=alert_type,
        severity="WARNING",
        message="test",
        current_value=current_value,
        threshold_value=threshold_value,
        detected_at=datetime.datetime.utcnow(),
        status=status,
        **kwargs,
    )


def test_stale_calibration_resolves_when_fresh():
    alt = _active("STALE_CALIBRATION", "CALIBRATION", "ibm_brisbane")
    n = AlertEngine.resolve_recovered_alerts(
        backend_id="ibm_brisbane",
        operational=True,
        pending_jobs=0,
        calibration_freshness="Fresh",
        calibration_age_hours=2.0,
        qubits_telemetry=[],
        open_alerts=[alt],
        calibration_age_threshold=24.0,
    )
    assert n == 1
    assert alt.status == "RESOLVED"
    assert alt.resolved_at is not None


def test_stale_calibration_stays_when_still_stale():
    alt = _active("STALE_CALIBRATION", "CALIBRATION", "ibm_brisbane")
    n = AlertEngine.resolve_recovered_alerts(
        backend_id="ibm_brisbane",
        operational=True,
        pending_jobs=0,
        calibration_freshness="Stale",
        calibration_age_hours=48.0,
        qubits_telemetry=[],
        open_alerts=[alt],
        calibration_age_threshold=24.0,
    )
    assert n == 0
    assert alt.status == "ACTIVE"


def test_low_t2_resolves_when_coherence_recovers():
    alt = _active("LOW_T2", "QUBIT", "ibm_test_Q3")
    n = AlertEngine.resolve_recovered_alerts(
        backend_id="ibm_test",
        operational=True,
        pending_jobs=0,
        calibration_freshness="Fresh",
        calibration_age_hours=1.0,
        qubits_telemetry=[{"qubit_index": 3, "t2": 45.0}],
        open_alerts=[alt],
        coherence={"t2_crit_us": 30.0, "t1_crit_us": 40.0, "t1_warn_us": 50.0},
    )
    assert n == 1
    assert alt.status == "RESOLVED"


def test_active_alert_refreshes_instead_of_duplicate():
    existing = [
        _active("STALE_CALIBRATION", "CALIBRATION", "ibm_brisbane", current_value=30.0, threshold_value=24.0),
    ]
    created = AlertEngine.evaluate_telemetry(
        backend_id="ibm_brisbane",
        operational=True,
        pending_jobs=0,
        calibration_freshness="Stale",
        calibration_age_hours=36.0,
        qubits_telemetry=[],
        existing_active_alerts=existing,
        calibration_age_threshold=24.0,
    )
    assert not created
    assert existing[0].current_value == 36.0


def test_acknowledged_alerts_not_auto_resolved():
    alt = _active(
        "STALE_CALIBRATION",
        "CALIBRATION",
        "ibm_brisbane",
        status="ACKNOWLEDGED",
    )
    n = AlertEngine.resolve_recovered_alerts(
        backend_id="ibm_brisbane",
        operational=True,
        pending_jobs=0,
        calibration_freshness="Fresh",
        calibration_age_hours=2.0,
        qubits_telemetry=[],
        open_alerts=[alt],
        calibration_age_threshold=24.0,
    )
    assert n == 0
    assert alt.status == "ACKNOWLEDGED"
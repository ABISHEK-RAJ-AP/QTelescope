"""Alert engine respects modality-specific coherence floors."""
from app.alerts.alert_engine import AlertEngine
from app.alerts.rule_eval import coherence_thresholds, effective_thresholds


def test_trapped_ion_does_not_alert_at_100ms_t1():
    rules = {}
    coh = coherence_thresholds(rules, "trapped_ion")
    eff = effective_thresholds(rules, "trapped_ion")
    created = AlertEngine.evaluate_telemetry(
        backend_id="ionq_forte",
        operational=True,
        pending_jobs=0,
        calibration_freshness="Fresh",
        calibration_age_hours=1.0,
        qubits_telemetry=[{"qubit_index": 0, "t1": 600_000.0, "t2": 250_000.0}],
        existing_active_alerts=[],
        coherence=coh,
        queue_threshold=float(eff["queue_jobs"]),
        calibration_age_threshold=float(eff["calibration_age_hours"]),
        readout_error_threshold=float(eff["readout_error"]),
    )
    assert not any(a.alert_type == "LOW_T1" for a in created)


def test_superconducting_alerts_below_fleet_t1():
    rules = {}
    coh = coherence_thresholds(rules, "superconducting")
    created = AlertEngine.evaluate_telemetry(
        backend_id="ibm_test",
        operational=True,
        pending_jobs=0,
        calibration_freshness="Fresh",
        calibration_age_hours=1.0,
        qubits_telemetry=[{"qubit_index": 1, "t1": 35.0}],
        existing_active_alerts=[],
        coherence=coh,
        queue_threshold=50.0,
        calibration_age_threshold=24.0,
        readout_error_threshold=0.08,
    )
    assert any(a.alert_type == "LOW_T1" and a.severity == "CRITICAL" for a in created)


def test_effective_thresholds_superconducting_vs_ion():
    eff_sc = effective_thresholds({}, "superconducting")
    eff_ion = effective_thresholds({}, "trapped_ion")
    assert eff_sc["t1_crit_us"] == 40.0
    assert eff_ion["t1_crit_us"] >  100_000
    assert eff_sc["t1_t2_from_backend_rules"] is False
    assert eff_ion["t1_t2_from_backend_rules"] is False


def test_simulator_ignores_ion_scale_migrated_t1_rule():
    from types import SimpleNamespace

    rules = {"T1": SimpleNamespace(threshold_value=500_000.0, severity="CRITICAL")}
    coh = coherence_thresholds(rules, "simulator")
    assert coh["t1_crit_us"] == 5.0


def test_ion_ignores_superconducting_migrated_t1_rule():
    from types import SimpleNamespace

    rules = {"T1": SimpleNamespace(threshold_value=40.0, severity="CRITICAL")}
    coh = coherence_thresholds(rules, "trapped_ion")
    assert coh["t1_crit_us"] > 100_000
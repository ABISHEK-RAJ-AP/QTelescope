from app.analytics.health_vector import (
    assess_confidence,
    c_exec,
    eta_cal,
    evaluate_qubit,
    fidelity_limit,
    route,
)


def test_fidelity_limit_srs_example():
    fl = fidelity_limit(200.0, 150.0, 0.05)
    assert abs(fl - (1.0 - (0.05 / 600.0 + 0.05 / 450.0))) < 1e-12


def test_missing_t1_is_unknown_not_green():
    decision = route(None, 40.0, 1.0, 0.1, 0.9)
    assert decision["state"] == "UNKNOWN"
    assert decision["action"] == "HOLD"


def test_t1_below_crit_is_red_quarantine():
    decision = route(31.8, 40.0, 1.0, 0.4, 0.8)
    assert decision["state"] == "RED"
    assert decision["action"] == "ADVISORY_QUARANTINE"


def test_eta_over_1_5_is_yellow():
    fl = fidelity_limit(200.0, 150.0, 0.05)
    eta = eta_cal(0.999, fl)
    assert eta > 1.5
    decision = route(200.0, 40.0, eta, 0.2, 0.8)
    assert decision["state"] == "YELLOW"


def test_c_exec_reference_circuit_finite():
    val = c_exec(0.999, 10, 0.99, 5, 0.02, 10, 20, 0.05, 200.0)
    assert val is not None and 0.7 < val < 0.8


def test_delta_insufficient_history_limits_confidence():
    meta = assess_confidence(t1=100.0, eta=1.0, delta=None, c_value=0.8, t1_history_points=1)
    assert meta["confidence"] == "limited"
    assert meta["delta_cal_status"] == "insufficient_history"


def test_evaluate_qubit_red_on_dropped_t1():
    out = evaluate_qubit(
        t1=11.4, t2=20.0, readout_error=0.02,
        gate_error_1q=0.001, gate_error_2q=0.01,
        t_gate_us=0.05, t1_crit=40.0,
    )
    assert out["state"] == "RED"
    assert out["F_limit"] is not None

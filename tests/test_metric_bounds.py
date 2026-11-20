import random

from app.core.metric_bounds import clamp_positive_time_us, clamp_probability
from app.core.mock_data import get_mock_backend_properties


def test_clamp_probability():
    assert clamp_probability(-0.002) == 0.0
    assert clamp_probability(1.2) == 1.0
    assert clamp_probability(0.014) == 0.014
    assert clamp_probability(None) is None


def test_clamp_positive_time():
    assert clamp_positive_time_us(-5.0) == 0.01
    assert clamp_positive_time_us(235.0) == 235.0
    assert clamp_positive_time_us(None) is None


def test_mock_telemetry_physical_ranges():
    random.seed(99)
    for backend_id in ("ibm_brisbane", "cdac_qsim_param", "ionq_forte", "rigetti_aspen_m3"):
        props = get_mock_backend_properties(backend_id)
        for q in props["qubits"]:
            assert q["t1"] > 0, (backend_id, q["qubit_index"], "t1", q["t1"])
            assert q["t2"] > 0, (backend_id, q["qubit_index"], "t2", q["t2"])
            ro = q["readout_error"]
            assert ro is not None and 0.0 <= ro <= 1.0, (backend_id, q["qubit_index"], "readout", ro)
            for key in ("prob_meas0_prep1", "prob_meas1_prep0"):
                p = q[key]
                assert 0.0 <= p <= 1.0, (backend_id, key, p)
        for g in props["gates"]:
            er = g["error_rate"]
            assert 0.0 <= er <= 1.0, (backend_id, g["gate_name"], er)
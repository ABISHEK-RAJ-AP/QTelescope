import random

from app.core.metric_bounds import clamp_probability
from app.core.mock_data import get_mock_backend_properties


def test_clamp_probability():
    assert clamp_probability(-0.002) == 0.0
    assert clamp_probability(1.2) == 1.0
    assert clamp_probability(0.014) == 0.014
    assert clamp_probability(None) is None


def test_mock_readout_error_non_negative():
    random.seed(42)
    for backend_id in ("ibm_brisbane", "cdac_qsim_param", "ionq_forte", "rigetti_aspen_m3"):
        props = get_mock_backend_properties(backend_id)
        for q in props["qubits"]:
            ro = q["readout_error"]
            assert ro is not None
            assert 0.0 <= ro <= 1.0, (backend_id, q["qubit_index"], ro)
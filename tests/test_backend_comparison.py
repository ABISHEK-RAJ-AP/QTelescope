"""Compare pair deltas align with per-qubit medians."""
from app.analytics.backend_comparison import build_comparison


def _backend(bid, mod, qubits):
    return {
        "backend_id": bid,
        "backend_name": bid,
        "qpu_modality": mod,
        "vector": {},
        "counts": {},
        "qubits": qubits,
    }


def test_pair_t1_delta_uses_qubit_medians_not_coherence_mean():
    vec = [
        _backend(
            "a",
            "superconducting",
            [{"t1": 100.0, "t2": 80.0, "F_limit": 0.99}, {"t1": 200.0, "t2": 90.0, "F_limit": 0.98}],
        ),
        _backend(
            "b",
            "superconducting",
            [{"t1": 300.0, "t2": 70.0, "F_limit": 0.97}, {"t1": 500.0, "t2": 60.0, "F_limit": 0.96}],
        ),
    ]
    coherence = [
        {"backend_id": "a", "t1_mean": 110.0, "t2_mean": 85.0, "n": 2},
        {"backend_id": "b", "t1_mean": 450.0, "t2_mean": 65.0, "n": 2},
    ]
    out = build_comparison(vec, coherence, ["a", "b"])
    pair = out["pairs"][0]
    assert pair["delta"]["t1_median_us"] == -250.0
    assert pair["delta"]["t2_median_us"] == 20.0
    assert pair["delta"]["F_limit"] == -0.01
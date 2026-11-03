from app.analytics.health_explain import explain_backend, explain_qubit


def test_explain_qubit_red():
    vec = {
        "qubit_index": 3,
        "t1": 35.0,
        "state": "RED",
        "action": "ADVISORY_QUARANTINE",
        "reasons": ["T1 35.0 µs < T1_crit 40.0 µs"],
        "F_limit": 0.99,
        "eta_cal": 1.1,
        "delta_cal": 0.2,
        "C_exec": 0.8,
        "confidence": "high",
        "missing_components": [],
    }
    out = explain_qubit(vec, t1_crit=40.0)
    assert out["router_state"] == "RED"
    assert any(c["id"] == "t1" and c["status"] == "BREACH" for c in out["components"])


def test_explain_backend_dominant_reason():
    backend = {
        "backend_id": "b1",
        "backend_name": "B1",
        "router": "YELLOW",
        "recommended_action": "RECALIBRATE",
        "confidence": "limited",
        "counts": {"YELLOW": 2},
        "vector": {},
        "qubits": [
            {"qubit_index": 0, "state": "YELLOW", "reasons": ["η_cal 1.60 > 1.5"], "t1": 100.0},
            {"qubit_index": 1, "state": "YELLOW", "reasons": ["η_cal 1.60 > 1.5"], "t1": 100.0},
        ],
    }
    out = explain_backend(backend, t1_crit=40.0)
    assert out["dominant_reasons"][0]["qubit_count"] == 2

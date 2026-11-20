import pytest

from app.analytics.backend_comparison import build_comparison


def _vec(bid, mod, fl=0.99):
    return {
        "backend_id": bid,
        "backend_name": bid,
        "qpu_modality": mod,
        "router": "GREEN",
        "vector": {"F_limit": fl, "eta_cal": 1.1, "delta_cal": 0.5, "C_exec": 0.9},
    }


def _coh(bid, t1=100.0):
    return {"backend_id": bid, "t1_mean": t1, "t2_mean": 80.0, "n": 5}


def test_same_modality_allows_ranking():
    vec = [_vec("a", "superconducting"), _vec("b", "superconducting", fl=0.97)]
    coh = [_coh("a"), _coh("b", t1=90.0)]
    out = build_comparison(vec, coh, ["a", "b"])
    assert out["same_modality_selection"] is True
    assert out["pairs"][0]["ranking_allowed"] is True
    assert out["pairs"][0]["delta"]["F_limit"] == pytest.approx(0.02)


def test_cross_modality_blocks_ranking():
    vec = [_vec("a", "superconducting"), _vec("b", "trapped_ion")]
    coh = [_coh("a"), _coh("b", t1=1e6)]
    out = build_comparison(vec, coh, ["a", "b"])
    assert out["same_modality_selection"] is False
    assert out["pairs"][0]["ranking_allowed"] is False


def test_three_backends_yields_three_pairs():
    vec = [_vec("a", "superconducting"), _vec("b", "superconducting", fl=0.97), _vec("c", "superconducting", fl=0.96)]
    coh = [_coh("a"), _coh("b"), _coh("c", t1=95.0)]
    out = build_comparison(vec, coh, ["a", "b", "c"])
    assert len(out["backends"]) == 3
    assert len(out["pairs"]) == 3
    assert out["same_modality_selection"] is True
    assert "routing_gates" in out and out["routing_gates"]["c_exec_min"] == 0.5
    assert "routing_summary" in out and "alert" in out["routing_summary"].lower()

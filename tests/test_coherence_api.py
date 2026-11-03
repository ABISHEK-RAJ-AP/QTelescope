from collections import defaultdict

from app.analytics.health_vector import mean_or_none


def _group_by_modality(backend_rows):
    """Mirror /health/coherence aggregation for unit test."""
    modality_buckets = defaultdict(lambda: {"t1": [], "t2": [], "backend_ids": []})
    for row in backend_rows:
        mod = row.get("qpu_modality") or "unknown"
        modality_buckets[mod]["backend_ids"].append(row["backend_id"])
        if row.get("t1_mean") is not None:
            modality_buckets[mod]["t1"].append(row["t1_mean"])
        if row.get("t2_mean") is not None:
            modality_buckets[mod]["t2"].append(row["t2_mean"])
    return [
        {
            "qpu_modality": mod,
            "backend_count": len(b["backend_ids"]),
            "t1_mean_of_backend_means": mean_or_none(b["t1"]),
        }
        for mod, b in sorted(modality_buckets.items())
    ]


def test_modality_groups_do_not_mix_backends():
    rows = [
        {"backend_id": "a", "qpu_modality": "superconducting", "t1_mean": 100.0, "t2_mean": 80.0},
        {"backend_id": "b", "qpu_modality": "trapped_ion", "t1_mean": 1e6, "t2_mean": 1e6},
    ]
    groups = _group_by_modality(rows)
    assert len(groups) == 2
    sc = next(g for g in groups if g["qpu_modality"] == "superconducting")
    ion = next(g for g in groups if g["qpu_modality"] == "trapped_ion")
    assert sc["t1_mean_of_backend_means"] == 100.0
    assert ion["t1_mean_of_backend_means"] == 1e6

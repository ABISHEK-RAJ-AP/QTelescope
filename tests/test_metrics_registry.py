from app.metrics.registry import METRIC_REGISTRY, list_metrics
from app.metrics.capabilities import metrics_for_provider, provider_capability_matrix


def test_registry_has_t1():
    assert "t1_us" in METRIC_REGISTRY
    assert len(list_metrics()) == len(METRIC_REGISTRY)


def test_ibm_supports_t1_not_t2_echo():
    ibm = metrics_for_provider("ibm_quantum")
    assert "t1_us" in ibm
    assert "t2_echo_us" not in ibm


def test_capability_matrix_lists_live_providers():
    rows = provider_capability_matrix()
    live = [r for r in rows if r["adapter"] == "live"]
    assert len(live) >= 4

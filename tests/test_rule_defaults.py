from app.alerts.rule_defaults import default_rules_for_backend, rule_id_for
from app.alerts.rule_eval import coherence_thresholds, effective_thresholds


def test_default_rules_ion_t1_not_microseconds():
    specs = {r["metric_name"]: r for r in default_rules_for_backend("ionq_forte", "trapped_ion", "hardware")}
    assert specs["T1"]["threshold_value"] >= 100_000


def test_rule_id_includes_backend():
    assert rule_id_for("ibm_fez", "T1") == "rule_ibm_fez_t1"


def test_coherence_uses_per_backend_rule_values():
    class Row:
        threshold_value = 123.0

    rules = {"T1": Row(), "T2": Row()}
    coh = coherence_thresholds(rules, "superconducting")
    assert coh["t1_crit_us"] == 123.0
    eff = effective_thresholds(rules, "superconducting")
    assert eff["t1_t2_from_backend_rules"] is True
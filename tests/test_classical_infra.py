from app.infra.classical_metrics import classical_infra_for_backend, sample_classical_metrics


def test_ibm_has_no_classical_infra():
    assert classical_infra_for_backend("ibm_brisbane", "ibm_quantum", "hardware") is None


def test_cdac_has_classical_infra():
    row = classical_infra_for_backend("cdac_qsim_param", "cdac_quantum", "simulator", 64)
    assert row is not None
    assert row["telemetry_source"] == "simulated:param_hpc"
    assert row["qubits_simulated"] == 64


def test_deterministic_with_seed():
    a = sample_classical_metrics("cdac_qsim_param", 32, seed=1)
    b = sample_classical_metrics("cdac_qsim_param", 32, seed=1)
    assert a["cpu_util_pct"] == b["cpu_util_pct"]

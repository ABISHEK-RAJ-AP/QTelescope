from app.analytics.job_failure_taxonomy import classify_failure, summarize_failures


def test_cancelled_status():
    assert classify_failure("CANCELLED", None) == "cancelled"


def test_ibm_transpile_hint():
    assert (
        classify_failure(
            "FAILED",
            "Transpilation failed: invalid instruction on basis gate u3",
            "ibm_quantum",
        )
        == "compile_validation"
    )


def test_summarize_counts():
    jobs = [
        {"job_id": "j1", "backend_id": "b1", "status": "FAILED", "failure_reason": "timeout"},
        {"job_id": "j2", "backend_id": "b1", "status": "COMPLETED", "failure_reason": None},
    ]
    out = summarize_failures(jobs, {"b1": "ibm_quantum"})
    assert out["total_failed"] == 1
    assert out["by_category"][0]["category_id"] == "timeout"

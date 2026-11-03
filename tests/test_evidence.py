from app.evidence.snapshot_builder import package_evidence_zip, _sha256, _json_bytes


def test_evidence_zip_has_manifest_and_hashes():
    payload = {
        "provenance": {"platform_data_mode": "simulated"},
        "scope": {"backend_id": None},
        "backends": [{"backend_id": "ibm_brisbane"}],
        "alerts": [],
        "incidents": [],
        "calibrations": [],
        "qubit_summary": [],
        "queue_telemetry_samples": [],
        "data_quality_notes": {"simulated_backends": ["ibm_brisbane"]},
    }
    zip_bytes, manifest = package_evidence_zip("ev_test123", payload)
    assert manifest["snapshot_id"] == "ev_test123"
    assert manifest["package_sha256"] == _sha256(zip_bytes)
    assert "backends.json" in manifest["files"]
    assert len(zip_bytes) > 200

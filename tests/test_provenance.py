from app.core.provenance import (
    MOCK_BACKEND_IDS,
    format_telemetry_source,
    infer_collection_lineage,
    parse_telemetry_source,
    platform_data_mode,
)


def test_format_telemetry_source():
    assert format_telemetry_source("live", "ibm_quantum") == "live:ibm_quantum"
    assert format_telemetry_source("simulated", "ionq_quantum") == "simulated:ionq_quantum"


def test_infer_collection_lineage_simulated():
    backends = [{"backend_id": bid} for bid in MOCK_BACKEND_IDS]
    assert infer_collection_lineage([backends[0]]) == "simulated"


def test_infer_collection_lineage_live():
    assert infer_collection_lineage([{"backend_id": "ibm_kyoto"}]) == "live"


def test_infer_collection_lineage_stub():
    assert infer_collection_lineage([]) == "stub"


def test_parse_telemetry_source():
    assert parse_telemetry_source("live:rigetti_quantum") == {
        "lineage": "live",
        "provider_id": "rigetti_quantum",
    }


def test_platform_data_mode():
    assert platform_data_mode(True, False) == "simulated"
    assert platform_data_mode(True, True) == "mixed"
    assert platform_data_mode(False, True) == "live"

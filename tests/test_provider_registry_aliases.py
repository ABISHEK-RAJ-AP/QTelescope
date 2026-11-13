"""Live provider aliases resolve to one class. Stubs stay stubs."""
from app.providers.registry import adapter_for_provider


def test_live_aliases_share_one_class():
    ibm, _ = adapter_for_provider("ibm")
    ibm_q, _ = adapter_for_provider("ibm_quantum")
    assert type(ibm).__name__ == "IBMProviderAdapter"
    assert type(ibm_q).__name__ == "IBMProviderAdapter"
    onprem, _ = adapter_for_provider("onprem")
    cdac, _ = adapter_for_provider("cdac_quantum")
    assert type(onprem).__name__ == "OnPremiseProviderAdapter"
    assert type(cdac).__name__ == "OnPremiseProviderAdapter"


def test_catalog_stub_is_not_a_live_class():
    stub, name = adapter_for_provider("aws_braket")
    assert type(stub).__name__ == "NeutralStubProviderAdapter"
    assert name

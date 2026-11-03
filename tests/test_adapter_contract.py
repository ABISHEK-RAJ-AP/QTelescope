import pytest

from app.core.config import settings
from app.providers.mock_provider import MockProviderAdapter
from app.providers.ionq_adapter import IonQProviderAdapter
from app.providers.onprem_adapter import OnPremiseProviderAdapter
from app.providers.rigetti_adapter import RigettiProviderAdapter
from app.providers.sdk.contract import run_adapter_contract


def _enable_mock(monkeypatch):
    monkeypatch.setenv("ENABLE_MOCK_DATA", "true")
    monkeypatch.setattr(
        type(settings),
        "ENABLE_MOCK_DATA",
        property(lambda self: True),
    )


def test_mock_adapter_contract(monkeypatch):
    _enable_mock(monkeypatch)
    result = run_adapter_contract(MockProviderAdapter(), probe_backend_id="ibm_brisbane")
    assert result["ok"], result["errors"]
    assert result["lineage_mode"] == "simulated"


@pytest.mark.parametrize(
    "adapter_cls,probe_id,lineage",
    [
        (RigettiProviderAdapter, "rigetti_aspen_m3", "live"),
        (IonQProviderAdapter, "ionq_forte", "simulated"),
        (OnPremiseProviderAdapter, "cdac_qsim_param", "simulated"),
    ],
)
def test_vendor_mock_path_contract(monkeypatch, adapter_cls, probe_id, lineage):
    _enable_mock(monkeypatch)
    result = run_adapter_contract(adapter_cls(), probe_backend_id=probe_id)
    assert result["ok"], result["errors"]
    assert result["lineage_mode"] == lineage

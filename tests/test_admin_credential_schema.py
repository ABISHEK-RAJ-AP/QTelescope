import pytest
from pydantic import ValidationError

from app.api.admin import BackendCatalogPatch, GenericCredentialSchema


def test_generic_credential_normalizes_provider():
    m = GenericCredentialSchema(provider_id=" IBM_Quantum ", token="x" * 8)
    assert m.provider_id == "ibm_quantum"


def test_generic_credential_rejects_long_token():
    with pytest.raises(ValidationError):
        GenericCredentialSchema(provider_id="ibm_quantum", token="x" * 5000)


def test_catalog_patch_caps_tags():
    with pytest.raises(ValidationError):
        BackendCatalogPatch(tags=["t"] * 33)

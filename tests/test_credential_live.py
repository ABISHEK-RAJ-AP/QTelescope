from __future__ import annotations

from app.providers.credential_live import env_keys_to_persist, normalize_provider_id, resolve_token


def test_normalize_provider_aliases():
    assert normalize_provider_id("IBM") == "ibm_quantum"
    assert normalize_provider_id("rigetti") == "rigetti_quantum"


def test_resolve_token_prefers_submitted(monkeypatch):
    monkeypatch.setenv("IBM_QUANTUM_TOKEN", "from-env")
    assert resolve_token("ibm_quantum", "from-form") == "from-form"
    assert resolve_token("ibm_quantum", None) == "from-env"


def test_env_keys_to_persist_ibm():
    keys = env_keys_to_persist("ibm_quantum", "secret-key", "")
    assert keys == [("IBM_QUANTUM_TOKEN", "secret-key")]
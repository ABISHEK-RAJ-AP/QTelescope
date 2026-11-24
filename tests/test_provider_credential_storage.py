import json
import os

import pytest

from app.core import secret_box
from app.providers import catalog


@pytest.fixture
def creds_path(tmp_path, monkeypatch):
    path = tmp_path / "provider_credentials.json"
    monkeypatch.setattr(catalog, "CREDS_PATH", str(path))
    monkeypatch.setattr(catalog, "DATA_DIR", str(tmp_path))
    return path


def test_upsert_stores_encrypted_not_plaintext(creds_path):
    catalog.upsert_stored("ibm_quantum", "super-secret-api-key", "https://example.test", None)
    raw = json.loads(creds_path.read_text(encoding="utf-8"))
    row = raw["ibm_quantum"]
    assert "token" not in row
    assert row["token_enc"].startswith("gAAAA")
    assert "super-secret-api-key" not in creds_path.read_text(encoding="utf-8")
    assert catalog.stored_secret_token("ibm_quantum") == "super-secret-api-key"


def test_public_extra_never_returns_api_token(creds_path):
    catalog.upsert_stored("ibm_quantum", "leak-me-not", "https://endpoint.example", None)
    spec = catalog.catalog_by_id("ibm_quantum")
    fields = (spec or {}).get("fields") or [{"key": "api_key", "in": "token", "secret": True}]
    fields = list(fields) + [{"key": "alias", "in": "token", "secret": False}]
    out = catalog.public_extra("ibm_quantum", fields)
    blob = json.dumps(out)
    assert "leak-me-not" not in blob


def test_migrate_plaintext_on_load(creds_path):
    creds_path.write_text(
        json.dumps({"ibm_quantum": {"token": "legacy-plain", "endpoint_url": "", "extra": {}}}),
        encoding="utf-8",
    )
    catalog.load_stored()
    raw = json.loads(creds_path.read_text(encoding="utf-8"))
    assert "token" not in raw["ibm_quantum"]
    assert catalog.stored_secret_token("ibm_quantum") == "legacy-plain"
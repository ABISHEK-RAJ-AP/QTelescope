"""Audit log search API helper."""
import json

from app.core.audit_log import record_audit, search_audit


def test_search_audit_filters(monkeypatch, tmp_path):
    path = tmp_path / "audit.jsonl"
    monkeypatch.setattr("app.core.audit_log._AUDIT_PATH", str(path))

    def _inspect(_eng):
        class _Insp:
            def has_table(self, _name):
                return False

        return _Insp()

    monkeypatch.setattr("app.core.audit_log.inspect", _inspect)
    record_audit("password.reset", actor="alice", resource_type="user", resource_id="alice")
    record_audit("mfa.enroll", actor="bob", resource_type="user", resource_id="bob")
    assert len(search_audit(limit=10)) == 2
    assert len(search_audit(actor="alice")) == 1
    assert search_audit(q="mfa")[0]["action"] == "mfa.enroll"

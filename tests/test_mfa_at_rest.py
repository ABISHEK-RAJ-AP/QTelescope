"""MFA TOTP secrets must not appear plaintext in user_mfa.json when encryption is on."""
import json
import uuid

from app.core import secret_box, user_mfa


def test_mfa_enroll_writes_encrypted_secret(monkeypatch, tmp_path):
    monkeypatch.setattr(user_mfa, "_PATH", str(tmp_path / "mfa.json"))
    monkeypatch.setenv("MFA_ENCRYPT_AT_REST", "true")
    uname = f"enc_{uuid.uuid4().hex[:8]}"
    secret, _, _ = user_mfa.start_enroll(uname)
    code = user_mfa._totp_code(secret)
    ok, _ = user_mfa.confirm_enroll(uname, code)
    assert ok

    raw = json.loads(tmp_path.joinpath("mfa.json").read_text(encoding="utf-8"))
    row = raw[uname]
    assert "secret" not in row
    assert secret_box.mfa_secret_field() in row
    assert secret not in json.dumps(raw)

    assert user_mfa.verify_login_code(uname, code)


def test_mfa_plaintext_migration(monkeypatch, tmp_path):
    path = tmp_path / "mfa.json"
    monkeypatch.setattr(user_mfa, "_PATH", str(path))
    monkeypatch.setenv("MFA_ENCRYPT_AT_REST", "true")
    secret = "JBSWY3DPEHPK3PXP"
    path.write_text(
        json.dumps(
            {
                "legacy_user": {
                    "enabled": True,
                    "secret": secret,
                    "backup_hashes": [],
                }
            }
        ),
        encoding="utf-8",
    )
    code = user_mfa._totp_code(secret)
    assert user_mfa.verify_login_code("legacy_user", code)

    raw = json.loads(path.read_text(encoding="utf-8"))
    assert "secret" not in raw["legacy_user"]
    assert secret_box.mfa_secret_field() in raw["legacy_user"]

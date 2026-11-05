from app.core.ldap_auth import authenticate_ldap, ldap_enabled, ldap_public_status


def test_ldap_off_by_default(monkeypatch):
    monkeypatch.delenv("LDAP_URL", raising=False)
    assert ldap_enabled() is False
    assert ldap_public_status()["enabled"] is False
    assert authenticate_ldap("alice", "secret") is None


def test_ldap_login_uses_directory_when_local_fails(monkeypatch):
    monkeypatch.setenv("LDAP_URL", "ldap://ldap.example.test")
    monkeypatch.setenv("LDAP_USER_DN", "uid={username},ou=people,dc=example,dc=test")
    monkeypatch.setenv("LDAP_DEFAULT_ROLE", "OpsEngineer")
    assert ldap_enabled() is True
    assert ldap_public_status()["host"] == "ldap.example.test"

    def fake_bind(username, password):
        if username == "alice" and password == "secret":
            return {
                "username": "alice",
                "role": "OpsEngineer",
                "extra": {"email": "", "full_name": "alice", "org": "Directory", "auth_source": "ldap"},
            }
        return None

    monkeypatch.setattr("app.core.ldap_auth.authenticate_ldap", fake_bind)
    from app.core import ldap_auth as mod
    assert mod.authenticate_ldap("alice", "secret")["role"] == "OpsEngineer"

import json
import os

from app.core.database import Base, SessionLocal, engine
from app.core import user_store
from app.models.entities import UserAccountModel
import app.models.entities  # noqa: F401


def test_upsert_and_load_user_db(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("USE_DB_USERS", "true")
    monkeypatch.setenv("USE_ALEMBIC", "false")

    # Rebind engine for this test module's isolated sqlite file
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    test_engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=test_engine)
    monkeypatch.setattr("app.core.database.engine", test_engine)
    monkeypatch.setattr("app.core.user_store.engine", test_engine)
    Session = sessionmaker(bind=test_engine)
    monkeypatch.setattr("app.core.database.SessionLocal", Session)
    monkeypatch.setattr("app.core.user_store.SessionLocal", Session)

    user_store.upsert_user(
        "tester",
        {
            "email": "t@example.com",
            "full_name": "Test",
            "org": "C-DAC",
            "role": "Operator",
            "password_hash": "abc",
        },
    )
    users = user_store.load_all_users()
    assert "tester" in users
    assert users["tester"]["email"] == "t@example.com"


def test_migrate_json_users(tmp_path, monkeypatch):
    db_path = tmp_path / "m.db"
    json_path = tmp_path / "registered_users.json"
    json_path.write_text(
        json.dumps(
            {
                "alice": {
                    "email": "a@x.com",
                    "role": "Researcher",
                    "password_hash": "h",
                }
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("USE_DB_USERS", "true")
    monkeypatch.setattr(user_store, "_USERS_JSON", str(json_path))

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    test_engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=test_engine)
    monkeypatch.setattr("app.core.user_store.engine", test_engine)
    Session = sessionmaker(bind=test_engine)
    monkeypatch.setattr("app.core.user_store.SessionLocal", Session)

    n = user_store.migrate_json_users_to_db()
    assert n == 1
    db = Session()
    try:
        assert db.query(UserAccountModel).filter(UserAccountModel.username == "alice").first()
    finally:
        db.close()

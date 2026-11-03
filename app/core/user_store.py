"""Registered users: DB primary with JSON file fallback/migration (IMP-P4)."""
from __future__ import annotations

import json
import os
import threading
from typing import Any, Dict

from sqlalchemy import inspect

from app.core.database import SessionLocal, engine
from app.models.entities import UserAccountModel

_LOCK = threading.Lock()
_USERS_JSON = os.path.join(os.path.dirname(__file__), "..", "..", "data", "registered_users.json")


def use_db_users() -> bool:
    return os.getenv("USE_DB_USERS", "true").lower().strip() in ("1", "true", "yes")


def _users_table_ready() -> bool:
    try:
        return inspect(engine).has_table("user_accounts")
    except Exception:
        return False


def _load_json_users() -> Dict[str, Dict[str, Any]]:
    path = os.path.abspath(_USERS_JSON)
    if not os.path.exists(path):
        return {}
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _save_json_users(users: Dict[str, Dict[str, Any]]) -> None:
    path = os.path.abspath(_USERS_JSON)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(users, fh, indent=2)
    os.replace(tmp, path)


def _row_to_dict(row: UserAccountModel) -> Dict[str, Any]:
    return {
        "username": row.username,
        "email": row.email,
        "full_name": row.full_name,
        "org": row.org,
        "role": row.role,
        "password_hash": row.password_hash,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def migrate_json_users_to_db() -> int:
    if not _users_table_ready():
        return 0
    db = SessionLocal()
    try:
        if db.query(UserAccountModel).count() > 0:
            return 0
        raw = _load_json_users()
        if not raw:
            return 0
        for username, rec in raw.items():
            db.add(
                UserAccountModel(
                    username=username,
                    email=rec.get("email") or f"{username}@local",
                    full_name=rec.get("full_name"),
                    org=rec.get("org"),
                    role=rec.get("role") or "Operator",
                    password_hash=rec.get("password_hash") or "",
                )
            )
        db.commit()
        return len(raw)
    finally:
        db.close()


def load_all_users() -> Dict[str, Dict[str, Any]]:
    if use_db_users() and _users_table_ready():
        db = SessionLocal()
        try:
            migrate_json_users_to_db()
            rows = db.query(UserAccountModel).all()
            return {r.username: _row_to_dict(r) for r in rows}
        finally:
            db.close()
    return _load_json_users()


def upsert_user(username: str, record: Dict[str, Any]) -> None:
    with _LOCK:
        if use_db_users() and _users_table_ready():
            db = SessionLocal()
            try:
                row = db.query(UserAccountModel).filter(UserAccountModel.username == username).first()
                if row:
                    row.email = record.get("email") or row.email
                    row.full_name = record.get("full_name")
                    row.org = record.get("org")
                    row.role = record.get("role") or row.role
                    row.password_hash = record.get("password_hash") or row.password_hash
                else:
                    db.add(
                        UserAccountModel(
                            username=username,
                            email=record.get("email") or f"{username}@local",
                            full_name=record.get("full_name"),
                            org=record.get("org"),
                            role=record.get("role") or "Operator",
                            password_hash=record.get("password_hash") or "",
                        )
                    )
                db.commit()
            finally:
                db.close()
            return
        users = _load_json_users()
        users[username] = record
        _save_json_users(users)

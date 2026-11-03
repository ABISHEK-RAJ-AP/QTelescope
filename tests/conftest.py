"""Test defaults — SQLite in-memory unless DATABASE_URL is set (avoids Postgres at import)."""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ["CACHE_ENABLED"] = "false"
os.environ["REDIS_URL"] = ""
os.environ["VALKEY_URL"] = ""

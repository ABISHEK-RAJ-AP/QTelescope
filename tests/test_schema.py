import os

from sqlalchemy import create_engine, inspect

from app.core.schema import apply_schema
import app.models.entities  # noqa: F401


def test_apply_schema_sqlite_create_all_fallback():
    os.environ["USE_ALEMBIC"] = "false"
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    apply_schema(engine)
    assert inspect(engine).has_table("backends")

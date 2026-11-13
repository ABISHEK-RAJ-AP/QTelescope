"""Apply database schema — Alembic when available, else create_all (tests/dev fallback)."""
from __future__ import annotations

import logging
import os
from pathlib import Path

from sqlalchemy.engine import Engine

from app.core.database import Base
import app.models.entities  # noqa: F401
import app.models.development  # noqa: F401

logger = logging.getLogger("schema")


def apply_schema(engine: Engine) -> None:
    use_alembic = os.getenv("USE_ALEMBIC", "true").lower() in ("1", "true", "yes")
    if use_alembic:
        _alembic_upgrade(engine)
    # Alembic changes columns. Model metadata creates any table a migration has not added yet.
    Base.metadata.create_all(bind=engine)
    from app.core.user_store import migrate_json_users_to_db

    migrate_json_users_to_db()


def _alembic_upgrade(engine: Engine) -> None:
    try:
        from alembic.config import Config
        from alembic import command
    except ImportError:
        logger.warning("Alembic not installed — create_all only")
        return

    root = Path(__file__).resolve().parents[2]
    ini = root / "alembic.ini"
    if not ini.is_file():
        logger.warning("alembic.ini missing — create_all only")
        return

    cfg = Config(str(ini))
    cfg.set_main_option("script_location", str(root / "alembic"))
    url = os.getenv("DATABASE_URL") or str(engine.url)
    cfg.set_main_option("sqlalchemy.url", url)
    from alembic.runtime.migration import MigrationContext
    from alembic.script import ScriptDirectory

    script = ScriptDirectory.from_config(cfg)
    head = script.get_current_head()
    with engine.connect() as conn:
        current = MigrationContext.configure(conn).get_current_revision()
        if current == head:
            logger.debug("Alembic already at head (%s)", head)
        else:
            # ponytail: sqlite :memory: — Alembic must share app engine connection or schema vanishes
            cfg.attributes["connection"] = conn
            command.upgrade(cfg, "head")
            logger.info("Alembic upgrade head complete")
        conn.commit()

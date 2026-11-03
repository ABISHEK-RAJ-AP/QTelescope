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
    if not use_alembic:
        Base.metadata.create_all(bind=engine)
        _ensure_new_tables(engine)
        return

    try:
        from alembic.config import Config
        from alembic import command
    except ImportError:
        logger.warning("Alembic not installed — falling back to create_all")
        Base.metadata.create_all(bind=engine)
        return

    root = Path(__file__).resolve().parents[2]
    ini = root / "alembic.ini"
    if not ini.is_file():
        logger.warning("alembic.ini missing — falling back to create_all")
        Base.metadata.create_all(bind=engine)
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
        command.upgrade(cfg, "head")
        logger.info("Alembic upgrade head complete")
    _ensure_new_tables(engine)


def _ensure_new_tables(engine: Engine) -> None:
    """Dev helper: create tables added after first deploy if migration was skipped."""
    from sqlalchemy import inspect
    from app.models.entities import EvidenceSnapshotModel, IncidentAlertModel, IncidentModel

    insp = inspect(engine)
    if not insp.has_table("incidents"):
        IncidentModel.__table__.create(bind=engine, checkfirst=True)
        IncidentAlertModel.__table__.create(bind=engine, checkfirst=True)
    if not insp.has_table("evidence_snapshots"):
        EvidenceSnapshotModel.__table__.create(bind=engine, checkfirst=True)
    from app.models.entities import UserAccountModel, AuditEventModel

    if not insp.has_table("user_accounts"):
        UserAccountModel.__table__.create(bind=engine, checkfirst=True)
    if not insp.has_table("audit_events"):
        AuditEventModel.__table__.create(bind=engine, checkfirst=True)
    from app.core.user_store import migrate_json_users_to_db

    migrate_json_users_to_db()
    from app.models.development import (
        CircuitVersionModel,
        CompilationRunModel,
        DevProjectMemberModel,
        DevProjectModel,
        DevProjectRevisionModel,
        PreflightReportModel,
        RegistryTimelineEventModel,
        SimulationJobModel,
        WorkloadModel,
        WorkloadSubmissionModel,
        DevExperimentReportModel,
        ApprovalRecordModel,
    )

    dev_tables = (
        DevProjectModel,
        DevProjectMemberModel,
        DevProjectRevisionModel,
        CircuitVersionModel,
        WorkloadModel,
        CompilationRunModel,
        PreflightReportModel,
        WorkloadSubmissionModel,
        DevExperimentReportModel,
        ApprovalRecordModel,
        SimulationJobModel,
        RegistryTimelineEventModel,
    )
    for model in dev_tables:
        if not insp.has_table(model.__tablename__):
            model.__table__.create(bind=engine, checkfirst=True)

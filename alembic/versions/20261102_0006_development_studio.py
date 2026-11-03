"""Development studio tables (projects, circuits, simulation, workload registry).

Revision ID: 20261102_0006
Revises: 20261102_0005
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20261102_0006"
down_revision: Union[str, None] = "20261102_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DEV_TABLES = (
    "dev_projects",
    "dev_project_members",
    "dev_project_revisions",
    "circuit_versions",
    "workloads",
    "simulation_jobs",
    "registry_timeline_events",
)


def upgrade() -> None:
    from migration_util import table_exists

    import app.models.development  # noqa: F401
    from app.core.database import Base

    bind = op.get_bind()
    for name in _DEV_TABLES:
        if table_exists(name):
            continue
        Base.metadata.tables[name].create(bind=bind)


def downgrade() -> None:
    for name in reversed(_DEV_TABLES):
        op.drop_table(name)

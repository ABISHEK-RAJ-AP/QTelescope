"""dev_experiment_reports table.

Revision ID: 20261102_0008
Revises: 20261102_0007
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20261102_0008"
down_revision: Union[str, None] = "20261102_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from migration_util import table_exists

    import app.models.development  # noqa: F401
    from app.core.database import Base

    if table_exists("dev_experiment_reports"):
        return
    bind = op.get_bind()
    Base.metadata.tables["dev_experiment_reports"].create(bind=bind)


def downgrade() -> None:
    op.drop_table("dev_experiment_reports")

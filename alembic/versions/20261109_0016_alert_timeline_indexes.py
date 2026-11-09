"""Alert list ordering indexes.

Revision ID: 20261109_0016
Revises: 20261103_0015
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20261109_0016"
down_revision: Union[str, None] = "20261103_0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from migration_util import index_exists

    if not index_exists("ix_alerts_status_detected"):
        op.create_index(
            "ix_alerts_status_detected",
            "alerts",
            ["status", "detected_at"],
            unique=False,
        )
    if not index_exists("ix_alerts_detected_at"):
        op.create_index("ix_alerts_detected_at", "alerts", ["detected_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_alerts_detected_at", table_name="alerts")
    op.drop_index("ix_alerts_status_detected", table_name="alerts")

"""alert_rules.backend_id for per-backend rule sets."""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "20261120_0019"
down_revision: Union[str, None] = "20261119_0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if "alert_rules" not in inspect(bind).get_table_names():
        return
    cols = {c["name"] for c in inspect(bind).get_columns("alert_rules")}
    if "backend_id" not in cols:
        op.add_column("alert_rules", sa.Column("backend_id", sa.String(), nullable=True))
        op.create_index("ix_alert_rules_backend_id", "alert_rules", ["backend_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    if "alert_rules" not in inspect(bind).get_table_names():
        return
    cols = {c["name"] for c in inspect(bind).get_columns("alert_rules")}
    if "backend_id" in cols:
        op.drop_index("ix_alert_rules_backend_id", table_name="alert_rules")
        op.drop_column("alert_rules", "backend_id")
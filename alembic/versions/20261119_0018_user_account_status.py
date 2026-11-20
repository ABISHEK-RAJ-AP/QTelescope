"""user_accounts.account_status for registration approval gate."""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "20261119_0018"
down_revision: Union[str, None] = "20261119_0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from migration_util import drop_column_server_default

    bind = op.get_bind()
    if "user_accounts" not in inspect(bind).get_table_names():
        return
    cols = {c["name"] for c in inspect(bind).get_columns("user_accounts")}
    if "account_status" not in cols:
        op.add_column(
            "user_accounts",
            sa.Column("account_status", sa.String(), nullable=False, server_default="active"),
        )
        drop_column_server_default("user_accounts", "account_status")


def downgrade() -> None:
    bind = op.get_bind()
    if "user_accounts" not in inspect(bind).get_table_names():
        return
    cols = {c["name"] for c in inspect(bind).get_columns("user_accounts")}
    if "account_status" in cols:
        op.drop_column("user_accounts", "account_status")
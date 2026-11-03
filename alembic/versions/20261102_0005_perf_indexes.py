"""Telemetry and alert query indexes.

Revision ID: 20261102_0005
Revises: 20261031_0004
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20261102_0005"
down_revision: Union[str, None] = "20261031_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from migration_util import index_exists

    if not index_exists("ix_qubit_telemetry_backend_ts"):
        op.create_index(
            "ix_qubit_telemetry_backend_ts",
            "qubit_telemetry",
            ["backend_id", "timestamp"],
            unique=False,
        )
    if not index_exists("ix_backend_telemetry_backend_ts"):
        op.create_index(
            "ix_backend_telemetry_backend_ts",
            "backend_telemetry",
            ["backend_id", "timestamp"],
            unique=False,
        )
    if not index_exists("ix_alerts_status_severity"):
        op.create_index(
            "ix_alerts_status_severity",
            "alerts",
            ["status", "severity"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index("ix_alerts_status_severity", table_name="alerts")
    op.drop_index("ix_backend_telemetry_backend_ts", table_name="backend_telemetry")
    op.drop_index("ix_qubit_telemetry_backend_ts", table_name="qubit_telemetry")

"""User accounts, audit events, telemetry time-series indexes.

Revision ID: 20261031_0004
Revises: 20261031_0003
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20261031_0004"
down_revision: Union[str, None] = "20261031_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from migration_util import index_exists, table_exists

    if not table_exists("user_accounts"):
        op.create_table(
            "user_accounts",
            sa.Column("username", sa.String(), nullable=False),
            sa.Column("email", sa.String(), nullable=False),
            sa.Column("full_name", sa.String(), nullable=True),
            sa.Column("org", sa.String(), nullable=True),
            sa.Column("role", sa.String(), nullable=False),
            sa.Column("password_hash", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("username"),
        )
    if not index_exists("ix_user_accounts_email"):
        op.create_index("ix_user_accounts_email", "user_accounts", ["email"], unique=False)

    if not table_exists("audit_events"):
        op.create_table(
            "audit_events",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("timestamp", sa.DateTime(), nullable=True),
            sa.Column("action", sa.String(), nullable=False),
            sa.Column("actor", sa.String(), nullable=True),
            sa.Column("role", sa.String(), nullable=True),
            sa.Column("resource_type", sa.String(), nullable=True),
            sa.Column("resource_id", sa.String(), nullable=True),
            sa.Column("detail", sa.JSON(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
    if not index_exists("ix_audit_events_timestamp"):
        op.create_index("ix_audit_events_timestamp", "audit_events", ["timestamp"], unique=False)
    if not index_exists("ix_audit_events_action"):
        op.create_index("ix_audit_events_action", "audit_events", ["action"], unique=False)

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
    if not index_exists("ix_gate_telemetry_backend_ts"):
        op.create_index(
            "ix_gate_telemetry_backend_ts",
            "gate_telemetry",
            ["backend_id", "timestamp"],
            unique=False,
        )
    if not index_exists("ix_alerts_detected_at"):
        op.create_index("ix_alerts_detected_at", "alerts", ["detected_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_alerts_detected_at", table_name="alerts")
    op.drop_index("ix_gate_telemetry_backend_ts", table_name="gate_telemetry")
    op.drop_index("ix_backend_telemetry_backend_ts", table_name="backend_telemetry")
    op.drop_index("ix_qubit_telemetry_backend_ts", table_name="qubit_telemetry")
    op.drop_index("ix_audit_events_action", table_name="audit_events")
    op.drop_index("ix_audit_events_timestamp", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_index("ix_user_accounts_email", table_name="user_accounts")
    op.drop_table("user_accounts")

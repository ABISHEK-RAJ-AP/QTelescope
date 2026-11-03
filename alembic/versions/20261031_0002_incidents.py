"""Incidents and incident_alerts tables.

Revision ID: 20261031_0002
Revises: 20261031_0001
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20261031_0002"
down_revision: Union[str, None] = "20261031_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from migration_util import table_exists

    if table_exists("incidents"):
        return
    op.create_table(
        "incidents",
        sa.Column("incident_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("backend_id", sa.String(), nullable=False),
        sa.Column("severity", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("first_detected_at", sa.DateTime(), nullable=False),
        sa.Column("last_detected_at", sa.DateTime(), nullable=False),
        sa.Column("acknowledged_by", sa.String(), nullable=True),
        sa.Column("owner", sa.String(), nullable=True),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["backend_id"], ["backends.backend_id"]),
        sa.PrimaryKeyConstraint("incident_id"),
    )
    op.create_index("ix_incidents_incident_id", "incidents", ["incident_id"])
    op.create_index("ix_incidents_backend_id", "incidents", ["backend_id"])

    op.create_table(
        "incident_alerts",
        sa.Column("incident_id", sa.String(), nullable=False),
        sa.Column("alert_id", sa.String(), nullable=False),
        sa.Column("linked_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.incident_id"]),
        sa.ForeignKeyConstraint(["alert_id"], ["alerts.alert_id"]),
        sa.PrimaryKeyConstraint("incident_id", "alert_id"),
    )


def downgrade() -> None:
    op.drop_table("incident_alerts")
    op.drop_index("ix_incidents_backend_id", "incidents")
    op.drop_index("ix_incidents_incident_id", "incidents")
    op.drop_table("incidents")

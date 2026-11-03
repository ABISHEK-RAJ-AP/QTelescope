"""Evidence snapshots table.

Revision ID: 20261031_0003
Revises: 20261031_0002
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20261031_0003"
down_revision: Union[str, None] = "20261031_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from migration_util import table_exists

    if table_exists("evidence_snapshots"):
        return
    op.create_table(
        "evidence_snapshots",
        sa.Column("snapshot_id", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=True),
        sa.Column("scope_backend_id", sa.String(), nullable=True),
        sa.Column("period_start", sa.DateTime(), nullable=True),
        sa.Column("period_end", sa.DateTime(), nullable=True),
        sa.Column("manifest_sha256", sa.String(), nullable=False),
        sa.Column("package_sha256", sa.String(), nullable=False),
        sa.Column("storage_path", sa.String(), nullable=False),
        sa.Column("provenance_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("snapshot_id"),
    )
    op.create_index("ix_evidence_snapshots_snapshot_id", "evidence_snapshots", ["snapshot_id"])


def downgrade() -> None:
    op.drop_index("ix_evidence_snapshots_snapshot_id", "evidence_snapshots")
    op.drop_table("evidence_snapshots")

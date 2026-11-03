"""Initial Q-TeleScope schema from SQLAlchemy models.

Revision ID: 20261031_0001
Revises:
Create Date: 2026-10-31

"""
from typing import Sequence, Union

from alembic import op

# ponytail: bootstrap revision — metadata.create_all for first land; future deltas use autogenerate
from app.core.database import Base
import app.models.entities  # noqa: F401

revision: str = "20261031_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)


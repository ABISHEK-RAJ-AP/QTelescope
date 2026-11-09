"""Request-scoped context for structured operator logs."""
from __future__ import annotations

from contextvars import ContextVar

request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")
collector_trigger_ctx: ContextVar[str] = ContextVar("collector_trigger", default="scheduled")

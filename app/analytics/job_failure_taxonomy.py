"""Provider-aware job failure taxonomy — classify raw vendor strings, never invent causes."""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

FAILURE_STATUSES = frozenset({"FAILED", "ERROR", "CANCELLED"})

TAXONOMY: Dict[str, dict] = {
    "cancelled": {
        "label": "Cancelled",
        "description": "User or scheduler cancelled before completion.",
    },
    "timeout": {
        "label": "Timeout",
        "description": "Job or API call exceeded allowed wall time.",
    },
    "queue_capacity": {
        "label": "Queue / capacity",
        "description": "Rejected or delayed due to queue depth or fair-share limits.",
    },
    "calibration_device": {
        "label": "Calibration / device",
        "description": "Device offline, maintenance, or stale calibration context.",
    },
    "compile_validation": {
        "label": "Compile / validation",
        "description": "Transpilation, basis gates, or circuit validation failed.",
    },
    "runtime_execution": {
        "label": "Runtime execution",
        "description": "Failure during shot execution or result assembly.",
    },
    "auth_permission": {
        "label": "Auth / permission",
        "description": "Credentials, IAM, or policy denied the run.",
    },
    "network_upstream": {
        "label": "Network / upstream",
        "description": "Connectivity or upstream service unavailable.",
    },
    "unknown": {
        "label": "Unknown",
        "description": "Failed status with no parseable vendor reason.",
    },
}

# Provider-specific substring hints (first match wins after status rules).
_PROVIDER_HINTS: Dict[str, List[Tuple[str, str]]] = {
    "ibm_quantum": [
        (r"invalid credentials|iam|api key", "auth_permission"),
        (r"transpil|basis gate|invalid instruction", "compile_validation"),
        (r"calibrat|maintenance|not available", "calibration_device"),
    ],
    "rigetti_quantum": [
        (r"qcs|compile|isa", "compile_validation"),
        (r"queue|capacity", "queue_capacity"),
    ],
    "ionq_quantum": [
        (r"validation|unsupported gate", "compile_validation"),
    ],
    "cdac_quantum": [
        (r"param|simulator offline", "calibration_device"),
    ],
}

_RULES: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"\bcancel(l)?ed\b", re.I), "cancelled"),
    (re.compile(r"timeout|timed?\s*out|deadline", re.I), "timeout"),
    (re.compile(r"queue|capacity|fair.?share|throttl", re.I), "queue_capacity"),
    (re.compile(r"calibrat|maintenance|offline|not available|device", re.I), "calibration_device"),
    (re.compile(r"transpil|compile|validation|invalid circuit|basis gate", re.I), "compile_validation"),
    (re.compile(r"auth|token|permission|forbidden|unauthorized|401|403", re.I), "auth_permission"),
    (re.compile(r"network|connection|upstream|502|503|504|socket", re.I), "network_upstream"),
    (re.compile(r"runtime|execution|failed to run|job error", re.I), "runtime_execution"),
]


def classify_failure(
    status: str,
    failure_reason: Optional[str],
    provider_id: Optional[str] = None,
) -> str:
    st = (status or "").upper()
    if st == "CANCELLED":
        return "cancelled"
    if st not in FAILURE_STATUSES:
        return "unknown"
    text = (failure_reason or "").strip()
    if not text:
        return "unknown"
    pid = provider_id or ""
    for pattern, cat in _PROVIDER_HINTS.get(pid, []):
        if re.search(pattern, text, re.I):
            return cat
    for pattern, cat in _RULES:
        if pattern.search(text):
            return cat
    return "unknown"


def taxonomy_meta() -> List[dict]:
    return [{"category_id": k, **v} for k, v in TAXONOMY.items()]


def summarize_failures(
    jobs: List[Any],
    provider_by_backend: Dict[str, str],
) -> Dict[str, Any]:
    """Aggregate failed job records (ORM or dict-like)."""
    by_category: Dict[str, int] = {k: 0 for k in TAXONOMY}
    by_provider: Dict[str, Dict[str, int]] = {}
    recent: List[dict] = []

    for job in jobs:
        status = getattr(job, "status", None) or job.get("status")
        if (status or "").upper() not in FAILURE_STATUSES:
            continue
        bid = getattr(job, "backend_id", None) or job.get("backend_id")
        prov = provider_by_backend.get(bid or "", "unknown")
        reason = getattr(job, "failure_reason", None) or job.get("failure_reason")
        cat = classify_failure(status, reason, prov)
        by_category[cat] = by_category.get(cat, 0) + 1
        by_provider.setdefault(prov, {k: 0 for k in TAXONOMY})
        by_provider[prov][cat] = by_provider[prov].get(cat, 0) + 1
        if len(recent) < 20:
            recent.append(
                {
                    "job_id": getattr(job, "job_id", None) or job.get("job_id"),
                    "backend_id": bid,
                    "provider_id": prov,
                    "status": status,
                    "failure_category": cat,
                    "failure_category_label": TAXONOMY[cat]["label"],
                    "failure_reason": reason,
                }
            )

    total = sum(by_category.values())
    return {
        "total_failed": total,
        "by_category": [
            {"category_id": k, "label": TAXONOMY[k]["label"], "count": by_category[k]}
            for k in TAXONOMY
            if by_category[k]
        ],
        "by_provider": [
            {
                "provider_id": pid,
                "counts": [{"category_id": c, "count": n} for c, n in buckets.items() if n],
            }
            for pid, buckets in sorted(by_provider.items())
        ],
        "recent": recent,
        "methodology": "Categories inferred from status + failure_reason text; vendor strings are not rewritten.",
    }

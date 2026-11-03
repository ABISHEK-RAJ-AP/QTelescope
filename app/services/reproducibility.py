from __future__ import annotations

from typing import Any, Dict, List


def completeness_check(manifest: Dict[str, Any]) -> Dict[str, Any]:
    required = ["execution_class", "tool"]
    missing: List[str] = []
    for key in required:
        if not manifest or manifest.get(key) in (None, ""):
            missing.append(key)
    if manifest.get("execution_class") == "simulated" and not manifest.get("tool_version") and manifest.get("tool") != "builtin-stub":
        missing.append("tool_version")
    return {
        "complete": len(missing) == 0,
        "missing_fields": missing,
    }


def simulation_budget_check(project_settings: Dict[str, Any], shots: int, platform_max: int) -> Dict[str, Any]:
    sim = (project_settings or {}).get("simulation") or {}
    max_shots = int(sim.get("max_shots") or platform_max)
    warn_at = int(sim.get("warn_shots") or min(max_shots, 8192))
    out: Dict[str, Any] = {"allowed": True, "warnings": [], "max_shots": max_shots}
    if shots > max_shots:
        out["allowed"] = False
        out["warnings"].append(f"shots {shots} exceeds project max {max_shots}")
    elif shots >= warn_at:
        out["warnings"].append(f"shots {shots} at or above warn threshold {warn_at}")
    return out

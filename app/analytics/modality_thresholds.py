"""Modality-aware coherence floors for routing and alerts.

Superconducting QPUs use microsecond-scale T1; trapped ions use millisecond–second scale.
A single 40 µs T1_crit would mis-label healthy ion qubits as CRITICAL.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

# Reference defaults (µs). Superconducting aligns with seeded rule_t1 (40) / rule_t2 (30).
_MODALITY: Dict[str, Dict[str, float]] = {
    "superconducting": {"t1_crit_us": 40.0, "t2_crit_us": 30.0, "t1_warn_us": 50.0},
    "trapped_ion": {"t1_crit_us": 500_000.0, "t2_crit_us": 200_000.0, "t1_warn_us": 1_000_000.0},
    "neutral_atom": {"t1_crit_us": 50_000.0, "t2_crit_us": 25_000.0, "t1_warn_us": 80_000.0},
    "simulator": {"t1_crit_us": 5.0, "t2_crit_us": 5.0, "t1_warn_us": 10.0},
}

_ALIASES = {
    "trapped-ion": "trapped_ion",
    "trappedion": "trapped_ion",
    "neutral-atom": "neutral_atom",
}


def normalize_modality(modality: Optional[str]) -> str:
    raw = (modality or "superconducting").strip().lower().replace(" ", "_")
    return _ALIASES.get(raw, raw)


def modality_profile(modality: Optional[str]) -> Dict[str, float]:
    key = normalize_modality(modality)
    return dict(_MODALITY.get(key, _MODALITY["superconducting"]))


def t1_crit_us(modality: Optional[str], global_superconducting_rule: Optional[float] = None) -> float:
    """Health router T1 floor. DB rule_t1 applies to superconducting only."""
    prof = modality_profile(modality)
    if normalize_modality(modality) == "superconducting" and global_superconducting_rule is not None:
        return float(global_superconducting_rule)
    return prof["t1_crit_us"]


def t2_crit_us(modality: Optional[str], global_rule: Optional[float] = None) -> float:
    prof = modality_profile(modality)
    if normalize_modality(modality) == "superconducting" and global_rule is not None:
        return float(global_rule)
    return prof["t2_crit_us"]


def threshold_summary(modality: Optional[str]) -> Dict[str, Any]:
    key = normalize_modality(modality)
    prof = modality_profile(modality)
    return {
        "modality": key,
        "t1_crit_us": prof["t1_crit_us"],
        "t2_crit_us": prof["t2_crit_us"],
        "t1_warn_us": prof["t1_warn_us"],
        "scope": "modality_default",
    }


if __name__ == "__main__":
    assert t1_crit_us("trapped_ion", 40.0) > 10_000
    assert t1_crit_us("superconducting", 40.0) == 40.0
    print("modality_thresholds self-check ok")
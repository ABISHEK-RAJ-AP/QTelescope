"""Load enabled alert rules and resolve thresholds (fleet rules + modality floors)."""
from __future__ import annotations

import math
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.analytics.modality_thresholds import modality_profile, normalize_modality
from app.models.entities import AlertRuleModel


def load_rules(db: Session, backend_id: Optional[str] = None) -> Dict[str, AlertRuleModel]:
    q = db.query(AlertRuleModel).filter(AlertRuleModel.enabled.is_(True))
    if backend_id:
        q = q.filter(AlertRuleModel.backend_id == backend_id)
    else:
        q = q.filter(AlertRuleModel.backend_id.is_(None))
    rows = q.all()
    return {r.metric_name.upper(): r for r in rows}


def rule_threshold(rules: Dict[str, AlertRuleModel], metric: str, default: float) -> float:
    row = rules.get(metric.upper())
    if row and row.threshold_value is not None:
        return float(row.threshold_value)
    return default


def rule_severity(rules: Dict[str, AlertRuleModel], metric: str, default: str) -> str:
    row = rules.get(metric.upper())
    if row and row.severity:
        return str(row.severity).upper()
    return default


def effective_thresholds(
    rules: Dict[str, AlertRuleModel],
    modality: Optional[str],
) -> Dict[str, object]:
    """Resolved floors for alerts + health (fleet DB rules + modality defaults)."""
    coh = coherence_thresholds(rules, modality)
    mod = normalize_modality(modality)
    return {
        "modality": mod,
        "t1_crit_us": coh["t1_crit_us"],
        "t2_crit_us": coh["t2_crit_us"],
        "t1_warn_us": coh["t1_warn_us"],
        "queue_jobs": rule_threshold(rules, "QUEUE_JOBS", 50.0),
        "calibration_age_hours": rule_threshold(rules, "CALIBRATION_AGE", 24.0),
        "readout_error": rule_threshold(rules, "READOUT_ERROR", 0.08),
        "t1_t2_from_backend_rules": bool(rules.get("T1") or rules.get("T2")),
    }


def _coherence_rule_usable(modality: Optional[str], metric: str, value: float, default: float) -> float:
    """Reject migrated fleet rules that are orders-of-magnitude wrong for this modality."""
    mod = normalize_modality(modality)
    v, d = float(value), float(default)
    if not (math.isfinite(v) and math.isfinite(d) and d > 0):
        return d
    ratio = v / d
    # ponytail: single guard for bad T1/T2 copies — upgrade path is Admin → Alert rules per backend
    bands = {
        "simulator": (0.05, 20.0),
        "superconducting": (0.05, 50.0),
        "trapped_ion": (0.2, 5.0),
        "neutral_atom": (0.2, 5.0),
    }
    lo, hi = bands.get(mod, (0.01, 100.0))
    if ratio < lo or ratio > hi:
        return d
    return v


def coherence_thresholds(
    rules: Dict[str, AlertRuleModel],
    modality: Optional[str],
) -> Dict[str, float]:
    prof = modality_profile(modality)
    t1_default = float(prof["t1_crit_us"])
    t2_default = float(prof["t2_crit_us"])
    t1_crit = _coherence_rule_usable(
        modality, "T1", rule_threshold(rules, "T1", t1_default), t1_default
    )
    t2_crit = _coherence_rule_usable(
        modality, "T2", rule_threshold(rules, "T2", t2_default), t2_default
    )
    return {
        "t1_crit_us": t1_crit,
        "t2_crit_us": t2_crit,
        "t1_warn_us": t1_crit + 10.0,
    }
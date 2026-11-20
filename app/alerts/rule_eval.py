"""Load enabled alert rules and resolve thresholds (fleet rules + modality floors)."""
from __future__ import annotations

from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.analytics.modality_thresholds import normalize_modality, t1_crit_us, t2_crit_us
from app.models.entities import AlertRuleModel


def load_rules(db: Session) -> Dict[str, AlertRuleModel]:
    rows = db.query(AlertRuleModel).filter(AlertRuleModel.enabled.is_(True)).all()
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
        "t1_t2_from_fleet_rules": mod == "superconducting",
    }


def coherence_thresholds(
    rules: Dict[str, AlertRuleModel],
    modality: Optional[str],
) -> Dict[str, float]:
    mod = normalize_modality(modality)
    t1_rule = rule_threshold(rules, "T1", 40.0)
    t2_rule = rule_threshold(rules, "T2", 30.0)
    return {
        "t1_crit_us": t1_crit_us(mod, t1_rule if mod == "superconducting" else None),
        "t2_crit_us": t2_crit_us(mod, t2_rule if mod == "superconducting" else None),
        "t1_warn_us": t1_crit_us(mod, t1_rule if mod == "superconducting" else None) + 10.0,
    }
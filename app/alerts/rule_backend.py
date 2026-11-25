"""Per-backend alert rule storage, seeding, and copy."""
from __future__ import annotations

import uuid
from typing import Dict, List, Optional

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.alerts.rule_defaults import default_rules_for_backend, rule_id_for
from app.analytics.modality_thresholds import normalize_modality
from app.models.entities import AlertRuleModel, BackendModel

_LEGACY_FLEET_IDS = frozenset({"rule_t1", "rule_t2", "rule_ro", "rule_queue", "rule_calib"})


def _has_backend_id_column(bind) -> bool:
    if "alert_rules" not in inspect(bind).get_table_names():
        return False
    cols = {c["name"] for c in inspect(bind).get_columns("alert_rules")}
    return "backend_id" in cols


def migrate_legacy_fleet_rules(db: Session) -> None:
    """Turn old fleet-wide rows into per-backend rule sets (once)."""
    bind = db.get_bind()
    if not _has_backend_id_column(bind):
        return
    legacy = (
        db.query(AlertRuleModel)
        .filter(AlertRuleModel.backend_id.is_(None))
        .all()
    )
    legacy_ids = (
        db.query(AlertRuleModel)
        .filter(AlertRuleModel.rule_id.in_(_LEGACY_FLEET_IDS))
        .all()
    )
    if not legacy and not legacy_ids:
        return
    by_metric = {r.metric_name.upper(): r for r in legacy}
    if not by_metric:
        by_metric = {r.metric_name.upper(): r for r in legacy_ids}

    backends = db.query(BackendModel).all()
    if not backends:
        return

    for b in backends:
        if db.query(AlertRuleModel).filter(AlertRuleModel.backend_id == b.backend_id).first():
            continue
        templates = default_rules_for_backend(b.backend_id, b.qpu_modality, b.backend_type)
        for tpl in templates:
            metric = tpl["metric_name"].upper()
            fleet = by_metric.get(metric)
            if fleet:
                if metric in ("T1", "T2") and normalize_modality(b.qpu_modality) == "superconducting":
                    if fleet.threshold_value is not None:
                        tpl["threshold_value"] = float(fleet.threshold_value)
                elif metric not in ("T1", "T2") and fleet.threshold_value is not None:
                    tpl["threshold_value"] = float(fleet.threshold_value)
                tpl["severity"] = fleet.severity
                tpl["enabled"] = fleet.enabled
            db.add(AlertRuleModel(**tpl))

    for r in legacy:
        db.delete(r)
    for rid in _LEGACY_FLEET_IDS:
        row = db.query(AlertRuleModel).filter(AlertRuleModel.rule_id == rid).first()
        if row and row.backend_id is None:
            db.delete(row)
    db.commit()


def ensure_backend_rules(db: Session, backend_id: str) -> None:
    bind = db.get_bind()
    if not _has_backend_id_column(bind):
        return
    migrate_legacy_fleet_rules(db)
    existing = db.query(AlertRuleModel).filter(AlertRuleModel.backend_id == backend_id).first()
    if existing:
        return
    b = db.query(BackendModel).filter(BackendModel.backend_id == backend_id).first()
    if not b:
        return
    for spec in default_rules_for_backend(backend_id, b.qpu_modality, b.backend_type):
        db.add(AlertRuleModel(**spec))
    db.commit()


def list_backend_rules(db: Session, backend_id: str) -> List[AlertRuleModel]:
    ensure_backend_rules(db, backend_id)
    return (
        db.query(AlertRuleModel)
        .filter(AlertRuleModel.backend_id == backend_id)
        .order_by(AlertRuleModel.metric_name)
        .all()
    )


def copy_backend_rules(
    db: Session,
    source_backend_id: str,
    target_backend_id: str,
    *,
    replace: bool = True,
) -> int:
    if source_backend_id == target_backend_id:
        return 0
    src = list_backend_rules(db, source_backend_id)
    if not src:
        return 0
    if replace:
        db.query(AlertRuleModel).filter(AlertRuleModel.backend_id == target_backend_id).delete()
    existing_metrics = {
        r.metric_name.upper()
        for r in db.query(AlertRuleModel).filter(AlertRuleModel.backend_id == target_backend_id).all()
    }
    added = 0
    for r in src:
        metric = r.metric_name.upper()
        if not replace and metric in existing_metrics:
            continue
        rid = rule_id_for(target_backend_id, metric)
        if db.query(AlertRuleModel).filter(AlertRuleModel.rule_id == rid).first():
            if replace:
                db.query(AlertRuleModel).filter(AlertRuleModel.rule_id == rid).delete()
            else:
                continue
        db.add(
            AlertRuleModel(
                rule_id=rid,
                backend_id=target_backend_id,
                metric_name=r.metric_name,
                operator=r.operator,
                threshold_value=r.threshold_value,
                severity=r.severity,
                enabled=r.enabled,
                description=r.description,
            )
        )
        added += 1
    db.commit()
    return added


def reset_backend_rules(db: Session, backend_id: str) -> int:
    b = db.query(BackendModel).filter(BackendModel.backend_id == backend_id).first()
    if not b:
        return 0
    db.query(AlertRuleModel).filter(AlertRuleModel.backend_id == backend_id).delete()
    specs = default_rules_for_backend(backend_id, b.qpu_modality, b.backend_type)
    for spec in specs:
        db.add(AlertRuleModel(**spec))
    db.commit()
    return len(specs)


def new_rule_id(backend_id: str, metric: str) -> str:
    return f"rule_{backend_id.replace('/', '_')}_{metric.lower()}_{uuid.uuid4().hex[:4]}"
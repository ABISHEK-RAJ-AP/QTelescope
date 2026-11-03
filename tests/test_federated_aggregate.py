from app.federated.aggregator import _sum_fleet, _sum_modality, resolve_peer_aggregate


def test_resolve_peer_from_snapshot(tmp_path, monkeypatch):
    from app.federated import registry

    snap_dir = tmp_path / "snaps"
    snap_dir.mkdir()
    reg_path = tmp_path / "registry.json"
    monkeypatch.setattr(registry, "SNAPSHOT_DIR", str(snap_dir))
    monkeypatch.setattr(registry, "REGISTRY_PATH", str(reg_path))
    import app.federated.aggregator as agg

    monkeypatch.setattr(agg, "fed_registry", registry)
    (snap_dir / "peer1.json").write_text(
        '{"site_id":"p1","site_name":"P1","fleet":{"total":3,"online":2,"offline":1,"maintenance_or_other":0},'
        '"backends_by_modality":{"simulator":3},"operations":{"active_alerts":0,"open_incidents":0}}',
        encoding="utf-8",
    )
    row = resolve_peer_aggregate({"site_id": "p1", "site_name": "P1", "snapshot_file": "peer1.json"})
    assert row["sync_status"] == "OK"
    assert row["fleet"]["total"] == 3


def test_national_totals_sum():
    sites = [
        {"fleet": {"total": 4, "online": 3, "offline": 1, "maintenance_or_other": 0}, "backends_by_modality": {"a": 2, "b": 2}},
        {"fleet": {"total": 2, "online": 2, "offline": 0, "maintenance_or_other": 0}, "backends_by_modality": {"a": 1, "b": 1}},
    ]
    assert _sum_fleet(sites)["total"] == 6
    assert _sum_modality(sites)["a"] == 3

from app.services.quota_policy import daily_shots_cap_for_tenant, load_quota_policy


def test_quota_policy_file_loads():
    policy = load_quota_policy()
    assert policy.get("schema_version") == 1
    assert daily_shots_cap_for_tenant("default") >= 1

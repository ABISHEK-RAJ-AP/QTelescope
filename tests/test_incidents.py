from app.services.incident_service import backend_id_from_alert, SEVERITY_RANK
from app.services import incident_service as inc_svc


class _FakeAlert:
    def __init__(self, resource_type, resource_id, severity="WARNING"):
        self.resource_type = resource_type
        self.resource_id = resource_id
        self.severity = severity


def test_backend_id_from_qubit_alert():
    a = _FakeAlert("QUBIT", "ibm_brisbane_Q17")
    assert backend_id_from_alert(a) == "ibm_brisbane"


def test_backend_id_from_queue_alert():
    a = _FakeAlert("QUEUE", "rigetti_aspen_m3")
    assert backend_id_from_alert(a) == "rigetti_aspen_m3"


def test_max_severity():
    alerts = [
        _FakeAlert("BACKEND", "x", "WARNING"),
        _FakeAlert("QUBIT", "x_Q0", "CRITICAL"),
    ]
    assert inc_svc._max_severity(alerts) == "CRITICAL"
    assert SEVERITY_RANK["CRITICAL"] > SEVERITY_RANK["WARNING"]


def test_incident_title_humanizes_rule_codes():
    class _A:
        alert_type = "LOW_T2"

    title = inc_svc._incident_title("ibm_brisbane", [_A(), _A()])
    assert "Low T2" in title
    assert "LOW_T2" not in title

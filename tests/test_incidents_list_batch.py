import datetime

from app.api import incidents as inc_mod
from app.models.entities import IncidentModel


class _FakeSession:
    def __init__(self, counts):
        self._counts = counts

    def query(self, model):
        return _FakeQuery(model, self._counts)


class _FakeQuery:
    def __init__(self, model, counts):
        self._model = model
        self._counts = counts

    def filter(self, *args, **kwargs):
        return self

    def all(self):
        from app.models.entities import IncidentAlertModel

        if self._model is IncidentAlertModel:
            class _Link:
                def __init__(self, incident_id):
                    self.incident_id = incident_id

            out = []
            for iid, n in self._counts.items():
                out.extend([_Link(iid) for _ in range(n)])
            return out
        return []


def test_serialize_list_batches_alert_counts():
    rows = [
        IncidentModel(
            incident_id="inc-1",
            title="t",
            backend_id="b1",
            severity="WARNING",
            status="OPEN",
            first_detected_at=datetime.datetime.now(datetime.timezone.utc),
            last_detected_at=datetime.datetime.now(datetime.timezone.utc),
        ),
        IncidentModel(
            incident_id="inc-2",
            title="t2",
            backend_id="b2",
            severity="CRITICAL",
            status="OPEN",
            first_detected_at=datetime.datetime.now(datetime.timezone.utc),
            last_detected_at=datetime.datetime.now(datetime.timezone.utc),
        ),
    ]
    db = _FakeSession({"inc-1": 2, "inc-2": 0})
    out = inc_mod._serialize_list(db, rows)
    assert len(out) == 2
    assert out[0].alert_count == 2
    assert out[1].alert_count == 0
    assert out[0].comments == []

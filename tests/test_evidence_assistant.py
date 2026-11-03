from app.research.evidence_assistant import answer_from_evidence
from app.research.novelty_audit import build_novelty_audit


def test_novelty_audit_has_differentiators():
    audit = build_novelty_audit()
    assert len(audit["differentiators"]) >= 5
    assert audit["research_opportunities"]


def test_assistant_refuses_unknown():
    class FakeSession:
        def query(self, *a, **k):
            return self

        def count(self):
            return 0

        def filter(self, *a, **k):
            return self

        def order_by(self, *a, **k):
            return self

        def limit(self, *a, **k):
            return self

        def all(self):
            return []

    out = answer_from_evidence(FakeSession(), "What is the weather in Paris?")
    assert out["refused"] is True
    assert out["mode"] == "evidence_only"

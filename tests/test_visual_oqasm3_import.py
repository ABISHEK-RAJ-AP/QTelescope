import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

P = settings.API_V1_STR
HEADERS = {"X-User-Role": "Researcher"}

OQASM3 = """OPENQASM 3.0;
include "stdgates.inc";
qubit[2] q;
bit[2] c;
h q[0];
cx q[0], q[1];
"""


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_from_qasm_downgrades_oqasm3_for_visual(client):
    r = client.post(f"{P}/visual-circuit/from-qasm", headers=HEADERS, json={"source_text": OQASM3})
    assert r.status_code == 200
    body = r.json()
    assert body.get("import_meta", {}).get("openqasm3_downgraded") is True
    assert body.get("num_qubits") >= 2
    assert len(body.get("columns") or []) >= 2

"""Rigetti public ISA parser — no live network required."""
import json
from pathlib import Path

from app.providers.rigetti_adapter import parse_isa_backend, parse_isa_connectivity, parse_isa_properties

FIXTURE = Path(__file__).parent / "fixtures" / "rigetti_cepheus_isa_min.json"


def test_parse_isa_does_not_invent_t1():
    isa = json.loads(FIXTURE.read_text())
    props = parse_isa_properties(isa, "rigetti_cepheus_1_108q")
    by_idx = {q["qubit_index"]: q for q in props["qubits"]}
    assert by_idx[0]["t1"] == 32.0
    assert "t1" not in by_idx[1]


def test_parse_isa_backend_and_edges():
    isa = json.loads(FIXTURE.read_text())
    b = parse_isa_backend(isa, "Cepheus-1-108Q", "https://api.qcs.rigetti.com/v1/quantumProcessors/Cepheus-1-108Q/instructionSetArchitecture")
    assert b["backend_id"] == "rigetti_cepheus_1_108q"
    assert b["qubit_count"] == 2
    assert "queue not in OpenAPI" in b["status_message"]
    edges = parse_isa_connectivity(isa, b["backend_id"])
    assert edges[0]["qubits"] == [0, 1]

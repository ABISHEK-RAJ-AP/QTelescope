from app.connectors.compile_qiskit import compile_circuit
from app.services.oqasm3_compat import downgrade_oqasm3_to_qasm2

TEMPLATE = """OPENQASM 3.0;
include "stdgates.inc";
qubit[2] q;
bit[2] c;
h q[0];
cx q[0], q[1];
c[0] = measure q[0];
c[1] = measure q[1];
"""


def test_downgrade_template_bell():
    q2 = downgrade_oqasm3_to_qasm2(TEMPLATE)
    assert q2 is not None
    assert "OPENQASM 2.0" in q2
    assert "qreg q[2]" in q2
    assert "measure q[0] -> c[0]" in q2


def test_compile_oqasm3_safe_stub_by_default():
    status, diagnostics, artifact, tool, _ = compile_circuit(TEMPLATE, "openqasm3", optimization_level=1)
    assert status == "completed"
    assert tool == "builtin-stub"
    assert artifact.get("openqasm3_downgraded") is True
    assert any("downgraded" in (d.get("message") or "").lower() for d in diagnostics)

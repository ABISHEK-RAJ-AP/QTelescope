"""Qiskit-backed compile/transpile adapter (graceful fallback when SDK missing)."""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional, Tuple


def _oqasm3_transpile_enabled() -> bool:
    return os.getenv("QRE_OQASM3_TRANSPILE", "").lower().strip() in ("1", "true", "yes")


def _diag(severity: str, message: str, line: Optional[int] = None, column: Optional[int] = None) -> Dict[str, Any]:
    d: Dict[str, Any] = {"severity": severity, "message": message}
    if line is not None:
        d["line"] = line
    if column is not None:
        d["column"] = column
    return d


def _is_openqasm3(source_text: str, source_language: str) -> bool:
    return source_language == "openqasm3" or "OPENQASM 3" in (source_text or "")


def _stub_artifact(source_text: str) -> Dict[str, Any]:
    n = max(2, min(16, (source_text or "").count("q[") + 1))
    return {
        "num_qubits": n,
        "depth": None,
        "size": None,
        "operation_counts": {},
        "execution_class": "simulated",
        "stub": True,
        "openqasm3_deferred": True,
    }


def _load_circuit(source_text: str, source_language: str):
    if _is_openqasm3(source_text, source_language):
        raise ValueError("OpenQASM 3 compile deferred — use openqasm2 export or Python SDK path")
    if source_language == "python":
        local: Dict[str, Any] = {}
        exec(source_text, local, local)
        qc = local.get("qc") or local.get("circuit")
        if qc is None:
            raise ValueError("Python source must define `qc` or `circuit`")
        return qc
    from qiskit import QuantumCircuit

    return QuantumCircuit.from_qasm_str(source_text)


def compile_circuit(
    source_text: str,
    source_language: str,
    *,
    optimization_level: int = 1,
    basis_gates: Optional[List[str]] = None,
    coupling_map: Optional[Any] = None,
) -> Tuple[str, List[Dict[str, Any]], Optional[Dict[str, Any]], Optional[str], Optional[str]]:
    """
    Returns (status, diagnostics, compiled_artifact, tool, tool_version).
    status: completed | failed
    """
    diagnostics: List[Dict[str, Any]] = []
    if _is_openqasm3(source_text or "", source_language):
        from app.services.oqasm3_compat import downgrade_oqasm3_to_qasm2

        q2 = downgrade_oqasm3_to_qasm2(source_text or "")
        if q2 and _oqasm3_transpile_enabled():
            try:
                import qiskit
                from qiskit import QuantumCircuit, transpile

                tool_version = getattr(qiskit, "__version__", None)
                qc = QuantumCircuit.from_qasm_str(q2)
                t_kwargs: Dict[str, Any] = {"optimization_level": max(0, min(3, optimization_level))}
                if basis_gates:
                    t_kwargs["basis_gates"] = basis_gates
                if coupling_map is not None:
                    t_kwargs["coupling_map"] = coupling_map
                tqc = transpile(qc, **t_kwargs)
                artifact = {
                    "num_qubits": tqc.num_qubits,
                    "depth": tqc.depth(),
                    "size": tqc.size(),
                    "operation_counts": dict(tqc.count_ops()),
                    "execution_class": "simulated",
                    "openqasm3_downgraded": True,
                }
                diagnostics.append(
                    _diag("info", "OpenQASM 3 downgraded to 2.0 subset for Qiskit transpile.")
                )
                return "completed", diagnostics, artifact, "qiskit", tool_version
            except Exception as e:
                diagnostics.append(_diag("warning", f"OQASM3 downgrade transpile failed: {e}"))
        elif q2:
            diagnostics.append(
                _diag("info", "OpenQASM 3 downgraded to 2.0 subset (transpile off — set QRE_OQASM3_TRANSPILE=true).")
            )
            artifact = _stub_artifact(source_text or "")
            artifact["openqasm3_downgraded"] = True
            artifact["downgraded_qasm2_preview"] = q2.splitlines()[:12]
            return "completed", diagnostics, artifact, "builtin-stub", None
        diagnostics.append(
            _diag("warning", "OpenQASM 3 — using metrics stub (full qasm3 transpiler not wired).")
        )
        return "completed", diagnostics, _stub_artifact(source_text or ""), "builtin-stub", None
    try:
        import qiskit
        from qiskit import transpile

        tool_version = getattr(qiskit, "__version__", None)
        qc = _load_circuit(source_text or "", source_language)
        t_kwargs: Dict[str, Any] = {"optimization_level": max(0, min(3, optimization_level))}
        if basis_gates:
            t_kwargs["basis_gates"] = basis_gates
        if coupling_map is not None:
            t_kwargs["coupling_map"] = coupling_map
        tqc = transpile(qc, **t_kwargs)
        artifact = {
            "num_qubits": tqc.num_qubits,
            "depth": tqc.depth(),
            "size": tqc.size(),
            "operation_counts": dict(tqc.count_ops()),
            "execution_class": "simulated",
        }
        diagnostics.append(_diag("info", f"Transpile OK — depth {artifact['depth']}, width {artifact['num_qubits']}"))
        return "completed", diagnostics, artifact, "qiskit", tool_version
    except ImportError:
        diagnostics.append(
            _diag("warning", "Qiskit not installed — compile skipped; source stored as-is for site SDK hook.")
        )
        lines = (source_text or "").count("\n") + 1
        artifact = {
            "num_qubits": None,
            "depth": None,
            "size": None,
            "operation_counts": {},
            "execution_class": "simulated",
            "stub": True,
            "source_lines": lines,
        }
        return "completed", diagnostics, artifact, "builtin-stub", None
    except SyntaxError as e:
        diagnostics.append(_diag("error", str(e), getattr(e, "lineno", None), getattr(e, "offset", None)))
        return "failed", diagnostics, None, "qiskit", None
    except Exception as e:
        msg = str(e)
        line_hint = None
        if "line" in msg.lower():
            for token in msg.split():
                if token.isdigit():
                    line_hint = int(token)
                    break
        diagnostics.append(_diag("error", msg, line_hint))
        return "failed", diagnostics, None, "qiskit", None

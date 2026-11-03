"""Minimal visual circuit ↔ OpenQASM 2 string (MVP composer)."""
from __future__ import annotations

import re
from typing import Any, Dict, List


def visual_to_qasm(num_qubits: int, columns: List[Dict[str, Any]]) -> str:
    n = max(1, min(32, int(num_qubits)))
    lines = ["OPENQASM 2.0;", 'include "qelib1.inc";', f"qreg q[{n}];", f"creg c[{n}];"]
    for col in columns:
        gate = (col.get("gate") or "").lower()
        t = int(col.get("target", 0))
        c = col.get("control")
        if gate == "h":
            lines.append(f"h q[{t}];")
        elif gate == "x":
            lines.append(f"x q[{t}];")
        elif gate == "z":
            lines.append(f"z q[{t}];")
        elif gate == "cx" and c is not None:
            lines.append(f"cx q[{int(c)}], q[{t}];")
        elif gate == "measure":
            lines.append(f"measure q[{t}] -> c[{t}];")
    return "\n".join(lines) + "\n"


def qasm_to_visual(source: str) -> Dict[str, Any]:
    """Best-effort parse for composer hydration."""
    n = 2
    m = re.search(r"qreg\s+q\[(\d+)\]", source or "")
    if m:
        n = int(m.group(1))
    columns: List[Dict[str, Any]] = []
    for line in (source or "").splitlines():
        line = line.strip().rstrip(";")
        if not line or line.startswith(("OPENQASM", "include", "qreg", "creg")):
            continue
        cx = re.match(r"cx\s+q\[(\d+)\],\s*q\[(\d+)\]", line)
        if cx:
            columns.append({"gate": "cx", "control": int(cx.group(1)), "target": int(cx.group(2))})
            continue
        one = re.match(r"(h|x|z)\s+q\[(\d+)\]", line)
        if one:
            columns.append({"gate": one.group(1), "target": int(one.group(2))})
            continue
        meas = re.match(r"measure\s+q\[(\d+)\]", line)
        if meas:
            columns.append({"gate": "measure", "target": int(meas.group(1))})
    return {"num_qubits": n, "columns": columns}

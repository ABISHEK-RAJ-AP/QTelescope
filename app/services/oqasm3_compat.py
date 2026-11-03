"""OpenQASM 3 → 2 downgrade for subset used by platform templates (not full OQASM3 spec)."""
from __future__ import annotations

import re
from typing import Optional


def downgrade_oqasm3_to_qasm2(source_text: str) -> Optional[str]:
    text = source_text or ""
    if "OPENQASM 3" not in text.upper() and "openqasm3" not in text.lower().replace(" ", ""):
        return None
    out = text
    out = re.sub(r"OPENQASM\s+3[^\n;]*", "OPENQASM 2.0", out, flags=re.IGNORECASE)
    out = out.replace('"stdgates.inc"', '"qelib1.inc"').replace("stdgates.inc", "qelib1.inc")
    out = re.sub(r"qubit\[(\d+)\]\s+(\w+)\s*;", r"qreg \2[\1];", out)
    out = re.sub(r"bit\[(\d+)\]\s+(\w+)\s*;", r"creg \2[\1];", out)
    out = re.sub(
        r"(\w+)\[(\d+)\]\s*=\s*measure\s+(\w+)\[(\d+)\]\s*;",
        r"measure \3[\4] -> \1[\2];",
        out,
        flags=re.IGNORECASE,
    )
    if "qreg" not in out and "qubit[" in text:
        return None
    return out

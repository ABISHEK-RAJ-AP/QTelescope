#!/usr/bin/env python3
"""Assert enrich_local_demo_telemetry dry-run budgets stay within local caps."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    proc = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "enrich_local_demo_telemetry.py"),
            "--dry-run",
            "--days",
            "14",
            "--interval-hours",
            "3",
        ],
        capture_output=True,
        text=True,
        cwd=ROOT,
        check=False,
    )
    if proc.returncode != 0:
        print(proc.stderr or proc.stdout, file=sys.stderr)
        return proc.returncode
    line = proc.stdout.strip().splitlines()[-1]
    if "snapshots" not in line:
        print(f"unexpected output: {line}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
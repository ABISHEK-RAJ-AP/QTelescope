#!/usr/bin/env python3
"""Fail if message helpers are used without import."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1] / 'src'
MSG = ROOT / 'constants' / 'messages.js'
export_re = re.compile(r'^export (?:const|function) (\w+)', re.M)
symbols = export_re.findall(MSG.read_text())
issues = []
for path in list(ROOT.rglob('*.jsx')) + list(ROOT.rglob('*.js')):
    if path.resolve() == MSG.resolve():
        continue
    text = path.read_text(encoding='utf-8', errors='ignore')
    for sym in symbols:
        if not re.search(rf'\b{sym}\b', text):
            continue
        if not re.search(rf'import\s*\{{[^}}]*\b{sym}\b[^}}]*\}}', text):
            issues.append(f'{path.relative_to(ROOT.parent)}: missing import for {sym}')
if issues:
    print('\n'.join(issues))
    sys.exit(1)
print(f'ok: {len(symbols)} message symbols checked')

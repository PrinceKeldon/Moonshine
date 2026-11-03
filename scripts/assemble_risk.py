#!/usr/bin/env python3
"""Assemble bot/risk.py from base64 parts. Run from repo root."""
from pathlib import Path
import base64
parts = sorted(Path("scripts/risk_b64").glob("part*.b64"))
assert parts, "missing scripts/risk_b64/part*.b64"
data = base64.b64decode("".join(p.read_text().strip() for p in parts))
Path("bot/risk.py").write_bytes(data)
print(f"Wrote bot/risk.py ({len(data)} bytes)")

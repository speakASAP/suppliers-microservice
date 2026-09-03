#!/usr/bin/env python3
"""Execute the canonical gate from the Intent Preservation System repository."""

from __future__ import annotations

import os
import sys
from pathlib import Path


target = (
    Path(__file__).resolve().parents[2]
    / "intent-preservation-system"
    / "scripts"
    / Path(__file__).name
)
if not target.is_file():
    raise SystemExit(f"Canonical IPS gate not found: {target}")
os.execv(sys.executable, [sys.executable, str(target), *sys.argv[1:]])

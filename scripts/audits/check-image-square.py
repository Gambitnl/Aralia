#!/usr/bin/env python3
"""
Exit codes:
  0: ok (square)
  2: not square
  1: error
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: check-image-square.py <imagePath>", file=sys.stderr)
        return 1

    p = Path(sys.argv[1])
    if not p.exists():
        print(f"file not found: {p}", file=sys.stderr)
        return 1

    try:
        im = Image.open(p)
        w, h = im.size
        ok = w == h
        print(json.dumps({"path": str(p), "size": {"w": w, "h": h}, "square": ok}))
        return 0 if ok else 2
    except Exception as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())


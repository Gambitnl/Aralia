#!/usr/bin/env python3
"""
Print recent race-image-status entries (ignoring entries missing race/gender).

This is mainly to help resume long image-regeneration batches.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--path", default="public/assets/images/races/race-image-status.json")
    ap.add_argument("--n", type=int, default=25)
    args = ap.parse_args()

    p = Path(args.path)
    if not p.exists():
        raise SystemExit(f"missing: {p}")

    j = json.loads(p.read_text(encoding="utf-8"))
    entries = j.get("entries", [])
    filtered = [
        e
        for e in entries
        if isinstance(e, dict) and e.get("race") and e.get("gender") and e.get("downloadedAt")
    ]
    filtered.sort(key=lambda e: str(e.get("downloadedAt")))

    tail = filtered[-max(args.n, 0) :]
    for e in tail:
        print(
            f"{e.get('downloadedAt')}\t{e.get('race')}\t{e.get('gender')}\t{e.get('category')}\t{e.get('imagePath')}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


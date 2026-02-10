#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
RACES_DIR = ROOT / "public" / "assets" / "images" / "races"


def main() -> int:
    bad: list[tuple[Path, int, int]] = []
    for p in sorted(RACES_DIR.glob("*.png")):
        try:
            im = Image.open(p)
            w, h = im.size
            if w != h:
                bad.append((p, w, h))
        except Exception:
            continue

    print(f"non_square: {len(bad)}")
    for p, w, h in bad:
        print(f"{p.relative_to(ROOT)}\t{w}x{h}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


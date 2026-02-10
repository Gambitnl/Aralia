#!/usr/bin/env python3
"""
Detect "letterboxing" / blank margins in generated PNGs.

Gemini sometimes returns an image pasted onto a white canvas. We want full-bleed
square images for the CC/glossary race portraits.

Exit codes:
  0: ok (no large blank margins detected)
  2: blank margins detected
  1: error
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image


def is_blank_pixel(rgb: tuple[int, int, int]) -> bool:
    r, g, b = rgb
    # Near-white + low chroma.
    return r >= 247 and g >= 247 and b >= 247 and (max(rgb) - min(rgb)) <= 12


def blank_ratio_row(px, y: int, w: int) -> float:
    blanks = 0
    for x in range(w):
        if is_blank_pixel(px[x, y]):
            blanks += 1
    return blanks / float(w)


def blank_ratio_col(px, x: int, h: int) -> float:
    blanks = 0
    for y in range(h):
        if is_blank_pixel(px[x, y]):
            blanks += 1
    return blanks / float(h)


def measure_margins(img: Image.Image) -> dict[str, int]:
    img = img.convert("RGB")
    w, h = img.size
    px = img.load()

    # Consider a row/col blank if >98% blank pixels (allows for a few anti-aliased edges).
    row_thresh = 0.98
    col_thresh = 0.98

    top = 0
    for y in range(h):
        if blank_ratio_row(px, y, w) >= row_thresh:
            top += 1
        else:
            break

    bottom = 0
    for y in range(h - 1, -1, -1):
        if blank_ratio_row(px, y, w) >= row_thresh:
            bottom += 1
        else:
            break

    left = 0
    for x in range(w):
        if blank_ratio_col(px, x, h) >= col_thresh:
            left += 1
        else:
            break

    right = 0
    for x in range(w - 1, -1, -1):
        if blank_ratio_col(px, x, h) >= col_thresh:
            right += 1
        else:
            break

    return {"top": top, "bottom": bottom, "left": left, "right": right}


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: detect-blank-margins.py <imagePath>", file=sys.stderr)
        return 1

    p = Path(sys.argv[1])
    if not p.exists():
        print(f"file not found: {p}", file=sys.stderr)
        return 1

    try:
        img = Image.open(p)
        margins = measure_margins(img)
        w, h = img.size
        worst = max(margins.values())

        # Flag if any margin is "large enough to notice" for 1024-square portraits.
        # This catches the obvious Gemini letterboxing while ignoring tiny compression halos.
        blank = worst >= 24

        out = {
            "path": str(p),
            "size": {"w": w, "h": h},
            "margins": margins,
            "blank": blank,
        }
        print(json.dumps(out))
        return 2 if blank else 0
    except Exception as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())


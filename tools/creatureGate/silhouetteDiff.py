"""Pairwise silhouette disagreement between a part gate's solo captures.

Why this exists (2026-08-24): the campaign's rule is that a part passes when a
blind reader names it AND its metrics hold on THREE creatures. Three specimens
are asked for because they average out pose and proportion luck. A hands re-gate
passed 3/3 while two of its three specimens were the same mesh at the same scale
(drow and human hands disagreed by 4.5% of silhouette pixels, against 34-36% for
the dwarf). That trio was really two samples, and nothing in the gate noticed.

Compares the MASK silhouettes the blind reader actually sees, per part kind:
Intersection-over-union style, reported as the share of the union that the two
specimens disagree about. Prints JSON to stdout:

    [{"a": "A", "b": "B", "kind": "hand", "disagreement": 0.045}, ...]

Reads only the PNGs already in the gate directory; no new dependency beyond the
Pillow the rest of the gate's python already relies on.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover - reported, never guessed around
    print("", end="")
    sys.exit(2)

# A capture's part kind is the tail of its label, matching partGate.mjs.
KIND_RE = re.compile(r"(hand|face|head|foot)$")
# Anything darker than this on every channel is the subject (mask stage renders
# the specimen black on white).
DARK = 80
# Downsample edge: shape comparison does not need full resolution, and a fixed
# grid makes captures of different canvas sizes comparable.
GRID = 128


def kind_of(label: str) -> str | None:
    m = KIND_RE.search(label)
    if not m:
        return None
    return "face" if m.group(1) == "head" else m.group(1)


def mask_of(path: Path) -> list[int] | None:
    """Occupancy grid of the subject, normalized to its own bounding box.

    Normalizing by bounding box compares SHAPE rather than framing, so a camera
    change (the framing fix landed the same day) cannot masquerade as two
    specimens differing.
    """
    img = Image.open(path).convert("RGB")
    w, h = img.size
    px = img.load()
    # Ignore a small border: the canvas corners carry the page's own dark chrome.
    m = 12
    xs, ys = [], []
    dark_pixels = []
    for y in range(m, h - m):
        for x in range(m, w - m):
            r, g, b = px[x, y]
            if r < DARK and g < DARK and b < DARK:
                dark_pixels.append((x, y))
                xs.append(x)
                ys.append(y)
    if not dark_pixels:
        return None
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    bw = max(1, x1 - x0)
    bh = max(1, y1 - y0)

    # INVERSE sampling: walk the grid and ask the image, rather than scattering
    # image pixels into the grid. Scattering under-fills a SMALL subject — an
    # 80 px box spread over 128 columns leaves 48 of them empty — so the same
    # shape captured near and far disagreed by 61%, which is precisely the
    # framing-masquerading-as-difference this normalization exists to prevent.
    # (Caught by silhouetteDiff.test.mjs before this shipped.)
    dark = set(dark_pixels)
    grid = [0] * (GRID * GRID)
    for gy in range(GRID):
        # Cell centre, mapped back into the subject's bounding box.
        sy = y0 + (gy + 0.5) / GRID * bh
        for gx in range(GRID):
            sx = x0 + (gx + 0.5) / GRID * bw
            if (int(round(sx)), int(round(sy))) in dark:
                grid[gy * GRID + gx] = 1
    return grid


def main() -> int:
    if len(sys.argv) < 2:
        print("[]")
        return 0
    part_dir = Path(sys.argv[1])
    # Specimen filenames may be passed explicitly. Globbing the directory also
    # picks up maskmetrics' intermediate crops (label_thumb24 ...), which are not
    # specimens and made the gate warn about its own scratch files.
    if len(sys.argv) > 2:
        shots = [part_dir / name for name in sys.argv[2:]]
    else:
        shots = sorted(
            p for p in part_dir.glob("*.png")
            if not p.name.startswith("blind-") and "_thumb" not in p.stem
        )
    masks: dict[str, tuple[str | None, list[int]]] = {}
    for shot in shots:
        label = shot.stem
        grid = mask_of(shot)
        if grid is None:
            continue
        masks[label] = (kind_of(label), grid)

    out = []
    labels = list(masks)
    for i in range(len(labels)):
        for j in range(i + 1, len(labels)):
            a, b = labels[i], labels[j]
            ka, ga = masks[a]
            kb, gb = masks[b]
            # Only compare like with like: a hand and a foot SHOULD differ.
            if ka != kb:
                continue
            union = 0
            disagree = 0
            for k in range(GRID * GRID):
                if ga[k] or gb[k]:
                    union += 1
                    if ga[k] != gb[k]:
                        disagree += 1
            if union == 0:
                continue
            out.append({
                "a": a,
                "b": b,
                "kind": ka,
                "disagreement": round(disagree / union, 4),
            })
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())

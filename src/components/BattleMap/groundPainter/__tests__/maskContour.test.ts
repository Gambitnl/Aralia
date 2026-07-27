import { describe, expect, it, vi } from "vitest";

import {
  traceMaskContourLoops,
  type LatticePoint,
} from "../paintPipeline";

/**
 * Build a `filled(x, y)` predicate + cell list from an ASCII grid, so each test
 * reads as the shape it exercises. `#` = filled cell, anything else = empty.
 * Row 0 is the top; x increases rightward, y downward (screen convention).
 */
function maskFromRows(rows: string[]): {
  filled: (x: number, y: number) => boolean;
  cells: Array<{ x: number; y: number }>;
} {
  const set = new Set<string>();
  const cells: Array<{ x: number; y: number }> = [];
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "#") {
        set.add(`${x},${y}`);
        cells.push({ x, y });
      }
    });
  });
  return { filled: (x, y) => set.has(`${x},${y}`), cells };
}

/** Signed area (shoelace) of a lattice loop. Sign encodes winding. */
function signedArea(loop: LatticePoint[]): number {
  let sum = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

/** True if the loop's first and last vertices connect back into a cycle. */
function isClosed(loop: LatticePoint[]): boolean {
  // A loop is stored without a duplicated closing vertex; it is closed when the
  // final vertex is one axis-aligned unit step from the first.
  const a = loop[0];
  const b = loop[loop.length - 1];
  const dx = Math.abs(a[0] - b[0]);
  const dy = Math.abs(a[1] - b[1]);
  return dx + dy === 1;
}

/** True if no two non-adjacent axis-aligned edges of the loop intersect. */
function isSimple(loop: LatticePoint[]): boolean {
  const n = loop.length;
  const seg = (i: number): [LatticePoint, LatticePoint] => [
    loop[i],
    loop[(i + 1) % n],
  ];
  const onSeg = (
    p: LatticePoint,
    a: LatticePoint,
    b: LatticePoint,
  ): boolean => {
    const minX = Math.min(a[0], b[0]);
    const maxX = Math.max(a[0], b[0]);
    const minY = Math.min(a[1], b[1]);
    const maxY = Math.max(a[1], b[1]);
    return p[0] >= minX && p[0] <= maxX && p[1] >= minY && p[1] <= maxY;
  };
  const cross = (o: LatticePoint, a: LatticePoint, b: LatticePoint): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const intersects = (
    p1: LatticePoint,
    p2: LatticePoint,
    p3: LatticePoint,
    p4: LatticePoint,
  ): boolean => {
    const d1 = cross(p3, p4, p1);
    const d2 = cross(p3, p4, p2);
    const d3 = cross(p1, p2, p3);
    const d4 = cross(p1, p2, p4);
    if (
      ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
    ) {
      return true;
    }
    if (d1 === 0 && onSeg(p1, p3, p4)) return true;
    if (d2 === 0 && onSeg(p2, p3, p4)) return true;
    if (d3 === 0 && onSeg(p3, p1, p2)) return true;
    if (d4 === 0 && onSeg(p4, p1, p2)) return true;
    return false;
  };
  for (let i = 0; i < n; i++) {
    const [a1, a2] = seg(i);
    for (let j = i + 1; j < n; j++) {
      // Skip adjacent segments (they legitimately share a vertex).
      if (j === i) continue;
      if ((j + 1) % n === i || (i + 1) % n === j) continue;
      const [b1, b2] = seg(j);
      if (intersects(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

describe("traceMaskContourLoops", () => {
  it("wraps a single cell in one closed unit square", () => {
    const { filled, cells } = maskFromRows(["#"]);
    const loops = traceMaskContourLoops(filled, cells);
    expect(loops).toHaveLength(1);
    const [loop] = loops;
    expect(loop).toHaveLength(4);
    expect(isClosed(loop)).toBe(true);
    expect(isSimple(loop)).toBe(true);
    expect(Math.abs(signedArea(loop))).toBeCloseTo(1, 6);
  });

  it("wraps a 2x2 block in one loop with area 4", () => {
    const { filled, cells } = maskFromRows(["##", "##"]);
    const loops = traceMaskContourLoops(filled, cells);
    expect(loops).toHaveLength(1);
    const [loop] = loops;
    expect(isClosed(loop)).toBe(true);
    expect(isSimple(loop)).toBe(true);
    expect(Math.abs(signedArea(loop))).toBeCloseTo(4, 6);
  });

  it("traces a diagonal staircase as one simple loop of the right area", () => {
    const { filled, cells } = maskFromRows([
      "#  ",
      "## ",
      " ##",
    ]);
    const loops = traceMaskContourLoops(filled, cells);
    // Staircase cells all connect edge-to-edge, so the outline is one loop.
    expect(loops).toHaveLength(1);
    const [loop] = loops;
    expect(isClosed(loop)).toBe(true);
    expect(isSimple(loop)).toBe(true);
    expect(Math.abs(signedArea(loop))).toBeCloseTo(cells.length, 6);
  });

  it("splits a checkerboard corner into two separate simple loops", () => {
    // Cells (0,0) and (1,1) filled; they touch only at the corner (1,1).
    const { filled, cells } = maskFromRows(["# ", " #"]);
    const loops = traceMaskContourLoops(filled, cells);
    expect(loops).toHaveLength(2);
    for (const loop of loops) {
      expect(isClosed(loop)).toBe(true);
      expect(isSimple(loop)).toBe(true);
      expect(Math.abs(signedArea(loop))).toBeCloseTo(1, 6);
    }
    // Same winding sign: both are outer boundaries of solid cells.
    const signs = loops.map((l) => Math.sign(signedArea(l)));
    expect(signs[0]).toBe(signs[1]);
  });

  it("traces a donut (hole) as an outer + inner loop of opposite winding", () => {
    const { filled, cells } = maskFromRows([
      "###",
      "# #",
      "###",
    ]);
    const loops = traceMaskContourLoops(filled, cells);
    expect(loops).toHaveLength(2);
    for (const loop of loops) {
      expect(isClosed(loop)).toBe(true);
      expect(isSimple(loop)).toBe(true);
    }
    const areas = loops.map(signedArea).sort((a, b) => a - b);
    // Outer square (area 9) and inner hole (area 1), opposite winding, so the
    // signed sum equals the 8 filled cells.
    expect(Math.abs(areas[0]) + Math.abs(areas[1])).toBeCloseTo(10, 6);
    const sum = areas[0] + areas[1];
    expect(Math.abs(sum)).toBeCloseTo(cells.length, 6);
    // Opposite signs: outer and inner boundaries wind against each other.
    expect(Math.sign(areas[0])).not.toBe(Math.sign(areas[1]));
  });

  it("closes the outline of a mask touching the map edge (no open chains)", () => {
    // A 2-wide strip whose left column is x=0 (the map edge). Off-map cells read
    // as unfilled, so the outer side is still a boundary and the loop closes.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { filled, cells } = maskFromRows(["##", "##", "##"]);
    const loops = traceMaskContourLoops(filled, cells);
    expect(loops).toHaveLength(1);
    const [loop] = loops;
    expect(isClosed(loop)).toBe(true);
    expect(isSimple(loop)).toBe(true);
    expect(Math.abs(signedArea(loop))).toBeCloseTo(6, 6);
    // No malformed-mask warning should ever fire for a well-formed mask.
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

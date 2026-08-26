// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 21:37:35
 * Dependents: systems/worldforge/interior/generateBuilding.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file roofPlan.ts — the roof solver (Building Generator v2, Phase 1B Task 3).
 *
 * Pure geometry: footprint masses + resolved style → RoofPlan. Per-mass roofs
 * joined with valleys, chimneys from hearths, dormers for windowless upper
 * bedrooms, caps on towers. RNG-FREE — every taste decision arrives through the
 * `style` input. No three.js, no rendering concerns.
 *
 * Units: masses are cell coords (5 ft cells); ALL emitted geometry is in FEET.
 * A RoofPlane's z is height ABOVE the wall-top (wallTopFt), never absolute.
 *
 * Coordinate convention (matches the rest of Worldforge): +y grows south.
 */
import type { Feet } from '../units';
import { CELL_FT } from '../units';
import type { FootprintMass } from './footprint';
import type {
  Cell,
  RoofPlan,
  RoofPlane,
  RoofChimney,
  RoofDormer,
  RoofTowerCap,
} from './blueprintTypes';

export interface SolveRoofInput {
  masses: FootprintMass[];
  footprintCells: Cell[];
  style: {
    roofForm: 'gable' | 'hip' | 'steep' | 'flat';
    pitchRiseFt: Feet;
    eaveOverhangFt: Feet;
  };
  /** Hearth/forge-hearth furnishings of the TOPMOST habitable floor, feet. */
  hearths: Array<{ x: Feet; y: Feet }>;
  /** Upper-floor bedrooms owning no window edge (dormer candidates). */
  windowlessUpperRooms: Cell[];
  /**
   * Attached frontage sides terminate at the lot line instead of carrying an
   * eave through the neighboring roof. Structural party walls remain complete.
   */
  partyWallLeft?: boolean;
  partyWallRight?: boolean;
  wallTopFt: Feet; // storeys * storey height — roof z values are ABOVE this
}

type Pt3 = [Feet, Feet, Feet];
interface RectFt { x: Feet; y: Feet; w: Feet; h: Feet; }
type Axis = 'x' | 'y';

const EPS = 1e-6;

// ── Mass → feet rectangle ────────────────────────────────────────────────────
const massRectFt = (m: FootprintMass): RectFt => ({
  x: m.x * CELL_FT,
  y: m.y * CELL_FT,
  w: m.w * CELL_FT,
  h: m.h * CELL_FT,
});

/** Pitch slope (rise per foot of horizontal run) so every mass shares a pitch.
 *  Anchored to the MAIN mass's shorter half-extent = the classic pitch. */
const pitchSlope = (mainRect: RectFt, pitchRiseFt: Feet): number => {
  const shorter = Math.min(mainRect.w, mainRect.h);
  if (shorter <= EPS) return 0;
  return pitchRiseFt / (shorter / 2);
};

// ── planeZAt: barycentric-free planar interpolation ──────────────────────────
/**
 * Evaluate a planar face's z at (x,y). The face is (near-)planar by
 * construction; we fit the plane from the first three non-collinear corners.
 * Returns 0 for a degenerate face.
 */
export function planeZAt(plane: RoofPlane, x: Feet, y: Feet): Feet {
  const p = plane.pts;
  if (p.length < 3) return p[0]?.[2] ?? 0;
  const [ax, ay, az] = p[0];
  // Find a second and third corner spanning a non-degenerate triangle.
  for (let i = 1; i < p.length; i++) {
    const [bx, by, bz] = p[i];
    for (let j = i + 1; j < p.length; j++) {
      const [cx, cy, cz] = p[j];
      const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      if (Math.abs(det) < EPS) continue;
      // Solve z = az + s*(B-A).z + t*(C-A).z with (x,y) = A + s*(B-A) + t*(C-A).
      const dx = x - ax, dy = y - ay;
      const s = (dx * (cy - ay) - dy * (cx - ax)) / det;
      const t = (dy * (bx - ax) - dx * (by - ay)) / det;
      return az + s * (bz - az) + t * (cz - az);
    }
  }
  return az;
}

// ── clipPolyToRectXY: subtract an axis-aligned rect from a convex polygon ────
/**
 * Sutherland–Hodgman clip of a convex 3D-planar polygon against ONE axis-
 * aligned half-plane in XY. z is interpolated linearly along cut edges, so the
 * pieces stay exactly on the source plane (any planar poly: z is linear along
 * every straight edge).
 */
function clipPolyHalfPlane(
  pts: Pt3[],
  axis: Axis,
  c: Feet,
  keepLess: boolean,
): Pt3[] {
  const val = (p: Pt3): number => (axis === 'x' ? p[0] : p[1]);
  const inside = (p: Pt3): boolean =>
    keepLess ? val(p) <= c + EPS : val(p) >= c - EPS;
  const out: Pt3[] = [];
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    const nxt = pts[(i + 1) % pts.length];
    const ci = inside(cur);
    const ni = inside(nxt);
    if (ci) out.push(cur);
    if (ci !== ni) {
      const t = (c - val(cur)) / (val(nxt) - val(cur));
      out.push([
        cur[0] + t * (nxt[0] - cur[0]),
        cur[1] + t * (nxt[1] - cur[1]),
        cur[2] + t * (nxt[2] - cur[2]),
      ]);
    }
  }
  return out;
}

/** Unsigned XY area of a polygon (shoelace). */
function polyAreaXY(pts: Pt3[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return Math.abs(a) / 2;
}

/**
 * Remove the part of a convex planar polygon (triangle, quad, trapezoid, or
 * any n-gon from earlier clips) whose XY projection lies inside `rect`.
 * Returns 0-4 convex pieces that exactly tile the remainder, via a band
 * decomposition of the rect's complement (above / below / left-of / right-of),
 * each piece cut with Sutherland–Hodgman so z stays on the source plane.
 * Pieces may have more than 4 vertices — RoofPlane.pts allows that.
 */
export function clipPolyToRectXY(poly: Pt3[], rect: RectFt): RoofPlane[] {
  const ry0 = rect.y, ry1 = rect.y + rect.h;
  const rx0 = rect.x, rx1 = rect.x + rect.w;
  // Fast path: no XY-bbox overlap → the polygon survives untouched.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [px, py] of poly) {
    minX = Math.min(minX, px); maxX = Math.max(maxX, px);
    minY = Math.min(minY, py); maxY = Math.max(maxY, py);
  }
  if (rx1 <= minX + EPS || rx0 >= maxX - EPS || ry1 <= minY + EPS || ry0 >= maxY - EPS) {
    return [{ pts: poly }];
  }
  const pieces: Pt3[][] = [];
  // Above the rect (y < ry0) and below it (y > ry1).
  pieces.push(clipPolyHalfPlane(poly, 'y', ry0, true));
  pieces.push(clipPolyHalfPlane(poly, 'y', ry1, false));
  // The middle band (ry0 ≤ y ≤ ry1), split left / right of the rect.
  const band = clipPolyHalfPlane(
    clipPolyHalfPlane(poly, 'y', ry0, false),
    'y',
    ry1,
    true,
  );
  pieces.push(clipPolyHalfPlane(band, 'x', rx0, true));
  pieces.push(clipPolyHalfPlane(band, 'x', rx1, false));
  return pieces
    .filter((p) => p.length >= 3 && polyAreaXY(p) > 1e-6)
    .map((pts) => ({ pts }));
}

// ── Main / wing gable prism ──────────────────────────────────────────────────
/**
 * Two sloped quads for a gable/steep roof over a rectangle. Ridge runs along
 * the longer axis; the shorter axis carries the slope. Eaves extend
 * `eaveOverhangFt` on the two eave (long) sides. Height at the ridge is
 * `slope * halfSpan` where halfSpan is the un-eaved short half-extent, so all
 * masses sharing `slope` line up. Also returns the ridge record.
 */
function gablePrism(
  rect: RectFt,
  slope: number,
  eave: Feet,
): { planes: RoofPlane[]; ridge: RoofPlan['ridges'][number]; ridgeAxis: Axis } {
  const ridgeAlongX = rect.w >= rect.h;
  const planes: RoofPlane[] = [];
  if (ridgeAlongX) {
    const midY = rect.y + rect.h / 2;
    const halfSpan = rect.h / 2;
    const ridgeZ = slope * halfSpan;
    const x0 = rect.x - eave, x1 = rect.x + rect.w + eave;
    const yN = rect.y - eave, yS = rect.y + rect.h + eave;
    // North slope (eave at yN, z=0 → ridge at midY, z=ridgeZ). Extend past the
    // eave so z reaches 0 exactly at the eave line.
    const zAtEaveN = ridgeZ - slope * (midY - yN);
    const zAtEaveS = ridgeZ - slope * (yS - midY);
    planes.push({ pts: [
      [x0, yN, zAtEaveN], [x1, yN, zAtEaveN], [x1, midY, ridgeZ], [x0, midY, ridgeZ],
    ] });
    planes.push({ pts: [
      [x0, midY, ridgeZ], [x1, midY, ridgeZ], [x1, yS, zAtEaveS], [x0, yS, zAtEaveS],
    ] });
    return { planes, ridge: { x1: rect.x, y1: midY, x2: rect.x + rect.w, y2: midY, zFt: ridgeZ }, ridgeAxis: 'x' };
  }
  const midX = rect.x + rect.w / 2;
  const halfSpan = rect.w / 2;
  const ridgeZ = slope * halfSpan;
  const y0 = rect.y - eave, y1 = rect.y + rect.h + eave;
  const xW = rect.x - eave, xE = rect.x + rect.w + eave;
  const zAtEaveW = ridgeZ - slope * (midX - xW);
  const zAtEaveE = ridgeZ - slope * (xE - midX);
  planes.push({ pts: [
    [xW, y0, zAtEaveW], [xW, y1, zAtEaveW], [midX, y1, ridgeZ], [midX, y0, ridgeZ],
  ] });
  planes.push({ pts: [
    [midX, y0, ridgeZ], [midX, y1, ridgeZ], [xE, y1, zAtEaveE], [xE, y0, zAtEaveE],
  ] });
  return { planes, ridge: { x1: midX, y1: rect.y, x2: midX, y2: rect.y + rect.h, zFt: ridgeZ }, ridgeAxis: 'y' };
}

/**
 * Hipped roof over a rectangle: ridge shortened by half the shorter extent at
 * each end → 2 trapezoids (long sides) + 2 triangles (short ends). Same slope
 * as a gable so it lines up with wings. Eaves on all four sides.
 */
function hipPrism(
  rect: RectFt,
  slope: number,
  eave: Feet,
): { planes: RoofPlane[]; ridge: RoofPlan['ridges'][number] } {
  const ridgeAlongX = rect.w >= rect.h;
  const planes: RoofPlane[] = [];
  const x0 = rect.x - eave, x1 = rect.x + rect.w + eave;
  const y0 = rect.y - eave, y1 = rect.y + rect.h + eave;
  if (ridgeAlongX) {
    const midY = rect.y + rect.h / 2;
    const halfSpan = rect.h / 2;
    const ridgeZ = slope * halfSpan;
    const hip = rect.h / 2; // ridge inset from each short end
    const rxW = rect.x + hip, rxE = rect.x + rect.w - hip;
    const zEaveN = ridgeZ - slope * (midY - y0);
    const zEaveS = ridgeZ - slope * (y1 - midY);
    // North trapezoid, south trapezoid.
    planes.push({ pts: [[x0, y0, zEaveN], [x1, y0, zEaveN], [rxE, midY, ridgeZ], [rxW, midY, ridgeZ]] });
    planes.push({ pts: [[x0, y1, zEaveS], [rxW, midY, ridgeZ], [rxE, midY, ridgeZ], [x1, y1, zEaveS]] });
    // West end triangle, east end triangle.
    planes.push({ pts: [[x0, y0, zEaveN], [rxW, midY, ridgeZ], [x0, y1, zEaveS]] });
    planes.push({ pts: [[x1, y0, zEaveN], [x1, y1, zEaveS], [rxE, midY, ridgeZ]] });
    return { planes, ridge: { x1: rxW, y1: midY, x2: rxE, y2: midY, zFt: ridgeZ } };
  }
  const midX = rect.x + rect.w / 2;
  const halfSpan = rect.w / 2;
  const ridgeZ = slope * halfSpan;
  const hip = rect.w / 2;
  const ryN = rect.y + hip, ryS = rect.y + rect.h - hip;
  const zEaveW = ridgeZ - slope * (midX - x0);
  const zEaveE = ridgeZ - slope * (x1 - midX);
  planes.push({ pts: [[x0, y0, zEaveW], [x0, y1, zEaveW], [midX, ryS, ridgeZ], [midX, ryN, ridgeZ]] });
  planes.push({ pts: [[x1, y0, zEaveE], [midX, ryN, ridgeZ], [midX, ryS, ridgeZ], [x1, y1, zEaveE]] });
  planes.push({ pts: [[x0, y0, zEaveW], [midX, ryN, ridgeZ], [x1, y0, zEaveE]] });
  planes.push({ pts: [[x0, y1, zEaveW], [x1, y1, zEaveE], [midX, ryS, ridgeZ]] });
  return { planes, ridge: { x1: midX, y1: ryN, x2: midX, y2: ryS, zFt: ridgeZ } };
}

// ── Wing valleys ─────────────────────────────────────────────────────────────
/**
 * Valley segments where a wing's roof meets the main's roof. The wing ridge
 * axis MUST be derived by the SAME rule gablePrism uses (`w >= h` → ridge along
 * x), because the crease pattern depends on how the wing ridge is oriented
 * relative to the main edge the wing crosses. Both roofs share the pitch slope
 * `s`, which cancels out of every crease equation below (the creases' XY
 * positions are slope-independent; only their z depends on s).
 *
 * Three cases per wing (derivations pinned in roofPlan.test.ts):
 *
 * 1. PERPENDICULAR ridge (T-shape: wing ridge along the protrusion axis, e.g.
 *    a deep south wing crossing the main's south eave). The wing's two side
 *    planes meet the main's facing plane along two diagonal valleys, each from
 *    the outer eave corner (wing side edge × main edge line, z=0) to the
 *    wing-ridge/main-slope junction, which sits half the wing's cross-width
 *    inside the crossed edge (equal slopes ⇒ 45° in plan).
 *
 * 2. PARALLEL ridge (wide wing: run ≥ depth, ridge parallel to the crossed
 *    eave). The wing's INNER plane z = s·(dist from the wing's inner eave) and
 *    the main's facing plane z = s·(dist from the crossed edge) are equal
 *    halfway across the overlap: a HORIZONTAL crease across the wing width,
 *    plus two short stubs where each wing sidewall descends the main slope
 *    from the crease to the crossed edge (z 0).
 *
 * 3. GABLE-END crossing (main ridge parallel to the protrusion axis): the
 *    crossed main side is a vertical gable end with NO facing slope — the
 *    junction is wall flashing, not a roof valley. Emit nothing.
 *
 * Returns [] for case 3 and for wings that do not protrude past the main.
 */
function wingValleys(wing: RectFt, main: RectFt): RoofPlan['valleys'] {
  // Which main edge does the wing cross? The wing overlaps the main by 1 cell
  // and protrudes on exactly one side.
  const protrudeN = wing.y < main.y - EPS;
  const protrudeS = wing.y + wing.h > main.y + main.h + EPS;
  const protrudeW = wing.x < main.x - EPS;
  const protrudeE = wing.x + wing.w > main.x + main.w + EPS;

  // SAME rule as gablePrism: ridge along x iff w >= h.
  const mainRidgeAlongX = main.w >= main.h;
  const wingRidgeAlongX = wing.w >= wing.h;

  if (protrudeN || protrudeS) {
    // Crossing a y-edge of the main. That edge is an eave only when the main
    // ridge runs along x; otherwise it is a gable end → no valley (case 3).
    if (!mainRidgeAlongX) return [];
    const edgeY = protrudeS ? main.y + main.h : main.y;
    if (!wingRidgeAlongX) {
      // Case 1 (T): wing ridge along y, perpendicular to the crossed eave.
      const midX = wing.x + wing.w / 2;
      const half = wing.w / 2;
      const junctionY = protrudeS ? edgeY - half : edgeY + half;
      return [
        { x1: wing.x, y1: edgeY, x2: midX, y2: junctionY },
        { x1: wing.x + wing.w, y1: edgeY, x2: midX, y2: junctionY },
      ];
    }
    // Case 2 (parallel): wing ridge along x. Inner wing plane rises from the
    // wing's inner eave; main plane rises from the crossed edge — equal at the
    // midpoint of the overlap band.
    const innerEaveY = protrudeS ? wing.y : wing.y + wing.h;
    const yStar = (edgeY + innerEaveY) / 2;
    return [
      { x1: wing.x, y1: yStar, x2: wing.x + wing.w, y2: yStar },
      { x1: wing.x, y1: yStar, x2: wing.x, y2: edgeY },
      { x1: wing.x + wing.w, y1: yStar, x2: wing.x + wing.w, y2: edgeY },
    ];
  }
  if (protrudeE || protrudeW) {
    // Crossing an x-edge: eave only when the main ridge runs along y.
    if (mainRidgeAlongX) return [];
    const edgeX = protrudeE ? main.x + main.w : main.x;
    if (wingRidgeAlongX) {
      // Case 1 (T): wing ridge along x, perpendicular to the crossed eave.
      const midY = wing.y + wing.h / 2;
      const half = wing.h / 2;
      const junctionX = protrudeE ? edgeX - half : edgeX + half;
      return [
        { x1: edgeX, y1: wing.y, x2: junctionX, y2: midY },
        { x1: edgeX, y1: wing.y + wing.h, x2: junctionX, y2: midY },
      ];
    }
    // Case 2 (parallel): wing ridge along y.
    const innerEaveX = protrudeE ? wing.x : wing.x + wing.w;
    const xStar = (edgeX + innerEaveX) / 2;
    return [
      { x1: xStar, y1: wing.y, x2: xStar, y2: wing.y + wing.h },
      { x1: xStar, y1: wing.y, x2: edgeX, y2: wing.y },
      { x1: xStar, y1: wing.y + wing.h, x2: edgeX, y2: wing.y + wing.h },
    ];
  }
  return [];
}

// ── The solver ───────────────────────────────────────────────────────────────

// ── One merged skin, built on a shared subdivision ──────────────────────────

/** A line a*x + b*y + c = 0, normalised so (a,b) is a unit vector. */
interface CutLine { a: number; b: number; c: number }

/** z = a*x + b*y + c for a planar polygon. */
function planeCoeffs(pts: Pt3[]): { a: number; b: number; c: number } {
  const z0 = planeZAt({ pts }, 0, 0);
  return { a: planeZAt({ pts }, 1, 0) - z0, b: planeZAt({ pts }, 0, 1) - z0, c: z0 };
}

/** Sutherland-Hodgman clip against an arbitrary half-plane a*x+b*y+c >= 0. */
function clipPolyLine(pts: Pt3[], a: number, b: number, c: number, keepGE: boolean): Pt3[] {
  const val = (p: Pt3): number => a * p[0] + b * p[1] + c;
  const inside = (p: Pt3): boolean => (keepGE ? val(p) >= -EPS : val(p) <= EPS);
  const out: Pt3[] = [];
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    const nxt = pts[(i + 1) % pts.length];
    const ci = inside(cur);
    const ni = inside(nxt);
    if (ci) out.push(cur);
    if (ci !== ni) {
      const vc = val(cur);
      const d = val(nxt) - vc;
      // The SAME t on both sides of the split, so both halves get the same
      // point. This is the property the previous attempt lacked.
      const t = Math.abs(d) < 1e-12 ? 0 : -vc / d;
      out.push([
        cur[0] + t * (nxt[0] - cur[0]),
        cur[1] + t * (nxt[1] - cur[1]),
        cur[2] + t * (nxt[2] - cur[2]),
      ]);
    }
  }
  return out;
}

/** Normalise so equal lines compare equal, and dedupe. */
function addLine(into: CutLine[], a: number, b: number, c: number): void {
  const n = Math.hypot(a, b);
  if (n < 1e-9) return;
  let na = a / n;
  let nb = b / n;
  let nc = c / n;
  // One canonical direction per line.
  if (na < -1e-9 || (Math.abs(na) <= 1e-9 && nb < 0)) {
    na = -na; nb = -nb; nc = -nc;
  }
  for (const l of into) {
    if (Math.abs(l.a - na) < 1e-6 && Math.abs(l.b - nb) < 1e-6 && Math.abs(l.c - nc) < 1e-6) return;
  }
  into.push({ a: na, b: nb, c: nc });
}

interface OwnedPlane { pts: Pt3[]; owner: number }

/**
 * Rebuild the roof as one surface.
 *
 * Cut lines are every polygon edge (eaves, ridges, hips, mass boundaries) plus,
 * for every pair of surfaces raised by DIFFERENT masses, the line where their
 * heights are equal. That last set is what puts a valley exactly on a patch
 * boundary instead of somewhere inside a patch.
 */
function subdivideRoof(items: OwnedPlane[]): RoofPlane[] {
  if (items.length === 0) return [];

  // Plan-view box of each surface, so overlap is a cheap test.
  const boxes = items.map((it) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [px, py] of it.pts) {
      x0 = Math.min(x0, px); x1 = Math.max(x1, px);
      y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    return { x0, x1, y0, y1 };
  });
  const overlaps = (a: number, b: number): boolean => {
    const p = boxes[a];
    const q = boxes[b];
    return p.x1 > q.x0 + EPS && q.x1 > p.x0 + EPS && p.y1 > q.y0 + EPS && q.y1 > p.y0 + EPS;
  };

  // A surface only needs cutting if another section's surface reaches into it.
  // Everything else is emitted whole, which is what keeps the piece count near
  // where it was before this solver existed.
  const contested = items.map((_, i) =>
    items.some((_o, j) => j !== i && items[j].owner !== items[i].owner && overlaps(i, j)));

  const lines: CutLine[] = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    for (let k = 0; k < it.pts.length; k++) {
      const [x1, y1] = it.pts[k];
      const [x2, y2] = it.pts[(k + 1) % it.pts.length];
      minX = Math.min(minX, x1); maxX = Math.max(maxX, x1);
      minY = Math.min(minY, y1); maxY = Math.max(maxY, y1);
      // Every surface edge is a cut line, even for surfaces emitted whole:
      // a rebuilt face that borders an untouched surface must land on its edge
      // exactly, or the two do not meet.
      addLine(lines, -(y2 - y1), x2 - x1, (y2 - y1) * x1 - (x2 - x1) * y1);
    }
  }
  const coeffs = items.map((it) => planeCoeffs(it.pts));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].owner === items[j].owner) continue;
      // Two surfaces that never meet in plan view need no seam between them.
      if (!overlaps(i, j)) continue;
      addLine(lines, coeffs[i].a - coeffs[j].a, coeffs[i].b - coeffs[j].b, coeffs[i].c - coeffs[j].c);
    }
  }

  // Nothing contested: the sections do not reach each other, so the original
  // surfaces are already one skin.
  if (!contested.some(Boolean)) return items.map((it) => ({ pts: it.pts }));
  // A pathological plan must not explode the face count.
  if (lines.length > 64) return items.map((it) => ({ pts: it.pts }));

  const pad = 2;
  let faces: Pt3[][] = [[
    [minX - pad, minY - pad, 0],
    [maxX + pad, minY - pad, 0],
    [maxX + pad, maxY + pad, 0],
    [minX - pad, maxY + pad, 0],
  ]];
  for (const l of lines) {
    const next: Pt3[][] = [];
    for (const f of faces) {
      let lo = 0;
      let hi = 0;
      for (const p of f) {
        const v = l.a * p[0] + l.b * p[1] + l.c;
        if (v > EPS) hi++;
        else if (v < -EPS) lo++;
      }
      if (hi === 0 || lo === 0) { next.push(f); continue; }
      const ge = clipPolyLine(f, l.a, l.b, l.c, true);
      const le = clipPolyLine(f, l.a, l.b, l.c, false);
      if (ge.length >= 3 && polyAreaXY(ge) > 1e-6) next.push(ge);
      if (le.length >= 3 && polyAreaXY(le) > 1e-6) next.push(le);
    }
    faces = next;
    if (faces.length > 4000) return items.map((it) => ({ pts: it.pts }));
  }

  const out: RoofPlane[] = [];
  // Uncontested surfaces are emitted exactly as they were raised. Only the
  // contested ones are rebuilt from the shared subdivision.
  for (let i = 0; i < items.length; i++) {
    if (!contested[i]) out.push({ pts: items[i].pts });
  }
  for (const f of faces) {
    let cx = 0;
    let cy = 0;
    for (const p of f) { cx += p[0]; cy += p[1]; }
    cx /= f.length;
    cy /= f.length;
    let win = -1;
    let best = -Infinity;
    for (let i = 0; i < items.length; i++) {
      if (!contested[i]) continue;
      if (!pointInPolyXY(cx, cy, items[i].pts)) continue;
      const z = coeffs[i].a * cx + coeffs[i].b * cy + coeffs[i].c;
      if (z > best) { best = z; win = i; }
    }
    if (win < 0) continue; // no roof over this patch
    const k = coeffs[win];
    out.push({ pts: f.map((p) => [p[0], p[1], k.a * p[0] + k.b * p[1] + k.c] as Pt3) });
  }
  return out;
}

/**
 * Close every open edge that lies inside the footprint.
 *
 * On the outline an open edge is correct: a wall carries it. Inside the
 * outline it is a step down to a lower roof, and you can see through it.
 */
function stepSkirts(planes: RoofPlane[], rects: RectFt[]): RoofPlane[] {
  const K = 1e4;
  const vk = (p: Pt3): string =>
    Math.round(p[0] * K) + ',' + Math.round(p[1] * K) + ',' + Math.round(p[2] * K);
  const ek = (a: Pt3, b: Pt3): string => (vk(a) < vk(b) ? vk(a) + '|' + vk(b) : vk(b) + '|' + vk(a));

  const count = new Map<string, number>();
  const ends = new Map<string, [Pt3, Pt3]>();
  for (const pl of planes) {
    for (let i = 0; i < pl.pts.length; i++) {
      const a = pl.pts[i];
      const b = pl.pts[(i + 1) % pl.pts.length];
      const key = ek(a, b);
      count.set(key, (count.get(key) ?? 0) + 1);
      ends.set(key, [a, b]);
    }
  }

  const depthInside = (px: Feet, py: Feet): number => {
    let best = -Infinity;
    for (const r of rects) {
      best = Math.max(best, Math.min(px - r.x, r.x + r.w - px, py - r.y, r.y + r.h - py));
    }
    return best;
  };
  const under = (p: Pt3): Feet => {
    let best = 0;
    for (const pl of planes) {
      if (!pointInPolyXY(p[0], p[1], pl.pts)) continue;
      const z = planeZAt(pl, p[0], p[1]);
      if (z < p[2] - EPS && z > best) best = z;
    }
    return best;
  };

  const skirts: RoofPlane[] = [];
  for (const [key, n] of count) {
    if (n !== 1) continue;
    const [a, b] = ends.get(key) as [Pt3, Pt3];
    if (depthInside((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) < 0.5) continue;
    const za = under(a);
    const zb = under(b);
    if (a[2] - za < EPS && b[2] - zb < EPS) continue;
    skirts.push({ pts: [a, b, [b[0], b[1], zb], [a[0], a[1], za]] });
  }
  return skirts;
}

export function solveRoof(input: SolveRoofInput): RoofPlan {
  const {
    masses,
    footprintCells,
    style,
    hearths,
    windowlessUpperRooms,
    wallTopFt,
    partyWallLeft = false,
    partyWallRight = false,
  } = input;
  const { roofForm, pitchRiseFt, eaveOverhangFt } = style;
  const eave = eaveOverhangFt;

  const main = masses.find((m) => m.kind === 'main') ?? masses[0];
  const mainRect = massRectFt(main);
  const wings = masses.filter((m) => m.kind === 'wing');
  const towers = masses.filter((m) => m.kind === 'tower');

  const slope = pitchSlope(mainRect, pitchRiseFt);

  let planes: RoofPlane[] = [];
  // Which mass raised each plane. Two slopes of the SAME mass meet at their own
  // ridge, so the height-equality line between them is not a valley.
  const owners: number[] = [];
  const ridges: RoofPlan['ridges'] = [];
  const valleys: RoofPlan['valleys'] = [];

  // ── Step 1: main mass roof ─────────────────────────────────────────────────
  if (roofForm === 'flat') {
    // No sloped planes; one ridge record marks the parapet line at z 0.
    const along = mainRect.w >= mainRect.h;
    ridges.push(
      along
        ? { x1: mainRect.x, y1: mainRect.y + mainRect.h / 2, x2: mainRect.x + mainRect.w, y2: mainRect.y + mainRect.h / 2, zFt: 0 }
        : { x1: mainRect.x + mainRect.w / 2, y1: mainRect.y, x2: mainRect.x + mainRect.w / 2, y2: mainRect.y + mainRect.h, zFt: 0 },
    );
  } else if (roofForm === 'hip') {
    const { planes: hp, ridge } = hipPrism(mainRect, slope, eave);
    planes.push(...hp);
    owners.push(...hp.map(() => 0));
    ridges.push(ridge);
  } else {
    // gable or steep
    const { planes: gp, ridge } = gablePrism(mainRect, slope, eave);
    planes.push(...gp);
    owners.push(...gp.map(() => 0));
    ridges.push(ridge);
  }

  // ── Step 2: wings ──────────────────────────────────────────────────────────
  const slopedMain = roofForm !== 'flat';
  let wingOwner = 1;
  for (const w of wings) {
    const wRect = massRectFt(w);
    if (slopedMain) {
      const { planes: wp, ridge } = gablePrism(wRect, slope, eave);
      planes.push(...wp);
      owners.push(...wp.map(() => wingOwner));
      wingOwner += 1;
      ridges.push(ridge);
      valleys.push(...wingValleys(wRect, mainRect));
    } else {
      // Flat main → flat wing: just a parapet ridge record.
      const along = wRect.w >= wRect.h;
      ridges.push(
        along
          ? { x1: wRect.x, y1: wRect.y + wRect.h / 2, x2: wRect.x + wRect.w, y2: wRect.y + wRect.h / 2, zFt: 0 }
          : { x1: wRect.x + wRect.w / 2, y1: wRect.y, x2: wRect.x + wRect.w / 2, y2: wRect.y + wRect.h, zFt: 0 },
      );
    }
  }

  // ── Step 2b: rebuild as ONE surface ───────────────────────────────────────
  // Until here every mass carries its own prism and the prisms simply overlap,
  // which is the junction defect. Rebuild the whole roof on a single
  // subdivision so neighbouring patches share exact corners.
  if (owners.length === planes.length && new Set(owners).size > 1) {
    planes = subdivideRoof(planes.map((p, i) => ({ pts: p.pts, owner: owners[i] })));
  }

  // ── Step 3: towers — clip planes out of tower cells, emit a cap ────────────
  const towerCaps: RoofTowerCap[] = [];
  for (const t of towers) {
    const tRect = massRectFt(t);
    // Clip EVERY plane (quads, trapezoids, hip end triangles, and n-gon
    // pieces from earlier tower clips) so the tower footprint is uncovered.
    const clipped: RoofPlane[] = [];
    for (const p of planes) clipped.push(...clipPolyToRectXY(p.pts, tRect));
    planes = clipped;
    const apexFt = pitchRiseFt * 1.6;
    towerCaps.push({
      x: tRect.x,
      y: tRect.y,
      w: tRect.w,
      d: tRect.h,
      apexFt,
      form: roofForm === 'steep' ? 'cone' : 'pyramid',
    });
  }

  // ── Step 3b: attached-lot roof boundaries ────────────────────────────────
  // Two row members otherwise each carry their full eave across the same lot
  // boundary, creating a four-foot overlap once production clearance is added.
  // At a party wall, clip the canonical plane to the footprint envelope. The
  // interpolated cut reaches z=0 at the shared wall top, while front/back eaves
  // and every detached side retain their normal overhang.
  if ((partyWallLeft || partyWallRight) && footprintCells.length > 0) {
    const minXFt = Math.min(...footprintCells.map((cell) => cell.cx)) * CELL_FT;
    const maxXFt = (Math.max(...footprintCells.map((cell) => cell.cx)) + 1) * CELL_FT;
    planes = planes.flatMap((plane) => {
      let pts = plane.pts;
      if (partyWallLeft) pts = clipPolyHalfPlane(pts, 'x', minXFt, false);
      if (partyWallRight) pts = clipPolyHalfPlane(pts, 'x', maxXFt, true);
      return pts.length >= 3 && polyAreaXY(pts) > EPS ? [{ pts }] : [];
    });
  }

  // ── Step 4: chimneys ───────────────────────────────────────────────────────
  const chimneys: RoofChimney[] = [];
  const merged: Array<{ x: Feet; y: Feet }> = [];
  for (const h of hearths) {
    if (merged.some((m) => Math.hypot(m.x - h.x, m.y - h.y) <= CELL_FT + EPS)) continue;
    merged.push(h);
  }
  for (const h of merged) {
    const localZ = roofZAt(planes, h.x, h.y);
    chimneys.push({ x: h.x, y: h.y, topFt: localZ + 3 });
  }

  // ── Step 5: dormers (skip on flat) ─────────────────────────────────────────
  const dormers: RoofDormer[] = [];
  if (slopedMain) {
    for (const room of windowlessUpperRooms) {
      const px = room.cx * CELL_FT + CELL_FT / 2;
      const py = room.cy * CELL_FT + CELL_FT / 2;
      const snap = nearestSlopedPlane(planes, px, py);
      if (!snap) continue;
      dormers.push({ x: px, y: py, nx: snap.nx, ny: snap.ny });
    }
  }

  // ── Step 5b: close the steps the subdivision leaves ───────────────────────
  const skirts = slopedMain ? stepSkirts(planes, masses.map((m) => massRectFt(m))) : [];

  return {
    planes,
    skirts,
    ridges,
    valleys,
    chimneys,
    dormers,
    towerCaps,
    pitchRiseFt,
    eaveOverhangFt,
  };
}

/** Highest covering plane z at (x,y); 0 if none cover it (flat/uncovered). */
function roofZAt(planes: RoofPlane[], x: Feet, y: Feet): Feet {
  let best = 0;
  for (const p of planes) {
    if (pointInPolyXY(x, y, p.pts)) best = Math.max(best, planeZAt(p, x, y));
  }
  return best;
}

/**
 * Nearest sloped plane covering (or closest to) a point, with the outward
 * (downhill) horizontal normal of that plane. Prefers a plane that actually
 * covers the point; falls back to the nearest by XY-centroid distance.
 */
function nearestSlopedPlane(
  planes: RoofPlane[],
  x: Feet,
  y: Feet,
): { nx: number; ny: number } | null {
  const covering = planes.filter((p) => pointInPolyXY(x, y, p.pts));
  const candidates = covering.length > 0 ? covering : planes;
  if (candidates.length === 0) return null;
  let best = candidates[0];
  let bestD = Infinity;
  for (const p of candidates) {
    const c = centroidXY(p.pts);
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) { bestD = d; best = p; }
  }
  return downhillNormal(best);
}

/** Downhill horizontal unit normal of a plane (direction of steepest descent). */
function downhillNormal(plane: RoofPlane): { nx: number; ny: number } {
  // Gradient of z over XY. Fit from three corners.
  const p = plane.pts;
  const [ax, ay, az] = p[0];
  for (let i = 1; i < p.length; i++) {
    const [bx, by, bz] = p[i];
    for (let j = i + 1; j < p.length; j++) {
      const [cx, cy, cz] = p[j];
      const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      if (Math.abs(det) < EPS) continue;
      // dz/dx, dz/dy from linear fit.
      const dzdx = ((bz - az) * (cy - ay) - (cz - az) * (by - ay)) / det;
      const dzdy = ((cz - az) * (bx - ax) - (bz - az) * (cx - ax)) / det;
      // Downhill = negative gradient.
      const gx = -dzdx, gy = -dzdy;
      const len = Math.hypot(gx, gy);
      if (len < EPS) return { nx: 0, ny: 0 };
      return { nx: gx / len, ny: gy / len };
    }
  }
  return { nx: 0, ny: 0 };
}

function centroidXY(pts: Pt3[]): { x: Feet; y: Feet } {
  let sx = 0, sy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; }
  return { x: sx / pts.length, y: sy / pts.length };
}

function pointInPolyXY(px: Feet, py: Feet, pts: Pt3[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1];
    const xj = pts[j][0], yj = pts[j][1];
    const intersect =
      (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Test-only surface for unit-testing internal helpers. */
export const __private = {
  pitchSlope,
  massRectFt,
  gablePrism,
  hipPrism,
  wingValleys,
  downhillNormal,
  pointInPolyXY,
};

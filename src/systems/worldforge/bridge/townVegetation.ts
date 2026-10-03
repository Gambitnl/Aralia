/**
 * @file townVegetation.ts — the trees a town plants for itself.
 *
 * Wilderness vegetation is now kept out of every settlement
 * (see townVegetationKeepOut.ts), which fixed trees standing among the roofs
 * and left a new problem in its place: a bare, mown-looking town. Real
 * settlements are full of trees. They are just not the same trees, and they are
 * not there for the same reason — a town's trees are PLANTED, and what a parcel
 * grows follows from what the parcel is for.
 *
 * The town plan already knows. `openLand` parcels the ground the walls enclose
 * but the wards never built on, and each one carries a kind. This file is the
 * mapping from that kind to what stands on it:
 *
 *   orchard — tree crops, in ROWS. The one place in this whole codebase where a
 *             regular grid is correct. Everything else about procedural
 *             vegetation is a fight against evenness; an orchard is evenness
 *             with a reason, and a jittered orchard reads as a failure.
 *   garden  — kitchen gardens: bushes and the odd small fruit tree, worked
 *             ground, so planting is sparse and set back from the middle.
 *   yard    — service ground. Sheds, middens and woodpiles do not share space
 *             with trees, so a yard gets at most one, usually none.
 *   paddock — stock eat saplings. A paddock is grazed bare except for the
 *             occasional big shade tree the animals stand under.
 *   ruin    — nobody is weeding it. Self-seeded scrub and saplings, thickest at
 *             the middle where the footings hold water.
 *
 * Output is `GroundFeature`s with their own kinds (`townTree`, `townBush`), so
 * the keep-out filter can pass them through while still deleting every wild
 * plant that lands on the same ground.
 */
import type { GroundFeature } from './groundChunkLoader';

/** Region-feet point, matching the transformed town plan's frame. */
export type FeetPt = [number, number];

export type OpenLandKind = 'yard' | 'garden' | 'orchard' | 'paddock' | 'ruin';

export interface TownParcel {
  polygon: FeetPt[];
  kind: OpenLandKind;
}

/**
 * Planting rule per parcel kind.
 *
 * `perAreaSqFt` is one plant per this many square feet, which is the only unit
 * that behaves when parcels range from a back yard to a paddock. `bushShare`
 * is how much of that count comes out as bushes rather than trees.
 */
const RULES: Record<OpenLandKind, {
  perAreaSqFt: number;
  bushShare: number;
  /** Orchards only: row and in-row spacing, feet. */
  rows?: { alongFt: number; acrossFt: number };
  /** Keep planting this far inside the parcel edge, feet. */
  insetFt: number;
}> = {
  // A grown orchard is roughly 25 ft between trees each way. The rows are what
  // the eye reads, so the spacing matters more than the count.
  orchard: { perAreaSqFt: 0, bushShare: 0, rows: { alongFt: 25, acrossFt: 28 }, insetFt: 10 },
  garden: { perAreaSqFt: 900, bushShare: 0.75, insetFt: 6 },
  yard: { perAreaSqFt: 3200, bushShare: 0.6, insetFt: 5 },
  paddock: { perAreaSqFt: 9000, bushShare: 0.25, insetFt: 14 },
  ruin: { perAreaSqFt: 700, bushShare: 0.55, insetFt: 3 },
};

function hash01(a: number, b: number, salt: number): number {
  let h = Math.imul(Math.round(a * 8) + 374761393, 668265263)
    ^ Math.imul(Math.round(b * 8) + 1442695041, 1597334677)
    ^ (salt | 0);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

function polygonArea(poly: FeetPt[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  }
  return Math.abs(a) / 2;
}

function pointInPolygon(x: number, y: number, poly: FeetPt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Shortest distance from a point to the polygon's boundary. */
function distToEdge(x: number, y: number, poly: FeetPt[]): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[j];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    if (d < best) best = d;
  }
  return best;
}

function bbox(poly: FeetPt[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
}

/**
 * Longest edge direction, as a unit vector.
 *
 * Orchard rows run along the parcel rather than along the world axes, because
 * a plot is laid out to its own boundary and rows square to north in a parcel
 * that is not would read as a grid dropped on top of the town. The longest edge
 * is a cheap and reliable read of "the way this parcel points".
 */
function principalAxis(poly: FeetPt[]): [number, number] {
  let best = 0;
  let ax = 1;
  let ay = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const dx = poly[i][0] - poly[j][0];
    const dy = poly[i][1] - poly[j][1];
    const len = Math.hypot(dx, dy);
    if (len > best) {
      best = len;
      ax = dx / len;
      ay = dy / len;
    }
  }
  return [ax, ay];
}

/**
 * Plant one town's open land.
 *
 * Coordinates in are region feet (the transformed plan's frame); coordinates
 * out are ground meters relative to the artifact bounds, matching every other
 * GroundFeature. `startId` keeps town features from colliding with the ids
 * generateLocal already handed to wild plants.
 */
export function buildTownVegetation(
  parcels: readonly TownParcel[],
  boundsXFt: number,
  boundsYFt: number,
  feetToMeters: number,
  seed: number,
  startId: number,
): GroundFeature[] {
  const out: GroundFeature[] = [];
  let id = startId;

  const emit = (fx: number, fy: number, tree: boolean, dens: number) => {
    out.push({
      id: id++,
      kind: tree ? 'townTree' : 'townBush',
      xM: (fx - boundsXFt) * feetToMeters,
      zM: (fy - boundsYFt) * feetToMeters,
      dens,
    });
  };

  for (const [pi, parcel] of parcels.entries()) {
    const poly = parcel.polygon;
    if (poly.length < 3) continue;
    const rule = RULES[parcel.kind];
    if (!rule) continue;
    const area = polygonArea(poly);
    if (area < 250) continue; // smaller than a shed — nothing is planted here
    const box = bbox(poly);
    const salt = (seed ^ (pi * 0x9e3779b9)) | 0;

    if (rule.rows) {
      /* Orchard: a real lattice, walked in the parcel's own frame.
       *
       * The jitter is deliberately tiny — a foot or so — because an orchard
       * planted by people is regular but not surveyed, and perfectly exact
       * rows read as a texture rather than as trees. Anything larger destroys
       * the rows, which are the entire point.
       */
      const [ax, ay] = principalAxis(poly);
      const px = -ay;
      const py = ax;
      const diag = Math.hypot(box.w, box.h);
      const cx = (box.minX + box.maxX) / 2;
      const cy = (box.minY + box.maxY) / 2;
      const halfA = Math.ceil(diag / 2 / rule.rows.alongFt);
      const halfR = Math.ceil(diag / 2 / rule.rows.acrossFt);
      for (let r = -halfR; r <= halfR; r++) {
        for (let a = -halfA; a <= halfA; a++) {
          const jx = (hash01(a, r, salt) - 0.5) * 2.0;
          const jy = (hash01(r, a, salt ^ 77) - 0.5) * 2.0;
          const fx = cx + ax * (a * rule.rows.alongFt) + px * (r * rule.rows.acrossFt) + jx;
          const fy = cy + ay * (a * rule.rows.alongFt) + py * (r * rule.rows.acrossFt) + jy;
          if (!pointInPolygon(fx, fy, poly)) continue;
          if (distToEdge(fx, fy, poly) < rule.insetFt) continue;
          emit(fx, fy, true, 0.85);
        }
      }
      continue;
    }

    /* Everything else: a count from the parcel's area, scattered by rejection.
     *
     * Planting is pushed AWAY from the edge, which is what the inset does, and
     * for ruins it is pushed toward the middle instead — the footings hold
     * water and the middle of a ruin is where the scrub is thickest.
     */
    const target = Math.floor(area / rule.perAreaSqFt);
    if (target <= 0) continue;
    const reach = Math.max(1, Math.min(box.w, box.h) / 2);
    let placed = 0;
    for (let attempt = 0; attempt < target * 24 && placed < target; attempt++) {
      const fx = box.minX + hash01(attempt, pi, salt) * box.w;
      const fy = box.minY + hash01(pi, attempt, salt ^ 31) * box.h;
      if (!pointInPolygon(fx, fy, poly)) continue;
      const edge = distToEdge(fx, fy, poly);
      if (edge < rule.insetFt) continue;
      const middleness = Math.min(1, edge / reach);
      if (parcel.kind === 'ruin' && hash01(attempt, pi, salt ^ 9) > 0.35 + 0.65 * middleness) continue;
      const isBush = hash01(attempt, pi, salt ^ 5) < rule.bushShare;
      emit(fx, fy, !isBush, middleness);
      placed++;
    }
  }

  return out;
}

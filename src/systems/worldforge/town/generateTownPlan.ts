/**
 * @file generateTownPlan.ts — L2 Town street skeleton (SPEC §6 passes 2–3).
 *
 * Given a RegionTownSite (envelope + gates from L1), grows an ORGANIC street
 * network and subdivides it into blocks/plots. Produces the spine's TownPlan
 * type (artifacts.ts: streets + plots).
 *
 * Quality bar: Watabou's organic geometry (SPEC §6, decision #5).
 * Algorithm: radial-growth with jittered branches (not a grid).
 *
 * ── Street growth algorithm ────────────────────────────────────────────────
 * 1. **Primary streets**: Each gate connects to a jittered center point via a
 *    multi-segment polyline. At each step, the path advances toward center
 *    with perpendicular jitter, producing natural curves.
 * 2. **Secondary streets**: Branch from primary streets at irregular intervals
 *    with noisy angles (±30° from parent direction + large perpendicular
 *    component). Shorter than primaries.
 * 3. **Ring road**: For larger towns (≥4 gates), a partial ring connects
 *    primaries at ~60% of envelope radius.
 * 4. All randomness via seed-path streams — zero Math.random.
 *
 * ── Block/plot subdivision ─────────────────────────────────────────────────
 * Along each street segment, plots are created as perpendicular quads:
 * - Walk along segment at ~60 ft frontage intervals.
 * - Each plot is a quad offset perpendicular from the street centerline.
 * - Depth: 40–80 ft (houses), wider near center.
 * - Density falls off from center: inner plots always generated, outer plots
 *   probabilistically skipped based on distance ratio.
 * - Role: 'market' within 20% of center radius, 'house' elsewhere.
 *
 * ── Population scaling ─────────────────────────────────────────────────────
 * Envelope area determines street/plot density:
 * - Hamlet (envelope ~800×800 ft): 1 primary + few plots
 * - City (envelope ~4000×4000 ft): multiple primaries + secondaries + ring
 *
 * What changed: new module (directive C3).
 * Preserved: spine/artifacts.ts TownPlan type consumed read-only.
 */
import {
  type TownPlan,
} from '../artifacts';
import {
  childSeedPath,
  rngFromPath,
  streamPath,
  type SeedPath,
} from '../seedPath';
import type { BoundsFt, Feet } from '../units';
import type { RegionTownSite } from '../artifacts';

// ── Types ───────────────────────────────────────────────────────────────────

/** Internal street representation before conversion to TownPlan format. */
interface InternalStreet {
  id: number;
  points: Array<[Feet, Feet]>;
  widthFt: Feet;
  kind: 'primary' | 'secondary' | 'ring';
}

export interface GenerateTownPlanOptions {
  /** Override population estimate (affects density). Defaults from envelope area. */
  population?: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Street widths by kind (feet). */
const PRIMARY_WIDTH_FT = 30;
const SECONDARY_WIDTH_FT = 18;
const RING_WIDTH_FT = 22;

/** Plot dimensions (feet). */
const PLOT_FRONTAGE_FT = 60;
const PLOT_DEPTH_MIN_FT = 40;
const PLOT_DEPTH_MAX_FT = 80;

/** Market plots get larger frontage. */
const MARKET_FRONTAGE_FT = 80;
const MARKET_DEPTH_FT = 60;

/** Minimum clear walkway between any two building plots (feet). */
const PLOT_GAP_FT = 6;

/** Market radius as fraction of envelope half-diagonal. */
const MARKET_RADIUS_FRACTION = 0.2;

/** Primary street segment length (feet) — step size when growing toward center. */
const PRIMARY_STEP_FT = 80;

/** Jitter amplitude perpendicular to travel direction (feet). */
const PRIMARY_JITTER_FT = 25;

/** Secondary street max length as fraction of distance to nearest edge. */
const SECONDARY_LENGTH_FRACTION = 0.45;

/** Secondary branch angle range (radians from perpendicular to parent). */
const BRANCH_ANGLE_SPREAD = Math.PI / 4; // ±45°

/** Minimum distance from center for secondary branch spawn (feet). */
const SECONDARY_SPAWN_MIN_FROM_CENTER = 60;

/** Ring road radius as fraction of envelope half-diagonal. */
const RING_RADIUS_FRACTION = 0.6;

/** Minimum gates needed for a ring road. */
const RING_MIN_GATES = 3;

// ── Main entry ──────────────────────────────────────────────────────────────

/**
 * Generate a TownPlan: organic street network + plot subdivision.
 *
 * @param site - RegionTownSite with envelope and gates from L1.
 * @param seedPath - Seed path for deterministic randomness.
 * @param opts - Optional overrides.
 */
export function generateTownPlan(
  site: RegionTownSite,
  seedPath: SeedPath,
  opts: GenerateTownPlanOptions = {},
): TownPlan {
  const { envelope, gates, burgId } = site;
  const townPath = childSeedPath(seedPath, `town:${burgId}`);

  // Center of envelope with slight jitter for organic feel
  const centerRng = rngFromPath(streamPath(townPath, 'center'));
  const jitterX = (centerRng.next() - 0.5) * envelope.width * 0.08;
  const jitterY = (centerRng.next() - 0.5) * envelope.height * 0.08;
  const cx = envelope.x + envelope.width / 2 + jitterX;
  const cy = envelope.y + envelope.height / 2 + jitterY;
  const center: [Feet, Feet] = [cx, cy];

  // Town scale from envelope area
  const envelopeArea = envelope.width * envelope.height;
  const halfDiag = Math.sqrt(envelopeArea) / 2;

  // If no gates, produce minimal plan (isolated hamlet)
  const effectiveGates = gates.length > 0 ? gates : generateFallbackGates(envelope, townPath);

  // ── Grow streets ──────────────────────────────────────────────────────
  const streetRng = rngFromPath(streamPath(townPath, 'streets'));
  const streets = growStreets(effectiveGates, center, envelope, halfDiag, streetRng, townPath);

  // ── Generate plots ────────────────────────────────────────────────────
  const plotRng = rngFromPath(streamPath(townPath, 'plots'));
  const plots = generatePlots(streets, center, halfDiag, envelope, plotRng);

  // Convert streets to TownPlan format
  const planStreets = streets.map((s) => ({
    id: s.id,
    centerline: s.points,
    widthFt: s.widthFt,
  }));

  return {
    burgId,
    streets: planStreets,
    plots,
  };
}

// ── Fallback gates ──────────────────────────────────────────────────────────

/** When no gates from L1, create 2 entry points on opposite sides. */
function generateFallbackGates(
  envelope: BoundsFt,
  townPath: SeedPath,
): Array<[Feet, Feet]> {
  const rng = rngFromPath(streamPath(townPath, 'fallback-gates'));
  const yMid = envelope.y + envelope.height * (0.4 + rng.next() * 0.2);
  return [
    [envelope.x, yMid],                              // left edge
    [envelope.x + envelope.width, yMid],              // right edge
  ];
}

// ── SeededRandom interface ──────────────────────────────────────────────────

interface Rng {
  next(): number; // 0..1
}

// ── Street growth ───────────────────────────────────────────────────────────

function growStreets(
  gates: Array<[Feet, Feet]>,
  center: [Feet, Feet],
  envelope: BoundsFt,
  halfDiag: number,
  rng: Rng,
  townPath: SeedPath,
): InternalStreet[] {
  const streets: InternalStreet[] = [];
  let streetId = 0;

  // ── Primary streets: gate → center ────────────────────────────────────
  const primaryStreets: InternalStreet[] = [];
  for (const gate of gates) {
    const points = growPath(gate, center, PRIMARY_STEP_FT, PRIMARY_JITTER_FT, envelope, rng);
    const street: InternalStreet = {
      id: streetId++,
      points,
      widthFt: PRIMARY_WIDTH_FT,
      kind: 'primary',
    };
    primaryStreets.push(street);
    streets.push(street);
  }

  // ── Secondary streets: branches from primaries ────────────────────────
  for (const primary of primaryStreets) {
    const branchRng = rngFromPath(streamPath(townPath, `branch-${primary.id}`));
    const numBranches = Math.max(1, Math.floor(2 + branchRng.next() * (halfDiag / 500)));

    for (let b = 0; b < numBranches; b++) {
      // Pick a random point along the primary (not too close to center or end)
      const t = 0.2 + branchRng.next() * 0.6;
      const idx = Math.floor(t * (primary.points.length - 1));
      const spawnPt = primary.points[idx];

      // Skip if too close to center
      const distToCenter = dist(spawnPt, center);
      if (distToCenter < SECONDARY_SPAWN_MIN_FROM_CENTER) continue;

      // Compute parent direction at spawn point
      const nextIdx = Math.min(idx + 1, primary.points.length - 1);
      const parentDir = Math.atan2(
        primary.points[nextIdx][1] - spawnPt[1],
        primary.points[nextIdx][0] - spawnPt[0],
      );

      // Branch perpendicular to parent ± angle spread. side picks WHICH
      // perpendicular (left/right of travel): parentDir + side·90° + noise.
      // (The original `(parentDir + 90°) * side` MULTIPLIED the angle by ±1,
      // which mirrors it across the x-axis — branches could double back
      // along their parent instead of leaving it.)
      const side = branchRng.next() > 0.5 ? 1 : -1;
      const angleNoise = (branchRng.next() - 0.5) * BRANCH_ANGLE_SPREAD;
      const branchAngle = parentDir + side * (Math.PI / 2) + angleNoise;

      // Length: fraction of distance to nearest envelope edge
      const distToEdge = minDistToEnvelopeEdge(spawnPt, envelope);
      const branchLength = distToEdge * SECONDARY_LENGTH_FRACTION;

      if (branchLength < 40) continue; // too short

      const endPoint: [Feet, Feet] = [
        spawnPt[0] + Math.cos(branchAngle) * branchLength,
        spawnPt[1] + Math.sin(branchAngle) * branchLength,
      ];

      // Clamp endpoint to envelope
      const clampedEnd = clampToEnvelope(endPoint, envelope);

      // Grow a short path with jitter
      const branchStep = PRIMARY_STEP_FT * 0.7;
      const branchJitter = PRIMARY_JITTER_FT * 0.6;
      const branchPoints = growPath(spawnPt, clampedEnd, branchStep, branchJitter, envelope, branchRng);

      streets.push({
        id: streetId++,
        points: branchPoints,
        widthFt: SECONDARY_WIDTH_FT,
        kind: 'secondary',
      });
    }
  }

  // ── Ring road (optional) ──────────────────────────────────────────────
  if (gates.length >= RING_MIN_GATES) {
    const ringRng = rngFromPath(streamPath(townPath, 'ring'));
    const ringRadius = halfDiag * RING_RADIUS_FRACTION;
    const ringPoints = growRing(center, ringRadius, envelope, ringRng);
    if (ringPoints.length >= 4) {
      streets.push({
        id: streetId++,
        points: ringPoints,
        widthFt: RING_WIDTH_FT,
        kind: 'ring',
      });
    }
  }

  return streets;
}

/**
 * Grow a jittered path from start to end. Each step advances toward end with
 * perpendicular jitter. Returns polyline points [start, ..., end].
 */
function growPath(
  start: [Feet, Feet],
  end: [Feet, Feet],
  stepSize: number,
  jitterAmp: number,
  envelope: BoundsFt,
  rng: Rng,
): Array<[Feet, Feet]> {
  const points: Array<[Feet, Feet]> = [start];
  let current = start;
  const totalDist = dist(start, end);

  if (totalDist < stepSize) {
    points.push(end);
    return points;
  }

  const numSteps = Math.max(2, Math.ceil(totalDist / stepSize));

  for (let i = 1; i < numSteps; i++) {
    const t = i / numSteps;
    // Linear interpolation
    const baseX = start[0] + (end[0] - start[0]) * t;
    const baseY = start[1] + (end[1] - start[1]) * t;

    // Perpendicular direction
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;

    // Jitter (less at endpoints for clean connections)
    const endFade = Math.sin(t * Math.PI); // 0 at t=0,1; 1 at t=0.5
    const jitter = (rng.next() - 0.5) * 2 * jitterAmp * endFade;

    const px = baseX + perpX * jitter;
    const py = baseY + perpY * jitter;

    // Clamp to envelope
    const clamped = clampToEnvelope([px, py], envelope);
    points.push(clamped);
    current = clamped;
  }

  points.push(end);
  return points;
}

/**
 * Grow a partial ring road around the center at the given radius.
 * Produces an arc (not full circle) connecting primary streets.
 */
function growRing(
  center: [Feet, Feet],
  radius: number,
  envelope: BoundsFt,
  rng: Rng,
): Array<[Feet, Feet]> {
  // Arc from ~30° to ~330° (partial ring, ~5/6 of circle)
  const startAngle = rng.next() * Math.PI * 0.3; // 0 to ~54°
  const endAngle = startAngle + Math.PI * (1.4 + rng.next() * 0.4); // ~252° to ~324°
  const numSegments = 12;
  const points: Array<[Feet, Feet]> = [];

  for (let i = 0; i <= numSegments; i++) {
    const t = i / numSegments;
    const angle = startAngle + (endAngle - startAngle) * t;
    const jitterR = (rng.next() - 0.5) * radius * 0.1;
    const r = radius + jitterR;
    const px = center[0] + Math.cos(angle) * r;
    const py = center[1] + Math.sin(angle) * r;
    const clamped = clampToEnvelope([px, py], envelope);
    points.push(clamped);
  }

  return points;
}

// ── Plot generation ─────────────────────────────────────────────────────────

function generatePlots(
  streets: InternalStreet[],
  center: [Feet, Feet],
  halfDiag: number,
  envelope: BoundsFt,
  rng: Rng,
): TownPlan['plots'] {
  const plots: TownPlan['plots'] = [];
  let plotId = 0;
  const marketRadius = halfDiag * MARKET_RADIUS_FRACTION;

  // Collect all occupied regions to prevent overlap. Centers give a cheap
  // pre-filter; footprints back the exact SAT check (center distance alone
  // let rotated quads from DIFFERENT streets overlap — the village renders
  // showed buildings cutting through each other).
  const plotCenters: Array<[number, number]> = [];
  const acceptedFootprints: Array<Array<[number, number]>> = [];

  for (const street of streets) {
    const pts = street.points;

    for (let seg = 0; seg < pts.length - 1; seg++) {
      const [ax, ay] = pts[seg];
      const [bx, by] = pts[seg + 1];
      const segLen = dist(pts[seg], pts[seg + 1]);
      if (segLen < 10) continue;

      // Direction and perpendicular
      const dx = (bx - ax) / segLen;
      const dy = (by - ay) / segLen;
      const perpX = -dy;
      const perpY = dx;

      // Number of plots along this segment
      const frontage = PLOT_FRONTAGE_FT;
      const numPlots = Math.max(1, Math.floor(segLen / frontage));

      for (let p = 0; p < numPlots; p++) {
        const t = (p + 0.5) / numPlots;
        const midX = ax + (bx - ax) * t;
        const midY = ay + (by - ay) * t;

        // Distance from center determines density + role
        const distFromCenter = dist([midX, midY], center);
        const distRatio = distFromCenter / halfDiag;
        const density = Math.max(0.2, 1.0 - distRatio * 0.7);

        // Skip plots probabilistically based on density (outer = fewer)
        if (rng.next() > density) continue;

        const isMarket = distFromCenter < marketRadius;
        const plotFrontage = isMarket ? MARKET_FRONTAGE_FT : frontage;
        const plotDepth = isMarket
          ? MARKET_DEPTH_FT
          : PLOT_DEPTH_MIN_FT + rng.next() * (PLOT_DEPTH_MAX_FT - PLOT_DEPTH_MIN_FT);

        // Place on both sides of street
        for (const side of [-1, 1] as const) {
          // Skip some outer plots on one side for organic feel
          if (distRatio > 0.6 && rng.next() > 0.6) continue;

          const offsetX = perpX * side * (street.widthFt / 2 + plotDepth / 2 + 5);
          const offsetY = perpY * side * (street.widthFt / 2 + plotDepth / 2 + 5);
          const plotCx = midX + offsetX;
          const plotCy = midY + offsetY;

          // Check within envelope
          if (!pointInEnvelope([plotCx, plotCy], envelope, plotDepth / 2)) continue;

          // Check overlap with existing plots (minimum distance check)
          const tooClose = plotCenters.some(
            ([cx, cy]) => dist([plotCx, plotCy], [cx, cy]) < plotFrontage * 0.6,
          );
          if (tooClose) continue;

          // Build quad footprint (rotated to align with street)
          const halfF = plotFrontage / 2;
          const halfD = plotDepth / 2;
          const footprint: Array<[Feet, Feet]> = [
            [plotCx - dx * halfF - perpX * side * halfD, plotCy - dy * halfF - perpY * side * halfD],
            [plotCx + dx * halfF - perpX * side * halfD, plotCy + dy * halfF - perpY * side * halfD],
            [plotCx + dx * halfF + perpX * side * halfD, plotCy + dy * halfF + perpY * side * halfD],
            [plotCx - dx * halfF + perpX * side * halfD, plotCy - dy * halfF + perpY * side * halfD],
          ];

          // Validate: non-self-intersecting (convex quad check)
          if (!isConvexQuad(footprint)) continue;

          // Requirement 2 (C3): plots must not overlap ANY street band — the
          // perpendicular offset only clears the SPAWNING street; a crossing
          // primary/ring can still cut through. Sample the footprint
          // (vertices + edge midpoints + centroid) against every street
          // centerline and reject when any sample sits inside a street band.
          // Sampling (vs exact polygon-segment distance) is sufficient at
          // these scales: plot edges are ≤80 ft, street steps ≥56 ft, so a
          // band crossing the quad always passes near a sample.
          if (plotOverlapsAnyStreet(footprint, [plotCx, plotCy], streets)) continue;

          // Exact quad-vs-quad separation with a walkway gap. The center
          // pre-check above can pass while rotated quads still intersect;
          // SAT over both quads' edge normals catches those. Only test
          // accepted plots within plausible reach (cheap distance gate).
          const REACH_FT = 170; // > two max half-diagonals + gap
          let intersects = false;
          for (let k = 0; k < acceptedFootprints.length; k++) {
            if (dist([plotCx, plotCy], plotCenters[k]) > REACH_FT) continue;
            if (quadsOverlapWithGap(footprint, acceptedFootprints[k], PLOT_GAP_FT)) {
              intersects = true;
              break;
            }
          }
          if (intersects) continue;

          // Only ACCEPTED plots consume a spacing slot (a rejected candidate
          // previously blocked its neighbors' placement).
          plotCenters.push([plotCx, plotCy]);
          acceptedFootprints.push(footprint);

          const storeys = isMarket ? 2 : (distRatio < 0.4 ? 2 + Math.floor(rng.next() * 2) : 1);
          const role = isMarket ? 'market' : 'house';

          plots.push({
            id: plotId++,
            footprint,
            role,
            storeys,
          });
        }
      }
    }
  }

  return plots;
}

// ── Geometry helpers ────────────────────────────────────────────────────────

/**
 * True when any footprint sample point (vertices, edge midpoints, centroid)
 * lies within a street's half-width band of that street's centerline.
 * Requirement 2 (C3): plot polygons must not overlap streets.
 */
function plotOverlapsAnyStreet(
  footprint: Array<[Feet, Feet]>,
  centroid: [Feet, Feet],
  streets: InternalStreet[],
): boolean {
  const samples: Array<[number, number]> = [centroid];
  for (let v = 0; v < footprint.length; v++) {
    const a = footprint[v];
    const b = footprint[(v + 1) % footprint.length];
    samples.push(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  }

  for (const street of streets) {
    const clearance = street.widthFt / 2;
    const pts = street.points;
    for (let s = 0; s < pts.length - 1; s++) {
      for (const sp of samples) {
        if (pointToSegmentDistFt(sp, pts[s], pts[s + 1]) < clearance) return true;
      }
    }
  }
  return false;
}

/** Distance from point p to segment a–b (feet). */
function pointToSegmentDistFt(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.01) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Convex quad vs convex quad separation test (SAT) with a required gap:
 * returns true when the quads are closer than `gapFt` on EVERY candidate
 * axis (i.e. they overlap or nearly touch). Axes are the edge normals of
 * both quads — sufficient for convex polygons.
 */
function quadsOverlapWithGap(
  a: Array<[number, number]>,
  b: Array<[number, number]>,
  gapFt: number,
): boolean {
  const quads = [a, b];
  for (const quad of quads) {
    for (let i = 0; i < quad.length; i++) {
      const [x1, y1] = quad[i];
      const [x2, y2] = quad[(i + 1) % quad.length];
      // Edge normal (unnormalized direction is fine if we normalize once)
      let nx = -(y2 - y1);
      let ny = x2 - x1;
      const len = Math.hypot(nx, ny);
      if (len < 1e-9) continue;
      nx /= len;
      ny /= len;
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const [px, py] of a) {
        const proj = px * nx + py * ny;
        if (proj < minA) minA = proj;
        if (proj > maxA) maxA = proj;
      }
      for (const [px, py] of b) {
        const proj = px * nx + py * ny;
        if (proj < minB) minB = proj;
        if (proj > maxB) maxB = proj;
      }
      // Separated by at least the gap on this axis → no conflict
      if (minB - maxA >= gapFt || minA - maxB >= gapFt) return false;
    }
  }
  return true;
}

function dist(a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function clampToEnvelope(pt: [Feet, Feet], env: BoundsFt): [Feet, Feet] {
  const margin = 5; // feet from edge
  return [
    Math.max(env.x + margin, Math.min(env.x + env.width - margin, pt[0])),
    Math.max(env.y + margin, Math.min(env.y + env.height - margin, pt[1])),
  ];
}

function minDistToEnvelopeEdge(pt: [Feet, Feet], env: BoundsFt): number {
  return Math.min(
    pt[0] - env.x,
    env.x + env.width - pt[0],
    pt[1] - env.y,
    env.y + env.height - pt[1],
  );
}

function pointInEnvelope(pt: [Feet, Feet], env: BoundsFt, margin: number): boolean {
  return (
    pt[0] >= env.x + margin &&
    pt[0] <= env.x + env.width - margin &&
    pt[1] >= env.y + margin &&
    pt[1] <= env.y + env.height - margin
  );
}

/** Check if a 4-point polygon is convex (all cross products same sign). */
function isConvexQuad(pts: Array<[number, number]>): boolean {
  if (pts.length !== 4) return false;
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    const c = pts[(i + 2) % 4];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) < 0.001) continue; // collinear edge, skip
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

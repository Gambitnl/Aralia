/**
 * @file townDiagnostics.ts — invariant checker for generated `TownPlan`s.
 *
 * Surfaces the town-generator failure modes (building/civic overlaps, buildings
 * outside the walls or footprint, empty/degenerate output) both as counts AND as
 * the offending geometry, so a design-preview overlay can draw exactly what is
 * wrong. Pure + deterministic; mirrors `.agent/scratch/town-audit.ts` but lives in
 * the tree so it ships with the Towns diagnostics preview.
 */
import { pointInPolygon, polygonBounds, type Pt } from '../submap/submapEngine';
import type { TownPlan, CivicStructure } from './townEngine';

export interface TownDiagnostics {
  buildingCount: number;
  /** Building polygons whose centroid lies outside the footprint. */
  outsideFootprint: Pt[][];
  /** Building polygons outside the wall ring (only when the town is walled). */
  outsideWalls: Pt[][];
  /** Buildings overlapping another building (each offending polygon, deduped). */
  buildingOverlaps: Pt[][];
  /** Buildings sitting under a solid civic structure. */
  civicOnBuilding: Pt[][];
  /** Solid civic structures overlapping another solid civic structure. */
  civicOverlaps: Pt[][];
  /** True when no invariant is violated. */
  clean: boolean;
  /** Flat count per category (for the readout). */
  counts: {
    buildings: number; outsideFootprint: number; outsideWalls: number;
    buildingOverlaps: number; civicOnBuilding: number; civicOverlaps: number;
  };
}

type Box = { minX: number; minY: number; maxX: number; maxY: number };

function centroid(poly: Pt[]): Pt {
  let x = 0, y = 0;
  for (const [px, py] of poly) { x += px; y += py; }
  return [x / poly.length, y / poly.length];
}

function polysOverlap(a: Pt[], b: Pt[]): boolean {
  for (const p of a) if (pointInPolygon(p, b)) return true;
  for (const p of b) if (pointInPolygon(p, a)) return true;
  return false;
}

function boxesDisjoint(a: Box, b: Box): boolean {
  return a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY;
}

const isSolid = (c: CivicStructure): boolean => c.kind !== 'plaza' && c.kind !== 'bridge';

/** Analyze a generated town for invariant violations (geometry + counts). */
export function analyzeTownPlan(plan: TownPlan): TownDiagnostics {
  const buildings: Pt[][] = plan.wards.flatMap((w) => w.plots.map((p) => p.polygon));
  const boxes = buildings.map(polygonBounds);
  const cents = buildings.map(centroid);

  const outsideFootprint: Pt[][] = [];
  const outsideWalls: Pt[][] = [];
  const walled = plan.walls.ring.length >= 3;
  for (let i = 0; i < buildings.length; i++) {
    if (!pointInPolygon(cents[i], plan.footprint)) outsideFootprint.push(buildings[i]);
    if (walled && !pointInPolygon(cents[i], plan.walls.ring)) outsideWalls.push(buildings[i]);
  }

  // Building-building overlap (bbox-gated; record each offending polygon once).
  const overlapping = new Set<number>();
  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      if (boxesDisjoint(boxes[i], boxes[j])) continue;
      if (pointInPolygon(cents[i], buildings[j]) || pointInPolygon(cents[j], buildings[i]) || polysOverlap(buildings[i], buildings[j])) {
        overlapping.add(i); overlapping.add(j);
      }
    }
  }
  const buildingOverlaps = [...overlapping].map((i) => buildings[i]);

  // Civic-on-building + civic-on-civic (solid structures only).
  const solid = plan.civic.filter(isSolid);
  const solidBoxes = solid.map((c) => polygonBounds(c.polygon));
  const civicOnBuilding: Pt[][] = [];
  for (let i = 0; i < buildings.length; i++) {
    for (let s = 0; s < solid.length; s++) {
      if (boxesDisjoint(boxes[i], solidBoxes[s])) continue;
      if (polysOverlap(buildings[i], solid[s].polygon)) { civicOnBuilding.push(buildings[i]); break; }
    }
  }
  const civicOverlapSet = new Set<number>();
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      if (boxesDisjoint(solidBoxes[i], solidBoxes[j])) continue;
      if (polysOverlap(solid[i].polygon, solid[j].polygon)) { civicOverlapSet.add(i); civicOverlapSet.add(j); }
    }
  }
  const civicOverlaps = [...civicOverlapSet].map((i) => solid[i].polygon);

  const counts = {
    buildings: buildings.length,
    outsideFootprint: outsideFootprint.length,
    outsideWalls: outsideWalls.length,
    buildingOverlaps: buildingOverlaps.length,
    civicOnBuilding: civicOnBuilding.length,
    civicOverlaps: civicOverlaps.length,
  };
  const clean = counts.outsideFootprint === 0 && counts.outsideWalls === 0 &&
    counts.buildingOverlaps === 0 && counts.civicOnBuilding === 0 && counts.civicOverlaps === 0;

  return { buildingCount: buildings.length, outsideFootprint, outsideWalls, buildingOverlaps, civicOnBuilding, civicOverlaps, clean, counts };
}

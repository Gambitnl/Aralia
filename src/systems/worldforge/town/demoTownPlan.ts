/**
 * @file demoTownPlan.ts — a self-contained demo town for the standalone
 * agent-sim previews (`?phase=agentsim`, `?phase=agentsim3d`, the dev overlay).
 *
 * These previews run WITHOUT a game session or FMG atlas, so they cannot use
 * `canonicalTown.getCanonicalTownPlan` (which keys off a real burg in the bridge
 * atlas). Instead they synthesize a plausible burg footprint from the seed and
 * run the owned Voronoi-ward generator (`townEngine`) directly — the same recipe
 * the in-app towns use, just sourced from a synthetic cell. This replaces the
 * retired rectangular `generateTownPlan.ts` skeleton the previews used to call.
 */
import { generateTownPlan as generateVoronoiTown, polygonCentroid } from './townEngine';
import { voronoiTownToArtifactPlan } from './voronoiTownAdapter';
import { generateSubmap, polygonBounds, type Pt } from '../submap/submapEngine';
import { rootSeedPath } from '../seedPath';
import type { TownPlan as ArtifactTownPlan } from '../artifacts';

/** Burg id used by the demo previews (no atlas burg backs it). */
export const DEMO_BURG_ID = 9001;

export interface DemoTown {
  /** Artifact town plan (streets + plots) consumed by roster/motion/3D previews. */
  plan: ArtifactTownPlan;
  /** The Voronoi cell the town fills (feet), for framing the 3D preview. */
  footprint: Pt[];
  /** Axis-aligned bounds of the footprint (feet). */
  bounds: { x: number; y: number; width: number; height: number };
}

/**
 * A real Voronoi cell to host the ward town: tessellate a square region, then
 * take the cell nearest its centre as the burg footprint (mirrors a world-map
 * burg cell). Deterministic per seed.
 */
function buildDemoCellFootprint(worldSeed: number): Pt[] {
  const span = 3600;
  const square: Pt[] = [[0, 0], [span, 0], [span, span], [0, span]];
  const region = generateSubmap({ polygon: square, seedPath: rootSeedPath(worldSeed) }, { count: 14 });
  const centre: Pt = [span / 2, span / 2];
  let best = region.cells[0]?.polygon ?? square;
  let bestD = Infinity;
  for (const c of region.cells) {
    const ctr = polygonCentroid(c.polygon);
    const d = Math.hypot(ctr[0] - centre[0], ctr[1] - centre[1]);
    if (d < bestD) { bestD = d; best = c.polygon; }
  }
  return best;
}

/** Build the demo Voronoi-ward town (adapted to the roster/motion artifact plan). */
export function buildDemoTownPlan(
  worldSeed: number,
  opts: { burgId?: number; population?: number } = {},
): DemoTown {
  const burgId = opts.burgId ?? DEMO_BURG_ID;
  const population = opts.population ?? 700;
  const footprint = buildDemoCellFootprint(worldSeed);
  const town = generateVoronoiTown(footprint, rootSeedPath(worldSeed), { population });
  const plan = voronoiTownToArtifactPlan(town, burgId);
  const b = polygonBounds(footprint);
  return {
    plan,
    footprint,
    bounds: { x: b.minX, y: b.minY, width: b.maxX - b.minX, height: b.maxY - b.minY },
  };
}

/**
 * @file voronoiTownAdapter.ts — Voronoi-ward town → roster/motion plan.
 *
 * `townEngine.generateTownPlan` produces the owned Voronoi-ward town (wards with
 * packed building plots, civic structures, walls, outskirts). The roster + agent
 * motion pipeline (`generateTownRoster`, `buildStreetGraph`, `townMotionSnapshotAt`)
 * speak the flatter `artifacts.TownPlan` (a flat `plots[]` with roles + street
 * centerlines). This adapter bridges them so the behaviour sim can run on a real
 * ward town instead of the radial demo burg:
 *
 *  • Ward building plots → `house` plots, with ~1 in 6 promoted to a `workshop`
 *    (a job) so the roster has somewhere to send workers.
 *  • Civic structures → roles the roster understands: plaza → `market` (shops +
 *    a gathering place), dock → `workshop`, temple/keep/citadel → civic buildings.
 *  • Streets: a ward town's walkable network IS the gaps between blocks, i.e. the
 *    ward (Voronoi) edges — so every ward polygon edge becomes a street centerline
 *    (deduped; shared edges merge into intersections in `buildStreetGraph`). Any
 *    inherited road continuations are appended.
 *
 * Pure + deterministic: geometry in → plan out, no RNG.
 */
import type { TownPlan as ArtifactTownPlan } from '../artifacts';
import type { TownPlan as VoronoiTownPlan, CivicKind } from './townEngine';
import type { Pt } from '../submap/submapEngine';
import { styledWallColor, styledRoof, styleFrameOf, type StyleFamily } from './architectureStyle';

/** Civic kind → a role the roster/motion layer understands (omitted = skip). */
const CIVIC_ROLE: Partial<Record<CivicKind, string>> = {
  plaza: 'market',
  dock: 'workshop',
  temple: 'temple',
  keep: 'keep',
  citadel: 'keep',
  // bridge: intentionally omitted — it's a crossing, not a building.
};
const CIVIC_STOREYS: Partial<Record<CivicKind, number>> = { keep: 3, citadel: 4, temple: 2 };

/** One in WORKSHOP_EVERY building plots becomes a workshop (a job site). */
const WORKSHOP_EVERY = 6;

const edgeKey = (a: Pt, b: Pt): string => {
  const ka = `${Math.round(a[0])},${Math.round(a[1])}`;
  const kb = `${Math.round(b[0])},${Math.round(b[1])}`;
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};

/**
 * Max spacing (feet) between street nodes. Ward edges are subdivided to roughly
 * this, so an agent snaps onto the road near its door (the foot of the
 * perpendicular) instead of jumping to a far ward CORNER and cutting across the
 * block — which read as agents "trespassing" through buildings.
 */
const STREET_NODE_SPACING_FT = 22;

/** Points along a→b, including both ends, spaced ≤ STREET_NODE_SPACING_FT. */
function subdivide(a: Pt, b: Pt): Pt[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const steps = Math.max(1, Math.ceil(len / STREET_NODE_SPACING_FT));
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return pts;
}

/** Unique ward (Voronoi) edges, densified into many nodes — the street network. */
function wardEdgeStreets(wards: VoronoiTownPlan['wards']): Pt[][] {
  const seen = new Set<string>();
  const edges: Pt[][] = [];
  for (const ward of wards) {
    const poly = ward.polygon;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const k = edgeKey(a, b);
      if (seen.has(k)) continue;
      seen.add(k);
      edges.push(subdivide([a[0], a[1]], [b[0], b[1]]));
    }
  }
  return edges;
}

/**
 * Convert a Voronoi-ward town into the flat artifact plan the roster + motion
 * pipeline consume. Plot ids are assigned in a stable ward→civic order.
 *
 * When `family` is given, each plot is stamped with deterministic architecture
 * style fields (wall/roof color, roof form) hashed frame-invariantly against
 * the town footprint bbox — styling never touches ids or footprints.
 */
export function voronoiTownToArtifactPlan(
  v: VoronoiTownPlan,
  burgId: number,
  family?: StyleFamily,
): ArtifactTownPlan {
  const plots: ArtifactTownPlan['plots'] = [];
  const frame = family ? styleFrameOf(v.footprint) : undefined;
  const stampFor = (poly: Pt[]) => {
    if (!family || !frame) return {};
    const roof = styledRoof(family, poly, frame);
    return { wallColorHex: styledWallColor(family, poly, frame), roofColorHex: roof.color, roofForm: roof.form };
  };
  let id = 1;
  let buildingRun = 0;

  for (const ward of v.wards) {
    for (const p of ward.plots) {
      buildingRun++;
      const role = buildingRun % WORKSHOP_EVERY === 0 ? 'workshop' : 'house';
      plots.push({ id: id++, footprint: p.polygon.map(([x, y]) => [x, y] as [number, number]), role, storeys: 1, ...stampFor(p.polygon) });
    }
  }

  for (const c of v.civic) {
    const role = CIVIC_ROLE[c.kind];
    if (!role) continue;
    plots.push({ id: id++, footprint: c.polygon.map(([x, y]) => [x, y] as [number, number]), role, storeys: CIVIC_STOREYS[c.kind] ?? 1, ...stampFor(c.polygon) });
  }

  const streets = [...wardEdgeStreets(v.wards), ...v.streets].map((centerline, i) => ({
    id: i,
    centerline: centerline.map(([x, y]) => [x, y] as [number, number]),
    widthFt: 20,
  }));

  return { burgId, streets, plots };
}

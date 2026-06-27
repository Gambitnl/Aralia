/**
 * @file townEngine.ts — SP-T clean-room Voronoi-ward town generator, iteration #1.
 *
 * The deepest tier of the recursive cartographic stack: a burg FOOTPRINT polygon
 * is subdivided into WARDS (Voronoi cells, reusing SP1's clip-to-parent +
 * re-tessellate machinery), and each ward's street frontage is packed with
 * PARTY-WALL building plots — rectangles tiled edge-to-edge along the ward
 * boundary (the street), set back inward. This satisfies SP-T acceptance
 * criteria #1 (blocks-first, no beads-on-a-string) and #2 (party-wall frontage)
 * for one slice; civic anatomy / terrain / typology-by-scale are later passes.
 *
 * CLEAN-ROOM: no Watabou data/algorithms are used or cloned (see DECISIONS).
 * Pure: no React/DOM. Determinism flows from the hierarchical seed-path.
 *
 * Spec: docs/projects/worldforge/SPEC.md §11 item 8 (town benchmark + criteria).
 * North star: docs/projects/worldforge/subprojects/sp-t-town-generator/NORTH_STAR.md
 */
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';
import { generateSubmap, polygonBounds, pointInPolygon, clipPolylineToPolygon, type Pt } from '../submap/submapEngine';
import { assignTownPopulation, assignWardWealth } from './population';

export interface BuildingPlot {
  /** Plot footprint polygon (graph coords, the town's frame). */
  polygon: Pt[];
  /** Index of the ward edge (frontage) this plot faces; -1 for interior infill. */
  frontageEdge: number;
  /** Where the plot sits: street frontage vs ward-interior infill (#6). */
  kind?: 'frontage' | 'interior';
  /** Footprint shape: simple rectangle or a stepped/L footprint (variety, #6). */
  shape?: 'rect' | 'L';
  /** Concrete building type (set by the population pass when a population is given). */
  buildingType?: import('./population').BuildingType;
  /** Whether this building is a home that carries population (cottage/townhouse/tenement). */
  residential?: boolean;
  /** Permanent residents living here (0 for non-residential workplaces/civic). */
  occupants?: number;
  /** Stable per-town building id (`b<index>`) — keys the lazy named household. */
  homeId?: string;
  /** Social class of the ward this plot sits in (set before classification). */
  district?: import('./population').WardWealth;
  /** For a HOME: the `homeId` of the workplace its breadwinners work at (undefined = unskilled labour). */
  workplaceId?: string;
  /** For a HOME: how its workers relate to their workplace. */
  workRole?: 'proprietor' | 'staff' | 'labourer';
  /** For a WORKPLACE: the `homeId` of the home whose family runs it. */
  proprietorHomeId?: string;
  /** For a WORKPLACE: number of employee homes assigned to it (excludes the proprietor). */
  staffCount?: number;
}

export type CivicKind = 'plaza' | 'temple' | 'keep' | 'citadel' | 'dock' | 'bridge';

export type TownTypology = 'hamlet' | 'village' | 'walled town' | 'city' | 'capital';

export interface TownScaleProfile {
  typology: TownTypology;
  population: number;
  /** Voronoi ward count — grows sublinearly with population, UNCAPPED. */
  wardCount: number;
  hasWalls: boolean;
  hasPlaza: boolean;
  hasTemple: boolean;
  hasKeep: boolean;
  /** Capital-only second stronghold. */
  hasCitadel: boolean;
}

export interface CivicStructure {
  kind: CivicKind;
  /** Footprint polygon of the civic space/building (graph coords). */
  polygon: Pt[];
  /** Index of the ward this civic structure occupies. */
  wardIndex: number;
}

export interface TownWalls {
  /** Defensive wall ring (inset from the footprint). */
  ring: Pt[];
  /** Gatehouse points on the ring where main roads enter. */
  gatehouses: Pt[];
}

export interface TownWard {
  /** Ward (Voronoi cell) polygon clipped to the town footprint. */
  polygon: Pt[];
  /** The buildable block: the ward inset by a street margin. Buildings pack on
   *  THIS, so the gap between neighbouring blocks reads as the street network. */
  block: Pt[];
  /** Party-wall building plots packed along this ward's street frontage. */
  plots: BuildingPlot[];
  /** Civic role of this ward, if any (plaza wards carry no plots). */
  civic?: CivicKind;
  /** Social class of this ward (wealthy near the keep/market, poor at the rim). */
  wealth?: import('./population').WardWealth;
}

/** Land use of the ring between the built town core and the cell boundary. */
export type OutskirtKind = 'farm' | 'pasture' | 'scrub';
export interface TownOutskirt {
  /** Parcel polygon (cell coords). */
  polygon: Pt[];
  /** farm (tilled fields near the core) → pasture (grassland) → scrub (barren edge). */
  kind: OutskirtKind;
}

export interface TownPlan {
  /** The burg footprint = the whole parent cell (a leaf submap cell). */
  footprint: Pt[];
  /**
   * The ORGANIC built-up boundary INSIDE the cell. The town lives here; it does
   * not adhere to the cell's exact shape. Wards/buildings/walls all sit within it.
   */
  core: Pt[];
  /** Voronoi wards subdividing the CORE (not the whole cell). */
  wards: TownWard[];
  /** Every building plot across all wards, flattened — the canonical building list
   *  (stable `homeId`s, population-tagged). Same object refs as `wards[].plots`. */
  plots: BuildingPlot[];
  /** Farmland/grassland/scrub parcels filling the ring between the core and cell edge. */
  outskirts: TownOutskirt[];
  /** Defensive wall ring + gatehouses (criterion #3). */
  walls: TownWalls;
  /** Civic anatomy: market plaza, temple(s), castle/keep (criterion #3). */
  civic: CivicStructure[];
  /** Main streets continued from inherited regional roads, clipped to town (#6). */
  streets: Pt[][];
  /** Rural homes seated on farm outskirts (carry the rural population). Empty if no population given. */
  farmsteads: import('./population').Farmstead[];
  /** Population accounting (who lives where) — present only when a population was given. */
  demographics?: import('./population').TownDemographics;
}

export interface GenerateTownOptions {
  /** Population — derives typology, ward count, and which civic structures appear. */
  population?: number;
  /** Target ward count (Voronoi cells). Overrides the population-derived count. */
  wardCount?: number;
  /** Building frontage width (world units) before jitter. */
  plotWidth?: number;
  /** Building depth set back from the street (world units). */
  plotDepth?: number;
  /** Gap between adjacent plots and at corners (world units). */
  gap?: number;
  /** Inherited rivers/coast as polylines (footprint coords) — drives docks + bridges (#4). */
  water?: Pt[][];
  /** Max water distance for a ward edge to count as waterfront (world units). */
  waterMargin?: number;
  /** Optional terrain height sampler (footprint coords) for slope-aware streets (#4). */
  heightAt?: (p: Pt) => number;
  /** Max street grade (Δheight / length); steeper ward edges seat no frontage. */
  maxGrade?: number;
  /** Inherited regional roads (footprint coords) → continued main streets (#6). */
  roads?: Pt[][];
  /** Building-footprint variety: depth jitter + stepped/L shapes. Default true (#6). */
  variety?: boolean;
  /** Pack freestanding buildings into ward interiors (courtyards). Default true (#6). */
  interiorInfill?: boolean;
}

/** Area-weighted polygon centroid (falls back to vertex mean for degenerate polys). */
export function polygonCentroid(poly: Pt[]): Pt {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const cross = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    a += cross;
    cx += (poly[j][0] + poly[i][0]) * cross;
    cy += (poly[j][1] + poly[i][1]) * cross;
  }
  a /= 2;
  if (Math.abs(a) < 1e-9) {
    let x = 0, y = 0;
    for (const [px, py] of poly) { x += px; y += py; }
    return [x / poly.length, y / poly.length];
  }
  return [cx / (6 * a), cy / (6 * a)];
}

function len(a: Pt, b: Pt): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Unit normal of edge a→b that points toward `interior` (into the ward). */
function inwardNormal(a: Pt, b: Pt, interior: Pt): Pt {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  // Flip to point toward the interior point.
  return (interior[0] - mx) * nx + (interior[1] - my) * ny >= 0 ? [nx, ny] : [-nx, -ny];
}

/**
 * Pack a single ward's street frontage with party-wall building plots. Each ward
 * edge is treated as a street; rectangular plots are tiled flush along it
 * (sharing side walls = party walls) and set back inward by `plotDepth`. Corners
 * and tiny edges are skipped so plots don't overlap. Deterministic per seed-path.
 */
export function packWardFrontage(
  ward: Pt[],
  seedPath: SeedPath,
  opts: GenerateTownOptions = {},
): BuildingPlot[] {
  const plotWidth = opts.plotWidth ?? 6;
  const plotDepth = opts.plotDepth ?? 7;
  const gap = opts.gap ?? 1.2;
  const variety = opts.variety !== false;
  const interior = polygonCentroid(ward);
  const rng = rngFromPath(streamPath(seedPath, 'frontage'));
  const plots: BuildingPlot[] = [];

  for (let e = 0; e < ward.length; e++) {
    const a = ward[e];
    const b = ward[(e + 1) % ward.length];
    const L = len(a, b);
    const corner = gap + plotDepth * 0.5; // keep clear of corners (depth-aware)
    if (L <= 2 * corner + plotWidth) continue; // edge too short for even one plot
    if (opts.heightAt && opts.maxGrade != null) {
      // Slope-aware (#4): skip frontage on streets too steep to build along.
      const grade = Math.abs(opts.heightAt(b) - opts.heightAt(a)) / (L || 1);
      if (grade > opts.maxGrade) continue;
    }
    const n = inwardNormal(a, b, interior);
    const ux = (b[0] - a[0]) / L;
    const uy = (b[1] - a[1]) / L;
    // Clamp depth so plots can't punch past the ward centroid on thin wards.
    const maxDepth = Math.max(2, len(a, interior) * 0.6);
    const baseDepth = Math.min(plotDepth, maxDepth);

    let t = corner;
    while (t + plotWidth <= L - corner) {
      const w = plotWidth * (0.8 + rng.next() * 0.4);
      if (t + w > L - corner) break;
      // Variety (#6): per-building depth jitter + occasional stepped/L footprint.
      const depth = variety ? baseDepth * (0.78 + rng.next() * 0.44) : baseDepth;
      const along = (s: number): Pt => [a[0] + ux * s, a[1] + uy * s];
      const inward = (p: Pt, d: number): Pt => [p[0] + n[0] * d, p[1] + n[1] * d];
      const p0 = along(t);
      const p1 = along(t + w);
      if (variety && rng.next() < 0.3) {
        // Stepped footprint: one half deeper than the other (an L/return).
        const d2 = depth * 0.55;
        const mid = along(t + w / 2);
        const polygon: Pt[] = rng.next() < 0.5
          ? [p0, p1, inward(p1, depth), inward(mid, depth), inward(mid, d2), inward(p0, d2)]
          : [p0, p1, inward(p1, d2), inward(mid, d2), inward(mid, depth), inward(p0, depth)];
        plots.push({ polygon, frontageEdge: e, kind: 'frontage', shape: 'L' });
      } else {
        plots.push({
          polygon: [p0, p1, inward(p1, depth), inward(p0, depth)],
          frontageEdge: e, kind: 'frontage', shape: 'rect',
        });
      }
      t += w + gap;
    }
  }
  return plots;
}

/**
 * Pack freestanding buildings into a ward's interior (courtyard block infill,
 * #6) — seeded points scattered inside an inset of the ward, away from the
 * frontage band, each a small square. Count scales with the interior area.
 */
export function packWardInterior(
  ward: Pt[],
  seedPath: SeedPath,
  opts: GenerateTownOptions = {},
): BuildingPlot[] {
  const plotWidth = opts.plotWidth ?? 6;
  const c = polygonCentroid(ward);
  const inner = scalePolygon(ward, c, 0.5); // courtyard core, clear of frontage
  const b = polygonBounds(inner);
  const size = plotWidth * 0.8;
  const area = (b.maxX - b.minX) * (b.maxY - b.minY);
  const target = Math.max(0, Math.floor(area / (size * size * 7)));
  if (target === 0) return [];
  const rng = rngFromPath(streamPath(seedPath, 'interior'));
  const out: BuildingPlot[] = [];
  let attempts = 0;
  while (out.length < target && attempts < target * 20 + 20) {
    attempts++;
    const x = b.minX + rng.next() * (b.maxX - b.minX);
    const y = b.minY + rng.next() * (b.maxY - b.minY);
    if (!pointInPolygon([x, y], inner)) continue;
    out.push({
      polygon: squareAt([x, y], size * (0.7 + rng.next() * 0.6)),
      frontageEdge: -1, kind: 'interior', shape: 'rect',
    });
  }
  return out;
}

/** Squared distance from point p to segment ab. */
function segDist2(p: Pt, a: Pt, b: Pt): number {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const wx = p[0] - a[0], wy = p[1] - a[1];
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return dist2(p, a);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return dist2(p, b);
  const t = c1 / c2;
  return dist2(p, [a[0] + t * vx, a[1] + t * vy]);
}

/** Squared distance from point p to the nearest segment of a polyline. */
function polylineDist2(p: Pt, line: Pt[]): number {
  let m = Infinity;
  for (let i = 0; i < line.length - 1; i++) m = Math.min(m, segDist2(p, line[i], line[i + 1]));
  return m;
}

/**
 * If a ward is waterfront, return the index of its edge nearest the water (where
 * a dock seats); otherwise null. "Waterfront" = an edge midpoint within `margin`
 * of any inherited water polyline. Criterion #4.
 */
export function wardWaterEdge(ward: Pt[], water: Pt[][], margin: number): number | null {
  if (water.length === 0) return null;
  let best = Infinity, edge = -1;
  for (let e = 0; e < ward.length; e++) {
    const a = ward[e];
    const b = ward[(e + 1) % ward.length];
    const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let d = Infinity;
    for (const line of water) d = Math.min(d, polylineDist2(mid, line));
    if (d < best) { best = d; edge = e; }
  }
  return best <= margin * margin ? edge : null;
}

/**
 * Find bridge points: where an inherited water polyline crosses from one ward
 * into another (a street/ward crossing), step-sampled for determinism. Criterion
 * #4. `step` is the sampling spacing in world units.
 */
export function findBridges(water: Pt[][], wardPolys: Pt[][], step: number): Pt[] {
  const bridges: Pt[] = [];
  const wardAt = (p: Pt): number => {
    for (let i = 0; i < wardPolys.length; i++) if (pointInPolygon(p, wardPolys[i])) return i;
    return -1;
  };
  for (const line of water) {
    let prevWard = -1;
    let prevPt: Pt | null = null;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      const L = len(a, b);
      const n = Math.max(1, Math.ceil(L / Math.max(step, 1e-6)));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const p: Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const w = wardAt(p);
        if (w >= 0 && prevWard >= 0 && w !== prevWard && prevPt) {
          bridges.push([(p[0] + prevPt[0]) / 2, (p[1] + prevPt[1]) / 2]);
        }
        prevWard = w;
        prevPt = p;
      }
    }
  }
  return bridges;
}

/** Scale a polygon toward `center` by factor `k` (k<1 shrinks, e.g. an inset). */
function scalePolygon(poly: Pt[], center: Pt, k: number): Pt[] {
  return poly.map(([x, y]) => [center[0] + (x - center[0]) * k, center[1] + (y - center[1]) * k] as Pt);
}

/** Axis-aligned square of side `size` centered at `c`. */
function squareAt(c: Pt, size: number): Pt[] {
  const h = size / 2;
  return [[c[0] - h, c[1] - h], [c[0] + h, c[1] - h], [c[0] + h, c[1] + h], [c[0] - h, c[1] + h]];
}

function dist2(a: Pt, b: Pt): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/**
 * Cheap polygon-overlap test: any vertex of one polygon inside the other. For the
 * small convex-ish shapes here (axis-aligned civic squares vs building rects/Ls)
 * checking both directions reliably catches containment and partial overlap — used
 * to clear building plots out from under civic structures.
 */
function polysOverlap(a: Pt[], b: Pt[]): boolean {
  for (const p of a) if (pointInPolygon(p, b)) return true;
  for (const p of b) if (pointInPolygon(p, a)) return true;
  return false;
}

/** True if segments p1p2 and p3p4 properly cross (orientation test). */
function segmentsCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const o = (a: Pt, b: Pt, c: Pt) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  const o1 = o(p1, p2, p3), o2 = o(p1, p2, p4), o3 = o(p3, p4, p1), o4 = o(p3, p4, p2);
  return o1 !== o2 && o3 !== o4;
}

/**
 * Robust polygon overlap for the building/civic shapes here (rotated rects and
 * L-footprints): vertex containment either way OR any edge crossing. Catches the
 * edge-only intersections that the vertex-only test misses (two rects clipping
 * corners without a vertex inside the other).
 */
function polygonsIntersect(a: Pt[], b: Pt[]): boolean {
  if (polysOverlap(a, b)) return true;
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i], a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      if (segmentsCross(a1, a2, b[j], b[(j + 1) % b.length])) return true;
    }
  }
  return false;
}

/**
 * Greedy collision resolution: keep plots in order, dropping any that intersect a
 * plot already kept. Frontage is added before interior infill, so street-facing
 * buildings win and colliding courtyard squares (or acute-corner frontage) drop.
 */
function resolveCollisions(plots: BuildingPlot[]): BuildingPlot[] {
  const kept: BuildingPlot[] = [];
  for (const p of plots) {
    let ok = true;
    for (let k = 0; k < kept.length; k++) {
      if (polygonsIntersect(p.polygon, kept[k].polygon)) { ok = false; break; }
    }
    if (ok) kept.push(p);
  }
  return kept;
}

/**
 * Build the defensive wall ring (footprint inset toward its centroid) and seat
 * gatehouses where main roads enter — the midpoints of the longest footprint
 * edges, projected onto the ring. Criterion #3 (walls + gatehouses).
 */
export function buildWalls(footprint: Pt[], gateCount = 3): TownWalls {
  const c = polygonCentroid(footprint);
  const ring = scalePolygon(footprint, c, 0.94);
  // Rank footprint edges by length; gates sit at the midpoints of the longest.
  const edges = footprint.map((a, i) => {
    const b = footprint[(i + 1) % footprint.length];
    return { i, L: len(a, b), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Pt };
  }).sort((p, q) => q.L - p.L);
  const gatehouses = edges.slice(0, Math.min(gateCount, edges.length)).map((e) => {
    // Project the edge midpoint onto the ring (same inset toward centroid).
    return [c[0] + (e.mid[0] - c[0]) * 0.94, c[1] + (e.mid[1] - c[1]) * 0.94] as Pt;
  });
  return { ring, gatehouses };
}

/** Which civic structures a town of a given scale should seat. */
export interface CivicRoleRequest {
  plaza?: boolean;
  temple?: boolean;
  keep?: boolean;
  citadel?: boolean;
}

/**
 * Assign civic roles to wards by position: the plaza is the most central ward,
 * the keep/citadel the most peripheral (defensible), the temple the next-most
 * central distinct ward. Only the requested roles are placed (scale-gated).
 * Returns a role per ward index. Criterion #3 + #5.
 */
export function assignCivicRoles(
  wardCentroids: Pt[],
  townCenter: Pt,
  req: CivicRoleRequest = { plaza: true, temple: true, keep: true },
): Map<number, CivicKind> {
  const roles = new Map<number, CivicKind>();
  if (wardCentroids.length === 0) return roles;
  const byCentrality = wardCentroids
    .map((p, i) => ({ i, d: dist2(p, townCenter) }))
    .sort((a, b) => a.d - b.d);
  const takeCentral = (): number | undefined => byCentrality.find((x) => !roles.has(x.i))?.i;
  const takePeripheral = (): number | undefined => {
    for (let k = byCentrality.length - 1; k >= 0; k--) if (!roles.has(byCentrality[k].i)) return byCentrality[k].i;
    return undefined;
  };
  if (req.plaza) { const i = takeCentral(); if (i != null) roles.set(i, 'plaza'); }
  if (req.keep) { const i = takePeripheral(); if (i != null) roles.set(i, 'keep'); }
  if (req.citadel) { const i = takePeripheral(); if (i != null) roles.set(i, 'citadel'); }
  if (req.temple) { const i = takeCentral(); if (i != null) roles.set(i, 'temple'); }
  return roles;
}

/** Population bands → settlement typology (uncapped: above the top band = capital). */
export function typologyForPopulation(pop: number): TownTypology {
  if (pop < 100) return 'hamlet';
  if (pop < 1000) return 'village';
  if (pop < 5000) return 'walled town';
  if (pop < 25000) return 'city';
  return 'capital';
}

/**
 * Derive the full scale profile from population: typology, ward count (sublinear,
 * UNCAPPED — no fixed size cap), and which civic structures appear. Criterion #5.
 */
export function scaleProfile(population: number): TownScaleProfile {
  const pop = Math.max(0, population);
  const typology = typologyForPopulation(pop);
  const wardCount = Math.max(3, Math.round(Math.pow(Math.max(pop, 1), 0.45) * 0.9));
  const walled = typology === 'walled town' || typology === 'city' || typology === 'capital';
  return {
    typology,
    population: pop,
    wardCount,
    hasWalls: walled,
    hasPlaza: typology !== 'hamlet',
    hasTemple: typology !== 'hamlet',
    hasKeep: walled,
    hasCitadel: typology === 'capital',
  };
}

/** Distance from `center` to the polygon boundary along angle `ang` (radians). */
function rayPolyRadius(center: Pt, ang: number, poly: Pt[]): number {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const det = ex * dy - dx * ey;
    if (Math.abs(det) < 1e-9) continue;
    const acx = a[0] - center[0], acy = a[1] - center[1];
    const t = (ex * acy - ey * acx) / det; // ray param (distance from center)
    const u = (dx * acy - dy * acx) / det; // edge param
    if (t >= 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.min(best, t);
  }
  return isFinite(best) ? best : 0;
}

/** Fraction of the cell radius the built-up core occupies, by settlement scale. */
function coreFracFor(profile: TownScaleProfile | null): number {
  if (!profile) return 0.7;
  switch (profile.typology) {
    case 'hamlet': return 0.42;
    case 'village': return 0.52;
    case 'walled town': return 0.64;
    case 'city': return 0.76;
    default: return 0.86; // capital
  }
}

/**
 * Build the ORGANIC built-up core inside the parent cell. Rather than adopting
 * the cell's exact polygon, the core is a smooth blob centred in the cell whose
 * radius is a fraction of the cell radius modulated by a few seeded harmonics —
 * so the town has its own shape and leaves an outskirts ring out to the cell edge.
 */
export function buildTownCore(
  footprint: Pt[],
  center: Pt,
  coreFrac: number,
  seedPath: SeedPath,
  segments = 28,
): Pt[] {
  const rng = rngFromPath(streamPath(seedPath, 'core'));
  const p1 = rng.next() * Math.PI * 2, p2 = rng.next() * Math.PI * 2, p3 = rng.next() * Math.PI * 2;
  const a1 = 0.1 + rng.next() * 0.14, a2 = 0.05 + rng.next() * 0.08, a3 = 0.03 + rng.next() * 0.05;
  const pts: Pt[] = [];
  for (let k = 0; k < segments; k++) {
    const ang = (k / segments) * Math.PI * 2;
    const cellR = rayPolyRadius(center, ang, footprint);
    if (cellR <= 0) continue;
    const noise = 1 + a1 * Math.sin(ang + p1) + a2 * Math.sin(2 * ang + p2) + a3 * Math.sin(3 * ang + p3);
    let r = cellR * coreFrac * noise;
    r = Math.min(r, cellR * 0.94); // keep a margin so the core stays inside the cell
    r = Math.max(r, cellR * 0.16);
    pts.push([center[0] + Math.cos(ang) * r, center[1] + Math.sin(ang) * r]);
  }
  return pts;
}

/**
 * Subdivide the ring between the core and the cell edge into land-use parcels:
 * farmland hugs the core, pasture beyond, scrub/barren at the rim. A coarse
 * Voronoi over the whole cell; cells whose centroid is inside the core are the
 * town and are dropped (the town renders on top). Distance from the core edge to
 * the cell edge classifies the rest.
 */
export function buildOutskirts(
  footprint: Pt[],
  core: Pt[],
  center: Pt,
  seedPath: SeedPath,
  count = 40,
): TownOutskirt[] {
  const model = generateSubmap({ polygon: footprint, seedPath: streamPath(seedPath, 'outskirts') }, { count });
  const out: TownOutskirt[] = [];
  for (const cell of model.cells) {
    if (cell.polygon.length < 3) continue;
    const c = polygonCentroid(cell.polygon);
    if (pointInPolygon(c, core)) continue; // inside the town
    const ang = Math.atan2(c[1] - center[1], c[0] - center[0]);
    const coreR = rayPolyRadius(center, ang, core);
    const cellR = rayPolyRadius(center, ang, footprint);
    const dist = Math.hypot(c[0] - center[0], c[1] - center[1]);
    const frac = cellR > coreR ? (dist - coreR) / (cellR - coreR) : 1;
    const kind: OutskirtKind = frac < 0.45 ? 'farm' : frac < 0.78 ? 'pasture' : 'scrub';
    out.push({ polygon: cell.polygon, kind });
  }
  return out;
}

/**
 * Max docks by settlement size (#4 quality). `wardWaterEdge` seats a dock on
 * EVERY waterfront ward, which over-densifies a river+coast town (a 5k port grew
 * 11 piers); a town has a few principal quays, not one per block. Scales with
 * trade weight (size). No profile (raw wardCount call) → a modest default.
 */
function dockCapForTypology(t: TownTypology | undefined): number {
  switch (t) {
    case 'hamlet':
    case 'village': return 1;
    case 'walled town': return 2;
    case 'city': return 4;
    case 'capital': return 6;
    default: return 3;
  }
}

/**
 * SP-T: parent cell → organic town CORE inside it → Voronoi wards (via the SP1
 * engine) → party-wall frontage plots + civic anatomy + walls; the ring between
 * the core and the cell edge becomes farmland/pasture/scrub outskirts. The town
 * lives inside the cell but does not adhere to its exact shape.
 */
export function generateTownPlan(
  footprint: Pt[],
  seedPath: SeedPath,
  opts: GenerateTownOptions = {},
): TownPlan {
  // Population (if given) drives the typology profile: ward count, walls, and
  // which civic structures appear (hamlet → capital + citadel). Criterion #5.
  const profile = opts.population != null ? scaleProfile(opts.population) : null;
  const wardCount = opts.wardCount ?? profile?.wardCount ?? 12;
  // Organic town core INSIDE the cell — the town doesn't adopt the cell's shape.
  // The built town (wards/walls/buildings) lives within this blob; the ring out
  // to the cell edge becomes outskirts (farm/pasture/scrub).
  const cellCenter = polygonCentroid(footprint);
  const core = buildTownCore(footprint, cellCenter, coreFracFor(profile), seedPath);
  // Walls: for a walled town the wall RING is the build envelope — wards (and
  // therefore every building) are carved INSIDE it. The core→ring band is the
  // extramural margin. Unwalled settlements build out to the core edge.
  const walls = !profile || profile.hasWalls ? buildWalls(core) : { ring: [], gatehouses: [] };
  const envelope = walls.ring.length >= 3 ? walls.ring : core;
  // Reuse SP1's clip-to-parent Voronoi tessellation to carve the envelope into
  // wards — the town is itself a submap, one tier deeper than the local map.
  const model = generateSubmap({ polygon: envelope, seedPath }, { count: wardCount });
  const wardPolys = model.cells.map((c) => c.polygon);
  const wardCentroids = wardPolys.map(polygonCentroid);
  const townCenter = polygonCentroid(envelope);
  const req: CivicRoleRequest = profile
    ? { plaza: profile.hasPlaza, temple: profile.hasTemple, keep: profile.hasKeep, citadel: profile.hasCitadel }
    : { plaza: true, temple: true, keep: true };
  const roles = assignCivicRoles(wardCentroids, townCenter, req);

  // Terrain/water inputs (#4): inherited rivers/coast → docks + bridges.
  const water = opts.water ?? [];
  const fpb = polygonBounds(footprint);
  const fpSpan = Math.max(fpb.maxX - fpb.minX, fpb.maxY - fpb.minY) || 1;
  const waterMargin = opts.waterMargin ?? fpSpan * 0.05;
  // Default plot dimensions SCALE TO THE FOOTPRINT when not given, so a town
  // fills regardless of the absolute coord scale it's generated at (e.g. a tiny
  // burg sub-cell from the live drill vs a large standalone footprint). Without
  // this, absolute defaults can exceed ward-edge lengths → zero buildings.
  //
  // Plots scale to the WARD, not the whole footprint: denser towns have more, and
  // therefore smaller, wards, so footprint-relative plots would be huge in a tiny
  // ward → few buildings that mostly collide. A characteristic ward span (the
  // footprint tiled into `wardCount` cells ≈ fpSpan/√wardCount) keeps buildings
  // proportional to their ward, so coverage stays consistent and total building
  // count scales UP with ward count (hamlet < … < capital).
  // Ward span is measured over the BUILD ENVELOPE (the core), since wards now
  // tessellate the core rather than the whole cell — keeps buildings proportioned.
  const eb = polygonBounds(envelope);
  const coreSpan = Math.max(eb.maxX - eb.minX, eb.maxY - eb.minY) || 1;
  const wardSpan = coreSpan / Math.sqrt(Math.max(1, wardCount));
  const packOpts: GenerateTownOptions = {
    ...opts,
    plotWidth: opts.plotWidth ?? Math.max(2, wardSpan * 0.16),
    plotDepth: opts.plotDepth ?? Math.max(2.5, wardSpan * 0.2),
    gap: opts.gap ?? Math.max(0.4, wardSpan * 0.035),
  };

  // Street margin: each ward shrinks to a buildable BLOCK inset toward its
  // centroid, so the gap left between neighbouring blocks is the street network
  // (Voronoi edges become streets). Without this, buildings on either side of a
  // shared ward edge sit back-to-back with no street between them. The inset is a
  // fraction of the ward span so street width scales with the town.
  const blockInset = (poly: Pt[], c: Pt): Pt[] => {
    const b = polygonBounds(poly);
    const span = Math.max(b.maxX - b.minX, b.maxY - b.minY) || 1;
    const streetHalf = Math.min(span * 0.5 - 1e-3, Math.max(wardSpan * 0.06, 1.2)); // clamp so the block stays valid
    const k = Math.max(0.55, 1 - (2 * streetHalf) / span);
    return scalePolygon(poly, c, k);
  };

  const civicSize: Record<CivicKind, number> = { plaza: 0, temple: 0.3, keep: 0.4, citadel: 0.5, dock: 0.22, bridge: 0 };
  const civic: CivicStructure[] = [];
  const wards: TownWard[] = wardPolys.map((polygon, i) => {
    const block = blockInset(polygon, wardCentroids[i]);
    const role = roles.get(i);
    if (role === 'plaza') {
      // Open market square: clear frontage, reserve the block interior as plaza.
      const plaza = scalePolygon(block, wardCentroids[i], 0.78);
      civic.push({ kind: 'plaza', polygon: plaza, wardIndex: i });
      return { polygon, block, plots: [], civic: 'plaza' };
    }
    const wardSeed = streamPath(seedPath, `ward:${i}`);
    const plots = packWardFrontage(block, wardSeed, packOpts);
    // Interior block infill (#6): freestanding buildings in the courtyard core.
    if (opts.interiorInfill !== false) plots.push(...packWardInterior(block, wardSeed, packOpts));
    // Drop buildings that overlap each other (acute-corner frontage collisions +
    // interior squares landing on frontage); frontage is kept over infill.
    const resolved = resolveCollisions(plots);
    plots.length = 0;
    plots.push(...resolved);
    // Waterfront ward → seat a dock on the water-facing edge (#4).
    const waterEdge = wardWaterEdge(polygon, water, waterMargin);
    if (waterEdge != null) {
      const a = polygon[waterEdge];
      const b = polygon[(waterEdge + 1) % polygon.length];
      const wb = polygonBounds(polygon);
      const span = Math.min(wb.maxX - wb.minX, wb.maxY - wb.minY);
      // Dock sits at the water edge midpoint, nudged toward the ward interior.
      const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const toIn: Pt = [wardCentroids[i][0] - mid[0], wardCentroids[i][1] - mid[1]];
      const tl = Math.hypot(toIn[0], toIn[1]) || 1;
      const dockC: Pt = [mid[0] + (toIn[0] / tl) * span * 0.12, mid[1] + (toIn[1] / tl) * span * 0.12];
      civic.push({ kind: 'dock', polygon: squareAt(dockC, span * civicSize.dock), wardIndex: i });
    }
    if (role === 'temple' || role === 'keep' || role === 'citadel') {
      const b = polygonBounds(block);
      const span = Math.min(b.maxX - b.minX, b.maxY - b.minY);
      civic.push({ kind: role, polygon: squareAt(wardCentroids[i], span * civicSize[role]), wardIndex: i });
      return { polygon, block, plots, civic: role };
    }
    return { polygon, block, plots, civic: waterEdge != null ? 'dock' : undefined };
  });

  // Cap docks to the principal quays: keep the K nearest actual water (the truest
  // waterfront), K by typology. The other waterfront wards keep their frontage as
  // ordinary buildings. Ward 'dock' flags are reconciled with the survivors after
  // the de-overlap pass below (which may drop a few more docks).
  const dockCap = dockCapForTypology(profile?.typology);
  const dockCivics = civic.filter((c) => c.kind === 'dock');
  if (dockCivics.length > dockCap) {
    const keep = new Set(
      dockCivics
        .map((c) => {
          const ctr = polygonCentroid(c.polygon);
          let d = Infinity;
          for (const line of water) d = Math.min(d, polylineDist2(ctr, line));
          return { c, d };
        })
        .sort((a, b) => a.d - b.d)
        .slice(0, dockCap)
        .map((s) => s.c),
    );
    for (let idx = civic.length - 1; idx >= 0; idx--) {
      if (civic[idx].kind === 'dock' && !keep.has(civic[idx])) civic.splice(idx, 1);
    }
  }

  // Bridges where a river crosses between wards (#4).
  for (const bp of findBridges(water, wardPolys, fpSpan / 140)) {
    civic.push({ kind: 'bridge', polygon: squareAt(bp, fpSpan * 0.02), wardIndex: -1 });
  }

  // De-overlap solid civic structures: a waterfront keep/temple ward can seat
  // both a dock and its civic building, and adjacent waterfront wards can seat
  // docks that collide. Keep them by priority (citadel > keep > temple > dock),
  // dropping any that intersect an already-kept one. Plazas/bridges are exempt.
  const civicPriority: Record<CivicKind, number> = { citadel: 0, keep: 1, temple: 2, dock: 3, plaza: 9, bridge: 9 };
  const passthrough = civic.filter((c) => c.kind === 'plaza' || c.kind === 'bridge');
  const solidSorted = civic
    .filter((c) => c.kind !== 'plaza' && c.kind !== 'bridge')
    .sort((a, b) => civicPriority[a.kind] - civicPriority[b.kind]);
  const solidCivic: CivicStructure[] = [];
  for (const c of solidSorted) {
    if (!solidCivic.some((o) => polygonsIntersect(c.polygon, o.polygon))) solidCivic.push(c);
  }
  // Rebuild the civic list (kept solids + plazas/bridges).
  civic.length = 0;
  civic.push(...passthrough, ...solidCivic);

  // Reconcile ward 'dock' flags with the surviving dock civics — the dock cap and
  // the de-overlap pass both drop docks, so a ward must not claim a pier it lost.
  const dockWardIdx = new Set(civic.filter((c) => c.kind === 'dock').map((c) => c.wardIndex));
  for (let i = 0; i < wards.length; i++) {
    if (wards[i].civic === 'dock' && !dockWardIdx.has(i)) wards[i].civic = undefined;
  }

  // Clear building plots out from under the kept solid civic structures — including
  // any that spill across a ward boundary. Fixes civic-on-house overlap.
  if (solidCivic.length > 0) {
    for (const w of wards) {
      if (w.plots.length > 0) {
        w.plots = w.plots.filter((p) => !solidCivic.some((c) => polygonsIntersect(p.polygon, c.polygon)));
      }
    }
  }

  // Cross-ward de-overlap: per-ward packing can't see neighbours, so frontage from
  // adjacent wards can clip at shared corners. One bbox-gated pass drops the later
  // of any colliding pair from DIFFERENT wards (intra-ward was already resolved).
  const items = wards.flatMap((w, wi) => w.plots.map((plot) => ({ wi, plot, bb: polygonBounds(plot.polygon) })));
  const dropped = new Set<BuildingPlot>();
  for (let i = 0; i < items.length; i++) {
    if (dropped.has(items[i].plot)) continue;
    const A = items[i].bb;
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].wi === items[j].wi || dropped.has(items[j].plot)) continue;
      const B = items[j].bb;
      if (A.maxX < B.minX || B.maxX < A.minX || A.maxY < B.minY || B.maxY < A.minY) continue; // bbox reject
      if (polygonsIntersect(items[i].plot.polygon, items[j].plot.polygon)) dropped.add(items[j].plot);
    }
  }
  if (dropped.size > 0) {
    for (const w of wards) w.plots = w.plots.filter((p) => !dropped.has(p));
  }

  // Road continuation (#6): inherited regional roads clipped to the town become
  // its main streets (entering at the gatehouses).
  const streets = (opts.roads ?? []).flatMap((r) => clipPolylineToPolygon(r, footprint));

  // Outskirts: the ring between the built core and the cell edge → farm/pasture/scrub.
  const outskirtCount = Math.max(18, Math.min(80, Math.round(wardCount * 1.1)));
  const outskirts = buildOutskirts(footprint, core, cellCenter, seedPath, outskirtCount);

  // Population accounting (who lives where): classify every building, distribute the
  // population across homes (occupancy rising with density) + rural farmsteads, and
  // emit demographics. Only when a population was supplied. Mutates plot occupancy.
  // Social districts: rank wards by closeness to the prestige anchors (keep/citadel/
  // temple/market), then tag every plot with its ward's class so the population pass
  // can class-shade building types (wealthy quarter vs poor rim).
  const prestige = civic.filter((c) => c.kind === 'keep' || c.kind === 'citadel' || c.kind === 'temple' || c.kind === 'plaza');
  const anchors = prestige.map((c) => polygonCentroid(c.polygon));
  const wealth = assignWardWealth(wardCentroids, anchors, coreSpan, seedPath);
  wards.forEach((w, i) => {
    w.wealth = wealth[i];
    for (const p of w.plots) p.district = wealth[i];
  });

  const allPlots = wards.flatMap((w) => w.plots);
  let farmsteads: import('./population').Farmstead[] = [];
  let demographics: import('./population').TownDemographics | undefined;
  if (profile) {
    const farmParcels = outskirts.filter((o) => o.kind === 'farm');
    const pop = assignTownPopulation({
      plots: allPlots,
      farmParcels,
      population: profile.population,
      profile,
      townCenter,
      townSpan: coreSpan,
      seedPath,
    });
    farmsteads = pop.farmsteads;
    demographics = pop.demographics;
  }

  return { footprint, core, wards, plots: allPlots, outskirts, walls, civic, streets, farmsteads, demographics };
}

/** Convenience: total building plots across all wards. */
export function countPlots(plan: TownPlan): number {
  return plan.wards.reduce((n, w) => n + w.plots.length, 0);
}

export { polygonBounds };

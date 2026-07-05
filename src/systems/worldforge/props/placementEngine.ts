/**
 * @file placementEngine.ts — seeded, deterministic prop placement (DATA layer).
 *
 * Pure functions: a `PropPlacementContext` (a slim, GroundWorld-shaped view of
 * towns / building plots / roads / biome cells) + a seed path → `PropInstance[]`.
 * NO rendering, NO GroundWorld mutation — the module boundary is exported pure
 * functions. Wiring into GroundWorld / chunk rendering is the NEXT packet.
 *
 * Determinism contract (spec decision 9): same world + same context + same seed
 * path → byte-identical props, forever. All randomness flows from
 * `rngFromPath` / `streamPath` (frozen FNV-1a → Park-Miller). Every cluster
 * draws from a path that includes a stable anchor id, so adding an anchor never
 * perturbs another anchor's props.
 *
 * Placement rules (from the strawman + BG3 reference pack density cheat sheet):
 *  • Market plaza  → market stalls in a row (~1 per 4 m of plaza edge), each
 *    owning a small understock cluster of crates/barrels/sacks.
 *  • Docks / warehouse doors → crate + crate-stack + barrel clusters of 2–5,
 *    pooled at each loading point (BG3: 4–8 pooled per crane).
 *  • Smithy / house walls → firewood (woodpile) 1–2 piles.
 *  • Farmstead → fence runs on boundaries, haystacks, well, water trough.
 *  • Wilderness biome cells → cover-scatter with clustering, tuned SPARSE
 *    (2026-07-04 density fix): mostly clear ground, occasional readable bush
 *    clusters, fallen logs RARE (~1 per 10 bushes), boulders biome-weighted.
 *    Nothing scatters within a cleared margin of buildings, plazas, or roads —
 *    the fiction is that villagers keep their lanes and yards tidy.
 *  • Temple plots (`role: 'temple'`) → graveyard dressing: gravestone rows
 *    (seeded grid + jitter), a tomb or two, brazier pair at the door.
 *  • Poor-quarter plots (`role: 'poor'`) → rubbish heap + chicken coop clutter
 *    (on top of the existing woodpile rule).
 *  • Roads → sparse trailside markers: milestone at intervals, rare shrine /
 *    fingerpost. Deliberately SPARSE point props only.
 *
 * ── PLACEMENT GAPS (catalog entries with tags but NO rule yet) ───────────────
 * `PropPlacementContext` cannot yet express these strawman anchors; the defs
 * exist in catalog.ts with placement tags only:
 *  • 'tavern'          — buildings carry a role, not a business type; no way to
 *                        find a tavern plot.
 *  • 'wealthy-quarter' — no wealth/quarter signal on plots.
 *  • 'gate'            — context has no walls polylines / gatehouses array.
 *  • 'ruin'            — no hiddenSites in the context.
 *  • 'riverbank'       — no rivers polylines in the context.
 *  • 'defile'          — no slope/heightfield signal to detect a choke.
 *  • 'warehouse','cellar','mill','pasture','village','roadside' — tag-only
 *    aliases from the strawman rows; folded into existing anchors later.
 * Also: the GroundWorld bridge still imprints/renders from WAVE1_PROPS_BY_ID,
 * so expanded defs emitted here are data-only until the wiring packet switches
 * the bridge to PROPS_BY_ID (rendering of new forms is out of this slice).
 */
import type { SeedPath } from '../seedPath';
import { childSeedPath, rngFromPath, streamPath } from '../seedPath';
import type { SeededRandom } from '../../../utils/random/seededRandom';
import { CELL_METERS, type PropInstance } from './propSchema';

// ── Context (a slim, GroundWorld-shaped input) ──────────────────────────────

/** A town building plot — subset of GroundWorld.buildings the engine reads. */
export interface CtxBuilding {
  id: string;
  xM: number;
  zM: number;
  /** Town-plan role: 'market' | 'smithy' | 'house' | 'farm' | 'temple' | 'workshop' | … */
  role: string;
  /**
   * Economy business type at this plot when known (SLICE B — tavern context):
   * a 'tavern' business dresses its frontage with tavern props even though the
   * plot role is only 'market'/'workshop'. Absent = no business signal.
   */
  businessType?: string;
  /**
   * Wealth signal (SLICE B — wealthy-quarter context): true when the plot sits
   * in a high-status ward. Drives ornamental dressing (planters/statue/hedge).
   */
  wealthy?: boolean;
}

/** A polyline (road / wall) in ground meters — subset of GroundPolyline. */
export interface CtxPolyline {
  points: Array<{ x: number; z: number }>;
}

/** A dock / bridge deck slab — subset of GroundDeck. */
export interface CtxDeck {
  xM: number;
  zM: number;
  /** 'dock' | 'bridge' | … */
  kind: string;
}

/** A market/plaza anchor: center + rough radius in meters. */
export interface CtxPlaza {
  id: string;
  xM: number;
  zM: number;
  radiusM: number;
}

/** A hidden/discovery site (SP4) — a `ruin` kind seeds ruin dressing. */
export interface CtxHiddenSite {
  id: string;
  /** 'ruin' | 'cave' | 'shrine' | 'camp' | 'grove' | 'wreck' — only 'ruin' dresses. */
  kind: string;
  xM: number;
  zM: number;
}

/** A town gatehouse placement (road gate through the wall ring). */
export interface CtxGatehouse {
  xM: number;
  zM: number;
  angleRad: number;
}

/**
 * The placement input. Deliberately GroundWorld-SHAPED but decoupled: an adapter
 * (next packet) will project a real GroundWorld onto this. Any field may be
 * empty; the engine only emits props for anchors that are present.
 */
export interface PropPlacementContext {
  /** Ground extent, meters (used to sanity-bound scatter). */
  extentMetersX: number;
  extentMetersZ: number;
  /** Grid of biome ids for wilderness scatter (row-major, cols×rows). */
  cols: number;
  rows: number;
  biomeIds: string[];
  buildings: CtxBuilding[];
  roads: CtxPolyline[];
  decks: CtxDeck[];
  /** Explicit market plazas (open square between market plots). */
  plazas: CtxPlaza[];
  /**
   * Optional per-cell heights (0..100 encoded, row-major cols×rows) — the slope
   * signal for the `defile` context (a steep choke gets ambush cover). Absent =
   * no defile detection.
   */
  heights?: number[];
  /** Town defensive wall rings (closed polylines) — the `gate`/`walls` context. */
  walls?: CtxPolyline[];
  /** Road gatehouses (the ring's road openings) — anchors gate dressing. */
  gatehouses?: CtxGatehouse[];
  /** River centerlines crossing the window — the `riverbank` context. */
  rivers?: CtxPolyline[];
  /** Hidden/discovery sites — a 'ruin' kind seeds the `ruin` context. */
  hiddenSites?: CtxHiddenSite[];
}

// ── Renderable-def gate (no invisible referee-blockers) ─────────────────────

/**
 * The set of catalog defIds that `GroundProps.tsx` can draw. Placement NEVER
 * emits a defId outside this set, so no prop becomes an invisible combat
 * referee-blocker (Remy's no-silent-fallback rule). Every id here maps to a
 * deliberate render form in `GroundProps.tsx` (its own instanced/composed mesh,
 * or a reused rock/log/bush/box/cylinder variant chosen per family).
 *
 * Kept in sync with `RENDER_VARIANT` in `src/components/World3D/GroundProps.tsx`
 * — a catalog def with no render form must be added THERE before it may be
 * emitted here. `placeProps` guards on this set as a final safety net.
 */
export const RENDERABLE_DEF_IDS: ReadonlySet<string> = new Set<string>([
  // WAVE-1 backbone (bespoke meshes).
  'crate', 'barrel', 'sack', 'fence-run', 'woodpile', 'cart', 'market-stall',
  'well', 'boulder', 'fallen-log', 'bush', 'haystack', 'crate-stack', 'water-trough',
  // Expanded defs given a reused render form in GroundProps' RENDER_VARIANT.
  // Market / dock / smithy / tavern clutter → box / barrel / sack forms.
  'produce-basket', 'notice-board', 'fish-barrel', 'net-drying-rack', 'tool-rack',
  'metal-bar-stack', 'coal-heap', 'slop-bucket', 'overturned-barrel', 'tavern-sign',
  'trestle-table', 'wood-bench', 'chicken-coop', 'rubbish-heap', 'mooring-post',
  'coiled-rope', 'anvil', 'awning-pole', 'lantern-post', 'scarecrow', 'beehive',
  // Stone / masonry / grave forms → boulder (rock) variants.
  'gravestone', 'tomb', 'stone-cross', 'boundary-wall', 'milestone', 'wayside-shrine',
  'stone-planter', 'stone-bench', 'statue', 'cairn', 'standing-stone', 'rock-outcrop',
  'mossy-rock-cluster', 'broken-wall', 'rubble-pile', 'toppled-column', 'brazier',
  'fingerpost', 'dry-stone-wall', 'grindstone',
  // Log / trunk / beam forms → fallen-log variants.
  'tree-stump', 'driftwood-pile', 'log-bridge', 'roof-beam-charred', 'dead-snag',
  'jetty-post', 'plough',
  // Vegetation forms → bush variants.
  'bramble-patch', 'deadfall', 'fern-clump', 'gorse-shrub', 'hedge-run',
  'reed-bed', 'topiary', 'ivy-mass', 'mushroom-ring', 'gravel-bar',
]);

/**
 * Emit one instance, dropping any defId with no render form (belt-and-braces
 * against a pool listing a non-renderable id). Returns [] for a dropped def.
 */
function emit(inst: PropInstance): PropInstance[] {
  return RENDERABLE_DEF_IDS.has(inst.defId) ? [inst] : [];
}

// ── RNG helpers (all draws seed-derived) ────────────────────────────────────

/** Uniform in [min, max). */
function uniform(rng: SeededRandom, min: number, max: number): number {
  return min + rng.next() * (max - min);
}

/** Build a seed-derived variation block for one instance. */
function makeVariation(rng: SeededRandom): PropInstance['variation'] {
  return {
    scale: uniform(rng, 0.85, 1.15),
    variant: rng.nextInt(0, 4),
  };
}

/**
 * Scatter `count` instances of `defId` in a disc around (cx, cz). Each instance
 * jitters position/rotation/variation from the same rng, so the whole cluster is
 * reproducible. Clamped to the ground extent.
 */
function cluster(
  rng: SeededRandom,
  ctx: PropPlacementContext,
  defId: string,
  cx: number,
  cz: number,
  radiusM: number,
  count: number,
): PropInstance[] {
  const out: PropInstance[] = [];
  if (!RENDERABLE_DEF_IDS.has(defId)) return out; // never place an invisible prop
  for (let i = 0; i < count; i++) {
    const ang = uniform(rng, 0, Math.PI * 2);
    const rad = radiusM * Math.sqrt(rng.next()); // area-uniform
    const xM = clamp(cx + Math.cos(ang) * rad, 0, ctx.extentMetersX);
    const zM = clamp(cz + Math.sin(ang) * rad, 0, ctx.extentMetersZ);
    out.push({
      defId,
      xM,
      zM,
      rotationRad: uniform(rng, 0, Math.PI * 2),
      variation: makeVariation(rng),
    });
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ── Settlement clearance (villagers keep their lanes tidy) ──────────────────

/** No wilderness scatter within this margin of a building plot center. */
export const BUILDING_CLEAR_MARGIN_M = 10;
/** No wilderness scatter within this margin of a road centerline. */
export const ROAD_CLEAR_MARGIN_M = 6;
/** A market stall never sits within this distance of a building plot center. */
const STALL_BUILDING_CLEAR_M = CELL_METERS * 3;
/**
 * Wall clearance for plaza/wealthy ORNAMENT props (statue, planter, bench,
 * topiary…): ornaments read as courtyard dressing, not façade clutter, so they
 * keep a modest gap from building walls (eyeball fix 2026-07-04: statues sat
 * flush against wealthy-quarter house walls).
 */
export const ORNAMENT_WALL_CLEAR_M = 3;
/** Rough plot half-width (context only carries plot CENTERS, not footprints). */
const PLOT_HALF_WIDTH_EST_M = CELL_METERS * 3;
/** Ornaments never sit within this distance of ANY building plot center. */
export const ORNAMENT_BUILDING_CLEAR_M = PLOT_HALF_WIDTH_EST_M + ORNAMENT_WALL_CLEAR_M;

function nearAnyBuilding(ctx: PropPlacementContext, x: number, z: number, margin: number): boolean {
  const m2 = margin * margin;
  for (const b of ctx.buildings) {
    const dx = x - b.xM, dz = z - b.zM;
    if (dx * dx + dz * dz <= m2) return true;
  }
  return false;
}

/** Squared distance from point p to segment ab. */
function distSqToSegment(
  px: number, pz: number,
  ax: number, az: number,
  bx: number, bz: number,
): number {
  const abx = bx - ax, abz = bz - az;
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? ((px - ax) * abx + (pz - az) * abz) / len2 : 0;
  t = clamp(t, 0, 1);
  const dx = px - (ax + abx * t), dz = pz - (az + abz * t);
  return dx * dx + dz * dz;
}

function nearAnyRoad(ctx: PropPlacementContext, x: number, z: number, margin: number): boolean {
  const m2 = margin * margin;
  for (const road of ctx.roads) {
    const pts = road.points;
    for (let i = 1; i < pts.length; i++) {
      if (distSqToSegment(x, z, pts[i - 1].x, pts[i - 1].z, pts[i].x, pts[i].z) <= m2) return true;
    }
  }
  return false;
}

/**
 * True when (x, z) is inside villager-tended ground: within margin of a
 * building plot, a plaza, or a road. Wilderness scatter never lands here.
 */
function isTendedGround(ctx: PropPlacementContext, x: number, z: number): boolean {
  if (nearAnyBuilding(ctx, x, z, BUILDING_CLEAR_MARGIN_M)) return true;
  for (const p of ctx.plazas) {
    const r = p.radiusM + BUILDING_CLEAR_MARGIN_M;
    const dx = x - p.xM, dz = z - p.zM;
    if (dx * dx + dz * dz <= r * r) return true;
  }
  return nearAnyRoad(ctx, x, z, ROAD_CLEAR_MARGIN_M);
}

// ── Biome classification ────────────────────────────────────────────────────

/**
 * Weighted WAVE-1 cover composition per biome id. Kept intentionally loose
 * (substring match) so it survives the FMG biome-naming without a hard
 * dependency. Empty array = no wilderness scatter (ocean, ice, bare desert).
 *
 * Composition fiction (2026-07-04 density fix): forest floors are mostly
 * clear ground with occasional bushes; deadfall is the RARE accent (~1 log
 * per 10 bushes), boulders read where the ground is rocky (hills/highland),
 * rarely in meadow.
 */
function wildernessWeightsForBiome(biomeId: string): Array<[defId: string, weight: number]> {
  const b = biomeId.toLowerCase();
  if (b.includes('forest') || b.includes('wood') || b.includes('taiga') || b.includes('jungle')) {
    // Bush-dominant floor; deadfall/logs the RARE accent; stumps/ferns/brambles
    // add readable forest character (all from the full catalog, still sparse).
    return [
      ['bush', 0.7], ['fern-clump', 0.08], ['tree-stump', 0.06], ['boulder', 0.06],
      ['bramble-patch', 0.04], ['mossy-rock-cluster', 0.03], ['fallen-log', 0.02], ['deadfall', 0.01],
    ];
  }
  if (b.includes('grass') || b.includes('savanna') || b.includes('plain') || b.includes('meadow')) {
    return [['bush', 0.9], ['boulder', 0.06], ['fern-clump', 0.04]];
  }
  if (b.includes('hill') || b.includes('mountain') || b.includes('rock') || b.includes('highland')) {
    // Rocky ground: boulders dominate; crags/standing stones/cairns/gorse accent.
    return [
      ['boulder', 0.62], ['rock-outcrop', 0.14], ['standing-stone', 0.08],
      ['cairn', 0.06], ['gorse-shrub', 0.06], ['mossy-rock-cluster', 0.04],
    ];
  }
  if (b.includes('wetland') || b.includes('marsh') || b.includes('swamp') || b.includes('river')) {
    return [['bush', 0.7], ['reed-bed', 0.16], ['fallen-log', 0.08], ['driftwood-pile', 0.06]];
  }
  return []; // ocean / ice / desert-bare — nothing scatters
}

// ── Context prop pools (full-catalog composition) ───────────────────────────
// Each pool is a weighted vocabulary drawn from the FULL catalog. Only render-
// able defIds appear (see RENDERABLE_DEF_IDS). Expanding the POOL diversifies
// which def each instance is WITHOUT changing instance COUNTS — the density
// budget (seed-chance / cluster counts) is unchanged, so the full-catalog flip
// cannot re-explode density.

/** Market stall understock — crates/barrels/sacks dominant + readable variety. */
const MARKET_UNDERSTOCK: Array<[string, number]> = [
  ['crate', 0.34], ['barrel', 0.22], ['sack', 0.18],
  ['produce-basket', 0.14], ['fish-barrel', 0.06], ['trestle-table', 0.03],
  ['notice-board', 0.02], ['awning-pole', 0.01],
];

/** Dock loading-point clutter beyond the pooled crate/stack/barrel counts. */
const DOCK_DRESSING: Array<[string, number]> = [
  ['coiled-rope', 0.34], ['fish-barrel', 0.24], ['mooring-post', 0.18],
  ['net-drying-rack', 0.12], ['driftwood-pile', 0.08], ['jetty-post', 0.04],
];

/** Smithy-yard dressing beyond the woodpile/trough/barrel backbone. */
const SMITHY_DRESSING: Array<[string, number]> = [
  ['anvil', 0.3], ['tool-rack', 0.24], ['coal-heap', 0.2],
  ['metal-bar-stack', 0.16], ['grindstone', 0.1],
];

/** Tavern-frontage dressing (SLICE B — tavern context). */
const TAVERN_DRESSING: Array<[string, number]> = [
  ['barrel', 0.3], ['trestle-table', 0.22], ['overturned-barrel', 0.18],
  ['tavern-sign', 0.12], ['slop-bucket', 0.1], ['lantern-post', 0.08],
];

/** Wealthy-quarter ornamental dressing (SLICE B — wealthy-quarter context). */
const WEALTHY_DRESSING: Array<[string, number]> = [
  ['stone-planter', 0.28], ['topiary', 0.22], ['stone-bench', 0.18],
  ['hedge-run', 0.14], ['statue', 0.1], ['lantern-post', 0.08],
];

/** Gate/walls dressing (SLICE B — gate context). */
const GATE_DRESSING: Array<[string, number]> = [
  ['barrel', 0.3], ['crate', 0.24], ['brazier', 0.18],
  ['tool-rack', 0.14], ['cart', 0.08], ['water-trough', 0.06],
];

/** Ruin-site dressing (SLICE B — ruin context). */
const RUIN_DRESSING: Array<[string, number]> = [
  ['rubble-pile', 0.26], ['broken-wall', 0.2], ['toppled-column', 0.16],
  ['bramble-patch', 0.14], ['ivy-mass', 0.12], ['boulder', 0.08], ['roof-beam-charred', 0.04],
];

/** Riverbank dressing (SLICE B — riverbank context). */
const RIVERBANK_DRESSING: Array<[string, number]> = [
  ['reed-bed', 0.3], ['driftwood-pile', 0.22], ['gravel-bar', 0.16],
  ['bush', 0.14], ['fallen-log', 0.1], ['boulder', 0.08],
];

/** Defile (ambush choke) dressing (SLICE B — defile context). */
const DEFILE_DRESSING: Array<[string, number]> = [
  ['boulder', 0.34], ['rock-outcrop', 0.24], ['dead-snag', 0.16],
  ['fallen-log', 0.14], ['rubble-pile', 0.12],
];

/** Weighted pick; weights need not sum to 1 (normalized by total). */
function pickWeighted(rng: SeededRandom, entries: Array<[string, number]>): string {
  let total = 0;
  for (const [, w] of entries) total += w;
  let roll = rng.next() * total;
  for (const [id, w] of entries) {
    roll -= w;
    if (roll <= 0) return id;
  }
  return entries[entries.length - 1][0];
}

// ── Town placement ──────────────────────────────────────────────────────────

function placeMarket(basePath: SeedPath, ctx: PropPlacementContext): PropInstance[] {
  const out: PropInstance[] = [];
  for (const plaza of ctx.plazas) {
    const path = childSeedPath(streamPath(basePath, 'market'), `plaza:${plaza.id}`);
    const rng = rngFromPath(path);
    // BG3 cheat sheet: ~1 stall per ~4 m of plaza edge (perimeter = 2πr).
    const perimeter = 2 * Math.PI * plaza.radiusM;
    const stallCount = clamp(Math.round(perimeter / 4), 3, 10);
    for (let i = 0; i < stallCount; i++) {
      // Stalls ring the plaza edge, facing inward.
      const ang = (i / stallCount) * Math.PI * 2 + uniform(rng, -0.15, 0.15);
      const r = plaza.radiusM * uniform(rng, 0.75, 0.95);
      const xM = clamp(plaza.xM + Math.cos(ang) * r, 0, ctx.extentMetersX);
      const zM = clamp(plaza.zM + Math.sin(ang) * r, 0, ctx.extentMetersZ);
      // Stall-in-building fix: the plaza radius is derived FROM the market
      // plots, so ring positions can land on a plot footprint. Skip any stall
      // (and its understock) that would sit on top of a building.
      if (nearAnyBuilding(ctx, xM, zM, STALL_BUILDING_CLEAR_M)) continue;
      out.push({
        defId: 'market-stall',
        xM,
        zM,
        rotationRad: ang + Math.PI, // face plaza center
        variation: makeVariation(rng),
      });
      // Each stall owns 6–12 loose understock props (BG3 per-stall clutter).
      // Pool expanded from the market context: the same COUNT of instances, now
      // drawn from a weighted market vocabulary (crates/barrels/sacks dominate,
      // baskets/tables/awning-poles/notice-boards add readable variety). Budget
      // is unchanged — only which renderable def each instance is.
      const understock = rng.nextInt(6, 13);
      for (let j = 0; j < understock; j++) {
        out.push(
          ...cluster(rng, ctx, pickWeighted(rng, MARKET_UNDERSTOCK), xM, zM, CELL_METERS * 1.2, 1),
        );
      }
    }
  }
  return out;
}

function placeDocks(basePath: SeedPath, ctx: PropPlacementContext): PropInstance[] {
  const out: PropInstance[] = [];
  const stream = streamPath(basePath, 'docks');
  // Loading points: dock decks + warehouse/workshop plots.
  const loadingPoints: Array<{ id: string; xM: number; zM: number }> = [];
  ctx.decks.forEach((d, i) => {
    if (d.kind === 'dock') loadingPoints.push({ id: `deck:${i}`, xM: d.xM, zM: d.zM });
  });
  for (const b of ctx.buildings) {
    if (b.role === 'workshop' || b.role === 'warehouse') {
      loadingPoints.push({ id: `bldg:${b.id}`, xM: b.xM, zM: b.zM });
    }
  }
  for (const lp of loadingPoints) {
    const rng = rngFromPath(childSeedPath(stream, lp.id));
    // BG3: 4–8 crates/barrels pooled per loading point.
    const crates = rng.nextInt(2, 6); // 2–5
    const stacks = rng.nextInt(1, 3); // 1–2 pre-stacked
    const barrels = rng.nextInt(1, 4); // 1–3
    out.push(...cluster(rng, ctx, 'crate', lp.xM, lp.zM, CELL_METERS * 2, crates));
    out.push(...cluster(rng, ctx, 'crate-stack', lp.xM, lp.zM, CELL_METERS * 2, stacks));
    out.push(...cluster(rng, ctx, 'barrel', lp.xM, lp.zM, CELL_METERS * 2, barrels));
    // Dock character dressing (rope coils, fish barrels, mooring posts, nets) —
    // a few instances per loading point from the expanded dock vocabulary.
    const dressing = rng.nextInt(2, 5); // 2–4
    for (let j = 0; j < dressing; j++) {
      out.push(...cluster(rng, ctx, pickWeighted(rng, DOCK_DRESSING), lp.xM, lp.zM, CELL_METERS * 2.5, 1));
    }
  }
  return out;
}

function placeBuildingSideProps(basePath: SeedPath, ctx: PropPlacementContext): PropInstance[] {
  const out: PropInstance[] = [];
  const stream = streamPath(basePath, 'buildings');
  for (const b of ctx.buildings) {
    const rng = rngFromPath(childSeedPath(stream, `bldg:${b.id}`));
    const R = CELL_METERS * 1.5;
    if (b.role === 'smithy') {
      out.push(...cluster(rng, ctx, 'woodpile', b.xM, b.zM, R, rng.nextInt(1, 3)));
      out.push(...cluster(rng, ctx, 'water-trough', b.xM, b.zM, R, 1));
      out.push(...cluster(rng, ctx, 'barrel', b.xM, b.zM, R, rng.nextInt(1, 4)));
      // Working-yard dressing: anvil, tool rack, coal heap, bar stack, grindstone.
      const smithyDress = rng.nextInt(2, 5); // 2–4
      for (let j = 0; j < smithyDress; j++) {
        out.push(...cluster(rng, ctx, pickWeighted(rng, SMITHY_DRESSING), b.xM, b.zM, R, 1));
      }
    } else if (b.role === 'house' || b.role === 'poor') {
      out.push(...cluster(rng, ctx, 'woodpile', b.xM, b.zM, R, rng.nextInt(0, 2)));
      if (b.role === 'poor') {
        // Strawman §5: refuse in alley corners, coops tucked by doors.
        out.push(...cluster(rng, ctx, 'rubbish-heap', b.xM, b.zM, R, rng.nextInt(0, 2)));
        out.push(...cluster(rng, ctx, 'chicken-coop', b.xM, b.zM, R, rng.next() < 0.35 ? 1 : 0));
      }
    } else if (b.role === 'temple') {
      // Strawman §10 graveyard / temple yard: gravestone ROWS (grid + jitter),
      // a couple of prominent tombs, a brazier pair at the temple door.
      out.push(...placeGraveRows(rng, ctx, b));
      out.push(...cluster(rng, ctx, 'tomb', b.xM, b.zM, R * 2, rng.nextInt(1, 3)));
      out.push(...cluster(rng, ctx, 'brazier', b.xM, b.zM, R, 2));
    } else if (b.role === 'farm') {
      out.push(...cluster(rng, ctx, 'haystack', b.xM, b.zM, R * 1.5, rng.nextInt(1, 5)));
      out.push(...cluster(rng, ctx, 'well', b.xM, b.zM, R, rng.next() < 0.4 ? 1 : 0));
      out.push(...cluster(rng, ctx, 'water-trough', b.xM, b.zM, R, rng.nextInt(1, 3)));
      out.push(...cluster(rng, ctx, 'cart', b.xM, b.zM, R * 1.5, rng.nextInt(1, 3)));
      out.push(...cluster(rng, ctx, 'sack', b.xM, b.zM, R, rng.nextInt(3, 9)));
      out.push(...placeFenceRun(rng, ctx, b));
    }

    // ── SLICE B context signals riding on the plot ──────────────────────────
    // A TAVERN business dresses its frontage regardless of plot role (a tavern
    // is a 'market'/'workshop' plot in the plan; the business type is the only
    // signal that it's a pub). Deterministic per plot.
    if (b.businessType === 'tavern') {
      const tavernDress = rng.nextInt(3, 7); // 3–6
      for (let j = 0; j < tavernDress; j++) {
        out.push(...cluster(rng, ctx, pickWeighted(rng, TAVERN_DRESSING), b.xM, b.zM, R * 1.3, 1));
      }
    }
    // A WEALTHY plot gets ornamental dressing (planters, topiary, statue…).
    // Ornaments sit in OPEN yard space: an annulus outside the plot footprint
    // (wall clearance), rejected if the spot crowds a NEIGHBORING plot too.
    if (b.wealthy) {
      const wealthyDress = rng.nextInt(2, 5); // 2–4
      for (let j = 0; j < wealthyDress; j++) {
        out.push(...placeOrnament(rng, ctx, pickWeighted(rng, WEALTHY_DRESSING), b));
      }
    }
  }
  return out;
}

/**
 * Place ONE ornament prop in the open yard around plot `b`: an annulus just
 * outside the (estimated) footprint + wall clearance, retried a few times so
 * the spot also clears every NEIGHBORING plot. A crowded plot with no open
 * ground places nothing — never "fall back" into a wall.
 */
function placeOrnament(
  rng: SeededRandom,
  ctx: PropPlacementContext,
  defId: string,
  b: CtxBuilding,
): PropInstance[] {
  if (!RENDERABLE_DEF_IDS.has(defId)) return [];
  const rMin = ORNAMENT_BUILDING_CLEAR_M + 0.3; // strictly outside the clear disc
  const rMax = ORNAMENT_BUILDING_CLEAR_M + 3.5;
  for (let attempt = 0; attempt < 8; attempt++) {
    const ang = uniform(rng, 0, Math.PI * 2);
    const rad = uniform(rng, rMin, rMax);
    const xM = clamp(b.xM + Math.cos(ang) * rad, 0, ctx.extentMetersX);
    const zM = clamp(b.zM + Math.sin(ang) * rad, 0, ctx.extentMetersZ);
    // Clamping to the window edge can drag the point back inside the clear
    // disc — nearAnyBuilding re-checks the FINAL position against every plot.
    if (nearAnyBuilding(ctx, xM, zM, ORNAMENT_BUILDING_CLEAR_M)) continue;
    return [{
      defId,
      xM,
      zM,
      rotationRad: uniform(rng, 0, Math.PI * 2),
      variation: makeVariation(rng),
    }];
  }
  return [];
}

// ── SLICE B: gate / ruin / riverbank / defile placement ─────────────────────

/**
 * Gate/walls dressing — a guard post's worth of clutter at each road gatehouse
 * (barrels, crates, a brazier, a tool rack). Sparse: a handful per gate so the
 * ramparts read as manned without carpeting the approach.
 */
function placeGates(basePath: SeedPath, ctx: PropPlacementContext): PropInstance[] {
  const gates = ctx.gatehouses ?? [];
  if (gates.length === 0) return [];
  const out: PropInstance[] = [];
  const stream = streamPath(basePath, 'gate');
  gates.forEach((g, gi) => {
    const rng = rngFromPath(childSeedPath(stream, `gate:${gi}`));
    const count = rng.nextInt(3, 7); // 3–6
    for (let j = 0; j < count; j++) {
      // Offset to the inner side of the gate (perpendicular to the wall yaw).
      const along = uniform(rng, -CELL_METERS * 2, CELL_METERS * 2);
      const nrm = uniform(rng, CELL_METERS, CELL_METERS * 3);
      const cx = g.xM + Math.cos(g.angleRad) * along + Math.cos(g.angleRad + Math.PI / 2) * nrm;
      const cz = g.zM + Math.sin(g.angleRad) * along + Math.sin(g.angleRad + Math.PI / 2) * nrm;
      out.push(...cluster(rng, ctx, pickWeighted(rng, GATE_DRESSING), cx, cz, CELL_METERS, 1));
    }
  });
  return out;
}

/**
 * Ruin dressing — rubble, broken walls, toppled columns, bramble around each
 * 'ruin' hidden site. Only the 'ruin' hidden-place kind seeds this; caves /
 * shrines / camps are left to their own systems.
 */
function placeRuins(basePath: SeedPath, ctx: PropPlacementContext): PropInstance[] {
  const ruins = (ctx.hiddenSites ?? []).filter((h) => h.kind === 'ruin');
  if (ruins.length === 0) return [];
  const out: PropInstance[] = [];
  const stream = streamPath(basePath, 'ruin');
  for (const site of ruins) {
    const rng = rngFromPath(childSeedPath(stream, `ruin:${site.id}`));
    const count = rng.nextInt(6, 13); // 6–12 scattered ruin pieces
    for (let j = 0; j < count; j++) {
      out.push(...cluster(rng, ctx, pickWeighted(rng, RUIN_DRESSING), site.xM, site.zM, CELL_METERS * 4, 1));
    }
  }
  return out;
}

/**
 * Riverbank dressing — reeds, driftwood, gravel bars, shoreline scatter along
 * each river centerline. NOT prop-on-a-string (2026-07-04 eyeball fix: a
 * single prop per fixed interval read as a perfectly regular dotted straight
 * line marching across the terrain). A river reads as a soft PATCHY vegetated
 * band, so each interval sample now:
 *  • randomly SKIPS (~50%) — coverage is patchy, with real gaps;
 *  • jitters ALONG the bank ±40% of the interval, breaking the metronome;
 *  • spreads over a WIDE per-sample band off the bank (~1–4 cells), band not line;
 *  • places a CLUMP of 1–4 props, each drawn independently from the family
 *    pool (mixed reeds/driftwood/bush per clump, not one repeated shape).
 * Budget: (1−skip)·avg-clump ≈ 0.5 × 2.5 = 1.25 props per interval — same
 * ballpark as the old 1/interval; still governed by RIVERBANK_SPACING_M.
 */
const RIVERBANK_SPACING_M = 24;
/** Fraction of interval samples that place nothing (patchiness). */
export const RIVERBANK_SKIP_CHANCE = 0.5;
/** Max cells to walk outward from the channel hunting the dry shoreline.
 * Real FMG rivers carry a water band 50–150 m wide around the coarse
 * centerline, so the search must span that (~120 m) to find the true shore. */
const RIVERBANK_SHORE_SEARCH_CELLS = 80;

/** True when the biome cell under (x, z) is open water (ocean/lake/wetland-water). */
function isWetCell(ctx: PropPlacementContext, x: number, z: number): boolean {
  if (ctx.cols < 1 || ctx.rows < 1 || ctx.biomeIds.length === 0) return false;
  const cellW = ctx.extentMetersX / ctx.cols;
  const cellH = ctx.extentMetersZ / ctx.rows;
  const col = Math.max(0, Math.min(ctx.cols - 1, Math.floor(x / cellW)));
  const row = Math.max(0, Math.min(ctx.rows - 1, Math.floor(z / cellH)));
  const b = (ctx.biomeIds[row * ctx.cols + col] ?? '').toLowerCase();
  return b.includes('ocean') || b.includes('water') || b.includes('lake') || b.includes('marine');
}
function placeRiverbanks(basePath: SeedPath, ctx: PropPlacementContext): PropInstance[] {
  const rivers = ctx.rivers ?? [];
  if (rivers.length === 0) return [];
  const out: PropInstance[] = [];
  const stream = streamPath(basePath, 'riverbank');
  rivers.forEach((river, ri) => {
    const pts = river.points;
    if (pts.length < 2) return;
    const rng = rngFromPath(childSeedPath(stream, `river:${ri}`));
    let sinceLast = RIVERBANK_SPACING_M * uniform(rng, 0.2, 0.8);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], p = pts[i];
      const segLen = Math.hypot(p.x - a.x, p.z - a.z);
      if (segLen <= 0) continue;
      sinceLast += segLen;
      while (sinceLast >= RIVERBANK_SPACING_M) {
        sinceLast -= RIVERBANK_SPACING_M;
        if (rng.next() < RIVERBANK_SKIP_CHANCE) continue; // patchy gaps
        const t = clamp(1 - sinceLast / segLen, 0, 1);
        const dx = (p.x - a.x) / segLen, dz = (p.z - a.z) / segLen;
        const nx = -dz, nz = dx; // bank normal
        const alongJitter = uniform(rng, -RIVERBANK_SPACING_M * 0.4, RIVERBANK_SPACING_M * 0.4);
        const side = rng.next() < 0.5 ? 1 : -1;
        const bankOff = uniform(rng, CELL_METERS * 0.8, CELL_METERS * 4);
        const ax0 = a.x + (p.x - a.x) * t + dx * alongJitter;
        const az0 = a.z + (p.z - a.z) * t + dz * alongJitter;
        // Walk OUTWARD from the channel to the first dry biome cell: the FMG
        // water band around the centerline is often wider than the base bank
        // offset, and driftwood floating mid-water reads absurd. Step by cells
        // up to a shore-search cap; a sample with no dry ground nearby (open
        // sea / wide water) places nothing.
        let cx = Number.NaN, cz = Number.NaN;
        for (let step = 0; step <= RIVERBANK_SHORE_SEARCH_CELLS; step++) {
          const off = bankOff + step * CELL_METERS;
          const tx = ax0 + nx * side * off;
          const tz = az0 + nz * side * off;
          if (tx < 0 || tx > ctx.extentMetersX || tz < 0 || tz > ctx.extentMetersZ) break;
          if (!isWetCell(ctx, tx, tz)) { cx = tx; cz = tz; break; }
        }
        // Out-of-window or no dry shore found → skip (window edges also skip:
        // river polylines extend far beyond the window and cluster() CLAMPS,
        // which would otherwise pile props along the boundary).
        if (Number.isNaN(cx)) continue;
        const clumpSize = rng.nextInt(1, 5); // 1–4
        for (let k = 0; k < clumpSize; k++) {
          out.push(...cluster(rng, ctx, pickWeighted(rng, RIVERBANK_DRESSING), cx, cz, CELL_METERS * 2.2, 1));
        }
      }
    }
  });
  return out;
}

/**
 * Defile (ambush choke) dressing — boulders, crags, snags, deadfall in the
 * STEEPEST cells (a rocky pinch the party must funnel through). The slope
 * signal is the encoded height gradient; only cells above a slope threshold
 * seed cover, at a sparse per-cell chance so the choke reads without carpeting.
 */
export const DEFILE_SLOPE_THRESHOLD_ENC = 6; // encoded-height rise across a cell
export const DEFILE_SEED_CHANCE = 0.05;      // eligible steep cells that dress
function placeDefiles(basePath: SeedPath, ctx: PropPlacementContext): PropInstance[] {
  const heights = ctx.heights;
  if (!heights || ctx.cols < 2 || ctx.rows < 2) return [];
  const out: PropInstance[] = [];
  const stream = streamPath(basePath, 'defile');
  const cellW = ctx.extentMetersX / Math.max(1, ctx.cols);
  const cellH = ctx.extentMetersZ / Math.max(1, ctx.rows);
  const at = (c: number, r: number) => heights[r * ctx.cols + c] ?? 0;
  for (let row = 1; row < ctx.rows - 1; row++) {
    for (let col = 1; col < ctx.cols - 1; col++) {
      const gx = Math.abs(at(col + 1, row) - at(col - 1, row)) / 2;
      const gz = Math.abs(at(col, row + 1) - at(col, row - 1)) / 2;
      const slope = Math.hypot(gx, gz);
      if (slope < DEFILE_SLOPE_THRESHOLD_ENC) continue;
      const rng = rngFromPath(childSeedPath(stream, `d:${col}-${row}`));
      if (rng.next() > DEFILE_SEED_CHANCE) continue;
      const cx = (col + 0.5) * cellW;
      const cz = (row + 0.5) * cellH;
      const count = rng.nextInt(1, 4); // 1–3 pieces at the choke
      const placed = cluster(rng, ctx, pickWeighted(rng, DEFILE_DRESSING), cx, cz, Math.max(cellW, cellH), count);
      for (const inst of placed) {
        if (!isTendedGround(ctx, inst.xM, inst.zM)) out.push(inst);
      }
    }
  }
  return out;
}

/** A short fence run alongside a farm plot (L-run: several rail segments). */
function placeFenceRun(rng: SeededRandom, ctx: PropPlacementContext, b: CtxBuilding): PropInstance[] {
  const out: PropInstance[] = [];
  const segCount = rng.nextInt(3, 7);
  const ang = uniform(rng, 0, Math.PI * 2);
  const dx = Math.cos(ang) * CELL_METERS;
  const dz = Math.sin(ang) * CELL_METERS;
  const startX = b.xM + Math.cos(ang + Math.PI / 2) * CELL_METERS * 2;
  const startZ = b.zM + Math.sin(ang + Math.PI / 2) * CELL_METERS * 2;
  for (let i = 0; i < segCount; i++) {
    out.push({
      defId: 'fence-run',
      xM: clamp(startX + dx * i, 0, ctx.extentMetersX),
      zM: clamp(startZ + dz * i, 0, ctx.extentMetersZ),
      rotationRad: ang,
      variation: makeVariation(rng),
    });
  }
  return out;
}

/**
 * Gravestone rows beside a temple plot — strawman §10: "rows in yard, many,
 * seeded grid+jitter". A small oriented grid (2–4 rows × 3–6 stones) offset to
 * one side of the plot so it reads as a yard, not a plaza.
 */
function placeGraveRows(rng: SeededRandom, ctx: PropPlacementContext, b: CtxBuilding): PropInstance[] {
  const out: PropInstance[] = [];
  const rows = rng.nextInt(2, 5);
  const cols = rng.nextInt(3, 7);
  const yardAng = uniform(rng, 0, Math.PI * 2);
  const rowDx = Math.cos(yardAng), rowDz = Math.sin(yardAng);
  const colDx = -rowDz, colDz = rowDx;
  // Yard origin: a few cells off the plot center.
  const ox = b.xM + rowDx * CELL_METERS * 3;
  const oz = b.zM + rowDz * CELL_METERS * 3;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const jx = uniform(rng, -0.25, 0.25) * CELL_METERS;
      const jz = uniform(rng, -0.25, 0.25) * CELL_METERS;
      out.push({
        defId: 'gravestone',
        xM: clamp(ox + (rowDx * r + colDx * c) * CELL_METERS + jx, 0, ctx.extentMetersX),
        zM: clamp(oz + (rowDz * r + colDz * c) * CELL_METERS + jz, 0, ctx.extentMetersZ),
        rotationRad: yardAng + uniform(rng, -0.1, 0.1), // stones face the same way
        variation: makeVariation(rng),
      });
    }
  }
  return out;
}

// ── Road / trailside placement ──────────────────────────────────────────────

/** Meters of road between milestones (strawman: "road forks + intervals"). */
const MILESTONE_SPACING_M = 120;

/**
 * Sparse trailside markers along road polylines — strawman §14. ONLY point
 * props at long intervals (milestone / rare shrine / fingerpost at the road
 * end-vertices, which approximate junctions). Deliberately adds ~a handful of
 * instances per road so it cannot bloat the already-heavy wilderness density.
 */
function placeRoadside(basePath: SeedPath, ctx: PropPlacementContext): PropInstance[] {
  const out: PropInstance[] = [];
  const stream = streamPath(basePath, 'roadside');
  ctx.roads.forEach((road, ri) => {
    if (road.points.length < 2) return;
    const rng = rngFromPath(childSeedPath(stream, `road:${ri}`));
    // Walk the polyline; drop a milestone every MILESTONE_SPACING_M, offset to
    // the verge (perpendicular, ~1 cell) so it never sits ON the road.
    let sinceLast = MILESTONE_SPACING_M * uniform(rng, 0.3, 0.9); // stagger starts
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], p = road.points[i];
      const segLen = Math.hypot(p.x - a.x, p.z - a.z);
      if (segLen <= 0) continue;
      sinceLast += segLen;
      while (sinceLast >= MILESTONE_SPACING_M) {
        sinceLast -= MILESTONE_SPACING_M;
        const t = 1 - sinceLast / segLen;
        const tc = clamp(t, 0, 1);
        const nx = -(p.z - a.z) / segLen, nz = (p.x - a.x) / segLen; // verge normal
        const side = rng.next() < 0.5 ? 1 : -1;
        // Mostly milestones; the odd wayside shrine (strawman: "rare").
        const defId = rng.next() < 0.15 ? 'wayside-shrine' : 'milestone';
        out.push({
          defId,
          xM: clamp(a.x + (p.x - a.x) * tc + nx * side * CELL_METERS, 0, ctx.extentMetersX),
          zM: clamp(a.z + (p.z - a.z) * tc + nz * side * CELL_METERS, 0, ctx.extentMetersZ),
          rotationRad: uniform(rng, 0, Math.PI * 2),
          variation: makeVariation(rng),
        });
      }
    }
    // A fingerpost at one end-vertex (junction proxy), ~40% of roads.
    if (rng.next() < 0.4) {
      const end = rng.next() < 0.5 ? road.points[0] : road.points[road.points.length - 1];
      out.push({
        defId: 'fingerpost',
        xM: clamp(end.x + uniform(rng, -1, 1) * CELL_METERS, 0, ctx.extentMetersX),
        zM: clamp(end.z + uniform(rng, -1, 1) * CELL_METERS, 0, ctx.extentMetersZ),
        rotationRad: uniform(rng, 0, Math.PI * 2),
        variation: makeVariation(rng),
      });
    }
  });
  return out;
}

// ── Wilderness placement ────────────────────────────────────────────────────

/**
 * Chance an eligible biome cell seeds a cover cluster. The grid is 5-ft cells,
 * so a full ground window has ~10^5 eligible cells — the previous 0.18 rate
 * produced ~130k instances/window (log-jammed lanes, buried settlements). At
 * 0.006 a window carries a few THOUSAND instances: mostly clear ground with
 * occasional readable clusters.
 */
export const SCATTER_SEED_CHANCE = 0.006;

/**
 * Biome cover-scatter with clustering. Walks the biome grid; in eligible cells,
 * a per-cell rng decides (with LOW probability) to seed a cover cluster whose
 * prop type is drawn from the biome's weighted composition (bush-dominant,
 * fallen logs rare, boulders where rocky). NOT uniform — nearly all cells stay
 * empty. Instances that land on villager-tended ground (building / plaza /
 * road margins) are dropped: settlements stay tidy.
 */
function placeWilderness(basePath: SeedPath, ctx: PropPlacementContext): PropInstance[] {
  const out: PropInstance[] = [];
  const stream = streamPath(basePath, 'wilderness');
  const cellW = ctx.extentMetersX / Math.max(1, ctx.cols);
  const cellH = ctx.extentMetersZ / Math.max(1, ctx.rows);
  for (let row = 0; row < ctx.rows; row++) {
    for (let col = 0; col < ctx.cols; col++) {
      const biome = ctx.biomeIds[row * ctx.cols + col] ?? '';
      const weights = wildernessWeightsForBiome(biome);
      if (weights.length === 0) continue;
      const rng = rngFromPath(childSeedPath(stream, `c:${col}-${row}`));
      if (rng.next() > SCATTER_SEED_CHANCE) continue;
      const cx = (col + 0.5) * cellW;
      const cz = (row + 0.5) * cellH;
      const defId = pickWeighted(rng, weights);
      const count = rng.nextInt(2, 7); // clusters of 2–6 stay readable
      const placed = cluster(rng, ctx, defId, cx, cz, Math.max(cellW, cellH) * 0.5, count);
      for (const inst of placed) {
        if (!isTendedGround(ctx, inst.xM, inst.zM)) out.push(inst);
      }
    }
  }
  return out;
}

// ── Public entry point ──────────────────────────────────────────────────────

/**
 * Produce every WAVE-1 prop instance for a context, deterministically from
 * `seedPath`. Pure — same inputs → deep-equal output, forever.
 */
export function placeProps(seedPath: SeedPath, ctx: PropPlacementContext): PropInstance[] {
  const all = [
    ...placeMarket(seedPath, ctx),
    ...placeDocks(seedPath, ctx),
    ...placeBuildingSideProps(seedPath, ctx),
    ...placeRoadside(seedPath, ctx),
    ...placeGates(seedPath, ctx),
    ...placeRuins(seedPath, ctx),
    ...placeRiverbanks(seedPath, ctx),
    ...placeDefiles(seedPath, ctx),
    ...placeWilderness(seedPath, ctx),
  ];
  // Final safety net: never surface a non-renderable def (invisible referee
  // blocker). cluster()/emit() already guard, but this makes the invariant total.
  return all.filter((p) => RENDERABLE_DEF_IDS.has(p.defId));
}

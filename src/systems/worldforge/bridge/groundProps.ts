/**
 * @file groundProps.ts — adapter that projects a live GroundWorld onto the prop
 * placement engine's slim `PropPlacementContext`, plus the combat-extraction
 * imprint helper. This is the WIRING layer promised at the end of
 * props/placementEngine.ts: the DATA layer (propSchema / catalog / placementEngine)
 * stays renderer- and GroundWorld-agnostic; this module owns the one-way
 * projection GroundWorld → context and the referee imprint onto BattleMapTiles.
 *
 * Determinism (spec decision 9): props derive from a seed path built off the
 * region's own `seedPath` when present (so props share the town's identity root),
 * else off `rootSeedPath(seed)` anchored to the artifact window origin — the SAME
 * discipline the hidden-sites top-up uses. Same world + same window → identical
 * props, forever.
 */
import type { GroundWorld } from './groundChunkLoader';
import type {
  PropPlacementContext,
  CtxBuilding,
  CtxDeck,
  CtxPlaza,
  CtxGatehouse,
  CtxHiddenSite,
} from '../props/placementEngine';
import { placeProps } from '../props/placementEngine';
import type { WorldBusiness } from '../../../types/business';
import { WAVE1_PROPS_BY_ID, PROPS_BY_ID } from '../props/catalog';
import { CELL_METERS, providesCover as defProvidesCover, type PropInstance, type PropDefinition } from '../props/propSchema';
import type { SeedPath } from '../seedPath';
import { childSeedPath, rootSeedPath, streamPath } from '../seedPath';
import type { BattleMapTile, BattleMapDecoration } from '@/types/combat';

// Re-export so callers importing the barrel get the runtime helper too.
export { WAVE1_PROPS_BY_ID, PROPS_BY_ID } from '../props/catalog';

/**
 * Map a GroundWorld building `role` (market / workshop / temple / keep / civic /
 * house) onto the placement engine's role vocabulary (market / smithy / house /
 * poor / farm / workshop / warehouse). Only roles the engine acts on are
 * translated; everything else passes through as 'house' so it draws no props
 * rather than crashing on an unknown role.
 */
function mapBuildingRole(role: string): string {
  switch (role) {
    case 'market':
      return 'market';
    case 'workshop':
      // A workshop is a working/loading plot — the engine treats it as a
      // loading point (crate/barrel pool) exactly like a warehouse.
      return 'workshop';
    default:
      // temple / keep / civic / house → residential dressing only.
      return 'house';
  }
}

/**
 * Derive the props seed path for a ground window. Rooted at the region's town
 * identity when we have it (props then live under the town's own path), else at
 * the world root anchored to the window origin — matching the hidden-sites
 * fallback so two windows of the same world never collide.
 */
export function propsSeedPathFor(
  ground: GroundWorld,
  seed: number,
  regionSeedPath?: SeedPath,
): SeedPath {
  const base = regionSeedPath ?? rootSeedPath(seed);
  const originX = Math.round(ground.boundsFeet?.x ?? 0);
  const originZ = Math.round(ground.boundsFeet?.y ?? 0);
  // A stable window anchor so sibling windows get independent prop streams even
  // when they share one region seed path.
  return childSeedPath(streamPath(base, 'props'), `w:${originX}:${originZ}`);
}

/**
 * Project a GroundWorld onto the placement engine's context. Reads exactly what
 * the loader already knows: building plots (+roles), roads, dock/bridge decks,
 * the biome grid, and market plazas synthesized from each town's market plots.
 */
export function groundToPlacementContext(
  ground: GroundWorld,
  worldBusinesses?: Record<string, WorldBusiness>,
): PropPlacementContext {
  // SLICE B — tavern signal: match each plot to its economy business type. The
  // GroundWorld building id is `wf-plot-<burg>-<plot>`; businesses are keyed
  // `biz_burg_<burg>_plot_<plot>`. A 'tavern' business dresses its frontage.
  const businessTypeForBuilding = buildBusinessTypeLookup(worldBusinesses);

  // SLICE B — wealthy-quarter signal: townEngine ranks wards "wealthy near the
  // keep/market". We derive the same proxy WITHOUT threading `district` through
  // the town-plan adapter (a cross-cutting hot-file change): the wealthy ward is
  // the cluster of plots nearest the market/temple centroid. Deterministic.
  const wealthyIds = deriveWealthyPlots(ground);

  const buildings: CtxBuilding[] = ground.buildings.map((b) => ({
    id: b.id,
    xM: b.xM,
    zM: b.zM,
    role: mapBuildingRole(b.role),
    businessType: businessTypeForBuilding.get(b.id),
    wealthy: wealthyIds.has(b.id),
  }));

  const decks: CtxDeck[] = ground.decks.map((d) => {
    // Deck center = centroid of its corner quad (engine reads xM/zM only).
    const n = d.cornersM.length || 1;
    let cx = 0;
    let cz = 0;
    for (const c of d.cornersM) {
      cx += c.x;
      cz += c.z;
    }
    return { xM: cx / n, zM: cz / n, kind: d.kind };
  });

  // Market plazas: the plan renders no building for an open square, so we
  // synthesize one plaza anchor per town from the centroid of ITS market plots
  // (grouped by burgId embedded in the plot id `wf-plot-<burg>-<plot>`). Radius
  // covers the market cluster so stalls ring it. No market plots → no plaza.
  const plazas: CtxPlaza[] = buildMarketPlazas(ground);

  // SLICE B — gate/walls: road gatehouses (already carried on GroundWorld) anchor
  // gate dressing; the wall rings ride through as-is for future wall props.
  const gatehouses: CtxGatehouse[] = ground.gatehouses.map((g) => ({
    xM: g.xM,
    zM: g.zM,
    angleRad: g.angleRad,
  }));

  // SLICE B — ruin: 'ruin'-kind hidden sites seed ruin dressing.
  const hiddenSites: CtxHiddenSite[] = ground.hiddenSites.map((h) => ({
    id: h.id,
    kind: h.kind,
    xM: h.xM,
    zM: h.zM,
  }));

  return {
    extentMetersX: ground.extentMetersX,
    extentMetersZ: ground.extentMetersZ,
    cols: ground.cols,
    rows: ground.rows,
    biomeIds: ground.biomeIds,
    buildings,
    roads: ground.roads.map((r) => ({ points: r.points })),
    decks,
    plazas,
    // SLICE B context signals (all from data GroundWorld already carries, except
    // tavern which comes from the optional businesses map above).
    heights: ground.heights,
    walls: ground.walls.map((w) => ({ points: w.points })),
    gatehouses,
    rivers: ground.rivers.map((r) => ({ points: r.points })),
    hiddenSites,
  };
}

/**
 * Build a plot-id → business-type lookup keyed by the GroundWorld building id.
 * Businesses are keyed `biz_burg_<burg>_plot_<plot>`; a plot renders as
 * `wf-plot-<burg>-<plot>`. Empty when no businesses are supplied.
 */
function buildBusinessTypeLookup(
  worldBusinesses?: Record<string, WorldBusiness>,
): Map<string, string> {
  const out = new Map<string, string>();
  if (!worldBusinesses) return out;
  for (const biz of Object.values(worldBusinesses)) {
    const m = /^biz_burg_(\d+)_plot_(\d+)$/.exec(biz.id);
    if (!m) continue;
    out.set(`wf-plot-${m[1]}-${m[2]}`, biz.businessType);
  }
  return out;
}

/**
 * Derive the wealthy ward as a proxy for townEngine's district ranking (which
 * isn't threaded through the town-plan adapter). The wealthy quarter is the
 * plots nearest the market/temple centroid (townEngine: "wealthy near the
 * keep/market"). We take the closest ~25% of non-market plots per burg. Purely
 * a function of plot geometry → deterministic, no RNG.
 */
function deriveWealthyPlots(ground: GroundWorld): Set<string> {
  const wealthy = new Set<string>();
  const byBurg = new Map<string, GroundWorld['buildings']>();
  for (const b of ground.buildings) {
    const key = burgOfPlot(b.id);
    const arr = byBurg.get(key) ?? [];
    arr.push(b);
    byBurg.set(key, arr);
  }
  for (const [, plots] of byBurg) {
    const anchors = plots.filter((p) => p.role === 'market' || p.role === 'temple');
    if (anchors.length === 0 || plots.length < 4) continue;
    let ax = 0, az = 0;
    for (const a of anchors) { ax += a.xM; az += a.zM; }
    ax /= anchors.length; az /= anchors.length;
    // Residential/house plots (not market/temple/civic) ranked by closeness.
    const candidates = plots
      .filter((p) => p.role !== 'market' && p.role !== 'temple')
      .map((p) => ({ id: p.id, d: Math.hypot(p.xM - ax, p.zM - az) }))
      .sort((a, b) => a.d - b.d);
    const take = Math.max(1, Math.floor(candidates.length * 0.25));
    for (let i = 0; i < take; i++) wealthy.add(candidates[i].id);
  }
  return wealthy;
}

/** Burg id parsed from a `wf-plot-<burg>-<plot>` id, or 'x' if unparseable. */
function burgOfPlot(plotId: string): string {
  const m = /^wf-plot-(\d+)-/.exec(plotId);
  return m ? m[1] : 'x';
}

function buildMarketPlazas(ground: GroundWorld): CtxPlaza[] {
  const byBurg = new Map<string, Array<{ x: number; z: number }>>();
  for (const b of ground.buildings) {
    if (b.role !== 'market') continue;
    const key = burgOfPlot(b.id);
    let arr = byBurg.get(key);
    if (!arr) {
      arr = [];
      byBurg.set(key, arr);
    }
    arr.push({ x: b.xM, z: b.zM });
  }
  const plazas: CtxPlaza[] = [];
  for (const [burg, pts] of byBurg) {
    let cx = 0;
    let cz = 0;
    for (const p of pts) {
      cx += p.x;
      cz += p.z;
    }
    cx /= pts.length;
    cz /= pts.length;
    // Radius = farthest market plot from centroid, floored so a lone stall still
    // gets a usable ring. Kept modest so stalls stay inside the market ward.
    let maxR = 0;
    for (const p of pts) maxR = Math.max(maxR, Math.hypot(p.x - cx, p.z - cz));
    const radiusM = Math.max(CELL_METERS * 3, maxR + CELL_METERS);
    plazas.push({ id: `mkt-${burg}`, xM: cx, zM: cz, radiusM });
  }
  return plazas;
}

/**
 * Produce the WAVE-1 prop instances for a ground window, deterministically. Thin
 * wrapper over the placement engine that owns the GroundWorld→context projection
 * and the seed-path derivation so callers (the loader, tests) get one entry point.
 */
export function buildGroundProps(
  ground: GroundWorld,
  seed: number,
  regionSeedPath?: SeedPath,
  worldBusinesses?: Record<string, WorldBusiness>,
): PropInstance[] {
  const ctx = groundToPlacementContext(ground, worldBusinesses);
  const path = propsSeedPathFor(ground, seed, regionSeedPath);
  return placeProps(path, ctx);
}

// ── Combat extraction imprint ───────────────────────────────────────────────

/**
 * Map a prop definition onto the BattleMap's decoration vocabulary where one
 * fits. The BattleMapDecoration set is fixed art tokens; only props with a clear
 * visual analogue get a decoration, the rest imprint referee data with no icon.
 */
function decorationForDef(def: PropDefinition): BattleMapDecoration {
  switch (def.id) {
    case 'boulder':
      return 'boulder';
    case 'fallen-log':
      return 'fallen_log';
    case 'bush':
      return 'bush';
    default:
      return null; // crates/barrels/stalls/etc. — referee-only, no art token.
  }
}

/**
 * Footprint of a placed prop in ground meters as a half-extent (radius). Size
 * class S imprints its own cell only; M/L imprint a small footprint disc so a
 * crate-stack or fence run marks the cells it truly spans.
 */
function footprintRadiusM(def: PropDefinition): number {
  switch (def.sizeClass) {
    case 'S':
      return CELL_METERS * 0.5; // its own cell
    case 'M':
      return CELL_METERS; // ~1×2 / 2×2
    case 'L':
    default:
      return CELL_METERS * 1.5; // wall-like run / 3+ cells
  }
}

/**
 * Imprint a placed prop's referee data onto the BattleMap tile at (tx, ty) whose
 * ground-meter center is (wx, wz), IF the prop's footprint covers that tile.
 * Mutates the tile in place; a "harder" prop wins each boolean so overlapping
 * props never soften a tile. Returns true if this prop touched the tile.
 *
 * This is the promise of the wave made concrete: a prop is born combat-legible —
 * the same crate the 3D scene will draw already blocks movement, grants cover,
 * and carries its wood/thickness for spell penetration.
 */
export function imprintPropOnTile(
  tile: BattleMapTile,
  prop: PropInstance,
  wx: number,
  wz: number,
): boolean {
  // Look the placed prop up in the FULL catalog: the placement engine emits
  // expanded defs (e.g. a road-junction `fingerpost`) beyond the WAVE1 subset,
  // and those must still imprint their combat-referee data onto the tile — a
  // WAVE1-only lookup silently dropped them (no cover/LoS), a latent gap that
  // only surfaced once coastal towns stopped rendering as all-water and grew a
  // real dry road network. (Rendering of new prop FORMS remains a later slice.)
  const def = PROPS_BY_ID.get(prop.defId);
  if (!def) return false;
  const r = footprintRadiusM(def);
  if (Math.hypot(wx - prop.xM, wz - prop.zM) > r) return false;

  const ref = def.referee;
  // Booleans: hardest-wins (a passable prop never un-blocks an already-blocked
  // tile from an overlapping prop or a building wall).
  if (ref.blocksMovement) {
    tile.blocksMovement = true;
    tile.movementCost = 0;
  } else if (ref.difficultTerrain && !tile.blocksMovement) {
    // Difficult terrain doubles move cost but stays passable.
    tile.movementCost = Math.max(tile.movementCost, 2);
    if (tile.terrain === 'grass' || tile.terrain === 'sand' || tile.terrain === 'mud') {
      tile.terrain = 'difficult';
    }
  }
  if (ref.blocksLoS) tile.blocksLoS = true;
  if (defProvidesCover(def)) tile.providesCover = true;

  // Material + thickness: a solid prop's body defines penetration. Only stamp
  // when the tile isn't already a heavier structural material (a building wall).
  if (tile.material === undefined) {
    tile.material = ref.material;
    tile.thicknessInches = ref.thicknessInches;
  }

  // Decoration: only if the tile has no decoration yet (buildings/nature win the
  // art token they already set) and this def has a visual analogue.
  if (tile.decoration === null) {
    const deco = decorationForDef(def);
    if (deco !== null) tile.decoration = deco;
  }
  return true;
}

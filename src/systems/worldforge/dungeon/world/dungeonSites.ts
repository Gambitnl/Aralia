/**
 * @file dungeonSites.ts — Pillar 2, Task 1: enumerate a world's dungeon SITES
 * from the real atlas.
 *
 * A "site" is a placeable dungeon opportunity BEFORE any interior is generated:
 * where it is (cellId / burg), how you get in (entranceKind), and what flavor it
 * is (theme + builder archetype). Later tasks turn a site into DungeonParams
 * (deriveIdentity), a chronicle, and a real interior. This module is pure and
 * cached per world seed, exactly like `getBridgeAtlas`.
 *
 * SOURCES (Level 1):
 *  (a) FMG markers of types dungeons / caves / necropolises / disturbed-burials
 *      → a site AT the marker's cell. We bind to the ATLAS-LEVEL `atlas.markers`
 *      (== `pack.markers`, the materialized POI list carried on the cached
 *      world result — generateWorld.ts:404, features Marker{ i, type, cell,
 *      x, y }). These markers are placed with `Math.random` during world gen,
 *      but the atlas is generated ONCE per seed and cached, so the marker list
 *      is stable for the life of the process — every `enumerateDungeonSites`
 *      call reads the same frozen list. We bind here (not to per-region
 *      RegionArtifact.markers) because pack markers carry the `cell` id we need
 *      to anchor identity to the site's cell; region markers only carry Feet
 *      x/y and are materialized lazily per region, so they are neither global
 *      nor cell-addressed. posFt comes from `pack.cells.p[cell] ×
 *      FEET_PER_FMG_PIXEL` (same convention as describeCell).
 *  (b) Burgs with `temple === 1` → a 'temple-stair' crypt under the temple, at
 *      the burg's cell. sitePath `wf:<seed>/burg:<burgId>/dungeon:crypt`.
 *  (c) Sewers are CAPPED per state: among a state's walled burgs, only the
 *      single most populous one qualifies (ties broken by capital flag, then
 *      lowest burg id), and only if its population ≥ 10 (≥10k souls). That
 *      keeps sewer counts near "one per sizable state" instead of ~10× every
 *      other source. sitePath `wf:<seed>/burg:<burgId>/dungeon:sewer`.
 *
 * CIVILIZATION ARCHAEOLOGY (Task 2, origin 'civ') — dungeons the WORLD'S OWN
 * generated history placed. Read from `pack.zones` (the FMG event zones the
 * danger field also consumes — Zone{ i, name, type, cells }) and mountain
 * terrain. Every civ site records WHY in `provenance`, which Task 4's chronicle
 * quotes. All deterministic (new `s:civ-sites` stream only), deduped by cellId
 * against the sources above (marker/temple/sewer WIN a shared cell), and capped
 * ≤ 3 per state:
 *  (d) WAR zones (types Invasion / Rebels / Crusade — armed conflict, NOT
 *      peaceful Proselytism) → one 'fortress'-archetype border-fortress ruin on
 *      the zone's COMMANDING cell (highest land cell; ties → lowest cellId).
 *      Theme 'frost' when temp ≤ −2 °C, else 'crypt' (theme and archetype vary
 *      independently — generateDungeon's params.archetype overrides the
 *      theme→archetype default; archetype drives structure, theme palette).
 *      sitePath `wf:<seed>/cell:<cell>/dungeon:z<zoneId>`.
 *  (e) PLAGUE zones (type Disease) touching a burg (seat cell in or adjacent to
 *      a zone cell) → one 'mausoleum' necropolis crypt at that burg's cell.
 *      sitePath `wf:<seed>/cell:<cell>/dungeon:z<zoneId>`.
 *  (f) MINES → 'mine'-archetype cave-mouths on mountain cells (h ≥ 70) within
 *      graph radius 4 of a live burg. World budget ≤ ~1 per two states, ≤ 1 per
 *      state, filled by a seeded shuffle of the candidate cells (stable per
 *      seed). sitePath `wf:<seed>/cell:<cell>/dungeon:mine`.
 * Zone-derived paths key on the zone id (`z<zoneId>`) so two zones sharing a
 * commanding cell can't collide; mines use the fixed `mine` suffix (deduped by
 * cell, so ≤ 1 per cell). None can collide with `dungeon:m<markerId>` because a
 * civ candidate cell already holding a marker site is skipped.
 *
 * Determinism: no Math.random here. The only randomness is the seeded
 * weighted theme pick for ambiguous `dungeons` markers, drawn on a NEW named
 * stream (`s:site-theme`) off the site's own path — so it cannot perturb any
 * existing worldforge golden. Output is sorted (cellId, entranceKind, burgId)
 * for a stable order.
 *
 * Traps honored (recon §Traps): identity anchors to the marker/burg cell,
 * never the player's streamed cell; burg loops skip i===0 / removed; frozen
 * seed grammar (new draws on new streams only). Zero THREE imports.
 */
import type { Feet } from '../../units';
import type { SeedPath } from '../../seedPath';
import { rootSeedPath, childSeedPath, streamPath, rngFromPath } from '../../seedPath';
import { FEET_PER_FMG_PIXEL } from '../../adapter/atlasArtifact';
import { getBridgeAtlas } from '../../bridge/legacySubmapBridge';
import type { DungeonTheme, BuilderArchetype } from '../types';

/** A land cell has height ≥ 20 in FMG's convention (LAND_H). */
const LAND_H = 20;
/** A `dungeons` marker in a cell this cold or colder becomes a frost fortress. */
const FROST_TEMP_C = -2;
/** A burg needs at least this population (× 1000) to carry a sewer network. */
const SEWER_POP_MIN = 10;

// ── Task 2: civilization-archaeology (origin 'civ') tuning ─────────────────
/**
 * Zone types that count as ARMED CONFLICT — each grows one border-fortress
 * ruin. `Proselytism` (peaceful religious spread) is deliberately excluded;
 * only zones where soldiers actually fought leave a fortress. `type` values are
 * the real FMG zone types (zones-generator.ts).
 */
const WAR_ZONE_TYPES: ReadonlySet<string> = new Set(['Invasion', 'Rebels', 'Crusade']);
/** The single plague zone type — a Disease zone seeds one necropolis crypt. */
const PLAGUE_ZONE_TYPE = 'Disease';
/** A cell counts as "mountain" at h ≥ this — the codebase-wide mountain line
 * (markers/states/military generators all treat h ≥ 70 as mountains). */
const MOUNTAIN_H = 70;
/** Mines only form on mountains within this many graph hops of a live burg —
 * a mine is worked OUT of a settlement, so it must sit near one. */
const MINE_BURG_GRAPH_RADIUS = 4;
/** Hard ceiling on civ sites per state, so archaeology never floods a region. */
const MAX_CIV_SITES_PER_STATE = 3;
/** World-wide mine budget: at most one civ mine per this many states (≤ ~1 per
 * 2 states keeps delved mines a rare, deliberate feature). */
const STATES_PER_CIV_MINE = 2;

export type EntranceKind = 'ruin-door' | 'cave-mouth' | 'temple-stair' | 'sewer-grate';
/** 'civ' is reserved for Task 2 archaeology sites; sewers are 'town'. */
export type SiteOrigin = 'marker' | 'temple' | 'town' | 'civ';

/**
 * Why a `civ`-origin site exists — the world-history fact that grounds it.
 * Task 4's chronicle quotes these (the real zone name, e.g. "the War of the
 * Onerean Occupation"). Only civ sites carry provenance.
 * - `war-zone`: a border-fortress ruin left by an armed conflict zone.
 * - `plague-zone`: a necropolis crypt swollen by a Disease zone's dead.
 * - `ore-mountain`: a delved mine on high ground worked out of a nearby burg.
 */
export interface SiteProvenance {
  kind: 'war-zone' | 'plague-zone' | 'ore-mountain';
  zoneId?: number;
  zoneName?: string;
}

/**
 * A dungeon opportunity anchored to the world, before any interior exists.
 * `posFt` is the site mouth in Worldforge feet (atlas cell center × feet/px).
 */
export interface DungeonSite {
  sitePath: SeedPath;
  cellId: number;
  burgId?: number;
  entranceKind: EntranceKind;
  theme: DungeonTheme;
  archetype: BuilderArchetype;
  origin: SiteOrigin;
  /** Marker `i` for 'marker'-origin sites; absent otherwise. */
  markerRef?: number;
  /** Present only for 'civ'-origin sites — the world-history fact behind them. */
  provenance?: SiteProvenance;
  posFt: { x: Feet; y: Feet };
}

/**
 * The four dungeon-bearing marker types, mapped to their entrance look.
 * Burial markers get 'ruin-door' (a ruined mausoleum door) — 'temple-stair'
 * is reserved for origin-'temple' burg crypts.
 */
const MARKER_ENTRANCE: Record<string, EntranceKind> = {
  dungeons: 'ruin-door',
  caves: 'cave-mouth',
  necropolises: 'ruin-door',
  'disturbed-burials': 'ruin-door',
};

/** Legal (theme, archetype) pairs, by construction. Exported for tests. */
export const THEME_ARCHETYPE: Record<DungeonTheme, BuilderArchetype> = {
  crypt: 'mausoleum',
  cavern: 'mine',
  frost: 'fortress',
  sewer: 'waterworks',
  fungal: 'mine',
};

interface MarkerLike {
  i: number;
  type: string;
  cell: number;
}

interface ZoneLike {
  i: number;
  type?: string;
  name?: string;
  cells?: number[];
}

interface BurgLike {
  i?: number;
  cell?: number;
  removed?: boolean;
  population?: number;
  temple?: number;
  walls?: number;
  state?: number;
  capital?: number;
}

/** Feet position of an atlas cell center (matches describeCell's convention). */
function cellPosFt(
  p: ReadonlyArray<readonly [number, number]>,
  cellId: number,
): { x: Feet; y: Feet } {
  const pt = p[cellId] ?? [0, 0];
  return {
    x: Math.round(pt[0] * FEET_PER_FMG_PIXEL),
    y: Math.round(pt[1] * FEET_PER_FMG_PIXEL),
  };
}

/**
 * Theme for a `dungeons` marker: frost in the deep cold, else a seeded
 * weighted pick between crypt (undead barrow) and cavern (delved warren).
 * Drawn on the site's own `s:site-theme` stream (new; perturbs nothing).
 */
function dungeonMarkerTheme(sitePath: SeedPath, tempC: number): DungeonTheme {
  if (tempC <= FROST_TEMP_C) return 'frost';
  // Weighted 3:2 crypt:cavern — barrows slightly outnumber delved warrens.
  const rng = rngFromPath(streamPath(sitePath, 'site-theme'));
  return rng.next() < 0.6 ? 'crypt' : 'cavern';
}

/**
 * Burg ids eligible for a sewer site: per state, the single most populous
 * walled burg (ties: capital first, then lowest id), if population ≥
 * SEWER_POP_MIN. Deterministic — pure sort keys, no draws.
 */
function pickSewerBurgIds(burgs: BurgLike[]): Set<number> {
  const bestByState = new Map<number, { id: number; pop: number; capital: number }>();
  for (let i = 0; i < burgs.length; i++) {
    const b = burgs[i];
    if (!b || b.i === 0 || b.removed || typeof b.cell !== 'number') continue;
    if (b.walls !== 1) continue;
    const id = typeof b.i === 'number' ? b.i : i;
    const pop = b.population ?? 0;
    const capital = b.capital === 1 ? 1 : 0;
    const state = b.state ?? -1;
    const cur = bestByState.get(state);
    if (
      !cur ||
      pop > cur.pop ||
      (pop === cur.pop && capital > cur.capital) ||
      (pop === cur.pop && capital === cur.capital && id < cur.id)
    ) {
      bestByState.set(state, { id, pop, capital });
    }
  }
  const out = new Set<number>();
  for (const best of bestByState.values()) {
    if (best.pop >= SEWER_POP_MIN) out.add(best.id);
  }
  return out;
}

function stableSort(sites: DungeonSite[]): DungeonSite[] {
  return sites.sort((a, b) => {
    if (a.cellId !== b.cellId) return a.cellId - b.cellId;
    if (a.entranceKind !== b.entranceKind) {
      return a.entranceKind < b.entranceKind ? -1 : 1;
    }
    return (a.burgId ?? -1) - (b.burgId ?? -1);
  });
}

// ── Task 2 helpers: civilization-archaeology (origin 'civ') ─────────────────

/** Cell arrays this layer reads. All are FMG pack arrays, indexed by cellId. */
interface CivCells {
  h: ArrayLike<number>;
  p: ReadonlyArray<readonly [number, number]>;
  c?: ReadonlyArray<ReadonlyArray<number>>;
  g?: ArrayLike<number>;
  state?: ArrayLike<number>;
  burg?: ArrayLike<number>;
}

/** °C at a cell, via the grid.temp array (pack→grid index through cells.g). */
function cellTempC(
  cells: CivCells,
  gridTemp: ArrayLike<number> | undefined,
  cellId: number,
): number {
  if (!gridTemp) return 0;
  const gi = cells.g ? cells.g[cellId] : cellId;
  return gridTemp[gi] ?? 0;
}

/**
 * The commanding land cell of a war zone: highest ground wins (a fortress sits
 * on the high point), ties broken by lowest cellId for determinism. Returns
 * undefined if the zone has no land cell (all-water zones seed no fortress).
 * Rule documented in the module header.
 */
function commandingCell(cells: CivCells, zoneCells: readonly number[]): number | undefined {
  let best: number | undefined;
  let bestH = -Infinity;
  for (const cid of zoneCells) {
    if (typeof cid !== 'number' || cid < 0 || cid >= cells.h.length) continue;
    const h = cells.h[cid] ?? 0;
    if (h < LAND_H) continue;
    if (h > bestH || (h === bestH && (best === undefined || cid < best))) {
      bestH = h;
      best = cid;
    }
  }
  return best;
}

/**
 * A live burg touching a zone: the lowest-id burg whose seat cell is IN the
 * zone or ADJACENT to a zone cell. Deterministic (lowest id). Returns the burg
 * id and its cell, or undefined when no settlement borders the zone.
 */
function burgTouchingZone(
  cells: CivCells,
  burgs: BurgLike[],
  zoneCells: readonly number[],
): { burgId: number; cell: number } | undefined {
  const inZone = new Set<number>(zoneCells);
  // A cell counts as "adjacent" if any of its graph neighbors is a zone cell.
  const near = (cell: number): boolean => {
    if (inZone.has(cell)) return true;
    const nbrs = cells.c ? cells.c[cell] : undefined;
    if (!nbrs) return false;
    for (const j of nbrs) if (inZone.has(j)) return true;
    return false;
  };
  let bestId: number | undefined;
  let bestCell = -1;
  for (let i = 0; i < burgs.length; i++) {
    const b = burgs[i];
    if (!b || b.i === 0 || b.removed || typeof b.cell !== 'number') continue;
    if (!near(b.cell)) continue;
    const id = typeof b.i === 'number' ? b.i : i;
    if (bestId === undefined || id < bestId) {
      bestId = id;
      bestCell = b.cell;
    }
  }
  return bestId === undefined ? undefined : { burgId: bestId, cell: bestCell };
}

/**
 * Every land cell within `radius` graph hops of any live burg's seat cell, and
 * the nearest such burg for each — used to bind a mountain mine to a settlement.
 * Pure BFS over the cell neighbor graph (cells.c). Distance is graph hops, not
 * pixels, so it honors "graph radius ~4" from the design.
 */
function burgReachMap(cells: CivCells, burgs: BurgLike[], radius: number): Map<number, number> {
  // cellId → nearest burgId (first burg to reach it in a multi-source BFS).
  const owner = new Map<number, number>();
  if (!cells.c) return owner;
  let frontier: number[] = [];
  for (let i = 0; i < burgs.length; i++) {
    const b = burgs[i];
    if (!b || b.i === 0 || b.removed || typeof b.cell !== 'number') continue;
    const id = typeof b.i === 'number' ? b.i : i;
    if (!owner.has(b.cell)) {
      owner.set(b.cell, id);
      frontier.push(b.cell);
    }
  }
  for (let ring = 0; ring < radius && frontier.length; ring++) {
    const next: number[] = [];
    for (const cell of frontier) {
      const nbrs = cells.c[cell];
      if (!nbrs) continue;
      const ownerId = owner.get(cell)!;
      for (const j of nbrs) {
        if (owner.has(j)) continue;
        owner.set(j, ownerId);
        next.push(j);
      }
    }
    frontier = next;
  }
  return owner;
}

/** State id of a cell, or -1 when unknown (used for the per-state cap). */
function cellState(cells: CivCells, cellId: number): number {
  return cells.state ? (cells.state[cellId] ?? -1) : -1;
}

/**
 * Grow the civ-archaeology (origin 'civ') sites and append them to `sites`.
 *
 * Ordering of concerns (deterministic, all on the `s:civ-sites` stream family):
 *   1. WAR zones  → one border-fortress ruin on the zone's commanding cell.
 *   2. PLAGUE zones → one necropolis crypt near a burg the zone touches.
 *   3. MINES → mountain (h ≥ 70) cells within graph radius of a burg, world
 *      budget ≤ ~1 per two states, at most one per state.
 *
 * Dedupe: a candidate cell already claimed by ANY earlier site (Task-1 or an
 * earlier civ concern) is skipped — Task-1 markers/temple/sewer win, and war
 * beats plague beats mine on a shared cell. Per-state cap ≤ 3 civ sites.
 */
function appendCivSites(
  sites: DungeonSite[],
  root: SeedPath,
  cells: CivCells,
  gridTemp: ArrayLike<number> | undefined,
  burgs: BurgLike[],
  rawZones: ReadonlyArray<ZoneLike>,
): void {
  const zones = rawZones.filter((z) => z && Array.isArray(z.cells));

  // Cells already taken by any site (Task-1 first). Dedupe by cellId.
  const usedCells = new Set<number>(sites.map((s) => s.cellId));
  // Per-state civ-site tally, enforcing MAX_CIV_SITES_PER_STATE.
  const perState = new Map<number, number>();
  const canPlace = (state: number): boolean =>
    (perState.get(state) ?? 0) < MAX_CIV_SITES_PER_STATE;
  const claim = (cellId: number, state: number): void => {
    usedCells.add(cellId);
    perState.set(state, (perState.get(state) ?? 0) + 1);
  };

  // 1 ── WAR ZONES → border-fortress ruins ─────────────────────────────────
  // Sorted by zone id for a stable pass order.
  const warZones = zones
    .filter((z) => WAR_ZONE_TYPES.has(z.type ?? ''))
    .sort((a, b) => a.i - b.i);
  for (const z of warZones) {
    const cell = commandingCell(cells, z.cells!);
    if (cell === undefined || usedCells.has(cell)) continue;
    const state = cellState(cells, cell);
    if (!canPlace(state)) continue;
    // Frost fortress in the deep cold, else a crypt-flavored ruin (the fallen
    // hold reclaimed as a tomb). Archetype is ALWAYS 'fortress' regardless of
    // theme — theme drives palette/monsters, archetype drives structure, and
    // generateDungeon accepts the two independently (params.archetype overrides
    // THEME_ARCHETYPE). Documented combos: frost+fortress, crypt+fortress.
    const tempC = cellTempC(cells, gridTemp, cell);
    const theme: DungeonTheme = tempC <= FROST_TEMP_C ? 'frost' : 'crypt';
    const sitePath = childSeedPath(
      childSeedPath(root, `cell:${cell}`),
      `dungeon:z${z.i}`,
    );
    sites.push({
      sitePath,
      cellId: cell,
      entranceKind: 'ruin-door',
      theme,
      archetype: 'fortress',
      origin: 'civ',
      provenance: { kind: 'war-zone', zoneId: z.i, zoneName: z.name },
      posFt: cellPosFt(cells.p, cell),
    });
    claim(cell, state);
  }

  // 2 ── PLAGUE ZONES → necropolis crypts near a touched burg ───────────────
  const plagueZones = zones
    .filter((z) => (z.type ?? '') === PLAGUE_ZONE_TYPE)
    .sort((a, b) => a.i - b.i);
  for (const z of plagueZones) {
    const hit = burgTouchingZone(cells, burgs, z.cells!);
    if (!hit) continue;
    const cell = hit.cell;
    if ((cells.h[cell] ?? 0) < LAND_H) continue; // land only
    if (usedCells.has(cell)) continue;
    const state = cellState(cells, cell);
    if (!canPlace(state)) continue;
    const sitePath = childSeedPath(
      childSeedPath(root, `cell:${cell}`),
      `dungeon:z${z.i}`,
    );
    sites.push({
      sitePath,
      cellId: cell,
      burgId: hit.burgId,
      entranceKind: 'ruin-door',
      theme: 'crypt',
      archetype: 'mausoleum',
      origin: 'civ',
      provenance: { kind: 'plague-zone', zoneId: z.i, zoneName: z.name },
      posFt: cellPosFt(cells.p, cell),
    });
    claim(cell, state);
  }

  // 3 ── MINES → mountains near a burg, world-budgeted ──────────────────────
  // World budget: at most floor(nStates / STATES_PER_CIV_MINE) mines, and at
  // most one per state. Candidate mountain cells within graph radius of a burg
  // are gathered, then the budget is filled deterministically (a seeded shuffle
  // of the candidate order on the `s:civ-sites` stream, capped per state).
  const nStates = countStates(cells, burgs);
  const mineBudget = Math.floor(nStates / STATES_PER_CIV_MINE);
  if (mineBudget > 0) {
    const reach = burgReachMap(cells, burgs, MINE_BURG_GRAPH_RADIUS);
    // Deterministic candidate list: mountain land cells reachable from a burg,
    // sorted by cellId.
    const candidates: number[] = [];
    for (let cid = 0; cid < cells.h.length; cid++) {
      if ((cells.h[cid] ?? 0) < MOUNTAIN_H) continue; // mountain (h ≥ 70)
      if (usedCells.has(cid)) continue;
      if (!reach.has(cid)) continue; // must be near a burg
      candidates.push(cid);
    }
    // Seeded order so which mountains get mined varies by world but is stable
    // for a seed. Draw on a NEW named stream off the world root.
    const rng = rngFromPath(streamPath(root, 'civ-sites'));
    const shuffled = seededShuffle(candidates, rng);
    let placed = 0;
    const minedStates = new Set<number>();
    for (const cid of shuffled) {
      if (placed >= mineBudget) break;
      if (usedCells.has(cid)) continue;
      const state = cellState(cells, cid);
      if (minedStates.has(state)) continue; // ≤ 1 mine per state
      if (!canPlace(state)) continue;
      const burgId = reach.get(cid);
      const sitePath = childSeedPath(
        childSeedPath(root, `cell:${cid}`),
        `dungeon:mine`,
      );
      sites.push({
        sitePath,
        cellId: cid,
        burgId,
        entranceKind: 'cave-mouth',
        theme: 'cavern',
        archetype: 'mine',
        origin: 'civ',
        provenance: { kind: 'ore-mountain' },
        posFt: cellPosFt(cells.p, cid),
      });
      claim(cid, state);
      minedStates.add(state);
      placed++;
    }
  }
}

/** Distinct state ids across live burgs (the per-state budgets scale on this). */
function countStates(_cells: CivCells, burgs: BurgLike[]): number {
  const states = new Set<number>();
  for (let i = 0; i < burgs.length; i++) {
    const b = burgs[i];
    if (!b || b.i === 0 || b.removed) continue;
    states.add(b.state ?? -1);
  }
  return states.size;
}

/** Fisher–Yates shuffle driven by a SeededRandom (nextInt is max-EXCLUSIVE). */
function seededShuffle(items: number[], rng: { nextInt(min: number, max: number): number }): number[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

const siteCache = new Map<number, DungeonSite[]>();

/**
 * Enumerate every Level-1 dungeon site for a world. Cached per seed (the atlas
 * it reads is itself cached, so the result is stable across calls).
 */
export function enumerateDungeonSites(worldSeed: number): DungeonSite[] {
  const key = worldSeed >>> 0;
  const cached = siteCache.get(key);
  if (cached) return cached.map((s) => ({ ...s, posFt: { ...s.posFt } }));

  const atlas = getBridgeAtlas(worldSeed);
  const cells = atlas.pack.cells as CivCells;
  const gridTemp = atlas.grid?.cells?.temp as ArrayLike<number> | undefined;
  const root = rootSeedPath(worldSeed);
  const sites: DungeonSite[] = [];

  // ── (a) marker-origin sites ────────────────────────────────────────────
  const markers = ((atlas.markers ?? []) as MarkerLike[]).filter(
    (m) => m && typeof m.cell === 'number' && m.type in MARKER_ENTRANCE,
  );
  for (const m of markers) {
    const cell = m.cell;
    // Wilderness sites must sit on land (h ≥ 20). Off-land markers are dropped.
    if ((cells.h[cell] ?? 0) < LAND_H) continue;

    const entranceKind = MARKER_ENTRANCE[m.type];
    // Key the wilderness segment by the marker's OWN id — marker ids are
    // unique atlas-wide, so two markers of any types sharing a cell can never
    // collide on sitePath.
    const sitePath = childSeedPath(
      childSeedPath(root, `cell:${cell}`),
      `dungeon:m${m.i}`,
    );

    let theme: DungeonTheme;
    switch (m.type) {
      case 'necropolises':
      case 'disturbed-burials':
        theme = 'crypt';
        break;
      case 'caves':
        theme = 'cavern';
        break;
      default: {
        // dungeons: frost in the cold, else seeded crypt|cavern.
        const gi = cells.g ? cells.g[cell] : cell;
        const tempC = gridTemp ? gridTemp[gi] : 0;
        theme = dungeonMarkerTheme(sitePath, tempC);
        break;
      }
    }

    sites.push({
      sitePath,
      cellId: cell,
      entranceKind,
      theme,
      archetype: THEME_ARCHETYPE[theme],
      origin: 'marker',
      markerRef: m.i,
      posFt: cellPosFt(cells.p, cell),
    });
  }

  // ── (b)+(c) burg-origin sites ──────────────────────────────────────────
  const burgs = (atlas.pack.burgs ?? []) as BurgLike[];
  const sewerIds = pickSewerBurgIds(burgs);
  for (let i = 0; i < burgs.length; i++) {
    const b = burgs[i];
    // Phantom burg 0 and removed burgs never carry sites.
    if (!b || b.i === 0 || b.removed || typeof b.cell !== 'number') continue;
    const burgId = typeof b.i === 'number' ? b.i : i;
    const cell = b.cell;
    const posFt = cellPosFt(cells.p, cell);

    // (b) temple crypt.
    if (b.temple === 1) {
      sites.push({
        sitePath: childSeedPath(
          childSeedPath(root, `burg:${burgId}`),
          'dungeon:crypt',
        ),
        cellId: cell,
        burgId,
        entranceKind: 'temple-stair',
        theme: 'crypt',
        archetype: THEME_ARCHETYPE.crypt,
        origin: 'temple',
        posFt: { ...posFt },
      });
    }

    // (c) sewer waterworks — the state's dominant walled burg, if ≥10k souls.
    if (sewerIds.has(burgId)) {
      sites.push({
        sitePath: childSeedPath(
          childSeedPath(root, `burg:${burgId}`),
          'dungeon:sewer',
        ),
        cellId: cell,
        burgId,
        entranceKind: 'sewer-grate',
        theme: 'sewer',
        archetype: THEME_ARCHETYPE.sewer,
        origin: 'town',
        posFt: { ...posFt },
      });
    }
  }

  // ── (d) civ-origin sites — civilization archaeology (Task 2) ─────────────
  // Grown from the world's own generated HISTORY: war zones leave fortress
  // ruins, plague zones leave necropolis crypts, mountains near burgs hide
  // worked-out mines. All deterministic (seed streams only), deduped against
  // the Task-1 sites above (marker/temple/sewer WIN on a shared cell), and
  // capped per state so archaeology never floods a region.
  const rawZones = ((atlas.pack as { zones?: ZoneLike[] }).zones ?? []) as ZoneLike[];
  appendCivSites(sites, root, cells, gridTemp, burgs, rawZones);

  const result = stableSort(sites);
  siteCache.set(key, result);
  return result.map((s) => ({ ...s, posFt: { ...s.posFt } }));
}

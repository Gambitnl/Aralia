/**
 * @file worldChronicle.ts — the reverse-generational world chronicle.
 *
 * DESIGN PRINCIPLE (Remy): world history is generated BACKWARDS from the present
 * atlas. The present is the boundary condition; history EXPLAINS it. We never
 * invent free-floating events — we read the finished map (state borders, religion
 * spread, culture overlaps, ruin markers) and infer the past that MUST have
 * produced it. State borders imply the wars that drew them; a religion spanning
 * two states implies the schism that split it; overlapping cultures imply the
 * migration that crossed them; a necropolis marker implies the fallen polity that
 * built it. Every entry cites the PRESENT fact it explains (`evidence`).
 *
 * OUTPUT. `worldChronicleFor(worldSeed)` → `{ entries: ChronicleEntry[] }`,
 * cached per seed, sorted oldest → newest. A chronicle, not an encyclopedia:
 * capped to ≤ MAX_ENTRIES so the arc reads as a handful of named ages.
 *
 * DETERMINISM. No Math.random. Every inference pass draws on ITS OWN named stream
 * off the world root (`s:world-chronicle` → `s:border-wars`, `s:schisms`, …), so
 * adding a pass never perturbs another's draws, and none of these streams touch
 * the dungeon `s:chronicle` zone-age stream — the ADOPT pass reuses that stream
 * verbatim (via `zoneYearsAgo`), so adopted zone eras stay BYTE-IDENTICAL to the
 * dungeon's existing per-zone ages. Existing dungeon histories/rumors do not
 * shift.
 *
 * ARC (band ordering, oldest → newest — exact ages seeded within each band):
 *   fall (300-900) → migration (100-600) / schism (150-500) / crusade (150-450)
 *   → border war (200-800, but SNAPPED below the adopted zones) → adopted zones
 *   (the youngest, at their existing dungeon eras 40-600). Bands overlap by
 *   design; the final sort is by exact `yearsAgo`, so the emitted order is a
 *   coherent oldest-first read regardless of band overlap.
 *
 * Zero THREE imports; pure data.
 */
import { rootSeedPath, streamPath, childSeedPath, rngFromPath } from '../seedPath';
import { getBridgeAtlas, getBurgNamer } from '../bridge/legacySubmapBridge';

// ─── Public contract ─────────────────────────────────────────────────────────

/**
 * A world-chronicle entry kind. `war`/`plague`/`eruption` overlap the dungeon
 * `ChronicleKind` (adopted zones reuse them); the four new kinds are inferred
 * from present atlas structure.
 */
export type WorldEntryKind =
  | 'war'
  | 'schism'
  | 'crusade'
  | 'migration'
  | 'fall'
  | 'plague'
  | 'eruption';

/** Event-shaped ("burned IN the war") vs faction-shaped ("fell TO the Rebels"). */
export type WorldEntryShape = 'event' | 'faction';

/** The real present-day actors an entry involves (all optional; ids into pack). */
export interface WorldEntryActors {
  stateIds?: number[];
  religionIds?: number[];
  cultureIds?: number[];
  burgIds?: number[];
}

/**
 * One inferred (or adopted) episode of world history. `evidence` is a single
 * plain-English sentence naming the PRESENT fact this entry explains. `cells` is
 * where it happened (for proximity queries from a dungeon site).
 */
export interface ChronicleEntry {
  id: string;
  kind: WorldEntryKind;
  name: string;
  yearsAgo: number;
  shape: WorldEntryShape;
  actors: WorldEntryActors;
  evidence: string;
  cells: number[];
}

export interface WorldChronicle {
  entries: ChronicleEntry[];
}

// ─── Tuning ──────────────────────────────────────────────────────────────────

/** A land cell has height ≥ 20 in FMG's convention. */
const LAND_H = 20;

/** Cap on the whole chronicle — a handful of named ages, not an encyclopedia. */
const MAX_ENTRIES = 25;

/**
 * Minimum shared-border length (in cells) for a state pair to be war-eligible.
 * A one-cell touch is a corner, not a contested frontier.
 */
const MIN_BORDER_CELLS = 3;

/**
 * Fraction of eligible border-war pairs actually drawn (a MINORITY — not every
 * border implies a war; most frontiers were always peaceful). Selected by seeded
 * draw so which borders bled varies by world but is stable per seed.
 */
const BORDER_WAR_FRACTION = 0.35;

/** Per-source caps so one structural signal can't flood the chronicle. */
const MAX_BORDER_WARS = 8;
const MAX_SCHISMS = 4;
const MAX_CRUSADES = 3;
const MAX_MIGRATIONS = 4;
const MAX_FALLS = 6;

/** FMG marker types that imply a fallen predecessor polity. */
const FALL_MARKER_TYPES: ReadonlySet<string> = new Set([
  'necropolises',
  'disturbed-burials',
  'ruins',
]);

/** FMG zone `type` → adopted world-chronicle kind (mirrors dungeon chronicle). */
const ZONE_KIND: Readonly<Record<string, 'war' | 'plague' | 'eruption'>> = {
  Invasion: 'war',
  Rebels: 'war',
  Crusade: 'war',
  Disease: 'plague',
  Eruption: 'eruption',
};

/** Rebels-family zones name a GROUP → faction-shaped; everything else event. */
const ZONE_SHAPE: Readonly<Record<string, WorldEntryShape>> = {
  Rebels: 'faction',
};

/**
 * Seeded age band (years-ago, inclusive) per NEW inferred kind. Adopted zones do
 * NOT appear here — they keep their existing dungeon-derived ages. The bands are
 * ordered so falls are oldest and border wars youngest of the inferred set;
 * border wars are then additionally snapped BELOW the adopted zones (see below),
 * so the arc reads fall → migration/schism/crusade → border war → zone.
 */
const AGE_BANDS: Readonly<Record<Exclude<WorldEntryKind, 'war' | 'plague' | 'eruption'>, readonly [number, number]>> = {
  fall: [300, 900],
  migration: [100, 600],
  schism: [150, 500],
  crusade: [150, 450],
};

/** Border-war band (a `war` kind, so it isn't in AGE_BANDS above). */
const BORDER_WAR_BAND: readonly [number, number] = [200, 800];

// ─── Atlas access shims (exact FMG pack shapes; see recon) ───────────────────

interface CellsLike {
  h: ArrayLike<number>;
  p: ReadonlyArray<readonly [number, number]>;
  c: ReadonlyArray<ReadonlyArray<number>>;
  state?: ArrayLike<number>;
  culture?: ArrayLike<number>;
  religion?: ArrayLike<number>;
}

interface StateLike {
  i: number;
  name?: string;
  center?: number;
  culture?: number;
  neighbors?: number[];
  removed?: boolean;
}

interface CultureLike {
  i: number;
  name?: string;
  center?: number;
  removed?: boolean;
}

interface ReligionLike {
  i: number;
  name?: string;
  center?: number;
  removed?: boolean;
}

interface MarkerLike {
  i: number;
  type: string;
  cell: number;
}

// ─── Seeded age helpers ──────────────────────────────────────────────────────

/** The world-chronicle stream root for a seed. */
function chronicleRoot(worldSeed: number) {
  return streamPath(rootSeedPath(worldSeed), 'world-chronicle');
}

/**
 * A seeded age in a kind's band, keyed by a stable per-entry key on a per-pass
 * stream. Deterministic; nextInt is max-EXCLUSIVE so +1 to include `hi`.
 */
function seededAge(
  worldSeed: number,
  stream: string,
  key: string,
  band: readonly [number, number],
): number {
  const rng = rngFromPath(childSeedPath(streamPath(chronicleRoot(worldSeed), stream), key));
  const [lo, hi] = band;
  return rng.nextInt(lo, hi + 1);
}

/**
 * The ADOPTED zone age — reuses the DUNGEON chronicle's `s:chronicle` stream
 * verbatim (root → s:chronicle → z<zoneId>), so an adopted zone entry reports the
 * SAME `yearsAgo` the dungeon layer already gives it. This is the byte-compat
 * anchor: the world chronicle does not re-date zones, it adopts their dates.
 */
function adoptedZoneAge(worldSeed: number, zoneId: number, kind: 'war' | 'plague' | 'eruption'): number {
  const chroniclePath = streamPath(rootSeedPath(worldSeed), 'chronicle');
  const rng = rngFromPath(childSeedPath(chroniclePath, `z${zoneId}`));
  // Mirror dungeon AGE_BANDS exactly (chronicle.ts): war[60,400] plague[40,260]
  // eruption[150,600]. Kept in sync here (not imported) to avoid a dungeon dep.
  const band: readonly [number, number] =
    kind === 'war' ? [60, 400] : kind === 'plague' ? [40, 260] : [150, 600];
  const [lo, hi] = band;
  return rng.nextInt(lo, hi + 1);
}

// ─── Name forming (from REAL atlas names — no rng-drawing FMG helpers) ────────
//
// We never call getAdjective (it draws on FMG's own stream) or otherwise perturb
// the atlas. Names come from real state/culture/religion `name` fields, joined
// by a laconic template. A short stem is derived arithmetically for the "Marches"
// variant. getBurgNamer IS sanctioned (it takes our own seeded rng), used only
// for fall-entry predecessor names.

/** First word of a name, trimmed of a trailing vowel run, for a compact stem. */
function stemOf(name: string): string {
  const first = (name.split(/\s+/)[0] || name).replace(/[^A-Za-z]/g, '');
  let s = first;
  while (s.length > 4 && /[aeiouy]$/i.test(s)) s = s.slice(0, -1);
  return s || first || 'the old realm';
}

/** US-plain capitalize first letter. */
function cap(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

// ─── Graph / geometry helpers ────────────────────────────────────────────────

/** Cell → state id, or -1. */
function cellState(cells: CellsLike, cellId: number): number {
  return cells.state ? (cells.state[cellId] ?? -1) : -1;
}

/**
 * Cells that form the shared frontier of two states: land cells of state A whose
 * graph neighbor is a land cell of state B (a sample, sorted by cellId). Used
 * both to measure border length and to place a war's cells.
 */
function borderCells(cells: CellsLike, a: number, b: number): number[] {
  const out: number[] = [];
  const n = cells.h.length;
  for (let cid = 0; cid < n; cid++) {
    if ((cells.h[cid] ?? 0) < LAND_H) continue;
    if (cellState(cells, cid) !== a) continue;
    const nbrs = cells.c[cid];
    if (!nbrs) continue;
    for (const j of nbrs) {
      if (cellState(cells, j) === b) {
        out.push(cid);
        break;
      }
    }
  }
  return out;
}

/** Distinct land-state ids that a religion/culture's cells fall in. */
function statesSpanned(cells: CellsLike, field: ArrayLike<number> | undefined, id: number): Set<number> {
  const states = new Set<number>();
  if (!field) return states;
  const n = Math.min(field.length, cells.h.length);
  for (let cid = 0; cid < n; cid++) {
    if (field[cid] !== id) continue;
    if ((cells.h[cid] ?? 0) < LAND_H) continue;
    const s = cellState(cells, cid);
    if (s > 0) states.add(s);
  }
  return states;
}

/** All land cells assigned to a given field id (culture/religion). */
function cellsOfField(cells: CellsLike, field: ArrayLike<number> | undefined, id: number, limit: number): number[] {
  const out: number[] = [];
  if (!field) return out;
  const n = Math.min(field.length, cells.h.length);
  for (let cid = 0; cid < n; cid++) {
    if (field[cid] !== id) continue;
    if ((cells.h[cid] ?? 0) < LAND_H) continue;
    out.push(cid);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * True when a field's (culture's) cells split into ≥2 disconnected land
 * components over the cell graph — a signal of a migration/diaspora (the same
 * people on both sides of a gap). Bounded BFS over the field's own cells.
 */
function fieldIsDisjoint(cells: CellsLike, field: ArrayLike<number> | undefined, id: number): boolean {
  if (!field) return false;
  const own = new Set<number>();
  const n = Math.min(field.length, cells.h.length);
  for (let cid = 0; cid < n; cid++) {
    if (field[cid] === id && (cells.h[cid] ?? 0) >= LAND_H) own.add(cid);
  }
  if (own.size < 2) return false;
  const seen = new Set<number>();
  const first = own.values().next().value as number;
  const q = [first];
  seen.add(first);
  for (let h = 0; h < q.length; h++) {
    const cur = q[h];
    const nbrs = cells.c[cur];
    if (!nbrs) continue;
    for (const j of nbrs) {
      if (own.has(j) && !seen.has(j)) {
        seen.add(j);
        q.push(j);
      }
    }
  }
  return seen.size < own.size; // some own-cell unreachable → ≥2 components
}

/** A small deterministic sample (first `k` by cellId order) of a cell list. */
function sample(cellsList: number[], k: number): number[] {
  return cellsList.slice(0, Math.max(1, k));
}

/** Nearest live burg id to a cell (euclidean on cell centers). */
function nearestBurgId(cells: CellsLike, burgs: BurgLike[], cellId: number): number | undefined {
  const origin = cells.p[cellId];
  if (!origin) return undefined;
  let best: number | undefined;
  let bestD = Infinity;
  for (let i = 0; i < burgs.length; i++) {
    const b = burgs[i];
    if (!b || b.i === 0 || b.removed || typeof b.cell !== 'number') continue;
    const site = cells.p[b.cell];
    if (!site) continue;
    const dx = site[0] - origin[0];
    const dy = site[1] - origin[1];
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = typeof b.i === 'number' ? b.i : i;
    }
  }
  return best;
}

interface BurgLike {
  i?: number;
  cell?: number;
  removed?: boolean;
}

// ─── Inference passes ────────────────────────────────────────────────────────

interface PassCtx {
  worldSeed: number;
  cells: CellsLike;
  states: StateLike[];
  cultures: CultureLike[];
  religions: ReligionLike[];
  burgs: BurgLike[];
  markers: MarkerLike[];
  zones: ZoneLike[];
}

interface ZoneLike {
  i: number;
  type?: string;
  name?: string;
  cells?: number[];
}

/** Live (non-placeholder, non-removed) state pairs and their shared borders. */
function adjacentStatePairs(ctx: PassCtx): Array<{ a: StateLike; b: StateLike; cells: number[] }> {
  const { states, cells } = ctx;
  const byId = new Map<number, StateLike>();
  for (const s of states) if (s && s.i > 0 && !s.removed) byId.set(s.i, s);
  const out: Array<{ a: StateLike; b: StateLike; cells: number[] }> = [];
  const seen = new Set<string>();
  for (const s of byId.values()) {
    for (const nId of s.neighbors ?? []) {
      if (nId <= 0 || nId === s.i) continue;
      const n = byId.get(nId);
      if (!n) continue;
      const lo = Math.min(s.i, nId);
      const hi = Math.max(s.i, nId);
      const key = `${lo}-${hi}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const a = byId.get(lo)!;
      const b = byId.get(hi)!;
      const border = borderCells(cells, a.i, b.i);
      if (border.length < MIN_BORDER_CELLS) continue;
      out.push({ a, b, cells: border });
    }
  }
  // Stable order: by state id pair.
  out.sort((x, y) => x.a.i - y.a.i || x.b.i - y.b.i);
  return out;
}

/**
 * PASS 2 — BORDER WARS. A minority of adjacent state pairs (seeded draw) each get
 * a past war that "drew" their present frontier. Named from the real state names
 * ("the Onerea–Damunvil War") or a namer-free "War of the <stem> Marches".
 */
function inferBorderWars(ctx: PassCtx): ChronicleEntry[] {
  const pairs = adjacentStatePairs(ctx);
  if (pairs.length === 0) return [];
  const rng = rngFromPath(streamPath(chronicleRoot(ctx.worldSeed), 'border-wars'));
  const entries: ChronicleEntry[] = [];
  for (const { a, b, cells } of pairs) {
    if (entries.length >= MAX_BORDER_WARS) break;
    if (rng.next() >= BORDER_WAR_FRACTION) continue; // most borders stayed peaceful
    const aName = a.name || `State ${a.i}`;
    const bName = b.name || `State ${b.i}`;
    // Two name shapes, chosen seedlessly by the pair so the same border always
    // reads the same way: a direct "<A>–<B> War", or a "War of the <A>–<B>
    // Marches". Both carry BOTH state stems so no two border wars collide on name.
    const useMarches = (a.i + b.i) % 2 === 0;
    const name = useMarches
      ? `the War of the ${cap(stemOf(aName))}–${cap(stemOf(bName))} Marches`
      : `the ${aName}–${bName} War`;
    const id = `war:${a.i}-${b.i}`;
    entries.push({
      id,
      kind: 'war',
      name,
      yearsAgo: seededAge(ctx.worldSeed, 'border-wars', id, BORDER_WAR_BAND),
      shape: 'event',
      actors: { stateIds: [a.i, b.i] },
      evidence: `the border between ${aName} and ${bName} runs along contested ground`,
      cells: sample(cells, 6),
    });
  }
  return entries;
}

/**
 * PASS 3a — SCHISMS. A religion whose cells span ≥2 states implies a past schism
 * (one faith, split polities). Seeded selection + cap. Event-shaped.
 */
function inferSchisms(ctx: PassCtx): ChronicleEntry[] {
  const { religions, cells } = ctx;
  const rng = rngFromPath(streamPath(chronicleRoot(ctx.worldSeed), 'schisms'));
  const candidates: Array<{ r: ReligionLike; states: number[] }> = [];
  for (const r of religions) {
    if (!r || r.i <= 0 || r.removed) continue;
    const spanned = statesSpanned(cells, cells.religion, r.i);
    if (spanned.size >= 2) candidates.push({ r, states: [...spanned].sort((x, y) => x - y) });
  }
  candidates.sort((x, y) => x.r.i - y.r.i);
  const entries: ChronicleEntry[] = [];
  for (const { r, states } of candidates) {
    if (entries.length >= MAX_SCHISMS) break;
    if (rng.next() >= 0.6) continue; // not every cross-border faith actually split
    const rName = r.name || `Religion ${r.i}`;
    const id = `schism:${r.i}`;
    entries.push({
      id,
      kind: 'schism',
      name: `the ${rName} Schism`,
      yearsAgo: seededAge(ctx.worldSeed, 'schisms', id, AGE_BANDS.schism),
      shape: 'event',
      actors: { religionIds: [r.i], stateIds: states },
      evidence: `${rName} is held across ${states.length} separate realms`,
      cells: sample(cellsOfField(cells, cells.religion, r.i, 6), 6),
    });
  }
  return entries;
}

/**
 * PASS 3b — CRUSADES. Where two religions border each other (adjacent land cells
 * of different religion), a past crusade may explain the fault line. Seeded
 * selection + cap. Event-shaped.
 */
function inferCrusades(ctx: PassCtx): ChronicleEntry[] {
  const { religions, cells } = ctx;
  if (!cells.religion) return [];
  const byId = new Map<number, ReligionLike>();
  for (const r of religions) if (r && r.i > 0 && !r.removed) byId.set(r.i, r);
  // Find bordering religion pairs and a sample cell for each.
  const pairCells = new Map<string, number>();
  const n = cells.h.length;
  for (let cid = 0; cid < n; cid++) {
    if ((cells.h[cid] ?? 0) < LAND_H) continue;
    const ri = cells.religion[cid] ?? 0;
    if (ri <= 0) continue;
    const nbrs = cells.c[cid];
    if (!nbrs) continue;
    for (const j of nbrs) {
      const rj = cells.religion[j] ?? 0;
      if (rj <= 0 || rj === ri) continue;
      const lo = Math.min(ri, rj);
      const hi = Math.max(ri, rj);
      const key = `${lo}-${hi}`;
      if (!pairCells.has(key)) pairCells.set(key, cid);
    }
  }
  const keys = [...pairCells.keys()].sort();
  const rng = rngFromPath(streamPath(chronicleRoot(ctx.worldSeed), 'crusades'));
  const entries: ChronicleEntry[] = [];
  for (const key of keys) {
    if (entries.length >= MAX_CRUSADES) break;
    if (rng.next() >= 0.4) continue; // crusades are rarer than mere adjacency
    const [lo, hi] = key.split('-').map(Number);
    const ra = byId.get(lo);
    const rb = byId.get(hi);
    if (!ra || !rb) continue;
    const cell = pairCells.get(key)!;
    const aName = ra.name || `Religion ${lo}`;
    const bName = rb.name || `Religion ${hi}`;
    const id = `crusade:${lo}-${hi}`;
    entries.push({
      id,
      kind: 'crusade',
      name: `the ${cap(stemOf(aName))} Crusade`,
      yearsAgo: seededAge(ctx.worldSeed, 'crusades', id, AGE_BANDS.crusade),
      shape: 'event',
      actors: { religionIds: [lo, hi] },
      evidence: `the faiths of ${aName} and ${bName} meet along a hard line`,
      cells: [cell],
    });
  }
  return entries;
}

/**
 * PASS 4 — MIGRATIONS. A culture whose land cells split into disjoint regions,
 * OR that overlaps another culture's home state, implies a past crossing. Seeded
 * selection + cap. Event-shaped ("the <Culture> Crossing").
 */
function inferMigrations(ctx: PassCtx): ChronicleEntry[] {
  const { cultures, cells } = ctx;
  if (!cells.culture) return [];
  const rng = rngFromPath(streamPath(chronicleRoot(ctx.worldSeed), 'migrations'));
  const entries: ChronicleEntry[] = [];
  const ordered = [...cultures].filter((c) => c && c.i > 0 && !c.removed).sort((x, y) => x.i - y.i);
  for (const c of ordered) {
    if (entries.length >= MAX_MIGRATIONS) break;
    const disjoint = fieldIsDisjoint(cells, cells.culture, c.i);
    const spannedStates = statesSpanned(cells, cells.culture, c.i);
    // Signal: the culture is split across a gap, or spread over ≥3 realms
    // (spilling well past a single home state — a diaspora).
    const overlaps = spannedStates.size >= 3;
    if (!disjoint && !overlaps) continue;
    if (rng.next() >= 0.5) continue;
    const cName = c.name || `Culture ${c.i}`;
    const id = `migration:${c.i}`;
    const evidence = disjoint
      ? `the ${cName} people hold lands split apart by others`
      : `the ${cName} people are spread across ${spannedStates.size} realms`;
    entries.push({
      id,
      kind: 'migration',
      name: `the ${cap(stemOf(cName))} Crossing`,
      yearsAgo: seededAge(ctx.worldSeed, 'migrations', id, AGE_BANDS.migration),
      shape: 'event',
      actors: { cultureIds: [c.i], stateIds: [...spannedStates].sort((x, y) => x - y) },
      evidence,
      cells: sample(cellsOfField(cells, cells.culture, c.i, 6), 6),
    });
  }
  return entries;
}

/**
 * PASS 5 — FALLS. Necropolis / disturbed-burial / ruins markers imply a fallen
 * predecessor polity that built them. The predecessor is named via the nearest
 * burg's CULTURE namer ("the fall of Old <stem>"), so the dead realm reads as
 * kin to today's locals. `getBurgNamer` takes our own seeded rng — no atlas
 * perturbation. Seeded age + cap.
 */
function inferFalls(ctx: PassCtx): ChronicleEntry[] {
  const { markers, cells, burgs, worldSeed } = ctx;
  const fallMarkers = markers
    .filter((m) => m && typeof m.cell === 'number' && FALL_MARKER_TYPES.has(m.type))
    .filter((m) => (cells.h[m.cell] ?? 0) >= LAND_H)
    .sort((a, b) => a.i - b.i);
  const entries: ChronicleEntry[] = [];
  for (const m of fallMarkers) {
    if (entries.length >= MAX_FALLS) break;
    const burgId = nearestBurgId(cells, burgs, m.cell);
    let stem: string;
    if (burgId != null) {
      // Own seeded rng into the culture namer — deterministic, no Math.random leak
      // beyond the namer's internal swap-and-restore.
      const rng = rngFromPath(childSeedPath(streamPath(chronicleRoot(worldSeed), 'falls'), `m${m.i}`));
      try {
        stem = stemOf(getBurgNamer(worldSeed, burgId)({ next: () => rng.next() }));
      } catch {
        stem = 'Kobern';
      }
    } else {
      stem = 'Kobern';
    }
    const id = `fall:${m.i}`;
    const markerNoun =
      m.type === 'necropolises' ? 'necropolis' : m.type === 'ruins' ? 'ruins' : 'burial ground';
    entries.push({
      id,
      kind: 'fall',
      name: `the fall of Old ${cap(stem)}`,
      yearsAgo: seededAge(worldSeed, 'falls', id, AGE_BANDS.fall),
      shape: 'event',
      actors: burgId != null ? { burgIds: [burgId] } : {},
      evidence: `the ${markerNoun} left standing with no realm to claim it`,
      cells: [m.cell],
    });
  }
  return entries;
}

/**
 * PASS 1 — ADOPT the atlas event zones (the same zones the dungeon chronicle
 * cites) as war/plague/eruption entries AT THEIR EXISTING dungeon eras. This is
 * the byte-compat anchor: the world chronicle does not re-date zones.
 */
function adoptZones(ctx: PassCtx): ChronicleEntry[] {
  const zones = ctx.zones.filter((z) => z && Array.isArray(z.cells) && ZONE_KIND[z.type ?? '']);
  zones.sort((a, b) => a.i - b.i);
  const entries: ChronicleEntry[] = [];
  for (const z of zones) {
    const kind = ZONE_KIND[z.type ?? '']!;
    const id = `zone:${z.i}`;
    entries.push({
      id,
      kind,
      name: z.name ?? '',
      yearsAgo: adoptedZoneAge(ctx.worldSeed, z.i, kind),
      shape: ZONE_SHAPE[z.type ?? ''] ?? 'event',
      actors: {},
      evidence: `the atlas still marks the ${z.name || 'scarred ground'} on the land`,
      cells: sample(z.cells ?? [], 6),
    });
  }
  return entries;
}

// ─── Assembly + ordering ─────────────────────────────────────────────────────

/**
 * Snap border-war ages so they sit strictly OLDER than the oldest adopted zone —
 * enforcing the arc "border wars precede the youngest zones". If there are no
 * adopted zones, border wars keep their band ages. Deterministic; no draws.
 */
function orderArc(all: ChronicleEntry[]): ChronicleEntry[] {
  const zones = all.filter((e) => e.id.startsWith('zone:'));
  const oldestZone = zones.reduce((m, e) => Math.max(m, e.yearsAgo), -Infinity);
  if (Number.isFinite(oldestZone)) {
    for (const e of all) {
      if (e.kind === 'war' && e.id.startsWith('war:') && e.yearsAgo <= oldestZone) {
        // Push the border war just older than the oldest zone (preserves "wars
        // drew the borders that the zones then scarred").
        e.yearsAgo = oldestZone + 1 + (e.yearsAgo % 50);
      }
    }
  }
  // Final sort oldest → newest; ties broken by id for stability.
  return [...all].sort((a, b) => b.yearsAgo - a.yearsAgo || (a.id < b.id ? -1 : 1));
}

const chronicleCache = new Map<number, WorldChronicle>();

/**
 * Build the reverse-generational world chronicle for a seed (cached). Runs each
 * inference pass on its own stream, adopts the atlas zones at their existing
 * eras, caps to a chronicle-sized set, and orders the whole into a coherent
 * oldest-first arc.
 */
export function worldChronicleFor(worldSeed: number): WorldChronicle {
  const key = worldSeed >>> 0;
  const cached = chronicleCache.get(key);
  if (cached) return { entries: cached.entries.map((e) => ({ ...e, cells: [...e.cells], actors: { ...e.actors } })) };

  const atlas = getBridgeAtlas(worldSeed);
  const ctx: PassCtx = {
    worldSeed,
    cells: atlas.pack.cells as unknown as CellsLike,
    states: (atlas.pack.states ?? []) as StateLike[],
    cultures: (atlas.pack.cultures ?? []) as CultureLike[],
    religions: (atlas.pack.religions ?? []) as ReligionLike[],
    burgs: (atlas.pack.burgs ?? []) as BurgLike[],
    markers: (atlas.markers ?? []) as MarkerLike[],
    zones: ((atlas.pack as { zones?: ZoneLike[] }).zones ?? []) as ZoneLike[],
  };

  // Passes in oldest-arc order (their bands overlap; the final sort is exact).
  const falls = inferFalls(ctx);
  const migrations = inferMigrations(ctx);
  const schisms = inferSchisms(ctx);
  const crusades = inferCrusades(ctx);
  const borderWars = inferBorderWars(ctx);
  const zones = adoptZones(ctx);

  // Cap PER-SOURCE already applied; now cap the WHOLE to a chronicle-sized set.
  // Keep the structural inferences and adopted zones; if over budget, trim the
  // youngest border wars first (they are the most numerous, least load-bearing).
  let all = [...falls, ...migrations, ...schisms, ...crusades, ...borderWars, ...zones];
  if (all.length > MAX_ENTRIES) {
    // Drop excess border wars (by oldest-first id order) until within budget.
    const overflow = all.length - MAX_ENTRIES;
    let dropped = 0;
    const keep: ChronicleEntry[] = [];
    // Iterate border wars last-added first for a stable trim.
    const bwIds = new Set(borderWars.map((e) => e.id));
    for (let i = all.length - 1; i >= 0; i--) {
      const e = all[i];
      if (dropped < overflow && bwIds.has(e.id)) {
        dropped++;
        continue;
      }
      keep.push(e);
    }
    keep.reverse();
    all = keep;
    // If still over (few border wars), hard-cap by taking the oldest MAX_ENTRIES.
    if (all.length > MAX_ENTRIES) {
      all = [...all].sort((a, b) => b.yearsAgo - a.yearsAgo).slice(0, MAX_ENTRIES);
    }
  }

  const entries = orderArc(all);
  const result: WorldChronicle = { entries };
  chronicleCache.set(key, result);
  return { entries: entries.map((e) => ({ ...e, cells: [...e.cells], actors: { ...e.actors } })) };
}

// ─── Human-readable proof ────────────────────────────────────────────────────

/** "~490 years ago — the fall of Old Kobern. (explains: …)" one line per entry. */
export function renderChronicle(worldSeed: number): string {
  const { entries } = worldChronicleFor(worldSeed);
  if (entries.length === 0) return `(world ${worldSeed}: no chronicle entries)`;
  return entries
    .map((e) => `~${e.yearsAgo} years ago — ${e.name}. (explains: ${e.evidence})`)
    .join('\n');
}

/** Test-only: clear the per-seed cache (never called in production). */
export function __clearWorldChronicleCache(): void {
  chronicleCache.clear();
}

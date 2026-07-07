/**
 * @file simulateHistory.ts
 * @description The seeded decay-event engine — Task 4 of the history-first
 * dungeon generator (spec docs/superpowers/specs/2026-07-05-procedural-dungeon-
 * generator.md). Pure data, zero THREE imports, deterministic from a `SeedPath`.
 *
 * A dungeon is generated INTACT by `buildIntact` (Task 3): a purpose-built tree
 * of rooms and corridors, the entrance at graph degree 1. `simulateHistory`
 * then simulates centuries of events ON that structure — seals, collapses,
 * floods, tunnels dug by grave robbers, monsters denning in the deep — and the
 * playable ruin is the OUTPUT of that history. Every event leaves visible,
 * causal evidence: a rubble-choked passage, a flooded gallery, a back way dug
 * in, a nest in the boss room.
 *
 * DETERMINISM CONTRACT: one rng stream, drawn strictly in sequence. The FULL
 * canonical event log — kinds, dates, and evidence-less EXCLUSIONS — is decided
 * identically regardless of `asOfYearsAgo`, because every include/exclude choice
 * is STRUCTURAL (does a loop edge exist to collapse? a floodable room to drown?)
 * and structure is seed-fixed.
 *
 * PREFIX REPLAY (`asOfYearsAgo`): a map bought in town shows the dungeon as it
 * WAS at the year the map was drawn — events YOUNGER than the cutoff had not yet
 * happened, so NONE of their effects (structural OR surface) may appear. We honor
 * that with a snapshot-and-replay: the full chain is rolled and applied ONCE to
 * produce the canonical log (identical for every cutoff, since only this pass
 * draws rng and it draws identically). During that canonical pass every concrete
 * mutation each event makes — cells written, edges added/removed, overlay stamps,
 * door states, evidence props, occupations, plunders, tunnel bookkeeping — is
 * RECORDED as a replayable delta. When `asOfYearsAgo > 0` we restore the
 * pre-simulation snapshot and re-apply ONLY the recorded deltas of the events
 * with `yearsAgo >= asOfYearsAgo` (a strict PREFIX, since events are in
 * chronological oldest-first order). Replay consumes ZERO rng and re-runs no
 * appliers, so the cutoff state is exact by construction. The full log is still
 * returned in `events` (callers see all of history; only the map STATE is the
 * cutoff state).
 *
 * EVIDENCE RULE (no-fallback directive): an event that cannot leave real evidence
 * is never logged — the applier returns null and the roller re-rolls a
 * replacement kind or drops the slot. The one kept "failure" is the failed
 * tunnel: it scars a wall (real evidence), so it stays, flagged `failed`.
 *
 * SAFETY INVARIANTS this module protects (asserted, not merely hoped):
 *  - Every Floor cell stays reachable from the entrance (collapse only cuts
 *    connectivity-safe corridor cells; a final flood-fill assertion throws if a
 *    rule bug ever strands floor — honest failure over a shipped-broken map).
 *  - The entrance keeps graph degree 1 (tunnels/dens never touch it).
 *  - The apex occupant sits deep and not adjacent to the entrance.
 */

import {
  CellKind,
  OverlayKind,
  type BuilderArchetype,
  type ChronicleKind,
  type ChronicleRef,
  type DoorState,
  type DungeonEdge,
  type DungeonEvent,
  type DungeonTheme,
  type EventKind,
} from './types';
import { ARCHETYPES } from './archetypes';
import { gi, roomCx, roomCy, type IntactState, type Rng, type Room } from './buildIntact';

// ─── Public result ───────────────────────────────────────────────────────────

export interface HistoryResult {
  /** Full log, oldest first; `id` equals the array index. */
  events: DungeonEvent[];
  /** side*side working-grid overlay (OverlayKind per cell), cropped later. */
  overlay: Uint8Array;
  /** Working-grid door cell → state (bricked/secret) with its causing event. */
  doorStates: Map<number, { state: DoorState; eventRef: number }>;
  /** Debris/décor the events left behind, keyed to the event and its room. */
  evidenceProps: Array<{ kind: string; cell: number; eventRef: number; roomId: number }>;
  /** Who occupies which rooms; the last occupying event is the apex (boss). */
  occupations: Array<{ roomIds: number[]; actorKey: string; eventRef: number; isApex: boolean }>;
  /** Rooms whose vault an event cracked (loot systems read this later). */
  plunderedRoomIds: Set<number>;
}

// ─── Theme actor vocabulary ──────────────────────────────────────────────────
//
// Descriptive faction/monster-family strings (Task 6 maps them to CR tiers).
// Kept HERE rather than imported from generateDungeon.ts to avoid a later
// import cycle. Three registers per theme: a mid-tier denning family (`den`),
// an undead tier (`awaken`), and a squatting faction (`reoccupy`). `bloom`
// always dens `myconid_ring`.

interface ActorVocab {
  den: string;
  undead: string;
  faction: string;
}

const ACTORS: Record<DungeonTheme, ActorVocab> = {
  crypt: { den: 'ghoul_pack', undead: 'restless_dead', faction: 'grave_cult' },
  cavern: { den: 'giant_spider_brood', undead: 'crawling_dead', faction: 'goblin_smugglers' },
  frost: { den: 'winter_wolf_pack', undead: 'frozen_dead', faction: 'ice_reavers' },
  sewer: { den: 'carrion_crawler_nest', undead: 'drowned_dead', faction: 'thieves_guild' },
  fungal: { den: 'myconid_ring', undead: 'sporebound_dead', faction: 'spore_cult' },
};

// ─── Graph helpers ───────────────────────────────────────────────────────────

/** Adjacency list over an edge set (undirected). */
function buildAdjacency(nRooms: number, edges: readonly DungeonEdge[]): number[][] {
  const adj: number[][] = Array.from({ length: nRooms }, () => []);
  for (const e of edges) {
    adj[e.a].push(e.b);
    adj[e.b].push(e.a);
  }
  return adj;
}

/** BFS graph depth (in rooms) from `start`; unreachable rooms stay Infinity. */
function graphDepths(nRooms: number, start: number, adj: number[][]): number[] {
  const depth = new Array<number>(nRooms).fill(Infinity);
  depth[start] = 0;
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    for (const n of adj[c]) {
      if (depth[n] === Infinity) {
        depth[n] = depth[c] + 1;
        q.push(n);
      }
    }
  }
  return depth;
}

/** True when the room graph over `edges` connects every room to `start`. */
function graphConnected(nRooms: number, start: number, edges: readonly DungeonEdge[]): boolean {
  const depth = graphDepths(nRooms, start, buildAdjacency(nRooms, edges));
  for (let i = 0; i < nRooms; i++) if (depth[i] === Infinity) return false;
  return true;
}

/** Rooms directly adjacent to the entrance (degree-1 protection helpers use it). */
function neighborsOf(room: number, adj: number[][]): Set<number> {
  return new Set(adj[room]);
}

// ─── Working simulation context ──────────────────────────────────────────────

interface SimCtx {
  st: IntactState;
  rng: Rng;
  theme: DungeonTheme;
  archetype: BuilderArchetype;
  actors: ActorVocab;
  overlay: Uint8Array;
  doorStates: Map<number, { state: DoorState; eventRef: number }>;
  evidenceProps: Array<{ kind: string; cell: number; eventRef: number; roomId: number }>;
  occupations: Array<{ roomIds: number[]; actorKey: string; eventRef: number; isApex: boolean }>;
  plunderedRoomIds: Set<number>;
  /** Loop edges the tunnel applier dug, with the corridor cells it carved. */
  tunnels: Array<{ edge: DungeonEdge; cells: number[] }>;
  /** BUILT loop edges (from buildIntact) with their corridor cells, discovered
   * ONCE at sim start. collapse/brick-off may target these too — an intact one is
   * a connectivity-safe cycle edge to bring down / wall up. Lazily filled. */
  builtLoops: Array<{ edge: DungeonEdge; cells: number[] }> | null;
  builderName: string;
  structureNoun: string;
  /** Redo-thunks recorded for the event currently being applied (canonical pass).
   * Replaying an event = running these in order against a restored snapshot. */
  rec: Array<() => void>;
  /** Lazily-built roomId → its floor-cell indices, filled by ONE full grid scan.
   * A room's own floor cells never change owner during the sim (collapse/brick-off
   * only rewrite corridor cells), so this cache is safe to reuse across appliers
   * and replaces the per-call O(side²) `roomCells` scans that dominated the sim. */
  roomCellCache: Map<number, number[]> | null;
}

// ─── Mutation recording (prefix-replay substrate) ────────────────────────────
//
// Every applier routes its concrete state changes through these helpers instead
// of touching `ctx.st`/`ctx` collections directly. Each helper does the mutation
// AND pushes an identical redo-thunk onto `ctx.rec`, so the exact same change can
// be re-applied later against a restored snapshot with no rng and no re-decision.
// The recorded values are literal (cell indices, kinds, edge objects) — replay is
// a byte-for-byte re-do of the canonical pass's prefix.

/** Write a grid/corridor/roomOf cell to concrete values, recording the write. */
function recWriteCell(
  ctx: SimCtx,
  cell: number,
  grid: CellKind,
  corridor: number,
  roomOf: number,
): void {
  const st = ctx.st;
  const op = () => {
    st.grid[cell] = grid;
    st.corridor[cell] = corridor;
    st.roomOf[cell] = roomOf;
  };
  op();
  ctx.rec.push(op);
}

/** Stamp an overlay cell, recording it. */
function recOverlay(ctx: SimCtx, cell: number, kind: OverlayKind): void {
  const op = () => { ctx.overlay[cell] = kind; };
  op();
  ctx.rec.push(op);
}

/** Set a door state, recording it. */
function recDoorState(ctx: SimCtx, cell: number, state: DoorState, eventRef: number): void {
  const op = () => { ctx.doorStates.set(cell, { state, eventRef }); };
  op();
  ctx.rec.push(op);
}

/** Push an evidence prop, recording it. */
function recProp(
  ctx: SimCtx,
  prop: { kind: string; cell: number; eventRef: number; roomId: number },
): void {
  const op = () => { ctx.evidenceProps.push(prop); };
  op();
  ctx.rec.push(op);
}

/** Push an occupation row, recording it. */
function recOccupation(
  ctx: SimCtx,
  occ: { roomIds: number[]; actorKey: string; eventRef: number; isApex: boolean },
): void {
  const op = () => { ctx.occupations.push(occ); };
  op();
  ctx.rec.push(op);
}

/** Mark a room plundered, recording it. */
function recPlunder(ctx: SimCtx, roomId: number): void {
  const op = () => { ctx.plunderedRoomIds.add(roomId); };
  op();
  ctx.rec.push(op);
}

/** Add a loop edge to the graph, recording it. */
function recAddEdge(ctx: SimCtx, edge: DungeonEdge): void {
  const st = ctx.st;
  const op = () => { st.edges.push(edge); };
  op();
  ctx.rec.push(op);
}

/** Remove a specific edge object from the graph, recording it. Replay removes the
 * SAME edge object identity (edges added in this run are re-pushed on replay, so
 * identity holds; built-in edges persist through the snapshot restore). */
function recRemoveEdge(ctx: SimCtx, edge: DungeonEdge): void {
  const st = ctx.st;
  const op = () => {
    const ix = st.edges.indexOf(edge);
    if (ix >= 0) st.edges.splice(ix, 1);
  };
  op();
  ctx.rec.push(op);
}

/**
 * All floor cells that belong to each room's footprint, indexed by roomId, built
 * from ONE full grid scan and cached on `ctx`. Replaces the former per-call
 * O(side²) scan (once per applier room), the single biggest sim cost on the large
 * mausoleum grid. Room floor cells never change owner during the sim, so the cache
 * stays valid; corridor cells (roomOf -2) are intentionally excluded.
 */
function roomCellsCached(ctx: SimCtx, roomId: number): number[] {
  let cache = ctx.roomCellCache;
  if (!cache) {
    cache = new Map<number, number[]>();
    const roomOf = ctx.st.roomOf;
    for (let i = 0; i < roomOf.length; i++) {
      const rid = roomOf[i];
      if (rid < 0) continue; // void (-1) or corridor (-2)
      let arr = cache.get(rid);
      if (!arr) { arr = []; cache.set(rid, arr); }
      arr.push(i);
    }
    ctx.roomCellCache = cache;
  }
  return cache.get(roomId) ?? [];
}

/** A representative interior cell (room center, walked in to a real floor cell). */
function roomCenterCell(ctx: SimCtx, r: Room): number {
  const st = ctx.st;
  const cx = roomCx(r);
  const cy = roomCy(r);
  const k = gi(cx, cy, st.side);
  if (st.roomOf[k] === r.id) return k;
  // Center can fall on a mask hole (octagon/ellipse); scan for any floor cell.
  const cells = roomCellsCached(ctx, r.id);
  return cells.length > 0 ? cells[0] : k;
}

// ─── Chain rolling ───────────────────────────────────────────────────────────

const OCCUPYING: ReadonlySet<EventKind> = new Set<EventKind>(['den', 'awaken', 'reoccupy', 'bloom']);

/**
 * Weighted kind pick honoring the hard eligibility rules given the plan so far.
 * Consumes exactly ONE rng draw whether or not the pick lands on an eligible
 * kind — ineligible kinds are removed from the weighted pool BEFORE the draw so
 * the draw count is stable regardless of which kinds are currently eligible
 * (eligibility itself is seed-determined via the prior picks).
 */
function pickKind(
  ctx: SimCtx,
  weights: Readonly<Partial<Record<EventKind, number>>>,
  soFar: EventKind[],
): EventKind | null {
  const hasPlunder = soFar.includes('plunder');
  const hasTunnel = soFar.includes('tunnel');
  const hasSeal = soFar.includes('seal');
  // A cycle now ALWAYS exists from the start — the intact builder opens BUILT
  // loop cross-cuts (DEFECT A). So collapse/brick-off are eligible even before
  // any robber tunnel: they may bring down / wall up a built cross-cut, which is
  // connectivity-safe on any cycle edge. This makes those events more common and
  // more interesting. The application-time safety checks (connectivity, an intact
  // loop corridor to target) still guard the appliers.

  const pool: Array<{ kind: EventKind; w: number }> = [];
  for (const [k, w] of Object.entries(weights) as Array<[EventKind, number]>) {
    if (!w) continue;
    if (k === 'seal' && hasSeal) continue; // no duplicate seal
    if (k === 'awaken' && !hasPlunder && !hasTunnel) continue; // desecration first
    if (k === 'reoccupy' && !hasTunnel) continue; // needs a way in
    // collapse/brick-off: no chain precondition — a built cycle always exists.
    pool.push({ kind: k, w });
  }
  if (pool.length === 0) return null;
  const total = pool.reduce((s, p) => s + p.w, 0);
  let r = ctx.rng.float(0, total);
  for (const p of pool) {
    r -= p.w;
    if (r < 0) return p.kind;
  }
  return pool[pool.length - 1].kind;
}

/** The archetype's highest-weight occupying kind (the forced-occupation slot). */
function bestOccupyingKind(
  weights: Readonly<Partial<Record<EventKind, number>>>,
): EventKind {
  let best: EventKind = 'den';
  let bestW = -1;
  for (const [k, w] of Object.entries(weights) as Array<[EventKind, number]>) {
    if (!w) continue;
    if (!OCCUPYING.has(k)) continue;
    if (w > bestW) {
      bestW = w;
      best = k;
    }
  }
  return best;
}

/**
 * Deterministic replacement pick for a slot whose rolled kind left no evidence.
 * Same weighted machinery as `pickKind` (honoring eligibility against the kinds
 * KEPT so far), minus any kinds already tried for this slot. Consumes one rng
 * draw, like `pickKind`.
 */
function pickReplacement(
  ctx: SimCtx,
  weights: Readonly<Partial<Record<EventKind, number>>>,
  kept: EventKind[],
  tried: ReadonlySet<EventKind>,
): EventKind | null {
  const pruned: Partial<Record<EventKind, number>> = {};
  for (const [k, w] of Object.entries(weights) as Array<[EventKind, number]>) {
    if (!w || tried.has(k)) continue;
    pruned[k] = w;
  }
  return pickKind(ctx, pruned, kept);
}

/**
 * Re-resolve the apex flag over the FINAL kept log: the last surviving occupying
 * event is the apex, everything else is not. Updates both the event objects and
 * the matching `ctx.occupations` rows so downstream (Task 6 boss placement) reads
 * one apex, on a real logged occupation.
 */
function reassignApex(ctx: SimCtx, events: DungeonEvent[]): void {
  let apexId = -1;
  for (const ev of events) {
    if (OCCUPYING.has(ev.kind)) apexId = ev.id;
  }
  for (const occ of ctx.occupations) {
    occ.isApex = occ.eventRef === apexId;
  }
}

// ─── Chronicle binding (Pillar 2, Task 4) ────────────────────────────────────
//
// A chronicle ref is a REAL world event near the site (a war zone, a plague, an
// eruption). Binding rewrites a thematically-matching decay event so it QUOTES
// the ref's real name ("the hold burned in the Onerean Occupation") and snaps
// into the ref's era — turning anonymous decay into grounded history.

/**
 * Which decay-event kinds a chronicle kind may claim, in preference order. The
 * pairing is thematic:
 *  - war → the violent, structural scars of a siege: fire gutted it, masons
 *    bricked it up, the garrison sealed it.
 *  - plague → death and desecration: the dead woke, things denned in the
 *    corpse-fields, robbers stripped the plague-dead's goods.
 *  - eruption → the earth itself moving: floods and roof-falls (rare).
 * A later ref binding never steals an event an earlier ref already took (≤ 1
 * event per ref, ≤ 1 ref per event).
 */
const CHRONICLE_MATCH: Readonly<Record<ChronicleKind, readonly EventKind[]>> = {
  war: ['fire', 'brick-off', 'seal'],
  plague: ['awaken', 'den', 'plunder'],
  eruption: ['flood', 'collapse'],
  // World-chronicle inferences (Pillar 2 world layer):
  //  - schism → a faith bricked off / sealed / re-took these halls (war-like).
  //  - crusade → same violent register as a holy war.
  //  - migration → newcomers denned in or re-occupied the emptied structure.
  //  - fall → a predecessor polity's collapse: sealed, then collapsed, then plundered.
  schism: ['brick-off', 'seal', 'reoccupy'],
  crusade: ['fire', 'brick-off', 'seal'],
  migration: ['den', 'reoccupy'],
  fall: ['seal', 'collapse', 'plunder'],
};

/**
 * Snap a bound event's age into the ref's era while PRESERVING the log's strict
 * oldest-first monotonicity. The desired age is the ref's `yearsAgo` plus a small
 * seeded jitter, but it is then CLAMPED to the open interval strictly between its
 * neighbors' ages (older neighbor − 1 … newer neighbor + 1). Since the original
 * log is strictly decreasing, that interval is always non-empty, so the snapped
 * age keeps `events[i-1].yearsAgo > events[i].yearsAgo > events[i+1].yearsAgo` —
 * no re-sort, no id churn, no eventRef invalidation. Returns the new age.
 */
function snapAgeMonotonic(
  events: DungeonEvent[],
  index: number,
  refYearsAgo: number,
  jitter: Rng | undefined,
): number {
  const older = index > 0 ? events[index - 1].yearsAgo : Infinity;
  const newer = index < events.length - 1 ? events[index + 1].yearsAgo : 0;
  // Strict interval between neighbors (ages are strictly decreasing, so
  // older > newer and this interval is non-empty).
  const lo = newer + 1; // must stay strictly younger than the older neighbor
  const hi = older - 1; // must stay strictly older than the newer neighbor
  // Desired era = ref age ± up to 8 years of seeded jitter (deterministic; drawn
  // only when a chronicle is present, on the dedicated jitter stream).
  const wobble = jitter ? jitter.int(-8, 8) : 0;
  let want = refYearsAgo + wobble;
  if (want < lo) want = lo;
  if (want > hi) want = hi;
  return want;
}

/**
 * Bind chronicle refs to matching events IN PLACE. For each ref (in order), find
 * the first still-unbound, non-failed event whose kind the ref may claim, and:
 *  1. attach `chronicleRef` (zoneId/zoneName/kind),
 *  2. snap its `yearsAgo` into the ref's era (monotonicity preserved), and
 *  3. rewrite its `summary` to quote the real zone name.
 * Deterministic: refs and events are walked in fixed order; jitter (if any) draws
 * on the dedicated stream. No-op when a ref matches nothing.
 */
function bindChronicle(
  events: DungeonEvent[],
  chronicle: readonly ChronicleRef[],
  jitter: Rng | undefined,
): void {
  const bound = new Set<number>(); // event ids already claimed by a ref
  for (const ref of chronicle) {
    const kinds = CHRONICLE_MATCH[ref.kind];
    let target = -1;
    // Preference order: try each candidate kind, earliest matching event first.
    for (const k of kinds) {
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (bound.has(ev.id)) continue;
        if (ev.failed) continue; // a failed dig is no grounding for real history
        if (ev.kind !== k) continue;
        target = i;
        break;
      }
      if (target >= 0) break;
    }
    if (target < 0) continue; // this war/plague/eruption touched no logged event
    const ev = events[target];
    bound.add(ev.id);
    ev.chronicleRef = { zoneId: ref.zoneId, zoneName: ref.name, kind: ref.kind, shape: ref.shape };
    ev.yearsAgo = snapAgeMonotonic(events, target, ref.yearsAgo, jitter);
    ev.summary = chronicleSummary(ev.kind, ref, ev.id);
  }
}

/**
 * Faction-shaped war summaries (Rebels-family zones — the name is a GROUP, not a
 * happening, so a hold falls TO them, never *in* them). Two variants per event
 * kind; `pick` selects one. Same tone bar as the event family: front-loaded,
 * laconic, US English, every clause TRUE of the event.
 */
const FACTION_SUMMARY: Readonly<Record<string, readonly [(n: string) => string, (n: string) => string]>> = {
  fire: [
    (n) => `the ${n} put the hold to the torch`,
    (n) => `the ${n} burned the hold and moved on`,
  ],
  'brick-off': [
    (n) => `the survivors of the siege by the ${n} bricked the way shut`,
    (n) => `masons walled the deep shut after the ${n} came through`,
  ],
  seal: [
    (n) => `the garrison sealed the hold against the ${n}`,
    (n) => `the hold was sealed with the ${n} at the gates`,
  ],
  default: [
    (n) => `the ${n} overran the hold`,
    (n) => `it fell to the ${n}`,
  ],
};

/**
 * Rewrite a bound event's summary to quote the real zone name. Front-loaded and
 * laconic (the dungeon tone bar), US English. Every clause is TRUE of the event:
 * a `fire` bound to a war really did burn in that war; an `awaken` bound to a
 * plague really did wake the plague's dead.
 *
 * The template family branches on the ref's grammatical SHAPE: event-shaped
 * names ("Onerean Occupation") keep the "in the {name}" family; faction-shaped
 * names (Rebels-family zones, "Damunvilian Rebels") use {@link FACTION_SUMMARY}
 * — a hold falls TO the Rebels, it cannot fall *in* them. Faction refs only
 * ever arrive with kind 'war' (chronicle.ts maps Rebels → war), so the faction
 * family covers exactly the war-bindable event kinds (fire/brick-off/seal) plus
 * a fallback. Variant selection is seedless arithmetic (eventId + zoneId) —
 * ZERO rng draws, so the draw-count discipline is untouched.
 */
function chronicleSummary(kind: EventKind, ref: ChronicleRef, eventId: number): string {
  if (ref.shape === 'faction') {
    const n = ref.name || 'rebels';
    const pair = FACTION_SUMMARY[kind] ?? FACTION_SUMMARY.default;
    return pair[(eventId + ref.zoneId) % 2](n);
  }
  const n = ref.name || 'the war';
  switch (kind) {
    case 'fire': return `the hold burned in the ${n}`;
    case 'brick-off': return `the survivors of the ${n} bricked the way shut`;
    case 'seal': return `the garrison sealed the hold against the ${n}`;
    case 'awaken': return `the ${n} filled these vaults, and its dead woke`;
    case 'den': return `beasts denned here after the ${n} emptied the land`;
    case 'plunder': return `robbers stripped the dead of the ${n}`;
    case 'flood': return `the ${n} shook the earth and the deep flooded`;
    case 'collapse': return `the ${n} brought the passage down`;
    default: return `it fell in the ${n}`;
  }
}

// ─── The simulation ──────────────────────────────────────────────────────────

/**
 * Optional Pillar-2 (Task 4) chronicle-binding input. When `chronicle` is a
 * non-empty list, a thematically-matching decay event binds to a ref and quotes
 * its real zone name (see {@link bindChronicle}). `jitter` seeds the small era
 * jitter — a DEDICATED stream so binding consumes ZERO draws from the main
 * history `rng` (a dungeon with no chronicle draws identically to before, and a
 * chronicled one keeps the same grid/props/spawns — only summaries and ages of
 * the bound events change). Both are omitted on the standalone preview path.
 */
export interface ChronicleBinding {
  chronicle?: ChronicleRef[];
  jitter?: Rng;
}

export function simulateHistory(
  st: IntactState,
  rng: Rng,
  archetype: BuilderArchetype,
  theme: DungeonTheme,
  asOfYearsAgo: number,
  binding?: ChronicleBinding,
): HistoryResult {
  const data = ARCHETYPES[archetype];
  const ctx: SimCtx = {
    st,
    rng,
    theme,
    archetype,
    actors: ACTORS[theme],
    overlay: new Uint8Array(st.grid.length),
    doorStates: new Map(),
    evidenceProps: [],
    occupations: [],
    plunderedRoomIds: new Set(),
    tunnels: [],
    builtLoops: null,
    builderName: builderNoun(archetype),
    structureNoun: structureNoun(archetype),
    rec: [],
    roomCellCache: null,
  };

  // ── Snapshot the pre-simulation state BEFORE any event mutates it. The prefix
  //    replay restores this exact state and re-applies only the un-cut events.
  //    Typed arrays are copied; the edges array is shallow-cloned (edge OBJECTS
  //    are shared — built edges persist, and loop edges added during the canonical
  //    pass are re-pushed on replay by their recorded thunks, restoring identity).
  const snap = {
    grid: st.grid.slice(),
    corridor: st.corridor.slice(),
    roomOf: st.roomOf.slice(),
    edges: st.edges.slice(),
  };

  // Built state: waterworks channels/cisterns start wet, eventRef-free, BEFORE
  // any event. Flood events add more water on top. This baseline is asOf-
  // independent (it predates all events), so it is stamped fresh both on the
  // canonical pass and after a snapshot restore.
  const stampBuiltWater = (): void => {
    for (const cell of st.builtWater) {
      if (st.grid[cell] === CellKind.Floor) ctx.overlay[cell] = OverlayKind.Water;
    }
  };
  stampBuiltWater();

  // ── Roll the FULL chain (kinds + dates) up front. This never touches the grid
  //    and is identical for every asOfYearsAgo. ───────────────────────────────
  const count = rng.int(3, 6);
  const kinds: EventKind[] = [];
  for (let i = 0; i < count; i++) {
    // fungal ALWAYS ends in bloom — reserve the last slot for it.
    if (theme === 'fungal' && i === count - 1) {
      kinds.push('bloom');
      continue;
    }
    const k = pickKind(ctx, data.eventWeights, kinds);
    // pickKind can only be null if NOTHING is eligible; the archetype weights
    // always include unconditional kinds (seal/flood/den/fire etc.), so on a
    // first pick something is always eligible. Guard defensively anyway.
    kinds.push(k ?? bestOccupyingKind(data.eventWeights));
  }

  // Force at least one occupation (the spec's "spawns exist" invariant). For
  // fungal the trailing bloom already occupies, so this only fires elsewhere.
  if (!kinds.some((k) => OCCUPYING.has(k))) {
    kinds[kinds.length - 1] = bestOccupyingKind(data.eventWeights);
  }

  // Dates: monotonic newest-last. First is 80–500 years ago; each later event is
  // 55–85% of the previous age (so ages strictly decrease), floored at 2.
  const ages: number[] = [];
  let age = rng.int(80, 500);
  ages.push(age);
  for (let i = 1; i < count; i++) {
    const frac = rng.float(0.55, 0.85);
    const next = Math.max(2, Math.floor(age * frac));
    // Guard strict monotonic decrease even when age*frac rounds up to age.
    age = next >= age ? age - 1 : next;
    if (age < 2) age = 2;
    ages.push(age);
  }

  // ── Apply events in log order, resolving evidence-less exclusions (F5).
  //    An event that cannot leave real evidence (a collapse/brick-off with no
  //    safe loop edge, a flood with no floodable room) must NOT appear in the
  //    final log — narrating ruin the map does not show violates the no-fallback
  //    directive. When an applier reports "no evidence" we deterministically
  //    RE-ROLL a replacement kind (eligible given the kinds kept so far) into
  //    that slot; if nothing lands, the slot is dropped and the log ends shorter.
  //    Protected slots that must never drop: an occupying event (so ≥1 occupation
  //    always survives) and — for fungal — the terminal bloom.
  //
  //    Kind selection is asOf-independent (the canonical log is the same for
  //    every cutoff). The CANONICAL pass below always applies every event (and
  //    records its concrete mutations); the cutoff STATE is produced afterward by
  //    restoring the snapshot and replaying only the prefix's recorded deltas.
  //
  //    `kept` accumulates the surviving kinds so replacement eligibility (and the
  //    apex identity) reflect the real log, not the pre-exclusion roll.
  const events: DungeonEvent[] = [];
  const kept: EventKind[] = [];
  // Recorded redo-thunks per KEPT event, index-aligned with `events`, used to
  // replay a prefix at a cutoff.
  const recorded: Array<Array<() => void>> = [];
  for (let i = 0; i < count; i++) {
    const yearsAgo = ages[i];
    const isFungalTerminal = theme === 'fungal' && i === count - 1;
    // Is this the last surviving occupation? Occupying appliers never fail, so a
    // slot rolled as occupying stays occupying — it is the apex iff no LATER slot
    // is occupying in the (post-force) roll.
    const laterOccupation = kinds.slice(i + 1).some((k) => OCCUPYING.has(k));

    let kind = kinds[i];
    let ev: DungeonEvent | null = null;
    // Try the rolled kind, then deterministic replacements until one leaves
    // evidence. Occupying kinds and the fungal terminal never return null.
    const tried = new Set<EventKind>();
    for (let attempt = 0; attempt < 6; attempt++) {
      tried.add(kind);
      const isApex = OCCUPYING.has(kind) && !laterOccupation;
      // The canonical pass always applies; capture the event's mutations in
      // `ctx.rec`. A rejected attempt (null) leaves nothing recorded, so clearing
      // `ctx.rec` before each try keeps the recording clean of dead attempts.
      ctx.rec = [];
      ev = applyEvent(ctx, { id: events.length, kind, yearsAgo, isApex, apply: true });
      if (ev) break;
      // Excluded (no evidence). Re-roll a replacement eligible given `kept`,
      // excluding kinds we already tried for this slot. Draw is deterministic.
      const replacement = pickReplacement(ctx, data.eventWeights, kept, tried);
      if (!replacement) break;
      kind = replacement;
    }

    if (!ev) {
      // Slot produced no evidence and no replacement did either → drop it, unless
      // it is a protected occupying/terminal slot (those cannot fail; guard only).
      if (isFungalTerminal || (OCCUPYING.has(kinds[i]) && !laterOccupation)) {
        // Should be unreachable (occupations always place); fail honestly if not.
        throw new Error('simulateHistory: protected occupation slot left no evidence');
      }
      continue;
    }
    events.push(ev);
    kept.push(ev.kind);
    recorded.push(ctx.rec);
    ctx.rec = [];
  }

  // ── Chronicle grounding (Pillar 2, Task 4). Bind thematically-matching events
  //    to the real world zones near this site and quote their names. This runs
  //    on the FINAL kept log, AFTER every rng-drawing decision above, so it can
  //    never perturb the grid/props/spawns; and it only draws (a small era
  //    jitter) when a chronicle is actually supplied — so a dungeon with no
  //    chronicle is byte-identical to before. The snapped ages preserve the log's
  //    strict oldest-first monotonicity (see bindChronicle). ──────────────────
  if (binding?.chronicle && binding.chronicle.length > 0) {
    bindChronicle(events, binding.chronicle, binding.jitter);
  }

  // ── Prefix replay for a map drawn `asOfYearsAgo` years back. Events YOUNGER
  //    than the cutoff had not happened yet, so restore the pre-simulation state
  //    and re-apply ONLY the recorded deltas of events with yearsAgo >= cutoff.
  //    No rng, no re-decision — an exact replay of the canonical prefix. ───────
  if (asOfYearsAgo > 0) {
    st.grid.set(snap.grid);
    st.corridor.set(snap.corridor);
    st.roomOf.set(snap.roomOf);
    st.edges.length = 0;
    for (const e of snap.edges) st.edges.push(e);
    ctx.overlay.fill(0);
    ctx.doorStates.clear();
    ctx.evidenceProps.length = 0;
    ctx.occupations.length = 0;
    ctx.plunderedRoomIds.clear();
    stampBuiltWater();
    for (let i = 0; i < events.length; i++) {
      if (events[i].yearsAgo < asOfYearsAgo) continue; // younger — not yet happened
      for (const op of recorded[i]) op();
    }
  }

  // Mark the apex: the LAST surviving occupation IN THE APPLIED STATE. (At a cutoff
  // the apex row may not have been re-applied — then no occupation carries the
  // crown, which is correct: the boss had not moved in yet.)
  reassignApex(ctx, events);

  // ── Reachability assertion — at the FINAL (cutoff) state. Prefix states are
  //    reachable by construction (they are earlier points of a valid history), so
  //    a throw here still means a real rule bug. ──────────────────────────────
  assertReachable(st);
  // Graph must still connect every room (protects entrance-degree-1 downstream).
  if (!graphConnected(st.rooms.length, st.entranceId, st.edges)) {
    throw new Error('simulateHistory: room graph disconnected after events');
  }

  return {
    events,
    overlay: ctx.overlay,
    doorStates: ctx.doorStates,
    evidenceProps: ctx.evidenceProps,
    occupations: ctx.occupations,
    plunderedRoomIds: ctx.plunderedRoomIds,
  };
}

// ─── Event dispatch ──────────────────────────────────────────────────────────

interface PendingEvent {
  id: number;
  kind: EventKind;
  yearsAgo: number;
  isApex: boolean;
  /** Always true in the canonical pass — every event is fully applied (and its
   * concrete mutations recorded into `ctx.rec`). The `asOfYearsAgo` cutoff is not
   * gated HERE; it is realized afterward by restoring the snapshot and replaying
   * only the prefix's recorded deltas. Kept for call-site clarity. Returning null
   * from an applier means "this event left no evidence and is excluded from the
   * log" — a purely structural decision, so identical across every cutoff. */
  apply: boolean;
}

/**
 * Apply one event. Returns the logged `DungeonEvent`, or `null` when the applier
 * could not leave any real evidence (an evidence-less collapse/brick-off/flood) —
 * the caller then re-rolls a replacement kind or drops the slot (F5). The
 * exclusion decision is purely structural and so identical across `asOfYearsAgo`.
 */
function applyEvent(ctx: SimCtx, p: PendingEvent): DungeonEvent | null {
  const base: DungeonEvent = {
    id: p.id,
    kind: p.kind,
    yearsAgo: p.yearsAgo,
    roomIds: [],
    summary: '',
  };
  switch (p.kind) {
    case 'seal': return applySeal(ctx, p, base);
    case 'collapse': return applyCollapse(ctx, p, base);
    case 'flood': return applyFlood(ctx, p, base);
    case 'tunnel': return applyTunnel(ctx, p, base);
    case 'brick-off': return applyBrickOff(ctx, p, base);
    case 'den': return applyDen(ctx, p, base);
    case 'awaken': return applyAwaken(ctx, p, base);
    case 'plunder': return applyPlunder(ctx, p, base);
    case 'fire': return applyFire(ctx, p, base);
    case 'reoccupy': return applyReoccupy(ctx, p, base);
    case 'bloom': return applyBloom(ctx, p, base);
    default: return base;
  }
}

// ─── Appliers ────────────────────────────────────────────────────────────────

function applySeal(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent {
  // No grid change. Evidence: a snapped bar at the entrance room.
  const entrance = ctx.st.rooms[ctx.st.entranceId];
  const cell = roomCenterCell(ctx, entrance);
  recProp(ctx, { kind: 'snapped-bar', cell, eventRef: p.id, roomId: entrance.id });
  ev.roomIds = [entrance.id];
  ev.summary = `${ctx.builderName} sealed the ${ctx.structureNoun}`;
  return ev;
}

function applyCollapse(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent | null {
  // Collapse a connectivity-safe cycle corridor — a BUILT cross-cut or a dug
  // tunnel. Collapsing a cycle edge's corridor can never strand floor (the two
  // endpoints keep their tree paths). findCycleEdgeToRemove prefers an intact
  // tunnel, then any built loop whose removal keeps the graph connected.
  const target = findCycleEdgeToRemove(ctx);
  if (!target) {
    // No safe edge to bring down. Per the no-fallback directive a collapse that
    // can leave no rubble the map shows must NOT be logged — exclude it (the
    // caller re-rolls a replacement kind). Returning null is the honest signal.
    return null;
  }
  const tunnel = { edge: target.edge, cells: target.cells };
  const [a, b] = [tunnel.edge.a, tunnel.edge.b];
  const S = ctx.st.side;
  // Rubble spill cells: the surviving FLOOR cells 4-adjacent to the collapsed run
  // (the mouths where the caved-in passage met open floor). Computed BEFORE the
  // walls are stamped so the collapsed cells themselves are still floor here; a
  // Set de-dupes shared mouths. This honors the overlay-on-floor contract — the
  // rubble reads as spilled AT THE SEAL, matching the approved mock, instead of
  // being stamped on the impassable Wall cells the collapse creates.
  const collapsed = new Set(tunnel.cells);
  const spill = new Set<number>();
  for (const cell of tunnel.cells) {
    const x = cell % S;
    const y = (cell / S) | 0;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
      const nk = gi(nx, ny, S);
      if (collapsed.has(nk)) continue;
      if (ctx.st.grid[nk] === CellKind.Floor) spill.add(nk);
    }
  }
  // Rubble falls: walls + edge removal + the visible Rubble overlay on the spill,
  // all recorded so a cutoff BEFORE this collapse replays none of it (the passage
  // still stands).
  for (const cell of tunnel.cells) {
    recWriteCell(ctx, cell, CellKind.Wall, 0, -1);
  }
  // Guard: a carved corridor always meets floor at both mouths, so `spill` is
  // non-empty in practice; if it somehow is not, skip the overlay honestly rather
  // than stamp rubble on a wall.
  for (const cell of spill) recOverlay(ctx, cell, OverlayKind.Rubble);
  // Remove the loop edge from the graph (recorded).
  recRemoveEdge(ctx, tunnel.edge);
  // The corridor cells are now Wall, so corridorIntact/loopCorridorCells will
  // never re-pick this edge — no separate spent-bookkeeping needed.
  ev.roomIds = [a, b];
  ev.summary = `the passage between two chambers of the ${ctx.structureNoun} caved in`;
  return ev;
}

function applyFlood(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent | null {
  const data = ARCHETYPES[ctx.archetype];
  const floodable = ctx.st.rooms.filter(
    (r) => data.floodable.includes(r.purpose) && r.id !== ctx.st.entranceId,
  );
  if (floodable.length === 0) {
    // No room can hold water — a flood here would stamp nothing. Exclude it (the
    // caller re-rolls) rather than narrate water the map never shows.
    return null;
  }
  const n = Math.min(floodable.length, ctx.rng.int(1, 2));
  const picked = pickDistinct(ctx, floodable, n);
  const ids: number[] = [];
  for (const r of picked) {
    for (const cell of roomCellsCached(ctx, r.id)) recOverlay(ctx, cell, OverlayKind.Water);
    ids.push(r.id);
  }
  ev.roomIds = ids;
  ev.summary = `flooding drowned the lower ${ctx.structureNoun}`;
  return ev;
}

function applyTunnel(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent | null {
  // Two rooms ≥ 3 graph hops apart, NEITHER the entrance. Carve a rough 1-wide
  // corridor through void between their nearest wall cells (a void BFS with the
  // builder's no-touch guard — so a tunnel adds a real back-way loop without
  // fusing rooms into a blob). Rooms that are FAR in the graph but NEAR in space
  // make the best loops, so order candidate pairs by spatial proximity: the
  // first geometrically-buildable pair wins, which is both stable and reliable.
  const st = ctx.st;
  const adj = buildAdjacency(st.rooms.length, st.edges);
  const depth = graphDepths(st.rooms.length, st.entranceId, adj);
  const candidates = st.rooms.filter((r) => r.id !== st.entranceId && Number.isFinite(depth[r.id]));

  // Build the eligible pairs (≥ 3 graph hops apart), sorted nearest-first in
  // space. Deterministic: the pair list order is a pure function of the (seed-
  // fixed) geometry, so the tunnel a given seed digs never depends on draw luck.
  const pairs: Array<{ a: Room; b: Room; d2: number }> = [];
  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i];
    const hopA = graphDepths(st.rooms.length, a.id, adj);
    for (let j = i + 1; j < candidates.length; j++) {
      const b = candidates[j];
      const hop = hopA[b.id];
      if (!Number.isFinite(hop) || hop < 3) continue;
      const dx = roomCx(a) - roomCx(b);
      const dy = roomCy(a) - roomCy(b);
      pairs.push({ a, b, d2: dx * dx + dy * dy });
    }
  }
  pairs.sort((p1, p2) => p1.d2 - p2.d2 || (p1.a.id - p2.a.id) || (p1.b.id - p2.b.id));

  let tried = 0;
  for (const { a, b } of pairs) {
    if (tried >= 12) break; // brief's 12-attempt geometry budget
    tried++;
    const carved = carveTunnel(ctx, a, b);
    if (carved) {
      // dug:true marks this cycle edge as a HAND-CUT robber tunnel (vs a clean
      // BUILT cross-cut, which leaves `dug` unset) — the drawer's rough wobble
      // treatment keys on `dug`.
      const edge: DungeonEdge = { a: a.id, b: b.id, isLoop: true, isCritical: false, dug: true };
      recAddEdge(ctx, edge);
      ctx.tunnels.push({ edge, cells: carved });
      // Evidence: spoil heaps at each tunnel MOUTH — the first carved cell hugging
      // `a` (carved[0], the oldest endpoint) and the last hugging `b`
      // (carved[last]). Both carry the digging event's ref, so a successful tunnel
      // is self-evidencing (F4), and both ride the same crop/remap path as every
      // other evidence prop. Guard the degenerate 1-cell carve (both mouths same
      // cell) so we never stack two props on one cell.
      recProp(ctx, { kind: 'tunnel-mouth', cell: carved[0], eventRef: p.id, roomId: a.id });
      const bMouth = carved[carved.length - 1];
      if (bMouth !== carved[0]) {
        recProp(ctx, { kind: 'tunnel-mouth', cell: bMouth, eventRef: p.id, roomId: b.id });
      }
      ev.roomIds = [a.id, b.id];
      ev.summary = `grave robbers tunneled a back way into the ${ctx.structureNoun}`;
      return ev;
    }
  }
  // Rejected after the geometry budget — no clean path. This is NOT a phantom:
  // the failed dig leaves real evidence (a tool-scarred wall + pick-scar prop),
  // so it stays in the log, marked `failed` so lore branches to the "tried and
  // gave up" family without sniffing the summary string (F5).
  const scarRoom = deepestRoom(ctx);
  if (!scarRoom) {
    // No deep room to scar — genuinely nothing to show. Exclude honestly.
    return null;
  }
  recProp(ctx, {
    kind: 'pick-scars', cell: roomCenterCell(ctx, scarRoom), eventRef: p.id, roomId: scarRoom.id,
  });
  ev.roomIds = [scarRoom.id];
  ev.failed = true;
  ev.summary = `robbers gouged at the walls of the ${ctx.structureNoun} but found no way through`;
  return ev;
}

function applyBrickOff(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent | null {
  // Wall up a door on a CYCLE (removing its graph edge keeps the graph
  // connected). A cycle always exists — a BUILT cross-cut or a dug tunnel — so
  // findCycleEdgeToRemove returns a built loop as readily as a robber tunnel.
  const st = ctx.st;
  const target = findCycleEdgeToRemove(ctx);
  if (!target) {
    // No back way to wall up — a brick-off here leaves no bricked door for the
    // map to show. Exclude it (the caller re-rolls) rather than emit a phantom.
    return null;
  }
  const tunnel = { edge: target.edge, cells: target.cells };
  // findCycleEdgeToRemove already verified removal keeps the graph connected.
  // Brick the tunnel's mid cell (the "door" of the back way): impassable wall.
  const mid = tunnel.cells[tunnel.cells.length >> 1];
  // The rest of the corridor stays floor but is now a dead-end stub touching the
  // wall — remove those stub cells too so no floor is stranded off the graph. All
  // writes recorded so a cutoff BEFORE this brick-off replays none of them (the
  // back way is still open, mid still floor).
  recWriteCell(ctx, mid, CellKind.Wall, 0, -1);
  for (const cell of tunnel.cells) {
    if (cell === mid) continue;
    recWriteCell(ctx, cell, CellKind.Wall, 0, -1);
  }
  // The bricked door state is the visible evidence.
  recDoorState(ctx, mid, 'bricked', p.id);
  // Remove the loop edge; the back way is closed (recorded).
  recRemoveEdge(ctx, tunnel.edge);
  tunnel.cells = [];
  // With probability 0.5, mark ONE other door of the same wing 'secret'
  // (the forgotten back way). Use an entrance-side door of one endpoint room.
  // The draw happens in the canonical pass; its stamp is recorded (replayed only
  // if this event is in the prefix).
  const secretRoll = ctx.rng.chance(0.5);
  if (secretRoll) {
    const secretCell = roomCenterCell(ctx, st.rooms[tunnel.edge.a]);
    if (!ctx.doorStates.has(secretCell)) {
      recDoorState(ctx, secretCell, 'secret', p.id);
    }
  }
  ev.roomIds = [tunnel.edge.a, tunnel.edge.b];
  ev.summary = `masons bricked off the robbers' back way into the ${ctx.structureNoun}`;
  return ev;
}

function applyDen(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent {
  const rooms = pickOccupationRooms(ctx, p.isApex, ctx.rng.int(1, 3));
  for (const r of rooms) {
    recProp(ctx, { kind: 'nest', cell: roomCenterCell(ctx, r), eventRef: p.id, roomId: r.id });
  }
  recOccupation(ctx, { roomIds: rooms.map((r) => r.id), actorKey: ctx.actors.den, eventRef: p.id, isApex: p.isApex });
  ev.roomIds = rooms.map((r) => r.id);
  ev.actorKey = ctx.actors.den;
  ev.summary = `${labelActor(ctx.actors.den)} denned in the deep ${ctx.structureNoun}`;
  return ev;
}

function applyAwaken(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent {
  // All burial-gallery/ossuary rooms (mausoleum) or 2 deep rooms otherwise.
  const graves = ctx.st.rooms.filter(
    (r) => (r.purpose === 'burial-gallery' || r.purpose === 'ossuary') && r.id !== ctx.st.entranceId,
  );
  const rooms = graves.length > 0 ? graves : pickOccupationRooms(ctx, p.isApex, 2);
  for (const r of rooms) {
    recProp(ctx, { kind: 'disturbed-lid', cell: roomCenterCell(ctx, r), eventRef: p.id, roomId: r.id });
  }
  recOccupation(ctx, { roomIds: rooms.map((r) => r.id), actorKey: ctx.actors.undead, eventRef: p.id, isApex: p.isApex });
  ev.roomIds = rooms.map((r) => r.id);
  ev.actorKey = ctx.actors.undead;
  ev.summary = `the ${labelActor(ctx.actors.undead)} of the ${ctx.structureNoun} woke`;
  return ev;
}

function applyPlunder(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent {
  const vault = ctx.st.rooms.find(
    (r) => (r.purpose === 'treasury' || r.purpose === 'cistern' || r.purpose === 'armory') && r.id !== ctx.st.entranceId,
  ) ?? deepestRoom(ctx);
  if (vault) {
    recPlunder(ctx, vault.id);
    const cell = roomCenterCell(ctx, vault);
    recProp(ctx, { kind: 'pried-vault', cell, eventRef: p.id, roomId: vault.id });
    // A trail of dropped coins from the vault toward the entrance.
    for (const c of coinTrail(ctx, vault)) {
      recProp(ctx, { kind: 'dropped-coins', cell: c, eventRef: p.id, roomId: vault.id });
    }
    ev.roomIds = [vault.id];
  }
  ev.summary = `robbers pried open the vaults of the ${ctx.structureNoun}`;
  return ev;
}

function applyFire(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent | null {
  // 1–2 rooms near the entrance.
  const adj = buildAdjacency(ctx.st.rooms.length, ctx.st.edges);
  const depth = graphDepths(ctx.st.rooms.length, ctx.st.entranceId, adj);
  const near = ctx.st.rooms
    .filter((r) => r.id !== ctx.st.entranceId && Number.isFinite(depth[r.id]))
    .sort((a, b) => depth[a.id] - depth[b.id])
    .slice(0, 4);
  if (near.length === 0) {
    // Nothing to scorch — exclude rather than narrate a fire that left no soot.
    return null;
  }
  const n = Math.min(near.length, ctx.rng.int(1, 2));
  const picked = pickDistinct(ctx, near, n);
  const ids: number[] = [];
  for (const r of picked) {
    for (const cell of roomCellsCached(ctx, r.id)) recOverlay(ctx, cell, OverlayKind.Scorch);
    ids.push(r.id);
  }
  ev.roomIds = ids;
  ev.summary = `fire gutted the near halls of the ${ctx.structureNoun}`;
  return ev;
}

function applyReoccupy(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent {
  const hub = ctx.st.rooms.find(
    (r) => (r.purpose === 'chapel' || r.purpose === 'junction' || r.purpose === 'great-hall') && r.id !== ctx.st.entranceId,
  ) ?? deepestRoom(ctx);
  const rooms = hub ? [hub] : [];
  const faction = ctx.actors.faction;
  for (const r of rooms) {
    recProp(ctx, { kind: 'crates', cell: roomCenterCell(ctx, r), eventRef: p.id, roomId: r.id });
    recProp(ctx, { kind: 'candles', cell: roomCenterCell(ctx, r), eventRef: p.id, roomId: r.id });
  }
  recOccupation(ctx, { roomIds: rooms.map((r) => r.id), actorKey: faction, eventRef: p.id, isApex: p.isApex });
  ev.roomIds = rooms.map((r) => r.id);
  ev.actorKey = faction;
  ev.summary = `${labelActor(faction)} moved into the abandoned ${ctx.structureNoun}`;
  return ev;
}

function applyBloom(ctx: SimCtx, p: PendingEvent, ev: DungeonEvent): DungeonEvent {
  // Bloom flood-fills from one room outward rng.int(2,4) rooms along edges.
  const st = ctx.st;
  const adj = buildAdjacency(st.rooms.length, st.edges);
  const seedRoom = deepestRoom(ctx) ?? st.rooms[st.rooms.length - 1];
  const reach = ctx.rng.int(2, 4);
  // BFS outward from seedRoom up to `reach` rooms.
  const seen = new Set<number>([seedRoom.id]);
  const q: Array<{ id: number; d: number }> = [{ id: seedRoom.id, d: 0 }];
  const bloomed: number[] = [];
  for (let h = 0; h < q.length; h++) {
    const { id, d } = q[h];
    bloomed.push(id);
    if (d >= reach) continue;
    for (const n of adj[id]) {
      if (!seen.has(n)) {
        seen.add(n);
        q.push({ id: n, d: d + 1 });
      }
    }
  }
  for (const rid of bloomed) {
    for (const cell of roomCellsCached(ctx, rid)) recOverlay(ctx, cell, OverlayKind.Bloom);
  }
  recProp(ctx, { kind: 'spore-shelf', cell: roomCenterCell(ctx, seedRoom), eventRef: p.id, roomId: seedRoom.id });
  recOccupation(ctx, { roomIds: [seedRoom.id], actorKey: 'myconid_ring', eventRef: p.id, isApex: p.isApex });
  ev.roomIds = bloomed;
  ev.actorKey = 'myconid_ring';
  ev.summary = `a fungal bloom overtook the ${ctx.structureNoun}`;
  return ev;
}

// ─── Occupation room selection (apex-aware) ──────────────────────────────────

/**
 * Pick 1–`max` connected rooms preferring deep, non-entrance rooms. For the
 * APEX occupation, prefer rooms at ≥ 60% of max graph depth and NEVER a room
 * adjacent to the entrance — this protects the boss-depth and boss-not-adjacent
 * acceptance invariants Task 6 relies on.
 */
function pickOccupationRooms(ctx: SimCtx, isApex: boolean, max: number): Room[] {
  const st = ctx.st;
  const adj = buildAdjacency(st.rooms.length, st.edges);
  const depth = graphDepths(st.rooms.length, st.entranceId, adj);
  const entranceNbrs = neighborsOf(st.entranceId, adj);
  const maxDepth = Math.max(0, ...st.rooms.map((r) => (Number.isFinite(depth[r.id]) ? depth[r.id] : 0)));

  let eligible = st.rooms.filter(
    (r) => r.id !== st.entranceId && Number.isFinite(depth[r.id]) && !entranceNbrs.has(r.id),
  );
  if (isApex) {
    const deep = eligible.filter((r) => depth[r.id] >= 0.6 * maxDepth);
    if (deep.length > 0) eligible = deep;
  }
  if (eligible.length === 0) {
    // Fall back to any non-entrance room (a tiny graph with no deep rooms).
    eligible = st.rooms.filter((r) => r.id !== st.entranceId && Number.isFinite(depth[r.id]));
  }
  if (eligible.length === 0) return [st.rooms[st.rooms.length - 1]];

  // Deepest-first ordering, then take a connected cluster of up to `max`.
  eligible.sort((a, b) => depth[b.id] - depth[a.id]);
  const seed = isApex ? eligible[0] : ctx.rng.pick(eligible);
  const cluster: Room[] = [seed];
  const inCluster = new Set<number>([seed.id]);
  // Grow the cluster over graph neighbors that are themselves eligible.
  const eligibleIds = new Set(eligible.map((r) => r.id));
  let frontier = [seed.id];
  while (cluster.length < max && frontier.length > 0) {
    const next: number[] = [];
    for (const id of frontier) {
      for (const n of adj[id]) {
        if (cluster.length >= max) break;
        if (!inCluster.has(n) && eligibleIds.has(n)) {
          inCluster.add(n);
          cluster.push(st.rooms[n]);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return cluster;
}

function deepestRoom(ctx: SimCtx): Room | undefined {
  const st = ctx.st;
  const adj = buildAdjacency(st.rooms.length, st.edges);
  const depth = graphDepths(st.rooms.length, st.entranceId, adj);
  let best: Room | undefined;
  let bestD = -1;
  for (const r of st.rooms) {
    if (r.id === st.entranceId) continue;
    if (Number.isFinite(depth[r.id]) && depth[r.id] > bestD) {
      bestD = depth[r.id];
      best = r;
    }
  }
  return best;
}

// ─── Tunnel carving ──────────────────────────────────────────────────────────

/**
 * Carve a rough 1-wide corridor through VOID between rooms `a` and `b`.
 *
 * The carve is a breadth-first search over VOID cells, from the ring of void
 * cells hugging `a` to the ring hugging `b`. A cell is walkable by the search
 * only if its whole 8-neighborhood is either void or part of the emerging path
 * — the SAME no-touch guarantee `attachRoom` enforces, so a tunnel never fuses
 * a third room into a blob. The endpoints are special-cased: the search may
 * SEED from a void cell orthogonally adjacent to `a`'s floor and may FINISH on a
 * void cell orthogonally adjacent to `b`'s floor, so the corridor actually meets
 * both rooms. Returns the carved cell indices oldest-endpoint-first, or null if
 * no clean channel exists. Endpoints are guaranteed non-entrance by the caller.
 *
 * Deterministic: the BFS explores neighbors in a fixed order and returns the
 * first (shortest) clean path, so the same geometry always yields the same
 * tunnel — no rng is consumed here.
 */
function carveTunnel(ctx: SimCtx, a: Room, b: Room): number[] | null {
  const st = ctx.st;
  const S = st.side;
  const N = st.grid.length;

  // Seeds: void cells orthogonally adjacent to a's floor (the tunnel mouths).
  const seeds = adjacentVoidCells(st, a.id);
  const goals = adjacentVoidCells(st, b.id);
  if (seeds.length === 0 || goals.length === 0) return null;
  const goalSet = new Set(goals);

  // A cell is path-walkable if it is void and its 8-neighborhood touches no
  // FOREIGN floor (floor of a room other than a/b). Cells hugging a or b are
  // allowed to touch that room only (they are the mouths).
  const walkable = (k: number): boolean => {
    if (st.grid[k] !== CellKind.Void) return false;
    const x = k % S;
    const y = (k / S) | 0;
    if (x < 2 || y < 2 || x >= S - 2 || y >= S - 2) return false;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (ox === 0 && oy === 0) continue;
        const nk = gi(x + ox, y + oy, S);
        if (st.grid[nk] !== CellKind.Floor) continue;
        const owner = st.roomOf[nk];
        // Touching a's or b's own floor is only allowed at that room's mouth
        // ring; elsewhere any floor neighbor disqualifies the cell.
        if (owner !== a.id && owner !== b.id) return false;
      }
    }
    return true;
  };

  // BFS. Seeds must themselves be walkable (mouth cells touch only a's floor).
  const prev = new Int32Array(N).fill(-2); // -2 = unvisited, -1 = a seed root
  const q: number[] = [];
  for (const s of seeds) {
    if (!walkable(s)) continue;
    prev[s] = -1;
    q.push(s);
  }
  let hit = -1;
  for (let h = 0; h < q.length && hit < 0; h++) {
    const c = q[h];
    if (goalSet.has(c)) { hit = c; break; }
    const x = c % S;
    const y = (c / S) | 0;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const nk = gi(x + dx, y + dy, S);
      if (prev[nk] !== -2) continue;
      if (!walkable(nk)) continue;
      prev[nk] = c;
      q.push(nk);
      if (goalSet.has(nk)) { hit = nk; break; }
    }
  }
  if (hit < 0) return null;

  // Reconstruct the path (goal → seed), then commit oldest-endpoint (a) first.
  const rev: number[] = [];
  for (let c = hit; c !== -1; c = prev[c]) rev.push(c);
  const cells = rev.reverse();
  // Record each carve write so a cutoff BEFORE this dig replays no corridor.
  for (const k of cells) recWriteCell(ctx, k, CellKind.Floor, 1, -2);
  return cells;
}

/** Void cells orthogonally adjacent to any floor cell of room `roomId`. */
function adjacentVoidCells(st: IntactState, roomId: number): number[] {
  const S = st.side;
  const out = new Set<number>();
  for (let i = 0; i < st.roomOf.length; i++) {
    if (st.roomOf[i] !== roomId) continue;
    const x = i % S;
    const y = (i / S) | 0;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 2 || ny < 2 || nx >= S - 2 || ny >= S - 2) continue;
      const nk = gi(nx, ny, S);
      if (st.grid[nk] === CellKind.Void) out.add(nk);
    }
  }
  return [...out].sort((p, r) => p - r);
}

// ─── Small utilities ─────────────────────────────────────────────────────────

function corridorIntact(ctx: SimCtx, cells: number[]): boolean {
  if (cells.length === 0) return false;
  return cells.every((c) => ctx.st.grid[c] === CellKind.Floor);
}

/**
 * The corridor cells that realize a loop edge on the grid — the run of corridor
 * cells (roomOf -2) that connects ONLY the edge's two endpoint rooms. Found by a
 * BFS over corridor cells hugging room `a` toward a cell hugging room `b`, where
 * a cell is walkable only if every room-floor 4-neighbor belongs to a or b (so a
 * built cross-cut / dug tunnel is isolated from unrelated corridors). Returns the
 * cells or null if no clean corridor route exists (e.g. already bricked/collapsed).
 */
function loopCorridorCells(ctx: SimCtx, a: number, b: number, corridorCells: number[]): number[] | null {
  const st = ctx.st;
  const S = st.side;
  const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  const roomsTouched = (cell: number): Set<number> => {
    const x = cell % S;
    const y = (cell / S) | 0;
    const s = new Set<number>();
    for (const [dx, dy] of N4) {
      const nk = gi(x + dx, y + dy, S);
      const owner = st.roomOf[nk];
      if (st.grid[nk] === CellKind.Floor && owner >= 0) s.add(owner);
    }
    return s;
  };
  const passable = (cell: number): boolean => {
    if (st.grid[cell] !== CellKind.Floor || st.roomOf[cell] !== -2) return false;
    for (const id of roomsTouched(cell)) if (id !== a && id !== b) return false;
    return true;
  };
  const prev = new Int32Array(st.grid.length).fill(-2);
  const q: number[] = [];
  // Seed only from the precomputed corridor cells (avoids a full-grid scan).
  for (const i of corridorCells) {
    if (!passable(i)) continue;
    if (roomsTouched(i).has(a)) { prev[i] = -1; q.push(i); }
  }
  let hit = -1;
  for (let h = 0; h < q.length && hit < 0; h++) {
    const c = q[h];
    if (roomsTouched(c).has(b)) { hit = c; break; }
    const x = c % S;
    const y = (c / S) | 0;
    for (const [dx, dy] of N4) {
      const nk = gi(x + dx, y + dy, S);
      if (prev[nk] !== -2 || !passable(nk)) continue;
      prev[nk] = c;
      q.push(nk);
      if (roomsTouched(nk).has(b)) { hit = nk; break; }
    }
  }
  if (hit < 0) return null;
  const cells: number[] = [];
  for (let c = hit; c !== -1; c = prev[c]) cells.push(c);
  return cells.reverse();
}

/**
 * Find a cycle edge whose corridor an event may bring down / wall up, together
 * with its intact corridor cells. Prefers a still-intact DUG tunnel (bookkept in
 * `ctx.tunnels`), then falls back to any BUILT loop edge (isLoop, not a tunnel)
 * whose corridor is intact and whose removal keeps the graph connected. Extending
 * collapse/brick-off to built cross-cuts (removal is connectivity-safe on ANY
 * cycle edge) makes those events more common and more interesting.
 */
function findCycleEdgeToRemove(ctx: SimCtx): { edge: DungeonEdge; cells: number[] } | null {
  const st = ctx.st;
  // 1) An intact dug tunnel (cheapest — cells already known).
  const tunnel = ctx.tunnels.find((t) => t.edge.isLoop && corridorIntact(ctx, t.cells));
  if (tunnel) return { edge: tunnel.edge, cells: tunnel.cells };
  // 2) A BUILT loop edge. Its corridor cells are discovered ONCE (cached on ctx)
  //    — built-loop cells don't move; an event that removes one turns its cells
  //    to Wall, which the corridorIntact grid check then filters out.
  if (ctx.builtLoops === null) {
    ctx.builtLoops = [];
    const tunnelEdges = new Set(ctx.tunnels.map((t) => t.edge));
    const loopEdges = st.edges.filter((e) => e.isLoop && !tunnelEdges.has(e));
    if (loopEdges.length > 0) {
      const corridorCells: number[] = [];
      for (let i = 0; i < st.roomOf.length; i++) {
        if (st.roomOf[i] === -2 && st.grid[i] === CellKind.Floor) corridorCells.push(i);
      }
      for (const e of loopEdges) {
        const cells = loopCorridorCells(ctx, e.a, e.b, corridorCells);
        if (cells && cells.length > 0) ctx.builtLoops.push({ edge: e, cells });
      }
    }
  }
  for (const bl of ctx.builtLoops) {
    if (!corridorIntact(ctx, bl.cells)) continue; // already collapsed/bricked
    const remaining = st.edges.filter((x) => x !== bl.edge);
    if (!graphConnected(st.rooms.length, st.entranceId, remaining)) continue;
    return { edge: bl.edge, cells: bl.cells };
  }
  return null;
}

/** Pick `n` distinct rooms from `pool` using the rng (order-stable). */
function pickDistinct(ctx: SimCtx, pool: Room[], n: number): Room[] {
  if (pool.length <= n) return pool.slice();
  const chosen: Room[] = [];
  const used = new Set<number>();
  let guard = 0;
  while (chosen.length < n && guard < n * 8) {
    const r = ctx.rng.pick(pool);
    if (!used.has(r.id)) {
      used.add(r.id);
      chosen.push(r);
    }
    guard++;
  }
  return chosen;
}

/** A short trail of cells from a vault toward the entrance (dropped coins). */
function coinTrail(ctx: SimCtx, vault: Room): number[] {
  const st = ctx.st;
  const entrance = st.rooms[st.entranceId];
  let x = roomCx(vault);
  let y = roomCy(vault);
  const ex = roomCx(entrance);
  const ey = roomCy(entrance);
  const out: number[] = [];
  for (let i = 0; i < 3; i++) {
    x += Math.sign(ex - x);
    y += Math.sign(ey - y);
    const k = gi(x, y, st.side);
    if (st.grid[k] === CellKind.Floor) out.push(k);
  }
  return out;
}

function labelActor(key: string): string {
  return key.replace(/_/g, ' ');
}

function builderNoun(archetype: BuilderArchetype): string {
  switch (archetype) {
    case 'mausoleum': return 'the family';
    case 'mine': return 'the mining company';
    case 'fortress': return 'the garrison';
    case 'waterworks': return 'the town';
  }
}

function structureNoun(archetype: BuilderArchetype): string {
  switch (archetype) {
    case 'mausoleum': return 'mausoleum';
    case 'mine': return 'workings';
    case 'fortress': return 'hold';
    case 'waterworks': return 'undercity';
  }
}

// ─── Reachability assertion ──────────────────────────────────────────────────

/** Throw if any Floor cell is unreachable from the entrance-room center. */
function assertReachable(st: IntactState): void {
  const S = st.side;
  const e = st.rooms[st.entranceId];
  const start = gi(roomCx(e), roomCy(e), S);
  // The center may fall on a mask hole; seed from a real floor cell of the room.
  let seedCell = start;
  if (st.grid[seedCell] !== CellKind.Floor) {
    for (let i = 0; i < st.roomOf.length; i++) {
      if (st.roomOf[i] === e.id && st.grid[i] === CellKind.Floor) { seedCell = i; break; }
    }
  }
  const seen = new Uint8Array(st.grid.length);
  const q = [seedCell];
  seen[seedCell] = 1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    for (const d of [-1, 1, -S, S]) {
      const n = c + d;
      if (n >= 0 && n < st.grid.length && !seen[n] && st.grid[n] === CellKind.Floor) {
        seen[n] = 1;
        q.push(n);
      }
    }
  }
  for (let i = 0; i < st.grid.length; i++) {
    if (st.grid[i] === CellKind.Floor && !seen[i]) {
      throw new Error(`simulateHistory: floor cell ${i} stranded after events`);
    }
  }
}

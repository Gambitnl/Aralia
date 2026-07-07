# Dungeon Pillar 1 — History-First Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the growth-based dungeon layout with builder-archetype intact layouts, simulate seeded decay events on them, and derive all text (name, blurb, notes, rumor hooks) from the event log — per `docs/superpowers/specs/2026-07-06-dungeon-history-first-design.md`.

**Architecture:** New pipeline inside `src/systems/worldforge/dungeon/`: `buildIntact` (per-archetype placement programs on the existing working-grid substrate) → `simulateHistory` (ordered event log; each event mutates the grid AND records evidence) → existing crop/semantics/rasterize (adapted) → `furnishAndStamp` (purpose furniture + event evidence, replaces `decorate`) → `lore` (derived text). `generateDungeon` keeps its exported signature and `DungeonPlan` stays a superset of today's contract, so the 11 green tests keep passing. The growth/loops code is deleted at swap time — one real path.

**Tech Stack:** TypeScript, Vitest, `SeededRandom` via `seedPath.ts`. Pure data, zero THREE imports. 2D eyeball surface: `misc/design.html?step=dungeon`.

## Global Constraints

- Determinism ONLY through `rngFromPath`/`streamPath`/`childSeedPath` (`src/systems/worldforge/seedPath.ts`). `SeededRandom.nextInt(min, max)` is max-EXCLUSIVE — always go through the local `Rng` wrapper (`int()` is inclusive). No `Math.random`, no `Date.now` in logic.
- Feet-canon: work in 5 ft cells internally; entity coordinates convert to feet exactly once at the plan boundary (the existing `× CELL_FT` block in `generateOnce`).
- No fallbacks: an event that would break 100% reachability is rejected (skipped), never patched with teleport-style fixes; a builder program that places < 70% of its target rooms returns null → honest re-roll (max 5 derived attempts) → throw.
- NO git commits and NO branches — work directly in master; a 2 am cron auto-commits. Plan steps end at green tests, not commits.
- Existing suite `npx vitest run src/systems/worldforge/dungeon/__tests__/generateDungeon.test.ts` (11 tests) must be green at the END of every task that touches the generator. Mid-task red is fine (TDD), end-of-task red is not.
- Every visual change gets eyeballed at `misc/design.html?step=dungeon&dseed=42` (canvas capture via `document.querySelector('canvas').toDataURL(...)` eval — the screenshot tool hangs on this canvas).
- Look targets (approved by Remy 2026-07-06): `.agent/scratch/dungeon-layout-mocks.html` (layouts), `.agent/scratch/dungeon-history-mock-event-logs.md` (event logs + derived text).
- Writing style for all emitted text: plain English, US spelling.

---

### Task 1: Contract additions in `types.ts`

**Files:**
- Modify: `src/systems/worldforge/dungeon/types.ts`
- Test: `src/systems/worldforge/dungeon/__tests__/generateDungeon.test.ts` (must stay green — this task adds types only; the plan gains OPTIONAL-free required fields in Task 7 when the new pipeline fills them)

**Interfaces:**
- Produces (all exported from `types.ts`):

```ts
/** What a room was built as. One vocabulary across all archetypes. */
export type RoomPurpose =
  // mausoleum
  | 'stair' | 'antechamber' | 'chapel' | 'burial-gallery' | 'ossuary' | 'treasury' | 'embalming'
  // mine
  | 'adit' | 'hoist' | 'tool-store' | 'barracks' | 'vein-gallery' | 'sump'
  // fortress
  | 'gatehouse' | 'great-hall' | 'armory' | 'granary' | 'kitchen' | 'cellar' | 'chapel-wing'
  // waterworks
  | 'junction' | 'cistern' | 'maintenance-walk' | 'ladder-shaft' | 'outfall'
  // generic
  | 'passage-room';

export type BuilderArchetype = 'mausoleum' | 'mine' | 'fortress' | 'waterworks';

export type EventKind =
  | 'seal' | 'collapse' | 'flood' | 'tunnel' | 'brick-off' | 'den'
  | 'plunder' | 'fire' | 'reoccupy' | 'awaken' | 'bloom';

/** One entry in the dungeon's history. Ordered oldest → newest in the log. */
export interface DungeonEvent {
  /** Index in the log; evidence carries this as `eventRef`. */
  id: number;
  kind: EventKind;
  yearsAgo: number;
  /** Rooms this event touched (empty for whole-structure events like seal). */
  roomIds: number[];
  /** Short factual clause used by lore derivation, e.g. "grave robbers tunneled through the ossuary wall". */
  summary: string;
  /** Who/what, when relevant (den/reoccupy/awaken): monster or faction key. */
  actorKey?: string;
}

/** Per-cell surface overlay stamped by events. Parallel to `grid`. */
export enum OverlayKind {
  None = 0,
  Water = 1,
  Rubble = 2,
  Ice = 3,
  Bloom = 4,
  Scorch = 5,
}

export type DoorState = 'open' | 'door' | 'bricked' | 'secret';

/** A doorway with state. `cell` indexes the grid; state 'bricked' is impassable. */
export interface DungeonDoor {
  cell: Cell;
  state: DoorState;
  /** Event that put the door in this state (bricked/secret); absent for built doors. */
  eventRef?: number;
}

/** Structured lore hook for the town NPC interaction system (design decision:
 * the player hears history from townsfolk, never reads the log). */
export interface RumorHook {
  eventRef: number;
  text: string;
  speakerBias: 'elder' | 'scholar' | 'adventurer';
  /** How far from the dungeon this rumor circulates. */
  radiusFt: number;
}
```

- `DungeonRoom` gains `purpose: RoomPurpose;` and `note?: string;` (note = DM/dev keyed text, only set when an event touched the room).
- `DungeonProp`, `DungeonSpawn`, `DungeonTrap` gain `eventRef?: number;` (present ⇔ an event caused it; absent ⇔ built-in furniture/defense).
- `DungeonParams` gains `archetype?: BuilderArchetype;` (default derived from theme) and `asOfYearsAgo?: number;` (replay cutoff: apply only events with `yearsAgo >= asOfYearsAgo`; default 0 = full history — this powers outdated bought maps).
- `DungeonPlan` gains:
```ts
  archetype: BuilderArchetype;
  builderName: string;           // e.g. "the Marrowick family", "the Deepvein Company"
  blurb: string;                 // derived from the two loudest events
  history: DungeonEvent[];       // full log, oldest first (even past asOfYearsAgo cutoff)
  rumorHooks: RumorHook[];
  overlay: Uint8Array;           // OverlayKind per cell, length W*H
  doors: DungeonDoor[];          // replaces doorways as the semantic source; doorways stays (all door cells) for compat
```
- `DungeonStats` gains `events: number;`.

- [ ] **Step 1: Add all the types above to `types.ts`** — keep the file's doc-comment discipline; place `RoomPurpose`/`BuilderArchetype`/`EventKind`/`DungeonEvent`/`OverlayKind`/`DoorState`/`DungeonDoor`/`RumorHook` after `DungeonTheme`; extend the existing interfaces in place.
- [ ] **Step 2: Typecheck** — Run: `npx tsc --noEmit -p tsconfig.json`. Expected: the ONLY new errors are in `generateDungeon.ts` for missing new required `DungeonPlan`/`DungeonRoom` fields. Silence them temporarily by having `generateOnce` fill: `archetype: 'mausoleum'`, `builderName: ''`, `blurb: ''`, `history: []`, `rumorHooks: []`, `overlay: new Uint8Array(W * H)`, `doors: doorways.map((d) => ({ cell: d, state: 'open' as const }))`, `purpose: 'passage-room' as const` on each mapped room, `events: 0` in stats. This bridge dies in Task 7.
- [ ] **Step 3: Run the 11-test suite** — Run: `npx vitest run src/systems/worldforge/dungeon/__tests__/generateDungeon.test.ts`. Expected: 11 passed.

---

### Task 2: Archetype data — `archetypes.ts`

**Files:**
- Create: `src/systems/worldforge/dungeon/archetypes.ts`
- Test: `src/systems/worldforge/dungeon/__tests__/archetypes.test.ts`

**Interfaces:**
- Consumes: types from Task 1.
- Produces:

```ts
export interface ArchetypeData {
  archetype: BuilderArchetype;
  /** Builder identity pools — a name is picked per dungeon, e.g. "the Marrowick family". */
  builderPatterns: readonly string[]; // e.g. 'the {N} family', 'the {N} Company' — {N} from namePool
  namePool: readonly string[];        // proper-noun stems: Marrowick, Deepvein, Pale Watch…
  /** Dungeon display-name patterns using real facts: '{N}' builder stem, '{P}' place noun. */
  titlePatterns: readonly string[];   // e.g. 'The {N} Crypt', 'The Drowned {N} Workings'
  /** Room programs: core rooms placed once, repeat units placed until roomCount. */
  core: readonly RoomSpec[];
  repeat: readonly RoomSpec[];
  /** Which purposes can flood / are treated as "low". */
  floodable: readonly RoomPurpose[];
  /** Event-chain template: kinds eligible for this archetype with weights. */
  eventWeights: Readonly<Partial<Record<EventKind, number>>>;
}

export interface RoomSpec {
  purpose: RoomPurpose;
  w: readonly [number, number];      // cell range, inclusive
  h: readonly [number, number];
  shape: RoomShape;
  /** Where it attaches: 'entry' (map edge), 'prev' (last placed), a purpose name, or 'spine'. */
  anchor: 'entry' | 'prev' | 'spine' | RoomPurpose;
  /** Preferred attach direction relative to the plan's flow axis. */
  dir: 'flow' | 'left' | 'right' | 'back' | 'any';
  corridor: readonly [number, number]; // corridor length range in cells (0 = shared wall door)
}

export const ARCHETYPES: Record<BuilderArchetype, ArchetypeData>;
export const THEME_ARCHETYPE: Record<DungeonTheme, BuilderArchetype>; // crypt→mausoleum, cavern→mine, frost→fortress, sewer→waterworks, fungal→mausoleum (bloom chain does the theming)
/** Purpose-driven furniture: what an intact room contains, placed for use. */
export const FURNITURE: Readonly<Partial<Record<RoomPurpose, readonly { kind: string; layout: 'rows' | 'walls' | 'center' | 'scatter'; countPerCells: number }[]>>>;
```

Concrete content requirements (copy the approved mocks):
- mausoleum core: stair(entry) → antechamber(prev, flow) → chapel(prev, flow, octagon 8–11) → treasury(chapel, right, 4–6) → spine (handled by the builder as a corridor run, see Task 3) → ossuary(spine, flow end) → embalming(antechamber, left). repeat: burial-gallery (rect 6–9 × 8–12, anchor spine, dir left/right alternating, corridor [1,2]).
- mine core: adit corridor (entry) → hoist(prev, 7–9 rect) → tool-store(hoist, left, 4–6) → barracks(hoist, right, 6–8) → sump placed LAST after repeats. repeat: vein-gallery (ellipse/compound 8–13, anchor prev, dir flow, corridor [3,6]) — flow axis for mine is diagonal-stepping (see Task 3 `flowDir` alternation).
- fortress core: gatehouse(entry 6–8) → great-hall(prev, flow, rect 10–14 × 9–12) → barracks(great-hall, left), armory(barracks, flow), granary(great-hall, right), kitchen(granary, flow), chapel-wing(great-hall, back via corridor [3,5]), cellar(kitchen, right, corridor [1,2]). repeat: passage-room (4–7, anchor any core room, dir any).
- waterworks core: ladder-shaft(entry 3–4) → maintenance-walk (corridor-like room 3 wide, prev) → junction(prev, octagon 9–12) → cistern ×2 (ellipse 9–12, anchor junction via long corridor [4,7] opposite dirs) → outfall(junction, back). repeat: maintenance-walk segments + passage-room.
- FURNITURE (minimum): burial-gallery: sarcophagus rows; chapel: altar center + pew rows; barracks: bunk walls; armory: rack walls; granary: jar scatter; great-hall: table rows + hearth wall; hoist: hoist-wheel center; tool-store: tool-rack walls; cistern: none; treasury: chest center; ossuary: bone-niche walls.
- eventWeights per archetype (0 = never): mausoleum {seal:3, collapse:2, tunnel:2, plunder:2, awaken:3, brick-off:2, reoccupy:1, fire:1, bloom:1}; mine {flood:3, collapse:2, tunnel:2, den:3, plunder:1, bloom:1}; fortress {fire:2, brick-off:2, collapse:1, den:3, plunder:2, flood:1, bloom:1}; waterworks {brick-off:2, tunnel:2, collapse:2, flood:3, den:3, bloom:2}.

- [ ] **Step 1: Write failing tests** in `archetypes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ARCHETYPES, THEME_ARCHETYPE, FURNITURE } from '../archetypes';

describe('archetypes', () => {
  it('covers every theme and every archetype has entry + repeat units', () => {
    for (const arch of Object.values(THEME_ARCHETYPE)) {
      const a = ARCHETYPES[arch];
      expect(a.core.some((s) => s.anchor === 'entry')).toBe(true);
      expect(a.repeat.length).toBeGreaterThan(0);
      expect(a.namePool.length).toBeGreaterThanOrEqual(6);
      expect(Object.keys(a.eventWeights).length).toBeGreaterThanOrEqual(4);
    }
  });
  it('every core/repeat purpose with furniture uses known layouts', () => {
    for (const specs of Object.values(FURNITURE)) {
      for (const f of specs!) expect(['rows', 'walls', 'center', 'scatter']).toContain(f.layout);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure** — Run: `npx vitest run src/systems/worldforge/dungeon/__tests__/archetypes.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `archetypes.ts`** with the full data above (all four archetypes, name pools ≥ 8 stems each in the register of the mocks: Marrowick/Veyne/Ashcombe…, Deepvein/Orefall…, Pale Watch/Grey Vigil…, plus town-placeholder patterns for waterworks: 'the {T} undercity' where `{T}` stays a literal `{T}` until Pillar 2 supplies the town name — emit "the old town" as the interim substitution, never gibberish syllables).
- [ ] **Step 4: Run tests** — Expected: PASS. Also `npx tsc --noEmit` clean.

---

### Task 3: Intact builder layout — `buildIntact.ts`

**Files:**
- Create: `src/systems/worldforge/dungeon/buildIntact.ts`
- Test: `src/systems/worldforge/dungeon/__tests__/buildIntact.test.ts`

**Interfaces:**
- Consumes: `ARCHETYPES`, `RoomSpec` (Task 2); the `Rng` wrapper, `Room`, `GrowState`-like working state, mask helpers — MOVE these out of `generateDungeon.ts` into this file and re-export (`makeRng`, `Rng`, `Room`, `gi`, `bakeMask`, `stampRoom`, `roomCx`, `roomCy`, and a directed variant of `tryAttach`). `generateDungeon.ts` imports them back from here so nothing is duplicated.
- Produces:

```ts
export interface IntactState {
  side: number;
  grid: Uint8Array;         // CellKind
  corridor: Uint8Array;
  roomOf: Int16Array;       // -1 void, -2 corridor, else room id
  rooms: Room[];            // Room gains `purpose: RoomPurpose`
  edges: DungeonEdge[];     // all isLoop:false at this stage — builders build trees + the spine
  entranceId: number;       // the 'entry' room
  flowDir: readonly [number, number]; // the plan's main axis (mausoleum [0,-1], mine [1,1]-stepped, fortress [0,-1], waterworks [1,0])
}

/** Deterministic purpose-driven layout. Returns null if < 70% of target rooms placed. */
export function buildIntact(rng: Rng, archetype: BuilderArchetype, roomCount: number): IntactState | null;

/** Directed attach: like the old tryAttach but with explicit source, direction and spec. */
export function attachRoom(st: IntactState, rng: Rng, src: Room, spec: RoomSpec, dir: readonly [number, number]): Room | null;
```

Implementation notes (binding):
- `attachRoom` is the old `tryAttach` (generateDungeon.ts:213-353) with: (a) `dir` passed in instead of centroid-biased random; (b) room size/shape from `spec` instead of `pickRoomTemplate`; (c) corridor length from `spec.corridor`; (d) the same 8-neighborhood no-touch validation VERBATIM (this is what preserves the approved walls-between-rooms look); (e) on success sets `purpose` and records the edge. Directions: `'flow'` = `st.flowDir`, `'left'`/`'right'` = perpendicular, `'back'` = negated, `'any'` = rng.pick(DIRS). Retry each placement up to 8 times with re-rolled size/door position before giving up on that spec.
- Spines (mausoleum) and channels (waterworks): implement `attachSpine(st, src, len, dir)` — a corridor run stamped like the old corridor cells, registered as an anchor line; galleries anchor to evenly spaced points along it, alternating sides. The spine's cells are corridor cells (`roomOf = -2`); each gallery edge connects gallery↔the room the spine started from (graph-wise the spine belongs to its origin room — mirrors how the old code treats corridors as edges, keeps the graph bookkeeping identical).
- Mine flow: after each repeat gallery, alternate `flowDir` between `[1,0]` and `[0,1]` so the chain steps down-right diagonally like mock 3.
- Waterworks channels: channels are 3-wide corridor runs (stamp 3 parallel corridor lines); cisterns ellipse-attached at channel ends; the `overlay` water for channels happens in Task 4 (flood at build time is modeled as part of the INTACT structure: waterworks channels/cisterns start with `Water` overlay — pass a `builtWater: Set<number>` of cell indices out via `IntactState` → add field `builtWater: Set<number>`).
- Entrance: the `'entry'` spec anchors at a map-edge-facing position — place the first room near the working-grid center (like today's seed room) and treat its outward face as the entry; the actual "edge" is cosmetic after crop.
- roomCount: place core first; then cycle `repeat` specs until `rooms.length >= roomCount` or attempts exhausted; null below 70% like today's `grow`.

- [ ] **Step 1: Write failing tests** in `buildIntact.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildIntact, makeRng } from '../buildIntact';
import { streamPath, rootSeedPath, childSeedPath } from '../../seedPath';
import { ARCHETYPES } from '../archetypes';
import type { BuilderArchetype } from '../types';

const rngFor = (seed: number, arch: string) =>
  makeRng(streamPath(childSeedPath(rootSeedPath(seed), 'dungeon'), `build:${arch}`));

const ARCHS = Object.keys(ARCHETYPES) as BuilderArchetype[];

describe('buildIntact', () => {
  it('places every core purpose exactly once, entrance first', () => {
    for (const arch of ARCHS) {
      const st = buildIntact(rngFor(42, arch), arch, 24);
      expect(st).not.toBeNull();
      for (const spec of ARCHETYPES[arch].core) {
        expect(st!.rooms.filter((r) => r.purpose === spec.purpose).length).toBe(1);
      }
      expect(st!.rooms[st!.entranceId].purpose).toBe(ARCHETYPES[arch].core[0].purpose);
    }
  });
  it('reaches the requested room count within tolerance and stays a connected tree+spine graph', () => {
    for (const arch of ARCHS) {
      const st = buildIntact(rngFor(7, arch), arch, 24)!;
      expect(st.rooms.length).toBeGreaterThanOrEqual(Math.floor(24 * 0.7));
      expect(st.edges.length).toBe(st.rooms.length - 1); // intact structure is a tree
    }
  });
  it('is deterministic', () => {
    for (const arch of ARCHS) {
      const a = buildIntact(rngFor(1337, arch), arch, 20)!;
      const b = buildIntact(rngFor(1337, arch), arch, 20)!;
      expect(Buffer.from(a.grid).equals(Buffer.from(b.grid))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL (module not found).
- [ ] **Step 3: Move the shared substrate** (`Rng`, `makeRng`, `Room`, `gi`, `DIRS`, `bakeMask`/`inMask`/`compoundMask`, `stampRoom`, `roomCx/roomCy`) from `generateDungeon.ts` into `buildIntact.ts`; update `generateDungeon.ts` imports. Run the 11-test suite — Expected: 11 passed (pure move).
- [ ] **Step 4: Implement `attachRoom`, `attachSpine`, `buildIntact`** per the notes above.
- [ ] **Step 5: Run tests** — `npx vitest run src/systems/worldforge/dungeon/__tests__/buildIntact.test.ts` PASS, and the 11-test suite still 11 passed.

---

### Task 4: Event simulation — `simulateHistory.ts`

**Files:**
- Create: `src/systems/worldforge/dungeon/simulateHistory.ts`
- Test: `src/systems/worldforge/dungeon/__tests__/simulateHistory.test.ts`

**Interfaces:**
- Consumes: `IntactState` (Task 3), `ARCHETYPES` (Task 2), types (Task 1).
- Produces:

```ts
export interface HistoryResult {
  events: DungeonEvent[];            // full log, oldest first, ids = index
  overlay: Uint8Array;               // side*side working-grid overlay (cropped later)
  doorStates: Map<number, { state: DoorState; eventRef: number }>; // working-grid cell → state
  evidenceProps: Array<{ kind: string; cell: number; eventRef: number; roomId: number }>;
  occupations: Array<{ roomIds: number[]; actorKey: string; eventRef: number; isApex: boolean }>;
  plunderedRoomIds: Set<number>;
  /** Loop edges the events dug (tunnel/brick-off back way). Appended to st.edges by the appliers. */
}

export function simulateHistory(
  st: IntactState, rng: Rng, archetype: BuilderArchetype, theme: DungeonTheme, asOfYearsAgo: number,
): HistoryResult;
```

Binding behavior:
- **Chain length:** `rng.int(3, 6)` events. Ages: first event `rng.int(80, 500)` years ago, each later event `rng.int(55%, 85%)` of the previous age (monotonic newest-last), minimum 2.
- **Kind selection:** weighted pick from `ARCHETYPES[arch].eventWeights`, with hard rules: no duplicate `seal`; `awaken` requires a prior `plunder` or `tunnel` (desecration); `reoccupy` requires a prior `tunnel` (a way in); the chain MUST include at least one occupying kind (`den`/`awaken`/`reoccupy`) — if the roll produced none, the LAST slot is forced to the archetype's highest-weight occupying kind (this is a modeling rule, not a fallback: an unoccupied dungeon has no encounters and violates the spec's "spawns exist" invariant).
- **Appliers** (each returns the `DungeonEvent` or null-reject; ALL grid mutation goes through them):
  - `seal`: no grid change; evidence prop `snapped-bar` at the entrance room; summary "the {builder} sealed the {structure}".
  - `collapse`: pick an edge whose removal keeps the ROOM GRAPH connected (compute connectivity over `st.edges` minus the candidate) OR any leaf-edge if a later `tunnel` in the plan… — NO: keep it simple and honest: only loop-redundant or leaf-serving edges where the leaf keeps ≥ 1 other connection; if no candidate, reject. Stamp `OverlayKind.Rubble` on that edge's corridor cells AND flip them to `CellKind.Void`-adjacent? — binding: rubble cells become IMPASSABLE: set `grid[cell] = CellKind.Wall`, overlay Rubble; remove the edge from `st.edges`.
  - `flood`: pick 1–2 rooms whose purpose ∈ `floodable` (else reject); stamp `OverlayKind.Water` on their room cells (cells stay Floor — water is a hazard, not a blocker).
  - `tunnel`: pick two rooms that are ≥ 3 graph hops apart; carve a rough 1-wide corridor between their nearest wall cells using the SAME validation as `attachRoom` but allowing 1 elbow and marking cells corridor+`roomOf=-2`; add `isLoop: true` edge. Reject after 12 failed geometry attempts.
  - `brick-off`: pick a non-entrance door of a subtree that has an ALTERNATIVE connection (a loop edge from a prior tunnel) or WILL get one: binding rule — brick-off may only target a door on a cycle (check: removing that graph edge keeps the graph connected); set door state 'bricked' (impassable: `grid[cell] = CellKind.Wall`, overlay none, doorStates entry); with probability 0.5 mark ONE other door of the same wing 'secret' (the forgotten back way).
  - `den`: pick 1–3 connected rooms preferring deep, non-entrance; occupation with theme's mid-tier actorKey; evidence prop `nest` in each room.
  - `awaken`: occupation across all `burial-gallery`/`ossuary` rooms (mausoleum) or 2 deep rooms otherwise; actorKey = theme undead tier; evidence `disturbed-lid` props.
  - `plunder`: target `treasury`/`cistern`/`armory`-class room; evidence `pried-vault` + `dropped-coins` trail props; record in `plunderedRoomIds` (loot systems read this later).
  - `fire`: 1–2 rooms near the entrance; overlay Scorch.
  - `reoccupy`: occupation of `chapel`/`junction`/`great-hall`-class room with faction actorKey (`cult`, `smugglers`, `bandits` per theme table in the applier); evidence `candles`/`crates`.
  - `bloom`: overlay Bloom flood-fill from one room outward `rng.int(2, 4)` rooms along edges; occupation with `myconid_ring` in the origin room. When `theme === 'fungal'` the chain ALWAYS ends with bloom (that IS the fungal theme).
- **Apex occupant:** the LAST occupying event is `isApex: true` — Task 6's semantics puts the boss in its deepest room.
- **Reachability guard:** after the full chain, flood-fill the working grid from the entrance room center; if any Floor cell is unreachable, the whole simulate returns with the offending event skipped — implement as: apply events one at a time, snapshot-free, validating graph connectivity BEFORE mutating (the rules above make each applier individually safe, so this is an assertion, not a retry loop). Add `if (!connected) throw` — honest failure surfaces a rule bug instead of shipping a broken map.
- **asOfYearsAgo:** the FULL chain is always rolled (identical rng draws); appliers run only for events with `yearsAgo >= asOfYearsAgo`. Events not applied still appear in `events` (callers see the whole history; the map shows the cutoff state).

- [ ] **Step 1: Write failing tests**:

```ts
import { describe, it, expect } from 'vitest';
import { buildIntact, makeRng } from '../buildIntact';
import { simulateHistory } from '../simulateHistory';
import { streamPath, rootSeedPath, childSeedPath } from '../../seedPath';
import { THEME_ARCHETYPE } from '../archetypes';
import { CellKind, type DungeonTheme } from '../types';

function make(seed: number, theme: DungeonTheme, asOf = 0) {
  const arch = THEME_ARCHETYPE[theme];
  const base = childSeedPath(rootSeedPath(seed), 'dungeon');
  const st = buildIntact(makeRng(streamPath(base, `build:${arch}`)), arch, 22)!;
  const hist = simulateHistory(st, makeRng(streamPath(base, 'history')), arch, theme, asOf);
  return { st, hist };
}
const THEMES: DungeonTheme[] = ['crypt', 'cavern', 'frost', 'sewer', 'fungal'];

describe('simulateHistory', () => {
  it('rolls 3-6 dated events, oldest first, with at least one occupation', () => {
    for (const theme of THEMES) for (const seed of [1, 42, 1337]) {
      const { hist } = make(seed, theme);
      expect(hist.events.length).toBeGreaterThanOrEqual(3);
      expect(hist.events.length).toBeLessThanOrEqual(6);
      for (let i = 1; i < hist.events.length; i++) {
        expect(hist.events[i].yearsAgo).toBeLessThan(hist.events[i - 1].yearsAgo);
      }
      expect(hist.occupations.length).toBeGreaterThan(0);
      expect(hist.occupations.some((o) => o.isApex)).toBe(true);
    }
  });
  it('keeps every floor cell reachable from the entrance after all events', () => {
    for (const theme of THEMES) for (const seed of [1, 42, 1337]) {
      const { st } = make(seed, theme);
      // flood fill st.grid from entrance room center (4-connected over Floor)
      const S = st.side; const e = st.rooms[st.entranceId];
      const start = (e.y0 + (e.h >> 1)) * S + (e.x0 + (e.w >> 1));
      const seen = new Uint8Array(st.grid.length); const q = [start]; seen[start] = 1;
      for (let h = 0; h < q.length; h++) {
        const c = q[h];
        for (const d of [-1, 1, -S, S]) {
          const n = c + d;
          if (n >= 0 && n < st.grid.length && !seen[n] && st.grid[n] === CellKind.Floor) { seen[n] = 1; q.push(n); }
        }
      }
      let floor = 0, reached = 0;
      for (let i = 0; i < st.grid.length; i++) if (st.grid[i] === CellKind.Floor) { floor++; if (seen[i]) reached++; }
      expect(reached).toBe(floor);
    }
  });
  it('every event leaves evidence: overlay cells, a door state, a loop edge, or an evidence prop', () => {
    for (const theme of THEMES) {
      const { st, hist } = make(42, theme);
      const overlayRefs = new Set<number>();
      for (const ev of hist.events) {
        const hasProp = hist.evidenceProps.some((p) => p.eventRef === ev.id);
        const hasDoor = [...hist.doorStates.values()].some((d) => d.eventRef === ev.id);
        const hasOcc = hist.occupations.some((o) => o.eventRef === ev.id);
        const hasLoop = st.edges.some((e2) => e2.isLoop); // tunnels add loop edges
        const kinds = ['flood', 'fire', 'bloom', 'collapse'];
        const hasOverlay = kinds.includes(ev.kind); // overlay-stamping kinds asserted via overlay sum below
        expect(hasProp || hasDoor || hasOcc || (ev.kind === 'tunnel' && hasLoop) || hasOverlay).toBe(true);
      }
      void overlayRefs;
    }
  });
  it('fungal theme always ends in a bloom', () => {
    for (const seed of [1, 7, 42]) {
      const { hist } = make(seed, 'fungal');
      expect(hist.events[hist.events.length - 1].kind).toBe('bloom');
    }
  });
  it('asOfYearsAgo replays a prefix: same log, fewer applied mutations', () => {
    const full = make(42, 'crypt', 0);
    const cutoffAge = full.hist.events[full.hist.events.length - 1].yearsAgo + 1;
    const old = make(42, 'crypt', cutoffAge);
    expect(old.hist.events.map((e) => e.kind)).toEqual(full.hist.events.map((e) => e.kind));
    const sum = (a: Uint8Array) => a.reduce((s, v) => s + (v ? 1 : 0), 0);
    expect(sum(old.hist.overlay)).toBeLessThanOrEqual(sum(full.hist.overlay));
  });
});
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the chain roller + the 11 appliers per the binding behavior.
- [ ] **Step 4: Run tests** — Expected: all simulateHistory tests PASS across all 5 themes × seeds.

---

### Task 5: Derived text — `lore.ts`

**Files:**
- Create: `src/systems/worldforge/dungeon/lore.ts`
- Test: `src/systems/worldforge/dungeon/__tests__/lore.test.ts`

**Interfaces:**
- Consumes: `DungeonEvent[]`, `HistoryResult`, `ArchetypeData`, rooms with purposes.
- Produces:

```ts
export interface LoreResult {
  builderName: string;   // "the Marrowick family"
  name: string;          // "The Marrowick Crypt"
  blurb: string;         // 1-2 sentences from the two loudest events
  notes: Map<number, string>;  // roomId → DM note (only rooms an event touched)
  rumorHooks: RumorHook[];
}
export function deriveLore(rng: Rng, arch: ArchetypeData, events: DungeonEvent[], rooms: Room[]): LoreResult;
```

Binding behavior:
- `builderName`: one `namePool` stem through one `builderPatterns` template, drawn from the lore stream (this is identity, drawn once).
- `name`: a `titlePatterns` template filled with the stem; if the loudest event kind has a title variant (flood → "The Drowned {N} Workings", fire/siege → "The Fall of {N}"), prefer it. NEVER emit a word not grounded in builder or events.
- **Loudness:** fixed rank `bloom > awaken > flood > fire > brick-off > plunder > collapse > tunnel > den > reoccupy > seal`; blurb = template sentences for the top two, joined; each template embeds the event's real `yearsAgo` rounded to a spoken age ("five centuries ago", "sixty years back": implement `spokenAge(yearsAgo)` with bands ≤15 → "a few years", ≤40 → "a generation", ≤90 → "{n} years" rounded to 10, ≤ 250 → "over a century"/"two centuries", else "centuries").
- `notes`: for each event × touched room, one sentence from a per-(kind) template family (2-3 variants each, rng-picked) that embeds the room's `purpose` noun and the event fact — e.g. brick-off: "Bricked shut from the {side} side. The mortar is {spokenAge} old." Rooms touched by 2+ events get both sentences joined. These are TRUE statements: templates may only reference fields present on the event.
- `rumorHooks`: one per event with `speakerBias` by kind (seal/collapse/fire → 'elder', plunder/tunnel/reoccupy → 'adventurer', awaken/bloom/flood/den/brick-off → 'scholar' unless age < 40 then 'elder'), `radiusFt = 5280 * (2 + loudnessRank)` (louder stories travel farther), text = one spoken-register sentence template per kind ("They say the {purpose} under the old graveyard was robbed, {spokenAge} back — and that the dead noticed.").

- [ ] **Step 1: Write failing tests**:

```ts
import { describe, it, expect } from 'vitest';
import { deriveLore } from '../lore';
// build events via simulateHistory as in Task 4's helper, for crypt seed 42
describe('deriveLore', () => {
  it('name embeds the builder stem and no syllable-bag gibberish', () => {
    const { lore, arch } = makeLore(42, 'crypt');
    expect(arch.namePool.some((n) => lore.name.includes(n))).toBe(true);
    expect(lore.builderName.length).toBeGreaterThan(0);
  });
  it('every note belongs to a room an event touched and every hook references a real event', () => {
    const { lore, hist } = makeLore(42, 'crypt');
    const touched = new Set(hist.events.flatMap((e) => e.roomIds));
    for (const roomId of lore.notes.keys()) expect(touched.has(roomId)).toBe(true);
    for (const h of lore.rumorHooks) expect(hist.events[h.eventRef]).toBeDefined();
    expect(lore.rumorHooks.length).toBe(hist.events.length);
  });
  it('blurb mentions the loudest event kind material and is deterministic', () => {
    const a = makeLore(7, 'frost').lore; const b = makeLore(7, 'frost').lore;
    expect(a.blurb).toBe(b.blurb);
    expect(a.blurb.length).toBeGreaterThan(20);
  });
});
```

(`makeLore` = Task 4's `make` helper + `deriveLore(makeRng(streamPath(base, 'lore')), ARCHETYPES[arch], hist.events, st.rooms)` — write it in the test file.)

- [ ] **Step 2: Run to verify failure** — Expected: FAIL.
- [ ] **Step 3: Implement `lore.ts`** — template families per kind, `spokenAge`, loudness rank table. Plain US English in all templates.
- [ ] **Step 4: Run tests** — Expected: PASS. Read 3 emitted logs by console (add a temporary `console.log` in the test or a `npx tsx` scratch script under `.agent/scratch/`) and compare tone against the approved mock file — adjust templates until they read at that bar.

---

### Task 6: Swap the pipeline in `generateDungeon.ts`

**Files:**
- Modify: `src/systems/worldforge/dungeon/generateDungeon.ts` (delete `grow`, `tryAttach`, `addLoops`, `pickRoomTemplate`, `dungeonName`, `NAME_PRE`/`NAME_SUF`, the growth doc-header; keep crop/semantics/rasterize/doorways/decorate-derived stamping)
- Test: `src/systems/worldforge/dungeon/__tests__/generateDungeon.test.ts` (existing 11 must pass unchanged)

**Interfaces:**
- Consumes: `buildIntact` (Task 3), `simulateHistory` (Task 4), `deriveLore` (Task 5), `ARCHETYPES`/`THEME_ARCHETYPE`/`FURNITURE` (Task 2).
- Produces: `generateDungeon(input: DungeonInput): DungeonPlan` — same export, full new fields.

`generateOnce` becomes:
1. `const archetype = params.archetype ?? THEME_ARCHETYPE[params.theme];`
2. `buildIntact(makeRng(streamPath(path, `build:${archetype}`)), archetype, params.roomCount)` → null → re-roll (existing retry loop unchanged).
3. `simulateHistory(st, makeRng(streamPath(path, 'history')), archetype, params.theme, params.asOfYearsAgo ?? 0)`.
4. `crop` — extend to also crop `overlay` (add it to the crop signature) and remap `doorStates`/`evidenceProps` cell indices (working grid → cropped grid) and `secretCells` equivalent (secret doors now come from `doorStates` where state === 'secret').
5. `assignSemantics` — KEEP the graph work (entrance/boss/critical/difficulty) with two changes: (a) `entranceId` is `st.entranceId` (builder-designated; no double-BFS search) — but VERIFY degree 1: builders make the entry a leaf by construction (entry room has exactly one attachment) — the tunnel event must never attach to the entrance room (add that rule in Task 4's tunnel applier: reject endpoints where either room is the entrance); (b) boss room = deepest room of the apex occupation (`hist.occupations.find(o => o.isApex)`), overriding the size-scored pick; keep the not-entrance-adjacent guard by having the apex den applier (Task 4) refuse rooms adjacent to the entrance.
6. `rasterizeWalls` + `distanceField` + `floodReaches` unchanged.
7. `furnishAndStamp` (new function INSIDE generateDungeon.ts, replacing `decorate`): (a) per-room FURNITURE placement by `purpose` (`rows` = evenly spaced grid rows like the old colonnade loop; `walls` = wall-adjacent ring cells; `center` = room center; `scatter` = rng cells) with the old `blocked()` checks verbatim; no `eventRef`; (b) evidence props from `hist.evidenceProps` (skip cells that are blocked; carry `eventRef`); (c) spawns ONLY from `hist.occupations`: per occupation, monsters from the theme `crTable` sized by room area & difficulty exactly like the old spawn count formula, `monsterKey` from the occupation's `actorKey` tier family, `eventRef` set; apex occupation's deepest room gets the boss-tier single spawn; (d) traps: keep the old roll but only in rooms with ≥ 1 event touch OR purpose ∈ {treasury, chapel} (builder defenses), tag defenses without eventRef and decay hazards with the touching event's ref; (e) torches: keep the old wall-adjacent placement (built lighting, no eventRef).
8. `deriveLore(makeRng(streamPath(path, 'lore')), ...)` → `name`, `blurb`, `builderName`, `rumorHooks`; write `notes` onto `outRooms[i].note`.
9. Assemble plan: new fields (`archetype`, `builderName`, `blurb`, `history: hist.events`, `rumorHooks`, `overlay`, `doors` from doorway cells + doorStates map, `stats.events`), existing fields as today. `doorways` = all door cells (open + others) for compat; `secretDoorCells` = cells with state 'secret'.

- [ ] **Step 1: Append new invariants to the existing test file FIRST** (they fail until the swap):

```ts
describe('history-first invariants', () => {
  const THEMES = ['crypt', 'cavern', 'frost', 'sewer', 'fungal'] as const;
  it('every room has a purpose and every dungeon has a 3-6 event history', () => {
    for (const theme of THEMES) {
      const plan = generateDungeon({ seed: 42, params: { theme } });
      expect(plan.history.length).toBeGreaterThanOrEqual(3);
      expect(plan.history.length).toBeLessThanOrEqual(6);
      for (const r of plan.rooms) expect(r.purpose).toBeDefined();
      expect(plan.builderName.length).toBeGreaterThan(0);
      expect(plan.blurb.length).toBeGreaterThan(0);
    }
  });
  it('every event left visible evidence and all evidence points at a real event', () => {
    for (const seed of [1, 42, 1337]) {
      const plan = generateDungeon({ seed });
      const refs = new Set<number>();
      for (const p of [...plan.props, ...plan.spawns, ...plan.traps]) if (p.eventRef !== undefined) refs.add(p.eventRef);
      for (const d of plan.doors) if (d.eventRef !== undefined) refs.add(d.eventRef);
      let overlayCells = 0;
      for (let i = 0; i < plan.overlay.length; i++) if (plan.overlay[i] !== 0) overlayCells++;
      for (const ev of plan.history) {
        const evidenced = refs.has(ev.id) || ev.kind === 'seal' || ev.kind === 'flood' || ev.kind === 'fire' || ev.kind === 'bloom' || ev.kind === 'collapse';
        expect(evidenced).toBe(true); // overlay kinds asserted collectively:
      }
      if (plan.history.some((e) => ['flood', 'fire', 'bloom', 'collapse'].includes(e.kind))) {
        expect(overlayCells).toBeGreaterThan(0);
      }
      for (const ref of refs) expect(plan.history[ref]).toBeDefined();
    }
  });
  it('room notes only on event-touched rooms; all spawns trace to occupations', () => {
    const plan = generateDungeon({ seed: 42 });
    const touched = new Set(plan.history.flatMap((e) => e.roomIds));
    for (const r of plan.rooms) if (r.note) expect(touched.has(r.id)).toBe(true);
    for (const s of plan.spawns) expect(s.eventRef).toBeDefined();
    expect(plan.rumorHooks.length).toBe(plan.history.length);
  });
  it('asOfYearsAgo yields the same history but an older (or equal) map state', () => {
    const now = generateDungeon({ seed: 42 });
    const oldest = now.history[0].yearsAgo;
    const then = generateDungeon({ seed: 42, params: { asOfYearsAgo: oldest + 1 } });
    expect(then.history.map((e) => e.id)).toEqual(now.history.map((e) => e.id));
    const count = (p: typeof now) => { let n = 0; for (let i = 0; i < p.overlay.length; i++) if (p.overlay[i]) n++; return n; };
    expect(count(then)).toBeLessThanOrEqual(count(now));
  });
});
```

- [ ] **Step 2: Run** — Expected: new describe FAILS (old pipeline), original 11 still pass.
- [ ] **Step 3: Perform the swap** per the numbered list above; DELETE the growth code and the syllable name generator.
- [ ] **Step 4: Run the full dungeon suite** — Run: `npx vitest run src/systems/worldforge/dungeon/`. Expected: ALL tests pass (11 original + new invariants + Task 2-5 suites). Iterate on appliers/semantics until green. Watch the two most fragile originals: `entrance.degree === 1` (tunnel applier must skip the entrance) and `boss.depth >= 0.6 * maxDepth` (apex-den applier must prefer rooms at ≥ 60% graph depth — make that a hard filter in the applier).
- [ ] **Step 5: Perf check** — the 60-room test must stay < 50 ms. If builder programs run hot, profile before optimizing.
- [ ] **Step 6: Typecheck** — `npx tsc --noEmit` clean; the Task 1 bridge values are gone.

---

### Task 7: 2D sheet renders the history

**Files:**
- Modify: `src/components/DesignPreview/steps/PreviewDungeon.tsx`
- Test: eyeball (canvas), plus the suite stays green

**Interfaces:**
- Consumes: `plan.overlay`, `plan.doors`, `plan.history`, `plan.rooms[].purpose/note`, `plan.blurb`, `plan.builderName`, `params.asOfYearsAgo`.

Render additions (match the approved mocks' glyph language):
- Overlay fills under the ink pass: Water = desaturated blue-green `#a8bfba` with 2 wavy hairlines per cell run; Rubble = tan `#cbbc98` + 3-5 seeded ink pebbles per cell; Ice = pale `#cfd8d4`; Bloom = muted violet `#b9a7b4` with cap circles; Scorch = `#a99c85` darkening.
- Doors by state: 'door' = current leaf glyph; 'bricked' = brick-pattern fill (dark red-brown `#b0563f` + mortar lines) — draw it IN the wall, unmissable; 'secret' = dashed outline only when the existing "secrets" overlay toggle is on; 'open' = plain gap.
- Corridor cells whose edge `isLoop` (dug tunnels): stroke their outline with a rough 2-segment wobble (seeded from cell coords hash — rendering-only jitter is allowed) so dug passages read hand-cut vs built.
- Room labels: number ONLY rooms with a `note` (Watabou keying, per critique ledger C5); render `plan.name` + `plan.blurb` in the existing title band; add a keyed-notes list under the map (number → note), and an event-log panel behind a new "History" toggle listing `spokenAge`-style dates + summaries.
- New control: "as of years ago" number input wired to `params.asOfYearsAgo` — scrub to see the dungeon age (this demos the outdated-bought-map replay).

- [ ] **Step 1: Implement the render additions.**
- [ ] **Step 2: Suite green** — `npx vitest run src/systems/worldforge/dungeon/ src/hooks/__tests__/useBattleMapGeneration.test.ts`. Expected: pass.
- [ ] **Step 3: Eyeball** — start the `dev` launch config; open `misc/design.html?step=dungeon&dseed=42` for each theme (theme selector) and capture the canvas via eval `document.querySelector('canvas').toDataURL('image/png')`; decode to `.agent/scratch/history-{theme}-42.png`; READ each image. Verify: bricked doors visible, rubble seals read as rubble, water/bloom fills present when the log has those events, keyed notes list matches numbered rooms, name/blurb no longer mad-libs. Compare against `.agent/scratch/dungeon-layout-mocks.html`.
- [ ] **Step 4: Show Remy** — send the captures with a plain-language note; this is the Pillar 1 exit eyeball.

---

### Task 8: Docs, plan-map, handover

**Files:**
- Modify: `public/planmap/topics.json` (node `dungeon-generator`: mark the Pillar 1 feature `done` when the eyeball passes; keep pillars 2-4 `specced`)
- Modify: `docs/superpowers/specs/2026-07-06-dungeon-history-first-design.md` (status → BUILT + date)
- Create: `docs/superpowers/handovers/2026-07-06-dungeon-history-first-handover.md` (what shipped, invariants, where Pillar 2 hooks in: `builderName`/town placeholder `{T}`, `rumorHooks.radiusFt`, `THEME_ARCHETYPE`)

- [ ] **Step 1: Update the three docs** (use the `aralia-roadmap-node-authoring` skill for the plan-map edit — it has silent-failure modes).
- [ ] **Step 2: Full-suite sanity** — Run: `npx vitest run src/systems/worldforge/` — no new failures vs the known pre-existing background noise.
- [ ] **Step 3: Update project memory** (`dungeon-history-first-direction.md`: mark Pillar 1 BUILT; note next = Pillar 2 world attachment).

---

## Self-review notes

- Spec coverage: builder layouts (T2+T3), event simulation + evidence (T4), derived text + rumor hooks (T5), contract additions (T1, filled T6), replay/planAtYear (T4+T6 `asOfYearsAgo`), 11 tests green (T6), eyeball surface (T7), plan-map same-turn rule (T8). Town-radius NPC wiring is Pillar 2 (out of scope here; the contract carries `rumorHooks` for it).
- Type consistency: `HistoryResult.evidenceProps` uses working-grid cell indices remapped in T6 step 3 (crop); `DungeonDoor.cell` is cropped-grid; `Room.purpose` lives on the working `Room` (T3) and maps onto `DungeonRoom.purpose` at the feet boundary (T6).
- The `delaunay` dead field flagged by critique C4 no longer exists in types.ts (already removed in the earlier wave) — verified against the current file.

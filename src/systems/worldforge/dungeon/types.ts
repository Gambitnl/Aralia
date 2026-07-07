/**
 * @file types.ts
 * @description Dungeon plan contract — the pure-data output of the procedural
 * dungeon generator (spec docs/superpowers/specs/2026-07-05-procedural-dungeon-generator.md).
 *
 * Sibling of the L4 interior contract (`../interior/types.ts`): plain data, zero
 * THREE imports, deterministic from a `SeedPath`. Difference from interiors: a
 * dungeon is a whole branching complex (many rooms + corridors), not one plot.
 *
 * UNITS (feet-at-the-plan-boundary, mirroring `InteriorPlan`):
 * - ENTITY fields — rooms, props, spawns, traps — are in PLOT-LOCAL FEET,
 *   5 ft aligned (a coordinate is the origin corner of its 5 ft cell).
 * - BITMAP fields — `grid`, `corridor`, `bfs` — and their companion cell
 *   lists (`doorways`, `corridorCells`, `secretDoorCells`) are in 5 ft CELLS,
 *   because they index the row-major grid directly. cell = feet / `cellFt`.
 */

import type { Feet } from '../units';
import type { SeedPath } from '../seedPath';

/**
 * World-derived naming context for a dungeon (Pillar 2, Task 3). When present on
 * a `DungeonInput`, this OVERRIDES lore's own namePool/pattern draws so the
 * dungeon reads as belonging to a real culture and town:
 * - `builderStem` replaces the stem lore would have drawn from `arch.namePool`.
 * - `builderName` is that stem already run through the archetype's builder
 *   pattern (e.g. "House Aeldric", "the Vharûn Company") — lore uses it verbatim.
 * - `townName` (when set) fills the `{T}` token in patterns/titles instead of the
 *   archetype's `townPlaceholder`.
 * deriveLore keeps identical rng draw COUNT with or without this present (it
 * draws and discards the placeholder stem/pattern), so a plan's downstream
 * stream state is byte-identical either way — only the emitted text differs.
 */
export interface WorldIdentity {
  builderName: string;
  builderStem: string;
  townName?: string;
  /**
   * Real world events near the dungeon's site (Pillar 2, Task 4). When present,
   * simulateHistory binds a thematically-matching event to a ref and quotes the
   * ref's real zone name; deriveLore then quotes it in notes/hooks/blurb. Built
   * by `chronicleForSite`. Absent for the standalone preview path — a dungeon
   * with no chronicle generates byte-identically to before. See {@link ChronicleRef}.
   */
  chronicle?: ChronicleRef[];
}

/**
 * The real-world event kinds a dungeon event can bind to. The first three are the
 * atlas EVENT ZONES (war/plague/eruption). The rest are the WORLD-CHRONICLE
 * inferences (chronicle/worldChronicle.ts): a `schism`/`crusade` reads war-like
 * (a faith fought over these halls), a `migration` reads as newcomers denning in,
 * a `fall` reads as a predecessor polity's collapse. They map onto the same
 * decay-event families (see CHRONICLE_MATCH in simulateHistory.ts).
 */
export type ChronicleKind =
  | 'war'
  | 'plague'
  | 'eruption'
  | 'schism'
  | 'crusade'
  | 'migration'
  | 'fall';

/**
 * The GRAMMATICAL shape of a chronicle ref's name. FMG zone names come in two
 * shapes and they take different prepositions:
 *  - 'event' — a happening ("Onerean Occupation", "Pink Cholera", "Dunstonbeck
 *    Eruption"): a hold burns IN it.
 *  - 'faction' — a group of people (the Rebels-family zones: "Damunvilian
 *    Rebels", "Schopbachian Renegades"): a hold falls TO them, never *in* them.
 * Summaries and lore templates branch on this, so no line ever reads
 * "the hold fell in the Damunvilian Rebels".
 */
export type ChronicleShape = 'event' | 'faction';

/**
 * A real world event (FMG atlas zone) near a dungeon site — the grounding a
 * dungeon event quotes. `name` is the atlas zone name ("the Onerean Occupation");
 * `yearsAgo` is a world-consistent DERIVED age (zones carry no date). Built by
 * `world/chronicle.ts::chronicleForSite`. Kept in this leaf module (not in
 * world/chronicle.ts) so `DungeonEvent`/`WorldIdentity` can reference it without
 * types.ts pulling the atlas in.
 */
export interface ChronicleRef {
  kind: ChronicleKind;
  /** Grammatical shape of `name` — picks the template family. See {@link ChronicleShape}. */
  shape: ChronicleShape;
  /** The real atlas zone name — quoted verbatim in summaries and lore. */
  name: string;
  zoneId: number;
  yearsAgo: number;
}

/** Atomic grid unit (D&D 5 ft), matching the interior generator. */
export const CELL_FT = 5;

/** Cell occupancy in `DungeonPlan.grid`. */
export enum CellKind {
  Void = 0,
  Floor = 1,
  Wall = 2,
}

/** `compound` = a union of overlapping rectangles (L / T / plus shapes).
 * `diamond` = a 45°-rotated square (the octagon chamfer taken to its limit) —
 * a Gozzys-style focal room. */
export type RoomShape = 'rect' | 'ellipse' | 'octagon' | 'diamond' | 'compound';

export type RoomType =
  | 'entrance'
  | 'combat'
  | 'elite'
  | 'treasure'
  | 'shrine'
  | 'boss';

/** Where the dungeon is from — drives palette, names, monsters, and décor. */
export type DungeonTheme = 'crypt' | 'cavern' | 'frost' | 'sewer' | 'fungal';

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
  /** True when the applier could not act on the happy path but still left real
   * evidence (the failed-tunnel case: tool-scarred wall + pick-scar prop). Lets
   * lore branch to the "tried and failed" family without sniffing the summary. */
  failed?: boolean;
  /**
   * Set by simulateHistory (Pillar 2, Task 4) when this event was bound to a real
   * world chronicle ref: the fire that gutted the hold IS the war zone's razing,
   * the awakening IS the plague's dead. When present, the event's `summary`
   * quotes `zoneName`, and lore emits quote-templates naming it. Absent ⇔ an
   * ordinary, un-grounded decay event.
   */
  chronicleRef?: { zoneId: number; zoneName: string; kind: ChronicleKind; shape: ChronicleShape };
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
  /**
   * Pillar 2, Task 8 (living ecology): the line townsfolk speak once the dungeon
   * has been CLEARED — same laconic tone, past-tense ("They cleared the old crypt
   * last season. Doesn't mean anyone's moved back in."). `rumorsForBurg` swaps
   * `text` → `clearedText` for a cleared site. Always present (draw-count neutral:
   * derived from the same event, no extra rng stream).
   */
  clearedText: string;
  speakerBias: 'elder' | 'scholar' | 'adventurer';
  /** How far from the dungeon this rumor circulates. */
  radiusFt: number;
}

/** A 5 ft grid cell coordinate (indexes the `grid` bitmap). */
export interface Cell {
  x: number;
  y: number;
}

/** A room. Bounding box in plot-local FEET (5 ft aligned, origin corner). */
export interface DungeonRoom {
  id: number;
  x: Feet;
  y: Feet;
  w: Feet;
  h: Feet;
  shape: RoomShape;
  type: RoomType;
  /** Graph distance (in rooms) from the entrance. */
  depth: number;
  /** 0.15 → 1.0 ramp keyed to depth; boss = 1.0. */
  difficulty: number;
  /** Degree in the final (MST + loops) graph. */
  degree: number;
  /** Floor-cell count actually stamped for this room. */
  area: number;
  /** What this room was built as. */
  purpose: RoomPurpose;
  /** DM/dev keyed text, only set when an event touched the room. */
  note?: string;
}

/** An edge in the kept graph (growth-tree skeleton + re-opened loop doors). */
export interface DungeonEdge {
  a: number;
  b: number;
  /** True = non-tree (cycle) edge, for the cyclomatic invariant. Set on BOTH
   * builder cross-cuts and event-dug tunnels. */
  isLoop: boolean;
  isCritical: boolean;
  /** Loop doors only: the connection is hidden until searched for. */
  isSecret?: boolean;
  /** True only when a decay-event tunnel dug this loop (rough, hand-cut). A
   * BUILT cross-cut leaves this unset — it renders as a clean built door. The
   * drawer's hand-cut wobble treatment keys on THIS, not `isLoop`. */
  dug?: boolean;
}

/** A floor hazard, placed in mid-to-deep rooms (never entrance or boss). */
export interface DungeonTrap {
  /** Plot-local feet (5 ft aligned). */
  x: Feet;
  y: Feet;
  kind: 'pit' | 'darts' | 'snare';
  roomId: number;
  /** Event that caused this trap; absent ⇔ built-in defense. */
  eventRef?: number;
}

export interface DungeonProp {
  kind: string;
  /** Plot-local feet (5 ft aligned — origin corner of the prop's cell). */
  x: Feet;
  y: Feet;
  rot: 0 | 90 | 180 | 270;
  scale: number;
  roomId: number;
  /** Event that caused this prop; absent ⇔ built-in furniture. */
  eventRef?: number;
}

export interface DungeonSpawn {
  /** Plot-local feet (5 ft aligned). */
  x: Feet;
  y: Feet;
  /** Challenge-rating label of the spawned monster (matches its bestiary CR). */
  cr: string;
  xp: number;
  /** Real key into the ingested monster data (`INGESTED_MONSTERS`), resolved
   * from world/bestiaryTable.ts by theme + optional biome. */
  monsterKey: string;
  roomId: number;
  /** Event that caused this spawn; absent ⇔ built-in encounter. */
  eventRef?: number;
}

export interface DungeonStats {
  rooms: number;
  /** What was asked for — compare against `rooms` for an honest shortfall read. */
  roomsRequested: number;
  edges: number;
  loops: number;
  /** Cyclomatic number E − V + 1 (should equal `loops`). */
  cyclomatic: number;
  criticalLength: number;
  floorTiles: number;
  wallTiles: number;
  props: number;
  spawns: number;
  encounterXp: number;
  genMs: number;
  /** Re-roll attempts spent before a fully-connected layout (1 = first try). */
  attempts: number;
  /** The resolved layout dial actually used (0 tight .. 1 sprawl) — the
   * per-archetype seeded default when params.sprawl was not pinned. */
  sprawl: number;
  /** Count of events in the dungeon's history. */
  events: number;
}

export interface DungeonParams {
  roomCount: number;
  loopChance: number;
  decorDensity: number;
  theme: DungeonTheme;
  partyLevel: number;
  /** Builder archetype (default derived from theme). */
  archetype?: BuilderArchetype;
  /**
   * FMG biome name of the site's cell (e.g. "Hot desert", "Wetland"). When set,
   * spawn resolution swaps 1–2 bestiary tiers for biome-flavored alternates
   * (world/bestiaryTable.ts). Omitted → the theme's base ladder.
   */
  biomeName?: string;
  /** Replay cutoff: apply only events with yearsAgo >= asOfYearsAgo (default 0 = full history). */
  asOfYearsAgo?: number;
  /**
   * Layout dial (0..1) between the two approved poles. 0 = TIGHT (room-through-
   * room suites, minimal corridors — the crypt). 1 = SPRAWL (rooms spread far
   * apart, long corridor runs with elbows and junctions, generous negative
   * space, strong size contrast — the Gozzys reference). When omitted, resolved
   * per archetype with seeded jitter from a dedicated 'sprawl' stream.
   */
  sprawl?: number;
}

export interface DungeonInput {
  /** Full determinism handle — same path ⇒ byte-identical plan. */
  seed: number;
  params?: Partial<DungeonParams>;
  /**
   * Base seed path this dungeon grows from. When set, it REPLACES
   * `rootSeedPath(seed)` as the base the generator appends `dungeon` to — so a
   * world-grown site can seed the dungeon from its own frozen `sitePath`
   * (`wf:<seed>/cell:<c>/dungeon:m<i>` etc.) instead of the raw numeric seed.
   * The `seed` field is still stamped on the plan for provenance. Omitted for
   * the standalone preview path, which keeps the historic `wf:<seed>/dungeon`.
   */
  basePath?: SeedPath;
  /**
   * World-derived naming context (Pillar 2). When present, lore uses these
   * names verbatim in place of its own namePool/pattern draws — see
   * {@link WorldIdentity}. Draw count is preserved so grids stay identical.
   */
  world?: WorldIdentity;
}

export interface DungeonPlan {
  params: DungeonParams;
  seed: number;
  name: string;

  /** Grid dimensions, in cells. */
  W: number;
  H: number;
  cellFt: number;
  widthFt: number;
  depthFt: number;

  /** Row-major `CellKind` grid, length W*H. */
  grid: Uint8Array;
  /** 1 where a floor cell was carved as corridor (vs room), length W*H. */
  corridor: Uint8Array;
  /** Per-cell BFS distance from the entrance; −1 for non-floor. length W*H. */
  bfs: Int16Array;

  rooms: DungeonRoom[];
  /** Kept graph (growth tree + loop doors). */
  edges: DungeonEdge[];

  doorways: Cell[];
  /** Cells of doors whose state is 'secret' (hidden until searched); derived from `doors`. */
  secretDoorCells: Cell[];
  corridorCells: Cell[];
  props: DungeonProp[];
  spawns: DungeonSpawn[];
  traps: DungeonTrap[];

  entranceId: number;
  bossId: number;
  /** Room ids on the entrance→boss critical path, in order. */
  criticalRoomIds: number[];

  archetype: BuilderArchetype;
  builderName: string;
  blurb: string;
  history: DungeonEvent[];
  rumorHooks: RumorHook[];
  /** OverlayKind per cell, length W*H. */
  overlay: Uint8Array;
  /** Replaces doorways as the semantic source; doorways stays (all door cells) for compat. */
  doors: DungeonDoor[];

  stats: DungeonStats;
}

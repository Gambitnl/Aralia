/**
 * @file types.ts
 * @description Dungeon plan contract — the pure-data output of the procedural
 * dungeon generator (spec docs/superpowers/specs/2026-07-05-procedural-dungeon-generator.md).
 *
 * Sibling of the L4 interior contract (`../interior/types.ts`): plain data, zero
 * THREE imports, deterministic from a `SeedPath`. Difference from interiors: a
 * dungeon is a whole branching complex (many rooms + corridors), not one plot.
 *
 * FIRST-DRAFT UNIT NOTE: this draft is grid-native — rooms, props, spawns and
 * corridor cells are all in **5 ft cells**, not feet. `CELL_FT` is the atomic
 * unit and `widthFt/depthFt` are the only feet-denominated fields. The spec's
 * feet-at-the-plan-boundary conversion is a documented deferral for the wiring
 * pass; keeping one unit (cells) makes the generator and the 2D drawer coherent
 * while the layout algorithm is the thing under test.
 */

/** Atomic grid unit (D&D 5 ft), matching the interior generator. */
export const CELL_FT = 5;

/** Cell occupancy in `DungeonPlan.grid`. */
export enum CellKind {
  Void = 0,
  Floor = 1,
  Wall = 2,
}

export type RoomShape = 'rect' | 'ellipse' | 'octagon';

export type RoomType =
  | 'entrance'
  | 'combat'
  | 'elite'
  | 'treasure'
  | 'shrine'
  | 'boss';

export type DungeonTheme = 'crypt';

export interface Cell {
  x: number;
  y: number;
}

/** A room. All coordinates/sizes in 5 ft cells; (cx, cy) is the center cell. */
export interface DungeonRoom {
  id: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
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
}

/** An edge in the kept graph (growth-tree skeleton + re-opened loop doors). */
export interface DungeonEdge {
  a: number;
  b: number;
  isLoop: boolean;
  isCritical: boolean;
  /** Loop doors only: the connection is hidden until searched for. */
  isSecret?: boolean;
}

/** A floor hazard, placed in mid-to-deep rooms (never entrance or boss). */
export interface DungeonTrap {
  /** Cell coordinates. */
  x: number;
  y: number;
  kind: 'pit' | 'darts' | 'snare';
  roomId: number;
}

export interface DungeonProp {
  kind: string;
  /** Cell coordinates. */
  x: number;
  y: number;
  rot: 0 | 90 | 180 | 270;
  scale: number;
  roomId: number;
}

export interface DungeonSpawn {
  /** Cell coordinates. */
  x: number;
  y: number;
  /** Challenge-rating label (placeholder monster selection — see spec open Qs). */
  cr: string;
  xp: number;
  monsterKey: string;
  roomId: number;
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
}

export interface DungeonParams {
  roomCount: number;
  loopChance: number;
  decorDensity: number;
  theme: DungeonTheme;
  partyLevel: number;
}

export interface DungeonInput {
  /** Full determinism handle — same path ⇒ byte-identical plan. */
  seed: number;
  params?: Partial<DungeonParams>;
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
  /** Doorway cells that belong to a secret loop connection. */
  secretDoorCells: Cell[];
  corridorCells: Cell[];
  props: DungeonProp[];
  spawns: DungeonSpawn[];
  traps: DungeonTrap[];

  entranceId: number;
  bossId: number;
  /** Room ids on the entrance→boss critical path, in order. */
  criticalRoomIds: number[];

  stats: DungeonStats;
}

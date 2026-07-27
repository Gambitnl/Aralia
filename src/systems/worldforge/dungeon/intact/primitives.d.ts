/**
 * @file intact/primitives.ts
 * @description Room / mask / grid primitives (shared substrate) — extracted
 * VERBATIM from buildIntact.ts (packet W1-P6). These are the grid geometry, mask
 * bakers, spine-composition tuning constants, the stamp helpers, and the working
 * `IntactState`/`SpineCell` types that both the builder and `generateDungeon.ts`
 * lean on. Move-only: bodies are byte-identical to the originals so every seeded
 * draw (compoundMask/bakeMask) fires in the same order. Re-exported by
 * `../buildIntact` so the public import surface is unchanged.
 */
import type { Rng } from './rng';
import { type Cell, type DungeonEdge, type RoomPurpose, type RoomShape } from '../types';
export interface Room {
    id: number;
    x0: number;
    y0: number;
    w: number;
    h: number;
    shape: RoomShape;
    /** Footprint mask, row-major w*h — 1 = floor. Rooms are stamped from this. */
    mask: Uint8Array;
    type: import('../types').RoomType;
    /** What this room was built as (history-first layout). */
    purpose: RoomPurpose;
    depth: number;
    difficulty: number;
    degree: number;
    area: number;
}
export declare const roomCx: (r: Room) => number;
export declare const roomCy: (r: Room) => number;
/** True when local cell (i, j) of a room's bounding box is floor. */
export declare function inMask(shape: RoomShape, w: number, h: number, i: number, j: number): boolean;
/**
 * Compound footprint: the union of a full-height column block and a partial-
 * height full-width block — yields L, T, and plus shapes depending on where
 * the two land. This is how Watabou rooms get their irregular outlines.
 */
export declare function compoundMask(rng: Rng, w: number, h: number): Uint8Array;
export declare function bakeMask(rng: Rng, shape: RoomShape, w: number, h: number): Uint8Array;
export declare const DIRS: ReadonlyArray<readonly [number, number]>;
export declare const SPINE_STRIDE = 8;
/** Gallery PAIRS per straight trunk before the spine branches perpendicular. */
export declare const SPINE_PAIRS_PER_SEGMENT = 5;
export declare const SPINE_SEGMENT_CELLS: number;
/**
 * Perpendicular jog between processional lanes — wide enough that the next
 * lane's galleries clear the previous lane's (a ×2-scale gallery reaches ~13
 * cells to a flank plus its connector). Keeps parallel lanes from cross-colliding.
 * Raised 16 → 22 for the bigger galleries.
 */
export declare const SPINE_LANE_GAP = 22;
export declare const gi: (x: number, y: number, W: number) => number;
/** Minimal grid surface `stampRoom` needs (shared by GrowState & IntactState). */
export interface GridSurface {
    side: number;
    grid: Uint8Array;
    roomOf: Int16Array;
}
/** Stamp a room's floor mask into the working grid, returning its area. */
export declare function stampRoom(st: GridSurface, r: Room): void;
/** Mark every floor cell of a placed room as built-wet (waterworks cisterns). */
export declare function addRoomWater(st: IntactState, r: Room): void;
export interface IntactState {
    side: number;
    grid: Uint8Array;
    corridor: Uint8Array;
    roomOf: Int16Array;
    rooms: Room[];
    edges: DungeonEdge[];
    entranceId: number;
    flowDir: readonly [number, number];
    /** Working-grid cell indices that start WET (waterworks channels/cisterns). */
    builtWater: Set<number>;
    /**
     * Layout dial (0 tight .. 1 sprawl). At 0 corridors keep their tight spec
     * ranges and rooms butt through shared-wall doors; toward 1 attach corridors
     * stretch into long runs (4-12 cells) with a seeded elbow, room/wing spacing
     * grows, and the room-to-room share falls so negative space opens up.
     */
    sprawl: number;
}
/**
 * A carved spine/channel cell tagged with the LOCAL flow direction of the
 * segment it belongs to. Galleries branch perpendicular to `dir` — so once the
 * spine bends into a perpendicular wing, its galleries hang off the correct
 * flanks of THAT wing, not the original trunk axis (this is what makes the
 * mausoleum grow as wings off a trunk rather than a single worm).
 */
export interface SpineCell extends Cell {
    dir: readonly [number, number];
}

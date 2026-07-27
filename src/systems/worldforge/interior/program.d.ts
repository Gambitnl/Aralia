/**
 * @file program.ts — assign a purpose to every room on a floor.
 *
 * Task 4 of the Building Blueprint Pipeline. Detects corridors (a room whose
 * cells form a straight 1-cell-wide run of length >= 3), marks the largest
 * non-corridor room as the main room with the building type's headline
 * purpose, then fills the remaining rooms from a per-type program: required
 * slots, optional slots decided by the RNG, then a filler purpose. Slots
 * with a placement preference are adjacency-aware — the kitchen prefers a
 * room sharing a wall with the main room (or a main-touching corridor),
 * and pantry/cellar prefer a room touching the kitchen; other slots go
 * largest-room-first. Storage is capped at 1 per building — no plan is
 * half storeroom.
 *
 * Deterministic: all randomness derives from the 'program' stream of the
 * given seed path. Pure data — no three.js, no rendering concerns.
 */
import type { BuildingType, RoomPurpose, BlueprintRoom } from './blueprintTypes';
import type { BedroomAssignment } from './briefProgram';
import type { TradeRoomDemand } from './tradeRooms';
import { type SeedPath } from '../seedPath';
/** The main-room purpose per building type — the headline the largest room
 *  gets. Exported so briefProgram can drop a trade demand the headline already
 *  satisfies (e.g. a smithy's forge). */
export declare const HEADLINE: Record<BuildingType, RoomPurpose>;
/** One slot in a room program: min required, max allowed. */
export interface ProgramSlot {
    purpose: RoomPurpose;
    min: number;
    max: number;
}
/** Optional household-brief inputs for {@link assignPurposes}. Every field is
 *  optional; passing none (or `{}`) reproduces the v1 program byte-for-byte. */
export interface AssignOptions {
    /** Extra slots appended AFTER the type program's slots. MUST arrive
     *  min === max (Task 6 guarantees this) so no extra 'program'-stream draws
     *  happen and optless calls stay byte-stable. */
    extraSlots?: ProgramSlot[];
    /** Trade-room placement constraints (street-facing / adjacency). */
    tradeDemands?: TradeRoomDemand[];
    /** Bedrooms to hand out ON THIS FLOOR. MUTATED: consumed entries are
     *  removed so a caller can thread one queue across floors. */
    bedroomQueue?: BedroomAssignment[];
}
/**
 * Assign purposes to the rooms of a partitioned floor.
 *
 * @param path room-id grid from partition(): rg[y][x], -1 outside, ids
 *   compact from 0.
 * @param opts optional household-brief inputs (extra slots, trade demands,
 *   bedroom queue). Omitted or `{}` reproduces the v1 program byte-for-byte.
 * @returns one BlueprintRoom per id, ordered by id.
 */
export declare function assignPurposes(path: SeedPath, type: BuildingType, rg: number[][], opts?: AssignOptions): BlueprintRoom[];
/**
 * Assign purposes for a NON-ground floor (upper storey or basement).
 *
 * With an EMPTY `bedroomQueue` this reproduces the v1 `repurpose()` rule
 * exactly (upper: main/`id%3!==2` → bedroom, else guest-room; basement:
 * `id%2` cellar/storage; corridors stay corridors) so the briefless golden
 * never shifts. With a non-empty queue the largest rooms first each take one
 * queue entry (purpose 'bedroom', `forSlot` stamped); leftovers fall back to
 * the empty-queue rule. The queue is MUTATED — consumed entries are removed
 * so one queue can be threaded across floors.
 *
 * @param level floor level (> 0 upper, < 0 basement; never 0).
 * @param bedroomQueue tagged bedrooms to place here (consumed in place).
 */
export declare function assignUpperPurposes(path: SeedPath, _type: BuildingType, rg: number[][], level: number, bedroomQueue: BedroomAssignment[]): BlueprintRoom[];

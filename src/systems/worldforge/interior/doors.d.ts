/**
 * @file doors.ts — wire doors between rooms and place the street entrance.
 *
 * Task 5 of the Building Blueprint Pipeline. Builds room adjacency from the
 * shared wall edges of the partition grid, computes a spanning tree over the
 * rooms (one door per tree edge, so every room is reachable), then adds a few
 * loop doors on leftover adjacencies. Privacy pass: the tree is a weighted
 * Prim that steers private rooms (PRIVATE_PURPOSES) into leaf positions fed
 * by corridors, avoids direct private↔main doors unless they are the only
 * connection, and loop doors never touch a private room. The street entry goes on an outer wall
 * edge of the MAIN room — or, when the main room touches no outer wall, on a
 * corridor connected to it — never a random back room. Exactly one entry
 * per ground floor; non-ground floors pass streetEntry: false and get none.
 * Frontage (Task 9): the entry prefers a STREET edge — an outer edge on the
 * plan's min-y boundary (the 3D bridge maps the min-y face to the street,
 * `interiorParts.ts`). The entry room's outer edges are filtered to street
 * edges first; when that filter is empty (a main room boxed off the street),
 * it relaxes to the room's full outer-edge list (honest constraint
 * relaxation — a landlocked room still gets a door). Either way EXACTLY ONE
 * draw is made from the 'doors' stream (the pool is filtered, no draw is
 * added), so stream stability holds regardless of which branch is taken.
 *
 * Swing contract: `openDir` + `swingInto` are the explicit spatial channel.
 * `openDir` is the unit cell delta pointing from the door across the edge
 * INTO the room the door opens into (perpendicular to the wall), and
 * `swingInto` is that room's id. The POLICY for choosing swingInto stays the
 * larger-room rule: interior doors open into the LARGER of the two rooms
 * (ties by lower id); the street entry opens INWARD (swingInto === b, the
 * room you step into). a/b ordering is kept (b is still the larger room /
 * entry room) but is no longer the swing channel — renderers must draw the
 * leaf from openDir/swingInto.
 *
 * Deterministic: all randomness derives from the 'doors' stream of the given
 * seed path. Pure data — no three.js, no rendering concerns. No fallback:
 * throws if the room graph cannot be connected or no entry wall exists.
 */
import type { BlueprintDoor, BlueprintRoom, RoomPurpose } from './blueprintTypes';
import { type SeedPath } from '../seedPath';
/** Room purposes that deserve privacy: they should hang off the tree as
 *  leaves (one door), reached through corridors or other non-private rooms,
 *  and never open straight onto the main hall when any other route exists. */
export declare const PRIVATE_PURPOSES: readonly RoomPurpose[];
/**
 * Wire the doors of one floor.
 *
 * @param rg room-id grid from partition(): rg[y][x], -1 outside.
 * @returns a connected door graph plus exactly one street entry.
 */
export declare function wireDoors(path: SeedPath, rg: number[][], rooms: BlueprintRoom[], opts?: {
    streetEntry?: boolean;
}): {
    doors: BlueprintDoor[];
};

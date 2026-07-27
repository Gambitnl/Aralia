/**
 * @file furnish.ts — Task 7 of the Building Blueprint Pipeline: room-clipped
 * furniture placement, wall-aware (Wave A fix A11).
 *
 * One recipe per RoomPurpose. Every item lands on a cell the room actually
 * OWNS (`room.cells`) — never the bounding box — so L-shaped rooms don't leak
 * furniture through their notches. Cells within one cell (Chebyshev) of a
 * door, and cells in the `blocked` set (stair reservations), are never used.
 * Corridors get nothing.
 *
 * Each recipe item carries a placement hint the placer honors:
 *   - 'exterior-wall': hearths must sit on a cell adjacent to the footprint
 *     boundary (a chimney needs an outer wall). If the room owns no such
 *     cell the item is SKIPPED — honest omission, no substitute.
 *   - 'wall': shelves and counters prefer any wall-adjacent cell (interior
 *     or exterior); relaxed to any free cell if none remain.
 *   - 'wall-away-from-door': beds — wall-adjacent AND, when available,
 *     farther from doors than the mandatory 1-cell door halo.
 *   - 'center': tables prefer non-wall cells; relaxed if none.
 *   - 'any': no preference.
 *
 * The footprint boundary is recovered from the rooms themselves: partition
 * covers the footprint, so the union of all rooms' cells IS the footprint,
 * and a cell with a 4-neighbor outside that union abuts an exterior wall.
 *
 * Item count scales with room area but is density-capped so small rooms stay
 * walkable. Deterministic: all randomness comes from the 'furnish' sub-stream
 * of the caller's seed path; candidate pools are filtered in stable
 * room-cell order so identical seeds reproduce identical layouts.
 *
 * Kind strings reuse the vocabulary generateInterior.ts already renders in 3D
 * (table, hearth, counter, shelf, barrel, crate, bed, chest, workbench) plus
 * a few new ones (bench, altar, desk, chair, weapon-rack) for purposes the
 * legacy generator never had.
 */
import { type SeedPath } from '../seedPath';
import { type BlueprintDoor, type BlueprintFurnishing, type BlueprintRoom } from './blueprintTypes';
export type PlacementHint = 'exterior-wall' | 'wall' | 'wall-away-from-door' | 'center' | 'any';
export interface RecipeItem {
    kind: string;
    hint: PlacementHint;
}
/**
 * Every furnishing kind the recipes can emit. Renderers MUST cover all of
 * these — the 3D bridge asserts this at test time (no-fallback: a missing
 * spec throws rather than silently dropping the piece).
 */
export declare const FURNISHING_RECIPE_KINDS: ReadonlySet<string>;
/**
 * Place furniture in every non-corridor room, clipped to the room's own
 * cells, keeping door approaches and stair-reserved cells clear, honoring
 * per-item placement hints (see file header).
 */
export declare function furnishRooms(path: SeedPath, rooms: BlueprintRoom[], doors: BlueprintDoor[], blocked: Set<string>): BlueprintFurnishing[];

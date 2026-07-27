/**
 * @file shipEmbark.ts — pure helpers for owned-ship embarkation from the world map.
 *
 * These helpers are intentionally pure (no side effects, no store access) so they
 * can be unit-tested in isolation and kept out of MapPane's render closure.
 *
 * Subtask 3C-3: embark gate + destination port validation.
 */
import type { Ship } from '@/types/naval';
import type { MultiModalRoute } from '@/systems/travel/multiModalRoute';
export interface ShipTravelAvailability {
    available: boolean;
    /** Human-readable reason why travel is unavailable, or null when available. */
    reason: string | null;
}
/**
 * Decides whether owned-ship travel is currently available.
 *
 * Rules (all must hold):
 *   1. An active ship exists.
 *   2. The ship has a known docked port (`dockedPortBurgId` is set).
 *   3. The player is standing at a port (`playerPortBurgId` is set).
 *   4. The player's port matches the ship's dock (`dockedPortBurgId === playerPortBurgId`).
 *
 * Each failing branch returns a reason that precisely describes its cause, so
 * the disabled-option hint is honest. One real path — no silent fall-through.
 */
export declare function shipTravelAvailability(activeShip: Ship | null | undefined, playerPortBurgId: number | null): ShipTravelAvailability;
export interface VoyageDestination {
    destinationBurgId: number;
    seaMiles: number;
    /** Aggregate sea-danger of the route in [0,1] (Plan 3A tiers), for the encounter roll. */
    danger: number;
}
/**
 * Derives the voyage destination from the clicked atlas cell and a pre-computed
 * multi-modal segmented route.
 *
 * Returns null when the destination cell is NOT a port burg (player must pick a
 * port — do NOT fall back to a land teleport).
 *
 * @param destCell   The atlas cell index the player clicked.
 * @param pack       The FMG pack (narrow Packish shape — same idiom as multiModalAtlasGraph.ts).
 * @param segmentedRoute  Already-computed multi-modal route to destCell.
 */
export declare function shipVoyageFromDestination(destCell: number, pack: unknown, segmentedRoute: MultiModalRoute): VoyageDestination | null;

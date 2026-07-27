/**
 * @file hiddenPlaces.ts — SP4 discovery layer, iteration #1 (headless).
 *
 * The base world is fully known and travelable (the atlas). DISCOVERY is the
 * separate layer of places that are NOT on any map — ruins, caves, shrines,
 * camps — scattered through a region and revealed only by physical PROXIMITY in
 * the streamed 3D/leaf world (SPEC §11: "base world known/travelable;
 * discovery = hidden off-map places, 3D proximity reveal").
 *
 * Pure: no React/DOM. Deterministic from the hierarchical seed-path, so the same
 * region always hides the same places at the same spots — discovery is a property
 * of the player's exploration, not of regeneration.
 *
 * Spec: docs/projects/worldforge/SPEC.md §11 (2026-06-22).
 * North star: docs/projects/worldforge/subprojects/sp4-hidden-places/NORTH_STAR.md
 */
import { type SeedPath } from '../seedPath';
import { type Pt } from '../submap/submapEngine';
export type HiddenPlaceKind = 'ruin' | 'cave' | 'shrine' | 'camp' | 'grove' | 'wreck';
export declare const HIDDEN_PLACE_KINDS: HiddenPlaceKind[];
export interface HiddenPlace {
    /** Stable id (deterministic per region + index). */
    id: string;
    kind: HiddenPlaceKind;
    /** Position in the region's coord space (graph/world frame). */
    position: Pt;
    /** Radius within which the player's proximity reveals it. */
    discoveryRadius: number;
    name: string;
    /** Whether the player has come close enough to reveal it. */
    discovered: boolean;
}
export interface HiddenPlacesOptions {
    /** Target number of hidden places to scatter in the region. */
    count?: number;
    /** Proximity reveal radius (world units). */
    discoveryRadius?: number;
}
/**
 * Deterministically scatter hidden places inside a region polygon. They are NOT
 * placed on the atlas — they exist only in this layer and start undiscovered.
 */
export declare function generateHiddenPlaces(region: Pt[], seedPath: SeedPath, opts?: HiddenPlacesOptions): HiddenPlace[];
export interface RevealResult {
    /** The full place list with newly-revealed entries flipped to discovered. */
    places: HiddenPlace[];
    /** Only the places revealed by THIS proximity check (empty if none new). */
    revealed: HiddenPlace[];
}
/**
 * Reveal any hidden places within their discovery radius of the player position.
 * Pure: returns a new list (previously-discovered places stay discovered) plus
 * the set newly revealed this call (so callers can fire a "discovered X" event).
 */
export declare function revealNearby(places: HiddenPlace[], playerPos: Pt): RevealResult;
/** Count how many hidden places have been discovered. */
export declare function discoveredCount(places: HiddenPlace[]): number;

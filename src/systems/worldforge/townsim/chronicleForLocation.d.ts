import type { TownSimRegistry } from './townSimRegistry';
import type { TownSimState } from './types';
export interface ChronicleForLocationInput {
    currentLocationId: string;
    worldSeed: number;
    /**
     * Canonical player atlas cell (`playerCell.cellId`) — the authoritative source
     * for which burg the player stands in. Grid retirement: the legacy 30×20
     * gridSize/coord path is gone; this is the sole town resolver.
     */
    cellId?: number | null;
    townSim: TownSimRegistry;
    gameTime: Date;
}
/**
 * The burgId whose seat is the given atlas cell, or undefined if no burg sits
 * there. Cell-native and exact: FMG records the burg per cell (`cells.burg`), so
 * "which town am I in?" needs no grid round-trip. This is the cell-native
 * successor to the coord_X_Y town lookup (grid-retirement Phase A1).
 */
export declare function burgIdForCell(worldSeed: number, cellId: number): number | undefined;
/**
 * The tracked TownSimState for the town the player is currently standing in, or
 * undefined if not in a tracked town. Shared by every diegetic news surface.
 */
export declare function resolveTownForLocation(input: ChronicleForLocationInput): TownSimState | undefined;
/**
 * The burgId of the town at the player's canonical cell, or undefined if that
 * cell holds no burg (or no cell is recorded). Independent of whether the town is
 * TRACKED yet — used by registration to decide which burg to start simulating.
 * (Stage 6: cell-native; the legacy coord_X_Y grid lookup is removed.)
 */
export declare function burgIdForLocation(input: {
    worldSeed: number;
    cellId?: number | null;
}): number | undefined;
/**
 * Recent chronicle lines (year-grouped, most-recent last) for the town the
 * player is currently in, or [] if not in a tracked town.
 */
export declare function townChronicleForLocation(input: ChronicleForLocationInput, opts?: {
    years?: number;
    maxLines?: number;
}): string[];

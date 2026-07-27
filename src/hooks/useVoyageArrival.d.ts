import type { Dispatch } from 'react';
import { AppAction } from '../state/actionTypes';
import type { VoyageState } from '../types/naval';
export interface UseVoyageArrivalArgs {
    worldSeed: number | null | undefined;
    currentVoyage: VoyageState | null | undefined;
    dispatch: Dispatch<AppAction>;
}
/**
 * Handles the player relocation that occurs when an owned-ship voyage docks.
 *
 * Fires ONLY when `currentVoyage.status === 'Docked'`. After dispatching
 * MOVE_PLAYER (and NAVAL_CLEAR_VOYAGE), `currentVoyage` becomes null, so the
 * effect cannot re-fire — idempotent by construction.
 *
 * No-tile invariant: if the destination burgId cannot be mapped to a grid tile
 * we log a clear error and still dispatch NAVAL_CLEAR_VOYAGE so the player is
 * not permanently stuck in a 'Docked' state. They remain at their current
 * world position (honest: they didn't actually arrive anywhere mappable).
 *
 * No try/catch swallow — one real path, fail honestly.
 * Mirror of useKnownPortsSync conventions.
 */
export declare function useVoyageArrival({ worldSeed, currentVoyage, dispatch, }: UseVoyageArrivalArgs): void;

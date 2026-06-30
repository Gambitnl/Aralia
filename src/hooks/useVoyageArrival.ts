import { useEffect } from 'react';
import type { Dispatch } from 'react';
import { AppAction } from '../state/actionTypes';
import type { VoyageState } from '../types/naval';
import { getTownTilesForGrid } from '../systems/worldforge/bridge/legacySubmapBridge';
import { SUBMAP_DIMENSIONS, MAP_GRID_SIZE } from '../config/mapConfig';
import { determineActiveDynamicNpcsForLocation } from '@/utils/spatial';
import { LOCATIONS } from '../constants';

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
export function useVoyageArrival({
  worldSeed,
  currentVoyage,
  dispatch,
}: UseVoyageArrivalArgs): void {
  // Key the effect on both status and destinationId so a new voyage to a
  // different port after clearing won't silently skip on same-status flicker.
  const voyageStatus = currentVoyage?.status ?? null;
  const destinationId = currentVoyage?.destinationId ?? null;

  useEffect(() => {
    if (voyageStatus !== 'Docked') return;

    // Guard: worldSeed must be present to look up town tiles for the world.
    if (worldSeed == null) {
      console.error('[useVoyageArrival] Voyage docked but worldSeed is absent — cannot look up town tiles. Clearing voyage.');
      dispatch({ type: 'NAVAL_CLEAR_VOYAGE' });
      return;
    }

    // Guard: destinationId must be a positive integer (FMG burg ids start at 1).
    const destBurgId = Number(destinationId);
    if (!Number.isInteger(destBurgId) || destBurgId <= 0) {
      console.error(
        `[useVoyageArrival] Voyage docked with invalid destinationId "${destinationId}" — cannot relocate player. Clearing voyage.`,
      );
      dispatch({ type: 'NAVAL_CLEAR_VOYAGE' });
      return;
    }

    // Grid retirement: the burg→tile map uses the canonical 30x20 bookkeeping dims.
    const { cols, rows } = MAP_GRID_SIZE;
    const townTiles = getTownTilesForGrid(worldSeed, cols, rows);
    const tile = townTiles.find(t => t.burgId === destBurgId);

    if (!tile) {
      // Invariant violation: player sailed to a port that has no grid tile.
      // Do NOT guess a tile or teleport to a wrong position.
      console.error(
        `[useVoyageArrival] No grid tile found for destination burgId ${destBurgId} (world seed ${worldSeed}, grid ${cols}×${rows}). ` +
        `Player was not relocated. Clearing voyage so they are not stuck at sea.`,
      );
      dispatch({ type: 'NAVAL_CLEAR_VOYAGE' });
      return;
    }

    const newLocationId = `coord_${tile.x}_${tile.y}`;
    const newSubMapCoordinates = {
      x: Math.floor(SUBMAP_DIMENSIONS.cols / 2),
      y: Math.floor(SUBMAP_DIMENSIONS.rows / 2),
    };
    const activeDynamicNpcIds = determineActiveDynamicNpcsForLocation(newLocationId, LOCATIONS);

    // React 18 batches these two dispatches into a single re-render, so there is
    // no intermediate "player moved but voyage still Docked" state observed by UI.
    dispatch({
      type: 'MOVE_PLAYER',
      payload: {
        newLocationId,
        newSubMapCoordinates,
        // mapData omitted — reducer falls back to current mapData (no tile reveal needed for port arrival)
        activeDynamicNpcIds,
      },
    });

    dispatch({ type: 'NAVAL_CLEAR_VOYAGE' });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voyageStatus, destinationId]); // intentionally omit mapData/worldSeed/dispatch — only re-run when voyage status/dest changes
}

import { useEffect } from 'react';
import type { Dispatch } from 'react';
import { AppAction } from '../state/actionTypes';
import type { VoyageState } from '../types/naval';
import { getBridgeAtlas } from '../systems/worldforge/bridge/legacySubmapBridge';
import { makeCellLocationId } from '../utils/location/cellLocationId';
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

    // Grid retirement: arrive AT the destination burg's atlas cell (cell-native id).
    // The burg's own cell is the authoritative location + the on-map validation
    // (no cell ⇒ not a real port ⇒ clear the voyage) — no grid-tile lookup needed.
    const burgCell = (getBridgeAtlas(worldSeed).pack.burgs?.[destBurgId] as { cell?: number } | undefined)?.cell;
    if (burgCell == null) {
      console.error(`[useVoyageArrival] Destination burg ${destBurgId} has no atlas cell — cannot relocate. Clearing voyage.`);
      dispatch({ type: 'NAVAL_CLEAR_VOYAGE' });
      return;
    }
    const newLocationId = makeCellLocationId(burgCell);
    const activeDynamicNpcIds = determineActiveDynamicNpcsForLocation(newLocationId, LOCATIONS);

    // React 18 batches these two dispatches into a single re-render, so there is
    // no intermediate "player moved but voyage still Docked" state observed by UI.
    dispatch({
      type: 'MOVE_PLAYER',
      payload: {
        newLocationId,
        destinationCell: { cellId: burgCell, anchor: { cellId: burgCell } },
        activeDynamicNpcIds,
      },
    });

    dispatch({ type: 'NAVAL_CLEAR_VOYAGE' });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voyageStatus, destinationId]); // intentionally omit mapData/worldSeed/dispatch — only re-run when voyage status/dest changes
}

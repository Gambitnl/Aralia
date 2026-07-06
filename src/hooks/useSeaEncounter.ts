import { useEffect } from 'react';
import type { Dispatch } from 'react';
import { AppAction } from '../state/actionTypes';
import type { PendingSeaEncounter } from '../types/naval';

export interface UseSeaEncounterArgs {
  pendingSeaEncounter: PendingSeaEncounter | null | undefined;
  dispatch: Dispatch<AppAction>;
}

/**
 * Launches the tactical battle map when a day at sea rolls a HOSTILE encounter.
 *
 * The navalReducer's per-day sea-encounter roll (Plan 3D) sets
 * `naval.pendingSeaEncounter` with the foes. This hook watches that marker and,
 * exactly like the land road-ambush path, hands the monsters to the existing
 * `handleStartBattleMapEncounter` flow — a placeless battle-map arena fight (the
 * fight-in-place context-picker resolves a placeless sea fight to the arena). It
 * then clears the marker so the same fight cannot re-fire.
 *
 * Idempotent by construction: NAVAL_CLEAR_SEA_ENCOUNTER nulls the field, so the
 * effect's dependency changes and it will not run again for the same encounter.
 * No new bespoke combat subsystem — this reuses the road-ambush machinery.
 */
export function useSeaEncounter({ pendingSeaEncounter, dispatch }: UseSeaEncounterArgs): void {
  const encounterId = pendingSeaEncounter?.id ?? null;

  useEffect(() => {
    if (!pendingSeaEncounter?.monsters?.length) return;

    const monsters = pendingSeaEncounter.monsters;
    // Clear first so re-render on the battle-start dispatch can't double-fire.
    dispatch({ type: 'NAVAL_CLEAR_SEA_ENCOUNTER' });

    void (async () => {
      try {
        const { handleStartBattleMapEncounter } = await import('./actions/handleEncounter');
        await handleStartBattleMapEncounter(dispatch, { monsters });
      } catch (err) {
        console.error('[sea encounter] failed to start battle:', err);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId]); // re-run only when a NEW hostile encounter appears
}

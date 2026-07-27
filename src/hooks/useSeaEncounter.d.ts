/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 14:01:32
 * Dependents: components/layout/GameModals.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
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
 * hands an exact missing-source record to the existing
 * `handleStartBattleMapEncounter` boundary. Sea encounters do not yet publish
 * authoritative sea/deck geometry, so the proposed foes never become combat
 * actors and CombatView visibly withholds tactical play. The hook still clears
 * the marker so the same encounter request cannot re-fire.
 *
 * Idempotent by construction: NAVAL_CLEAR_SEA_ENCOUNTER nulls the field, so the
 * effect's dependency changes and it will not run again for the same encounter.
 * No new bespoke combat subsystem — this reuses the road-ambush machinery.
 */
export declare function useSeaEncounter({ pendingSeaEncounter, dispatch }: UseSeaEncounterArgs): void;

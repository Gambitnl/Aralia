// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 11:55:39
 * Dependents: components/ActionPane/useActionGeneration.ts, components/Trade/MerchantModal.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useEffect, useState } from 'react';
import type { GameState } from '../types/state';
import type { WorldBusiness } from '../types/business';
import { businessAttendance, type BusinessAttendance } from '../systems/economy/businessAttendance';

/** Read only the displayed shops, once per source/hour change. Late answers from
 * a previous town cannot label the next town's businesses. Handlers recheck live. */
export function useBusinessAttendance(state: GameState | undefined, businesses: WorldBusiness[]) {
  const [result, setResult] = useState<Record<string, BusinessAttendance>>({});
  const hour = state?.gameTime instanceof Date ? state.gameTime.getUTCHours() : undefined;
  const seed = state?.worldSeed;
  const townSim = state?.townSim;
  useEffect(() => {
    let current = true;
    setResult(previous => Object.keys(previous).length ? {} : previous);
    const native = businesses.filter(business => business.burgId != null && business.plotId != null);
    if (!state || hour === undefined || native.length === 0) return;
    void Promise.all(native.map(async business => [business.id, await businessAttendance(state, business)] as const))
      .then(rows => { if (current) setResult(Object.fromEntries(rows.filter((row): row is readonly [string, BusinessAttendance] => Boolean(row[1])))); });
    return () => { current = false; };
  }, [seed, hour, townSim, businesses]);
  return result;
}

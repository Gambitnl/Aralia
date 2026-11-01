/** An altar can be read from the reached public room. The returned words come
 * from its world faith and clergy records; this card grants no temple service. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 19:50:05
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import type {TownBuildingVisit} from '../Worldforge/townBuildingVisit';
import type {TempleDedicationReading} from '../../systems/religion/worldforgeTemple';
import {Button} from '../ui/Button';
import {publicBuildingRoom} from './publicBuildingDiscovery';
import {furnishingReachError, type AvatarFootfall, type FurnishingPick} from './groundFurnishingInteraction';

export function isPublicTempleAltar(visit: TownBuildingVisit, level: number, index: number): boolean {
  const piece = visit.plan.floors.find(floor => floor.level === level)?.furnishings[index];
  return visit.plot.role === 'temple' && visit.plan.type === 'temple' && piece?.kind === 'altar'
    && Boolean(publicBuildingRoom(visit, level, piece.roomId));
}

export function templeDedicationAccessError(visit: TownBuildingVisit, pick: FurnishingPick,
  footfall: AvatarFootfall | null): string | null {
  const identity = pick.part.furnishing;
  if (!identity || !isPublicTempleAltar(visit, identity.level, identity.index)) {
    return 'This is not a public temple altar.';
  }
  return furnishingReachError(visit.plan, pick, footfall);
}

export function TempleDedicationAction({visit, level, index, reading, pending, onRead}: {
  visit: TownBuildingVisit; level: number; index: number; reading?: TempleDedicationReading;
  pending: boolean; onRead: () => void;
}) {
  if (!isPublicTempleAltar(visit, level, index)) return null;
  return <section aria-label="Temple dedication" className="mt-3 space-y-3">
    <Button onClick={onRead} disabled={pending} isLoading={pending}>Read dedication</Button>
    {reading && <>
      <h4 className="font-semibold text-amber-200">{reading.identity.faith.name}</h4>
      <p>{reading.entry.content}</p>
      {!reading.identity.clergy && <p>The dedication does not name a current priest.</p>}
      <p className="text-xs text-slate-300">Recorded in your Discovery Log.</p>
    </>}
  </section>;
}

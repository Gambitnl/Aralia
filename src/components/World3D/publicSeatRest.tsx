/** Public benches lead to the existing short-rest review. Opening it grants no
 * recovery, lodging, priest service or permission to use private furniture. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 18:54:40
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import type {TownBuildingVisit} from '../Worldforge/townBuildingVisit';
import {Button} from '../ui/Button';
import {publicBuildingRoom} from './publicBuildingDiscovery';
import {furnishingReachError, type AvatarFootfall, type FurnishingPick} from './groundFurnishingInteraction';

export function isPublicRestSeat(visit: TownBuildingVisit, level: number, index: number): boolean {
  const piece = visit.plan.floors.find(floor => floor.level === level)?.furnishings[index];
  return piece?.kind === 'bench' && Boolean(publicBuildingRoom(visit, level, piece.roomId));
}

/** Recheck the actual feet when the player chooses the action, even if the
 * examination panel was opened before they walked away or changed floors. */
export function publicSeatRestAccessError(visit: TownBuildingVisit, pick: FurnishingPick,
  footfall: AvatarFootfall | null): string | null {
  const identity = pick.part.furnishing;
  if (!identity || !isPublicRestSeat(visit, identity.level, identity.index)) {
    return 'Choose a bench in a public room. Private furniture needs its owner’s permission.';
  }
  return furnishingReachError(visit.plan, pick, footfall);
}

export function PublicSeatRestAction({visit, level, index, onReview}: {
  visit: TownBuildingVisit; level: number; index: number; onReview: () => void;
}) {
  if (!isPublicRestSeat(visit, level, index)) return null;
  return <div className="mt-3 space-y-2">
    <p>This public bench offers a place to pause. Review the time and Hit Point Dice before beginning a short rest.</p>
    <Button onClick={onReview}>Review short rest</Button>
  </div>;
}

/** Joint stair and household admission. A geometrically valid shaft is only
 * useful when every assigned resident still has a reachable, full-size bed.
 * Trials never mutate source plans or change the family's saved identities. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 04:57:26
 * Dependents: systems/worldforge/interior/generateBuilding.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { BlueprintFloor, Cell, ReturnStairLayout } from './blueprintTypes';
import { cellKey } from './blueprintTypes';
import { furnishHouseholdBuilding,type HouseholdFurnishingOptions } from './householdFurnish';
import { reserveReturnStair, returnStairCandidates, stairChildRoomMerges } from './stairLayout';

export interface HouseholdStairPlan {
  layout: ReturnStairLayout;
  floors: BlueprintFloor[];
  sharedChildRoom: boolean;
}

const slots = (floors: BlueprintFloor[]): string[] => floors.flatMap(f => f.rooms.flatMap(r => r.forSlot?.split(',').filter(Boolean) ?? [])).sort();

/** Bounded first-fit admission, preferring unchanged room divisions. Failed
 * trials own their clones; no rejected furnishing or slot reassignment leaks
 * into the original home. Unresolved homes return undefined, never fewer beds. */
export function planHouseholdReturnStair(
  footprint: Cell[], floors: BlueprintFloor[], servantCount: number,
  budget: { candidates?: number; merges?: number; furnishing?: HouseholdFurnishingOptions; minimumDoorWidthFt?: number } = {},
): HouseholdStairPlan | undefined {
  const expected = slots(floors);
  const bodyWidthM=budget.furnishing?.walkingWidthM;
  if(bodyWidthM!==undefined&&(!Number.isFinite(bodyWidthM)||bodyWidthM<=0))throw new RangeError('Stair body width must be positive and finite');
  const furnishTrial=(trial:BlueprintFloor[],blocked:Set<string>)=>{
    if(budget.minimumDoorWidthFt!==undefined){
      if(!Number.isFinite(budget.minimumDoorWidthFt)||budget.minimumDoorWidthFt<=0)throw new RangeError('Stair doorway width must be positive and finite');
      // reserveReturnStair creates new openings. Size those before furnishing,
      // so a later wider stair door cannot invalidate an accepted bed/stock bay.
      for(const floor of trial)for(const door of floor.doors)
        door.clearWidthFt=Math.max(door.clearWidthFt??3,budget.minimumDoorWidthFt);
    }
    furnishHouseholdBuilding(trial,blocked,servantCount,{compactBeds:true,...budget.furnishing});
  };
  const fits = (trial: BlueprintFloor[]) => {
    const actual = slots(trial);
    return actual.length === expected.length && actual.every((tag, i) => tag === expected[i])
      && trial.every(f => f.rooms.every(r => (r.forSlot?.split(',').filter(Boolean).length
        ?? (r.purpose === 'servant-room' ? servantCount : 0))
        <= f.furnishings.filter(item => item.roomId === r.id && item.kind === 'bed').length));
  };
  let attempts = 0;
  for (const layout of returnStairCandidates(footprint, floors,bodyWidthM)) {
    if (++attempts > (budget.candidates ?? 12)) break;
    // Room-level furniture routes do not prove stair ascent. A supplied body
    // must fit the real flight and landing before any bed/stock trial can pass.
    if(bodyWidthM!==undefined&&(layout.flightWidthFt*.3048<bodyWidthM||layout.landingDepthFt*.3048<bodyWidthM))continue;
    const blocked = new Set(layout.shaftCells.map(c => cellKey(c.cx, c.cy)));
    const originalRooms = reserveReturnStair(floors, layout);
    furnishTrial(originalRooms,blocked);
    if (fits(originalRooms)) return { layout, floors: originalRooms, sharedChildRoom: false };
    // Rebuild from the source assignments: a failed initial furnishing pass
    // may already have reassigned children among its own temporary rooms.
    let merges = 0;
    for (const shared of stairChildRoomMerges(reserveReturnStair(floors, layout))) {
      if (++merges > (budget.merges ?? 6)) break;
      furnishTrial(shared,blocked);
      if (fits(shared)) return { layout, floors: shared, sharedChildRoom: true };
    }
  }
  return undefined;
}

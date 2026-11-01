/** Public library reading borrows the town's existing chronicle, never owned
 * shelf contents. A real librarian must have arrived for their working shift. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 12:25:08
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {TownBuildingVisit} from '../Worldforge/townBuildingVisit';
import type {BuildingOccupantRender} from '../../systems/world3d/types';
import type {TownLifeState} from '../../systems/worldforge/roster/agentLife';
import {householdMemberIdentity} from '../../systems/worldforge/town/householdBrief';
import {attendanceForVisit} from '../../systems/economy/businessAttendance';
import {getGameDay} from '../../utils/core';
import {residentRenderOwnerAtClock} from './InteriorOccupants';
import {furnishingReachError, type AvatarFootfall, type FurnishingPick} from './groundFurnishingInteraction';

import {isPublicLibraryDesk} from '@/systems/worldforge/interior/libraryCollection';
export {isPublicLibraryDesk} from '@/systems/worldforge/interior/libraryCollection';

export function libraryReadingAccessError(visit: TownBuildingVisit, pick: FurnishingPick,
  footfall: AvatarFootfall | null, gameTime: Date | string, life: TownLifeState | undefined,
  keeperPacket: BuildingOccupantRender | undefined): string | null {
  const identity = pick.part.furnishing;
  if (!identity || !isPublicLibraryDesk(visit, identity.level, identity.index)) {
    return 'This is not a public library reading desk. Ask before using private records.';
  }
  const reach = furnishingReachError(visit.plan, pick, footfall);
  if (reach) return reach;
  const time = new Date(gameTime);
  if (!Number.isFinite(time.getTime())) return 'The library time is unavailable.';
  const keeper = visit.household?.members[0];
  if (!keeper || keeper.ageBand === 'child' || keeper.role !== 'head' || keeper.occupation.toLowerCase() !== 'librarian') {
    return 'No verified librarian is available to provide public records here.';
  }
  const attendance = attendanceForVisit(visit, time.getUTCHours(), life, getGameDay(time));
  if (!attendance.open) return attendance.reason?.replace('Trading hours:', 'Library hours:') ?? 'The librarian is off duty.';
  const hour = time.getUTCHours();
  const clock = hour + time.getUTCMinutes() / 60 + time.getUTCSeconds() / 3600;
  // Reuse the same source identity and door-arrival handoff as the visible
  // resident. A scheduled shift alone must not serve from an empty building.
  if (!keeperPacket || keeperPacket.householdMemberId !== householdMemberIdentity(visit.household!, 0)
    || keeperPacket.stationsByHour[hour]?.activity !== 'work'
    || residentRenderOwnerAtClock(keeperPacket, clock) !== 'interior') {
    return 'Wait for the librarian to arrive before consulting the public records.';
  }
  return null;
}

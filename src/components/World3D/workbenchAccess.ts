/** A borrowed public workbench belongs to a real room and a working keeper.
 * This admission check reuses physical furnishing reach and the same staffing
 * schedule as trade. It grants no ingredients, tools, money or recipe knowledge.
 * Private household benches need a separate permission contract and stay closed.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 19:47:46
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { TownBuildingVisit } from '../Worldforge/townBuildingVisit';
import { attendanceForVisit } from '../../systems/economy/businessAttendance';
import type { TownLifeState } from '../../systems/worldforge/roster/agentLife';
import { getGameDay } from '../../utils/core';
import { furnishingReachError, type AvatarFootfall, type FurnishingPick } from './groundFurnishingInteraction';

export function workbenchAccessError(visit: TownBuildingVisit, pick: FurnishingPick,
  footfall: AvatarFootfall | null, gameTime: string | Date, durationMinutes = 0, life?: TownLifeState): string | null {
  const identity = pick.part.furnishing;
  const floor = visit.plan.floors.find(candidate => candidate.level === identity?.level);
  const furnishing = identity && floor?.furnishings[identity.index];
  const room = floor?.rooms.find(candidate => candidate.id === furnishing?.roomId);
  if (!visit.isBusiness || furnishing?.kind !== 'workbench'
    || !['workshop', 'forge'].includes(room?.purpose ?? '')) {
    return 'This is not a public workshop bench. Ask its owner before using private equipment.';
  }
  const reachError = furnishingReachError(visit.plan, pick, footfall);
  if (reachError) return reachError;
  const start = new Date(gameTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(durationMinutes) || durationMinutes < 0) return 'The workshop time is unavailable.';
  if (durationMinutes > 24 * 60) return 'This work needs a longer arrangement with the keeper.';
  const attendance = attendanceForVisit(visit, new Date(start).getUTCHours(), life, getGameDay(new Date(start)));
  if (!attendance.open) return attendance.reason ?? 'The workshop keeper is off duty.';
  // Completion exactly at closing is allowed. Crossing lunch or a closing hour
  // needs another arrangement rather than silently occupying someone else's bench.
  const end = start + durationMinutes * 60_000;
  for (let at = Math.floor(start / 3_600_000) * 3_600_000 + 3_600_000; at < end; at += 3_600_000) {
    if (!attendanceForVisit(visit, new Date(at).getUTCHours(), life, getGameDay(new Date(at))).open) {
      return 'There is not enough staffed workshop time to finish. Hours: ' + attendance.hours + '.';
    }
  }
  return null;
}

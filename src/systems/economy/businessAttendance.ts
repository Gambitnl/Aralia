/** Trade uses the building's existing proprietor routine, including retirement.
 * This reads the source household; it never moves or invents shop staff. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 31/10/2026, 15:48:08
 * Dependents: components/World3D/libraryReadingAccess.ts, components/World3D/publicBuildingDiscovery.ts, components/World3D/workbenchAccess.ts, components/Worldforge/TownBuildingInspector.tsx, hooks/actions/handleMerchantInteraction.ts, hooks/useBusinessAttendance.ts, systems/worldforge/interior/libraryCollection.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '../../types/state';
import type { WorldBusiness } from '../../types/business';
import type { TownBuildingVisit } from '../worldforge/town/townBuildingVisit';
import { householdResidentLifeStatusAt, type TownLifeState } from '../worldforge/roster/agentLife';
import { householdMemberIdentity } from '../worldforge/town/householdBrief';
import { shopKeeperAt, type ShopLifeView } from '../worldforge/townsim/shopLife';
import { getGameDay } from '../../utils/core';

export interface BusinessAttendance {
  open: boolean;
  hours: string;
  reason?: string;
}

export function attendanceForVisit(visit: TownBuildingVisit, hour: number, life?: TownLifeState & Pick<ShopLifeView, 'shops'>, day = 0): BusinessAttendance {
  const keeper = visit.household?.members[0];
  // NPC lives (2026-11-02): the town sim records who keeps each shop now. A
  // closed shop stays closed. A recorded heir or new keeper staffs the shop at
  // its posted hours even when the source proprietor has died. Saves without
  // shop records ('untracked') keep the established household check below.
  const shop = shopKeeperAt(life, visit.plot?.id, day);
  if (shop.status === 'closed') {
    return {open: false, hours: 'Closed', reason: 'This shop closed when its keeper died with no heir. Nobody has reopened it.'};
  }
  let lifeStatus = keeper ? householdResidentLifeStatusAt(life, householdMemberIdentity(visit.household!, 0), keeper.name, day, visit.household!.members.filter(m => m.name === keeper.name).length === 1) : 'untracked';
  if (shop.status === 'open' && lifeStatus !== 'alive' && lifeStatus !== 'untracked') lifeStatus = 'alive';
  if (lifeStatus === 'deceased') {
    // An inheritance receipt transfers its stated property, not an occupation.
    // Leave the saved business and stock intact until a real successor exists.
    return {open: false, hours: 'Unstaffed', reason: 'The proprietor has died. No successor is recorded to serve here.'};
  }
  if (lifeStatus === 'unresolved') return {open: false, hours: 'Unverified', reason: 'The keeper’s current identity could not be verified.'};
  if (lifeStatus === 'not-born') return {open: false, hours: 'Unstaffed', reason: 'No keeper is available to serve here.'};
  const hours = Array.from({ length: 24 }, (_, index) => index).filter(index =>
    visit.occupancy?.stationsByHour[index]?.some(station =>
      station.memberIndex === 0 && station.where === 'home' && station.activity === 'work'));
  const clock = (value: number) => `${String(value).padStart(2, '0')}:00`;
  const runs: string[] = [];
  for (let index = 0; index < hours.length; index++) {
    const start = hours[index];
    while (index + 1 < hours.length && hours[index + 1] === hours[index] + 1) index++;
    runs.push(`${clock(start)}–${clock(hours[index] + 1)}`);
  }
  const posted = runs.join(', ') || 'No staffed trading hours';
  const open = Boolean(visit.household) && hours.includes(((Math.floor(hour) % 24) + 24) % 24);
  return { open, hours: posted, ...(!open ? { reason: hours.length
    ? `The keeper is off duty. Trading hours: ${posted}.`
    : 'No keeper is scheduled to serve here.' } : {}) };
}

/** Legacy shops without a native plot keep their established availability.
 * A known native shop fails visibly when its real staffing cannot be verified. */
export async function businessAttendance(state: Pick<GameState, 'worldSeed' | 'gameTime' | 'townSim'>,
  business: WorldBusiness): Promise<BusinessAttendance | undefined> {
  if (business.burgId == null || business.plotId == null || state.worldSeed == null) return undefined;
  try {
    const { townBuildingVisit } = await import('../worldforge/town/townBuildingVisit');
    const visit = townBuildingVisit(state.worldSeed, business.burgId, business.plotId,
      state.townSim?.[business.burgId]?.buildingEvents?.[business.plotId],
      state.townSim?.[business.burgId]?.buildingSources?.[business.plotId], state.townSim?.[business.burgId]?.layoutRevision);
    return attendanceForVisit(visit, new Date(state.gameTime).getUTCHours(), state.townSim?.[business.burgId], getGameDay(state.gameTime));
  } catch {
    return { open: false, hours: 'Unverified', reason: 'The shop’s staffing could not be verified. Try again after returning to town.' };
  }
}

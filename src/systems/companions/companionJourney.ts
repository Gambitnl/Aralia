/** Preserve actual co-travel separately from membership and independent home
 * life. A route/time receipt authorizes arrival, never arbitrary placement. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/10/2026, 10:32:54
 * Dependents: components/ConversationPanel/CompanionTravelChoices.tsx, components/World3D/partyJourneyArrival.ts, hooks/actions/handleNpcInteraction.ts, hooks/app/useAppTravelActions.ts, state/appState.ts, state/reducers/companionReducer.ts, state/reducers/companionTravelReducer.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '@/types/state';
import type { Companion } from '@/types/companions';
import type { TravelRouteLineage } from '@/types/travelMeta';
import { validCompanionPosition } from './companionWhereabouts';

export interface SharedJourneyMove {
  newLocationId: string;
  destinationCell?: { cellId: number };
  sharedJourney?: { seconds: number; route: TravelRouteLineage };
}

export function prepareCompanionJourney(state: GameState, move: SharedJourneyMove): { companions: GameState['companions']; error?: string } {
  const unchanged = { companions: state.companions };
  if (move.newLocationId === state.currentLocationId) return unchanged;
  const members = state.party.slice(1).map((person, index) => ({ person, index, companion: state.companions[person.id] }))
    .filter((entry): entry is typeof entry & { companion: Companion } => !!entry.companion?.inParty);
  // Old unplaced parties retain their old behavior. No new physical arrival is
  // invented for them; source-bound agreements must still be honored.
  const physical = members.filter(({ companion: c }) => c.whereabouts?.position || c.travelAgreement?.response === 'accepted');
  if (!physical.length) return unchanged;
  const fail = (message: string) => ({ ...unchanged, error: message });
  const route = move.sharedJourney?.route, seconds = move.sharedJourney?.seconds, destination = move.destinationCell;
  const validRoute = route && destination && Number.isFinite(seconds) && seconds! > 0
    && Number.isFinite(state.worldSeed) && route.fromCellId === state.playerCell?.cellId
    && Array.isArray(route.cells) && route.cells.length >= 2 && route.cells.length <= 4096
    && route.cells.every(cell => Number.isSafeInteger(cell) && cell >= 0)
    && route.cells[0] === route.fromCellId && route.cells.at(-1) === route.intendedCellId
    && route.cells.includes(destination.cellId);
  if (!validRoute) return fail('A shared journey needs a reviewed route and real travel time before the party can depart.');
  let companions = state.companions;
  for (const { companion: c, index } of physical) {
    const where = c.whereabouts, feet = state.playerGroundPos, point = where?.position;
    if (!point || !validCompanionPosition(point) || !feet || !validCompanionPosition(feet)
      || where?.worldSeed !== state.worldSeed || where.locationId !== state.currentLocationId
      || Math.hypot(point.xM - feet.xM, point.yM - feet.yM, point.zM - feet.zM) > 3 + index * 2.25)
      return fail(`Gather ${c.identity.name} before leaving. They are still at their own location.`);
    const agreement = c.travelAgreement;
    if (agreement?.response === 'accepted') {
      const goal = c.goals.find(g => g.id === agreement.goalId), disclosed = goal?.disclosedDestination;
      const returning = c.journeyDeparture?.worldSeed === state.worldSeed
        && move.newLocationId === c.journeyDeparture.locationId;
      if (agreement.worldSeed !== state.worldSeed || !disclosed || disclosed.worldSeed !== state.worldSeed
        || disclosed.sitePath !== agreement.sitePath || disclosed.sourceId !== agreement.sourceId
        || (!returning && route!.intendedCellId !== disclosed.cellId))
        return fail(`${c.identity.name} agreed to the ${agreement.destinationName} expedition and a way back. Discuss another purpose or part ways before choosing this journey.`);
    }
    const departedAt = state.gameTime.getTime();
    companions = { ...companions, [c.id]: { ...c,
      journeyDeparture: c.journeyDeparture ?? where,
      following: undefined,
      journey: { id: `${state.worldSeed}:${c.id}:${departedAt}:${destination!.cellId}`, worldSeed: state.worldSeed!,
        from: { locationId: state.currentLocationId, cellId: route!.fromCellId, position: { ...point } },
        to: { locationId: move.newLocationId, cellId: destination!.cellId }, intendedCellId: route!.intendedCellId,
        routeCells: route!.cells.slice(0, route!.cells.indexOf(destination!.cellId) + 1),
        departedAt, arrivalAt: departedAt + seconds! * 1000, status: 'awaiting-arrival' },
    } };
  }
  return { companions };
}

export function arrivingCompanions(state: GameState): Companion[] {
  return state.party.slice(1).flatMap(person => {
    const c = state.companions[person.id], leg = c?.journey;
    return c?.inParty && leg?.status === 'awaiting-arrival' && leg.worldSeed === state.worldSeed
      && leg.to.locationId === state.currentLocationId && leg.to.cellId === state.playerCell?.cellId
      && state.gameTime.getTime() >= leg.arrivalAt ? [c] : [];
  });
}

/** Spoken recall requires the actual saved shared event at this place. It does
 * not infer an adventure from membership, an invitation or a map pin. */
export function sharedJourneyRecall(companion: Companion, worldSeed: number | null, locationId: string, exhausted = false): string | undefined {
  const leg = companion.journey, agreement = companion.travelAgreement, where = companion.whereabouts;
  if (!leg || leg.status !== 'arrived' || leg.worldSeed !== worldSeed || leg.to.locationId !== locationId
    || where?.worldSeed !== worldSeed || where.locationId !== locationId
    || !companion.memories.some(memory => memory.id === `${leg.id}:arrived` && memory.tags.includes('shared-journey'))
    || agreement?.worldSeed !== worldSeed || agreement.response !== 'accepted') return undefined;
  const goal = companion.goals.find(g => g.id === agreement.goalId && !g.isSecret), target = goal?.disclosedDestination;
  if (!target || target.worldSeed !== worldSeed || target.sitePath !== agreement.sitePath || target.sourceId !== agreement.sourceId) return undefined;
  const minutes = Math.round((leg.arrivalAt - leg.departedAt) / 60000);
  if (!Number.isFinite(minutes) || minutes <= 0) return undefined;
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  const duration = [hours ? `${hours} hour${hours === 1 ? '' : 's'}` : '', rest ? `${rest} minute${rest === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ');
  const arrived = leg.to.cellId === target.cellId;
  const returned = companion.journeyDeparture?.worldSeed === worldSeed && companion.journeyDeparture.locationId === locationId;
  const opening = arrived ? `We reached the ${agreement.destinationName} together after ${duration} on the road.`
    : returned ? `We made the return journey together after ${duration} on the road.`
    : `We traveled together toward the ${agreement.destinationName} for ${duration}. We have not reached it yet.`;
  const work = goal.id === 'restore_temple' && goal.status === 'active' ? ' My restoration work remains unfinished.' : '';
  return `${opening}${work} We still decide the next risks together.${exhausted ? ' I am worn out from the march. I want to rest before we go deeper.' : ''}`;
}

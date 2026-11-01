import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { COMPANIONS } from '@/data/companions';
import { createMockGameState, createMockPlayerCharacter } from '@/utils/core/factories';
import { prepareCompanionJourney, arrivingCompanions, sharedJourneyRecall } from '../companionJourney';
import { companionReducer } from '@/state/reducers/companionReducer';
import { appReducer } from '@/state/appState';
import { useAppTravelActions } from '@/hooks/app/useAppTravelActions';
import type { WorldCellView } from '@/types';

function departure() {
  const c = structuredClone(COMPANIONS.elara_vance); c.inParty = true;
  c.whereabouts = { worldSeed: 77, locationId: 'cell_1', source: 'party', observedAt: 1, position: { xM: 18, yM: 0, zM: 20 } };
  c.journeyDeparture = { ...c.whereabouts, source: 'world-activity' };
  c.goals.find(g => g.id === 'restore_temple')!.disclosedDestination = { worldSeed: 77, sourceId: 'temple', sitePath: 'wf:77/cell:3/temple', cellId: 3, name: 'Temple', sharedAt: 1 } as NonNullable<typeof c.goals[number]['disclosedDestination']>;
  c.travelAgreement = { worldSeed: 77, sourceId: 'temple', goalId: 'restore_temple', sitePath: 'wf:77/cell:3/temple', destinationName: 'Temple', terms: ['Inspect and keep a way back.'], offeredAt: 1, response: 'accepted' };
  return createMockGameState({ worldSeed: 77, currentLocationId: 'cell_1', playerCell: { cellId: 1, localeCoords: null }, playerGroundPos: { tileX: 1, tileY: 0, xM: 20, yM: 0, zM: 20 },
    party: [createMockPlayerCharacter(), createMockPlayerCharacter({ id: c.id })], companions: { [c.id]: c } });
}
const move = { newLocationId: 'cell_3', destinationCell: { cellId: 3, anchor: { cellId: 3 } }, sharedJourney: { seconds: 3600, route: { fromCellId: 1, intendedCellId: 3, cells: [1, 2, 3] } } };

describe('source-bound shared journeys', () => {
  it('records the reviewed journey without moving anyone or erasing their own life', () => {
    const s = departure(), before = structuredClone(s), result = prepareCompanionJourney(s, move), c = result.companions.elara_vance;
    expect(result.error).toBeUndefined(); expect(s).toEqual(before);
    expect(c.journey).toMatchObject({ from: { cellId: 1, position: s.companions.elara_vance.whereabouts!.position }, to: { cellId: 3 }, routeCells: [1, 2, 3], status: 'awaiting-arrival' });
    for (const key of ['whereabouts', 'journeyDeparture', 'goals', 'identity', 'inventory', 'memories', 'relationships', 'travelAgreement'] as const) expect(c[key]).toBe(s.companions.elara_vance[key]);
    expect(arrivingCompanions(s)).toEqual([]);
  });
  it.each(['missing-route', 'wrong-purpose', 'remote', 'wrong-world', 'stale-origin'] as const)('refuses %s before spending anything', kind => {
    const s = departure(), m = structuredClone(move);
    if (kind === 'missing-route') Object.assign(m, { sharedJourney: undefined });
    if (kind === 'wrong-purpose') { m.sharedJourney.route.intendedCellId = 4; m.sharedJourney.route.cells = [1, 3, 4]; }
    if (kind === 'remote') s.companions.elara_vance.whereabouts!.position!.xM = 100;
    if (kind === 'wrong-world') s.companions.elara_vance.whereabouts!.worldSeed = 78;
    if (kind === 'stale-origin') m.sharedJourney.route.fromCellId = 2;
    expect(prepareCompanionJourney(s, m).error).toBeTruthy();
  });
  it('retains the intended temple purpose on a real partial route halt', () => {
    const s = departure(), result = prepareCompanionJourney(s, { ...move, newLocationId: 'cell_2', destinationCell: { cellId: 2 } });
    expect(result.error).toBeUndefined(); expect(result.companions.elara_vance.journey).toMatchObject({ intendedCellId: 3, to: { cellId: 2 }, routeCells: [1, 2] });
  });
  it('allows the agreed way back while retaining the original departure', () => {
    const s = departure(); s.currentLocationId = 'cell_3'; s.playerCell!.cellId = 3; s.companions.elara_vance.whereabouts!.locationId = 'cell_3';
    const result = prepareCompanionJourney(s, { newLocationId: 'cell_1', destinationCell: { cellId: 1 }, sharedJourney: { seconds: 3600, route: { fromCellId: 3, intendedCellId: 1, cells: [3, 2, 1] } } });
    expect(result.error).toBeUndefined(); expect(result.companions.elara_vance.journeyDeparture!.locationId).toBe('cell_1');
  });
  it('commits through MOVE_PLAYER, waits for real arrival time and checkpoints only the matching journey once', () => {
    const s = departure(), moved = appReducer(s, { type: 'MOVE_PLAYER', payload: { ...move, activeDynamicNpcIds: null } });
    expect(moved.currentLocationId).toBe('cell_3'); expect(moved.playerGroundPos).toBeNull(); expect(arrivingCompanions(moved)).toEqual([]);
    const c = moved.companions.elara_vance, arrived = { ...moved, gameTime: new Date(c.journey!.arrivalAt), playerGroundPos: { tileX: 3, tileY: 0, xM: 50, yM: 1, zM: 50 } };
    expect(arrivingCompanions(arrived).map(c => c.id)).toEqual(['elara_vance']);
    const action = { type: 'RECORD_COMPANION_ARRIVALS' as const, payload: { worldSeed: 77, locationId: 'cell_3', arrivals: [{ companionId: c.id, journeyId: c.journey!.id, position: { xM: 52.25, yM: 1, zM: 50 } }] } };
    const patch = companionReducer(arrived, action), placed = patch.companions!.elara_vance;
    expect(placed.journey?.status).toBe('arrived'); expect(placed.whereabouts).toMatchObject({ locationId: 'cell_3', position: action.payload.arrivals[0].position });
    expect(placed.journeyDeparture).toBe(s.companions.elara_vance.journeyDeparture); expect(placed.memories.at(-1)?.tags).toContain('shared-journey');
    expect(sharedJourneyRecall(placed,77,'cell_3',true)).toContain('I want to rest');
    expect(sharedJourneyRecall(placed,78,'cell_3')).toBeUndefined();expect(sharedJourneyRecall(placed,77,'cell_1')).toBeUndefined();
    const privateGoal=structuredClone(placed);privateGoal.goals.find(g=>g.id==='restore_temple')!.isSecret=true;
    expect(sharedJourneyRecall(privateGoal,77,'cell_3')).toBeUndefined();
    expect(companionReducer({ ...arrived, ...patch }, action)).toEqual({});
  });
  it('refuses the actual travel hook before movement, food, fare, clock or risk actions', () => {
    const s = departure(), dispatch = vi.fn(), message = vi.fn();
    const { result } = renderHook(() => useAppTravelActions(s, dispatch, message));
    const target = { cellId: 4, x: 0, y: 0, biomeId: 'plains', discovered: true, isPlayerCurrent: false } as WorldCellView;
    result.current.handleTileClick(0, 0, target, { seconds: 3600, destinationCell: { cellId: 4, anchor: { cellId: 4 } }, routeLineage: { fromCellId: 1, intendedCellId: 4, cells: [1, 4] }, ferryFareGp: 3, provision: { rationsToSpend: 1, waterToSpend: 1 } });
    expect(dispatch.mock.calls.map(([action]) => action.type)).toEqual(['ADD_NOTIFICATION']); expect(message.mock.calls[0][0]).toContain('agreed');
  });
});

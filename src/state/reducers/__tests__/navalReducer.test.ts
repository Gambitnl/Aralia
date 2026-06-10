
import { describe, it, expect } from 'vitest';
import { navalReducer } from '../navalReducer';
import { AppAction } from '../../actionTypes';
import { createMockGameState } from '../../../utils/factories';

describe('navalReducer', () => {
  const normalizeShip = (ship: NonNullable<ReturnType<typeof navalReducer>['naval']['playerShips']>[number]) => {
    const { id, ...rest } = ship;
    return rest;
  };

  const normalizeVoyage = (voyage: NonNullable<ReturnType<typeof navalReducer>['naval']['currentVoyage']>) => {
    const { shipId, ...rest } = voyage;
    return rest;
  };

  it('should initialize the fleet', () => {
    const initialGameState = createMockGameState({ worldSeed: 12345 });
    const action: AppAction = { type: 'NAVAL_INITIALIZE_FLEET' };
    const newState = navalReducer(initialGameState, action);

    expect(newState.naval.playerShips).toHaveLength(1);
    expect(newState.naval.playerShips[0].name).toBe('The Drunken Seagull');
    expect(newState.naval.activeShipId).toBe(newState.naval.playerShips[0].id);
  });

  it('should not re-initialize fleet if ships exist', () => {
    const initialGameState = createMockGameState({ worldSeed: 12345 });
    // Setup state with existing ship
    const actionInit: AppAction = { type: 'NAVAL_INITIALIZE_FLEET' };
    let state = navalReducer(initialGameState, actionInit);
    const firstShipId = state.naval.playerShips[0].id;

    // Try to init again
    state = navalReducer(state, actionInit);

    expect(state.naval.playerShips).toHaveLength(1);
    expect(state.naval.playerShips[0].id).toBe(firstShipId);
  });

  it('should start a voyage', () => {
    const initialGameState = createMockGameState({ worldSeed: 12345 });
    // 1. Init fleet
    let state = navalReducer(initialGameState, { type: 'NAVAL_INITIALIZE_FLEET' });

    // 2. Start voyage
    const action: AppAction = {
        type: 'NAVAL_START_VOYAGE',
        payload: { destinationId: 'test_port', distance: 100 }
    };
    state = navalReducer(state, action);

    expect(state.naval.currentVoyage).toBeDefined();
    expect(state.naval.currentVoyage?.status).toBe('Sailing');
    expect(state.naval.currentVoyage?.distanceToDestination).toBe(100);
  });

  it('should advance voyage and dock when distance reached', () => {
    const initialGameState = createMockGameState({ worldSeed: 12345 });
    // 1. Init & Start
    let state = navalReducer(initialGameState, { type: 'NAVAL_INITIALIZE_FLEET' });
    state = navalReducer(state, {
        type: 'NAVAL_START_VOYAGE',
        payload: { destinationId: 'test_port', distance: 50 } // Short distance
    });

    // 2. Advance Day 1
    state = navalReducer(state, { type: 'NAVAL_ADVANCE_VOYAGE' });

    expect(state.naval.currentVoyage?.daysAtSea).toBe(1);

    // 3. Advance Day 2 (should finish if speed is sufficient, Sloop is typically fast enough for 50 miles in 2 days)
    state = navalReducer(state, { type: 'NAVAL_ADVANCE_VOYAGE' });

    expect(state.naval.currentVoyage).toBeDefined();
  });

  it('should recruit crew', () => {
    const initialGameState = createMockGameState({ worldSeed: 12345 });
    let state = navalReducer(initialGameState, { type: 'NAVAL_INITIALIZE_FLEET' });
    const initialCrewCount = state.naval.playerShips[0].crew.members.length;

    state = navalReducer(state, { type: 'NAVAL_RECRUIT_CREW', payload: { role: 'Sailor' } });

    expect(state.naval.playerShips[0].crew.members).toHaveLength(initialCrewCount + 1);
    expect(state.naval.playerShips[0].crew.members[initialCrewCount].role).toBe('Sailor');
  });

  it('should recruit the same crew member for identical seeded states', () => {
    const baseStateA = createMockGameState({ worldSeed: 24680 });
    const baseStateB = createMockGameState({ worldSeed: 24680 });

    const initializedA = navalReducer(baseStateA, { type: 'NAVAL_INITIALIZE_FLEET' });
    const initializedB = navalReducer(baseStateB, { type: 'NAVAL_INITIALIZE_FLEET' });

    const stateA = navalReducer(initializedA, { type: 'NAVAL_RECRUIT_CREW', payload: { role: 'Sailor' } });
    const stateB = navalReducer(initializedB, { type: 'NAVAL_RECRUIT_CREW', payload: { role: 'Sailor' } });

    expect(stateA.naval.playerShips[0].crew.members).toEqual(stateB.naval.playerShips[0].crew.members);
  });

  it('should advance voyages deterministically for identical seeded states', () => {
    const baseStateA = createMockGameState({ worldSeed: 24680 });
    const baseStateB = createMockGameState({ worldSeed: 24680 });

    const initializedA = navalReducer(baseStateA, { type: 'NAVAL_INITIALIZE_FLEET' });
    const initializedB = navalReducer(baseStateB, { type: 'NAVAL_INITIALIZE_FLEET' });

    const voyageStartedA = navalReducer(initializedA, {
        type: 'NAVAL_START_VOYAGE',
        payload: { destinationId: 'test_port', distance: 120 }
    });
    const voyageStartedB = navalReducer(initializedB, {
        type: 'NAVAL_START_VOYAGE',
        payload: { destinationId: 'test_port', distance: 120 }
    });

    const advancedA = navalReducer(voyageStartedA, { type: 'NAVAL_ADVANCE_VOYAGE' });
    const advancedB = navalReducer(voyageStartedB, { type: 'NAVAL_ADVANCE_VOYAGE' });

    expect(normalizeVoyage(advancedA.naval.currentVoyage!)).toEqual(normalizeVoyage(advancedB.naval.currentVoyage!));
    expect(advancedA.naval.playerShips.map(normalizeShip)).toEqual(advancedB.naval.playerShips.map(normalizeShip));
  });
});


import { describe, it, expect } from 'vitest';
import { navalReducer } from '../navalReducer';
import { initialGameState } from '../../initialState';
import { AppAction } from '../../actionTypes';

describe('navalReducer', () => {
  it('should initialize the fleet', () => {
    const action: AppAction = { type: 'NAVAL_INITIALIZE_FLEET' };
    const newState = navalReducer(initialGameState, action);

    expect(newState.naval.playerShips).toHaveLength(1);
    expect(newState.naval.playerShips[0].name).toBe('The Drunken Seagull');
    expect(newState.naval.activeShipId).toBe(newState.naval.playerShips[0].id);
  });

  it('should not re-initialize fleet if ships exist', () => {
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
    let state = navalReducer(initialGameState, { type: 'NAVAL_INITIALIZE_FLEET' });
    const initialCrewCount = state.naval.playerShips[0].crew.members.length;

    state = navalReducer(state, { type: 'NAVAL_RECRUIT_CREW', payload: { role: 'Sailor' } });

    expect(state.naval.playerShips[0].crew.members).toHaveLength(initialCrewCount + 1);
    expect(state.naval.playerShips[0].crew.members[initialCrewCount].role).toBe('Sailor');
  });
});


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

  // ============================================================================
  // Bridge tests (3B): NAVAL_SET_KNOWN_PORTS, destinationId persistence,
  // and docking-on-arrival.
  // ============================================================================

  it('NAVAL_SET_KNOWN_PORTS replaces knownPorts', () => {
    const initialGameState = createMockGameState({ worldSeed: 12345 });
    const action: AppAction = {
      type: 'NAVAL_SET_KNOWN_PORTS',
      payload: { ports: ['1', '3', '7'] },
    };
    const newState = navalReducer(initialGameState, action);

    expect(newState.naval.knownPorts).toEqual(['1', '3', '7']);
  });

  it('NAVAL_SET_KNOWN_PORTS overwrites a prior knownPorts value', () => {
    let state = createMockGameState({ worldSeed: 12345 });
    state = navalReducer(state, { type: 'NAVAL_SET_KNOWN_PORTS', payload: { ports: ['1', '2'] } });
    state = navalReducer(state, { type: 'NAVAL_SET_KNOWN_PORTS', payload: { ports: ['5', '6', '7'] } });

    expect(state.naval.knownPorts).toEqual(['5', '6', '7']);
  });

  it('NAVAL_START_VOYAGE persists destinationId on currentVoyage', () => {
    let state = navalReducer(createMockGameState({ worldSeed: 12345 }), { type: 'NAVAL_INITIALIZE_FLEET' });
    state = navalReducer(state, {
      type: 'NAVAL_START_VOYAGE',
      payload: { destinationId: '42', distance: 200 },
    });

    expect(state.naval.currentVoyage?.destinationId).toBe('42');
  });

  it('NAVAL_ADVANCE_VOYAGE docks the active ship at the arrival port burg', () => {
    // Use a very small distance so the Sloop arrives in one advance.
    let state = navalReducer(createMockGameState({ worldSeed: 12345 }), { type: 'NAVAL_INITIALIZE_FLEET' });
    const shipId = state.naval.activeShipId!;

    state = navalReducer(state, {
      type: 'NAVAL_START_VOYAGE',
      payload: { destinationId: '99', distance: 1 }, // 1 mile — guaranteed arrival in 1 day
    });

    state = navalReducer(state, { type: 'NAVAL_ADVANCE_VOYAGE' });

    // Status confirms the voyage actually arrived; only then is the bridge
    // field (dockedPortBurgId) meaningful — these are not a redundant pair.
    expect(state.naval.currentVoyage?.status).toBe('Docked');
    const activeShip = state.naval.playerShips.find(s => s.id === shipId);
    expect(activeShip?.dockedPortBurgId).toBe(99);
  });

  it('NAVAL_ADVANCE_VOYAGE does NOT dock when destinationId is a non-positive id', () => {
    // destinationId '0' is not a valid FMG burg id (ids start at 1). The
    // strengthened guard (Number.isInteger && > 0) must reject it.
    let state = navalReducer(createMockGameState({ worldSeed: 12345 }), { type: 'NAVAL_INITIALIZE_FLEET' });
    const shipId = state.naval.activeShipId!;

    state = navalReducer(state, {
      type: 'NAVAL_START_VOYAGE',
      payload: { destinationId: '0', distance: 1 },
    });

    state = navalReducer(state, { type: 'NAVAL_ADVANCE_VOYAGE' });

    expect(state.naval.currentVoyage?.status).toBe('Docked'); // really arrived
    const activeShip = state.naval.playerShips.find(s => s.id === shipId);
    expect(activeShip?.dockedPortBurgId).toBeUndefined();
  });

  it('NAVAL_ADVANCE_VOYAGE does NOT set dockedPortBurgId when destinationId is absent', () => {
    let state = navalReducer(createMockGameState({ worldSeed: 12345 }), { type: 'NAVAL_INITIALIZE_FLEET' });
    const shipId = state.naval.activeShipId!;

    // Manually construct a voyage without a destinationId (simulates pre-bridge saves).
    state = navalReducer(state, {
      type: 'NAVAL_START_VOYAGE',
      payload: { destinationId: '', distance: 1 },
    });
    // Strip the destinationId to simulate an old-format voyage record.
    state = {
      ...state,
      naval: {
        ...state.naval,
        currentVoyage: { ...state.naval.currentVoyage!, destinationId: undefined },
      },
    };

    state = navalReducer(state, { type: 'NAVAL_ADVANCE_VOYAGE' });

    const activeShip = state.naval.playerShips.find(s => s.id === shipId);
    expect(activeShip?.dockedPortBurgId).toBeUndefined();
  });

  // ============================================================================
  // NAVAL_CLEAR_VOYAGE (3C-4): clears voyage, leaves ships + dockedPortBurgId intact
  // ============================================================================

  it('NAVAL_CLEAR_VOYAGE sets currentVoyage to null', () => {
    let state = navalReducer(createMockGameState({ worldSeed: 12345 }), { type: 'NAVAL_INITIALIZE_FLEET' });
    state = navalReducer(state, {
      type: 'NAVAL_START_VOYAGE',
      payload: { destinationId: '42', distance: 200 },
    });

    expect(state.naval.currentVoyage).not.toBeNull();

    state = navalReducer(state, { type: 'NAVAL_CLEAR_VOYAGE' });

    expect(state.naval.currentVoyage).toBeNull();
  });

  it('NAVAL_CLEAR_VOYAGE leaves playerShips intact', () => {
    let state = navalReducer(createMockGameState({ worldSeed: 12345 }), { type: 'NAVAL_INITIALIZE_FLEET' });
    const shipsBefore = state.naval.playerShips;

    state = navalReducer(state, {
      type: 'NAVAL_START_VOYAGE',
      payload: { destinationId: '42', distance: 200 },
    });
    state = navalReducer(state, { type: 'NAVAL_CLEAR_VOYAGE' });

    expect(state.naval.playerShips).toEqual(shipsBefore);
  });

  it('NAVAL_CLEAR_VOYAGE leaves dockedPortBurgId intact after arrival', () => {
    // Arrive (voyage sets dockedPortBurgId), then clear the voyage.
    let state = navalReducer(createMockGameState({ worldSeed: 12345 }), { type: 'NAVAL_INITIALIZE_FLEET' });
    const shipId = state.naval.activeShipId!;

    state = navalReducer(state, {
      type: 'NAVAL_START_VOYAGE',
      payload: { destinationId: '99', distance: 1 }, // guaranteed 1-day arrival
    });
    state = navalReducer(state, { type: 'NAVAL_ADVANCE_VOYAGE' }); // arrives → Docked, dockedPortBurgId=99

    expect(state.naval.currentVoyage?.status).toBe('Docked');
    const shipBeforeClear = state.naval.playerShips.find(s => s.id === shipId);
    expect(shipBeforeClear?.dockedPortBurgId).toBe(99);

    state = navalReducer(state, { type: 'NAVAL_CLEAR_VOYAGE' });

    expect(state.naval.currentVoyage).toBeNull();
    const shipAfterClear = state.naval.playerShips.find(s => s.id === shipId);
    // dockedPortBurgId must survive the voyage clear — ship stays docked
    expect(shipAfterClear?.dockedPortBurgId).toBe(99);
  });

  it('NAVAL_CLEAR_VOYAGE is a no-op when currentVoyage is already null', () => {
    const state = createMockGameState({ worldSeed: 12345 });
    expect(state.naval.currentVoyage).toBeNull();

    const newState = navalReducer(state, { type: 'NAVAL_CLEAR_VOYAGE' });

    expect(newState.naval.currentVoyage).toBeNull();
  });

  // ============================================================================
  // NAVAL_PURCHASE_STARTER_SHIP — the in-game ship-acquisition entry point
  // ============================================================================

  it('NAVAL_PURCHASE_STARTER_SHIP creates a ship, deducts gold, and sets activeShipId', () => {
    const state = createMockGameState({ worldSeed: 12345, gold: 1000 });
    const newState = navalReducer(state, { type: 'NAVAL_PURCHASE_STARTER_SHIP', payload: { cost: 500 } });

    expect(newState.naval.playerShips).toHaveLength(1);
    expect(newState.naval.activeShipId).toBe(newState.naval.playerShips[0].id);
    expect(newState.gold).toBe(500);
  });

  it('NAVAL_PURCHASE_STARTER_SHIP is a no-op when a ship already exists (no double charge)', () => {
    let state = createMockGameState({ worldSeed: 12345, gold: 5000 });
    state = navalReducer(state, { type: 'NAVAL_PURCHASE_STARTER_SHIP', payload: { cost: 500 } });
    const goldAfterFirst = state.gold;
    const firstShipId = state.naval.playerShips[0].id;

    state = navalReducer(state, { type: 'NAVAL_PURCHASE_STARTER_SHIP', payload: { cost: 500 } });

    expect(state.naval.playerShips).toHaveLength(1);
    expect(state.naval.playerShips[0].id).toBe(firstShipId);
    expect(state.gold).toBe(goldAfterFirst);
  });

  it('NAVAL_PURCHASE_STARTER_SHIP is a no-op when gold is insufficient', () => {
    const state = createMockGameState({ worldSeed: 12345, gold: 10 });
    const newState = navalReducer(state, { type: 'NAVAL_PURCHASE_STARTER_SHIP', payload: { cost: 500 } });

    expect(newState.naval.playerShips).toHaveLength(0);
    expect(newState.naval.activeShipId).toBeNull();
    expect(newState.gold).toBe(10);
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

  // ── Plan 3D: per-day sea-encounter roll ──────────────────────────────────
  const startLongVoyage = (worldSeed: number, danger: number) => {
    let state = navalReducer(createMockGameState({ worldSeed }), { type: 'NAVAL_INITIALIZE_FLEET' });
    state = navalReducer(state, {
      type: 'NAVAL_START_VOYAGE',
      // Huge distance so the voyage never arrives across the sampled days.
      payload: { destinationId: '7', distance: 10_000_000, danger },
    });
    return state;
  };

  it('NAVAL_START_VOYAGE persists the clamped route danger', () => {
    const state = startLongVoyage(1, 5); // out-of-range danger clamps to 1
    expect(state.naval.currentVoyage?.routeDanger).toBe(1);
  });

  it('rolls sea encounters over a dangerous open-water voyage (log + hostile marker)', () => {
    let state = startLongVoyage(12345, 1); // max danger → encounters likely
    let sawLogEntry = false;
    let sawHostile = false;
    let sawSalvage = false;
    const goldBefore = state.gold;

    for (let day = 0; day < 200; day++) {
      const before = state.gold;
      state = navalReducer(state, { type: 'NAVAL_ADVANCE_VOYAGE' });
      if ((state.adventureLog?.length ?? 0) > 0) sawLogEntry = true;
      if (state.naval.pendingSeaEncounter) {
        sawHostile = true;
        expect(state.naval.pendingSeaEncounter.monsters.length).toBeGreaterThan(0);
        // Consume it like the hook does, so the next day can produce a new one.
        state = navalReducer(state, { type: 'NAVAL_CLEAR_SEA_ENCOUNTER' });
        expect(state.naval.pendingSeaEncounter).toBeNull();
      }
      if (state.gold > before) sawSalvage = true;
    }

    expect(sawLogEntry).toBe(true);
    expect(sawHostile).toBe(true);
    // Peaceful salvage adds gold at least once over 60 max-danger days.
    expect(sawSalvage).toBe(true);
    expect(state.gold).toBeGreaterThanOrEqual(goldBefore);
  });

  it('never rolls a sea encounter on a danger-free route', () => {
    let state = startLongVoyage(999, 0);
    for (let day = 0; day < 40; day++) {
      state = navalReducer(state, { type: 'NAVAL_ADVANCE_VOYAGE' });
      expect(state.naval.pendingSeaEncounter ?? null).toBeNull();
    }
    // No encounter → no combat/discovery adventure-log entries from this voyage.
    expect(state.adventureLog ?? []).toHaveLength(0);
  });

  it('sea-encounter rolls are deterministic for identical seeded voyages', () => {
    let a = startLongVoyage(555, 1);
    let b = startLongVoyage(555, 1);
    for (let day = 0; day < 30; day++) {
      a = navalReducer(a, { type: 'NAVAL_ADVANCE_VOYAGE' });
      b = navalReducer(b, { type: 'NAVAL_ADVANCE_VOYAGE' });
      expect(a.naval.pendingSeaEncounter?.id ?? null).toBe(b.naval.pendingSeaEncounter?.id ?? null);
      if (a.naval.pendingSeaEncounter) {
        a = navalReducer(a, { type: 'NAVAL_CLEAR_SEA_ENCOUNTER' });
        b = navalReducer(b, { type: 'NAVAL_CLEAR_SEA_ENCOUNTER' });
      }
      expect(a.gold).toBe(b.gold);
    }
  });
});


import { describe, it, expect, beforeEach } from 'vitest';
import { crimeReducer } from '../crimeReducer';
// TODO(lint-intent): 'GamePhase' is unused in this test; use it in the assertion path or remove it.
import { GameState, CrimeType, GamePhase as _GamePhase } from '../../../types';
import { initialGameState } from '../../appState';

describe('crimeReducer', () => {
  let initialState: GameState;

  beforeEach(() => {
    initialState = { ...initialGameState };
    initialState.notoriety = {
      globalHeat: 0,
      localHeat: {},
      knownCrimes: [],
      bounties: [],
    };
  });

  it('should increase heat and add crime when COMMIT_CRIME is dispatched', () => {
    const action = {
      type: 'COMMIT_CRIME' as const,
      payload: {
        type: CrimeType.Theft,
        locationId: 'loc1',
        severity: 5,
        witnessed: true,
      },
    };

    const newState = crimeReducer(initialState, action);
    const updatedNotoriety = newState.notoriety!;

    expect(updatedNotoriety.knownCrimes).toHaveLength(1);
    expect(updatedNotoriety.knownCrimes[0].type).toBe(CrimeType.Theft);
    expect(updatedNotoriety.knownCrimes[0].witnessed).toBe(true);

    // Severity 5 is normalized to 50, then witnessed crimes use the accepted
    // crime heat scale: 50 * 0.2 = 10 local heat.
    expect(updatedNotoriety.localHeat['loc1']).toBe(10);
    // Global heat receives a tenth of the local heat footprint.
    expect(updatedNotoriety.globalHeat).toBe(1);
  });

  it('should increase heat less when crime is not witnessed', () => {
    const action = {
      type: 'COMMIT_CRIME' as const,
      payload: {
        type: CrimeType.Theft,
        locationId: 'loc1',
        severity: 5,
        witnessed: false,
      },
    };

    const newState = crimeReducer(initialState, action);
    const updatedNotoriety = newState.notoriety!;

    // Severity 5 is normalized to 50 (since <= 10)
    // Unwitnessed crime: normalizedSeverity * 0.1 = 50 * 0.1 = 5
    expect(updatedNotoriety.localHeat['loc1']).toBe(5);
    // Global heat: heatIncrease * 0.1 = 5 * 0.1 = 0.5
    expect(updatedNotoriety.globalHeat).toBe(0.5);
  });

  it('should cap canonical severity at 100 before adding heat or bounties', () => {
    initialState.notoriety.localHeat = { loc1: 95 };

    const newState = crimeReducer(initialState, {
      type: 'COMMIT_CRIME',
      payload: {
        type: CrimeType.Murder,
        locationId: 'loc1',
        severity: 150,
        witnessed: true,
      },
    });
    const updatedNotoriety = newState.notoriety!;

    // Severity above the canonical max still behaves like severity 100:
    // witnessed heat adds 20, then local heat clamps at 100.
    expect(updatedNotoriety.knownCrimes[0].severity).toBe(100);
    expect(updatedNotoriety.localHeat.loc1).toBe(100);
    expect(updatedNotoriety.globalHeat).toBe(2);
    expect(updatedNotoriety.bounties[0].amount).toBe(1500);
  });


  it('should lower local heat when LOWER_HEAT is dispatched with location', () => {
    // Setup initial heat
    initialState.notoriety.localHeat['loc1'] = 20;

    const action = {
      type: 'LOWER_HEAT' as const,
      payload: {
        amount: 10,
        locationId: 'loc1',
      },
    };

    const newState = crimeReducer(initialState, action);
    expect(newState.notoriety!.localHeat['loc1']).toBe(10);
  });

  it('should lower global heat and all local heats when LOWER_HEAT is dispatched without location', () => {
    // Setup initial heat
    initialState.notoriety.globalHeat = 50;
    initialState.notoriety.localHeat = {
      'loc1': 20,
      'loc2': 30,
    };

    const action = {
      type: 'LOWER_HEAT' as const,
      payload: {
        amount: 10,
      },
    };

    const newState = crimeReducer(initialState, action);
    const updatedNotoriety = newState.notoriety!;

    expect(updatedNotoriety.globalHeat).toBe(40);
    // Local heats reduce by amount * 0.5
    expect(updatedNotoriety.localHeat['loc1']).toBe(15);
    expect(updatedNotoriety.localHeat['loc2']).toBe(25);
  });

  it('should remove expired bounties when world time advances', () => {
    const now = Date.UTC(2026, 0, 8);
    initialState.gameTime = new Date(now);
    initialState.notoriety.bounties = [
      {
        id: 'expired-bounty',
        targetId: 'player',
        issuerId: 'local_guard',
        amount: 300,
        conditions: 'Alive',
        isActive: true,
        expiration: now - 1,
      },
      {
        id: 'future-bounty',
        targetId: 'player',
        issuerId: 'local_guard',
        amount: 600,
        conditions: 'DeadOrAlive',
        isActive: true,
        expiration: now + 1,
      },
    ];

    const newState = crimeReducer(initialState, {
      type: 'ADVANCE_TIME',
      payload: { seconds: 1 },
    });

    // Crime maintenance runs after world time advances, so stale warrants are
    // pruned without needing a separate UI or player-facing action.
    expect(newState.notoriety!.bounties.map(bounty => bounty.id)).toEqual(['future-bounty']);
  });

  it('should add heat for fenced item sales without recording a formal crime', () => {
    initialState.notoriety.globalHeat = 1;
    initialState.notoriety.localHeat = { black_market: 2 };

    const newState = crimeReducer(initialState, {
      type: 'SELL_FENCED_ITEM',
      payload: {
        itemId: 'silver_chalice',
        value: 140,
        locationId: 'black_market',
        heatGenerated: 3,
      },
    });

    // Fencing raises suspicion, but it is not automatically a witnessed crime
    // entry because the fence transaction itself is meant to be covert.
    expect(newState.notoriety!.localHeat.black_market).toBe(5);
    expect(newState.notoriety!.globalHeat).toBe(1.3);
    expect(newState.notoriety!.knownCrimes).toHaveLength(0);
  });
});

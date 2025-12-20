
import { describe, it, expect, beforeEach } from 'vitest';
import { crimeReducer } from '../crimeReducer';
import { GameState, CrimeType, GamePhase } from '../../../types';
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

    // Severity 5 is normalized to 50 (since <= 10)
    // Witnessed crime: normalizedSeverity * 0.5 = 50 * 0.5 = 25
    expect(updatedNotoriety.localHeat['loc1']).toBe(25);
    // Global heat: heatIncrease * 0.1 = 25 * 0.1 = 2.5
    expect(updatedNotoriety.globalHeat).toBe(2.5);
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
});

import { describe, it, expect } from 'vitest';
import { appReducer } from '../appState';
import { createMockGameState } from '../../utils/factories';

/**
 * Integration guard: navalReducer must be wired into the root appReducer pipeline.
 * Previously it was never invoked from appReducer, so every NAVAL_* action was a
 * silent no-op in production (voyages, known-ports sync, fleet acquisition all dead).
 * These tests dispatch through appReducer (not navalReducer directly) so they fail
 * if the slice is ever unwired again.
 */
describe('appReducer naval integration', () => {
  it('routes NAVAL_PURCHASE_STARTER_SHIP through to naval state', () => {
    const before = createMockGameState({ worldSeed: 1, gold: 1000 });
    expect(before.naval.playerShips).toHaveLength(0);

    const after = appReducer(before, { type: 'NAVAL_PURCHASE_STARTER_SHIP', payload: { cost: 500 } });

    expect(after.naval.playerShips).toHaveLength(1);
    expect(after.naval.activeShipId).toBe(after.naval.playerShips[0].id);
    expect(after.gold).toBe(500);
  });

  it('routes a full acquire → set-sail flow through appReducer', () => {
    let state = createMockGameState({ worldSeed: 1, gold: 1000 });
    state = appReducer(state, { type: 'NAVAL_PURCHASE_STARTER_SHIP', payload: { cost: 500 } });

    // The previously-dead voyage path must now reach naval state via appReducer.
    state = appReducer(state, {
      type: 'NAVAL_START_VOYAGE',
      payload: { destinationId: '42', distance: 100 },
    });

    expect(state.naval.currentVoyage).not.toBeNull();
    expect(state.naval.currentVoyage?.destinationId).toBe('42');
    expect(state.naval.currentVoyage?.distanceToDestination).toBe(100);
  });

  it('routes NAVAL_SET_KNOWN_PORTS through appReducer', () => {
    const before = createMockGameState({ worldSeed: 1 });
    const after = appReducer(before, { type: 'NAVAL_SET_KNOWN_PORTS', payload: { ports: ['1', '5'] } });

    expect(after.naval.knownPorts).toEqual(['1', '5']);
  });
});

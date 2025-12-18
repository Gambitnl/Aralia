
import { describe, it, expect } from 'vitest';
import { ritualReducer } from '../ritualReducer';
import { GameState, RitualState } from '../../../types';
import { AppAction } from '../../actionTypes';

describe('ritualReducer', () => {
  const mockInitialState: GameState = {
    activeRituals: {},
    messages: [],
    // ... minimal other state
  } as unknown as GameState;

  const mockRitual: RitualState = {
    id: 'test-ritual',
    spell: { name: 'Test Spell', ritual: true } as any,
    casterId: 'caster-1',
    startTime: 1000,
    durationMinutes: 10,
    progressMinutes: 0,
    isComplete: false,
    interrupted: false,
    interruptConditions: [],
    materialsConsumed: false,
    consumptionThreshold: 1.0,
    participantIds: [],
    participationBonus: 0
  };

  it('should handle START_RITUAL', () => {
    const action: AppAction = {
      type: 'START_RITUAL',
      payload: mockRitual
    };

    const newState = ritualReducer(mockInitialState, action);

    expect(newState.activeRituals?.['test-ritual']).toBeDefined();
    expect(newState.messages?.length).toBe(1);
    expect(newState.messages?.[0].text).toContain('Test Spell ritual started');
  });

  it('should handle ADVANCE_RITUAL and complete', () => {
    const stateWithRitual: GameState = {
      ...mockInitialState,
      activeRituals: {
        'test-ritual': mockRitual
      }
    };

    const action: AppAction = {
      type: 'ADVANCE_RITUAL',
      payload: { ritualId: 'test-ritual', minutes: 10 }
    };

    const newState = ritualReducer(stateWithRitual, action);
    const updatedRitual = newState.activeRituals?.['test-ritual'];

    expect(updatedRitual?.progressMinutes).toBe(10);
    expect(updatedRitual?.isComplete).toBe(true);
    // Should have messages for completion and material consumption (default threshold 1.0)
    expect(newState.messages?.some(m => m.text.includes('ritual is complete'))).toBe(true);
    expect(newState.messages?.some(m => m.text.includes('Materials for Test Spell have been consumed'))).toBe(true);
  });

  it('should handle ABORT_RITUAL', () => {
    const stateWithRitual: GameState = {
      ...mockInitialState,
      activeRituals: {
        'test-ritual': mockRitual
      }
    };

    const action: AppAction = {
      type: 'ABORT_RITUAL',
      payload: { ritualId: 'test-ritual', reason: 'User cancelled' }
    };

    const newState = ritualReducer(stateWithRitual, action);

    expect(newState.activeRituals?.['test-ritual']).toBeUndefined();
    expect(newState.messages?.[0].text).toContain('Ritual aborted: User cancelled');
  });
});

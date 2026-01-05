
import { describe, it, expect } from 'vitest';
import { ritualReducer } from '../ritualReducer';
import { GameState } from '../../../types';
import { RitualState } from '../../../types/ritual';
import * as RitualManager from '../../../systems/rituals/RitualManager';
import { AppAction } from '../../actionTypes';

// Mock the Singular RitualState
const mockRitual: RitualState = {
  id: 'ritual-123',
  spellId: 'spell-1',
  spellName: 'Test Spell',
  casterId: 'caster-1',
  startTime: 0,
  durationTotal: 20,
  durationUnit: 'minutes',
  progress: 0,
  participantIds: [],
  isPaused: false,
  interruptConditions: [],
  config: {
      breaksOnDamage: true,
      breaksOnMove: false,
      requiresConcentration: true,
      allowCooperation: false,
      consumptionTiming: 'end'
  }
};

const mockState: Partial<GameState> = {
  activeRitual: null,
  messages: [],
  gameTime: new Date(1000)
};

describe('ritualReducer', () => {
  it('should handle START_RITUAL', () => {
    const action: AppAction = { type: 'START_RITUAL', payload: mockRitual };
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    const result = ritualReducer(mockState as GameState, action);
    expect(result.activeRitual).toEqual(mockRitual);
    expect(result.messages).toHaveLength(1);
    expect(result.messages![0].text).toContain('A ritual to cast Test Spell has begun');
  });

  it('should handle ADVANCE_RITUAL', () => {
    const stateWithRitual = { ...mockState, activeRitual: mockRitual };
    const action: AppAction = { type: 'ADVANCE_RITUAL', payload: { minutes: 10 } };
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    const result = ritualReducer(stateWithRitual as GameState, action);

    expect(result.activeRitual?.progress).toBe(10);
    expect(RitualManager.isRitualComplete(result.activeRitual as RitualState)).toBe(false);
    expect(result.messages).toHaveLength(0);
  });

  it('should complete ritual via ADVANCE_RITUAL', () => {
    const almostDoneRitual = { ...mockRitual, progress: 15 };
    const stateWithRitual = { ...mockState, activeRitual: almostDoneRitual };   
    const action: AppAction = { type: 'ADVANCE_RITUAL', payload: { minutes: 10 } };
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    const result = ritualReducer(stateWithRitual as GameState, action);

    expect(result.activeRitual?.progress).toBe(20); // Clamped to durationTotal (20)
    expect(RitualManager.isRitualComplete(result.activeRitual as RitualState)).toBe(true);
    expect(result.messages).toHaveLength(1);
    expect(result.messages![0].text).toContain('The ritual is complete!');
  });

  it('should handle ADVANCE_TIME', () => {
    const stateWithRitual = { ...mockState, activeRitual: mockRitual };
    // 600 seconds = 10 minutes
    const action: AppAction = { type: 'ADVANCE_TIME', payload: { seconds: 600 } };
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    const result = ritualReducer(stateWithRitual as GameState, action);

    expect(result.activeRitual?.progress).toBe(10);
  });

  it('should handle INTERRUPT_RITUAL', () => {
    const interruptibleRitual = {
        ...mockRitual,
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        interruptConditions: [{ type: 'damage', threshold: 0 } as unknown]
    };

    const action: AppAction = {
        type: 'INTERRUPT_RITUAL',
        payload: { event: { type: 'damage', targetId: 'caster-1', value: 5 } }
    };
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    const result = ritualReducer({ ...mockState, activeRitual: interruptibleRitual } as GameState, action);

    expect(result.activeRitual?.isPaused).toBe(true);
    expect(result.messages![0].text).toContain('Ritual Interrupted!');
  });

  it('should handle COMPLETE_RITUAL', () => {
      const completedRitual = { ...mockRitual, progress: 20 };
      const action: AppAction = { type: 'COMPLETE_RITUAL', payload: {} };
      // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
      const result = ritualReducer({ ...mockState, activeRitual: completedRitual } as GameState, action);
      expect(result.activeRitual).toBeNull();
  });
});

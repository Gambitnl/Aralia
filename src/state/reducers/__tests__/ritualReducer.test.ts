
import { describe, it, expect } from 'vitest';
import { ritualReducer } from '../ritualReducer';
import { GameState } from '../../../types';
import { RitualState } from '../../../types/rituals';

const mockRitual: RitualState = {
  id: 'ritual-123',
  spell: { name: 'Test Spell', id: 'spell-1', level: 1, castingTime: { unit: 'minutes', value: 10 }, effects: [], school: 'abjuration', description: '', components: { v: true, s: true, m: false }, ritual: true, range: 30, duration: { type: 'instant' } },
  casterId: 'caster-1',
  startTime: 0,
  durationMinutes: 20,
  progressMinutes: 0,
  participantIds: [],
  participationBonus: 0,
  isComplete: false,
  interrupted: false,
  interruptConditions: [],
  materialsConsumed: false,
  consumptionThreshold: 0.5
};

const mockState: Partial<GameState> = {
  activeRitual: null,
  messages: [],
  gameTime: new Date(1000)
};

describe('ritualReducer', () => {
  it('should handle START_RITUAL', () => {
    const action = { type: 'START_RITUAL', payload: mockRitual };
    const result = ritualReducer(mockState as GameState, action as any);
    expect(result.activeRitual).toEqual(mockRitual);
    expect(result.messages).toHaveLength(1);
    expect(result.messages![0].text).toContain('A ritual to cast Test Spell has begun');
  });

  it('should handle ADVANCE_RITUAL', () => {
    const stateWithRitual = { ...mockState, activeRitual: mockRitual };
    const action = { type: 'ADVANCE_RITUAL', payload: { minutes: 10 } };
    const result = ritualReducer(stateWithRitual as GameState, action as any);

    expect(result.activeRitual?.progressMinutes).toBe(10);
    expect(result.activeRitual?.isComplete).toBe(false);
    expect(result.messages).toHaveLength(0); // No messages yet
  });

  it('should complete ritual via ADVANCE_RITUAL', () => {
    const almostDoneRitual = { ...mockRitual, progressMinutes: 15 };
    const stateWithRitual = { ...mockState, activeRitual: almostDoneRitual };
    const action = { type: 'ADVANCE_RITUAL', payload: { minutes: 10 } };
    const result = ritualReducer(stateWithRitual as GameState, action as any);

    expect(result.activeRitual?.progressMinutes).toBe(25); // Cap usually handled by manager logic but simple addition here
    expect(result.activeRitual?.isComplete).toBe(true);
    expect(result.messages).toHaveLength(1);
    expect(result.messages![0].text).toContain('The ritual is complete!');
  });

  it('should handle ADVANCE_TIME', () => {
    const stateWithRitual = { ...mockState, activeRitual: mockRitual };
    // 600 seconds = 10 minutes
    const action = { type: 'ADVANCE_TIME', payload: { seconds: 600 } };
    const result = ritualReducer(stateWithRitual as GameState, action as any);

    expect(result.activeRitual?.progressMinutes).toBe(10);
  });

  it('should handle INTERRUPT_RITUAL', () => {
    const interruptibleRitual = {
        ...mockRitual,
        interruptConditions: [{ type: 'damage', threshold: 0 }]
    };

    const action = {
        type: 'INTERRUPT_RITUAL',
        payload: { event: { type: 'damage', targetId: 'caster-1', value: 5 } }
    };

    const result = ritualReducer({ ...mockState, activeRitual: interruptibleRitual } as GameState, action as any);

    expect(result.activeRitual?.interrupted).toBe(true);
    expect(result.messages![0].text).toContain('Ritual Interrupted!');
  });

  it('should handle COMPLETE_RITUAL', () => {
      const completedRitual = { ...mockRitual, isComplete: true };
      const action = { type: 'COMPLETE_RITUAL', payload: {} };
      const result = ritualReducer({ ...mockState, activeRitual: completedRitual } as GameState, action as any);
      expect(result.activeRitual).toBeNull();
  });
});

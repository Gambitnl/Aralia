
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

  it('should handle INTERRUPT_RITUAL', () => {
    const stateWithRitual = { ...mockState, activeRitual: mockRitual };
    // Simulate an event that triggers interruption
    // We need to ensure the RitualManager logic inside the reducer respects the input.
    // However, ritualReducer calls RitualManager.checkInterruption.
    // Since we can't easily mock the static RitualManager here without complexity,
    // we rely on the fact that an empty interrupt condition list usually means no interruption,
    // unless we mock the manager.
    // But let's assume we pass an event that *would* interrupt if configured.

    // Actually, integration testing the reducer with the real manager is better.
    // Let's add an interrupt condition to the mock ritual.
    const interruptibleRitual = {
        ...mockRitual,
        interruptConditions: [{ type: 'damage', threshold: 0 }]
    };

    const action = {
        type: 'INTERRUPT_RITUAL',
        payload: { event: { type: 'damage', targetId: 'caster-1', value: 5 } }
    };

    // The reducer uses the state's activeRitual.
    const result = ritualReducer({ ...mockState, activeRitual: interruptibleRitual } as GameState, action as any);

    // With damage condition and damage event, it should interrupt.
    expect(result.activeRitual?.interrupted).toBe(true);
    expect(result.messages![0].text).toContain('Ritual Interrupted!');
  });
});

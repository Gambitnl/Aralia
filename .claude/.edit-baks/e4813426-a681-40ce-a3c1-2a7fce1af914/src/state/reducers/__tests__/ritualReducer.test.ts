
import { describe, it, expect } from 'vitest';
import { ritualReducer } from '../ritualReducer';
import { GameState } from '../../../types';
import { RitualState, RitualConfig, InterruptCondition } from '../../../types/ritual';
import { SpellSchool } from '../../../types/spells';

// Updated mock to match the new RitualState interface from PR #725
const mockConfig: RitualConfig = {
  breaksOnDamage: true,
  breaksOnMove: false,
  requiresConcentration: true,
  allowCooperation: false,
  consumptionTiming: 'end'
};

const mockInterruptConditions: InterruptCondition[] = [
  { type: 'damage', saveType: 'Constitution', dcCalculation: 'damage_half' }
];

const mockRitual: RitualState = {
  id: 'ritual-123',
  spellId: 'spell-1',
  spellName: 'Test Spell',
  casterId: 'caster-1',
  startTime: 0,
  durationTotal: 20, // rounds or minutes
  durationUnit: 'minutes',
  progress: 0,
  isPaused: false,
  participantIds: [],
  interruptConditions: mockInterruptConditions,
  config: mockConfig
};

// Mock spell for START_RITUAL payload (the payload uses the old format with embedded spell)
const mockStartPayload = {
  id: 'ritual-123',
  spell: {
    name: 'Test Spell',
    id: 'spell-1',
    level: 1,
    castingTime: { unit: 'minutes' as const, value: 10 },
    effects: [],
    school: SpellSchool.Abjuration,
    description: '',
    components: { v: true, s: true, m: false },
    ritual: true,
    range: 30,
    duration: { type: 'instant' as const }
  },
  spellId: 'spell-1',
  spellName: 'Test Spell',
  casterId: 'caster-1',
  startTime: 0,
  durationTotal: 20,
  durationUnit: 'minutes' as const,
  durationMinutes: 20, // legacy field for message
  progress: 0,
  progressMinutes: 0,
  isPaused: false,
  participantIds: [],
  participationBonus: 0,
  isComplete: false,
  interrupted: false,
  interruptConditions: mockInterruptConditions,
  materialsConsumed: false,
  consumptionThreshold: 0.5,
  config: mockConfig
};

const mockState: Partial<GameState> = {
  activeRitual: null,
  messages: [],
  gameTime: new Date(1000)
};

describe('ritualReducer', () => {
  it('should handle START_RITUAL', () => {
    const action = { type: 'START_RITUAL', payload: mockStartPayload };
    const result = ritualReducer(mockState as GameState, action as any);
    expect(result.activeRitual).toBeDefined();
    expect(result.messages).toHaveLength(1);
    expect(result.messages![0].text).toContain('A ritual to cast Test Spell has begun');
  });

  it('should handle ADVANCE_RITUAL', () => {
    const stateWithRitual = { ...mockState, activeRitual: mockRitual };
    const action = { type: 'ADVANCE_RITUAL', payload: { minutes: 10 } };
    const result = ritualReducer(stateWithRitual as GameState, action as any);

    expect(result.activeRitual?.progress).toBe(10);
    expect(result.messages).toHaveLength(0); // No messages yet (not complete)
  });

  it('should complete ritual via ADVANCE_RITUAL', () => {
    const almostDoneRitual = { ...mockRitual, progress: 15 };
    const stateWithRitual = { ...mockState, activeRitual: almostDoneRitual };
    const action = { type: 'ADVANCE_RITUAL', payload: { minutes: 10 } };
    const result = ritualReducer(stateWithRitual as GameState, action as any);

    expect(result.activeRitual?.progress).toBe(25); // progress > durationTotal
    // Note: isComplete is now derived from progress >= durationTotal, not a flag
    expect(result.messages).toHaveLength(1);
    expect(result.messages![0].text).toContain('The ritual is complete!');
  });

  it('should handle ADVANCE_TIME', () => {
    const stateWithRitual = { ...mockState, activeRitual: mockRitual };
    // 600 seconds = 10 minutes
    const action = { type: 'ADVANCE_TIME', payload: { seconds: 600 } };
    const result = ritualReducer(stateWithRitual as GameState, action as any);

    expect(result.activeRitual?.progress).toBe(10);
  });

  it('should handle INTERRUPT_RITUAL', () => {
    const interruptibleRitual = {
      ...mockRitual,
      config: { ...mockConfig, breaksOnDamage: true },
      interruptConditions: [{ type: 'damage' as const, threshold: 0, saveType: 'Constitution' as const, dcCalculation: 'damage_half' as const }]
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
    const completedRitual = { ...mockRitual, progress: mockRitual.durationTotal };
    const action = { type: 'COMPLETE_RITUAL', payload: {} };
    const result = ritualReducer({ ...mockState, activeRitual: completedRitual } as GameState, action as any);
    expect(result.activeRitual).toBeNull();
  });
});

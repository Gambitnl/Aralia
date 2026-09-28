import { describe, it, expect } from 'vitest';
import { appReducer } from '../appState';
import { createMockGameState } from '../../utils/core';
import type { RitualState } from '../../types/rituals';

// agora-f4ab.4 (2026-09-13): START_RITUAL and its siblings were silent no-ops
// in production because ritualReducer only ran inside worldReducer for
// ADVANCE_TIME. These tests pin the app-level pipeline.

const ritual = (over: Partial<RitualState> = {}): RitualState => ({
  id: 'ritual-app-1',
  spellId: 'detect-magic',
  spellName: 'Detect Magic',
  casterId: 'caster-1',
  startTime: 1,
  durationTotalSeconds: 600,
  progressSeconds: 0,
  durationTotal: 10,
  durationUnit: 'minutes',
  progress: 0,
  isPaused: false,
  participantIds: [],
  interruptConditions: [],
  config: {
    breaksOnDamage: true,
    breaksOnMove: true,
    requiresConcentration: true,
    allowCooperation: false,
    consumptionTiming: 'end',
  },
  ...over,
});

describe('appReducer ritual pipeline', () => {
  it('START_RITUAL lands in state.activeRitual', () => {
    const state = createMockGameState({ activeRitual: null });
    const next = appReducer(state, { type: 'START_RITUAL', payload: ritual() });
    expect(next.activeRitual?.id).toBe('ritual-app-1');
    expect(next.activeRitual?.spellName).toBe('Detect Magic');
  });

  it('ADVANCE_RITUAL moves progress once through the app pipeline', () => {
    const state = createMockGameState({ activeRitual: ritual() });
    const next = appReducer(state, { type: 'ADVANCE_RITUAL', payload: { seconds: 60 } });
    expect(next.activeRitual?.progressSeconds).toBe(60);
  });

  it('ADVANCE_TIME advances the ritual exactly once (worldReducer owns it)', () => {
    const state = createMockGameState({ activeRitual: ritual() });
    const next = appReducer(state, { type: 'ADVANCE_TIME', payload: { seconds: 120 } });
    expect(next.activeRitual?.progressSeconds).toBe(120);
  });

  it('COMPLETE_RITUAL clears state.activeRitual', () => {
    const state = createMockGameState({ activeRitual: ritual({ progressSeconds: 600, progress: 10 }) });
    const next = appReducer(state, { type: 'COMPLETE_RITUAL' } as never);
    expect(next.activeRitual).toBeNull();
  });
});

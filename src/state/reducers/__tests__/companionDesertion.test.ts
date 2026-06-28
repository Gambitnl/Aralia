import { describe, it, expect } from 'vitest';
import { companionReducer } from '../companionReducer';
import { GameState } from '../../../types';
import { AppAction } from '../../actionTypes';
import { createMockGameState } from '../../../utils/factories';
import type { Companion } from '../../../types/companions';

/**
 * A starving march drains companion loyalty and, past a threshold, makes a
 * companion abandon the party. These cover the two reducer primitives the travel
 * gate dispatches: ADJUST_COMPANION_LOYALTY (clamped 0–100) and COMPANION_DESERT
 * (removed from the roster, with an announcement).
 */
function companion(id: string, loyalty: number): Companion {
  return {
    id,
    identity: { name: id === 'ada' ? 'Ada' : 'Bran' },
    loyalty,
    relationships: {},
    personality: {},
    goals: [],
    approvalHistory: [],
    memories: [],
    discoveredFacts: [],
    reactionRules: [],
  } as unknown as Companion;
}

function stateWith(...comps: Companion[]): GameState {
  const companions: Record<string, Companion> = {};
  for (const c of comps) companions[c.id] = c;
  return { ...createMockGameState(), companions };
}

describe('ADJUST_COMPANION_LOYALTY', () => {
  it('drains loyalty and clamps at zero', () => {
    const next = companionReducer(stateWith(companion('ada', 10)), {
      type: 'ADJUST_COMPANION_LOYALTY',
      payload: { companionId: 'ada', delta: -15 },
    } as AppAction);
    expect(next.companions!.ada.loyalty).toBe(0);
  });

  it('caps loyalty at 100 on a positive delta', () => {
    const next = companionReducer(stateWith(companion('ada', 95)), {
      type: 'ADJUST_COMPANION_LOYALTY',
      payload: { companionId: 'ada', delta: 20 },
    } as AppAction);
    expect(next.companions!.ada.loyalty).toBe(100);
  });
});

describe('COMPANION_DESERT', () => {
  it('removes the companion from the roster and announces it', () => {
    const next = companionReducer(stateWith(companion('ada', 5), companion('bran', 90)), {
      type: 'COMPANION_DESERT',
      payload: { companionId: 'ada', reason: 'starvation' },
    } as AppAction);
    expect(next.companions!.ada).toBeUndefined();
    expect(next.companions!.bran).toBeDefined();
    expect(next.messages!.some((m) => /Ada/.test(m.text) && /abandons/.test(m.text))).toBe(true);
  });
});

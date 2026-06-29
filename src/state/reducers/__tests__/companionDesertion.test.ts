import { describe, it, expect } from 'vitest';
import { companionReducer } from '../companionReducer';
import { GameState } from '../../../types';
import { AppAction } from '../../actionTypes';
import { createMockGameState } from '../../../utils/factories';
import type { Companion } from '../../../types/companions';
import type { PlayerCharacter } from '../../../types/character';

/**
 * A starving march drains companion loyalty and, past a threshold, makes a
 * companion abandon the party. These cover the two reducer primitives the travel
 * gate dispatches: ADJUST_COMPANION_LOYALTY (clamped 0–100) and COMPANION_DESERT.
 *
 * DESIGN §5: desertion now removes the member from BOTH stores' active
 * membership — it drops the matching `state.party` entry AND marks the
 * Companion `inParty:false` (KEEPING the record so loyalty/relationship persist
 * and they remain re-recruitable), with an announcement.
 */
function companion(id: string, loyalty: number): Companion {
  return {
    id,
    identity: { name: id === 'ada' ? 'Ada' : 'Bran' },
    loyalty,
    inParty: true,
    relationships: {},
    personality: {},
    goals: [],
    approvalHistory: [],
    memories: [],
    discoveredFacts: [],
    reactionRules: [],
  } as unknown as Companion;
}

/** Minimal playable-roster entry sharing the companion's id. */
function member(id: string): PlayerCharacter {
  return { id, name: id === 'ada' ? 'Ada' : 'Bran' } as unknown as PlayerCharacter;
}

function stateWith(...comps: Companion[]): GameState {
  const companions: Record<string, Companion> = {};
  for (const c of comps) companions[c.id] = c;
  // Mirror each companion into the playable roster so dual-store removal is testable.
  const party = comps.map((c) => member(c.id));
  return { ...createMockGameState(), companions, party };
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
  it('drops the deserter from the playable party but keeps the others', () => {
    const next = companionReducer(stateWith(companion('ada', 5), companion('bran', 90)), {
      type: 'COMPANION_DESERT',
      payload: { companionId: 'ada', reason: 'starvation' },
    } as AppAction);
    expect(next.party!.some((m) => m.id === 'ada')).toBe(false);
    expect(next.party!.some((m) => m.id === 'bran')).toBe(true);
  });

  it('KEEPS the Companion record but marks it inParty:false (re-recruitable)', () => {
    const next = companionReducer(stateWith(companion('ada', 5), companion('bran', 90)), {
      type: 'COMPANION_DESERT',
      payload: { companionId: 'ada', reason: 'starvation' },
    } as AppAction);
    // Relationship layer persists so loyalty/approval survive a desertion.
    expect(next.companions!.ada).toBeDefined();
    expect(next.companions!.ada.inParty).toBe(false);
    expect(next.companions!.bran.inParty).toBe(true);
  });

  it('announces the departure', () => {
    const next = companionReducer(stateWith(companion('ada', 5), companion('bran', 90)), {
      type: 'COMPANION_DESERT',
      payload: { companionId: 'ada', reason: 'starvation' },
    } as AppAction);
    expect(next.messages!.some((m) => /Ada/.test(m.text) && /abandons/.test(m.text))).toBe(true);
  });

  it('is a no-op for an unknown companion', () => {
    const next = companionReducer(stateWith(companion('ada', 5)), {
      type: 'COMPANION_DESERT',
      payload: { companionId: 'nobody', reason: 'starvation' },
    } as AppAction);
    expect(next).toEqual({});
  });
});

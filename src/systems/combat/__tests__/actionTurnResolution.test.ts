/** Keeps resource/status decisions deterministic independently of React publication. */
import { describe, expect, it, vi } from 'vitest';
import type { Ability } from '../../../types/combat';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import { resolveImmediateAbilityTurnEffects } from '../actionTurnResolution';

const ability = (id: string, patch: Partial<Ability> = {}): Ability => ({
  id, name: id, description: id, type: 'utility', cost: { type: 'free' },
  targeting: 'self', range: 0, effects: [], ...patch,
});
const receipts = () => {
  const calls: string[] = [];
  return { calls, generateId: () => { calls.push('id'); return `receipt-${calls.length}`; }, now: () => { calls.push('clock'); return 100; } };
};

describe('pure immediate turn effects', () => {
  it('does not consume receipt sources or clone the character for an unrelated ability', () => {
    const character = createMockCombatCharacter();
    const sources = receipts();
    const result = resolveImmediateAbilityTurnEffects(character, ability('unrelated'), 3, sources);
    expect(result.character).toBe(character);
    expect(result.followUpLogs).toEqual([]);
    expect(sources.calls).toEqual([]);
  });

  it('adds Dash movement without mutating the paid character and preserves receipt order', () => {
    const character = createMockCombatCharacter();
    const snapshot = structuredClone(character);
    const sources = receipts();
    const result = resolveImmediateAbilityTurnEffects(character, ability('dash', { effects: [{ type: 'movement', value: 30 }] }), 3, sources);
    expect(result.character.actionEconomy.movement.total).toBe(character.actionEconomy.movement.total + 30);
    expect(character).toEqual(snapshot);
    expect(sources.calls).toEqual(['id', 'clock']);
    expect(result.followUpLogs[0]).toMatchObject({ id: 'receipt-1', timestamp: 100, data: { movementGain: 30 } });
  });

  it('keeps Disengage idempotent while retaining a receipt for each accepted use', () => {
    const sources = receipts();
    const first = resolveImmediateAbilityTurnEffects(createMockCombatCharacter(), ability('disengage'), 3, sources);
    const second = resolveImmediateAbilityTurnEffects(first.character, ability('disengage'), 3, sources);
    expect(second.character.statusEffects.filter(effect => effect.id === 'disengage')).toHaveLength(1);
    expect(second.followUpLogs).toHaveLength(1);
    expect(sources.calls).toEqual(['id', 'clock', 'id', 'clock']);
  });

  it('does not stack Rage or emit another receipt when already raging', () => {
    const sources = receipts();
    const first = resolveImmediateAbilityTurnEffects(createMockCombatCharacter(), ability('rage'), 3, sources);
    const second = resolveImmediateAbilityTurnEffects(first.character, ability('rage'), 3, sources);
    expect(second.character).toBe(first.character);
    expect(second.followUpLogs).toEqual([]);
    expect(sources.calls).toEqual(['id', 'clock']);
  });

  it('uses only supplied clock and ID sources for Action Surge', () => {
    const character = createMockCombatCharacter();
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('ambient clock'); });
    try {
      const result = resolveImmediateAbilityTurnEffects(character, ability('action_surge'), 3, receipts());
      expect(result.character.actionEconomy.action.remaining).toBe(character.actionEconomy.action.remaining + 1);
      expect(result.followUpLogs[0].timestamp).toBe(100);
    } finally { clock.mockRestore(); }
  });
});

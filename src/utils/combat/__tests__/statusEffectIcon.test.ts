/**
 * @file src/utils/combat/__tests__/statusEffectIcon.test.ts
 * agora-f821.31: `getStatusEffectIcon` had a byte-identical ASCII twin inside
 * BattleMapOverlay.tsx, and neither knew condition names, so every condition
 * drew the same skull. Both now read one table. This pins that behaviour.
 */
import { describe, it, expect } from 'vitest';
import type { StatusEffect } from '../../../types/combat';
import { getStatusEffectIcon } from '../combatUtils';
import { resolveStatusGlyph, lookupConditionVisual } from '../../visuals/conditionPalette';

const effect = (over: Partial<StatusEffect>): StatusEffect =>
  ({ id: 'e1', name: 'Effect', type: 'debuff', duration: 1, ...over }) as StatusEffect;

describe('getStatusEffectIcon', () => {
  it('still returns the kind-of-effect fallback emoji it always did', () => {
    expect(getStatusEffectIcon(effect({ name: 'Nameless', type: 'buff' }))).toBe('✨');
    expect(getStatusEffectIcon(effect({ name: 'Nameless', type: 'debuff' }))).toBe('☠️');
    expect(getStatusEffectIcon(effect({ name: 'Nameless', type: 'dot' }))).toBe('🔥');
    expect(getStatusEffectIcon(effect({ name: 'Nameless', type: 'hot' }))).toBe('➕');
    expect(
      getStatusEffectIcon(effect({ name: 'Nameless', type: 'weird' as StatusEffect['type'] })),
    ).toBe('◼️');
  });

  it('still prefers an explicit icon on the effect', () => {
    expect(getStatusEffectIcon(effect({ icon: '★', type: 'buff' }))).toBe('★');
  });

  it('gives a NAMED condition its own glyph instead of the debuff skull', () => {
    const poisoned = getStatusEffectIcon(effect({ name: 'Poisoned' }));
    const restrained = getStatusEffectIcon(effect({ name: 'Restrained' }));
    const blinded = getStatusEffectIcon(effect({ name: 'Blinded' }));
    expect(new Set([poisoned, restrained, blinded]).size).toBe(3);
    expect(poisoned).toBe(lookupConditionVisual('Poisoned')!.icon);
    expect(poisoned).not.toBe('☠️');
  });

  it('shares its table with the battle-map overlay, which asks for ASCII', () => {
    // The overlay renders resolveStatusGlyph(effect, 'ascii') at the single
    // call site that used to hold the duplicate switch.
    expect(resolveStatusGlyph(effect({ type: 'buff' }), 'ascii')).toBe('+');
    expect(resolveStatusGlyph(effect({ type: 'debuff' }), 'ascii')).toBe('!');
    expect(resolveStatusGlyph(effect({ type: 'dot' }), 'ascii')).toBe('DOT');
    expect(resolveStatusGlyph(effect({ type: 'hot' }), 'ascii')).toBe('HOT');
    expect(
      resolveStatusGlyph(effect({ type: 'weird' as StatusEffect['type'] }), 'ascii'),
    ).toBe('?');
  });
});

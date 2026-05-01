import { describe, expect, it } from 'vitest';
import { AbilityEffectMapper } from '../AbilityEffectMapper';
import type { AbilityEffect } from '@/types/combat';

// These tests protect the bridge used by battle-map attacks before they enter
// the shared command system. Real encounter monsters currently describe many
// attacks with flat `value` damage, so losing that value makes combat animate
// forever without changing hit points.
describe('AbilityEffectMapper', () => {
  it('preserves flat damage values as command damage formulas', () => {
    const effect: AbilityEffect = {
      type: 'damage',
      value: 4,
      damageType: 'physical',
    };

    const mapped = AbilityEffectMapper.mapToSpellEffect(effect);

    expect(mapped?.type).toBe('DAMAGE');
    if (!mapped || mapped.type !== 'DAMAGE') {
      throw new Error('Expected flat damage to map to a damage effect');
    }
    expect(mapped.damage.dice).toBe('4');
  });

  it('keeps explicit dice formulas ahead of flat fallback values', () => {
    const effect: AbilityEffect = {
      type: 'damage',
      value: 4,
      dice: '1d8+2',
      damageType: 'physical',
    };

    const mapped = AbilityEffectMapper.mapToSpellEffect(effect);

    expect(mapped?.type).toBe('DAMAGE');
    if (!mapped || mapped.type !== 'DAMAGE') {
      throw new Error('Expected dice damage to map to a damage effect');
    }
    expect(mapped.damage.dice).toBe('1d8+2');
  });

  it('preserves flat healing values as command healing formulas', () => {
    const effect: AbilityEffect = {
      type: 'heal',
      value: 5,
    };

    const mapped = AbilityEffectMapper.mapToSpellEffect(effect);

    expect(mapped?.type).toBe('HEALING');
    if (!mapped || mapped.type !== 'HEALING') {
      throw new Error('Expected flat healing to map to a healing effect');
    }
    expect(mapped.healing.dice).toBe('5');
  });
});

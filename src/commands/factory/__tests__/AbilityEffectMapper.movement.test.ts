import { describe, expect, it } from 'vitest';
import { AbilityEffectMapper } from '../AbilityEffectMapper';
import type { AbilityEffect } from '@/types/combat';

// spellAbilityFactory translates MOVEMENT spell rows into `movement` and
// `teleport` AbilityEffects that carry their reach in feet on `value`.
// MovementCommand reads `distance` off the mapped SpellEffect, so the mapper
// must carry that number across or every translated push moves nobody.
describe('AbilityEffectMapper movement distance', () => {
  it('carries a translated 10 ft push through to the movement effect distance', () => {
    const effect: AbilityEffect = {
      type: 'movement',
      value: 10,
    };

    const mapped = AbilityEffectMapper.mapToSpellEffect(effect);

    expect(mapped?.type).toBe('MOVEMENT');
    if (!mapped || mapped.type !== 'MOVEMENT') {
      throw new Error('Expected a movement ability effect to map to a MOVEMENT effect');
    }
    expect(mapped.movementType).toBe('push');
    expect(mapped.distance).toBe(10);
  });

  it('carries a teleport range through as the teleport distance', () => {
    const effect: AbilityEffect = {
      type: 'teleport',
      value: 30,
    };

    const mapped = AbilityEffectMapper.mapToSpellEffect(effect);

    expect(mapped?.type).toBe('MOVEMENT');
    if (!mapped || mapped.type !== 'MOVEMENT') {
      throw new Error('Expected a teleport ability effect to map to a MOVEMENT effect');
    }
    expect(mapped.movementType).toBe('teleport');
    expect(mapped.distance).toBe(30);
  });

  it('leaves distance undefined when the ability authors no reach', () => {
    const effect: AbilityEffect = {
      type: 'movement',
    };

    const mapped = AbilityEffectMapper.mapToSpellEffect(effect);

    expect(mapped?.type).toBe('MOVEMENT');
    if (!mapped || mapped.type !== 'MOVEMENT') {
      throw new Error('Expected a movement ability effect to map to a MOVEMENT effect');
    }
    expect(mapped.distance).toBeUndefined();
  });
});

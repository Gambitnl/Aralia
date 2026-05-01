import { AbilityEffect } from '@/types/combat';
import { SpellEffect, DamageType, ConditionName } from '@/types/spells';

// This mapper is the bridge between lightweight battle-map abilities and the
// shared spell-effect command pipeline. Monster attacks and simple combat
// actions often store a flat `value`, while the command layer expects a dice
// formula string; keeping that translation here preserves one execution path
// for damage, healing, logs, and future command-side mechanics.
const getEffectMagnitudeFormula = (abilityEffect: AbilityEffect): string => {
  if (abilityEffect.dice) return abilityEffect.dice;

  if (typeof abilityEffect.value === 'number' && Number.isFinite(abilityEffect.value)) {
    return String(Math.max(0, abilityEffect.value));
  }

  // Zero remains the explicit fallback for effects that are placeholders or
  // whose magnitude is supplied by a later mechanic. This keeps old scaffolding
  // mappable without pretending missing damage data is valid damage.
  return '0';
};

export class AbilityEffectMapper {
  static mapToSpellEffect(abilityEffect: AbilityEffect): SpellEffect | null {
    switch (abilityEffect.type) {
      case 'damage':
        return {
          type: 'DAMAGE',
          trigger: { type: 'immediate' },
          condition: { type: 'always' }, // Attack roll is handled by Command wrapper
          damage: {
            dice: getEffectMagnitudeFormula(abilityEffect),
            type: abilityEffect.damageType || DamageType.Bludgeoning,
          },
        };
      case 'heal':
        return {
          type: 'HEALING',
          trigger: { type: 'immediate' },
          condition: { type: 'always' },
          healing: {
            dice: getEffectMagnitudeFormula(abilityEffect),
          },
        };
      case 'status':
        if (!abilityEffect.statusEffect) return null;
        return {
          type: 'STATUS_CONDITION',
          trigger: { type: 'immediate' },
          condition: { type: 'always' },
          statusCondition: {
            // TODO(next-agent): Preserve behavior; enforce ConditionName at the AbilityEffect source to remove this cast.
            name: abilityEffect.statusEffect.name as ConditionName,
            duration: { type: 'rounds', value: abilityEffect.statusEffect.duration },
          },
        };
      case 'movement':
      case 'teleport':
        return {
          type: 'MOVEMENT',
          trigger: { type: 'immediate' },
          condition: { type: 'always' },
          movementType: abilityEffect.type === 'teleport' ? 'teleport' : 'push', // Defaulting to push, needs refinement
          duration: { type: 'special' },
        };
      default:
        console.warn(`Ability effect type ${abilityEffect.type} not directly mappable to SpellEffect`);
        return null;
    }
  }
}

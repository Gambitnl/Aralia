import { AbilityEffect } from '@/types/combat';
import { SpellEffect, DamageType, ConditionName } from '@/types/spells';

export class AbilityEffectMapper {
  static mapToSpellEffect(abilityEffect: AbilityEffect): SpellEffect | null {
    switch (abilityEffect.type) {
      case 'damage':
        return {
          type: 'DAMAGE',
          trigger: { type: 'immediate' },
          condition: { type: 'always' }, // Attack roll is handled by Command wrapper
          damage: {
            dice: abilityEffect.dice || '0',
            type: abilityEffect.damageType || DamageType.Bludgeoning,
          },
        };
      case 'heal':
        return {
          type: 'HEALING',
          trigger: { type: 'immediate' },
          condition: { type: 'always' },
          healing: {
            dice: abilityEffect.dice || '0',
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

import { AbilityEffect } from '@/types/combat';
import { SpellEffect, DamageType } from '@/types/spells';

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
            // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
            // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
            // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
            name: abilityEffect.statusEffect.name as unknown, // Cast to ConditionName
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

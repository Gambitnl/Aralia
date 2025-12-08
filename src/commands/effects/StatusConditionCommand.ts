import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CombatState, StatusEffect } from '../../types/combat';
import { isStatusConditionEffect } from '../../types/spells';
import { calculateSpellDC, rollSavingThrow } from '../../utils/savingThrowUtils';
import { generateId } from '../../utils/combatUtils';

export class StatusConditionCommand extends BaseEffectCommand {
  execute(state: CombatState): CombatState {
    if (!isStatusConditionEffect(this.effect)) {
      return state;
    }

    let currentState = state;

    for (const target of this.getTargets(currentState)) {
      // 1. Check Saving Throw (if applicable)
      // Most status conditions allow a save to negate (e.g. Hold Person, Blindness/Deafness)
      if (this.effect.condition.type === 'save' && this.effect.condition.saveType) {
        const caster = this.getCaster(currentState);
        const dc = calculateSpellDC(caster);
        const saveResult = rollSavingThrow(target, this.effect.condition.saveType, dc);

        currentState = this.addLogEntry(currentState, {
          type: 'status',
          message: `${target.name} ${saveResult.success ? 'succeeds' : 'fails'} ${this.effect.condition.saveType} save (${saveResult.total} vs DC ${dc})`,
          characterId: target.id
        });

        if (saveResult.success) {
          // Save success: Condition is negated (typically)
          currentState = this.addLogEntry(currentState, {
            type: 'status', // using 'status' for generic info
            message: `${target.name} resists the ${this.effect.statusCondition.name} condition`,
            characterId: target.id
          });
          continue; // Skip applying effect
        }
      }

      // 2. Apply Condition
      const durationRounds = this.calculateDuration(this.effect.statusCondition.duration);

      const newStatusEffect: StatusEffect = {
        id: generateId(),
        name: this.effect.statusCondition.name,
        type: 'debuff', // Most are debuffs, some buffs exist (Invisible) but usually 'StatusCondition' implies negative in this context? 
        // Actually Invisibility is a StatusCondition.
        // Logic: If it's a "Condition" from the standard list, we can infer type or default to 'debuff'.
        duration: durationRounds,
        effect: {
          type: 'condition',
        },
        icon: this.getIconForCondition(this.effect.statusCondition.name)
      };

      // Check if target already has this condition?
      // D&D rules: Effects with same name don't stack.
      const existingIndex = target.statusEffects.findIndex(e => e.name === newStatusEffect.name);
      let newStatusEffects = [...target.statusEffects];

      if (existingIndex >= 0) {
        // Refresh duration
        newStatusEffects[existingIndex] = newStatusEffect;
      } else {
        newStatusEffects.push(newStatusEffect);
      }

      currentState = this.updateCharacter(currentState, target.id, {
        statusEffects: newStatusEffects
      });

      currentState = this.addLogEntry(currentState, {
        type: 'status',
        message: `${target.name} is now ${this.effect.statusCondition.name}`,
        characterId: target.id,
        targetIds: [target.id],
        data: { statusId: newStatusEffect.id, condition: this.effect.statusCondition.name }
      });
    }

    return currentState;
  }

  private calculateDuration(duration: { type: string, value?: number }): number {
    const val = duration.value || 1;
    switch (duration.type) {
      case 'rounds': return val;
      case 'minutes': return val * 10;
      case 'hours': return val * 600;
      case 'instantaneous': return 0;
      default: return 1;
    }
  }

  private getIconForCondition(name: string): string {
    const map: Record<string, string> = {
      'Blinded': '👁️',
      'Charmed': '💕',
      'Deafened': '🙉',
      'Frightened': '😱',
      'Grappled': '✊',
      'Incapacitated': '🤕',
      'Invisible': '👻',
      'Paralyzed': '⚡',
      'Petrified': '🗿',
      'Poisoned': '🤢',
      'Prone': '🛌',
      'Restrained': '⛓️',
      'Stunned': '💫',
      'Unconscious': '💤',
      'Exhaustion': '😫'
    };
    return map[name] || '💀';
  }

  get description(): string {
    if (isStatusConditionEffect(this.effect)) {
      return `Applies ${this.effect.statusCondition.name}`;
    }
    return 'Applies status condition';
  }
}

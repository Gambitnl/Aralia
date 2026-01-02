import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CombatState, StatusEffect, ActiveCondition } from '../../types/combat';
import { isStatusConditionEffect, EffectDuration } from '../../types/spells';
import { calculateSpellDC, rollSavingThrow } from '../../utils/savingThrowUtils';
import { generateId } from '../../utils/combatUtils';
import { STATUS_ICONS, DEFAULT_STATUS_ICON } from '@/config/statusIcons';

export class StatusConditionCommand extends BaseEffectCommand {
  execute(state: CombatState): CombatState {
    if (!isStatusConditionEffect(this.effect)) {
      return state;
    }

    let currentState = state;

    for (const target of this.getTargets(currentState)) {
      // 1. Check Saving Throw (if applicable)
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
          currentState = this.addLogEntry(currentState, {
            type: 'status',
            message: `${target.name} resists the ${this.effect.statusCondition.name} condition`,
            characterId: target.id
          });
          continue;
        }
      }

      const durationRounds = this.calculateDuration(this.effect.statusCondition.duration);
      const appliedCondition: ActiveCondition = {
        name: this.effect.statusCondition.name,
        duration: this.effect.statusCondition.duration,
        appliedTurn: currentState.turnState.currentTurn,
        source: this.context.spellName || this.context.spellId
      };

      // TODO: Wire ActiveCondition durations into the turn cleanup pipeline so these expire and log when they end (see docs/tasks/spell-system-overhaul/COMPLETE-STUB-COMMANDS.md; if this block is moved/refactored/modularized, update the COMPLETE-STUB-COMMANDS entry path).
      const updatedConditions = this.applyCondition(target.conditions, appliedCondition);
      const { statusEffects, appliedStatus } = this.applyStatusEffect(
        target.statusEffects,
        durationRounds,
        this.effect.statusCondition.name
      );

      currentState = this.updateCharacter(currentState, target.id, {
        statusEffects,
        conditions: updatedConditions
      });

      currentState = this.addLogEntry(currentState, {
        type: 'status',
        message: `${target.name} is now ${this.effect.statusCondition.name}`,
        characterId: target.id,
        targetIds: [target.id],
        data: { statusId: appliedStatus.id, condition: appliedCondition }
      });
    }

    return currentState;
  }

  /**
   * Apply or refresh a condition entry on the character. Re-applying the same condition name
   * refreshes duration/turn so downstream systems don't stack duplicates.
   */
  // TODO(Simulator): Integrate StateSystem.applyStateToTags when applying elemental conditions (e.g. mapping 'Ignited' condition to 'Burning' state).
  private applyCondition(
    existing: ActiveCondition[] | undefined,
    condition: ActiveCondition
  ): ActiveCondition[] {
    const conditions = existing ? [...existing] : [];
    const matchIndex = conditions.findIndex(c => c.name === condition.name);

    if (matchIndex >= 0) {
      conditions[matchIndex] = condition;
    } else {
      conditions.push(condition);
    }

    return conditions;
  }

  /**
   * Mirror conditions into the legacy statusEffects array so current renderers and loggers
   * continue to behave while the new conditions field comes online.
   */
  private applyStatusEffect(
    existing: StatusEffect[],
    duration: number,
    name: string
  ): { statusEffects: StatusEffect[]; appliedStatus: StatusEffect } {
    const statusEffects = [...existing];
    const matchIndex = statusEffects.findIndex(effect => effect.name === name);

    // MECHANIST: Check if the effect source provided a specific mechanical effect
    // e.g. Slasher Speed Reduction (-10ft)
    let mechanicalEffect: StatusEffect['effect'] = { type: 'condition' };

    // We check if the input command had specific data in the effect definition.
    // StatusConditionCommand's 'effect' property is the SpellEffect input.
    if (isStatusConditionEffect(this.effect) && this.effect.statusCondition.effect) {
         // Pass through the mechanical effect if defined in the statusCondition object
         // The Slasher logic in DamageCommand injected `effect: { ... }` into the statusCondition object.
         mechanicalEffect = this.effect.statusCondition.effect as StatusEffect['effect'];
    }

    const appliedStatus: StatusEffect = {
      id: matchIndex >= 0 ? statusEffects[matchIndex].id : generateId(),
      name,
      type: 'debuff',
      duration,
      effect: mechanicalEffect,
      icon: this.getIconForCondition(name)
    };

    if (matchIndex >= 0) {
      statusEffects[matchIndex] = appliedStatus;
    } else {
      statusEffects.push(appliedStatus);
    }

    return { statusEffects, appliedStatus };
  }

  private calculateDuration(duration: EffectDuration): number {
    const val = duration.value || 1;
    switch (duration.type) {
      case 'rounds':
        return val;
      case 'minutes':
        return val * 10;
      case 'special':
        return val;
      default:
        // TODO(lint-intent): Legacy durations like 'hours'/'instantaneous' should be normalized before calling this command.
        return val;
    }
  }

  private getIconForCondition(name: string): string {
    return STATUS_ICONS[name] || DEFAULT_STATUS_ICON;
  }

  get description(): string {
    if (isStatusConditionEffect(this.effect)) {
      return `Applies ${this.effect.statusCondition.name}`;
    }
    return 'Applies status condition';
  }
}

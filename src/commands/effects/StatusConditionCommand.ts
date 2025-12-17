/**
 * @file src/commands/effects/StatusConditionCommand.ts
 * Command for applying D&D 5e status conditions to characters.
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CombatState, StatusEffect, ActiveCondition } from '../../types/combat';
import { isStatusConditionEffect, EffectDuration } from '../../types/spells';
import { calculateSpellDC, rollSavingThrow } from '../../utils/savingThrowUtils';
import { generateId } from '../../utils/combatUtils';
import { STATUS_ICONS, DEFAULT_STATUS_ICON } from '@/config/statusIcons';

/**
 * Command to apply a status condition (e.g., Blinded, Prone) to one or more targets.
 *
 * This command handles:
 * 1. Initial saving throws (if the condition allows one to negate it).
 * 2. Logging the success/failure of those saves.
 * 3. Applying the condition to the character's state.
 *
 * **Architecture Note:**
 * Currently, conditions are stored in two places on the character:
 * - `conditions`: The new, strictly typed array of `ActiveCondition` objects (aligned with 5e rules).
 * - `statusEffects`: The legacy array used by the UI for icons and tooltips.
 *
 * This command maintains synchronization between both until the UI is fully migrated to `conditions`.
 *
 * @example
 * const command = new StatusConditionCommand(blindnessEffect, {
 *   spellId: 'spell-123',
 *   caster: wizard,
 *   targets: [goblin]
 * });
 * const newState = command.execute(currentState);
 */
export class StatusConditionCommand extends BaseEffectCommand {
  /**
   * Executes the command, processing saves and applying conditions.
   *
   * @param state - The current combat state.
   * @returns The updated combat state with modified characters and log entries.
   */
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
   * Updates the `conditions` array, ensuring no duplicates.
   * If a condition with the same name exists, it is replaced (refreshing duration).
   *
   * @param existing - The current list of active conditions.
   * @param condition - The new condition to apply.
   */
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
   * Updates the legacy `statusEffects` array to keep the UI in sync.
   *
   * @param existing - The current list of status effects.
   * @param duration - Duration in rounds.
   * @param name - The name of the condition.
   */
  private applyStatusEffect(
    existing: StatusEffect[],
    duration: number,
    name: string
  ): { statusEffects: StatusEffect[]; appliedStatus: StatusEffect } {
    const statusEffects = [...existing];
    const matchIndex = statusEffects.findIndex(effect => effect.name === name);

    const appliedStatus: StatusEffect = {
      id: matchIndex >= 0 ? statusEffects[matchIndex].id : generateId(),
      name,
      type: 'debuff',
      duration,
      effect: {
        type: 'condition'
      },
      icon: this.getIconForCondition(name)
    };

    if (matchIndex >= 0) {
      statusEffects[matchIndex] = appliedStatus;
    } else {
      statusEffects.push(appliedStatus);
    }

    return { statusEffects, appliedStatus };
  }

  /**
   * Helper to convert various duration types into a round count.
   */
  private calculateDuration(duration: EffectDuration): number {
    const val = duration.value || 1;
    switch (duration.type) {
      case 'rounds':
        return val;
      case 'minutes':
        return val * 10;
      case 'hours':
        return val * 600;
      case 'special':
      case 'instantaneous':
        return val;
      default:
        return 1;
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

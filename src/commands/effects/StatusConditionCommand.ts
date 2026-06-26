/**
 * Applies spell status conditions to combat characters.
 *
 * The command writes both the newer `conditions` array and the legacy
 * `statusEffects` array because different combat systems still read different
 * mirrors. Metadata such as repeat saves must be copied to both mirrors so the
 * spell payload remains executable after application.
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CombatState, StatusEffect, ActiveCondition } from '../../types/combat';
import { isStatusConditionEffect, EffectDuration, ConditionName } from '../../types/spells';
import { calculateSpellDC, rollSavingThrow } from '../../utils/savingThrowUtils';
import { generateId } from '../../utils/combatUtils';
import { STATUS_ICONS, DEFAULT_STATUS_ICON } from '@/config/statusIcons';
import { SavePenaltySystem } from '../../systems/combat/SavePenaltySystem';
import { ConditionToStateTag } from '../../types/elemental';
import { applyStateToTags } from '../../systems/physics/ElementalInteractionSystem';

export class StatusConditionCommand extends BaseEffectCommand {
  execute(state: CombatState): CombatState {
    let currentState = state;

    // Handle condition removal if the effect defines it.
    if (this.effect.conditionRemoval && this.effect.conditionRemoval.length > 0) {
      for (const target of this.getTargets(currentState)) {
        let removedConditions: string[] = [];
        const newConditions = (target.conditions || []).filter(c => {
          if (this.effect.conditionRemoval!.includes(c.name as ConditionName)) {
            removedConditions.push(c.name);
            return false;
          }
          return true;
        });

        const newStatusEffects = (target.statusEffects || []).filter(e => {
          return !this.effect.conditionRemoval!.includes(e.name as ConditionName);
        });

        if (removedConditions.length > 0) {
          currentState = this.updateCharacter(currentState, target.id, {
            conditions: newConditions,
            statusEffects: newStatusEffects
          });

          for (const conditionName of removedConditions) {
            currentState = this.addLogEntry(currentState, {
              type: 'status',
              message: `${target.name} is no longer ${conditionName}`,
              characterId: target.id,
              targetIds: [target.id]
            });
          }
        }
      }
    }

    if (!isStatusConditionEffect(this.effect) || this.effect.statusCondition.duration.value === 0) {
      return currentState;
    }


    for (const target of this.getTargets(currentState)) {
      // 1. Check Condition Immunity
      const conditionName = this.effect.statusCondition.name as ConditionName;
      if (target.conditionImmunities?.includes(conditionName)) {
        currentState = this.addLogEntry(currentState, {
          type: 'status',
          message: `${target.name} is immune to ${conditionName}`,
          characterId: target.id
        });
        continue;
      }

      // 2. Check Saving Throw (if applicable)
      if (this.effect.condition.type === 'save' && this.effect.condition.saveType) {
        const caster = this.getCaster(currentState);
        const dc = calculateSpellDC(caster);

        const savePenaltySystem = new SavePenaltySystem();
        const saveModifiers = savePenaltySystem.getActivePenalties(target);

        const saveResult = rollSavingThrow(target, this.effect.condition.saveType, dc, saveModifiers);

        // Consume next_save penalties
        currentState = savePenaltySystem.consumeNextSavePenalties(currentState, target.id);

        let saveLogMessage = `${target.name} ${saveResult.success ? 'succeeds' : 'fails'} ${this.effect.condition.saveType} save (${saveResult.total} vs DC ${dc})`;

        if (saveResult.modifiersApplied && saveResult.modifiersApplied.length > 0) {
          const modDetails = saveResult.modifiersApplied.map(m => `${m.value >= 0 ? '+' : ''}${m.value} [${m.source}]`).join(', ');
          saveLogMessage += ` (Mods: ${modDetails})`;
        }

        currentState = this.addLogEntry(currentState, {
          type: 'status',
          message: saveLogMessage,
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
        source: this.context.spellName || this.context.spellId,
        sourceCasterId: this.context.caster.id,
        ...this.getStatusMetadata()
      };

      // TODO: Wire ActiveCondition durations into the turn cleanup pipeline so these expire and log when they end (see structured-spell-execution-G7 in docs/projects/spells/subprojects/structured-spell-execution/GAPS.md).
      const updatedConditions = this.applyCondition(target.conditions, appliedCondition);
      const { statusEffects, appliedStatus } = this.applyStatusEffect(
        target.statusEffects,
        durationRounds,
        this.effect.statusCondition.name
      );

      let finalStateTags = target.stateTags || [];
      const incomingStateTag = ConditionToStateTag[this.effect.statusCondition.name.toLowerCase()];
      if (incomingStateTag) {
        const { newStates, result } = applyStateToTags(finalStateTags, incomingStateTag);
        finalStateTags = newStates;
        if (result.interaction) {
           currentState = this.addLogEntry(currentState, {
             type: 'status',
             message: `${target.name}'s elemental states reacted: ${result.interaction}`,
             characterId: target.id
           });
        }
      }

      currentState = this.updateCharacter(currentState, target.id, {
        statusEffects,
        conditions: updatedConditions,
        stateTags: finalStateTags
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
      source: this.context.spellName || this.context.spellId,
      sourceCasterId: this.context.caster.id,
      effect: mechanicalEffect,
      icon: this.getIconForCondition(name),
      ...this.getStatusMetadata()
    };

    if (matchIndex >= 0) {
      statusEffects[matchIndex] = appliedStatus;
    } else {
      statusEffects.push(appliedStatus);
    }

    return { statusEffects, appliedStatus };
  }

  /**
   * Preserve status-condition metadata that comes from spell data.
   *
   * Repeat saves are already consumed by the combat engine from statusEffects,
   * while escape checks and break triggers are near-term execution metadata.
   * Keeping the helper local avoids rebuilding those optional copies in each
   * mirror and makes the lossy-bridge decision easy to audit.
   */
  private getStatusMetadata(): Pick<StatusEffect, 'repeatSave' | 'escapeCheck' | 'breakTriggers'> {
    if (!isStatusConditionEffect(this.effect)) {
      return {};
    }

    const { repeatSave, escapeCheck, breakTriggers } = this.effect.statusCondition;

    return {
      ...(repeatSave ? { repeatSave } : {}),
      ...(escapeCheck ? { escapeCheck } : {}),
      ...(breakTriggers ? { breakTriggers } : {})
    };
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

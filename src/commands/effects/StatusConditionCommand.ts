// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 06/07/2026, 09:33:48
 * Dependents: commands/effects/AttackRollModifierCommand.ts, commands/effects/DamageCommand.ts, commands/effects/ReactiveEffectCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Applies spell status conditions to combat characters.
 *
 * The command writes both the newer `conditions` array and the legacy
 * `statusEffects` array because different combat systems still read different
 * mirrors. Metadata such as repeat saves must be copied to both mirrors so the
 * spell payload remains executable after application.
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CombatState, StatusEffect, ActiveCondition, ActiveEffect, ActiveEnvironmentalControl } from '../../types/combat';
import { isStatusConditionEffect, EffectDuration, ConditionName, BindingControl, DominationControl, StatusCondition, StatusConditionEffect } from '../../types/spells';
import { calculateSpellDC, rollSavingThrow } from '../../utils/savingThrowUtils';
import { generateId } from '../../utils/combatUtils';
import { STATUS_ICONS, DEFAULT_STATUS_ICON } from '@/config/statusIcons';
import { SavePenaltySystem } from '../../systems/combat/SavePenaltySystem';
import { ConditionToStateTag } from '../../types/elemental';
import { applyStateToTags } from '../../systems/physics/ElementalInteractionSystem';
import { breakFriendsConcentrationForCaster } from './ConcentrationCommands';
import { refreshConditionsByName, refreshStatusEffectsByName } from '../../utils/combat/statusConditionUtils';

const FRIENDS_MEMORY_DURATION_ROUNDS = 24 * 60 * 10;

type WrathOfNatureStatusMetadata = {
  controlledEntity?: { entityType?: string };
  areaTiming?: {
    timing?: string;
    targetFilter?: string;
  };
  condition: {
    saveType?: string;
    saveEffect?: string;
  };
  grantedActions?: Array<{
    name?: string;
    actionType?: string;
    target?: string;
    attackType?: string;
    damage?: { dice?: string; type?: string };
    followupSave?: {
      saveType?: string;
      failedSaveCondition?: string;
    };
  }>;
};

export class StatusConditionCommand extends BaseEffectCommand {
  async execute(state: CombatState): Promise<CombatState> {
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

    const statusCondition = this.getStatusConditionPayload();
    if (!statusCondition || statusCondition.duration.value === 0) {
      return currentState;
    }


    for (const target of this.getTargets(currentState)) {
      // 1. Check Condition Immunity
      const conditionName = statusCondition.name as ConditionName;
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
        const friendsAutoSuccessReason = this.resolveFriendsAutoSuccessReason(target, currentState);

        if (this.context.spellId !== 'friends') {
          currentState = await breakFriendsConcentrationForCaster(
            currentState,
            caster,
            this.context,
            'caster_forces_saving_throw',
            this.context.spellName || this.context.spellId
          );
        }

        if (friendsAutoSuccessReason) {
          currentState = this.rememberFriendsCast(currentState, target.id);
          currentState = this.addLogEntry(currentState, {
            type: 'status',
            message: `${target.name} automatically succeeds against Friends (${friendsAutoSuccessReason}).`,
            characterId: target.id,
            targetIds: [target.id],
            data: {
              spellId: this.context.spellId,
              saveOutcomeOverride: friendsAutoSuccessReason
            }
          });
          continue;
        }

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
          currentState = this.rememberFriendsCast(currentState, target.id);
          currentState = this.addLogEntry(currentState, {
            type: 'status',
            message: `${target.name} resists the ${statusCondition.name} condition`,
            characterId: target.id
          });
          continue;
        }
      }

      const durationRounds = this.calculateDuration(statusCondition.duration);
      const appliedCondition: ActiveCondition = {
        name: statusCondition.name,
        duration: statusCondition.duration,
        appliedTurn: currentState.turnState.currentTurn,
        source: this.context.spellName || this.context.spellId,
        sourceCasterId: this.context.caster.id,
        ...this.getStatusMetadata()
      };

      // The turn manager owns condition expiry because it can clean both the
      // visible status label and the rules-facing condition mirror at the same
      // turn boundary. This command only writes the paired records.
      const updatedConditions = this.applyCondition(target.conditions, appliedCondition);
      const { statusEffects, appliedStatus } = this.applyStatusEffect(
        target.statusEffects,
        durationRounds,
        statusCondition.name
      );

      let finalStateTags = target.stateTags || [];
      const incomingStateTag = ConditionToStateTag[statusCondition.name.toLowerCase()];
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

      currentState = this.rememberFriendsCast(currentState, target.id);

      currentState = this.applyChillTouchUndeadAttackRider(currentState, target.id, durationRounds);

      currentState = this.addLogEntry(currentState, {
        type: 'status',
        message: `${target.name} is now ${statusCondition.name}`,
        characterId: target.id,
        targetIds: [target.id],
        data: { statusId: appliedStatus.id, condition: appliedCondition }
      });
    }

    const controlledEntityType = (this.effect as unknown as WrathOfNatureStatusMetadata).controlledEntity?.entityType;
    if (this.context.spellId === 'wrath-of-nature' && controlledEntityType === 'animated_nature_area') {
      currentState = this.applyWrathOfNatureStatusMetadata(currentState);
    }

    return currentState;
  }

  /**
   * Apply or refresh a condition entry on the character. Re-applying the same condition name
   * refreshes duration/turn so downstream systems don't stack duplicates.
   */
  // TODO #7(Simulator): Integrate StateSystem.applyStateToTags when applying elemental conditions (e.g. mapping 'Ignited' condition to 'Burning' state).
  private applyCondition(
    existing: ActiveCondition[] | undefined,
    condition: ActiveCondition
  ): ActiveCondition[] {
    return refreshConditionsByName(existing, condition).conditions;
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
    // MECHANIST: Check if the effect source provided a specific mechanical effect
    // e.g. Slasher Speed Reduction (-10ft)
    let mechanicalEffect: StatusEffect['effect'] = { type: 'condition' };

    // We check if the input command had specific data in the effect definition.
    // StatusConditionCommand's 'effect' property is the SpellEffect input.
    const statusCondition = this.getStatusConditionPayload();
    if (statusCondition?.effect) {
      // Pass through the mechanical effect if defined in the statusCondition object
      // The Slasher logic in DamageCommand injected `effect: { ... }` into the statusCondition object.
      mechanicalEffect = statusCondition.effect as StatusEffect['effect'];
    }

    return refreshStatusEffectsByName(existing, {
      id: generateId(),
      name,
      type: 'debuff',
      duration,
      source: this.context.spellName || this.context.spellId,
      sourceCasterId: this.context.caster.id,
      effect: mechanicalEffect,
      icon: this.getIconForCondition(name),
      ...this.getStatusMetadata()
    });
  }

  private applyWrathOfNatureStatusMetadata(state: CombatState): CombatState {
    const effect = this.effect as unknown as WrathOfNatureStatusMetadata;
    const controls = state.activeEnvironmentalControls || [];
    const statusCondition = this.getStatusConditionPayload();
    if (!statusCondition || controls.length === 0) {
      return state;
    }

    const updatedControls = controls.map(control => {
      if (control.spellId !== this.context.spellId || control.casterId !== this.context.caster.id) {
        return control;
      }

      if (statusCondition.name === 'Restrained') {
        return {
          ...control,
          rootsAndVines: {
            triggerTiming: effect.areaTiming?.timing,
            targetFilter: effect.areaTiming?.targetFilter,
            saveAbility: effect.condition.saveType,
            saveOutcome: effect.condition.saveEffect,
            condition: statusCondition.name,
            escapeSkill: statusCondition.escapeCheck?.skill
          }
        } satisfies ActiveEnvironmentalControl;
      }

      if (statusCondition.name === 'Prone') {
        const action = effect.grantedActions?.[0];
        return {
          ...control,
          looseRocks: {
            actionCost: action?.actionType,
            actionName: action?.name,
            target: action?.target,
            attackType: action?.attackType,
            damageDice: action?.damage?.dice,
            damageType: action?.damage?.type,
            followupSaveAbility: action?.followupSave?.saveType,
            failedSaveCondition: action?.followupSave?.failedSaveCondition
          }
        } satisfies ActiveEnvironmentalControl;
      }

      return control;
    });

    const changed = updatedControls.some((control, index) => control !== controls[index]);
    if (!changed) {
      return state;
    }

    return this.addLogEntry({
      ...state,
      activeEnvironmentalControls: updatedControls
    }, {
      type: 'status',
      message: `${this.context.spellName || 'Wrath of Nature'} environmental control metadata is updated.`,
      characterId: this.context.caster.id,
      data: {
        spellId: this.context.spellId,
        environmentalControlSurface: 'wrath_of_nature',
        statusCondition: statusCondition.name
      }
    });
  }

  /**
   * Preserve status-condition metadata that comes from spell data.
   *
   * Repeat saves are already consumed by the combat engine from statusEffects,
   * while escape checks and break triggers are near-term execution metadata.
   * Keeping the helper local avoids rebuilding those optional copies in each
   * mirror and makes the lossy-bridge decision easy to audit.
   */
  private getStatusMetadata(): Pick<StatusEffect, 'repeatSave' | 'escapeCheck' | 'breakTriggers' | 'bindingControl' | 'dominationControl' | 'hitPointState' | 'socialLifecycle'> {
    const statusCondition = this.getStatusConditionPayload();
    if (!statusCondition) {
      return {};
    }

    const { repeatSave, escapeCheck } = statusCondition;
    const breakTriggers = statusCondition.breakTriggers ?? this.getAwakenBreakTriggers();
    const bindingControl = this.getBindingControlMetadata();
    const dominationControl = this.getDominationControlMetadata();
    const runtimeRepeatSave = repeatSave
      ? {
        ...repeatSave,
        // Blinding Smite and similar conditions say later saves use the
        // original spell save DC. Store that number when the condition lands so
        // turn-end repeat saves do not fall back to the generic placeholder DC.
        ...(repeatSave.useOriginalDC ? { dc: calculateSpellDC(this.context.caster) } : {})
      }
      : undefined;

    return {
      ...(runtimeRepeatSave ? { repeatSave: runtimeRepeatSave } : {}),
      ...(escapeCheck ? { escapeCheck } : {}),
      ...(breakTriggers ? { breakTriggers } : {}),
      ...(bindingControl ? { bindingControl } : {}),
      ...(dominationControl ? { dominationControl } : {}),
      // Chill Touch stores its "cannot regain Hit Points" rule as structured
      // hit-point metadata on the status effect. Preserve that fact on both
      // runtime mirrors so every healing path can check it without parsing text.
      ...(this.effect.hitPointState ? { hitPointState: this.effect.hitPointState } : {}),
      ...(this.isFriendsCharmedEffect()
        ? {
          socialLifecycle: {
            kind: 'friends_charm',
            targetKnowsOnEnd: true,
            recastMemoryDurationRounds: FRIENDS_MEMORY_DURATION_ROUNDS
          }
        }
        : {}),
      ...(this.isAwakenCharmedEffect()
        ? {
          socialLifecycle: {
            kind: 'awaken_charm',
            durationDays: this.effect.socialEffect?.durationDays ?? 30,
            endsIfDamagedByCasterOrAllies: this.effect.socialEffect?.endsIfDamagedByCasterOrAllies === true,
            targetChoosesAttitudeOnEnd: this.effect.socialEffect?.targetChoosesAttitudeAfterCharmedEnds === true
          }
        }
        : {})
    };
  }

  /**
   * Some controlled-target spells still store a Charmed status payload inside a
   * utility/control row. Normalize that older shape here so Geas-style status
   * rows and Dominate Person-style utility rows both write the same live
   * condition mirrors.
   */
  private getStatusConditionPayload(): StatusCondition | undefined {
    if (isStatusConditionEffect(this.effect)) {
      return this.effect.statusCondition;
    }

    const embedded = (this.effect as { statusCondition?: { name?: string; condition?: string; duration?: EffectDuration | string } }).statusCondition;
    const conditionName = embedded?.name ?? embedded?.condition;
    if (!conditionName) {
      return undefined;
    }

    const duration = typeof embedded.duration === 'object'
      ? embedded.duration
      : { type: 'special' as const };

    return {
      name: conditionName as ConditionName,
      duration
    };
  }

  /**
   * Geas and Planar Binding use the same spell-data bucket as summoned actors
   * because they create a control relationship, but the controlled creature is
   * already on the battlefield. This normalizes the source fields into a live
   * status payload so later systems can inspect the command, service, travel,
   * and early-ending facts without reparsing the original JSON effect.
   */
  private getBindingControlMetadata(): BindingControl | undefined {
    const effectWithControl = this.effect as { summonControl?: StatusConditionEffect["summonControl"] & { controlChannel?: string }; dominationControl?: StatusConditionEffect["dominationControl"]; communicationDetails?: StatusConditionEffect["communicationDetails"]; travelDetails?: StatusConditionEffect["travelDetails"]; conditionalEndings?: StatusConditionEffect["conditionalEndings"] };
    if (!effectWithControl.summonControl || effectWithControl.dominationControl || effectWithControl.summonControl.controlChannel) {
      return undefined;
    }

    const {
      entityType,
      controlType,
      commandScope,
      serviceDuration,
      obedience,
      hostileTwist,
      sourceSpellExtension
    } = effectWithControl.summonControl;

    return {
      ...(entityType ? { entityType } : {}),
      ...(controlType ? { controlType } : {}),
      ...(commandScope ? { commandScope } : {}),
      ...(serviceDuration ? { serviceDuration } : {}),
      ...(obedience ? { obedience } : {}),
      ...(hostileTwist ? { hostileTwist } : {}),
      ...(sourceSpellExtension ? { sourceSpellExtension } : {}),
      ...(effectWithControl.communicationDetails ? { communication: effectWithControl.communicationDetails } : {}),
      ...(effectWithControl.travelDetails ? { travel: effectWithControl.travelDetails } : {}),
      ...(effectWithControl.conditionalEndings ? { conditionalEndings: effectWithControl.conditionalEndings } : {})
    };
  }

  /**
   * Domination spells control an existing Charmed target through telepathic
   * orders rather than creating a summon. Keep that relationship separate from
   * bindingControl because domination has same-plane command links, no-action
   * orders, and caster-Reaction spending that later UI/AI work must distinguish.
   */
  private getDominationControlMetadata(): DominationControl | undefined {
    const effectWithControl = this.effect as {
      summonControl?: DominationControl;
      dominationControl?: {
        telepathicLink?: DominationControl["telepathicLink"];
        reactionCommand?: DominationControl["reaction"];
      };
      conditionalEndings?: DominationControl["conditionalEndings"];
    };

    if (!effectWithControl.summonControl && !effectWithControl.dominationControl) {
      return undefined;
    }

    const telepathicLink = effectWithControl.dominationControl?.telepathicLink ?? (effectWithControl.summonControl?.controlChannel
      ? {
        requiresSamePlane: effectWithControl.summonControl.controlChannel.includes('same-plane'),
        actionCost: effectWithControl.summonControl.commandAction === 'no action on caster turn' ? 'none' : undefined
      }
      : undefined);
    const reaction = effectWithControl.dominationControl?.reactionCommand ?? (effectWithControl.summonControl?.reactionCommand
      ? { requiresCasterReaction: effectWithControl.summonControl.reactionCommand.toLowerCase().includes('reaction') }
      : undefined);

    return {
      ...(effectWithControl.summonControl ?? {}),
      ...(telepathicLink
        ? { telepathicLink }
        : {}),
      ...(reaction
        ? { reaction }
        : {}),
      ...(effectWithControl.conditionalEndings ? { conditionalEndings: effectWithControl.conditionalEndings } : {})
    };
  }

  private isFriendsCharmedEffect(): boolean {
    return this.context.spellId === 'friends' &&
      this.getStatusConditionPayload()?.name === 'Charmed';
  }

  private isAwakenCharmedEffect(): boolean {
    return this.context.spellId === 'awaken' &&
      this.getStatusConditionPayload()?.name === 'Charmed';
  }

  private getAwakenBreakTriggers(): StatusEffect['breakTriggers'] | undefined {
    if (!this.isAwakenCharmedEffect()) {
      return undefined;
    }

    return this.effect.conditionalEndings as StatusEffect['breakTriggers'] | undefined;
  }

  private resolveFriendsAutoSuccessReason(target: { creatureTypes?: string[]; team?: string; spellMemory?: Array<{ spellId: string; casterId: string; expiresAtTurn: number }> }, state: CombatState): string | null {
    if (!this.isFriendsCharmedEffect()) {
      return null;
    }

    const caster = this.getCaster(state);
    const creatureTypes = target.creatureTypes || [];
    const isHumanoid = creatureTypes.some(type => type.toLowerCase() === 'humanoid');
    if (creatureTypes.length > 0 && !isHumanoid) {
      return 'not_humanoid';
    }

    if (target.team && caster.team && target.team !== caster.team) {
      return 'fighting_caster_or_allies';
    }

    const recentlyAffected = (target.spellMemory || []).some(memory =>
      memory.spellId === 'friends' &&
      memory.casterId === caster.id &&
      memory.expiresAtTurn > state.turnState.currentTurn
    );

    return recentlyAffected ? 'recently_affected_by_spell' : null;
  }

  private rememberFriendsCast(state: CombatState, targetId: string): CombatState {
    if (!this.isFriendsCharmedEffect()) {
      return state;
    }

    const target = state.characters.find(character => character.id === targetId);
    if (!target) {
      return state;
    }

    const retainedMemory = (target.spellMemory || []).filter(memory =>
      !(memory.spellId === 'friends' && memory.casterId === this.context.caster.id)
    );

    return this.updateCharacter(state, targetId, {
      spellMemory: [
        ...retainedMemory,
        {
          spellId: 'friends',
          spellName: this.context.spellName || 'Friends',
          casterId: this.context.caster.id,
          affectedTurn: state.turnState.currentTurn,
          expiresAtTurn: state.turnState.currentTurn + FRIENDS_MEMORY_DURATION_ROUNDS,
          kind: 'cast_by_caster'
        }
      ]
    });
  }

  private applyChillTouchUndeadAttackRider(
    state: CombatState,
    targetId: string,
    durationRounds: number
  ): CombatState {
    if (
      this.context.spellId !== 'chill-touch' ||
      this.effect.statusCondition.name !== 'Disadvantage on attacks vs. caster'
    ) {
      return state;
    }

    const target = state.characters.find(character => character.id === targetId);
    if (!target) {
      return state;
    }

    const rider: ActiveEffect = {
      id: `chill-touch-undead-rider-${this.context.caster.id}-${targetId}`,
      spellId: this.context.spellId,
      casterId: this.context.caster.id,
      sourceName: this.context.spellName || 'Chill Touch',
      type: 'debuff',
      duration: { type: 'rounds', value: durationRounds },
      startTime: state.turnState.currentTurn,
      mechanics: {
        attackRollDirection: 'outgoing',
        attackRollModifier: 'disadvantage',
        attackRollKind: 'any',
        attackRollConsumption: 'while_active',
        attackRollTargetId: this.context.caster.id
      }
    };

    const retainedEffects = (target.activeEffects || []).filter(effect =>
      !(effect.spellId === rider.spellId && effect.casterId === rider.casterId)
    );

    return {
      ...state,
      characters: state.characters.map(character =>
        character.id === targetId
          ? { ...character, activeEffects: [...retainedEffects, rider] }
          : character
      )
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
        // TODO #8(lint-intent): Legacy durations like 'hours'/'instantaneous' should be normalized before calling this command.
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

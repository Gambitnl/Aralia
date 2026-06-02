// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/04/2026, 23:15:39
 * Dependents: commands/factory/SpellCommandFactory.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file applies spell riders that change how attack rolls work without
 * pretending the spell created a real condition.
 *
 * Why it exists:
 * Frostbite, Bane, and similar spells need to do two things at once:
 * damage the target if it fails a save, and leave behind a rule change that
 * affects future attack rolls. That rule change needs its own runtime home so
 * the combat engine can read it when an attack is actually rolled.
 *
 * Called by: SpellCommandFactory.ts when a spell effect is marked as an
 * ATTACK_ROLL_MODIFIER.
 * Depends on: DamageCommand for any bundled damage payload, saving throw tools,
 * and the shared active-effect storage on combat characters.
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { DamageCommand } from './DamageCommand';
import { StatusConditionCommand } from './StatusConditionCommand';
import { CombatState, ActiveEffect } from '../../types/combat';
import { DamageEffect, StatusConditionEffect, isAttackRollModifierEffect } from '../../types/spells';
import { calculateSpellDC, rollSavingThrow } from '../../utils/savingThrowUtils';
import { SavePenaltySystem } from '../../systems/combat/SavePenaltySystem';

// ============================================================================
// Attack Roll Riders
// ============================================================================
// This command is the bridge between spell text and the combat engine for rules
// like "the target has disadvantage on its next weapon attack roll." It keeps
// the rider separate from true conditions, but it still stores the result as an
// active effect so the attack factory can read it later.
// ============================================================================

export class AttackRollModifierCommand extends BaseEffectCommand {
  async execute(state: CombatState): Promise<CombatState> {
    if (!isAttackRollModifierEffect(this.effect)) {
      return state;
    }

    let currentState = state;

    // Process every target in the same save-driven way other spell effects do.
    // The spell text decides who is affected; the save determines whether the
    // rider lands at all.
    for (const target of this.getTargets(currentState)) {
      const caster = this.getCaster(currentState);

      // If the spell calls for a save, resolve it once here so we can use the
      // same outcome for both the rider and any bundled damage payload.
      let saveSucceeded = false;
      if (this.effect.condition.type === 'save' && this.effect.condition.saveType) {
        const dc = calculateSpellDC(caster);
        const savePenaltySystem = new SavePenaltySystem();
        const saveModifiers = savePenaltySystem.getActivePenalties(target);
        const saveResult = rollSavingThrow(target, this.effect.condition.saveType, dc, saveModifiers);

        // Consume one-time save penalties as soon as the save is resolved.
        currentState = savePenaltySystem.consumeNextSavePenalties(currentState, target.id);

        let saveLogMessage = `${target.name} ${saveResult.success ? 'succeeds' : 'fails'} ${this.effect.condition.saveType} save (${saveResult.total} vs DC ${dc})`;
        if (saveResult.modifiersApplied && saveResult.modifiersApplied.length > 0) {
          const modDetails = saveResult.modifiersApplied
            .map(m => `${m.value >= 0 ? '+' : ''}${m.value} [${m.source}]`)
            .join(', ');
          saveLogMessage += ` (Mods: ${modDetails})`;
        }

        currentState = this.addLogEntry(currentState, {
          type: 'status',
          message: saveLogMessage,
          characterId: target.id
        });

        saveSucceeded = saveResult.success;
      }

      // If the save worked, the rider does not land. We still keep the spell
      // log readable so players can see that the target resisted the effect.
      if (saveSucceeded) {
        currentState = this.addLogEntry(currentState, {
          type: 'status',
          message: `${target.name} resists ${this.context.spellName}`,
          characterId: target.id
        });
        continue;
      }

      // Bundle any damage payload into the same save outcome so Frostbite-like
      // spells do not force the target to roll twice just because the spell has
      // both damage and a rider.
      // DEBT: This branch assumes the rider's damage is all-or-nothing on the
      // same save. Spells that still need half-on-save damage should stay on the
      // plain damage path until the effect bundling model is expanded further.
      if (this.effect.damage) {
        const damageEffect: DamageEffect = {
          type: 'DAMAGE',
          trigger: this.effect.trigger,
          condition: { type: 'always' },
          scaling: this.effect.scaling,
          description: this.effect.description,
          damage: this.effect.damage,
        };

        const damageCommand = new DamageCommand(damageEffect, {
          ...this.context,
          targets: [target],
          isCritical: false,
        });

        currentState = await damageCommand.execute(currentState);
      }


      // Bundle any status condition payload into the same save outcome
      if (this.effect.statusCondition) {
        const statusEffect: StatusConditionEffect = {
          type: 'STATUS_CONDITION',
          trigger: this.effect.trigger,
          condition: { type: 'always' },
          scaling: this.effect.scaling,
          description: this.effect.description,
          statusCondition: this.effect.statusCondition,
        };

        const statusCommand = new StatusConditionCommand(statusEffect, {
          ...this.context,
          targets: [target],
          isCritical: false,
        });

        currentState = statusCommand.execute(currentState);
      }

      // Store the rider as an active effect so the attack factory can read it
      // the next time this creature tries to attack.
      const attackRollEffect = this.createAttackRollActiveEffect(target.id, currentState.turnState.currentTurn);
      currentState = this.applyAttackRollActiveEffect(currentState, target.id, attackRollEffect);

      currentState = this.addLogEntry(currentState, {
        type: 'status',
        message: `${target.name} is affected by ${this.describeRider()}`,
        characterId: target.id,
        targetIds: [target.id]
      });
    }

    return currentState;
  }

  /**
   * Build the combat effect that gets read later when an attack roll happens.
   * The effect is stored on the target, not on the spell card, because combat
   * needs a live record it can update and eventually expire.
   */
  private createAttackRollActiveEffect(targetId: string, currentTurn: number): ActiveEffect {
    if (!isAttackRollModifierEffect(this.effect)) {
      throw new Error('AttackRollModifierCommand received the wrong effect type');
    }

    const attackMod = this.effect.attackRollModifier;
    const saveMod = this.effect.savingThrowModifier;

    // Determine type by looking at either attackMod or saveMod
    const modValue = attackMod?.modifier || saveMod?.modifier;
    const effectType = modValue === 'advantage' || modValue === 'bonus' ? 'buff' : 'debuff';

    // Determine duration by preferring attack duration or falling back to save duration
    const duration = attackMod?.duration || saveMod?.duration || { type: 'rounds', value: 1 };

    return {
      id: `roll_mod_${this.context.spellId}_${targetId}_${Date.now()}`,
      spellId: this.context.spellId,
      casterId: this.context.caster.id,
      sourceName: this.context.spellName,
      type: effectType,
      duration: duration,
      startTime: currentTurn,
      mechanics: {
        ...(attackMod ? {
          attackRollDirection: attackMod.direction,
          attackRollModifier: attackMod.modifier,
          attackRollKind: attackMod.attackKind,
          attackRollConsumption: attackMod.consumption,
          attackRollValue: attackMod.value,
          attackRollDice: attackMod.dice,
          attackerFilter: attackMod.attackerFilter,
        } : {}),
        ...(saveMod ? {
          savingThrowModifier: saveMod.modifier,
          savingThrowConsumption: saveMod.consumption,
          savingThrowValue: saveMod.value,
          savingThrowDice: saveMod.dice,
          savingThrowAbility: saveMod.ability,
        } : {})
      }
    };
  }

  private applyAttackRollActiveEffect(state: CombatState, targetId: string, effect: ActiveEffect): CombatState {
    const target = state.characters.find(c => c.id === targetId);
    if (!target) return state;

    const existing = target.activeEffects || [];
    const filtered = existing.filter(active =>
      !(
        active.spellId === effect.spellId &&
        active.sourceName === effect.sourceName
      )
    );

    return {
      ...state,
      characters: state.characters.map(character =>
        character.id === targetId
          ? { ...character, activeEffects: [...filtered, effect] }
          : character
      )
    };
  }

  private describeRider(): string {
    if (!isAttackRollModifierEffect(this.effect)) {
      return 'a roll rider';
    }

    const attackMod = this.effect.attackRollModifier;
    const saveMod = this.effect.savingThrowModifier;

    const parts: string[] = [];

    if (attackMod) {
      const direction = attackMod.direction === 'incoming'
        ? 'attacks against this creature'
        : "this creature's attacks";
      const kind = attackMod.attackKind === 'any'
        ? 'attacks'
        : attackMod.attackKind.replace('_', ' ') + ' attacks';
      const timing = attackMod.consumption === 'while_active'
        ? 'for the spell\'s duration'
        : attackMod.consumption === 'first_attack'
          ? 'on the first matching attack'
          : 'on the next matching attack';

      if (attackMod.modifier === 'bonus' || attackMod.modifier === 'penalty') {
        const amount = attackMod.dice || (typeof attackMod.value === 'number' ? `${attackMod.value}` : '');
        const prefix = attackMod.modifier === 'bonus' ? 'bonus' : 'penalty';
        parts.push(`${prefix} to ${direction} (${kind}, ${timing}${amount ? `, ${amount}` : ''})`);
      } else {
        parts.push(`${attackMod.modifier} to ${direction} (${kind}, ${timing})`);
      }
    }

    if (saveMod) {
      const timing = saveMod.consumption === 'while_active'
        ? 'for the spell\'s duration'
        : 'on the next saving throw';
      if (saveMod.modifier === 'bonus' || saveMod.modifier === 'penalty') {
         const amount = saveMod.dice || (typeof saveMod.value === 'number' ? `${saveMod.value}` : '');
         const prefix = saveMod.modifier === 'bonus' ? 'bonus' : 'penalty';
         parts.push(`${prefix} to saving throws (${timing}${amount ? `, ${amount}` : ''})`);
      } else {
         parts.push(`${saveMod.modifier} to saving throws (${timing})`);
      }
    }

    return parts.join(' and ') || 'a roll rider';
  }

  get description(): string {
    if (!isAttackRollModifierEffect(this.effect)) {
      return 'Applies an attack-roll rider';
    }

    return `Applies ${this.describeRider()}`;
  }
}

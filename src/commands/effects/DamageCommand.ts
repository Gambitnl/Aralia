import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CombatState, StatusEffect, ActiveEffect } from '../../types/combat'
import { isDamageEffect } from '../../types/spells'
import { checkConcentration } from '../../utils/concentrationUtils';
import { calculateSpellDC, rollSavingThrow, calculateSaveDamage } from '../../utils/savingThrowUtils';
import { rollDamage as rollDamageUtil } from '../../utils/combatUtils';
import { BreakConcentrationCommand } from './ConcentrationCommands'
import { ResistanceCalculator } from '../../utils/combat/resistanceUtils';
import { getPlanarSpellModifier } from '../../utils/planarUtils';
import { StatusConditionCommand } from './StatusConditionCommand';
import { SavePenaltySystem } from '../../systems/combat/SavePenaltySystem';

/** Unique key for tracking Slasher speed reduction once-per-turn usage */
const SLASHER_SLOW_USAGE_KEY = 'slasher_slow';

/**
 * Flavor verbs for combat log messages, keyed by damage type.
 * A random verb is selected when logging damage to add variety.
 */
const DAMAGE_VERBS: Record<string, string[]> = {
  acid: ['melts', 'corrodes', 'dissolves', 'burns'],
  bludgeoning: ['batters', 'crushes', 'pummels', 'bludgeons'],
  cold: ['freezes', 'chills', 'frosts', 'numbs'],
  fire: ['scorches', 'incinerates', 'burns', 'chars'],
  force: ['blasts', 'slams', 'impacts', 'strikes'],
  lightning: ['shocks', 'electrocutes', 'zaps', 'jolts'],
  necrotic: ['withers', 'decays', 'rots', 'drains'],
  piercing: ['impales', 'punctures', 'pierces', 'stabs'],
  poison: ['sickens', 'infects', 'poisons', 'taints'],
  psychic: ['shatters', 'stuns', 'assaults', 'confuses'],
  radiant: ['sears', 'blinds', 'burns', 'purifies'],
  slashing: ['slashes', 'cleaves', 'cuts', 'slices'],
  thunder: ['deafens', 'booms', 'blasts', 'shatters'],
};

/** Fallback verbs when damage type is unknown or not in DAMAGE_VERBS */
const DEFAULT_VERBS = ['damages', 'hits', 'strikes', 'hurts'];

/**
 * Command to apply damage to targets.
 * Handles damage calculation, HP reduction, and triggers concentration saves.
 */
export class DamageCommand extends BaseEffectCommand {
  execute(state: CombatState): CombatState {
    if (!isDamageEffect(this.effect)) {
      console.warn('DamageCommand received non-damage effect')
      return state
    }

    let currentState = state
    const caster = this.getCaster(currentState);

    // --- FEAT: Elemental Adept ---
    // If the caster has Elemental Adept for this damage type, treat 1s as 2s on damage dice.
    // This prevents low rolls from being wasted.
    let minRoll = 1;
    const elementalAdeptChoice = caster.featChoices?.['elemental_adept']?.selectedDamageType;
    if (elementalAdeptChoice && elementalAdeptChoice.toLowerCase() === this.effect.damage.type.toLowerCase()) {
      minRoll = 2;
    }

    // --- PLANAR MECHANICS ---
    // Some planes empower or impede certain spell schools.
    // Positive modifiers (+1 damage) are applied via upcasting in SpellCommandFactory.
    // Negative modifiers (impeded schools) are applied here to reduce damage.
    let planarModifier = 0;
    if (this.context.currentPlane && this.context.spellSchool) {
      planarModifier = getPlanarSpellModifier(this.context.spellSchool, this.context.currentPlane);
    }

    // --- MAIN DAMAGE LOOP: Process each target ---
    for (const target of this.getTargets(currentState)) {
      // Step 1: Roll base damage
      // - Parses dice string (e.g., "2d6+3") and rolls
      // - Doubles dice on critical hits
      // - Applies minRoll floor from Elemental Adept
      const isCritical = this.context.isCritical || false;
      let damageRoll = this.rollDamage(this.effect.damage.dice, isCritical, minRoll);

      // Step 2: Apply planar impediment (negative modifier only)
      // Positive modifiers are handled upstream via upcasting.
      if (planarModifier < 0) {
        damageRoll += planarModifier; // Reduce damage
        damageRoll = Math.max(0, damageRoll); // Damage cannot go below 0
      }

      // --- Step 3: Handle Saving Throw ---
      // If the effect requires a save (e.g., Dex save for Fireball), roll it here.
      // saveEffect determines damage on success: 'half' (most spells), 'none' (cantrips), or 'negates_condition'
      if (this.effect.condition.type === 'save' && this.effect.condition.saveType) {
        // Calculate the spell save DC: 8 + proficiency + spellcasting modifier
        let dc = calculateSpellDC(caster);

        // Impeded spell schools on certain planes reduce DC
        if (planarModifier < 0) {
          dc += planarModifier;
        }

        // Gather any active save penalties (e.g., Mind Sliver's -1d4)
        const savePenaltySystem = new SavePenaltySystem();
        const saveModifiers = savePenaltySystem.getActivePenalties(target);

        // Roll the save: 1d20 + ability mod + proficiency (if proficient) + modifiers
        const saveResult = rollSavingThrow(target, this.effect.condition.saveType, dc, saveModifiers);

        // Adjust damage based on save outcome:
        // - Failed save: full damage
        // - Successful save with 'half': half damage (most leveled spells)
        // - Successful save with 'none': no damage reduction (rare)
        // - Successful save with 'negates_condition': 0 damage (cantrips)
        // NOTE: Default is 'half' which is WRONG for cantrips - spell data should specify 'none'
        damageRoll = calculateSaveDamage(
          damageRoll,
          saveResult,
          this.effect.condition.saveEffect || 'half'
        );

        // Consume one-time save penalties (e.g., Mind Sliver applies to "next save" only)
        currentState = savePenaltySystem.consumeNextSavePenalties(currentState, target.id);

        // Build and log the save outcome message
        let saveLogMessage = `${target.name} ${saveResult.success ? 'succeeds' : 'fails'} ${this.effect.condition.saveType} save (${saveResult.total} vs DC ${dc})`;

        // Append modifier details if any were applied (e.g., "-3 [Mind Sliver]")
        if (saveResult.modifiersApplied && saveResult.modifiersApplied.length > 0) {
          const modDetails = saveResult.modifiersApplied.map(m => `${m.value >= 0 ? '+' : ''}${m.value} [${m.source}]`).join(', ');
          saveLogMessage += ` (Mods: ${modDetails})`;
        }

        currentState = this.addLogEntry(currentState, {
          type: 'status',
          message: saveLogMessage,
          characterId: target.id
        });
      }

      // --- Step 4: Apply Resistances and Vulnerabilities ---
      // Reduces damage by half if resistant, doubles if vulnerable, or 0 if immune.
      // Also checks for bypasses (e.g., magical weapons bypassing non-magical resistance).
      const finalDamage = ResistanceCalculator.applyResistances(
        damageRoll,
        this.effect.damage.type,
        target,
        caster
      );

      // --- Step 5: Apply final damage to target's HP ---
      // HP cannot go below 0 (death handling is elsewhere)
      const newHP = Math.max(0, target.currentHP - finalDamage);
      currentState = this.updateCharacter(currentState, target.id, {
        currentHP: newHP
      });

      // --- SLASHER FEAT LOGIC ---
      if (caster.feats?.includes('slasher') && this.effect.damage.type.toLowerCase() === 'slashing' && finalDamage > 0) {
        currentState = this.applySlasherFeat(currentState, caster, target, isCritical);
      }

      // --- LOGGING ---
      currentState = this.logDamage(currentState, caster, target, finalDamage, planarModifier);

      // --- Step 6: Check Concentration ---
      // If the target is concentrating on a spell and took damage,
      // they must make a Constitution save (DC = 10 or half damage, whichever is higher).
      // Failure breaks concentration and ends their maintained spell.
      if (target.concentratingOn && damageRoll > 0) {
        const check = checkConcentration(target, damageRoll);

        if (!check.success) {
          // Concentration broken - execute command to clean up the spell's effects
          const breakCommand = new BreakConcentrationCommand({
            ...this.context,
            caster: target,
            spellId: target.concentratingOn.spellId,
            spellName: target.concentratingOn.spellName,
            targets: []
          });

          currentState = breakCommand.execute(currentState);

          currentState = this.addLogEntry(currentState, {
            type: 'status',
            message: `${target.name} fails concentration save (${check.roll} vs DC ${check.dc})`,
            characterId: target.id
          });
        } else {
          // Concentration maintained
          currentState = this.addLogEntry(currentState, {
            type: 'status',
            message: `${target.name} maintains concentration (${check.roll} vs DC ${check.dc})`,
            characterId: target.id
          });
        }
      }
    }

    return currentState
  }

  get description(): string {
    if (isDamageEffect(this.effect)) {
      return `Deals ${this.effect.damage.dice} ${this.effect.damage.type} damage`
    }
    return 'Deals damage'
  }

  /**
   * Applies the effects of the Slasher feat:
   * 1. Reduce speed by 10ft (at most once per turn).
   * 2. On critical hit, target has disadvantage on attacks until start of attacker's next turn.
   */
  private applySlasherFeat(
    state: CombatState,
    caster: CombatState['characters'][0],
    target: CombatState['characters'][0],
    isCritical: boolean
  ): CombatState {
    let currentState = state;

    // Rule 1: Reduce Speed by 10ft (Once per turn)
    // Check if we've already used Slasher slow this turn
    const hasUsedSlasherSlowThisTurn = caster.featUsageThisTurn?.includes(SLASHER_SLOW_USAGE_KEY);

    if (!hasUsedSlasherSlowThisTurn) {
      // Mark Slasher slow as used for this turn on the caster
      const updatedFeatUsage = [...(caster.featUsageThisTurn || []), SLASHER_SLOW_USAGE_KEY];
      currentState = this.updateCharacter(currentState, caster.id, {
        featUsageThisTurn: updatedFeatUsage
      });

      // Apply speed reduction status effect
      const slasherSlow: StatusEffect = {
        id: `slasher_slow_${target.id}_${currentState.turnState.currentTurn}`,
        name: 'Slasher Slow',
        type: 'debuff',
        duration: 1, // Until start of attacker's next turn (1 round)
        effect: {
          type: 'stat_modifier',
          stat: 'speed',
          value: -10
        },
        icon: '🦶'
      };

      const slowCommand = new StatusConditionCommand(
        {
          type: 'STATUS_CONDITION',
          trigger: { type: 'immediate' },
          condition: { type: 'hit' },
          statusCondition: {
            name: 'Slasher Slow',
            duration: { type: 'rounds', value: 1 },
            effect: slasherSlow.effect
          }
        },
        {
          ...this.context,
          targets: [target]
        }
      );
      currentState = slowCommand.execute(currentState);

      currentState = this.addLogEntry(currentState, {
        type: 'status',
        message: `${caster.name}'s Slasher feat slows ${target.name} by 10ft!`,
        characterId: target.id
      });
    }

    // Rule 2: Critical Hit -> Disadvantage on attacks until attacker's next turn
    if (isCritical) {
      const grievousWound: ActiveEffect = {
        id: `slasher_grievous_${target.id}_${currentState.turnState.currentTurn}`,
        spellId: 'slasher',
        casterId: caster.id,
        sourceName: 'Slasher Grievous Wound',
        type: 'debuff',
        duration: { type: 'rounds', value: 1 },
        startTime: currentState.turnState.currentTurn,
        mechanics: {
          disadvantageOnAttacks: true
        }
      };

      // Get the latest target state to avoid stale references
      const currentTarget = currentState.characters.find(c => c.id === target.id);
      const updatedActiveEffects = [...(currentTarget?.activeEffects || []), grievousWound];

      currentState = this.updateCharacter(currentState, target.id, {
        activeEffects: updatedActiveEffects
      });

      currentState = this.addLogEntry(currentState, {
        type: 'status',
        message: `CRITICAL HIT! ${caster.name}'s Slasher feat grievously wounds ${target.name} (Disadvantage on attacks)!`,
        characterId: target.id
      });
    }

    return currentState;
  }

  private logDamage(
    state: CombatState,
    caster: CombatState['characters'][0],
    target: CombatState['characters'][0],
    finalDamage: number,
    planarModifier: number
  ): CombatState {
    if (!isDamageEffect(this.effect)) return state;

    const damageType = this.effect.damage.type.toLowerCase();
    const verbs = DAMAGE_VERBS[damageType] || DEFAULT_VERBS;
    const verbIndex = Math.floor(Math.random() * verbs.length);
    const verb = verbs[verbIndex];

    const sourceName = this.context.spellName;
    let logMessage = '';

    if (sourceName && sourceName !== 'Attack') {
      logMessage = `${caster.name} ${verb} ${target.name} with ${sourceName} for ${finalDamage} ${damageType} damage`;
      if (planarModifier !== 0) {
        logMessage += ` (Planar Boost: ${planarModifier > 0 ? '+' : ''}${planarModifier})`;
      }
    } else {
      logMessage = `${caster.name} ${verb} ${target.name} for ${finalDamage} ${damageType} damage`;
    }

    return this.addLogEntry(state, {
      type: 'damage',
      message: logMessage,
      characterId: target.id,
      targetIds: [target.id],
      data: { value: finalDamage, type: this.effect.damage.type }
    });
  }

  /**
   * Helper to parse dice string (e.g., "2d6+3") and roll damage.
   * Delegates to centralized combatUtils for consistent critical hit logic.
   */
  private rollDamage(diceString: string, isCritical: boolean, minRoll: number = 1): number {
    return rollDamageUtil(diceString, isCritical, minRoll);
  }
}

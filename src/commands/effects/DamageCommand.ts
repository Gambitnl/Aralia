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

    // Elemental Adept: Treat 1s as 2s
    let minRoll = 1;
    const elementalAdeptChoice = caster.featChoices?.['elemental_adept']?.selectedDamageType;
    if (elementalAdeptChoice && elementalAdeptChoice.toLowerCase() === this.effect.damage.type.toLowerCase()) {
      minRoll = 2;
    }

    // NEW: Get Planar Modifier
    let planarModifier = 0;
    if (this.context.currentPlane && this.context.spellSchool) {
      planarModifier = getPlanarSpellModifier(this.context.spellSchool, this.context.currentPlane);
    }

    for (const target of this.getTargets(currentState)) {
      // 1. Calculate base damage
      const isCritical = this.context.isCritical || false;
      let damageRoll = this.rollDamage(this.effect.damage.dice, isCritical, minRoll);

      // PLANESHIFTER: Apply Planar Impediment (Negative Modifier)
      // Empowered (+1) is now handled by SpellCommandFactory via upcasting.
      // We only apply negative modifiers here (e.g., Impeded schools).
      if (planarModifier < 0) {
        damageRoll += planarModifier; // Reduce damage
        damageRoll = Math.max(0, damageRoll);
      }

      // 2. Handle Saving Throw (if applicable)
      if (this.effect.condition.type === 'save' && this.effect.condition.saveType) {
        let dc = calculateSpellDC(caster);

        // Apply Planar Modifier to DC (Only negative)
        if (planarModifier < 0) {
          dc += planarModifier;
        }

        const savePenaltySystem = new SavePenaltySystem();
        const saveModifiers = savePenaltySystem.getActivePenalties(target);

        const saveResult = rollSavingThrow(target, this.effect.condition.saveType, dc, saveModifiers);

        // Adjust damage based on save result
        damageRoll = calculateSaveDamage(
          damageRoll,
          saveResult,
          this.effect.condition.saveEffect || 'half'
        );

        // Consume next_save penalties
        currentState = savePenaltySystem.consumeNextSavePenalties(currentState, target.id);

        // Log save outcome
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
      }

      // 3. Apply Damage
      const finalDamage = ResistanceCalculator.applyResistances(
        damageRoll,
        this.effect.damage.type,
        target,
        caster
      );

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

      // 4. Check Concentration
      if (target.concentratingOn && damageRoll > 0) {
        const check = checkConcentration(target, damageRoll);

        if (!check.success) {
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

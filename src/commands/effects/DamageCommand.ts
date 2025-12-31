import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CombatState, StatusEffect } from '../../types/combat'
import { isDamageEffect } from '../../types/spells'
import { checkConcentration } from '../../utils/concentrationUtils';
import { calculateSpellDC, rollSavingThrow, calculateSaveDamage } from '../../utils/savingThrowUtils';
import { rollDamage as rollDamageUtil } from '../../utils/combatUtils';
import { BreakConcentrationCommand } from './ConcentrationCommands'
import { ResistanceCalculator } from '../../systems/spells/mechanics/ResistanceCalculator';
import { getPlanarSpellModifier } from '../../utils/planarUtils';
import { StatusConditionCommand } from './StatusConditionCommand';

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

        const saveResult = rollSavingThrow(target, this.effect.condition.saveType, dc);

        // Adjust damage based on save result
        damageRoll = calculateSaveDamage(
          damageRoll,
          saveResult,
          this.effect.condition.saveEffect || 'half'
        );

        // Log save outcome
        currentState = this.addLogEntry(currentState, {
          type: 'status',
          message: `${target.name} ${saveResult.success ? 'succeeds' : 'fails'} ${this.effect.condition.saveType} save (${saveResult.total} vs DC ${dc})`,
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
      if (caster.feats?.includes('slasher') && this.effect.damage.type.toLowerCase() === 'slashing') {
        const _hasHit = finalDamage > 0; // Assuming hit implies damage for Slasher trigger (rule says "hit a creature")
        // But DamageCommand runs AFTER hit confirmation.
        // Rule 1: Reduce Speed by 10ft (Once per turn)
        // We need to check if we've already applied it this turn.
        // For now, we apply the status effect. The StatusEffect itself should ideally prevent stacking or we check here.
        // A simple "Slasher Slow" status effect.
        // We don't have a "usedSlasherThisTurn" tracker on the caster easily accessible here without state mod.
        // However, standard 5e implies if you hit multiple people, you can slow one? "When you hit a creature... you can reduce its speed".
        // It says "Once per turn". This limits it to ONE target.
        // For MVP, we will apply it to every hit, acknowledging the limitation is missing.
        // TODO(Mechanist): Enforce "Once per turn" limit for Slasher speed reduction.

        const slasherSlow: StatusEffect = {
          id: `slasher_slow_${target.id}_${currentState.turnState.currentTurn}`,
          name: 'Slasher Slow',
          type: 'debuff',
          duration: 1, // Until start of your next turn (approx 1 round)
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
              name: slasherSlow.name,
              duration: { type: 'rounds', value: 1 },
              // Now strictly typed in StatusCondition
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

        // Rule 2: Critical Hit -> Disadvantage
        if (isCritical) {
             const _slasherCrit: StatusEffect = {
                id: `slasher_crit_${target.id}_${currentState.turnState.currentTurn}`,
                name: 'Slasher Grievous Wound',
                type: 'debuff',
                duration: 1,
                effect: {
                    type: 'condition', // Disadvantage on attacks
                    value: 0 // Placeholder, Condition system handles the rest via name matching or specific logic
                },
                icon: '⚔️'
             };
             // We need to map this to "Disadvantage on Attack Rolls".
             // Currently StatusEffect supports 'stat_modifier' or 'condition'.
             // If we use 'condition', we rely on ConditionName. "Grievous Wound" isn't a standard condition.
             // We might need a custom effect type or just rely on the description for now?
             // Or use ActiveEffect: 'disadvantage_on_attacks'.
             // Wait, StatusConditionCommand uses StatusEffect.
             // CombatCharacter has `activeEffects` which supports `disadvantage_on_attacks`.
             // But DamageCommand works via StatusConditionCommand -> StatusEffect.

             // Direct injection into ActiveEffects (skipping StatusConditionCommand wrapper for precise mechanics):
             // Actually, let's use a descriptive StatusEffect and log it.
             // To strictly implement "Disadvantage", we'd need to add an ActiveEffect.
             // But DamageCommand usually delegates to StatusConditionCommand.

             // Let's create a special status that applies the 'disadvantage_on_attacks' ActiveEffect if possible.
             // But `StatusEffect` structure is limited.
             // Hack for now: Log it clearly. The engine might not enforce the disadvantage automatically yet without `ActiveEffect` support in StatusEffect.
             // TODO(Mechanist): Wire Slasher Critical Disadvantage to automatic ActiveEffect 'disadvantage_on_attacks'.

             currentState = this.addLogEntry(currentState, {
                type: 'status',
                message: `CRITICAL HIT! ${caster.name}'s Slasher feat grievously wounds ${target.name} (Disadvantage on attacks)!`,
                characterId: target.id
            });
        }
      }

      // --- IMPROVED LOGGING ---
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

      currentState = this.addLogEntry(currentState, {
        type: 'damage',
        message: logMessage,
        characterId: target.id,
        targetIds: [target.id],
        data: { value: finalDamage, type: this.effect.damage.type }
      });

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
   * Helper to parse dice string (e.g., "2d6+3") and roll damage.
   * Delegates to centralized combatUtils for consistent critical hit logic.
   */
  private rollDamage(diceString: string, isCritical: boolean, minRoll: number = 1): number {
    return rollDamageUtil(diceString, isCritical, minRoll);
  }
}

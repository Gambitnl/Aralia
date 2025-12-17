/**
 * @file src/commands/effects/DamageCommand.ts
 * Command for calculating and applying damage to characters.
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CombatState } from '../../types/combat'
import { isDamageEffect } from '../../types/spells'
import { checkConcentration } from '../../utils/concentrationUtils';
import { calculateSpellDC, rollSavingThrow, calculateSaveDamage } from '../../utils/savingThrowUtils';
import { BreakConcentrationCommand } from './ConcentrationCommands'
import { ResistanceCalculator } from '../../systems/spells/mechanics/ResistanceCalculator';

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
 * Command to apply damage to one or more targets.
 *
 * This command centralizes the damage resolution pipeline:
 * 1. Rolling damage dice (including special handling for feats like Elemental Adept).
 * 2. Resolving saving throws (Full/Half/None).
 * 3. Applying resistances, immunities, and vulnerabilities via `ResistanceCalculator`.
 * 4. Updating target HP.
 * 5. Checking for concentration breakage.
 *
 * It also handles immersive combat logging by selecting damage-type-appropriate verbs.
 *
 * @example
 * const command = new DamageCommand(fireballEffect, {
 *   spellId: 'spell-123',
 *   caster: wizard,
 *   targets: [goblin1, goblin2]
 * });
 * const newState = command.execute(currentState);
 */
export class DamageCommand extends BaseEffectCommand {
  /**
   * Executes the damage logic.
   *
   * @param state - The current combat state.
   * @returns The updated state with modified HP and log entries.
   */
  execute(state: CombatState): CombatState {
    if (!isDamageEffect(this.effect)) {
      console.warn('DamageCommand received non-damage effect')
      return state
    }

    let currentState = state
    const caster = this.getCaster(currentState);

    // Elemental Adept Logic:
    // If the caster has the Elemental Adept feat for this damage type,
    // any 1s rolled on the damage dice are treated as 2s.
    let minRoll = 1;
    const elementalAdeptChoice = caster.featChoices?.['elemental_adept']?.selectedDamageType;
    if (elementalAdeptChoice && elementalAdeptChoice.toLowerCase() === this.effect.damage.type.toLowerCase()) {
      minRoll = 2;
    }

    for (const target of this.getTargets(currentState)) {
      // 1. Calculate base damage
      let damageRoll = this.rollDamage(this.effect.damage.dice, minRoll);

      // 2. Handle Saving Throw (if applicable)
      if (this.effect.condition.type === 'save' && this.effect.condition.saveType) {
        const dc = calculateSpellDC(caster);
        const saveResult = rollSavingThrow(target, this.effect.condition.saveType, dc);

        // Adjust damage based on save result
        const originalDamage = damageRoll;
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
      // Apply Resistances/Vulnerabilities (including Elemental Adept check)
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

      // --- LOGGING ---
      // Select a random verb based on damage type for flavor
      const damageType = this.effect.damage.type.toLowerCase();
      const verbs = DAMAGE_VERBS[damageType] || DEFAULT_VERBS;
      const verbIndex = Math.floor(Math.random() * verbs.length);
      const verb = verbs[verbIndex];

      const sourceName = this.context.spellName;
      let logMessage = '';

      if (sourceName && sourceName !== 'Attack') {
        logMessage = `${caster.name} ${verb} ${target.name} with ${sourceName} for ${finalDamage} ${damageType} damage`;
      } else {
         // Generic or "Attack" source
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
      // If the target is concentrating and took damage, they must make a Constitution check.
      if (target.concentratingOn && damageRoll > 0) {
        const check = checkConcentration(target, damageRoll);

        if (!check.success) {
          // Break concentration
          const breakCommand = new BreakConcentrationCommand({
            // We need a context for the break command. 
            // Ideally we'd have the original caster of the concentrated spell, 
            // but here 'caster' in context refers to the one dealing damage.
            // However, BreakConcentrationCommand uses getCaster(state) which looks up context.caster.id.
            // So we must pass the target (who is concentrating) as the 'caster' in this new context.
            ...this.context,
            caster: target,
            spellId: target.concentratingOn.spellId,
            spellName: target.concentratingOn.spellName,
            targets: [] // Self logic is handled by getCaster
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
   * Parses a dice string (e.g., "2d6+3") and rolls damage.
   *
   * @param diceString - The dice notation string.
   * @param minRoll - Minimum value for each die roll (default 1). Used for Elemental Adept (treats 1s as 2s).
   * @returns The total calculated damage.
   */
  private rollDamage(diceString: string, minRoll: number = 1): number {
    const match = diceString.match(/(\d+)d(\d+)(?:\+(\d+))?/)
    if (!match) return 0

    const [, countStr, sizeStr, modStr] = match
    const count = parseInt(countStr)
    const size = parseInt(sizeStr)
    const mod = modStr ? parseInt(modStr) : 0

    let total = 0
    for (let i = 0; i < count; i++) {
      let roll = Math.floor(Math.random() * size) + 1;
      if (roll < minRoll) roll = minRoll;
      total += roll;
    }
    return total + mod
  }
}

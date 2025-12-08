import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CombatState } from '../../types/combat'
import { isDamageEffect } from '../../types/spells'
import { checkConcentration } from '../../utils/concentrationUtils';
import { calculateSpellDC, rollSavingThrow, calculateSaveDamage } from '../../utils/savingThrowUtils';
import { BreakConcentrationCommand } from './ConcentrationCommands'

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

    for (const target of this.getTargets(currentState)) {
      // 1. Calculate base damage
      let damageRoll = this.rollDamage(this.effect.damage.dice);

      // 2. Handle Saving Throw (if applicable)
      if (this.effect.condition.type === 'save' && this.effect.condition.saveType) {
        const caster = this.getCaster(currentState);
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
      const newHP = Math.max(0, target.currentHP - damageRoll);
      currentState = this.updateCharacter(currentState, target.id, {
        currentHP: newHP
      });

      currentState = this.addLogEntry(currentState, {
        type: 'damage',
        message: `${target.name} takes ${damageRoll} ${this.effect.damage.type.toLowerCase()} damage`,
        characterId: target.id,
        targetIds: [target.id],
        data: { value: damageRoll, type: this.effect.damage.type }
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
   * Helper to parse dice string (e.g., "2d6+3") and roll damage.
   * @param diceString The dice notation string.
   * @returns The total calculated damage.
   */
  private rollDamage(diceString: string): number {
    const match = diceString.match(/(\d+)d(\d+)(?:\+(\d+))?/)
    if (!match) return 0

    const [, countStr, sizeStr, modStr] = match
    const count = parseInt(countStr)
    const size = parseInt(sizeStr)
    const mod = modStr ? parseInt(modStr) : 0

    let total = 0
    for (let i = 0; i < count; i++) {
      total += Math.floor(Math.random() * size) + 1
    }
    return total + mod
  }
}

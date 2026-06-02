
import { SpellCommand, CommandContext, CommandMetadata } from '../base/SpellCommand';
import { CombatState, ActiveEffect } from '../../types/combat';
import { DefensiveEffect } from '../../types/spells';
import { getAbilityModifierValue } from '../../utils/characterUtils';
import { v4 as uuidv4 } from 'uuid';

/**
 * Handles defensive buffs like AC bonuses, Temporary HP, and base AC setting (Mage Armor).
 * The command keeps the immediate combat-facing AC value in sync while also
 * preserving structured mechanics on the ActiveEffect so later recalculation,
 * cleanup, and UI proof can reason about which defensive rule is active.
 */
export class DefensiveCommand implements SpellCommand {
  readonly id: string;
  readonly description: string;
  readonly metadata: CommandMetadata;

  constructor(
    private effect: DefensiveEffect,
    private context: CommandContext
  ) {
    this.id = uuidv4();
    this.description = `Applies ${effect.defenseType} (${effect.value})`;
    this.metadata = {
      spellId: context.spellId,
      spellName: context.spellName,
      casterId: context.caster.id,
      casterName: context.caster.name,
      targetIds: context.targets.map(t => t.id),
      effectType: 'DEFENSIVE',
      timestamp: Date.now()
    };
  }

  execute(state: CombatState): CombatState {
    const newState = {
      ...state,
      characters: [...state.characters] // Deep copy the characters array to allow safe mutation
    };

    // Iterate over targets safely
    this.context.targets.forEach(target => {
      const targetIndex = newState.characters.findIndex(c => c.id === target.id);
      if (targetIndex === -1) return;

      const currentCharacter = newState.characters[targetIndex];
      const updatedCharacter = { ...currentCharacter };
      let logMessage = '';
      const effectValue = this.getStructuredDefenseValue();

      switch (this.effect.defenseType) {
        case 'ac_bonus': {
          // Apply AC Bonus as an active effect. Structured spell data may put
          // the number in `acBonus` while legacy fixtures still use `value`.
          const activeEffect = this.createActiveEffect(
            updatedCharacter.id,
            this.effect.defenseType,
            effectValue,
            state.turnState.currentTurn
          );
          updatedCharacter.activeEffects = [...(updatedCharacter.activeEffects || []), activeEffect];

          // Mechanically update AC (simplified, real system might re-calc from effects)
          updatedCharacter.armorClass = (updatedCharacter.armorClass || 10) + effectValue;
          logMessage = `${this.context.spellName} increases AC by ${effectValue}`;
          break;
        }

        case 'set_base_ac': {
          // Set Base AC (e.g. Mage Armor: 13 + Dex). We preserve the formula
          // on the active effect because recalculation/UI need to know that
          // this is a base replacement, not a flat bonus.
          const dexMod = getAbilityModifierValue(updatedCharacter.stats.dexterity);
          const newAC = effectValue + dexMod;

          const activeEffect = this.createActiveEffect(
            updatedCharacter.id,
            this.effect.defenseType,
            effectValue,
            state.turnState.currentTurn
          );
          updatedCharacter.activeEffects = [...(updatedCharacter.activeEffects || []), activeEffect];
          updatedCharacter.armorClass = newAC;

          logMessage = `${this.context.spellName} sets base AC to ${newAC}`;
          break;
        }

        case 'ac_minimum': {
          // Apply an AC floor such as Barkskin. This is intentionally a floor:
          // it raises low AC but does not reduce a target whose AC is already
          // higher from armor, shield, or another valid calculation.
          const activeEffect = this.createActiveEffect(
            updatedCharacter.id,
            this.effect.defenseType,
            effectValue,
            state.turnState.currentTurn
          );
          updatedCharacter.activeEffects = [...(updatedCharacter.activeEffects || []), activeEffect];
          updatedCharacter.armorClass = Math.max(updatedCharacter.armorClass || 10, effectValue);

          logMessage = `${this.context.spellName} sets minimum AC to ${effectValue}`;
          break;
        }

        case 'temporary_hp': {
          // Temporary HP rules: Do not stack. Keep the higher value.
          const currentTemp = updatedCharacter.tempHP || 0;
          const newTemp = effectValue;

          if (newTemp > currentTemp) {
            updatedCharacter.tempHP = newTemp;
            logMessage = `${this.context.spellName} grants ${newTemp} temporary HP`;
          } else {
            logMessage = `${this.context.spellName} grants ${newTemp} temporary HP (overlapped)`;
          }
          break;
        }
      }

      // Update character in state
      newState.characters[targetIndex] = updatedCharacter;

      // Add log entry
      if (logMessage) {
        newState.combatLog = [
          ...newState.combatLog,
          {
            id: uuidv4(),
            timestamp: Date.now(),
            message: logMessage,
            type: 'status',
            characterId: this.context.caster.id
          }
        ];
      }
    });

    return newState;
  }

  private getStructuredDefenseValue(): number {
    switch (this.effect.defenseType) {
      case 'ac_bonus':
        return this.effect.acBonus ?? this.effect.value ?? 0;
      case 'ac_minimum':
        return this.effect.acMinimum ?? this.effect.value ?? 0;
      case 'set_base_ac':
      case 'temporary_hp':
      default:
        return this.effect.value ?? 0;
    }
  }

  private createActiveEffect(targetId: string, type: string, value: number, currentTurn: number): ActiveEffect {
    return {
      id: `effect-${this.context.spellId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      spellId: this.context.spellId,
      casterId: this.context.caster.id,
      sourceName: this.context.spellName,
      type: 'buff', // Defensive buffs are positive; switch to debuff when implementing curses.
      duration: this.effect.duration || { type: 'rounds', value: 1 },
      startTime: currentTurn,
      mechanics: {
        acBonus: type === 'ac_bonus' ? value : undefined,
        baseAC: type === 'set_base_ac' ? value : undefined,
        baseACFormula: type === 'set_base_ac' ? this.effect.baseACFormula : undefined,
        acMinimum: type === 'ac_minimum' ? value : undefined,
      }
    };
  }
}

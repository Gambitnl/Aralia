
import { SpellCommand, CommandContext, CommandMetadata } from '../base/SpellCommand';
import { CombatState, ActiveEffect } from '../../types/combat';
import { DefensiveEffect } from '../../types/spells';
import { getAbilityModifierValue } from '../../utils/characterUtils';
import { v4 as uuidv4 } from 'uuid';

/**
 * Handles defensive buffs like AC bonuses, Temporary HP, and base AC setting (Mage Armor).
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
      const effectValue = this.effect.value ?? 0;

      switch (this.effect.defenseType) {
        case 'ac_bonus': {
          // Apply AC Bonus as an active effect
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
          // Set Base AC (e.g. Mage Armor: 13 + Dex)
          // Calculation: Base Value + Dex Modifier
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
      }
    };
  }
}

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 23:50:22
 * Dependents: commands/factory/SpellCommandFactory.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
    // Resistance is the only defensive row in this slice that depends on a
    // player choice, so keep that chosen damage type visible in the command
    // description for logs and debugging.
    const chosenDamageType = this.getChosenDamageType();
    this.description = chosenDamageType
      ? `Applies ${effect.defenseType} (${chosenDamageType})`
      : `Applies ${effect.defenseType} (${effect.value})`;
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
            const activeEffect = this.createActiveEffect(
              updatedCharacter.id,
              this.effect.defenseType,
              newTemp,
              state.turnState.currentTurn
            );

            updatedCharacter.tempHP = newTemp;
            updatedCharacter.activeEffects = [...(updatedCharacter.activeEffects || []), activeEffect];
            // Record the spell that owns this temporary HP pool. Reactive
            // spells such as Armor of Agathys must end when their own temp HP
            // is gone, and cannot safely treat another feature's temp HP as
            // keeping the retaliation alive.
            updatedCharacter.temporaryHitPointSource = {
              spellId: this.context.spellId,
              spellName: this.context.spellName,
              casterId: this.context.caster.id
            };
            logMessage = `${this.context.spellName} grants ${newTemp} temporary HP`;
          } else {
            logMessage = `${this.context.spellName} grants ${newTemp} temporary HP (overlapped)`;
          }
          break;
        }

        case 'damage_reduction': {
          // Resistance chooses exactly one damage type at cast time. The spell
          // keeps that choice on the active effect so the damage engine can
          // spend the 1d4 rider once per turn and concentration cleanup can
          // remove the entire mirror in one pass.
          const chosenDamageType = this.getChosenDamageType();
          if (!chosenDamageType) {
            logMessage = `${this.context.spellName} needs a chosen damage type before it can grant resistance`;
            break;
          }

          const activeEffect = this.createActiveEffect(
            updatedCharacter.id,
            this.effect.defenseType,
            effectValue,
            state.turnState.currentTurn,
            [chosenDamageType]
          );

          // Recasting should replace the earlier mirror instead of leaving two
          // resistance rows live on the same target.
          updatedCharacter.activeEffects = [
            ...(updatedCharacter.activeEffects || []).filter(effect => effect.spellId !== this.context.spellId),
            activeEffect
          ];

          logMessage = `${this.context.spellName} prepares ${chosenDamageType} damage reduction`;
          break;
        }

        case 'immunity': {
          // Damage immunity still follows the broader listed-damage contract
          // used by the rest of the combat engine.
          const damageTypes = this.effect.damageType || [];
          const activeEffect = this.createActiveEffect(
            updatedCharacter.id,
            this.effect.defenseType,
            effectValue,
            state.turnState.currentTurn,
            damageTypes
          );

          updatedCharacter.activeEffects = [...(updatedCharacter.activeEffects || []), activeEffect];
          updatedCharacter.immunities = Array.from(new Set([
            ...(updatedCharacter.immunities || []),
            ...damageTypes
          ]));
          logMessage = `${this.context.spellName} grants immunity to ${damageTypes.join(', ') || 'listed damage'}`;
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

  private getChosenDamageType(): string | undefined {
    if (this.effect.defenseType !== 'damage_reduction' || this.effect.damageTypeSource !== 'chosen_damage_type') {
      return undefined;
    }

    const chosenDamageType = this.context.playerInput?.trim();
    if (!chosenDamageType) {
      return undefined;
    }

    return (this.effect.damageType || []).find(damageType =>
      damageType.toLowerCase() === chosenDamageType.toLowerCase()
    );
  }

  private createActiveEffect(
    targetId: string,
    type: string,
    value: number,
    currentTurn: number,
    damageTypes?: string[]
  ): ActiveEffect {
    const chosenDamageType = damageTypes?.length === 1 ? damageTypes[0] : undefined;

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
        damageResistance: type === 'resistance' ? damageTypes : undefined,
        damageImmunity: type === 'immunity' ? damageTypes : undefined,
        damageReduction: type === 'damage_reduction' && chosenDamageType && this.effect.damageReduction ? {
          dice: this.effect.damageReduction.dice,
          appliesTo: this.effect.damageReduction.appliesTo,
          frequency: this.effect.damageReduction.frequency ?? 'once_per_turn',
          damageType: chosenDamageType
        } : undefined,
      }
    };
  }
}

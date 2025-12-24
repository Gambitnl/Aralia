
/**
 * @file src/types/effects.ts
 * Defines universal effect types (Buffs, Debuffs, Utility) used across Religion, Spells, and Items.
 * This structure prevents logic duplication and `any` types in domain-specific interfaces.
 */

import { AbilityScoreName } from './core';
import { DamageType, ConditionName, SavingThrowAbility, TargetConditionFilter } from './spells';

/**
 * Base interface for all effects.
 */
interface BaseEffect {
  description?: string;
  duration?: number; // In minutes. 0 or undefined usually implies instantaneous or permanent depending on context.
}

/**
 * Effect that modifies a statistic (Ability Score, AC, Speed, etc.).
 */
export interface StatBonusEffect extends BaseEffect {
  type: 'stat_bonus';
  stat: AbilityScoreName | 'AC' | 'Initiative' | 'Speed' | 'All_Saves';
  value: number;
}

/**
 * Effect that grants advantage on specific skill checks.
 */
export interface SkillAdvantageEffect extends BaseEffect {
  type: 'skill_advantage';
  skillIds: string[]; // e.g., ['persuasion', 'insight']
}

/**
 * Effect that grants resistance to damage types.
 */
export interface ResistanceEffect extends BaseEffect {
  type: 'resistance';
  damageTypes: DamageType[]; // e.g., [DamageType.Fire, DamageType.Necrotic]
}

/**
 * Effect that restores Health or removes conditions.
 */
export interface RestorationEffect extends BaseEffect {
  type: 'restore';
  subtype: 'heal' | 'cure_condition' | 'restore_slot';
  amount?: number | 'full'; // For healing
  conditions?: ConditionName[]; // For cure_condition
  spellLevel?: number; // For restore_slot
}

/**
 * Utility effects for exploration or roleplay.
 * Renamed to avoid collision with Spell's UtilityEffect.
 */
export interface MiscEffect extends BaseEffect {
  type: 'utility';
  effectType: 'light' | 'identify' | 'sanctuary' | 'water_breathing' | 'language';
}

/**
 * Discriminated union of all mechanical effects.
 * Used by Blessings, Magic Items, and Environmental buffs.
 */
export type MechanicalEffect =
  | StatBonusEffect
  | SkillAdvantageEffect
  | ResistanceEffect
  | RestorationEffect
  | MiscEffect;

/**
 * Represents an active effect applied to a character in combat.
 * Originally defined in combat.ts, moved here to avoid circular dependencies with character.ts.
 */
export interface ActiveEffect {
  type: 'ac_bonus' | 'advantage_on_saves' | 'disadvantage_on_attacks' | 'set_base_ac' | 'ac_minimum' | 'other';
  name: string;
  value?: number;  // For numeric effects like AC bonus
  duration: {
    type: 'rounds' | 'until_condition' | 'permanent' | 'minutes' | 'hours' | 'special';
    value?: number;
  };
  appliedTurn: number;
  source: string;  // Spell ID or effect name
  description?: string;
  savingThrows?: SavingThrowAbility[];  // For advantage_on_saves
  attackerFilter?: TargetConditionFilter; // Strict typing replacing 'any'
}

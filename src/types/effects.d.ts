/**
 * @file src/types/effects.ts
 * Defines universal effect types (Buffs, Debuffs, Utility) used across Religion, Spells, and Items.
 * This structure prevents logic duplication and `any` types in domain-specific interfaces.
 */
import { AbilityScoreName, CharacterStats } from './core';
import { DamageType, ConditionName, SavingThrowAbility, TargetConditionFilter } from './spells';
/**
 * Base interface for all effects.
 */
interface BaseEffect {
    description?: string;
    duration?: number;
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
    skillIds: string[];
}
/**
 * Effect that grants resistance to damage types.
 */
export interface ResistanceEffect extends BaseEffect {
    type: 'resistance';
    damageTypes: DamageType[];
}
/**
 * Effect that restores Health or removes conditions.
 */
export interface RestorationEffect extends BaseEffect {
    type: 'restore';
    subtype: 'heal' | 'cure_condition' | 'restore_slot';
    amount?: number | 'full';
    conditions?: ConditionName[];
    spellLevel?: number;
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
export type MechanicalEffect = StatBonusEffect | SkillAdvantageEffect | ResistanceEffect | RestorationEffect | MiscEffect;
/**
 * Represents an active effect applied to a character in combat.
 * Originally defined in combat.ts, moved here to avoid circular dependencies with character.ts.
 */
export interface ActiveEffect {
    type: 'ac_bonus' | 'advantage_on_saves' | 'disadvantage_on_attacks' | 'set_base_ac' | 'ac_minimum' | 'other';
    name: string;
    value?: number;
    duration: {
        type: 'rounds' | 'until_condition' | 'permanent' | 'minutes' | 'hours' | 'special';
        value?: number;
    };
    appliedTurn: number;
    source: string;
    description?: string;
    savingThrows?: SavingThrowAbility[];
    attackerFilter?: TargetConditionFilter;
    mechanics?: Record<string, unknown>;
}
/**
 * Represents a persistent status effect on a character (buff, debuff, DoT, HoT).
 * Originally defined in combat.ts, moved here to avoid circular dependencies with character.ts.
 */
export interface StatusEffect {
    id: string;
    name: string;
    type: 'buff' | 'debuff' | 'dot' | 'hot';
    duration: number;
    effect: {
        type: 'stat_modifier' | 'damage_per_turn' | 'heal_per_turn' | 'skip_turn' | 'condition';
        value?: number;
        stat?: keyof CharacterStats;
    };
    icon?: string;
}
export {};

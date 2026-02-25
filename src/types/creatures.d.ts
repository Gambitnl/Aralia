import { DamageType, ConditionName } from './spells';
/**
 * D&D creature types - affects targeting, resistances, and abilities.
 */
export declare enum CreatureType {
    Aberration = "Aberration",
    Beast = "Beast",
    Celestial = "Celestial",
    Construct = "Construct",
    Dragon = "Dragon",
    Elemental = "Elemental",
    Fey = "Fey",
    Fiend = "Fiend",
    Giant = "Giant",
    Humanoid = "Humanoid",
    Monstrosity = "Monstrosity",
    Ooze = "Ooze",
    Plant = "Plant",
    Undead = "Undead"
}
export interface TypeTraits {
    immunities?: DamageType[];
    resistances?: DamageType[];
    vulnerabilities?: DamageType[];
    conditionImmunities?: ConditionName[];
    description?: string;
}
/**
 * Standard traits associated with specific creature types.
 * Note: Individual creatures may vary; these are general rules or common attributes.
 */
export declare const CreatureTypeTraits: Record<CreatureType, TypeTraits>;
/**
 * Creature size categories.
 */
export declare enum CreatureSize {
    Tiny = "Tiny",
    Small = "Small",
    Medium = "Medium",
    Large = "Large",
    Huge = "Huge",
    Gargantuan = "Gargantuan"
}
export type HitDieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20';
export interface SizeTraits {
    /** Space controlled in combat (width in feet). Assumes square space. */
    spaceInFeet: number;
    /** Typical Hit Die size for monsters of this size. */
    hitDie: HitDieType;
    description: string;
}
/**
 * Standard traits associated with creature sizes.
 */
export declare const CreatureSizeTraits: Record<CreatureSize, SizeTraits>;

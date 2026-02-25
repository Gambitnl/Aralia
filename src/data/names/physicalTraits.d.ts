/**
 * @file physicalTraits.ts
 * Defines logical physical ranges and cosmetic options for NPC generation.
 * Height and weight bases are in inches and pounds respectively.
 */
export interface PhysicalTraits {
    hairStyles: string[];
    hairColors: string[];
    eyeColors: string[];
    skinTones: string[];
    facialHair?: string[];
    bodyTypes: string[];
    heightBaseInches: number;
    heightModifierDice: string;
    weightBaseLb: number;
    weightModifierDice: string;
    ageMaturity: number;
    ageMax: number;
}
export declare const COMMON_HAIR_STYLES: string[];
export declare const COMMON_HAIR_COLORS: string[];
export declare const COMMON_EYE_COLORS: string[];
export declare const COMMON_SKIN_TONES: string[];
export declare const COMMON_BODY_TYPES: string[];
/**
 * Aesthetic flavor traits to make NPCs more memorable.
 */
export declare const SCARS_AND_MARKS: string[];
/**
 * Race-specific physical constraints.
 * Sourced from D&D 5e Player's Handbook (PHB) and expanded for variety.
 */
export declare const RACE_PHYSICAL_TRAITS: Record<string, PhysicalTraits>;
export declare const FALLBACK_TRAITS: PhysicalTraits;

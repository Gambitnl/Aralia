/**
 * @file src/types/conditions.ts
 * Defines the standard conditions that can affect creatures in the game.
 */
/**
 * Standard D&D 5e conditions that alter a creature's capabilities.
 */
export declare enum ConditionType {
    Blinded = "Blinded",
    Charmed = "Charmed",
    Deafened = "Deafened",
    Exhaustion = "Exhaustion",
    Frightened = "Frightened",
    Grappled = "Grappled",
    Incapacitated = "Incapacitated",
    Invisible = "Invisible",
    Paralyzed = "Paralyzed",
    Petrified = "Petrified",
    Poisoned = "Poisoned",
    Prone = "Prone",
    Restrained = "Restrained",
    Stunned = "Stunned",
    Unconscious = "Unconscious",
    /**
     * Non-standard condition: Target is on fire.
     * Mechanically treated as a condition for tracking duration and removal.
     */
    Ignited = "Ignited"
}
/**
 * Metadata and mechanical summary for a condition.
 */
export interface ConditionTraits {
    /** Brief description of what the condition represents. */
    description: string;
    /** Summary of mechanical effects (e.g., "Disadvantage on attacks"). */
    mechanics: string[];
    /** Whether this condition automatically ends if the creature takes damage (e.g., some charm effects). */
    endsOnDamage?: boolean;
    /** Whether this condition incapacitates the creature (prevents actions/reactions). */
    isIncapacitating?: boolean;
}
/**
 * Definitions for all standard conditions.
 */
export declare const ConditionDefinitions: Record<ConditionType, ConditionTraits>;

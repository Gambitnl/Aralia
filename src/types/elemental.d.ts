/**
 * @file src/types/elemental.ts
 * Defines elemental states and their interactions for the physics simulation system.
 */
/**
 * Tags that can be applied to entities, affecting game mechanics and reacting to other elements.
 * States can combine (wet + cold = frozen) or cancel (wet + fire = steam/null).
 */
/**
 * Elemental state effects are sourced from effects and combat systems and resolved
 * through shared utilities in the elemental pipeline.
 */
export declare enum StateTag {
    Wet = "wet",
    Burning = "burning",
    Frozen = "frozen",
    Oiled = "oiled",
    Poisoned = "poisoned",
    Electrified = "electrified",
    Cold = "cold",// Represents extreme cold or chilling effects
    Smoke = "smoke",// Represents smoke, steam, or fog that obscures vision
    Webbed = "webbed",// Represents being trapped in sticky webs
    Wind = "wind",// Represents strong air currents or buffeting winds
    Acid = "acid"
}
/**
 * Defines the result of combining two states.
 * Keys are alphabetically sorted combinations of StateTags (e.g., "burning+wet").
 * Values are the resulting StateTag, or null to remove both (cancellation).
 */
export declare const StateInteractions: Record<string, StateTag | null>;

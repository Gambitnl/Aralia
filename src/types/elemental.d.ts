/**
 * @file src/types/elemental.ts
 * Defines elemental states and their interactions for the physics simulation system.
 */
/**
 * Tags that can be applied to entities, affecting game mechanics and reacting to other elements.
 * States can combine (wet + cold = frozen) or cancel (wet + fire = steam/null).
 */
/**
 * This system should be integrated into the damage pipeline (e.g., DamageCommand or a new ApplyEffectCommand).
 * When damage or an effect is applied:
 * 1. Check for incoming element types (Fire damage applying Burning, Water spell applying Wet).
 * 2. Call `applyStateToTags(target.stateTags, newState)` to resolve interactions.
 * 3. Update the target's stateTags and apply any resulting mechanics (e.g., Frozen prevents movement).
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
/**
 * Maps standard 5e status condition names to their corresponding elemental state tags.
 * Used to ensure applying a status like "Burning" also updates the underlying chemistry engine.
 */
export declare const ConditionToStateTag: Record<string, StateTag>;
/**
 * Maps a combat damage type to the elemental StateTag it applies on contact.
 *
 * Keys are lowercase damage types so callers can pass raw spell/weapon damage
 * types directly. Only damage types with a clear elemental meaning are mapped;
 * physical and metaphysical types (bludgeoning, force, psychic, radiant, etc.)
 * have no elemental state and are intentionally absent.
 */
export declare const DamageTypeToStateTag: Record<string, StateTag>;
/**
 * Resolves the elemental StateTag for a damage type, or undefined when the
 * damage type does not map to an elemental state. Case-insensitive.
 */
export declare function getStateTagForDamageType(damageType: string): StateTag | undefined;

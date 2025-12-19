/**
 * @file src/types/elemental.ts
 * Defines elemental states and their interactions for the physics simulation system.
 */

/**
 * Tags that can be applied to entities, affecting game mechanics and reacting to other elements.
 * States can combine (wet + cold = frozen) or cancel (wet + fire = steam/null).
 */
/**
 * @TODO Integration Point:
 * This system should be integrated into the damage pipeline (e.g., DamageCommand or a new ApplyEffectCommand).
 * When damage or an effect is applied:
 * 1. Check for incoming element types (Fire damage applying Burning, Water spell applying Wet).
 * 2. Call `applyStateToTags(target.stateTags, newState)` to resolve interactions.
 * 3. Update the target's stateTags and apply any resulting mechanics (e.g., Frozen prevents movement).
 */

export enum StateTag {
  Wet = 'wet',
  Burning = 'burning',
  Frozen = 'frozen',
  Oiled = 'oiled',
  Poisoned = 'poisoned',
  Electrified = 'electrified',
  Cold = 'cold', // Represents extreme cold or chilling effects
}

/**
 * Defines the result of combining two states.
 * Keys are alphabetically sorted combinations of StateTags (e.g., "burning+wet").
 * Values are the resulting StateTag, or null to remove both (cancellation).
 */
export const StateInteractions: Record<string, StateTag | null> = {
  // Wet interactions
  'cold+wet': StateTag.Frozen,      // Water freezes into ice
  'burning+wet': null,              // Water extinguishes fire (steam)
  'burning+cold': null,             // Extreme cold extinguishes fire

  // Oiled interactions
  'burning+oiled': StateTag.Burning, // Oil ignites (intensifies burning)

  // Frozen interactions
  'burning+frozen': StateTag.Wet,   // Fire melts ice

  // Electrified interactions
  // (Placeholder for future: wet+electrified -> AoE damage)
  // TODO(Simulator): The current system only supports state transformation.
  // To implement wet+electrified -> AoE damage, we need to expand interaction results to include side-effects.
};

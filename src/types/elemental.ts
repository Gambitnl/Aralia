/**
 * @file src/types/elemental.ts
 * Defines elemental states and their interactions for the physics simulation system.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: commands/effects/DamageCommand.ts, commands/effects/StatusConditionCommand.ts, systems/physics/ElementalInteractionSystem.ts, types/index.ts, utils/combat/aoeCalculations.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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

export enum StateTag {
  Wet = 'wet',
  Burning = 'burning',
  Frozen = 'frozen',
  Oiled = 'oiled',
  Poisoned = 'poisoned',
  Electrified = 'electrified',
  Cold = 'cold', // Represents extreme cold or chilling effects
  Smoke = 'smoke', // Represents smoke, steam, or fog that obscures vision
  Webbed = 'webbed', // Represents being trapped in sticky webs
  Wind = 'wind', // Represents strong air currents or buffeting winds
  Acid = 'acid', // Represents corrosive substances
}

/**
 * Defines the result of combining two states.
 * Keys are alphabetically sorted combinations of StateTags (e.g., "burning+wet").
 * Values are the resulting StateTag, or null to remove both (cancellation).
 */
export const StateInteractions: Record<string, StateTag | null> = {
  // Wet interactions
  'cold+wet': StateTag.Frozen,      // Water freezes into ice
  'burning+wet': StateTag.Smoke,    // Water extinguishes fire (creating steam/smoke)
  'burning+cold': null,             // Extreme cold extinguishes fire

  // Oiled interactions
  'burning+oiled': StateTag.Burning, // Oil ignites (intensifies burning)
  'oiled+wet': StateTag.Wet,        // Water washes away oil

  // Frozen interactions
  'burning+frozen': StateTag.Wet,   // Fire melts ice

  // Poisoned interactions
  'burning+poisoned': StateTag.Burning, // Fire burns away organic toxins/sludge
  'poisoned+wet': StateTag.Wet,     // Water washes away surface poisons

  // Smoke interactions
  'cold+smoke': StateTag.Wet,       // Condensation (Smoke/Steam cools to Water)
  'smoke+wind': null,               // Wind disperses smoke/fog/steam

  // Webbed interactions
  'burning+webbed': StateTag.Burning, // Fire burns away webs (and ignites target)

  // Acid interactions
  'acid+webbed': null,              // Acid dissolves webs
  'acid+oiled': null,               // Acid neutralizes/breaks down oil
  'acid+wet': StateTag.Wet,         // Water washes away/dilutes acid
  'acid+burning': StateTag.Smoke,   // Acid burns into toxic fumes

  // Electrified interactions
  // Wet + electrified is deliberately NOT a row in this table (agora-2fb1). A row here means
  // "these two states combine into one", and applyStateToTags() removes the existing state
  // whenever a row matches. Conductivity needs the opposite: the water has to SURVIVE so it
  // can keep carrying the charge to the next creature standing in it. The mechanic therefore
  // lives in CONDUCTIVITY_RULES below, which adds a charge instead of consuming a state.

};

/**
 * Maps standard 5e status condition names to their corresponding elemental state tags.
 * Used to ensure applying a status like "Burning" also updates the underlying chemistry engine.
 */
export const ConditionToStateTag: Record<string, StateTag> = {
  burning: StateTag.Burning,
  ignited: StateTag.Burning,
  frozen: StateTag.Frozen,
  poisoned: StateTag.Poisoned,
  wet: StateTag.Wet,
  drenched: StateTag.Wet,
  oiled: StateTag.Oiled,
  electrified: StateTag.Electrified,
  chilled: StateTag.Cold,
  webbed: StateTag.Webbed,
};

/**
 * Maps a combat damage type to the elemental StateTag it applies on contact.
 *
 * Keys are lowercase damage types so callers can pass raw spell/weapon damage
 * types directly. Only damage types with a clear elemental meaning are mapped;
 * physical and metaphysical types (bludgeoning, force, psychic, radiant, etc.)
 * have no elemental state and are intentionally absent.
 */
export const DamageTypeToStateTag: Record<string, StateTag> = {
  fire: StateTag.Burning,
  cold: StateTag.Cold,
  lightning: StateTag.Electrified,
  poison: StateTag.Poisoned,
  acid: StateTag.Acid,
};

/**
 * Resolves the elemental StateTag for a damage type, or undefined when the
 * damage type does not map to an elemental state. Case-insensitive.
 */
export function getStateTagForDamageType(damageType: string): StateTag | undefined {
  return DamageTypeToStateTag[damageType.toLowerCase()];
}

// -----------------------------------------------------------------------------
// CONDUCTIVITY (agora-2fb1)
// -----------------------------------------------------------------------------

/**
 * ConductivityRule — how a charge spreads through a conducting medium.
 *
 * WHAT THIS MODELS: lightning that lands in standing water does not stop at the creature it
 * hit. The water carries it outward, weaker at every step, until it runs out. That is one
 * mechanic with four knobs, and they are declared together here so balance is a single edit
 * rather than a hunt through the resolver.
 *
 * WHY IT IS NOT IN StateInteractions: that table maps a PAIR of states to the ONE state they
 * become, and its resolver deletes the state that reacted. A conductivity row there would wash
 * the Wet tag off the first creature hit, so the second creature in the same puddle would be
 * dry and the propagation would die at range one.
 */
export interface ConductivityRule {
  /** The state a creature or tile must carry to pass the charge along. */
  conductor: StateTag;
  /** The state the charge applies to everything it reaches. */
  charge: StateTag;
  /** How far one step of the charge reaches, in feet. */
  hopRangeFeet: number;
  /**
   * Share of the strike's damage that survives each step. Applied per hop, so hop 2 of a 0.5
   * rule carries a quarter.
   */
  damageFractionPerHop: number;
  /** Steps the charge can take before it dies. */
  maxHops: number;
}

/**
 * CONDUCTIVITY_RULES — the conducting media, keyed like StateInteractions.
 *
 * Keys are the same alphabetically sorted "state+state" form the interaction table uses, so a
 * caller that already built a key for one table can reuse it against the other.
 *
 * WHERE THE NUMBERS COME FROM, so a later reader can argue with them instead of guessing:
 *   hopRangeFeet 5        one grid square. Conduction is contact through the puddle, so the
 *                         charge reaches whatever is touching the square it is already in.
 *   damageFractionPerHop  half, matching the share 5e hands a creature that makes its save
 *     0.5                 against a damaging effect. Halving also ends the chain on its own.
 *   maxHops 3             the number of extra creatures Chain Lightning leaps to at base level.
 *
 * These are balance values, not physics. Change them here and every consumer follows.
 */
export const CONDUCTIVITY_RULES: Record<string, ConductivityRule> = {
  'electrified+wet': {
    conductor: StateTag.Wet,
    charge: StateTag.Electrified,
    hopRangeFeet: 5,
    damageFractionPerHop: 0.5,
    maxHops: 3,
  },
};

/**
 * getConductivityRule — looks up the rule for a pair of states, in either order.
 *
 * Returns undefined when the pair does not conduct, which callers must treat as "this strike
 * affects only what it hit" rather than as an error.
 */
export function getConductivityRule(
  first: StateTag,
  second: StateTag,
): ConductivityRule | undefined {
  return CONDUCTIVITY_RULES[[first, second].sort().join('+')];
}

/**
 * getConductivityRuleForDamageType — the entry point a damage pipeline actually has enough
 * information to call.
 *
 * A damage event knows its damage type and the conducting state already on the ground or on
 * the creature. This resolves the damage type to its state tag and asks whether that pair
 * conducts, so no caller has to know that lightning is the charge and water is the conductor.
 */
export function getConductivityRuleForDamageType(
  damageType: string,
  conductor: StateTag,
): ConductivityRule | undefined {
  const charge = getStateTagForDamageType(damageType);
  if (!charge) return undefined;
  return getConductivityRule(charge, conductor);
}

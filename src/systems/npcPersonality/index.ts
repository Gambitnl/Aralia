/**
 * @file src/systems/npcPersonality/index.ts
 * Public surface of the NPC personality system (board task agora-d9e1), plus the
 * one composition function that turns NPC context into a finished personality.
 *
 * Callers should import from here rather than from the individual modules, so the
 * internal split (types / table / generator / effects) can move without churning
 * call sites.
 */

import { resolveArchetype } from './archetypeTable.js';
import { generateQuirks, generateTraits } from './quirkGenerator.js';
import type { NPCPersonality } from './types.js';

export type { Archetype, NPCPersonality, TraitMap } from './types.js';
export { ARCHETYPES, ARCHETYPE_BASE_TRAITS, TRAIT_KEYS, TRAIT_MAX, TRAIT_MIN, clampTrait } from './types.js';

export type { ArchetypeLookup, ArchetypeRule, PersonalityBiome } from './archetypeTable.js';
export {
  ARCHETYPE_TABLE,
  ARCHETYPE_TABLE_COMBINATIONS,
  DEFAULT_ARCHETYPE,
  normalizePersonalityBiome,
  normalizePersonalityRole,
  resolveArchetype,
} from './archetypeTable.js';

export type { QuirkGenerationInput } from './quirkGenerator.js';
export { MAX_QUIRKS, MIN_QUIRKS, QUIRK_POOLS, TRAIT_JITTER, generateQuirks, generateTraits } from './quirkGenerator.js';

export type { ActionValence } from './personalityEffects.js';
export {
  ACTION_VALENCE,
  ARCHETYPE_TONES,
  DEFAULT_TONE,
  MAX_DISPOSITION_MODIFIER,
  MIN_DISPOSITION_MODIFIER,
  applyDispositionModifier,
  combatAggression,
  composeCombatAggression,
  describePersonality,
  dialogueTone,
  dispositionModifier,
  fleeHealthThreshold,
} from './personalityEffects.js';

/**
 * Everything {@link generatePersonality} needs. Every field is optional: the
 * archetype table always resolves, and the generator always produces quirks.
 */
export interface PersonalityGenerationInput {
  /** Functional NPC role, as on `NPC['role']`. */
  role?: string;
  /** Specific occupation ("Blacksmith"). Outranks `role` when recognized. */
  occupation?: string;
  /** Free-form biome id, biome family, or settlement tag. */
  biomeId?: string;
  /** World seed, so the same NPC in the same world always rolls the same. */
  worldSeed?: number;
  /** Per-NPC identity — the NPC id, or its name as a fallback. */
  identity?: string;
  /**
   * Force an archetype, skipping the table. For authored/unique NPCs and for
   * tests that need one specific archetype's behavior.
   */
  archetype?: NPCPersonality['archetype'];
}

/**
 * Builds a complete personality for an NPC.
 *
 * Deterministic in `worldSeed` + `identity` + archetype, matching the rule the
 * background brief established for this layer: an NPC rebuilt from a save reads
 * identically.
 */
export function generatePersonality(input: PersonalityGenerationInput = {}): NPCPersonality {
  const archetype =
    input.archetype ??
    resolveArchetype({ role: input.role, occupation: input.occupation, biomeId: input.biomeId });

  const rollInput = {
    archetype,
    worldSeed: input.worldSeed,
    identity: input.identity,
  };

  return {
    archetype,
    quirks: generateQuirks(rollInput),
    traits: generateTraits(rollInput),
  };
}

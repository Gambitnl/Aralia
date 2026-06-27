// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 03:46:37
 * Dependents: systems/spells/validation/spellValidator.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { z } from 'zod';

/**
 * This file validates illusion and sensory-manifestation spell metadata.
 *
 * Illusion spells often carry mechanical limits inside descriptive prose, such
 * as what senses an image cannot create or how a creature can discern the trick.
 * This schema keeps those facts structured while leaving open-ended appearance
 * choices to spell descriptions or AI arbitration where needed.
 *
 * Called by: `spellValidator.ts`.
 * Depends on: Zod only; it does not load spell data or runtime systems.
 */

// ============================================================================
// Shared Vocabularies
// ============================================================================
// These enums intentionally start with the Minor Illusion slice. Future illusion
// batches can add values here as new canonical mechanics are reviewed.
// ============================================================================

const SensoryChannel = z.enum(["sight", "sound", "light", "smell", "other_sensory_effect"]);

const SensoryManifestationSize = z.object({
  shape: z.enum(["Cube", "Sphere", "Line", "Cone", "Cylinder", "not_applicable"]),
  size: z.union([z.number(), z.literal("not_applicable")]),
  unit: z.enum(["feet", "not_applicable"]),
});

// ============================================================================
// Sensory Manifestation
// ============================================================================
// A sensory manifestation says what the spell can generate and what it explicitly
// cannot generate. This is rules data, not flavor text.
// ============================================================================

const SensoryManifestationVariant = z.object({
  label: z.string(),
  allowedSenses: z.array(SensoryChannel),
  excludedSenses: z.array(SensoryChannel),
  volumeRange: z.enum(["whisper_to_scream", "not_applicable"]).optional(),
  timing: z.enum([
    "continuous",
    "discrete_before_spell_end",
    "continuous_or_discrete_before_spell_end",
    "not_applicable",
  ]).optional(),
  maxSize: SensoryManifestationSize.optional(),
  notes: z.string().optional(),
});

export const SensoryManifestation = z.object({
  modeSource: z.enum(["modeChoice.options", "effect", "not_applicable"]),
  variants: z.array(SensoryManifestationVariant),
  notes: z.string().optional(),
});

// ============================================================================
// Illusion Reveal Rules
// ============================================================================
// Reveal rules tell the runtime whether the illusion ends, becomes known only to
// one creature, or remains present but visually/sensorily degraded for that one
// observer.
// ============================================================================

const IllusionRevealRule = z.object({
  method: z.enum(["study_action", "physical_interaction"]),
  actionCost: z.enum(["action", "not_applicable"]).optional(),
  ability: z.enum(["Intelligence", "not_applicable"]).optional(),
  skill: z.enum(["Investigation", "not_applicable"]).optional(),
  dc: z.enum(["spell_save_dc", "not_applicable"]).optional(),
  appliesTo: z.array(z.string()),
  notes: z.string().optional(),
});

export const IllusionMetadata = z.object({
  revealScope: z.enum(["per_creature", "global", "not_applicable"]),
  revealRules: z.array(IllusionRevealRule),
  discernedState: z.enum([
    "faint_to_discerning_creature",
    "transparent_to_discerning_creature",
    "not_applicable",
  ]),
  // Phantasmal Force is target-private: the target treats the false object,
  // creature, or phenomenon as real and can even suffer psychic harm from a
  // dangerous phantasm. This nested block keeps those belief and hazard rules
  // reusable for future phantasm-style illusions.
  phantasmalInteraction: z.object({
    perceivedOnlyByTarget: z.boolean(),
    targetTreatsAsReal: z.boolean(),
    rationalizesIllogicalOutcomes: z.boolean(),
    phenomenonOptions: z.array(z.string()),
    hazardousPhantasm: z.object({
      damageDice: z.string(),
      damageType: z.string(),
      perceivedDamageTypeSource: z.enum(["appropriate_to_illusion", "fixed"]),
      damageTiming: z.enum(["each_caster_turn", "not_applicable"]),
      damageAreaCondition: z.enum(["in_area_or_within_proximity", "not_applicable"]),
      proximityFeet: z.number(),
    }).optional(),
  }).optional(),
  // Mirage Arcane is an area-scale illusion that can change how terrain and
  // structures look, sound, smell, and feel while still interacting physically.
  // This block lets terrain/UI systems distinguish that from a small image or
  // a target-private phantasm.
  terrainIllusion: z.object({
    areaShape: z.enum(["Square", "Circle", "not_applicable"]),
    areaSize: z.union([z.number(), z.literal("not_applicable")]),
    areaUnit: z.enum(["feet", "miles", "not_applicable"]),
    sensoryElements: z.array(SensoryChannel),
    terrainAppearanceOptions: z.array(z.string()),
    canAlterStructures: z.boolean(),
    canAddStructures: z.boolean(),
    cannotDisguiseConcealOrAddCreatures: z.boolean(),
    canChangeDifficultTerrain: z.boolean(),
    canOtherwiseImpedeMovement: z.boolean(),
    removedPiecesDisappearImmediately: z.boolean(),
    truesightRevealsTrueTerrain: z.boolean(),
    truesightStillPhysicallyInteracts: z.boolean(),
  }).optional(),
  notes: z.string().optional(),
});

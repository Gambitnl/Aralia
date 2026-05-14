// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 03:46:37
 * Dependents: types/spells.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file describes illusion and sensory-manifestation spell metadata.
 *
 * It exists because illusion prose often hides runtime mechanics: which senses a
 * manifestation can affect, which senses it explicitly cannot affect, how it can
 * be examined, and what changes after a creature discerns the illusion. Keeping
 * those contracts here lets spell data expose those rules without turning every
 * illusion into unstructured description text.
 *
 * Called by: `spells.ts` for the public spell contract.
 * Depends on: no other type modules, so this split prevents `spells.ts` from
 * growing another broad mechanics family.
 */

// ============================================================================
// Sensory Manifestation
// ============================================================================
// These types record what a visible, audible, or otherwise sensory spell
// manifestation can and cannot create. They are not general flavor: these fields
// exist for rules-facing limits such as "image cannot create sound or smell."
// ============================================================================

/** A sense or sensory channel named by illusion-style spell prose. */
export type SensoryChannel = "sight" | "sound" | "light" | "smell" | "other_sensory_effect";

/** Size limit for a sensory manifestation such as an illusory object image. */
export interface SensoryManifestationSize {
  /** Canonical area shape used for the manifestation's maximum size. */
  shape: "Cube" | "Sphere" | "Line" | "Cone" | "Cylinder" | "not_applicable";
  /** Numeric size in the paired unit, or a sentinel when the prose has no limit. */
  size: number | "not_applicable";
  /** Unit for the size value. */
  unit: "feet" | "not_applicable";
}

/** One selectable sensory variant, usually linked to a modeChoice option. */
export interface SensoryManifestationVariant {
  /** Label matching the canonical mode, such as Sound or Image. */
  label: string;
  /** Senses this variant is allowed to create. */
  allowedSenses: SensoryChannel[];
  /** Senses this variant explicitly cannot create. */
  excludedSenses: SensoryChannel[];
  /** Canonical volume band when the spell creates sound. */
  volumeRange?: "whisper_to_scream" | "not_applicable";
  /** Whether the sound is continuous, discrete, or can use both patterns. */
  timing?: "continuous" | "discrete_before_spell_end" | "continuous_or_discrete_before_spell_end" | "not_applicable";
  /** Size limit for image/object-style sensory variants. */
  maxSize?: SensoryManifestationSize;
  /** Short review note for examples or edge cases that do not need their own field yet. */
  notes?: string;
}

/** Top-level sensory-manifestation payload for an effect. */
export interface SensoryManifestation {
  /** Where the variant list comes from, usually the spell's modeChoice menu. */
  modeSource: "modeChoice.options" | "effect" | "not_applicable";
  /** Variants the caster can create or the spell can manifest. */
  variants: SensoryManifestationVariant[];
  /** Short review note for manifestation-wide facts. */
  notes?: string;
}

// ============================================================================
// Illusion Reveal Rules
// ============================================================================
// These types record how a creature can identify an illusion and what the
// illusion looks like after that creature succeeds. The runtime can later use
// this to separate "still present but faint to this creature" from ending.
// ============================================================================

/** One way a creature can reveal or discern an illusion. */
export interface IllusionRevealRule {
  /** Reveal method named by the prose. */
  method: "study_action" | "physical_interaction";
  /** Action cost when the reveal is an intentional examination. */
  actionCost?: "action" | "not_applicable";
  /** Ability used for the check, if there is one. */
  ability?: "Intelligence" | "not_applicable";
  /** Skill used for the check, if there is one. */
  skill?: "Investigation" | "not_applicable";
  /** DC source for the check, such as the caster's spell save DC. */
  dc?: "spell_save_dc" | "not_applicable";
  /** Which sensory variants this reveal method applies to. */
  appliesTo: string[];
  /** Short explanation of what the method represents in the canonical prose. */
  notes?: string;
}

/** Illusion metadata attached to the effect that creates or maintains it. */
export interface IllusionMetadata {
  /** Whether the illusion affects all observers the same way or tracks per creature. */
  revealScope: "per_creature" | "global" | "not_applicable";
  /** Structured reveal/discernment methods. */
  revealRules: IllusionRevealRule[];
  /** State applied only to creatures that have discerned the illusion. */
  discernedState: "faint_to_discerning_creature" | "transparent_to_discerning_creature" | "not_applicable";
  /** Short review note for illusion behavior that is not its own field yet. */
  notes?: string;
}

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 01:57:32
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
 * This file validates spell lifecycle rules.
 *
 * Cleanup is not an early-ending trigger. It records the state or spell-owned
 * object the runtime must remove after normal duration, concentration loss, or another already-modeled
 * ending event has happened. Conditional endings record events that cut a spell
 * or effect short. Sustain requirements record the later action cost needed to
 * keep a spell running. Keeping these lifecycle validators together prevents
 * `spellValidator.ts` from growing a new lifecycle section for every spell-
 * sourced upkeep or duration mechanic.
 *
 * Called by: `spellValidator.ts`.
 * Depends on: Zod only; it does not load spell data or runtime systems.
 */

// ============================================================================
// End Cleanup
// ============================================================================
// Heroism is the first explicit cleanup case: Temporary Hit Points granted by
// the spell are removed when the spell ends. Later cleanup rows also cover
// spell-created objects and spell-owned material containers. The source field
// prevents the runtime from stripping unrelated state from another spell.
// ============================================================================

export const EffectEndCleanup = z.object({
  trigger: z.enum(["spell_ends", "effect_ends", "item_effect_ends", "not_applicable"]),
  removes: z.enum(["temporary_hit_points", "spell_granted_flying_speed", "extradimensional_space", "created_ammunition", "spell_material_container", "not_applicable"]),
  source: z.enum(["this_spell", "this_effect", "not_applicable"]),
  scope: z.enum(["target", "caster", "affected_creatures", "contents", "created_objects", "spell_component", "not_applicable"]),
  amount: z.enum(["all_remaining", "not_applicable"]),
  consequence: z.enum(["fall_if_aloft", "contents_drop_out", "disintegrate", "destroy", "not_applicable"]).optional(),
  destination: z.enum(["space_exit_anchor", "not_applicable"]).optional(),
  preventedBy: z.enum(["can_prevent_fall", "not_applicable"]).optional(),
  notes: z.string().optional(),
});

// ============================================================================
// Conditional Endings
// ============================================================================
// These rules describe events that end a spell or effect before its ordinary
// duration finishes. The optional distance threshold supports leash-style rules
// such as a created entity ending when it gets too far from its caster.
// ============================================================================

// The corpus contains source-backed lifecycle labels that are more specific
// than the currently executable trigger vocabulary (for example `strong_wind`
// or `memory_change`). Keep those labels as normalized machine tokens so the
// validator preserves the evidence while the owning runtime lane decides when
// each event becomes executable. This avoids rejecting real spell data or
// silently collapsing a distinct source event into the wrong runtime trigger.
const SourceBackedLifecycleToken = z.string().regex(
  /^[a-z0-9]+(?:_[a-z0-9]+)*$/,
  "must be a lowercase snake_case lifecycle token"
);

export const ConditionalEnding = z.object({
  trigger: SourceBackedLifecycleToken,
  scope: SourceBackedLifecycleToken,
  distanceFeet: z.union([z.number(), z.literal("not_applicable")]).optional(),
  durationValue: z.union([z.number(), z.literal("not_applicable")]).optional(),
  durationUnit: z.enum(["round", "minute", "hour", "day", "not_applicable"]).optional(),
  description: z.string().optional(),
});

// ============================================================================
// Sustain Requirements
// ============================================================================
// Sustain requirements are upkeep costs after the initial casting. They pair
// with conditional endings when failure to pay that cost ends the spell or one
// effect before the normal duration expires.
// ============================================================================

export const SustainRequirement = z.object({
  timing: z.enum(["later_turns", "not_applicable"]),
  actor: z.enum(["caster", "target", "affected_creature", "not_applicable"]),
  actionKind: z.enum(["magic_action", "standard_action", "bonus_action", "reaction", "not_applicable"]),
  actionCost: z.enum(["action", "bonus_action", "reaction", "not_applicable"]),
  failureOutcome: z.enum(["spell_ends", "effect_ends", "not_applicable"]),
  notes: z.string().optional(),
});

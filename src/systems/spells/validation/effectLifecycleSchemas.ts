// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 13:41:18
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

export const ConditionalEnding = z.object({
  trigger: z.enum([
    "end_on_recast",
    "caster_leaves_area",
    "holder_releases_item",
    "caster_or_ally_damages_target",
    "caster_or_companion_harms_target",
    "target_takes_damage_or_witnesses_allies_damaged",
    "all_target_instances_expended",
    "temporary_hit_points_depleted",
    "target_drops_to_0_hp",
    "target_uses_magic_action_to_end_effect",
    "target_dons_armor",
    "target_lands",
    "target_makes_attack_roll",
    "target_casts_spell",
    "target_deals_damage",
    "carried_weight_exceeds_limit",
    "created_entity_drops_to_0_hp",
    "created_entity_takes_damage",
    "caster_drops_to_0_hp",
    "linked_creatures_separated_beyond_distance",
    "spell_cast_again_on_connected_creature",
    "target_outside_spell_range",
    "target_has_total_cover_from_caster",
    "strong_wind_disperses_effect",
    "initial_save_success",
    "repeat_save_success",
    "sustain_action_not_taken",
    "suggested_activity_completed",
    "already_on_destination_plane",
    "unsupported_area_collapses_next_turn",
    "certain_death_activity_requested",
    "drop_to_0_hp_prevented",
    "instant_death_no_damage_prevented",
    "on_attack_hit",
    "on_attack_hit_or_miss",
    "beyond_max_distance",
    "inscribed_ward_moved_beyond_distance",
    "ward_triggered",
    "triggered_duration_expires",
    "disintegrate_targets_effect",
    "no_creature_restrained_by_spell_after_trigger",
    "not_applicable"
  ]),
  scope: z.enum(["spell", "effect", "item", "area", "not_applicable"]),
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

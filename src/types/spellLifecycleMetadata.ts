// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 13:41:05
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
 * This file defines spell lifecycle metadata.
 *
 * Lifecycle cleanup is for effects that remove a spell-created or spell-owned
 * state when the spell, effect, or item expires normally. Sustain requirements are upkeep
 * rules that ask an actor to spend a later action to keep a spell running. Both
 * are kept here because they describe what happens around the ongoing lifetime
 * of a spell rather than the spell's first application.
 *
 * Called by: `spells.ts`.
 * Depends on: no runtime data; this is a type-only metadata module.
 */

// ============================================================================
// End Cleanup
// ============================================================================
// These rules describe what spell-sourced state should be cleared at the end of
// a spell or effect. They cover both created states, such as Heroism's Temporary
// Hit Points, and spell-owned objects, such as ammunition created by Swift
// Quiver or Magic Jar's material container.
// ============================================================================

/** Cleanup that happens when a spell, effect, or item reaches its end. */
export interface EffectEndCleanup {
  /** Event that causes the cleanup to run. */
  trigger: "spell_ends" | "effect_ends" | "item_effect_ends" | "not_applicable";
  /** What kind of spell-created or spell-owned state is removed. */
  removes:
    | "temporary_hit_points"
    | "spell_granted_flying_speed"
    | "extradimensional_space"
    | "created_ammunition"
    | "spell_material_container"
    | "not_applicable";
  /** Which source's state is eligible for cleanup. */
  source: "this_spell" | "this_effect" | "not_applicable";
  /** Who or what loses the state when cleanup runs. */
  scope: "target" | "caster" | "affected_creatures" | "contents" | "created_objects" | "spell_component" | "not_applicable";
  /** Whether cleanup removes all matching state or only a named remainder. */
  amount: "all_remaining" | "not_applicable";
  /** Immediate follow-up caused by cleanup, such as falling after flight ends. */
  consequence?: "fall_if_aloft" | "contents_drop_out" | "disintegrate" | "destroy" | "not_applicable";
  /** Where cleanup places moved contents when the prose gives a destination. */
  destination?: "space_exit_anchor" | "not_applicable";
  /** What can prevent the cleanup consequence from applying. */
  preventedBy?: "can_prevent_fall" | "not_applicable";
  /** Short note for review cases where source ownership matters. */
  notes?: string;
}

// ============================================================================
// Conditional Endings
// ============================================================================
// These rules describe early-ending events that interrupt the ordinary duration
// of a spell, item effect, area, or single target effect. Keeping them with the
// lifecycle metadata prevents the main spell type file from carrying every
// duration-adjacent vocabulary list directly.
// ============================================================================

/** Rules that end a spell or effect before its ordinary duration expires. */
export interface ConditionalEnding {
  /**
   * Source-backed lowercase snake_case event label. Known executable labels
   * remain stable, while more specific labels stay available until their
   * owning runtime lane defines a trigger adapter.
   */
  trigger: string;
  /** Source-backed lowercase snake_case surface label. */
  scope: string;
  /** Distance threshold for range- or leash-based endings, when canonical prose gives one. */
  distanceFeet?: number | "not_applicable";
  /** Duration that runs after a trigger before the spell or effect ends. */
  durationValue?: number | "not_applicable";
  /** Unit for the post-trigger duration value, when that duration exists. */
  durationUnit?: "round" | "minute" | "hour" | "day" | "not_applicable";
  /** Human-readable explanation for review and runtime arbitration. */
  description?: string;
}

// ============================================================================
// Sustain Requirements
// ============================================================================
// These rules describe action costs that must be paid after the initial casting
// to keep a spell or effect active. Crown of Madness is the pilot case: the
// caster must spend later Magic actions or the spell ends.
// ============================================================================

/** Ongoing action requirement that keeps a spell or effect active. */
export interface SustainRequirement {
  /** When the upkeep check applies relative to the initial casting turn. */
  timing: "later_turns" | "not_applicable";
  /** Who must pay the upkeep cost. */
  actor: "caster" | "target" | "affected_creature" | "not_applicable";
  /** The rules-facing action category named by canonical prose. */
  actionKind: "magic_action" | "standard_action" | "bonus_action" | "reaction" | "not_applicable";
  /** The action-economy slot the upkeep consumes. */
  actionCost: "action" | "bonus_action" | "reaction" | "not_applicable";
  /** What happens if the upkeep action is not paid. */
  failureOutcome: "spell_ends" | "effect_ends" | "not_applicable";
  /** Human-readable detail for timing or action wording that needs review. */
  notes?: string;
}

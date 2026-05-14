// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 04:20:32
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
 * This file describes spell mechanics that control falling.
 *
 * Feather Fall is the first spell that needs this shape: it slows a creature's
 * descent, prevents fall damage on landing, and ends that falling-control
 * effect for a creature once that creature lands. Keeping this data in a small
 * type file prevents the main spell type registry from absorbing every niche
 * movement rule directly.
 *
 * Called by: `spells.ts`.
 * Depends on: no runtime systems; this file only exports TypeScript types.
 */

// ============================================================================
// Fall Control Metadata
// ============================================================================
// This section records falling-specific rules. These are not ordinary walking
// speed modifiers or forced movement effects, so they get their own small shape.
// ============================================================================

export interface FallControl {
  /** How fast the affected creature falls while the spell controls its descent. */
  descentRate: number | "not_applicable";
  /** Unit for the descent rate; currently Feather Fall uses feet per round. */
  descentRateUnit: "feet_per_round" | "not_applicable";
  /** Whether fall damage is prevented when the affected creature lands. */
  fallDamageOnLanding: "prevented" | "normal" | "not_applicable";
  /** Optional ending trigger for spells that stop affecting one target on landing. */
  endingTrigger?: "target_lands" | "not_applicable";
  /** Optional scope for the landing ending; Feather Fall ends only that target's effect. */
  endingScope?: "effect" | "spell" | "not_applicable";
}

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 10:29:35
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
 * This file describes spell rules that change how long a spell-created effect lasts.
 *
 * Some spells do not simply last for their printed duration. Recasting them on
 * the same target or location can make them last until dispelled, become
 * permanent, or extend the current instance. Wall of Stone has a related rule:
 * maintaining concentration for the full duration makes the created wall
 * permanent. These rules live here so the main spell type file does not absorb
 * every duration-progress variant directly.
 *
 * Called by: `spells.ts`.
 * Depends on: no runtime systems; this file only exports TypeScript types.
 */

// ============================================================================
// Duration Progression
// ============================================================================
// These rules capture duration changes that happen after repeated casting,
// recasting while an effect is active, or completing concentration for the full
// listed duration.
// ============================================================================

/** A duration extension amount for recast-maintenance rules. */
export interface DurationProgressionExtension {
  /** Numeric amount of duration added by the progression rule. */
  value: number | "not_applicable";
  /** Unit for the duration extension. */
  unit: "hour" | "day" | "not_applicable";
}

/** A rule that changes a spell's duration or permanence after a condition is met. */
export interface DurationProgression {
  /** Event or pattern that advances the duration rule. */
  trigger: "repeated_casts" | "recast_while_active" | "full_duration_concentration" | "not_applicable";
  /** Number of casts required when repeated casting is the trigger. */
  requiredCasts: number | "not_applicable";
  /** Cadence required between repeated casts. */
  cadence: "daily" | "not_applicable";
  /** Whether the repeated cast must be on the exact same target. */
  sameTargetRequired: boolean | "not_applicable";
  /** Whether the repeated cast must be on the exact same location or spot. */
  sameLocationRequired: boolean | "not_applicable";
  /** Whether the repeated cast must use the same configuration, layout, or options. */
  sameConfigurationRequired: boolean | "not_applicable";
  /** Whether the caster must maintain concentration through the full printed duration. */
  requiresFullConcentration: boolean | "not_applicable";
  /** Optional duration extension for recast-maintenance rules. */
  extension?: DurationProgressionExtension;
  /** Resulting duration state once the progression condition is met. */
  outcomeDuration: "extend_current_duration" | "until_dispelled" | "permanent" | "non_dispellable_permanent" | "not_applicable";
  /** Whether the resulting state can still be dispelled. */
  dispellable: boolean | "not_applicable";
  /** Human-readable note for review cases where the rule has compact special wording. */
  notes?: string;
}

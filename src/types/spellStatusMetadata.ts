// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 04:28:53
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
 * This file describes status-condition metadata shared by spell effects.
 *
 * Some conditions end before their normal duration because a specific event
 * happens. Sleep is the pilot case: damage or an adjacent creature spending an
 * action to shake the target awake ends that target's condition. Keeping the
 * trigger vocabulary here prevents the large spell type registry from owning
 * every condition-break detail directly.
 *
 * Called by: `spells.ts`.
 * Depends on: no runtime systems; this file only exports TypeScript types.
 */

// ============================================================================
// Condition Break Triggers
// ============================================================================
// These values describe events that end a status condition early without being
// ordinary duration expiry or a repeat saving throw.
// ============================================================================

export type ConditionBreakTrigger =
  | "target_takes_damage"
  | "adjacent_creature_action_shakes_awake"
  | "caster_makes_attack_roll"
  | "caster_deals_damage"
  | "caster_forces_save"
  | "concentration_ends"
  | "duration_expires";

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 04:28:53
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
 * This file validates reusable status-condition vocabulary for spell effects.
 *
 * The full status condition object still lives in `spellValidator.ts` because
 * it depends on effect-duration, escape-check, and repeat-save schemas defined
 * there. This module owns the shared break-trigger enum so new condition-break
 * mechanics do not keep expanding the main validator directly.
 *
 * Called by: `spellValidator.ts`.
 * Depends on: Zod only.
 */

// ============================================================================
// Condition Break Triggers
// ============================================================================
// These are early condition-ending events. They are distinct from repeat saves
// because no saving throw is made when the event happens.
// ============================================================================

export const ConditionBreakTrigger = z.enum([
  "target_takes_damage",
  "adjacent_creature_action_shakes_awake",
  "caster_makes_attack_roll",
  "caster_deals_damage",
  "caster_forces_save",
  "concentration_ends",
  "duration_expires"
]);

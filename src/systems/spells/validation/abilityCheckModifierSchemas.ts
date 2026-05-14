// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 03:15:24
 * Dependents: systems/spells/validation/spellValidator.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file validates spell-created ability check modifiers.
 *
 * It exists so Guidance-like mechanics can say which check family is modified,
 * what bonus applies, whether a skill choice gates the bonus, and how often the
 * bonus can be used while the spell is active.
 *
 * Called by: `spellValidator.ts` when validating utility effects.
 * Depends on: only Zod, keeping this check-modifier slice independent.
 */

import { z } from 'zod';

// ============================================================================
// Ability Check Modifier Schema
// ============================================================================
// This schema keeps skill choice separate from ordinary target choice. For
// Guidance, the caster chooses a skill and the target adds 1d4 to ability checks
// using that chosen skill while the spell lasts.
// ============================================================================

export const AbilityCheckModifier = z.object({
  appliesTo: z.enum(["ability_check"]),
  bonusDice: z.string().optional(),
  flatModifier: z.number().optional(),
  skillSelection: z.enum(["chosen_skill", "not_applicable"]),
  skillChooser: z.enum(["caster"]).optional(),
  skillPool: z.enum(["any_skill"]).optional(),
  frequency: z.enum(["every_matching_check", "once"]),
  durationScope: z.enum(["while_active", "next_check"]),
  notes: z.string().optional(),
});

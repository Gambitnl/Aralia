// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 02:15:11
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
 * This file validates relationships between one spell effect and a later target
 * or damage event.
 *
 * It exists because the main spell validator is a shared gate for every runtime
 * spell JSON file. Secondary and chained target mechanics are a distinct concern,
 * so keeping them here prevents the core validator from growing each time a new
 * follow-up-target bucket is closed.
 *
 * Called by: `spellValidator.ts`.
 * Depends on: Zod only; it does not load spell data or runtime systems.
 */

// ============================================================================
// Secondary And Chained Targeting
// ============================================================================
// This section validates effect-local target relationships such as Green-Flame
// Blade's nearby secondary creature and Chromatic Orb's duplicate-dice chain.
// These rules are not top-level spell targets: they only exist after another
// target or damage roll unlocks them.
// ============================================================================

export const SecondaryTargeting = z.object({
  // The trigger tells the runtime why a follow-up target is being chosen.
  trigger: z.enum(["primary_hit", "duplicate_damage_die"]),
  // The origin tells the runtime where the follow-up range is measured from.
  origin: z.enum(["primary_target", "previous_target"]),
  range: z.number(),
  rangeUnit: z.enum(["feet", "miles", "inches"]),
  validTargets: z.enum(["creature", "creature_or_object"]),
  selection: z.enum(["caster_choice"]),
  mustBeDifferent: z.boolean(),
  requiresLineOfSight: z.boolean(),
  requiresAttackRoll: z.boolean(),
  requiresDamageRoll: z.boolean(),
  repeatRule: z.enum(["none", "slot_level_max_leaps"]).optional(),
  maxLeaps: z.union([z.number(), z.literal("slot_level")]).optional(),
  uniquePerCasting: z.boolean().optional(),
  notes: z.string().optional(),
});

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 10:29:53
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
 * This file validates duration-progression rules.
 *
 * Duration progression is different from ordinary `duration` because it records
 * how later play can change that duration: repeated daily casting, recasting
 * while a structure is active, or maintaining concentration for the full listed
 * time. Keeping this validator separate prevents `spellValidator.ts` from
 * growing every new permanence or recast-maintenance rule directly.
 *
 * Called by: `spellValidator.ts`.
 * Depends on: Zod only; it does not load spell data or runtime systems.
 */

// ============================================================================
// Duration Progression
// ============================================================================
// These schemas mirror `spellDurationMetadata.ts` and keep repeated-cast
// permanence data machine-readable instead of leaving it in spell descriptions.
// ============================================================================

export const DurationProgressionExtension = z.object({
  value: z.union([z.number(), z.literal("not_applicable")]),
  unit: z.enum(["hour", "day", "not_applicable"]),
});

export const DurationProgression = z.object({
  trigger: z.enum(["repeated_casts", "recast_while_active", "full_duration_concentration", "not_applicable"]),
  requiredCasts: z.union([z.number(), z.literal("not_applicable")]),
  cadence: z.enum(["daily", "not_applicable"]),
  sameTargetRequired: z.union([z.boolean(), z.literal("not_applicable")]),
  sameLocationRequired: z.union([z.boolean(), z.literal("not_applicable")]),
  sameConfigurationRequired: z.union([z.boolean(), z.literal("not_applicable")]),
  requiresFullConcentration: z.union([z.boolean(), z.literal("not_applicable")]),
  extension: DurationProgressionExtension.optional(),
  outcomeDuration: z.enum(["extend_current_duration", "until_dispelled", "permanent", "non_dispellable_permanent", "not_applicable"]),
  dispellable: z.union([z.boolean(), z.literal("not_applicable")]),
  notes: z.string().optional(),
});

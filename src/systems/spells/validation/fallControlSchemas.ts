// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 04:20:32
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
 * This file validates falling-control spell metadata.
 *
 * Falling rules have their own timing and damage consequences, so they should
 * not be flattened into ordinary speed, forced movement, or generic utility
 * prose. Feather Fall is the pilot spell for this schema.
 *
 * Called by: `spellValidator.ts`.
 * Depends on: Zod only.
 */

// ============================================================================
// Fall Control
// ============================================================================
// This schema captures descent speed, landing damage prevention, and whether
// landing ends the effect for the affected target.
// ============================================================================

export const FallControl = z.object({
  descentRate: z.union([z.number(), z.literal("not_applicable")]),
  descentRateUnit: z.enum(["feet_per_round", "not_applicable"]),
  fallDamageOnLanding: z.enum(["prevented", "normal", "not_applicable"]),
  endingTrigger: z.enum(["target_lands", "not_applicable"]).optional(),
  endingScope: z.enum(["effect", "spell", "not_applicable"]).optional(),
});

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

// The source corpus includes both normalized Guidance-style fields and richer
// spell-specific labels such as chosen_ability, fixed_skills, and advantage.
// Preserve those labels here so validation does not discard a real mechanic;
// the shared check runtime narrows the values it can execute.
const SourceBackedAbilityCheckLabel = z.string().trim().min(1);

const StructuredAbilityCheckModifier = z.object({
  appliesTo: SourceBackedAbilityCheckLabel,
  bonusDice: z.string().optional(),
  flatModifier: z.union([z.number(), SourceBackedAbilityCheckLabel]).optional(),
  skillSelection: SourceBackedAbilityCheckLabel,
  skillChooser: SourceBackedAbilityCheckLabel.optional(),
  skillPool: z.union([
    SourceBackedAbilityCheckLabel,
    z.array(SourceBackedAbilityCheckLabel),
  ]).optional(),
  frequency: SourceBackedAbilityCheckLabel,
  durationScope: SourceBackedAbilityCheckLabel,
  notes: z.string().optional(),
});

// Some authored spells use this field as a source-backed ability-check
// metadata envelope rather than the executable status-rider shape above. Keep
// those records intact while their dedicated runtime lanes are still pending;
// an empty object is rejected so the field cannot become a silent junk bucket.
const SourceBackedAbilityCheckMetadata = z.object({}).passthrough().refine(
  value => Object.keys(value).length > 0,
  { message: "ability-check metadata must contain at least one source-backed field" },
);

export const AbilityCheckModifier = z.union([
  StructuredAbilityCheckModifier,
  SourceBackedAbilityCheckMetadata,
]);

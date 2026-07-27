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
export declare const AbilityCheckModifier: z.ZodUnion<readonly [z.ZodObject<{
    appliesTo: z.ZodString;
    bonusDice: z.ZodOptional<z.ZodString>;
    flatModifier: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
    skillSelection: z.ZodString;
    skillChooser: z.ZodOptional<z.ZodString>;
    skillPool: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    frequency: z.ZodString;
    durationScope: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{}, z.core.$loose>]>;

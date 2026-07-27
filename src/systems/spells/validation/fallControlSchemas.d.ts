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
export declare const FallControl: z.ZodObject<{
    descentRate: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
    descentRateUnit: z.ZodEnum<{
        not_applicable: "not_applicable";
        feet_per_round: "feet_per_round";
    }>;
    fallDamageOnLanding: z.ZodEnum<{
        not_applicable: "not_applicable";
        prevented: "prevented";
        normal: "normal";
    }>;
    endingTrigger: z.ZodOptional<z.ZodEnum<{
        not_applicable: "not_applicable";
        target_lands: "target_lands";
    }>>;
    endingScope: z.ZodOptional<z.ZodEnum<{
        spell: "spell";
        effect: "effect";
        not_applicable: "not_applicable";
    }>>;
}, z.core.$strip>;

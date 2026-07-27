/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/06/2026, 12:11:49
 * Dependents: systems/spells/validation/spellValidator.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { z } from 'zod';
export declare const ModeChoice: z.ZodObject<{
    type: z.ZodString;
    timing: z.ZodString;
    optionCount: z.ZodNumber;
    optionsSource: z.ZodString;
    maxActiveNonInstantaneous: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>>;
    canDismissActive: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>>;
    options: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        summary: z.ZodString;
        effectIndices: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        controlOptionIndices: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        effectTypes: z.ZodOptional<z.ZodArray<z.ZodString>>;
        duration: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;

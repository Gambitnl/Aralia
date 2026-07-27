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
export declare const DurationProgressionExtension: z.ZodObject<{
    value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
    unit: z.ZodEnum<{
        not_applicable: "not_applicable";
        hour: "hour";
        day: "day";
    }>;
}, z.core.$strip>;
export declare const DurationProgression: z.ZodObject<{
    trigger: z.ZodEnum<{
        not_applicable: "not_applicable";
        repeated_casts: "repeated_casts";
        recast_while_active: "recast_while_active";
        full_duration_concentration: "full_duration_concentration";
    }>;
    requiredCasts: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
    cadence: z.ZodEnum<{
        not_applicable: "not_applicable";
        daily: "daily";
    }>;
    sameTargetRequired: z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>;
    sameLocationRequired: z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>;
    sameConfigurationRequired: z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>;
    requiresFullConcentration: z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>;
    extension: z.ZodOptional<z.ZodObject<{
        value: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"not_applicable">]>;
        unit: z.ZodEnum<{
            not_applicable: "not_applicable";
            hour: "hour";
            day: "day";
        }>;
    }, z.core.$strip>>;
    outcomeDuration: z.ZodEnum<{
        not_applicable: "not_applicable";
        until_dispelled: "until_dispelled";
        permanent: "permanent";
        extend_current_duration: "extend_current_duration";
        non_dispellable_permanent: "non_dispellable_permanent";
    }>;
    dispellable: z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"not_applicable">]>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;

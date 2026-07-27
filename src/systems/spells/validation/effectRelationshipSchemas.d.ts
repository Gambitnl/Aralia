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
export declare const SecondaryTargeting: z.ZodObject<{
    trigger: z.ZodEnum<{
        primary_hit: "primary_hit";
        duplicate_damage_die: "duplicate_damage_die";
    }>;
    origin: z.ZodEnum<{
        primary_target: "primary_target";
        previous_target: "previous_target";
    }>;
    range: z.ZodNumber;
    rangeUnit: z.ZodEnum<{
        feet: "feet";
        miles: "miles";
        inches: "inches";
    }>;
    validTargets: z.ZodEnum<{
        creature: "creature";
        creature_or_object: "creature_or_object";
    }>;
    selection: z.ZodEnum<{
        caster_choice: "caster_choice";
    }>;
    mustBeDifferent: z.ZodBoolean;
    requiresLineOfSight: z.ZodBoolean;
    requiresAttackRoll: z.ZodBoolean;
    requiresDamageRoll: z.ZodBoolean;
    repeatRule: z.ZodOptional<z.ZodEnum<{
        none: "none";
        slot_level_max_leaps: "slot_level_max_leaps";
    }>>;
    maxLeaps: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"slot_level">]>>;
    uniquePerCasting: z.ZodOptional<z.ZodBoolean>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;

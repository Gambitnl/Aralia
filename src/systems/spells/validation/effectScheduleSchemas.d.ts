/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 02:35:30
 * Dependents: systems/spells/validation/spellValidator.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { z } from 'zod';
export declare const EffectSchedule: z.ZodObject<{
    timing: z.ZodEnum<{
        caster_later_turn_start: "caster_later_turn_start";
    }>;
    entries: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        timing: z.ZodEnum<{
            caster_turn_start: "caster_turn_start";
        }>;
        turnStart: z.ZodNumber;
        turnEnd: z.ZodOptional<z.ZodNumber>;
        effectIndices: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        effectTypes: z.ZodArray<z.ZodString>;
        targeting: z.ZodOptional<z.ZodObject<{
            count: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"all">]>;
            validTargets: z.ZodEnum<{
                creature_or_object: "creature_or_object";
                creatures: "creatures";
                objects: "objects";
            }>;
            selection: z.ZodEnum<{
                all_valid_targets: "all_valid_targets";
                caster_choice: "caster_choice";
            }>;
            mustBeDifferent: z.ZodOptional<z.ZodBoolean>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        summary: z.ZodString;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;

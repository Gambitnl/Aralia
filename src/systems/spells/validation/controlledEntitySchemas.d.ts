/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 03:32:21
 * Dependents: systems/spells/validation/spellValidator.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file validates spell-created controllable utility entities.
 *
 * It exists so Mage Hand-style helpers can expose their movement, actions,
 * carry limits, prohibited actions, and vanish triggers without being flattened
 * into a prose utility description.
 *
 * Called by: `spellValidator.ts` when validating utility effects.
 * Depends on: only Zod, keeping this entity slice independent.
 */
import { z } from 'zod';
export declare const ControlledEntity: z.ZodObject<{
    entityType: z.ZodOptional<z.ZodString>;
    count: z.ZodOptional<z.ZodNumber>;
    appearsAt: z.ZodOptional<z.ZodString>;
    durationScope: z.ZodOptional<z.ZodString>;
    controlActionType: z.ZodOptional<z.ZodString>;
    initialUseOnCast: z.ZodOptional<z.ZodBoolean>;
    laterControlTiming: z.ZodOptional<z.ZodString>;
    movementDistance: z.ZodOptional<z.ZodNumber>;
    movementUnit: z.ZodOptional<z.ZodString>;
    maxDistanceFromCaster: z.ZodOptional<z.ZodNumber>;
    canAttack: z.ZodOptional<z.ZodBoolean>;
    canActivateMagicItems: z.ZodOptional<z.ZodBoolean>;
    carryCapacityPounds: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
    allowedInteractions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    endingTriggers: z.ZodOptional<z.ZodArray<z.ZodString>>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;

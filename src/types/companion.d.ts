/**
 * @file src/types/companion.ts
 * Type definitions and Zod schemas related to procedurally generated companions.
 */
import { z } from 'zod';
export declare const CompanionSoulSchema: z.ZodObject<{
    name: z.ZodString;
    physicalDescription: z.ZodString;
    personality: z.ZodObject<{
        values: z.ZodArray<z.ZodString>;
        fears: z.ZodArray<z.ZodString>;
        quirks: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    goals: z.ZodArray<z.ZodObject<{
        description: z.ZodString;
        isSecret: z.ZodBoolean;
    }, z.core.$strip>>;
    reactionStyle: z.ZodString;
}, z.core.$strip>;
export type CompanionSoul = z.infer<typeof CompanionSoulSchema>;

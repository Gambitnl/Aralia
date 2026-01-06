/**
 * @file src/types/companion.ts
 * Type definitions and Zod schemas related to procedurally generated companions.
 */

import { z } from 'zod';

// Schema for a single goal (either public or secret)
const GoalSchema = z.object({
  description: z.string().min(10, "Goal description must be at least 10 characters."),
  isSecret: z.boolean(),
});

// Schema for the personality object
const PersonalitySchema = z.object({
  values: z.array(z.string().min(3)).min(2, "Must have at least 2 values."),
  fears: z.array(z.string().min(3)).min(1, "Must have at least 1 fear."),
  quirks: z.array(z.string().min(3)).min(1, "Must have at least 1 quirk."),
});

// The main schema for the AI's JSON output, representing the "soul"
export const CompanionSoulSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  physicalDescription: z.string().min(20, "Description must be at least 20 characters."),
  personality: PersonalitySchema,
  goals: z.array(GoalSchema).min(2, "Must have at least 2 goals (one public, one secret)."),
  reactionStyle: z.enum(["cynical", "hopeful", "aggressive", "religious", "pragmatic", "idealistic"]),
});

// Define a TypeScript type from the schema for easy use
export type CompanionSoul = z.infer<typeof CompanionSoulSchema>;

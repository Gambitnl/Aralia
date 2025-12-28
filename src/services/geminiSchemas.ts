import { z } from 'zod';

// --- Shared Schemas ---

// Simplified Item Schema for AI Generation
// We make many fields optional or allow defaults to be applied later
export const ItemSchema = z.object({
  id: z.string().optional(), // AI might not generate IDs, we can generate them
  name: z.string(),
  description: z.string(),
  cost: z.union([z.string(), z.number()]).optional().default("0 GP"),
  weight: z.number().optional().default(0),
  rarity: z.enum(['common', 'uncommon', 'rare', 'very_rare', 'legendary']).optional().default('common'),
  type: z.string().optional().default('misc'),
  // Add other fields as necessary based on ItemTemplates
  effects: z.array(z.any()).optional(), // Keeping effects loose for now as they are complex
});

export const EconomyStateSchema = z.object({
  scarcity: z.array(z.string()).default([]),
  surplus: z.array(z.string()).default([]),
  sentiment: z.string().optional(),
});

export const InventoryResponseSchema = z.object({
  inventory: z.array(ItemSchema),
  economy: EconomyStateSchema.optional(),
});

// --- Monster Schema ---

export const MonsterSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  cr: z.string(),
  description: z.string(),
});

// --- Custom Action Schema ---

export const CustomActionSchema = z.object({
  type: z.string().optional(), // e.g., 'ENTER_VILLAGE' or default to 'gemini_custom_action'
  label: z.string(),
  geminiPrompt: z.string().optional(),
  check: z.string().optional(),
  targetNpcId: z.string().optional(),
  eventResidue: z.object({
    text: z.string(),
    discoveryDc: z.number(),
  }).optional(),
  isEgregious: z.boolean().optional(),
});

// --- Social Outcome Schema ---

export const GoalUpdatePayloadSchema = z.object({
  npcId: z.string(),
  goalId: z.string(),
  newStatus: z.enum(['Unknown', 'Active', 'Completed', 'Failed']),
});

export const SocialOutcomeSchema = z.object({
  outcomeText: z.string(),
  dispositionChange: z.number().optional(),
  memoryFactText: z.string().optional(),
  goalUpdate: GoalUpdatePayloadSchema.nullable().optional(),
});

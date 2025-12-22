
import { z } from 'zod';

export const SimplifiedSpellEffectSchema = z.object({
  type: z.enum(['DAMAGE', 'HEALING', 'STATUS_CONDITION']),
  damage: z.object({
    dice: z.string(),
    type: z.string()
  }).optional(),
  healing: z.object({
    dice: z.string()
  }).optional(),
  statusCondition: z.object({
    name: z.string(),
    duration: z.object({
      type: z.literal('rounds'),
      value: z.number()
    })
  }).optional(),
  target: z.string().optional()
});

export const ArbitrationResultSchema = z.object({
  valid: z.boolean().optional(), // For Tier 2 validation
  allowed: z.boolean().optional(), // For Tier 3 adjudication
  reason: z.string().optional(),
  flavorText: z.string().optional(), // Tier 2 narrative
  narrativeOutcome: z.string().optional(), // Tier 3 narrative
  mechanicalEffects: z.array(SimplifiedSpellEffectSchema).optional(),
  stateChanges: z.record(z.any()).optional()
});

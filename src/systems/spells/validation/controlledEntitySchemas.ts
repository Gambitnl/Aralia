// @dependencies-start
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
// @dependencies-end

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

// ============================================================================
// Controlled Entity Schema
// ============================================================================
// This schema intentionally starts with Mage Hand's narrow helper model. Future
// controllable entities can add enum values here without changing unrelated
// utility effect validation.
// ============================================================================

export const ControlledEntity = z.object({
  entityType: z.enum(["spectral_hand"]),
  count: z.number(),
  appearsAt: z.enum(["chosen_point"]),
  durationScope: z.enum(["spell_duration"]),
  controlActionType: z.enum(["magic_action", "action"]),
  initialUseOnCast: z.boolean(),
  laterControlTiming: z.enum(["later_turns"]),
  movementDistance: z.number(),
  movementUnit: z.enum(["feet"]),
  maxDistanceFromCaster: z.number(),
  canAttack: z.boolean(),
  canActivateMagicItems: z.boolean(),
  carryCapacityPounds: z.union([z.number(), z.literal("not_applicable")]),
  allowedInteractions: z.array(z.string()),
  endingTriggers: z.array(z.enum(["caster_recasts", "beyond_max_distance"])),
  notes: z.string().optional(),
});

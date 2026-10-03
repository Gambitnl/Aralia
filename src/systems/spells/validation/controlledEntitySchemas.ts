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
// This schema started with Mage Hand's narrow helper model. Unseen Servant uses
// the same controlled-helper lane, but needs bonus-action commands and a
// hit-point ending trigger because it is a fragile invisible force.
// ============================================================================

// Controlled-entity rows range from executable Mage Hand packets to richer
// environment/emanation metadata. Keep source labels and optional fields
// lossless while the runtime adapters narrow only the fields they own.
const SourceBackedControlledEntityLabel = z.string().trim().min(1);
const StructuredControlledEntity = z.object({
  entityType: SourceBackedControlledEntityLabel.optional(),
  count: z.number().optional(),
  appearsAt: SourceBackedControlledEntityLabel.optional(),
  durationScope: SourceBackedControlledEntityLabel.optional(),
  controlActionType: SourceBackedControlledEntityLabel.optional(),
  initialUseOnCast: z.boolean().optional(),
  laterControlTiming: SourceBackedControlledEntityLabel.optional(),
  movementDistance: z.number().optional(),
  movementUnit: SourceBackedControlledEntityLabel.optional(),
  maxDistanceFromCaster: z.number().optional(),
  canAttack: z.boolean().optional(),
  canActivateMagicItems: z.boolean().optional(),
  carryCapacityPounds: z.union([z.number(), SourceBackedControlledEntityLabel]).optional(),
  allowedInteractions: z.array(SourceBackedControlledEntityLabel).optional(),
  endingTriggers: z.array(SourceBackedControlledEntityLabel).optional(),
  notes: z.string().optional(),
}).passthrough().refine(
  value => Object.keys(value).length > 0,
  { message: "controlled-entity metadata must contain at least one source-backed field" },
);

export const ControlledEntity = StructuredControlledEntity;

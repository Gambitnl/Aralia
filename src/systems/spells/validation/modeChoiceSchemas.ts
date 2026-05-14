// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 02:51:49
 * Dependents: systems/spells/validation/spellValidator.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { z } from 'zod';

/**
 * This file validates spell mode menus.
 *
 * Mode menus are different from ordinary target choice. A mode menu changes
 * which operation the spell performs, such as Druidcraft choosing Weather
 * Sensor, Bloom, Sensory Effect, or Fire Play. The actual mechanics can still
 * live in `effects[]` or `controlOptions[]`; this schema records the menu and
 * points at those existing payloads.
 *
 * Called by: `spellValidator.ts`.
 * Depends on: Zod only; it does not load spell data or runtime systems.
 */

// ============================================================================
// Mode Choice
// ============================================================================
// Each option records a label and summary, then optionally references effect or
// control-option indexes. This keeps mode discovery first-class without forcing
// every spell to duplicate the full effect payload in two places.
// ============================================================================

const ModeChoiceOption = z.object({
  label: z.string(),
  summary: z.string(),
  effectIndices: z.array(z.number()).optional(),
  controlOptionIndices: z.array(z.number()).optional(),
  effectTypes: z.array(z.string()).optional(),
  duration: z.string().optional(),
  notes: z.string().optional(),
});

export const ModeChoice = z.object({
  type: z.enum(["choose_one"]),
  timing: z.enum(["on_cast", "on_cast_or_later_action"]),
  optionCount: z.number(),
  optionsSource: z.enum(["modeChoice.options", "effects", "controlOptions", "mixed"]),
  maxActiveNonInstantaneous: z.union([z.number(), z.literal("not_applicable")]).optional(),
  canDismissActive: z.union([z.boolean(), z.literal("not_applicable")]).optional(),
  options: z.array(ModeChoiceOption),
  notes: z.string().optional(),
});

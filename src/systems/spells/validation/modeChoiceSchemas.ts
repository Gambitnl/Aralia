// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/06/2026, 12:11:49
 * Dependents: systems/spells/validation/spellValidator.ts, systems/spells/validation/SpellIntegrityValidator.ts
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

/**
 * Menu shapes whose `optionCount` is a selection budget instead of a menu size.
 *
 * `choose_one` resolves to a single entry, and `choose_one_per_target` resolves
 * to a single entry per affected target, so both keep `optionCount` equal to
 * the menu size. `choose_multiple` commits to several entries out of a larger
 * menu - Commune with Nature chooses 3 of its 5 information categories.
 */
export const MULTI_SELECT_MODE_CHOICE_TYPES: readonly string[] = ['choose_multiple'];

const SourceBackedModeChoiceLabel = z.string().trim().min(1);

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
  // The executable menu shape stays required, while its source labels remain
  // extensible for menus that switch on later actions, bonuses, or per-target
  // resolution timing.
  type: SourceBackedModeChoiceLabel,
  timing: SourceBackedModeChoiceLabel,
  optionCount: z.number(),
  // Multi-select menus let the caster pick several entries out of a larger
  // menu, so `optionCount` is a selection budget rather than the menu size.
  // `minSelections`/`maxSelections` record a source-backed range when the
  // spell allows "one or more" instead of an exact count.
  minSelections: z.number().optional(),
  maxSelections: z.number().optional(),
  // Summon-form menus often keep their selectable forms inside summon payloads
  // instead of duplicating them into top-level mode options. Keep those source
  // pointers valid so Find Familiar and Summon Beast can prove live form-choice
  // data without weakening ordinary effect/control-option menus.
  optionsSource: SourceBackedModeChoiceLabel,
  maxActiveNonInstantaneous: z.union([z.number(), z.literal("not_applicable")]).optional(),
  canDismissActive: z.union([z.boolean(), z.literal("not_applicable")]).optional(),
  options: z.array(ModeChoiceOption),
  notes: z.string().optional(),
})
  // Single-select menus resolve to exactly one entry, so their optionCount is
  // the menu size. Multi-select menus resolve to several entries out of a
  // larger menu, so their optionCount is the selection budget and must fit
  // inside the menu. SpellIntegrityValidator repeats these checks on parsed
  // spells; keeping them here stops a malformed menu from parsing at all.
  .superRefine((modeChoice, ctx) => {
    const menuSize = modeChoice.options.length;
    const multiSelect = MULTI_SELECT_MODE_CHOICE_TYPES.includes(modeChoice.type);

    if (!multiSelect) {
      if (modeChoice.optionCount !== menuSize) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['optionCount'],
          message: `Single-select modeChoice "${modeChoice.type}" must set optionCount to the menu size ${menuSize}, found ${modeChoice.optionCount}`,
        });
      }

      if (modeChoice.minSelections !== undefined || modeChoice.maxSelections !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['minSelections'],
          message: `Single-select modeChoice "${modeChoice.type}" must not declare a selection range`,
        });
      }

      return;
    }

    if (!Number.isInteger(modeChoice.optionCount) || modeChoice.optionCount < 1 || modeChoice.optionCount > menuSize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['optionCount'],
        message: `Multi-select modeChoice must choose between 1 and ${menuSize} of its options, found ${modeChoice.optionCount}`,
      });
    }

    const { minSelections, maxSelections } = modeChoice;

    if (minSelections !== undefined && (!Number.isInteger(minSelections) || minSelections < 1 || minSelections > menuSize)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minSelections'],
        message: `minSelections must be an integer between 1 and ${menuSize}, found ${String(minSelections)}`,
      });
    }

    if (maxSelections !== undefined && (!Number.isInteger(maxSelections) || maxSelections < 1 || maxSelections > menuSize)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxSelections'],
        message: `maxSelections must be an integer between 1 and ${menuSize}, found ${String(maxSelections)}`,
      });
    }

    if (minSelections !== undefined && maxSelections !== undefined && minSelections > maxSelections) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxSelections'],
        message: `minSelections ${minSelections} exceeds maxSelections ${maxSelections}`,
      });
    }

    if (minSelections !== undefined && modeChoice.optionCount < minSelections) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['optionCount'],
        message: `optionCount ${modeChoice.optionCount} falls below minSelections ${minSelections}`,
      });
    }

    if (maxSelections !== undefined && modeChoice.optionCount > maxSelections) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['optionCount'],
        message: `optionCount ${modeChoice.optionCount} exceeds maxSelections ${maxSelections}`,
      });
    }
  });

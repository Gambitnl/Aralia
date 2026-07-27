// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 03:15:24
 * Dependents: types/spells.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file describes spell effects that modify ability checks.
 *
 * It exists because spells such as Guidance do not deal damage or impose a save;
 * they create a temporary rule for checks using a chosen skill. That choice and
 * bonus need a runtime-readable home instead of being flattened into a utility
 * description.
 *
 * Called by: `spells.ts` for the public spell contract.
 * Depends on: no other type modules.
 */

//==============================================================================
// Ability Check Modifier Metadata
//==============================================================================
// These types describe a temporary bonus or penalty to ability checks, including
// whether a skill is chosen when the spell is cast.
//==============================================================================

/** Describes a spell-created modifier for ability checks. */
export interface AbilityCheckModifier {
  /** Source-backed check family or a spell-specific check description. */
  appliesTo?: string;
  /** Dice added or subtracted, such as Guidance's 1d4. */
  bonusDice?: string;
  /** Flat modifier or source-backed advantage/disadvantage label. */
  flatModifier?: number | string;
  /** Source-backed selection mode, such as chosen_skill or fixed_skill. */
  skillSelection?: string;
  /** Source-backed chooser label for player, spell, or per-target choices. */
  skillChooser?: string;
  /** One skill-family label or a list of fixed abilities/skills. */
  skillPool?: string | string[];
  /** How often the modifier can apply while the spell lasts. */
  frequency?: string;
  /** Source-backed duration relationship to the parent spell duration. */
  durationScope?: string;
  /** Preserve authored metadata fields until their owning runtime lane exists. */
  [key: string]: unknown;
  /** Short review note for details that do not deserve another field yet. */
  notes?: string;
}

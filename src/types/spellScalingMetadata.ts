// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 08:13:16
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
 * This file defines higher-level spell scaling metadata.
 *
 * Scaling rules are kept separate from the main spell contract because the
 * closure work keeps adding structured ways to preserve higher-level prose.
 * This module is intentionally type-only: it names repeatable runtime shapes
 * while keeping the broad `spells.ts` file from absorbing every scaling variant.
 *
 * Called by: `spells.ts`.
 * Depends on: no runtime data; this is a type-only metadata module.
 */

// ============================================================================
// Higher-Level Scaling
// ============================================================================
// These shapes cover recurring runtime patterns first while preserving an escape
// hatch for canonical scaling text that is valid but not safely modeled yet.
// ============================================================================

/** A single machine-readable higher-level scaling rule. */
export type HigherLevelScalingRule =
  | CharacterLevelTierScaling
  | SlotLevelBonusScaling
  | SlotLevelTableScaling
  | TargetCountBonusScaling
  | AreaSizeBonusScaling;

/** Top-level higher-level scaling container stored on a spell. */
export type HigherLevelScaling =
  | HigherLevelScalingRule
  | MultipleHigherLevelScaling
  | SpecialTextOnlyHigherLevelScaling;

/** Character-level tier scaling, primarily for cantrips. */
export interface CharacterLevelTierScaling {
  type: "character_level_tiers";
  tiers: Record<string, string>;
  notes?: string;
}

/** Simple slot-level bonus scaling such as a damage die per slot above base. */
export interface SlotLevelBonusScaling {
  type: "slot_level_bonus";
  baseSpellLevel: number;
  bonusPerLevel: string;
  notes?: string;
}

/** Explicit slot-level breakpoint table for spells that do not scale linearly. */
export interface SlotLevelTableScaling {
  type: "slot_level_table";
  baseSpellLevel: number;
  entries: Record<string, string>;
  notes?: string;
}

/** Structured target-count scaling for spells that affect more creatures per slot. */
export interface TargetCountBonusScaling {
  type: "target_count_bonus";
  baseSpellLevel: number;
  additionalTargetsPerLevel: number;
  targetLabel?: string;
  notes?: string;
}

/** Structured area-size scaling for spells whose radius/size grows with slot level. */
export interface AreaSizeBonusScaling {
  type: "area_size_bonus";
  baseSpellLevel: number;
  increasePerLevel: number;
  unit: "feet";
  dimension: "radius" | "diameter" | "cube_size" | "line_length" | "wall_length" | "wall_height";
  notes?: string;
}

/** Multiple simultaneous higher-level scaling rules on one spell. */
export interface MultipleHigherLevelScaling {
  type: "multiple";
  rules: HigherLevelScalingRule[];
  notes?: string;
}

/** Escape hatch for valid canonical scaling text that the runtime model still cannot safely express. */
export interface SpecialTextOnlyHigherLevelScaling {
  type: "special_text_only";
  referenceText: string;
  reason?: string;
}

/** Defines how an effect's numeric payload improves when cast or used at higher levels. */
export interface ScalingFormula {
  type: "slot_level" | "character_level" | "custom";
  /** Linear bonus text such as `+1d6` or `+1 target`. */
  bonusPerLevel?: string;
  /** Custom formula text for complex scaling that is not yet modeled as a typed rule. */
  customFormula?: string;
  /**
   * Explicitly maps character or slot thresholds to new dice or flat values.
   * Example: a cantrip can map `"5"` to `"2d10"`.
   */
  scalingTiers?: Record<string, string>;
}

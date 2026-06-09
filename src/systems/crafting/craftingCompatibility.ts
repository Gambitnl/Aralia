// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 08/06/2026, 17:11:18
 * Dependents: None (Orphan)
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/systems/crafting/craftingCompatibility.ts
 * Compatibility bridge for translating legacy crafting results into the
 * enhanced crafting vocabulary without deleting either path.
 *
 * This stays narrow on purpose: it maps the quality tiers and side-effect
 * fields the repo already exposes, and it leaves roll/DC/gold provenance
 * unresolved because the legacy callback path never emitted those values.
 */

import type { CraftingResult as LegacyCraftingResult, CraftingQuality as LegacyCraftingQuality, Recipe } from './types';
import type { CraftingQuality as EnhancedCraftingQuality } from './crafterProgression';

export const LEGACY_COMPATIBILITY_SOURCE = 'craftingSystem' as const;

export type LegacyCompatibilityUnsupportedField =
  | 'roll'
  | 'rawRoll'
  | 'dc'
  | 'qualityResult'
  | 'modifiersApplied';

export interface LegacyCraftingCompatibilityProvenance {
  /** Explicit source engine and field contract for the legacy conversion. */
  source: typeof LEGACY_COMPATIBILITY_SOURCE;
  /** File path used as the provenance anchor for audits and future migration reviews. */
  sourceContractFile: string;
  /** How the legacy output determined success/failure and quality. */
  outcomeSource: {
    success: boolean;
    quality: LegacyCraftingQuality;
    /** Whether the source path reported a material loss on failure. */
    materialsLost: boolean;
    /** Reuses the raw legacy message as an immutable origin line. */
    sourceMessage: string;
  };
  /** Enhanced fields intentionally not present in the legacy source contract. */
  unavailableEnhancedFields: LegacyCompatibilityUnsupportedField[];
  /** Why those fields can't be reconstructed from the legacy result. */
  unavailableReason: string;
}

/**
 * The quality matrix is explicit because the two crafting paths do not share
 * the same tier vocabulary. The enhanced engine has one extra failure tier and
 * one extra success tier, so the adapter collapses only where the legacy path
 * has no direct match.
 */
export const LEGACY_TO_ENHANCED_QUALITY = {
  poor: 'ruined',
  standard: 'standard',
  superior: 'masterwork',
  masterwork: 'legendary'
} as const satisfies Record<LegacyCraftingQuality, EnhancedCraftingQuality>;

/**
 * The reverse mapping is intentionally lossy in the middle tiers.
 * Legacy callers only know whether the result was broadly usable, so a
 * degraded-but-successful enhanced result collapses to the closest legacy
 * success label instead of inventing a new status.
 */
export const ENHANCED_TO_LEGACY_QUALITY = {
  ruined: 'poor',
  flawed: 'standard',
  standard: 'standard',
  masterwork: 'superior',
  legendary: 'masterwork'
} as const satisfies Record<EnhancedCraftingQuality, LegacyCraftingQuality>;

export interface LegacyCraftingCompatibilityPayload {
  legacyQuality: LegacyCraftingQuality;
  enhancedQuality: EnhancedCraftingQuality;
  success: boolean;
  materialsConsumed: boolean;
  goldSpent: number;
  xpGained: number;
  timeSpentMinutes: number;
  outputItem?: { itemId: string; quantity: number };
  message: string;
  provenance: LegacyCraftingCompatibilityProvenance;
}

/**
 * Translates one legacy crafting result into the enhanced vocabulary.
 * The caller still gets the legacy success flag and source quality, while the
 * enhanced-facing fields stay explicit and easy to diff in tests.
 */
export function normalizeLegacyCraftingResult(
  recipe: Pick<Recipe, 'timeMinutes'>,
  result: LegacyCraftingResult
): LegacyCraftingCompatibilityPayload {
  const outputItem = result.outputs[0];
  const enhancedQuality = LEGACY_TO_ENHANCED_QUALITY[result.quality];
  const unavailableEnhancedFields: LegacyCompatibilityUnsupportedField[] = [
    'roll',
    'rawRoll',
    'dc',
    'qualityResult',
    'modifiersApplied'
  ];

  return {
    legacyQuality: result.quality,
    enhancedQuality,
    success: result.success,
    materialsConsumed: result.consumedMaterials.length > 0,
    goldSpent: 0,
    xpGained: result.experienceGained ?? 0,
    timeSpentMinutes: recipe.timeMinutes,
    outputItem: outputItem ? { itemId: outputItem.itemId, quantity: outputItem.quantity } : undefined,
    message: result.message,
    provenance: {
      source: LEGACY_COMPATIBILITY_SOURCE,
      sourceContractFile: 'src/systems/crafting/craftingSystem.ts',
      outcomeSource: {
        success: result.success,
        quality: result.quality,
        materialsLost: result.materialsLost,
        sourceMessage: result.message
      },
      unavailableEnhancedFields,
      unavailableReason: `Legacy result normalization currently only carries callback-path outputs from ${LEGACY_COMPATIBILITY_SOURCE}; ` +
        `roll/rawRoll/dc/qualityResult/modifiersApplied are not emitted by that path.`
    }
  };
}

/**
 * Maps enhanced quality back to the closest legacy label for callers that
 * still speak the older contract.
 */
export function mapEnhancedQualityToLegacyQuality(
  quality: EnhancedCraftingQuality
): LegacyCraftingQuality {
  return ENHANCED_TO_LEGACY_QUALITY[quality];
}

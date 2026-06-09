import { describe, expect, it } from 'vitest';
import {
  LEGACY_TO_ENHANCED_QUALITY,
  mapEnhancedQualityToLegacyQuality,
  ENHANCED_TO_LEGACY_QUALITY,
  normalizeLegacyCraftingResult,
  LEGACY_COMPATIBILITY_SOURCE
} from '../craftingCompatibility';
import type { Recipe } from '../types';
import type { CraftingQuality as LegacyCraftingQuality, CraftingResult } from '../types';
import type { CraftingQuality as EnhancedCraftingQuality } from '../crafterProgression';

describe('craftingCompatibility', () => {
  const recipe: Pick<Recipe, 'timeMinutes'> = {
    // Keep the recipe fixture small: the adapter only needs the duration to
    // prove that the legacy result can be normalized into the enhanced payload.
    timeMinutes: 45
  };

  const legacyResult: CraftingResult = {
    success: true,
    quality: 'superior',
    outputs: [{ itemId: 'iron_sword', quantity: 2 }],
    consumedMaterials: [{ itemId: 'iron_bar', quantity: 2 }],
    experienceGained: 18,
    message: 'Crafted cleanly.',
    materialsLost: false
  };

  it('normalizes a legacy success into the enhanced-facing fields', () => {
    const normalized = normalizeLegacyCraftingResult(recipe, legacyResult);

    expect(normalized.legacyQuality).toBe('superior');
    expect(normalized.enhancedQuality).toBe(LEGACY_TO_ENHANCED_QUALITY.superior);
    expect(normalized.success).toBe(true);
    expect(normalized.materialsConsumed).toBe(true);
    expect(normalized.goldSpent).toBe(0);
    expect(normalized.xpGained).toBe(18);
    expect(normalized.timeSpentMinutes).toBe(45);
    expect(normalized.outputItem).toEqual({ itemId: 'iron_sword', quantity: 2 });
    expect(normalized.message).toBe('Crafted cleanly.');
    expect(normalized.provenance.source).toBe(LEGACY_COMPATIBILITY_SOURCE);
    expect(normalized.provenance.outcomeSource.success).toBe(true);
    expect(normalized.provenance.outcomeSource.quality).toBe('superior');
    expect(normalized.provenance.outcomeSource.materialsLost).toBe(false);
    expect(normalized.provenance.outcomeSource.sourceMessage).toBe('Crafted cleanly.');
    expect(normalized.provenance.sourceContractFile).toContain('craftingSystem.ts');
    expect(normalized.provenance.unavailableEnhancedFields).toEqual(
      expect.arrayContaining(['roll', 'rawRoll', 'dc', 'qualityResult', 'modifiersApplied'])
    );
    expect(normalized.provenance.unavailableReason).toContain('not emitted by that path');
  });

  it('normalizes a legacy failure into an explicit no-output path', () => {
    const failedLegacyResult: CraftingResult = {
      success: false,
      quality: 'poor',
      outputs: [],
      consumedMaterials: [{ itemId: 'iron_bar', quantity: 2 }],
      message: 'Your hand slips and the reagents are ruined.',
      materialsLost: true
    };

    const normalized = normalizeLegacyCraftingResult(recipe, failedLegacyResult);

    expect(normalized.legacyQuality).toBe('poor');
    expect(normalized.enhancedQuality).toBe(LEGACY_TO_ENHANCED_QUALITY.poor);
    expect(normalized.success).toBe(false);
    expect(normalized.materialsConsumed).toBe(true);
    expect(normalized.goldSpent).toBe(0);
    expect(normalized.xpGained).toBe(0);
    expect(normalized.timeSpentMinutes).toBe(45);
    expect(normalized.outputItem).toBeUndefined();
    expect(normalized.message).toBe('Your hand slips and the reagents are ruined.');
    expect(normalized.provenance.outcomeSource.success).toBe(false);
    expect(normalized.provenance.outcomeSource.quality).toBe('poor');
    expect(normalized.provenance.outcomeSource.materialsLost).toBe(true);
    expect(normalized.provenance.outcomeSource.sourceMessage).toBe('Your hand slips and the reagents are ruined.');
  });

  it('keeps provenance explicit when legacy quality is remapped through legacy loss states', () => {
    const failedButNoLossResult: CraftingResult = {
      success: false,
      quality: 'poor',
      outputs: [],
      consumedMaterials: [],
      materialsLost: false,
      message: 'The forge rejected your attempt, but materials were returned.'
    };

    const normalized = normalizeLegacyCraftingResult(recipe, failedButNoLossResult);

    expect(normalized.success).toBe(false);
    expect(normalized.materialsConsumed).toBe(false);
    expect(normalized.provenance.outcomeSource.success).toBe(false);
    expect(normalized.provenance.outcomeSource.materialsLost).toBe(false);
    expect(normalized.provenance.sourceContractFile).toBe('src/systems/crafting/craftingSystem.ts');
    expect(normalized.outputItem).toBeUndefined();
    expect(normalized.provenance.unavailableEnhancedFields).toHaveLength(5);
  });

  it('maps every legacy quality to its enhanced counterpart', () => {
    const legacyMappings = Object.entries(LEGACY_TO_ENHANCED_QUALITY) as [
      LegacyCraftingQuality,
      EnhancedCraftingQuality
    ][];

    legacyMappings.forEach(([legacyQuality, expectedEnhancedQuality]) => {
      const normalized = normalizeLegacyCraftingResult(recipe, {
        ...legacyResult,
        quality: legacyQuality
      });

      expect(normalized.legacyQuality).toBe(legacyQuality);
      expect(normalized.enhancedQuality).toBe(expectedEnhancedQuality);
    });
  });

  it('maps every enhanced quality to the documented legacy fallback label', () => {
    const enhancedMappings = Object.entries(ENHANCED_TO_LEGACY_QUALITY) as [
      EnhancedCraftingQuality,
      LegacyCraftingQuality
    ][];

    enhancedMappings.forEach(([enhancedQuality, expectedLegacyQuality]) => {
      expect(mapEnhancedQualityToLegacyQuality(enhancedQuality)).toBe(expectedLegacyQuality);
    });
  });
});

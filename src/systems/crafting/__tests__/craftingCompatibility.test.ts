import { describe, expect, it } from 'vitest';
import {
  ENHANCED_TO_LEGACY_QUALITY,
  LEGACY_COMPATIBILITY_SOURCE,
  LEGACY_TO_ENHANCED_QUALITY,
  mapEnhancedQualityToLegacyQuality,
  normalizeLegacyCraftingResult
} from '../craftingCompatibility';
import type { Recipe } from '../types';
import type { CraftingQuality as LegacyCraftingQuality, CraftingResult } from '../types';
import type { CraftingQuality as EnhancedCraftingQuality } from '../crafterProgression';

/**
 * This file protects the compatibility bridge between the legacy crafting core
 * and the enhanced crafting engine.
 *
 * Aralia intentionally keeps both craft engines alive because they use different
 * quality labels and expose different side-effect details. These tests make sure
 * the adapter preserves legacy success/failure, output, material-loss, XP, time,
 * and provenance fields while clearly naming the enhanced roll fields that the
 * legacy path cannot provide.
 *
 * Called by: Vitest Crafting System checks
 * Depends on: craftingCompatibility.ts, legacy crafting types, enhanced quality types
 */

describe('craftingCompatibility', () => {
  const recipe: Pick<Recipe, 'timeMinutes'> = {
    // The adapter only needs duration to prove that the legacy contract keeps
    // its timing side effect when it is translated into the enhanced shape.
    timeMinutes: 45
  };

  const unavailableEnhancedFields = [
    'roll',
    'rawRoll',
    'dc',
    'qualityResult',
    'modifiersApplied'
  ] as const;

  const successfulLegacyResult: CraftingResult = {
    success: true,
    quality: 'superior',
    outputs: [{ itemId: 'iron_sword', quantity: 2 }],
    consumedMaterials: [{ itemId: 'iron_bar', quantity: 2 }],
    experienceGained: 18,
    message: 'Crafted cleanly.',
    materialsLost: false
  };

  const failedLegacyResult: CraftingResult = {
    success: false,
    quality: 'poor',
    outputs: [],
    consumedMaterials: [{ itemId: 'iron_bar', quantity: 2 }],
    message: 'Your hand slips and the reagents are ruined.',
    materialsLost: true
  };

  it('normalizes a legacy success into the enhanced-facing side-effect contract', () => {
    const normalized = normalizeLegacyCraftingResult(recipe, successfulLegacyResult);

    expect(normalized).toMatchObject({
      legacyQuality: 'superior',
      enhancedQuality: LEGACY_TO_ENHANCED_QUALITY.superior,
      success: true,
      materialsConsumed: true,
      goldSpent: 0,
      xpGained: 18,
      timeSpentMinutes: 45,
      outputItem: { itemId: 'iron_sword', quantity: 2 },
      message: 'Crafted cleanly.'
    });

    expect(normalized.provenance).toMatchObject({
      source: LEGACY_COMPATIBILITY_SOURCE,
      sourceContractFile: 'src/systems/crafting/craftingSystem.ts',
      outcomeSource: {
        success: true,
        quality: 'superior',
        materialsLost: false,
        sourceMessage: 'Crafted cleanly.'
      }
    });
    expect(normalized.provenance.unavailableEnhancedFields).toEqual(unavailableEnhancedFields);
    expect(normalized.provenance.unavailableReason).toContain('not emitted by that path');
  });

  it('normalizes a legacy failure into an explicit no-output path', () => {
    const normalized = normalizeLegacyCraftingResult(recipe, failedLegacyResult);

    expect(normalized).toMatchObject({
      legacyQuality: 'poor',
      enhancedQuality: LEGACY_TO_ENHANCED_QUALITY.poor,
      success: false,
      materialsConsumed: true,
      goldSpent: 0,
      xpGained: 0,
      timeSpentMinutes: 45,
      message: 'Your hand slips and the reagents are ruined.'
    });
    expect(normalized.outputItem).toBeUndefined();

    expect(normalized.provenance).toMatchObject({
      source: LEGACY_COMPATIBILITY_SOURCE,
      sourceContractFile: 'src/systems/crafting/craftingSystem.ts',
      outcomeSource: {
        success: false,
        quality: 'poor',
        materialsLost: true,
        sourceMessage: 'Your hand slips and the reagents are ruined.'
      }
    });
    expect(normalized.provenance.unavailableEnhancedFields).toEqual(unavailableEnhancedFields);
    expect(normalized.provenance.unavailableReason).toContain('craftingSystem');
  });

  it('keeps the adapter honest when a failed legacy craft preserves its inputs', () => {
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
    expect(normalized.outputItem).toBeUndefined();
    expect(normalized.provenance.outcomeSource).toMatchObject({
      success: false,
      quality: 'poor',
      materialsLost: false,
      sourceMessage: 'The forge rejected your attempt, but materials were returned.'
    });
    expect(normalized.provenance.unavailableEnhancedFields).toEqual(unavailableEnhancedFields);
    expect(normalized.provenance.sourceContractFile).toBe('src/systems/crafting/craftingSystem.ts');
  });

  it.each([
    ['poor', 'ruined'],
    ['standard', 'standard'],
    ['superior', 'masterwork'],
    ['masterwork', 'legendary']
  ] as const satisfies ReadonlyArray<readonly [LegacyCraftingQuality, EnhancedCraftingQuality]>)(
    'maps legacy quality %s to enhanced quality %s',
    (legacyQuality, expectedEnhancedQuality) => {
      const normalized = normalizeLegacyCraftingResult(recipe, {
        ...successfulLegacyResult,
        quality: legacyQuality
      });

      expect(normalized.legacyQuality).toBe(legacyQuality);
      expect(normalized.enhancedQuality).toBe(expectedEnhancedQuality);
      expect(normalized.success).toBe(true);
      expect(normalized.provenance.outcomeSource.quality).toBe(legacyQuality);
    }
  );

  it.each([
    ['ruined', 'poor'],
    ['flawed', 'standard'],
    ['standard', 'standard'],
    ['masterwork', 'superior'],
    ['legendary', 'masterwork']
  ] as const satisfies ReadonlyArray<readonly [EnhancedCraftingQuality, LegacyCraftingQuality]>)(
    'maps enhanced quality %s back to legacy quality %s',
    (enhancedQuality, expectedLegacyQuality) => {
      expect(mapEnhancedQualityToLegacyQuality(enhancedQuality)).toBe(expectedLegacyQuality);
    }
  );

  it('keeps the bidirectional mapping tables in lockstep with the documented compatibility contract', () => {
    expect(Object.keys(LEGACY_TO_ENHANCED_QUALITY)).toHaveLength(4);
    expect(Object.keys(ENHANCED_TO_LEGACY_QUALITY)).toHaveLength(5);
    expect(Object.values(LEGACY_TO_ENHANCED_QUALITY)).toEqual([
      'ruined',
      'standard',
      'masterwork',
      'legendary'
    ]);
    expect(Object.values(ENHANCED_TO_LEGACY_QUALITY)).toEqual([
      'poor',
      'standard',
      'standard',
      'superior',
      'masterwork'
    ]);
  });
});

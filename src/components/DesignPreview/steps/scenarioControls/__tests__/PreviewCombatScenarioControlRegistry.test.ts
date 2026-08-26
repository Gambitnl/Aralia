/**
 * This file proves that every Tactical Sandbox catalog entry has real controls.
 *
 * Individual module tests verify mechanic behavior. This registry-level test
 * protects the integration seam: adding or renaming a scenario cannot silently
 * leave its rendered Test Controls panel empty.
 *
 * Exercises: PreviewCombatScenarioControlRegistry.
 * Depends on: the canonical preview scenario catalog.
 */

import { describe, expect, it } from 'vitest';
import { PREVIEW_COMBAT_SCENARIOS } from '../../PreviewCombatScenarioCatalog';
import { getPreviewCombatScenarioControlModule } from '../PreviewCombatScenarioControlRegistry';

// ============================================================================
// Complete Catalog Coverage
// ============================================================================
// The assertion reports scenario IDs rather than only comparing counts, so a
// future failure immediately identifies the lane whose controls disappeared.
// ============================================================================

describe('PreviewCombatScenarioControlRegistry', () => {
  it('registers at least one test control for every catalog scenario', () => {
    const missingScenarioIds = PREVIEW_COMBAT_SCENARIOS
      .filter(scenario => {
        const module = getPreviewCombatScenarioControlModule(scenario.id);
        return !module || module.controls.length === 0;
      })
      .map(scenario => scenario.id);

    expect(missingScenarioIds).toEqual([]);
  });

  it('keeps module IDs aligned with their catalog lookup key', () => {
    for (const scenario of PREVIEW_COMBAT_SCENARIOS) {
      expect(getPreviewCombatScenarioControlModule(scenario.id)?.scenarioId)
        .toBe(scenario.id);
    }
  });
});

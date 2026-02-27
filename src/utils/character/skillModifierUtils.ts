// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:31:01
 * Dependents: SkillSelection.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { calculateProficiencyBonus } from './savingThrowUtils';
import { getAbilityModifierValue } from './statUtils';

export function calculateTotalSkillModifier(params: {
  abilityScore: number;
  hasProficiency: boolean;
  level: number;
}): number {
  const { abilityScore, hasProficiency, level } = params;
  const abilityMod = getAbilityModifierValue(abilityScore);
  const proficiencyBonus = hasProficiency ? calculateProficiencyBonus(level) : 0;
  return abilityMod + proficiencyBonus;
}


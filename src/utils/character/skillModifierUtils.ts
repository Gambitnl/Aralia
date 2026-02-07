// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 05/02/2026, 21:42:13
 * Dependents: SkillSelection.tsx
 * Imports: 2 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
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


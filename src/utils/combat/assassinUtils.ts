// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 14:04:54
 * Dependents: utils/combat/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Assassin (Rogue) Assassinate and tool proficiencies.
 *
 * Assassinate grants advantage on attacks against a creature that has not yet
 * acted this round and turns a hit against a surprised creature into a critical.
 * This file owns the subclass-aware roll modifiers so a caller does not
 * hand-roll either rule in preview text, plus the disguise/poisoner kit merge
 * for the level-3 tool grant. Both are gated on the `assassinate` ability, so a
 * non-Assassin rogue never inherits the modifiers.
 */

import type { CombatCharacter } from '../../types/combat';

export const ASSASSINATE_FEATURE_ID = 'assassinate';
export const ASSASSINS_TOOLS_FEATURE_ID = 'assassins_tools';

// ============================================================================
// Tool Proficiencies
// ============================================================================

export const ASSASSIN_TOOL_PROFICIENCIES = ['disguise_kit', 'poisoners_kit'] as const;
export type AssassinToolProficiency = (typeof ASSASSIN_TOOL_PROFICIENCIES)[number];

export function hasAssassinsTools(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === ASSASSINS_TOOLS_FEATURE_ID);
}

/**
 * Merges the Assassin's disguise kit and poisoner's kit into an existing
 * proficiency list without duplicating entries. The caller persists the result
 * onto the character's tool proficiencies.
 */
export function mergeAssassinToolProficiencies(toolProficiencies: string[] = []): string[] {
  const merged = new Set(toolProficiencies);
  for (const tool of ASSASSIN_TOOL_PROFICIENCIES) merged.add(tool);
  return Array.from(merged);
}

// ============================================================================
// Assassinate Roll Modifiers
// ============================================================================

export function hasAssassinate(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === ASSASSINATE_FEATURE_ID);
}

export interface AssassinateTargetState {
  /** Whether the target has already taken a turn in the current round. */
  hasActedThisRound: boolean;
  /** Whether the target is currently surprised. */
  isSurprised: boolean;
}

export interface AssassinateModifiers {
  /** Advantage on attacks against a creature that has not acted yet this round. */
  advantage: boolean;
  /** A hit against a surprised creature is a critical. */
  criticalOnHit: boolean;
}

export function calculateAssassinateModifiers(
  assassin: CombatCharacter,
  target: AssassinateTargetState,
): AssassinateModifiers {
  if (!hasAssassinate(assassin)) return { advantage: false, criticalOnHit: false };
  return {
    advantage: !target.hasActedThisRound,
    criticalOnHit: target.isSurprised,
  };
}

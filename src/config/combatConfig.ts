/**
 * @file src/config/combatConfig.ts
 * Centralizes configuration variables for combat, including AI behavior and delays.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 28/10/2026, 16:00:45
 * Dependents: components/ActionPane/SystemMenu.tsx, context/AIConfigContext.tsx, hooks/actions/actionHandlers.ts, hooks/app/useAppPreferences.ts, hooks/combat/useCombatAI.ts, hooks/combat/useTurnManager.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Defines the delay (in milliseconds) the AI waits before taking an action during its turn.
 * This simulates "thinking" time and provides a better pacing for the user to follow the combat.
 *
 * - `easy`: 500ms - Faster turns, less waiting.
 * - `normal`: 1000ms - Standard pacing.
 * - `hard`: 1500ms - Slower pacing, perhaps implying more "deliberation" (though logic is identical).
 */
export const AI_THINKING_DELAY_MS = {
  easy: 500,
  normal: 1000,
  hard: 1500,
};

/** Player-chosen combat difficulty (agora-a46a.1). Drives AI thinking delay today. */
export type CombatDifficulty = keyof typeof AI_THINKING_DELAY_MS;
export const COMBAT_DIFFICULTIES: readonly CombatDifficulty[] = ['easy', 'normal', 'hard'];
export const DEFAULT_COMBAT_DIFFICULTY: CombatDifficulty = 'normal';
export const isCombatDifficulty = (value: unknown): value is CombatDifficulty =>
  typeof value === 'string' && (COMBAT_DIFFICULTIES as readonly string[]).includes(value);
export const nextCombatDifficulty = (current: CombatDifficulty): CombatDifficulty =>
  COMBAT_DIFFICULTIES[(COMBAT_DIFFICULTIES.indexOf(current) + 1) % COMBAT_DIFFICULTIES.length];
// Saved campaigns retain the existing difficulty IDs. Today's control changes
// delay alone, so its player-facing name must describe pace rather than imply
// different enemy decisions or combat rules. Actual challenge levels remain
// a separate unfinished feature.
export const COMBAT_DIFFICULTY_LABEL: Record<CombatDifficulty, string> = {
  easy: 'Fast', normal: 'Standard', hard: 'Slow',
};

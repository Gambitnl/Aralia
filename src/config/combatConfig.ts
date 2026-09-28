/**
 * @file src/config/combatConfig.ts
 * Centralizes configuration variables for combat, including AI behavior and delays.
 */

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
export const COMBAT_DIFFICULTY_LABEL: Record<CombatDifficulty, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

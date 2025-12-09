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

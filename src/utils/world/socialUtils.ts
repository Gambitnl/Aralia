// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 26/01/2026, 01:40:46
 * Dependents: socialUtils.ts, world/index.ts
 * Imports: 1 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/socialUtils.ts
 * This file contains utility functions for social interactions,
 * like assessing the plausibility of a character's actions.
 */
import { Action, PlayerCharacter, GameState, SuspicionLevel } from '../../types';

/**
 * Assesses the plausibility of a deception-based action and returns a DC modifier.
 * A higher disposition or lower suspicion level makes success easier (negative modifier).
 * @param action - The action being performed.
 * @param character - The character performing the action.
 * @param npcMemory - The memory state of the NPC being targeted.
 * @returns A number to be added to the skill check's DC.
 */
export function assessPlausibility(
  action: Action,
  character: PlayerCharacter,
  npcMemory: GameState['npcMemory'][string]
): number {
  let modifier = 0;

  // High disposition makes the NPC less critical.
  if (npcMemory.disposition > 50) {
    modifier -= 3; // Much easier
  } else if (npcMemory.disposition > 20) {
    modifier -= 1; // A bit easier
  } else if (npcMemory.disposition < -20) {
    modifier += 2; // Harder
  } else if (npcMemory.disposition < -50) {
    modifier += 4; // Much harder
  }

  // An already suspicious NPC is harder to fool.
  switch (npcMemory.suspicion) {
    case SuspicionLevel.Suspicious:
      modifier += 3;
      break;
    case SuspicionLevel.Alert:
      modifier += 5;
      break;
  }

  // Future enhancements could analyze the action.payload.geminiPrompt
  // for keywords that make an action more or less plausible in context.

  return modifier;
}
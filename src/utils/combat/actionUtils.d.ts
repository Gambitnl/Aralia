/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:31:21
 * Dependents: actionUtils.ts, combat/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/actionUtils.ts
 * This file contains utility functions related to player actions,
 * such as generating diegetic messages for the game log.
 */
import { Action, NPC, Location, PlayerCharacter } from '../../types';
/**
 * Converts a raw game Action object into a diegetic (narrative) string suitable for the game log.
 *
 * "Diegetic" means the text is presented as if it is happening within the story world,
 * describing the character's attempt to perform the action rather than just stating the mechanical input.
 *
 * @param action - The Action object describing what the player wants to do.
 * @param gameNpcs - A record of NPCs in the current context (used to resolve target IDs to names).
 * @param gameLocations - A record of known locations (used to resolve target IDs to names).
 * @param playerCharacter - The active player character (used for checking inventory slots). Can be undefined.
 *
 * @returns A string describing the action in the second person ("You..."), or `null` if the action
 *          should not generate a separate log entry (e.g., system commands or actions that generate their own logs).
 *
 * @example
 * // Returns "You approach Blacksmith to speak."
 * getDiegeticPlayerActionMessage({ type: 'talk', targetId: 'blacksmith' }, npcs, {}, pc);
 *
 * @example
 * // Returns "You attempt to equip the Iron Sword."
 * getDiegeticPlayerActionMessage({ type: 'EQUIP_ITEM', payload: { itemId: 'sword_iron' } }, {}, {}, pc);
 *
 * @example
 * // Returns null (System action)
 * getDiegeticPlayerActionMessage({ type: 'save_game' }, {}, {}, pc);
 */
export declare function getDiegeticPlayerActionMessage(action: Action, gameNpcs: Record<string, NPC>, gameLocations: Record<string, Location>, playerCharacter: PlayerCharacter | undefined): string | null;

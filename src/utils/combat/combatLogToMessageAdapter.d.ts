/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 23:24:10
 * Dependents: components/Combat/CombatView.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file combatLogToMessageAdapter.ts
 * @created 2026-02-10
 *
 * Bridge adapter that converts simple CombatLogEntry objects into rich CombatMessage objects.
 * This allows the existing combat system (which emits CombatLogEntry via onLogEntry callbacks
 * in useTurnManager, useCombatEngine, and useActionExecutor) to feed the rich messaging system
 * without modifying any of those combat hooks.
 *
 * The adapter is called from CombatView.handleLogEntry, which intercepts every log entry at the
 * component level and produces a parallel rich message for the CombatLog's enhanced display mode.
 *
 * IMPORTANT: Do not remove inline comments from this file unless the associated code is modified.
 * If code changes, update the comment with the new date and a description of the change.
 */
import type { CombatLogEntry, CombatCharacter } from '../../types/combat';
import type { CombatMessage } from '../../types/combatMessages';
/**
 * convertLogEntryToMessage — The public API of this adapter module.
 *
 * Converts a single CombatLogEntry into a CombatMessage by:
 *   1. Classifying the entry (type, priority, channels) via classifyEntry().
 *   2. Building a typed data payload via buildDataPayload().
 *   3. Deriving a concise title via deriveTitle().
 *   4. Resolving source/target entity IDs from the characters array.
 *
 * Called from CombatView.handleLogEntry on every log entry emitted during combat.
 * The resulting CombatMessage is passed to useCombatMessaging.addMessage() and
 * ultimately rendered by the CombatLog component in rich display mode.
 *
 * @param entry      - The simple log entry from the combat system.
 * @param characters - The current combat characters array. Used to look up entity IDs
 *                     by name when the log entry only provides a name string (e.g. the
 *                     attacker name in damage entries is stored as data.source, not an ID).
 * @returns A fully populated CombatMessage ready for the messaging system.
 */
export declare function convertLogEntryToMessage(entry: CombatLogEntry, characters: CombatCharacter[]): CombatMessage;

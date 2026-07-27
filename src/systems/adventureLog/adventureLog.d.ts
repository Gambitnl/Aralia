/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/systems/adventureLog/adventureLog.ts
 *
 * Runtime "adventure log": an append-only record of what happened to THIS
 * party, in play order. It is the substrate that lets the Oracle act as a
 * Dungeon Master — recap the story so far and point at real people and places.
 *
 * Everything here is PURE and data-derived. Entries are short, one-sentence
 * summaries built from game data (never from an LLM), so they are cheap to
 * generate, deterministic, and safe to feed straight into a prompt.
 *
 * Append points live in the reducers/handlers where the underlying event
 * already resolves (quest completion, combat victory, travel arrival, first
 * meeting an NPC / recruiting, notable discoveries, long rests). Each of those
 * spreads {@link appendAdventureLogEntry} into its returned `Partial<GameState>`,
 * so no new action type or dispatch wiring is required.
 */
import type { GameState, AdventureLogEntry, AdventureLogKind } from '../../types/state';
/** Keep the log bounded so saves and prompts stay small. */
export declare const ADVENTURE_LOG_CAP = 200;
/**
 * Derive the 1-based in-game day number from the game clock. The campaign
 * starts on day 1; we anchor to the epoch day of `gameTime` so the number is
 * stable and monotonic across a session.
 */
export declare function deriveGameDay(gameTime: Date): number;
/**
 * Format the in-game clock as "HH:MM" (24h), matching other UI surfaces.
 * G5: `gameTime` is the in-world UTC clock and every player-visible rendering
 * uses UTC fields (`formatGameTime` passes `timeZone: 'UTC'`) — so this stamp
 * reads UTC hours too. Host-local `getHours()` would shift log timestamps away
 * from the HUD clock by the machine's timezone offset.
 */
export declare function formatGameClock(gameTime: Date): string;
export interface NewAdventureLogEntry {
    kind: AdventureLogKind;
    /** One short, data-derived sentence. */
    summary: string;
    npcIds?: string[];
    placeIds?: string[];
}
/**
 * Build a fully-formed {@link AdventureLogEntry} stamped with the current game
 * day/time. Pure: no dispatch, no mutation.
 */
export declare function makeAdventureLogEntry(state: GameState, entry: NewAdventureLogEntry): AdventureLogEntry;
/**
 * Append one entry to the adventure log and return the `adventureLog` slice
 * update to spread into a reducer's `Partial<GameState>`.
 *
 * De-dupes back-to-back identical summaries (same kind + summary as the most
 * recent entry) so repeated dispatches (e.g. StrictMode double-fire) don't
 * flood the log. Bounded to {@link ADVENTURE_LOG_CAP} newest entries.
 */
export declare function appendAdventureLogEntry(state: GameState, entry: NewAdventureLogEntry): Pick<GameState, 'adventureLog'>;
/**
 * Return the most recent `n` entries (oldest→newest), for prompt building and
 * recap surfaces.
 */
export declare function recentAdventureLog(state: GameState, n?: number): AdventureLogEntry[];

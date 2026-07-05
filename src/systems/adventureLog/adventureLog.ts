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
import { generateId } from '../../utils/core/idGenerator';

/** Keep the log bounded so saves and prompts stay small. */
export const ADVENTURE_LOG_CAP = 200;

/**
 * Derive the 1-based in-game day number from the game clock. The campaign
 * starts on day 1; we anchor to the epoch day of `gameTime` so the number is
 * stable and monotonic across a session.
 */
export function deriveGameDay(gameTime: Date): number {
  const epochDay = Math.floor(gameTime.getTime() / 86_400_000);
  // Anchor so the very first day reads as "Day 1" rather than a huge number.
  // We only need relative ordering + a small human-friendly integer; the
  // absolute anchor is the game's own epoch-day of its start date, but since
  // saves may start on arbitrary dates we simply expose the raw epoch day.
  // Callers that want a friendly number can subtract a campaign start day.
  return epochDay;
}

/** Format the in-game clock as "HH:MM" (24h), matching other UI surfaces. */
export function formatGameClock(gameTime: Date): string {
  const hh = String(gameTime.getHours()).padStart(2, '0');
  const mm = String(gameTime.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

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
export function makeAdventureLogEntry(
  state: GameState,
  entry: NewAdventureLogEntry
): AdventureLogEntry {
  const gameTime = state.gameTime instanceof Date ? state.gameTime : new Date(state.gameTime);
  return {
    id: generateId(),
    day: deriveGameDay(gameTime),
    time: formatGameClock(gameTime),
    timestamp: Date.now(),
    kind: entry.kind,
    summary: entry.summary.trim(),
    ...(entry.npcIds && entry.npcIds.length ? { npcIds: entry.npcIds } : {}),
    ...(entry.placeIds && entry.placeIds.length ? { placeIds: entry.placeIds } : {}),
  };
}

/**
 * Append one entry to the adventure log and return the `adventureLog` slice
 * update to spread into a reducer's `Partial<GameState>`.
 *
 * De-dupes back-to-back identical summaries (same kind + summary as the most
 * recent entry) so repeated dispatches (e.g. StrictMode double-fire) don't
 * flood the log. Bounded to {@link ADVENTURE_LOG_CAP} newest entries.
 */
export function appendAdventureLogEntry(
  state: GameState,
  entry: NewAdventureLogEntry
): Pick<GameState, 'adventureLog'> {
  const existing = state.adventureLog ?? [];
  const last = existing[existing.length - 1];
  if (last && last.kind === entry.kind && last.summary.trim() === entry.summary.trim()) {
    // Idempotent: identical consecutive event, don't duplicate.
    return { adventureLog: existing };
  }
  const next = [...existing, makeAdventureLogEntry(state, entry)];
  const capped = next.length > ADVENTURE_LOG_CAP ? next.slice(next.length - ADVENTURE_LOG_CAP) : next;
  return { adventureLog: capped };
}

/**
 * Return the most recent `n` entries (oldest→newest), for prompt building and
 * recap surfaces.
 */
export function recentAdventureLog(state: GameState, n = 20): AdventureLogEntry[] {
  const log = state.adventureLog ?? [];
  return log.slice(Math.max(0, log.length - n));
}

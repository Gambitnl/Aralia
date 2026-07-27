/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/systems/adventureLog/oraclePrompt.ts
 *
 * Pure builder for the Oracle-as-Dungeon-Master prompt. Given the current
 * GameState, it assembles a grounded briefing — who the player is, the story so
 * far (from the runtime adventure log), active quests, the current town and its
 * known people, and nearby places the party has actually discovered — and wraps
 * it in a DM system instruction.
 *
 * CONTRACT: state → prompt string. No LLM, no async, no mutation. Every fact
 * comes from real game state, and the system instruction forbids the model from
 * inventing place or person names, so the Oracle only points at things that
 * exist in the player's world.
 */
import type { GameState } from '../../types/state';
/** One-line character identity line, tolerant of missing race/class. */
export declare function describePlayer(state: GameState): string;
/** The current town/settlement name from state, or null if unknown. */
export declare function currentTownName(state: GameState): string | null;
/** Names of NPCs the party has actually met (deduped, capped). */
export declare function knownPeople(state: GameState, cap?: number): string[];
/**
 * A few known establishments the Oracle can point at. Best-effort and sync:
 * lists business names from the world-business registry. Kept name-only so we
 * never surface fictitious detail — the model is told to use these verbatim.
 */
export declare function knownBusinesses(state: GameState, cap?: number): string[];
/** Places the party has discovered, from the discovery log (deduped, capped). */
export declare function discoveredPlaces(state: GameState, cap?: number): string[];
/** Active (non-completed, non-failed) quest titles. */
export declare function activeQuests(state: GameState, cap?: number): string[];
/**
 * Build the full Oracle DM prompt (system instruction + grounded briefing +
 * the player's question). Pure: state + question → string.
 */
export declare function buildOraclePrompt(state: GameState, playerQuery: string): string;

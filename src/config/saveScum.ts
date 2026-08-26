/**
 * @file src/config/saveScum.ts
 * The campaign save-scum setting (agora-f821.63). Remy ruled on the combat
 * sheet (q3, 2026-09-21): no dice replay by default, because "getting a random
 * roll result every save just makes it harder to save scum but not impossible"
 * — so the replay behavior lives behind a toggle instead of being the rule.
 *
 * ON (the default, and what the game has always done): the dice audit log
 * keeps the clock-derived base seed it self-seeds with, so a reload rerolls.
 *
 * OFF: the campaign's dice stream is seeded from a number stored IN THE SAVE
 * (the world seed mixed with a per-save counter). Loading the same save always
 * replays the same dice for the same sequence of actions, so save-and-retry of
 * one step cannot buy a different die.
 *
 * This module is the ONE place that knows the default and the seed derivation.
 * Every consumer reads the setting through `getAllowSaveScum` rather than
 * defaulting for itself, so a save written before the field existed resolves to
 * the old behavior in exactly one line of code.
 */

import { DiceAuditLog, deriveRollSeed } from '../systems/dice/rollContract';

/**
 * Campaigns allow save-scumming by default: that is the behavior every save
 * written before this setting existed was played under, and changing dice
 * under an existing campaign without being asked would be a silent rules change.
 */
export const DEFAULT_ALLOW_SAVE_SCUM = true;

/** The counter a campaign that has never been saved starts from. */
export const INITIAL_DICE_SAVE_COUNTER = 0;

/** Menu label for either position of the toggle. */
export const SAVE_SCUM_LABEL: Record<'on' | 'off', string> = {
  on: 'On',
  off: 'Off',
};

/** The part of GameState this module reads. Keeps the readers testable alone. */
export interface SaveScumFields {
  allowSaveScum?: boolean;
  diceSaveCounter?: number;
  worldSeed?: number;
}

/**
 * THE reader for the save-scum setting. Consumers must call this instead of
 * reading `state.allowSaveScum` directly, because a save written before the
 * field existed carries `undefined` and must resolve to the permissive default
 * here and nowhere else.
 */
export function getAllowSaveScum(state: SaveScumFields | null | undefined): boolean {
  const stored = state?.allowSaveScum;
  return typeof stored === 'boolean' ? stored : DEFAULT_ALLOW_SAVE_SCUM;
}

/**
 * The per-save counter carried by this campaign. A save written before the
 * field existed reads as the initial counter, which is correct: such a save
 * predates the setting and loads with save-scumming allowed anyway.
 */
export function getDiceSaveCounter(state: SaveScumFields | null | undefined): number {
  const stored = state?.diceSaveCounter;
  return Number.isInteger(stored) && (stored as number) >= 0
    ? (stored as number)
    : INITIAL_DICE_SAVE_COUNTER;
}

/**
 * The counter the NEXT save writes. Every save advances it, so two saves taken
 * from the same moment of play do not hand the loaded campaign the same dice
 * stream — the stored number, not the wall clock, is what a reload replays.
 */
export function advanceDiceSaveCounter(state: SaveScumFields | null | undefined): number {
  return getDiceSaveCounter(state) + 1;
}

/**
 * The base seed a campaign's dice stream runs from when save-scumming is OFF.
 *
 * `deriveRollSeed` is the contract's own avalanche mixer: it already turns two
 * numbers into a seed inside SeededRandom's valid range, so the world seed and
 * the per-save counter are mixed with the same function the per-roll seeds use
 * rather than a second hash invented here.
 */
export function deriveCampaignDiceSeed(worldSeed: number, saveCounter: number): number {
  const seed = Number.isFinite(worldSeed) ? Math.floor(worldSeed) >>> 0 : 0;
  const counter = Number.isInteger(saveCounter) && saveCounter >= 0 ? saveCounter : 0;
  return deriveRollSeed(seed, counter);
}

/**
 * Seed the shared dice audit log for a campaign that is being loaded.
 *
 * Called from the one place a campaign enters play from storage. With the
 * setting ON this does nothing at all, so the log keeps the clock-derived seed
 * it self-seeded with and today's behavior is byte-for-byte unchanged.
 *
 * Returns the base seed it installed, or `null` when it left the log alone, so
 * callers and tests can assert which branch ran.
 */
export function applyCampaignDiceStream(
  state: SaveScumFields | null | undefined,
): number | null {
  if (getAllowSaveScum(state)) return null;
  const baseSeed = deriveCampaignDiceSeed(state?.worldSeed ?? 0, getDiceSaveCounter(state));
  DiceAuditLog.configure({ baseSeed });
  return baseSeed;
}

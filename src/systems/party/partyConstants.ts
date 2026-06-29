/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/party/partyConstants.ts
 * Single source of truth for party-size counting + an OPTIONAL soft cap.
 *
 * DESIGN (resolved, see .agent/scratch/party-join/DISCOVERY.md §5.1):
 *   There is NO hard party cap. Recruiting is NEVER blocked by size.
 *   This module provides pure count helpers plus an OPTIONAL soft cap that is
 *   consumed ONLY by the roster UI (P11) as a hint — never as enforcement.
 *   Do NOT add blocking logic here or call these to reject a recruit.
 *
 * Everyone imports the count/threshold from here so it isn't duplicated.
 * Pure module: no React, no state, no side effects.
 */

import type { PlayerCharacter } from '../../types/character';

/**
 * Soft, advisory party size. Purely a UI hint (e.g. roster shows
 * `count / SOFT_PARTY_CAP` and may style an over-cap count differently).
 * NOT enforced anywhere — the recruit flow ignores it.
 */
export const SOFT_PARTY_CAP = 6;

/** Anything with a length is countable; keep coupling minimal. */
type CountableParty = ReadonlyArray<PlayerCharacter> | { length: number } | null | undefined;

/**
 * Number of members currently in the playable party.
 * Tolerant of null/undefined (returns 0) so callers needn't guard.
 */
export function partyCount(party: CountableParty): number {
  if (!party) return 0;
  return party.length;
}

/**
 * Whether the party is over the advisory soft cap.
 * UI-hint only — does NOT mean recruiting should be blocked.
 */
export function isOverSoftCap(party: CountableParty): boolean {
  return partyCount(party) > SOFT_PARTY_CAP;
}

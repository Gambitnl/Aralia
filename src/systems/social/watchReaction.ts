/**
 * @file src/systems/social/watchReaction.ts
 *
 * Watch/guard reaction: the honest, minimal consequence for fighting a town's
 * watch. When the player wins (or ends) a battle that grew out of a HOSTILE
 * opening whose antagonists were the town watch, the town should notice:
 *   - the player becomes WANTED in that one town (a witnessed Assault crime,
 *     which the crime reducer turns into local heat + a bounty),
 *   - townsfolk dispositions drop,
 *   - the adventure log records it.
 * And afterward, a guard who meets a wanted player refuses to talk and confronts
 * them (the caller reuses the hostile-opening → tactical-combat machinery).
 *
 * This module is PURE and injectable: it only decides *whether* a watch reaction
 * is owed and *what* it should be. The reducer/handler apply the effects. Scope
 * is deliberately one town — no faction webs, no cross-settlement propagation.
 */

import { CrimeType } from '../../types/crime';
import type { Crime } from '../../types/crime';
import type { OpeningSituation, SituationNPC } from '../gameEntry/types';

/**
 * Role keywords that mark a scene NPC as part of the town watch. Kept broad and
 * case-insensitive so both the free-text situation `role` ("city guard",
 * "watchman", "town sentinel") and the structured RichNPC role ("guard") match.
 */
const WATCH_ROLE_PATTERN =
  /\b(guard|watch(?:man|men)?|constable|sentinel|sentry|soldier|militia|gendarme|warden)\b/i;

/** True when a role string names a member of the town watch. */
export function isWatchRole(role: string | undefined | null): boolean {
  if (!role) return false;
  return WATCH_ROLE_PATTERN.test(role);
}

/** True when any of the situation's NPCs is a member of the town watch. */
export function situationHasWatch(npcs: readonly SituationNPC[] | undefined): boolean {
  return !!npcs?.some((n) => isWatchRole(n.role));
}

/**
 * Whether the player is currently wanted in a specific town/location.
 *
 * The honest per-town signal is a WITNESSED crime recorded against that
 * location: bounties carry no location, and local heat caps below any single-
 * incident threshold, so the crime record is the truthful arrest-on-sight flag.
 * A watch fight records exactly such a crime (see {@link deriveWatchReaction}).
 */
export function isWantedInTown(
  crimes: readonly Crime[] | undefined,
  locationId: string | undefined,
): boolean {
  if (!crimes || !locationId) return false;
  return crimes.some((c) => c.witnessed && c.locationId === locationId);
}

/** The disposition hit every townsperson takes when the player fights the watch. */
export const WATCH_FIGHT_DISPOSITION_PENALTY = -25;

/** The crime severity (1-100 scale) recorded for fighting the watch. */
export const WATCH_FIGHT_CRIME_SEVERITY = 60;

export interface WatchReaction {
  /** Ids of the watch NPCs the player fought (subset of the situation NPCs). */
  watchNpcIds: string[];
  /** The crime to record against the player, keyed to this town. */
  crime: {
    type: CrimeType;
    locationId: string;
    /** 1-100 severity; the crime reducer normalizes + turns it into heat/bounty. */
    severity: number;
    witnessed: boolean;
    victimId?: string;
  };
  /** How far every townsperson's disposition toward the player should fall. */
  dispositionPenalty: number;
  /** One-line adventure-log summary. */
  logSummary: string;
}

/**
 * Decide the watch reaction owed for a finished HOSTILE opening battle.
 *
 * Returns `null` when no reaction is owed:
 *   - the opening was not hostile, or
 *   - none of the scene NPCs were the town watch (e.g. bandits, a duel), or
 *   - there is no town/location to key the reaction to.
 *
 * When a watch member is present, the fight is treated as a witnessed Assault
 * (Murder if any watch NPC died — the caller passes `defeatedWatchDied`) in the
 * given town, which the crime reducer converts into the WANTED signal.
 */
export function deriveWatchReaction(
  situation: OpeningSituation | null | undefined,
  locationId: string | undefined | null,
  opts: { openingWasHostile: boolean; watchNpcDied?: boolean } = { openingWasHostile: false },
): WatchReaction | null {
  if (!opts.openingWasHostile) return null;
  if (!situation || !locationId) return null;

  const watchNpcs = (situation.npcs ?? []).filter((n) => isWatchRole(n.role));
  if (watchNpcs.length === 0) return null;

  const type = opts.watchNpcDied ? CrimeType.Murder : CrimeType.Assault;
  const watchNpcIds = watchNpcs.map((n) => n.id);

  return {
    watchNpcIds,
    crime: {
      type,
      locationId,
      severity: WATCH_FIGHT_CRIME_SEVERITY,
      witnessed: true,
      victimId: watchNpcIds[0],
    },
    dispositionPenalty: WATCH_FIGHT_DISPOSITION_PENALTY,
    logSummary:
      type === CrimeType.Murder
        ? 'Killed a member of the town watch — you are now wanted here.'
        : 'Fought the town watch — you are now wanted here.',
  };
}

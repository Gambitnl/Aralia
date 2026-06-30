/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/gameEntry/openingQuest.ts
 *
 * Turns the freshly-generated opening {@link OpeningSituation} into a real, logged
 * quest so the predicament has STAKES the player can act on — instead of being a
 * conversation that leads nowhere. The quest lands in the journal the moment the
 * scene resolves; its single objective closes once the player engages the people
 * the predicament is about (wired in the talk handler).
 *
 * Pure + deterministic given (situation, place); the runtime id is fixed
 * (`OPENING_QUEST_ID`) so the talk handler can find and advance it without
 * threading the situation around.
 */

import type { Quest } from '../../types';
import { QuestStatus } from '../../types';
import type { OpeningSituation } from './types';

/** Stable id so the talk handler can resolve + complete the opening quest. */
export const OPENING_QUEST_ID = 'opening-situation';
/** The single objective id, completed when the player engages the strangers. */
export const OPENING_QUEST_OBJECTIVE_ID = 'engage';

/** Strip a "Place, Region" header down to just the place for a tight title. */
function shortPlace(place: string | undefined): string {
  if (!place) return 'here';
  return place.split(',')[0].trim() || 'here';
}

/**
 * Build the opening quest from a resolved situation. The objective is phrased so
 * that talking to those involved is a sensible way to complete it.
 */
export function buildOpeningQuest(situation: OpeningSituation, placeName?: string): Quest {
  const place = shortPlace(placeName ?? situation.setting?.place);
  const names = situation.npcs.map((n) => n.name).filter(Boolean);
  const who =
    names.length === 0
      ? 'those caught up in it'
      : names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

  return {
    id: OPENING_QUEST_ID,
    title: `A Situation in ${place}`,
    description: situation.predicament,
    giverId: 'situation',
    objectives: [
      {
        id: OPENING_QUEST_OBJECTIVE_ID,
        description: `Engage with ${who}.`,
        isCompleted: false,
      },
    ],
    rewards: { xp: 50 },
    questType: 'Side',
    regionHint: place,
    status: QuestStatus.Active,
    dateStarted: Date.now(),
    dateCompleted: undefined,
  };
}

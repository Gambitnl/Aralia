/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/world/chronicleNewsToRumors.ts
 * Pure bridge: turn a tracked town's substantial recent news (TownNewsItem[])
 * into WorldRumors so the existing TavernGossipSystem can surface them for
 * purchase. The converter is the only place that maps the living-world
 * chronicle vocabulary onto the rumor schema.
 *
 * Deterministic and side-effect free. Stable ids (`chronicle-<loc>-<eventId>`)
 * let the reducer dedup by id, so re-running the sync on the same news never
 * produces duplicate rumors.
 */
import type { WorldRumor } from '../../types/world';
import type { LifeEventKind } from '../../systems/worldforge/townsim/types';
import type { TownNewsItem, NewsProminence } from '../../systems/worldforge/townsim/townNews';

/**
 * How long (in game days) a chronicle-sourced rumor stays buyable, measured from
 * the day it is FIRST synced. Ids are stable and the ADD_RUMORS reducer dedups by
 * id (no upsert), so re-syncing the same event does NOT roll this window forward —
 * expiration is anchored to first sight, not the latest sync.
 */
const RUMOR_LIFESPAN_DAYS = 30;

/** Map a chronicle event kind onto the rumor's coarse category. */
const KIND_TO_TYPE: Record<LifeEventKind, WorldRumor['type']> = {
  economy: 'market',
  disaster: 'event',
  death: 'event',
  role_succession: 'event',
  birth: 'misc',
  inheritance: 'misc',
  came_of_age: 'misc',
  courtship: 'misc',
  marriage: 'misc',
  festival: 'misc',
};

/** How likely a rumor is to spread, derived from how loudly its news travels. */
const PROMINENCE_TO_VIRALITY: Record<NewsProminence, number> = {
  headline: 0.9,
  notice: 0.6,
  gossip: 0.3,
};

/**
 * Convert recent town news into WorldRumors anchored to the given location.
 *
 * Pure: ids are stable (so the reducer can dedup), expiration is `currentDay +
 * 30`, and spreadDistance is 0 because the rumor originates at this town.
 */
export function chronicleNewsToRumors(
  news: TownNewsItem[],
  currentDay: number,
  locationId: string,
): WorldRumor[] {
  return news.map((item) => ({
    id: `chronicle-${locationId}-${item.id}`,
    text: item.text,
    type: KIND_TO_TYPE[item.kind],
    timestamp: item.day,
    expiration: currentDay + RUMOR_LIFESPAN_DAYS,
    locationId,
    spreadDistance: 0,
    virality: PROMINENCE_TO_VIRALITY[item.prominence],
  }));
}

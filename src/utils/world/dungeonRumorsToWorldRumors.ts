/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/world/dungeonRumorsToWorldRumors.ts
 * Pure bridge (Pillar 2, Task 7): turn the dungeon rumors that reach a burg
 * (BurgRumor[], from `rumorsForBurg`) into WorldRumors so the EXISTING
 * TavernGossipSystem surfaces them for purchase — the same path town-chronicle
 * news already rides via `chronicleNewsToRumors`. This is the only place that
 * maps the dungeon-lore rumor vocabulary onto the WorldRumor schema.
 *
 * Deterministic and side-effect free. Stable ids
 * (`dungeon-<loc>-<sitePath>-<eventRef>`) let the ADD_RUMORS reducer dedup by id,
 * so re-running the sync on the same burg never produces duplicate rumors.
 */
import type { WorldRumor } from '../../types/world';
import type { BurgRumor } from '../../systems/worldforge/dungeon/world/rumors';

/**
 * How long (in game days) a dungeon rumor stays buyable, measured from the day it
 * is FIRST synced. Ids are stable and the ADD_RUMORS reducer dedups by id, so
 * re-syncing does NOT roll this window forward — expiration is anchored to first
 * sight. Matches the chronicle-rumor lifespan for a consistent tavern board.
 */
const RUMOR_LIFESPAN_DAYS = 30;

/**
 * Convert the dungeon rumors reaching a burg into WorldRumors anchored to the
 * player's current location.
 *
 * Pure: ids are stable (so the reducer can dedup), expiration is `currentDay +
 * 30`, `type` is 'event' (a dungeon's history is a happening, not a market/
 * skirmish move), and spreadDistance is 0 because the rumor is heard here.
 */
export function dungeonRumorsToWorldRumors(
  rumors: BurgRumor[],
  currentDay: number,
  locationId: string,
): WorldRumor[] {
  return rumors.map((r) => ({
    id: `dungeon-${locationId}-${r.sitePath}-${r.eventRef}`,
    text: r.text,
    type: 'event' as const,
    timestamp: currentDay,
    expiration: currentDay + RUMOR_LIFESPAN_DAYS,
    locationId,
    spreadDistance: 0,
    // A dungeon rumor is a fixed local legend, not spreading news — it stays put.
    virality: 0,
  }));
}

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
 * Convert the dungeon rumors reaching a burg into WorldRumors anchored to the
 * player's current location.
 *
 * Pure: ids are stable (so the reducer can dedup), expiration is `currentDay +
 * 30`, `type` is 'event' (a dungeon's history is a happening, not a market/
 * skirmish move), and spreadDistance is 0 because the rumor is heard here.
 */
export declare function dungeonRumorsToWorldRumors(rumors: BurgRumor[], currentDay: number, locationId: string): WorldRumor[];

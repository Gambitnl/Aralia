/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 17:49:10
 * Dependents: hooks/useChronicleRumorsSync.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
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
import type { TownNewsItem } from '../../systems/worldforge/townsim/townNews';
/**
 * Convert recent town news into WorldRumors anchored to the given location.
 *
 * Pure: ids are stable (so the reducer can dedup), expiration is `currentDay +
 * 30`, and spreadDistance is 0 because the rumor originates at this town.
 */
export declare function chronicleNewsToRumors(news: TownNewsItem[], currentDay: number, locationId: string): WorldRumor[];

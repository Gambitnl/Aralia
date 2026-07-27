/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:35:28
 * Dependents: provenanceUtils.ts, world/index.ts
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
 * @file src/utils/provenanceUtils.ts
 * Utility functions for managing item history and provenance.
 * "If they don't remember, it didn't happen." - Recorder
 */
import { Item } from '../../types/items';
import { ItemProvenance, ProvenanceEventType } from '../../types/provenance';
import { GameDate } from '../../types/memory';
/**
 * Creates an empty provenance record for a newly created item.
 * @param creator The ID of the creator (e.g., "player_1", "npc_blacksmith").
 * @param date The current game date.
 * @param originalName Optional original name of the item when crafted.
 * @returns A new ItemProvenance object.
 */
export declare function createProvenance(creator: string, date: GameDate, originalName?: string): ItemProvenance;
/**
 * Adds a new event to an item's history.
 * @param item The item to update.
 * @param type The type of event.
 * @param description What happened.
 * @param date The current game date.
 * @param actorId Optional ID of the actor involved.
 * @param locationId Optional ID of where the event happened.
 * @returns A new Item object with the updated provenance.
 */
export declare function addProvenanceEvent(item: Item, type: ProvenanceEventType, description: string, date: GameDate, actorId?: string, locationId?: string): Item;
/**
 * Generates a legendary history for a found item.
 * @param item The item to generate history for.
 * @param date The current game date (to backtrack from).
 * @returns A new Item object with a rich history.
 */
export declare function generateLegendaryHistory(item: Item, date: GameDate): Item;

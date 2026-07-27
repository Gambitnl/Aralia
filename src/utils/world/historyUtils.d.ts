/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:35:20
 * Dependents: WorldEventManager.ts, historyUtils.ts, world/index.ts
 * Imports: 1 files
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
 * @file src/utils/historyUtils.ts
 * Utility functions for managing and retrieving world history events.
 * Provides the functional interface for the World History memory system.
 */
import { WorldHistory, WorldHistoryEvent } from '../../types/history';
/**
 * Initializes an empty WorldHistory if one doesn't exist.
 */
export declare function createEmptyHistory(): WorldHistory;
/**
 * Enforces the Bounded Importance-Aware Retention policy.
 * - Soft Cap: 1000 events
 * - Buffer: Pruning triggers at > 1100 events
 * - Protection: importance >= 80 are never pruned
 * - Pruning Logic: removes oldest unprotected events
 */
export declare function pruneHistory(history: WorldHistory): WorldHistory;
/**
 * Adds a new event to the world history.
 * @param history The current world history.
 * @param event The event to add.
 * @returns A new WorldHistory object with the added event.
 */
export declare function addHistoryEvent(history: WorldHistory, event: WorldHistoryEvent): WorldHistory;
/**
 * Retrieves history events filtered by tags and minimum importance.
 * Useful for querying specific topics (e.g., "Tell me about the 'dragon' wars").
 *
 * @param history The world history.
 * @param tags Array of tags to filter by (OR logic: match any). If empty, ignores tag filter.
 * @param minImportance Minimum importance score (0-100) to include.
 * @returns Array of matching events, sorted by timestamp (newest first).
 */
export declare function getRelevantHistory(history: WorldHistory, tags?: string[], minImportance?: number): WorldHistoryEvent[];
/**
 * Finds all historical events involving a specific entity (Faction, NPC, or Player).
 *
 * @param history The world history.
 * @param entityId The ID of the participant.
 * @returns Array of events where the entity was a participant.
 */
export declare function findEventsByParticipant(history: WorldHistory, entityId: string): WorldHistoryEvent[];
/**
 * Finds events that occurred at a specific location.
 *
 * @param history The world history.
 * @param locationId The ID of the location.
 * @returns Array of events at that location.
 */
export declare function findEventsByLocation(history: WorldHistory, locationId: string): WorldHistoryEvent[];
/**
 * Finds events that occurred within a chronological range, inclusive of both bounds.
 * The `timestamp` field is the numeric game day, so this powers timeline slices and replay.
 *
 * @param history The world history.
 * @param startDay The earliest game day to include (inclusive).
 * @param endDay The latest game day to include (inclusive).
 * @returns Array of events within [startDay, endDay], sorted by timestamp (newest first).
 */
export declare function findEventsByDateRange(history: WorldHistory, startDay: number, endDay: number): WorldHistoryEvent[];

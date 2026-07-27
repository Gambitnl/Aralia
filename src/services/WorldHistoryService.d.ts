/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 13:02:31
 * Dependents: systems/world/WorldEventManager.ts
 * Imports: 5 files
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
 * @file src/services/WorldHistoryService.ts
 * Service for converting real-time game outcomes into permanent historical records.
 */
import { WorldHistoryEvent } from '../types/history';
import { Faction } from '../types/factions';
export interface FirstBuildHistorySeed {
    worldSeed: number;
    factions: Record<string, Faction>;
    settlingLocationHints?: string[];
    worldBirthTime?: Date;
}
export declare class WorldHistoryService {
    /**
     * Builds a deterministic first-build world history contract for map/game initialization.
     *
     * This does not mutate source-of-truth geometry data (it only consumes inputs and
     * emits an additive history payload) so it preserves the current 2D/3D split.
     */
    static createFirstBuildHistory(seedInput: FirstBuildHistorySeed): {
        events: WorldHistoryEvent[];
    };
    private static makeEventId;
    private static makeFactionParticipant;
    private static pickFaction;
    /**
     * Base importance assigned to a skirmish when no strength signal is available.
     * Also the floor the derived importance is measured up from.
     */
    private static readonly SKIRMISH_BASE_IMPORTANCE;
    /** Importance is clamped to this band so a single clash never dominates the ledger. */
    private static readonly SKIRMISH_MIN_IMPORTANCE;
    private static readonly SKIRMISH_MAX_IMPORTANCE;
    /**
     * Derives how memorable a skirmish is from the strength gap between the
     * combatants, using the `power` field the Faction model already exposes
     * (0-100 overall influence/strength).
     *
     * The wider the gap, the more the clash reshapes the balance of power — a
     * lopsided rout or a stunning upset is a far more notable historical event
     * than an even trade of blows, so the importance-aware pruner should keep it
     * longer. When neither faction exposes a usable numeric `power` we fall back
     * to the historical base importance (a no-op relative to the old hardcode).
     */
    private static deriveSkirmishImportance;
    /**
     * Converts a faction skirmish outcome into a WorldHistoryEvent.
     */
    static createSkirmishEvent(winner: Faction, loser: Faction, gameTime: Date): WorldHistoryEvent;
}

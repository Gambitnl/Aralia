/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 21/07/2026, 01:46:37
 * Dependents: services/saveLoadService.ts, state/reducers/worldReducer.ts, systems/worldforge/dungeon/world/dungeonGameplay.ts, systems/worldforge/dungeon/world/dungeonLevels.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file defines the durable lifecycle of one canonical world-grown dungeon.
 *
 * The world entrance already owns the dungeon's stable id and frozen seed path. This file keeps
 * that receipt beside additive expedition progress so save/load and later revisits address the
 * same place. It deliberately does not decide when an encounter is cleared, a route is opened,
 * treasure is claimed, or an objective is completed. It now also stores explored cell keys under
 * explicit level keys, allowing the diegetic sheet to survive save/load and revisit without
 * duplicating dungeon geometry. Compact level visit receipts now preserve stable child identities,
 * parent links, and transition coordinates while the large generated plans remain regenerable.
 * Future combat and completion systems must still supply authoritative interaction identifiers.
 *
 * Called by: the world reducer, save migration, and focused dungeon lifecycle tests.
 * Depends on: the lightweight canonical receipt in dungeonIdentity.ts.
 */
import { type DungeonIdentity } from './dungeonIdentity';
export declare const DUNGEON_EXPEDITION_SCHEMA_VERSION: 3;
export type DungeonVisitPhase = 'active' | 'retreated';
export type DungeonCompletionState = 'incomplete' | 'completed';
export type DungeonObjectiveState = 'active' | 'completed';
/** Compact evidence that one deterministic generated page has been reached. */
export interface DungeonLevelVisitReceipt {
    levelId: string;
    depth: number;
    identity: DungeonIdentity;
    parentLevelId: string | null;
    entryCellKey: string;
    parentReturnCellKey?: string;
    downTransitionCellKey?: string;
    bossObjectiveCellKey?: string;
}
export interface DungeonProgressState {
    /** Stable encounter keys reported by future playable-room combat. */
    clearedEncounterIds: string[];
    /** Stable door, passage, or route keys reported by future interaction gameplay. */
    openedRouteIds: string[];
    /** Stable treasure keys reported by future loot interaction gameplay. */
    claimedTreasureIds: string[];
    /** Known objective keys and their latest durable state. */
    objectives: Record<string, DungeonObjectiveState>;
    /** Explored canonical grid-cell keys grouped by a forward-compatible dungeon level key. */
    exploredCellKeysByLevel: Record<string, string[]>;
    /** Reached child pages and their reliable parent-return coordinates, keyed by level id. */
    levelVisits: Record<string, DungeonLevelVisitReceipt>;
}
export interface DungeonExpeditionRecord {
    schemaVersion: typeof DUNGEON_EXPEDITION_SCHEMA_VERSION;
    identity: DungeonIdentity;
    /** Explicit proof that the canonical entrance has been used at least once. */
    hasEntered: true;
    /** Whether the current visit is open or the party last returned to the world. */
    visitPhase: DungeonVisitPhase;
    /** Completion never resets merely because the dungeon is entered again. */
    completion: DungeonCompletionState;
    /** Starts at one on first entry and increments for every later entry. */
    visitCount: number;
    /** Stored explicitly for consumers that should not reproduce visit-count policy. */
    hasRevisited: boolean;
    progress: DungeonProgressState;
}
export type DungeonExpeditionLedger = Record<string, DungeonExpeditionRecord>;
export interface DungeonProgressPatch {
    clearedEncounterIds?: readonly string[];
    openedRouteIds?: readonly string[];
    claimedTreasureIds?: readonly string[];
    objectives?: Readonly<Record<string, DungeonObjectiveState>>;
    exploredCellKeysByLevel?: Readonly<Record<string, readonly string[]>>;
    levelVisits?: Readonly<Record<string, DungeonLevelVisitReceipt>>;
}
export declare function createEmptyDungeonProgress(): DungeonProgressState;
export declare function enterDungeonExpedition(identity: DungeonIdentity, previous?: DungeonExpeditionRecord): DungeonExpeditionRecord;
export declare function recordDungeonProgress(previous: DungeonExpeditionRecord, patch: DungeonProgressPatch): DungeonExpeditionRecord;
export declare function retreatDungeonExpedition(previous: DungeonExpeditionRecord): DungeonExpeditionRecord;
export declare function completeDungeonExpedition(previous: DungeonExpeditionRecord): DungeonExpeditionRecord;
export declare function normalizeDungeonExpeditionLedger(value: unknown): DungeonExpeditionLedger;

/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 14/07/2026, 18:49:41
 * Dependents: components/World3D/World3DWrapper.tsx, systems/worldforge/interior/buildingExtensions.ts, systems/worldforge/interior/generateBuilding.ts, systems/worldforge/townsim/buildingHistoryCompaction.ts, systems/worldforge/townsim/townSim.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { AppliedBuildingHistory, BlueprintPlan, BuildingEvent, BuildingEventHistory, BuildingHistoryJournalV1, SnapshottedStructuralBuildingEvent } from './blueprintTypes';
/** A legacy array has no folded prefix; version is the reliable journal discriminator. */
export declare function isBuildingHistoryJournal(history: BuildingEventHistory | readonly BuildingEvent[] | undefined): history is BuildingHistoryJournalV1;
/** Number of chronological events represented by either save shape. */
export declare function buildingHistoryEventCount(history: BuildingEventHistory | readonly BuildingEvent[] | undefined): number;
/** Fixed digest that remains identical before and after prefix compaction. */
export declare function buildingHistoryEventDigest(history: BuildingEventHistory | readonly BuildingEvent[] | undefined): string;
/** Stable memo identity for either save-side history representation. */
export declare function buildingEventLogDigest(history: BuildingEventHistory | readonly BuildingEvent[] | undefined): string;
/** Structural additions with the absolute ordinals expected by footprint replay. */
export declare function structuralBuildingHistoryEvents(history: BuildingEventHistory | readonly BuildingEvent[] | undefined): SnapshottedStructuralBuildingEvent[];
/** Current use state without reconstructing renderer targets. */
export declare function currentBuildingUse(history: BuildingEventHistory | readonly BuildingEvent[] | undefined): AppliedBuildingHistory['status'];
/** Current use plus the day that state began, retained across compaction. */
export declare function buildingUseStateSince(history: BuildingEventHistory | readonly BuildingEvent[] | undefined): {
    status: AppliedBuildingHistory['status'];
    sinceDay: number | null;
};
/** Whether fire damage survives the latest repair in either representation. */
export declare function hasUnrepairedBuildingFire(history: BuildingEventHistory | readonly BuildingEvent[] | undefined): boolean;
/** Deep clone save history before the pure town reducer mutates its tail. */
export declare function cloneBuildingEventHistory(history: BuildingEventHistory | readonly BuildingEvent[]): BuildingEventHistory;
/**
 * Append one event without mutation. Fire incident ids are idempotent per log,
 * which prevents a multi-victim household from recording the same fire twice.
 */
export declare function appendBuildingEvent(history: BuildingEventHistory | readonly BuildingEvent[] | undefined, event: BuildingEvent): BuildingEventHistory;
/**
 * Replay an ordered event log over a canonical plan and return a new plan.
 * Empty logs are a byte-compatible no-op for legacy callers.
 */
export declare function applyHistory(plan: BlueprintPlan, history: BuildingEventHistory | readonly BuildingEvent[]): BlueprintPlan;
/**
 * Fold an already resolved plan into a version 1 journal with an empty tail.
 * The caller supplies the exact plan produced from the full history, avoiding
 * any second generator path that could drift from household or district input.
 */
export declare function snapshotBuildingHistory(resolvedPlan: BlueprintPlan, history: BuildingEventHistory | readonly BuildingEvent[]): BuildingHistoryJournalV1;

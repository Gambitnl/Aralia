/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/07/2026, 01:52:10
 * Dependents: components/DesignPreview/steps/PreviewBlueprint.tsx, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/interior/generateInterior.ts
 * Imports: 15 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file generateBuilding.ts — assemble a full multi-floor BlueprintPlan.
 *
 * Task 8 of the Building Blueprint Pipeline. Composes the Task 2–7 modules
 * (footprint → partition → program → doors → walls → furnish) per floor:
 *   - all floors share the SAME footprint
 *   - ground floor (level 0) partitions with keepMainWhole: true
 *   - upper floors are sleeping quarters (bedrooms / guest rooms)
 *   - the basement (level -1) is cellars / storage, keepMainWhole: false
 *   - ONE stair shaft at the ground main room's center cell, same (x, y) on
 *     every level; the shaft cell is passed to furnishRooms as blocked on
 *     every floor it touches
 *   - basement floors get NO windows (underground)
 *
 * Deterministic: each floor seeds from childSeedPath(path, 'floor:<level>').
 * Memoized per (seedPath, type, storeys, basement) exactly as
 * generateInterior memoizes per plot key. Pure data — no three.js.
 */
import type { BlueprintPlan, BuildingBackstory, BuildingEvent, BuildingEventHistory, BuildingEnsemble, BuildingType, HouseholdBrief, StyleContext } from './blueprintTypes';
import { type SeedPath } from '../seedPath';
/** Storey height in feet — the canonical per-floor height for the whole
 *  building pipeline. MIRRORS BLUEPRINT_STOREY_FT in
 *  systems/world3d/buildingModels.ts. Duplicated (not imported) so worldforge
 *  never depends on the world3d/three.js layer; keep the two in lockstep. */
export declare const BLUEPRINT_STOREY_FT = 10;
/**
 * Shell height in meters for `storeys` above-grade floors. The single source
 * the 3D bridge sizes building shells to, so the rendered wall top matches the
 * feet-canon wall top the roof solver used (storeys × BLUEPRINT_STOREY_FT).
 */
export declare function buildingShellHeightM(storeys: number): number;
export interface GenerateBuildingInput {
    buildingId: number;
    type: BuildingType;
    seedPath: SeedPath;
    storeys?: number;
    basement?: boolean;
    /** Optional lot-fit caps (feet, 5 ft aligned expected). When the rolled
     *  footprint exceeds them it is clamped into the lot window (see
     *  clampFootprint) so the building never overhangs its plot (C3-T2). */
    maxWidthFt?: number;
    maxDepthFt?: number;
    /** Optional family the building is designed for. Drives ground-floor trade
     *  rooms + wealth extras and the bedroom distribution across floors. Omitted
     *  → the v1 (briefless) plan, byte-for-byte. */
    household?: HouseholdBrief;
    /** Town-authored row/courtyard/arcade instruction; geometry remains lot-bound. */
    ensemble?: BuildingEnsemble;
    /** Optional architectural style context (culture/climate/wealth/age). When
     *  present the plan gains a resolved dress (`styleResolved`) and a solved
     *  `roof`, then resolves permanent history from its age. Geometry below the
     *  wall-top remains untouched (style-identity invariant). */
    style?: StyleContext;
    /**
     * Optional replay/save override for an already-resolved permanent history.
     * Production normally omits it and receives a deterministic backstory from
     * the style age plus this building's canonical geometry.
     */
    backstory?: BuildingBackstory;
    /** Ordered save-side changes, either a legacy array or a compacted journal. */
    eventLog?: BuildingEventHistory | readonly BuildingEvent[];
}
/** Stable digest of a household brief for the memo key: two briefs that would
 *  yield different plans MUST produce different digests. Empty string when
 *  there is no brief (so briefless memo keys are unchanged). Must cover every
 *  brief field (homeId, slots with tag/role/ageBand, trade, worksAtHome,
 *  wealth) — homeId doesn't affect geometry but is echoed into the plan. */
export declare function briefDigest(brief: HouseholdBrief | undefined): string;
/**
 * Stable digest of a style context for the memo key.
 *
 * Two contexts that resolve to different district or building dress must never
 * share a cached plan. The four original fields keep their historical JSON
 * shape when no architecture identity is present, so standalone preview memo
 * keys remain unchanged. Identified production buildings append all three
 * identity scopes because each can change the roof or facade answer.
 */
export declare function styleDigest(style: StyleContext | undefined): string;
/** Include every permanent history target in memo identity when one is replayed. */
export declare function backstoryDigest(backstory: BuildingBackstory | undefined): string;
/** Include every ordered live event in memo identity without key-order drift. */
export declare function eventLogDigest(eventLog: BuildingEventHistory | readonly BuildingEvent[] | undefined): string;
/** Include the town-authored block contract in memo identity. A party-wall
 * instruction changes legal openings even when the footprint itself is equal. */
export declare function ensembleDigest(ensemble: BuildingEnsemble | undefined): string;
export declare function generateBuilding(input: GenerateBuildingInput): BlueprintPlan;

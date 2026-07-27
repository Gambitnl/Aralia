/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 08:57:40
 * Dependents: components/DesignPreview/steps/PreviewBattleMapScenarioLab.tsx, systems/combat/worldScenario/travelAmbushBattlefield.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file turns one real WorldForge location into a reproducible combat-map
 * scenario and explains what survived the projection.
 *
 * WorldForge remains authoritative: callers assemble a GroundWorld through the
 * normal World -> Region -> Local -> Ground pipeline, then this adapter cuts the
 * five-foot tactical patch used by the existing combat engine. The visual test
 * harness consumes the returned diagnostics so missing bridges such as roads or
 * targetable object facts are visible instead of being disguised by extra art.
 *
 * Called by: PreviewBattleMapScenarioLab.tsx after the off-thread world builder
 * Depends on: groundChunkLoader's production terrain-patch extractor
 */
import type { BattleMapBiome, BattleMapData, BattleMapDecoration, BattleMapEncounterContext, BattleMapSettlementHostility, BattleMapTerrain } from "@/types/combat";
import { type GroundOccupantProjectionInput, type GroundWorld } from "@/systems/worldforge/bridge/groundChunkLoader";
import { type SettlementEncounterHostilityInput } from "./settlementEncounterHostility";
export interface WorldBattleScenarioPreset {
    id: string;
    label: string;
    encounterFrame: string;
    description: string;
    worldSeed: number;
    entryCellId: number;
    centerPx?: readonly [number, number];
    /** Fractional world clock used for source residents and visual reproducibility. */
    hour?: number;
    theme: BattleMapBiome;
    dimensions: {
        width: number;
        height: number;
    };
    /** How the tactical crop chooses its exact location inside the generated ground window. */
    anchorMode?: "ground-center" | "nearest-road" | "nearest-crossing" | "nearest-gatehouse";
    /** Machine-readable encounter framing expected from the selected world fact. */
    encounterKind?: BattleMapEncounterContext["kind"];
    /** Deterministic non-world fixture available only when the visual harness opts in. */
    visualHostilityFixture?: "wanted-watch-confrontation" | "hostile-state-standing";
    /** Explicit model-roster substitute used only to render a hostile opening in the lab. */
    visualOpeningThreatFixture?: ReadonlyArray<{
        name: string;
        quantity: number;
        cr: string;
    }>;
    /** Lab-only proof that redraws this opening from its first saved receipt. */
    visualReplayOpeningReceipt?: boolean;
    /** Lab-only mixed downed/withdrawn result used to inspect a return visit. */
    visualOpeningResolutionFixture?: "mixed-party-victory";
    sourceRouteQuery: string;
}
export declare const WORLD_BATTLE_SCENARIO_PRESETS: readonly WorldBattleScenarioPreset[];
export type WorldBattleParityStatus = "pass" | "warning" | "gap";
export interface WorldBattleParityCheck {
    id: string;
    label: string;
    status: WorldBattleParityStatus;
    detail: string;
}
export interface WorldBattleSourceFacts {
    naturalFeatures: number;
    placedProps: number;
    /** Source feature anchors whose nearest five-foot cell lies in this crop. */
    naturalFeaturesInCrop: number;
    /** Source prop footprints that touch at least one five-foot cell in this crop. */
    placedPropsInCrop: number;
    roadRuns: number;
    regionalRoadRuns: number;
    townStreetRuns: number;
    riverRuns: number;
    crossings: number;
    bridges: number;
    fords: number;
    buildings: number;
    buildingsInCrop: number;
    gatehouses: number;
    gatehousesInCrop: number;
    towns: number;
    hostiles: number;
    occupants: number;
    occupantsInCrop: number;
    movingOccupantsInCrop: number;
}
export interface WorldBattleTacticalFacts {
    tiles: number;
    blockedTiles: number;
    coverTiles: number;
    decoratedTiles: number;
    targetableObjects: number;
    targetableFeatures: number;
    targetableProps: number;
    incompleteTargetFacts: number;
    worldOccupants: number;
    occupiedOccupantCells: number;
    movingOccupants: number;
    occupantsOnBlockedTiles: number;
    roadTiles: number;
    regionalRoadTiles: number;
    townStreetTiles: number;
    passableRoadTiles: number;
    crossingTiles: number;
    bridgeTiles: number;
    fordTiles: number;
    passableCrossingTiles: number;
    encounterContext: BattleMapEncounterContext["kind"] | null;
    terrain: Record<BattleMapTerrain, number>;
    decorations: Partial<Record<Exclude<BattleMapDecoration, null>, number>>;
}
export interface WorldBattleScenarioDiagnostics {
    source: WorldBattleSourceFacts;
    tactical: WorldBattleTacticalFacts;
    defense: WorldBattleDefenseFacts;
    parity: WorldBattleParityCheck[];
}
export interface WorldBattleDefenseFacts {
    stateName: string | null;
    stateFullName: string | null;
    stateAlert: number | null;
    stationedRegiments: number;
    stationedTroops: number;
    selectedRegiment: string | null;
    selectedRegimentTroops: number;
    tacticalActors: number;
    tacticalUnits: string[];
    excludedUnits: string[];
    hostility: {
        verdict: BattleMapSettlementHostility["verdict"] | "none";
        rule: BattleMapSettlementHostility["rule"] | "none";
        triggerKind: BattleMapSettlementHostility["trigger"]["kind"];
        triggerSource: BattleMapSettlementHostility["trigger"]["source"];
        triggerSummary: string;
        relationKind: BattleMapSettlementHostility["relation"]["kind"];
        relationSummary: string;
        detail: string;
        inputKind: "visual-harness-fixture" | "live-player-state" | "none";
    };
}
export interface WorldBattleScenario {
    key: string;
    preset: WorldBattleScenarioPreset;
    locationLabel: string;
    mapData: BattleMapData;
    diagnostics: WorldBattleScenarioDiagnostics;
}
export interface WorldBattleScenarioOptions {
    /** Live callers can provide the current confrontation and player relation. */
    settlementHostility?: SettlementEncounterHostilityInput;
    /** Developer-only switch that enables the preset's deterministic player-state fixture. */
    useVisualHostilityFixture?: boolean;
}
export declare function summarizeWorldBattleScenario(ground: GroundWorld, mapData: BattleMapData, sourceOccupants?: readonly GroundOccupantProjectionInput[]): WorldBattleScenarioDiagnostics;
export declare function createWorldBattleScenarioFromGround(preset: WorldBattleScenarioPreset, ground: GroundWorld, options?: WorldBattleScenarioOptions): WorldBattleScenario;

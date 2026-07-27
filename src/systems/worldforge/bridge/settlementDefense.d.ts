/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 07:47:45
 * Dependents: systems/combat/worldScenario/settlementDefenderProjection.ts, systems/combat/worldScenario/settlementEncounterHostility.ts, systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
export interface GroundSettlementDefenseUnit {
    unitType: string;
    count: number;
}
export interface GroundSettlementRegiment {
    sourceIndex: number;
    name: string;
    totalTroops: number;
    sourceCellId: number;
    sourceAtlasPoint: {
        x: number;
        y: number;
    };
    naval: boolean;
    units: GroundSettlementDefenseUnit[];
}
export interface GroundSettlementDefense {
    burgId: number;
    burgName: string;
    /** Canonical atlas cell used by player location, crime, and encounter systems. */
    sourceCellId: number;
    stateId: number;
    stateName: string;
    stateFullName: string;
    stateForm: string;
    /** FMG's generated preparedness multiplier for the controlling state. */
    stateAlert: number;
    capital: boolean;
    walled: boolean;
    citadel: boolean;
    stationedRegiments: GroundSettlementRegiment[];
}
export declare function settlementDefenseForBurg(worldSeed: number, burgId: number): GroundSettlementDefense | null;

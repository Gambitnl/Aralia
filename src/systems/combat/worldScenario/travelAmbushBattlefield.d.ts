/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 23:03:24
 * Dependents: App.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file travelAmbushBattlefield.ts
 * Projects one committed land-travel encounter onto the destination's real
 * WorldForge road instead of asking combat to invent an arena.
 *
 * World generation remains outside this pure adapter. The caller must supply a
 * complete GroundWorld built from the exact destination cell, seed, saved
 * deltas, and arrival anchor. This module then applies the same production
 * Ground -> Tactical extractor and road-framing policy used by the World Battle
 * Lab. A destination without a source road returns a source gap; it never falls
 * back to center-relative or procedural terrain.
 */
import type { BattleMapBiome, BattleMapData } from '@/types/combat';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { type WorldBattleScenarioDiagnostics } from './worldBattleScenario';
export interface TravelAmbushBattlefieldInput {
    worldSeed: number;
    destinationCellId: number;
    destinationCenterPx?: readonly [number, number];
    routeCells: readonly number[];
    hour: number;
    dimensions?: {
        width: number;
        height: number;
    };
}
export type TravelAmbushBattlefieldResult = {
    status: 'ready';
    mapData: BattleMapData;
    diagnostics: WorldBattleScenarioDiagnostics;
    sourceRouteId: string;
} | {
    status: 'source-gap';
    detail: string;
    sourceRouteId: string;
};
/** Use the source biome only for continuous tactical surface treatment. */
export declare function battleMapThemeForGround(ground: GroundWorld): BattleMapBiome;
/** Stable travel-event lineage retained on provenance and diagnostics. */
export declare function travelRouteSourceId(routeCells: readonly number[]): string;
/**
 * Produce a playable road ambush only when the destination GroundWorld proves
 * the exact source road needed for route-aware deployment.
 */
export declare function createTravelAmbushBattlefield(ground: GroundWorld, input: TravelAmbushBattlefieldInput): TravelAmbushBattlefieldResult;

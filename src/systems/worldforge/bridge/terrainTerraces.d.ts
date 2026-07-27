/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 22:40:11
 * Dependents: systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { BuildingEnsembleKind } from '../interior/blueprintTypes';
/** One architectural storey is the readable terrace increment. */
export declare const TERRACE_STEP_M = 3;
export declare const TERRACE_STEP_ENCODED: number;
export interface TerrainPadCandidate {
    id: string;
    rawHeightEncoded: number;
    order: number;
    blockKey?: string;
    ensembleKind?: BuildingEnsembleKind;
}
export interface TerrainTerraceReceipt {
    blockKey: string;
    /** Signed storey step relative to the block's first frontage member. */
    stepIndex: number;
    padHeightEncoded: number;
    terraceSignature: string;
}
export interface TerrainPadResolution {
    padHeightEncoded: number;
    terrace?: TerrainTerraceReceipt;
}
/**
 * Resolve attached groups transactionally. A row is negotiated only when it
 * has several members and no raw neighbor jump exceeds two storeys; otherwise
 * every member keeps the historical centroid pad exactly.
 */
export declare function resolveTerrainTerraces(candidates: readonly TerrainPadCandidate[]): Map<string, TerrainPadResolution>;

/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/07/2026, 18:18:45
 * Dependents: components/World3D/WebGPUProbeScene.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file converts streamed World3D building boxes into renderer-friendly batches.
 *
 * Worldforge still owns every building, room and furnishing as individual canonical
 * data. This helper only changes their presentation: boxes that share a colour can
 * share one GPU mesh while retaining their own size, position, rotation and stable
 * source identity. WebGPUProbeScene consumes these records when it builds instanced
 * meshes; no generator, collision or gameplay state depends on this file.
 */
import type { LoadedChunk } from './types';
type StreamedSite = LoadedChunk['bundle']['sites'][number];
export interface SiteBoxBatchInstance {
    /** Stable lookup back to the building and original part index. */
    sourceId: string;
    /** Chunk-local centre after applying the building's authored yaw. */
    x: number;
    y: number;
    z: number;
    /** The building yaw remains per instance, so street alignment stays unique. */
    rotationY: number;
    /** Authored box dimensions in metres. */
    width: number;
    height: number;
    depth: number;
}
export interface SiteBoxBatch {
    /** Exact generated colour used by every box in this draw bucket. */
    colorHex: string;
    instances: SiteBoxBatchInstance[];
}
export type SiteBoxDetail = 'full' | 'shell';
export type ScalableRoofForm = 'gable' | 'hip' | 'steep';
export interface SiteRoofBatchInstance {
    sourceId: string;
    x: number;
    y: number;
    z: number;
    rotationY: number;
    width: number;
    rise: number;
    depth: number;
    colorHex: string;
}
export interface SiteRoofBatch {
    form: ScalableRoofForm;
    instances: SiteRoofBatchInstance[];
}
/**
 * Prepare every visible site box for instancing.
 *
 * Detailed buildings keep every renderable part. Legacy buildings keep their
 * footprint shell, and non-building sites keep the same marker cube as before.
 * Marker-only settlement labels remain deliberately geometry-free.
 */
export declare function buildSiteBoxBatches(sites: readonly StreamedSite[], detail?: SiteBoxDetail): SiteBoxBatch[];
/**
 * Group scale-invariant roof forms while preserving every authored dimension.
 *
 * Flat parapets are deliberately excluded: their slab, lip and rim thicknesses
 * are absolute measurements, so scaling a unit mesh would distort the design.
 */
export declare function buildSiteRoofBatches(sites: readonly StreamedSite[]): SiteRoofBatch[];
export {};

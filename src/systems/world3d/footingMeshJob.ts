/** Build the existing near-foot drawing in a worker. This calls the same terrain
 * and paving refiners as the scene; it owns no world, collision or actor state.
 * Height samples are supplied by the canonical ground sampler at the worker edge. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 02:25:41
 * Dependents: components/World3D/World3DScene.tsx, components/World3D/footingMeshWorker.ts, components/World3D/useFootingMeshes.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { TerrainFootingDetail } from './terrainFootingDetail';
import { refineTerrainForDetails } from './terrainFootingDetail';
import { refineRoadMeshForFooting, refineRoadMeshesForFooting, type FootingRoadMesh } from './roadGeometry';
import type { TerrainMesh } from './types';
import { WORLD3D_CONFIG } from './config';

/** Geometry is a renderer resource, not UI data. Keep its large arrays behind
 * a private slot so component timing/inspection does not enumerate millions of
 * numeric properties when a new window arrives. The original arrays remain
 * directly available to the renderer; no sample, face or diagnostic is removed. */
export class DrawingMesh<T> {
  #value: T;
  constructor(value: T) { this.#value = value; }
  get value(): T { return this.#value; }
}

export type FootingDetailSpec = Omit<TerrainFootingDetail, 'heightAt'>;
export interface FootingMeshInput {
  key: string;
  cx: number;
  cy: number;
  terrain: TerrainMesh;
  roads?: FootingRoadMesh;
  roadVerges?: FootingRoadMesh;
}
export interface FootingMeshOutput {
  key: string;
  terrain: TerrainMesh;
  roads: FootingRoadMesh[];
  roadVerges?: FootingRoadMesh;
}
export interface FootingMeshRequest {
  id: number;
  chunks: FootingMeshInput[];
  terrainDetails: FootingDetailSpec[];
  roadDetails: FootingDetailSpec[];
  refineVerges: boolean;
}

/** A whole admitted batch is published together, so paving and land never adopt
 * different requested windows. Source arrays are read only throughout. */
export function buildFootingMeshes(request: FootingMeshRequest, heightAt: TerrainFootingDetail['heightAt']): FootingMeshOutput[] {
  const terrainDetails = request.terrainDetails.map(d => ({ ...d, heightAt }));
  const roadDetails = request.roadDetails.map(d => ({ ...d, heightAt }));
  return request.chunks.map(chunk => {
    const at = { x: chunk.cx * WORLD3D_CONFIG.CHUNK_WORLD_SIZE, z: chunk.cy * WORLD3D_CONFIG.CHUNK_WORLD_SIZE };
    let roads = chunk.roads ? [chunk.roads] : [];
    let roadVerges = chunk.roadVerges;
    for (const detail of roadDetails) {
      roads = roads.flatMap(part => refineRoadMeshesForFooting(part, at, detail));
      if (roadVerges && request.refineVerges) roadVerges = refineRoadMeshForFooting(roadVerges, at, detail);
    }
    return { key: chunk.key, terrain: refineTerrainForDetails(chunk.terrain, at, terrainDetails), roads, roadVerges };
  });
}

/** Only worker-owned result buffers may be transferred. Deduplicate arrays that
 * retained their source object; never detach the scene's input geometry. */
export function footingMeshTransfers(outputs: FootingMeshOutput[]): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();
  const visit = (value: unknown): void => {
    if (ArrayBuffer.isView(value)) {
      if (value.buffer instanceof ArrayBuffer) buffers.add(value.buffer);
    } else if (value && typeof value === 'object') {
      for (const entry of Object.values(value)) visit(entry);
    }
  };
  visit(outputs);
  return [...buffers];
}

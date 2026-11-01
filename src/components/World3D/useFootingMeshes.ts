/** Keep the last complete drawing while the next admitted patch is prepared.
 * One shared lifecycle-managed worker calculates the entire terrain/paving batch.
 * Superseded requests coalesce; stale replies cannot replace a newer window. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 02:25:41
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useEffect, useRef, useState } from 'react';
import { createWorkerClient, type WorkerClient, type WorkerFactory } from '@/workers/workerClient';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { LoadedChunk } from '@/systems/world3d/types';
import type { TerrainFootingDetail } from '@/systems/world3d/terrainFootingDetail';
import { DrawingMesh, type FootingMeshOutput, type FootingMeshRequest } from '@/systems/world3d/footingMeshJob';
import type { FootingWorkerRequest, FootingWorkerResponse } from './footingMeshWorker';

const factory: WorkerFactory = () => new Worker(new URL('./footingMeshWorker.ts', import.meta.url), { type: 'module' });
type Pending = { request: FootingMeshRequest; sources: LoadedChunk[] };
export interface PreparedFootingMesh { source: LoadedChunk['bundle']; meshes: DrawingMesh<FootingMeshOutput> }
const empty = new Map<string, PreparedFootingMesh>();

export function useFootingMeshes(ground: GroundWorld | null | undefined, chunks: LoadedChunk[],
  terrainDetails: readonly TerrainFootingDetail[], roadDetails: readonly TerrainFootingDetail[] | undefined,
  enabled: boolean, refineVerges: boolean, workerFactory: WorkerFactory = factory): ReadonlyMap<string, PreparedFootingMesh> {
  const sequence = useRef(0), inFlight = useRef<Pending | undefined>(undefined), queued = useRef<Pending | undefined>(undefined);
  const [client, setClient] = useState<WorkerClient<FootingWorkerRequest> | null>(null);
  const [ready, setReady] = useState<{ ground: GroundWorld; meshes: Map<string, PreparedFootingMesh> }>();
  useEffect(() => {
    if (!enabled || !ground) return undefined;
    let alive = true;
    const send = (pending: Pending) => {
      inFlight.current = pending;
      c.post({ type: 'build', request: pending.request });
    };
    const c = createWorkerClient<FootingWorkerRequest, FootingWorkerResponse>({
      factory: workerFactory, lazy: true,
      onSpawn: post => post({ type: 'init', ground: { cols: ground.cols, rows: ground.rows, heights: ground.heights } }),
      onMessage: reply => {
        const pending = inFlight.current;
        if (!alive || !pending || reply.id !== pending.request.id) return;
        inFlight.current = undefined;
        if ('error' in reply) console.warn('[footing drawing]', reply.error);
        else if (!queued.current) {
          const sources = new Map(pending.sources.map(chunk => [`${chunk.cx}|${chunk.cy}`, chunk.bundle]));
          setReady({ ground, meshes: new Map(reply.outputs.flatMap(meshes => {
            const source = sources.get(meshes.key);
            return source ? [[meshes.key, { source, meshes: new DrawingMesh(meshes) }] as const] : [];
          })) });
        }
        const next = queued.current;
        queued.current = undefined;
        if (next) send(next);
      },
      // Retain the last complete drawing on failure. A later request restarts
      // through the shared client's normal lifecycle and reinitializes ground.
      onError: message => { inFlight.current = undefined; queued.current = undefined; console.warn('[footing drawing]', message); },
    });
    setClient(c);
    return () => { alive = false; inFlight.current = undefined; queued.current = undefined; c.dispose(); };
  }, [ground, enabled, workerFactory]);

  useEffect(() => {
    if (!enabled || !ground || !client || client.disposed) return;
    const spec = ({ heightAt: _heightAt, ...detail }: TerrainFootingDetail) => detail;
    const pending: Pending = { sources: chunks, request: {
      id: ++sequence.current,
      chunks: chunks.map(chunk => ({ key: `${chunk.cx}|${chunk.cy}`, cx: chunk.cx, cy: chunk.cy,
        terrain: chunk.bundle.terrain, roads: chunk.bundle.roads, roadVerges: chunk.bundle.roadVerges })),
      terrainDetails: terrainDetails.map(spec), roadDetails: (roadDetails ?? []).map(spec), refineVerges,
    } };
    // At most one running batch and one latest request. Walking cannot build
    // an unbounded queue of obsolete windows while the worker is busy.
    if (inFlight.current) queued.current = pending;
    else { inFlight.current = pending; client.post({ type: 'build', request: pending.request }); }
  }, [client, ground, chunks, terrainDetails, roadDetails, enabled, refineVerges]);
  return enabled && ready && ready.ground === ground ? ready.meshes : empty;
}

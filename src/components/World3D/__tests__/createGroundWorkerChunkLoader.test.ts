/**
 * Self-healing, disposable ChunkLoader for GROUND mode, backed by one Web Worker.
 * Mirrors createWorkerChunkLoader (continent path). These are protocol tests: a
 * fake worker echoes the request's resolution back as a marker bundle, so
 * correlation, LOD resolution, self-heal, and dispose are all deterministic.
 * Mesh correctness lives in groundChunkWorkerCore.test.ts.
 *
 * See docs/superpowers/specs/2026-07-07-offthread-ground-chunk-meshing-design.md.
 */
import { describe, it, expect } from 'vitest';
import { createGroundWorkerChunkLoader } from '../createGroundWorkerChunkLoader';
import { WORLD3D_CONFIG, resolutionForLod } from '@/systems/world3d/config';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { ChunkMeshBundle } from '@/systems/world3d/types';

const fakeGround = () => ({ cols: 8, rows: 8, heights: [], biomeIds: [] } as unknown as GroundWorld);

/** Marker bundle: carries the resolution the worker was asked for, so a test can
 * prove which LOD reached the worker and that responses correlate by id. */
const markerBundle = (resolution: number) =>
  ({ terrain: { positions: new Float32Array(resolution) } } as unknown as ChunkMeshBundle);

/** Fake worker that runs the ground protocol synchronously in-process. */
class FakeWorker {
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  ground: GroundWorld | null = null;
  inits = 0;
  postMessage(msg: { type: string; id?: number; resolution?: number }) {
    if (msg.type === 'init') { this.ground = fakeGround(); this.inits++; return; }
    if (msg.type === 'load' && this.ground) {
      queueMicrotask(() => this.onmessage?.({ data: { id: msg.id, bundle: markerBundle(msg.resolution!) } }));
    }
  }
  die() { this.onerror?.({}); }
  terminate() {}
}

describe('createGroundWorkerChunkLoader', () => {
  it('resolves a chunk load from the worker at the default resolution', async () => {
    const fw = new FakeWorker();
    const loader = createGroundWorkerChunkLoader(fakeGround(), undefined, () => fw as unknown as Worker);
    const bundle = await loader(0, 0);
    expect(bundle.terrain.positions.length).toBe(WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION);
    expect(fw.inits).toBe(1); // worker was init'd with the ground exactly once
  });

  it('correlates concurrent requests to the right responses', async () => {
    const fw = new FakeWorker();
    const loader = createGroundWorkerChunkLoader(fakeGround(), 5, () => fw as unknown as Worker);
    const [a, b] = await Promise.all([loader(0, 0), loader(9, 3)]);
    expect(a.terrain.positions.length).toBe(5);
    expect(b.terrain.positions.length).toBe(5);
  });

  it('honors the requested LOD tier resolution', async () => {
    const fw = new FakeWorker();
    const loader = createGroundWorkerChunkLoader(fakeGround(), 16, () => fw as unknown as Worker);
    const [full, mid, low] = await Promise.all([loader(0, 0, 'full'), loader(1, 0, 'mid'), loader(2, 0, 'low')]);
    expect(full.terrain.positions.length).toBe(resolutionForLod('full'));
    expect(mid.terrain.positions.length).toBe(resolutionForLod('mid'));
    expect(low.terrain.positions.length).toBe(resolutionForLod('low'));
  });

  it('respawns the worker after it dies and re-sends the stranded request', async () => {
    let spawned = 0;
    const workers: FakeWorker[] = [];
    const factory = () => { spawned++; const w = new FakeWorker(); workers.push(w); return w as unknown as Worker; };
    const loader = createGroundWorkerChunkLoader(fakeGround(), 4, factory);
    // Kill the warm worker before any request, then load — it must respawn.
    workers[0].die();
    const bundle = await loader(0, 0);
    expect(bundle.terrain.positions.length).toBe(4);
    expect(spawned).toBe(2); // warm spawn + respawn
  });

  it('delivers nothing after dispose and terminates the worker', async () => {
    const fw = new FakeWorker();
    let terminated = false;
    fw.terminate = () => { terminated = true; };
    const loader = createGroundWorkerChunkLoader(fakeGround(), 4, () => fw as unknown as Worker);
    loader.dispose();
    let resolved = false;
    loader(0, 0).then(() => { resolved = true; });
    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(terminated).toBe(true);
  });
});

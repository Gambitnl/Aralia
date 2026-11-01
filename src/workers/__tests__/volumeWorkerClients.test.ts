/**
 * Protect volume ownership, transfer buffers and crash cleanup while the bubble
 * and arena clients move onto the shared worker lifecycle. These are disposable
 * in-memory workers; real route-change leak proof remains a separate gate.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVolumeBubbleClient, type BubbleRequest } from '@/components/World3D/createVolumeBubbleClient';
import { createArenaVolumeClient } from '@/components/BattleMap/terrain/createArenaVolumeClient';
import type { ArenaTiles } from '@/components/BattleMap/terrain/arenaVolume';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { VoxelVolume } from '@/systems/worldforge/terrain/voxelVolume';

class ControlledWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  onmessageerror: ((event: unknown) => void) | null = null;
  sent: Array<{ message: Record<string, unknown>; transfer?: Transferable[] }> = [];
  terminated = false;
  postMessage(message: Record<string, unknown>, transfer?: Transferable[]) {
    this.sent.push({ message, transfer });
  }
  terminate() { this.terminated = true; }
  emit(data: unknown) { this.onmessage?.({ data }); }
  crash() { this.onerror?.({ message: 'test crash' }); }
}

const cleanup: Array<() => void> = [];
afterEach(() => { cleanup.splice(0).forEach(dispose => dispose()); });
const ground = {} as GroundWorld;
const request = (): BubbleRequest => ({
  centerXM: 1, centerZM: 2, extentM: 16, cellM: 1,
  onFill: vi.fn(), onSlab: vi.fn(), onDone: vi.fn(),
});
const tiles = (): ArenaTiles => ({
  width: 1, height: 1, seed: 42, biome: 'forest',
  elevation: new Float32Array([3]), terrain: new Uint8Array([0]), ford: new Uint8Array([0]),
});

describe('volume worker clients', () => {
  it('warms the bubble worker with the ground fields it reads before building', () => {
    const worker = new ControlledWorker();
    // GG-574: the init carries only VolumeBubbleGround, with the SAME field
    // objects, never the building parts, roofs or props of the full world.
    const heights = [1, 2, 3, 4], biomeIds = [0, 1, 0, 1], townKeepOuts = [{ xM: 1, zM: 2, radiusM: 3 }];
    const full = { cols: 2, rows: 2, heights, biomeIds, snowLineH: 9, townKeepOuts, buildings: [{ parts: [] }], props: [] } as unknown as GroundWorld;
    const client = createVolumeBubbleClient(full, () => worker as unknown as Worker);
    cleanup.push(client.dispose);
    const sent = worker.sent[0].message as { type: string; ground: Record<string, unknown> };
    expect(sent.type).toBe('init');
    expect(Object.keys(sent.ground).sort()).toEqual(['biomeIds', 'cols', 'heights', 'rows', 'snowLineH', 'townKeepOuts']);
    expect(sent.ground.heights).toBe(heights);
    expect(sent.ground.biomeIds).toBe(biomeIds);
    expect(sent.ground.townKeepOuts).toBe(townKeepOuts);
    client.build(request());
    expect(worker.sent.map(entry => entry.message.type)).toEqual(['init', 'build']);
    client.dispose();
    expect(worker.terminated).toBe(true);
  });

  it('drops superseded bubble replies while preserving the latest streamed callbacks', () => {
    const worker = new ControlledWorker();
    const client = createVolumeBubbleClient(ground, () => worker as unknown as Worker);
    cleanup.push(client.dispose);
    const previous = request(), current = request();
    client.build(previous);
    client.build(current);
    const slab = { marker: 'same slab object' };
    worker.emit({ type: 'done', id: 1, meshMs: 9, drawnSlabs: 2 });
    worker.emit({ type: 'slab', id: 2, slab });
    worker.emit({ type: 'done', id: 2, meshMs: 5, drawnSlabs: 1 });
    expect(previous.onDone).not.toHaveBeenCalled();
    expect(current.onSlab).toHaveBeenCalledWith(slab);
    expect(current.onDone).toHaveBeenCalledWith({ meshMs: 5, drawnSlabs: 1 });
  });

  it('terminates a crashed bubble worker and initializes its replacement once', () => {
    const workers: ControlledWorker[] = [];
    const client = createVolumeBubbleClient(ground, () => {
      const worker = new ControlledWorker(); workers.push(worker); return worker as unknown as Worker;
    });
    cleanup.push(client.dispose);
    client.build(request());
    workers[0].crash();
    expect(workers[0].terminated).toBe(true);
    client.build(request());
    expect(workers).toHaveLength(2);
    expect(workers[1].sent.map(entry => entry.message.type)).toEqual(['init', 'build']);
  });

  it('rebuilds the transferred bubble snapshot and keeps its column metadata', () => {
    const worker = new ControlledWorker();
    const client = createVolumeBubbleClient(ground, () => worker as unknown as Worker);
    cleanup.push(client.dispose);
    const req = request();
    client.build(req);
    const snapshot = new VoxelVolume(16).snapshot();
    const originalTopY = new Float32Array([7]);
    const tintField = { marker: 'same tint field' };
    worker.emit({ type: 'fill', id: 1, snapshot, originM: [1, 2, 3], cellM: 1,
      cellsPerEdge: 16, originalTopY, fillMs: 4, solidCells: 0, slabCount: 1,
      stackKey: 'forest', stack: [], stackCounts: {}, minorityShare: 0, tintField });
    const fill = vi.mocked(req.onFill).mock.calls[0][0];
    expect(fill.volume).toBeInstanceOf(VoxelVolume);
    expect(fill.volume.snapshot()).toEqual(snapshot);
    expect(fill.cellsY).toBe(16);
    expect(fill.originalTopY).toBe(originalTopY);
    expect(fill.tintField).toBe(tintField);
  });

  it('preserves the arena transfer list and streamed callback order', () => {
    const worker = new ControlledWorker();
    const client = createArenaVolumeClient(() => worker as unknown as Worker);
    cleanup.push(client.dispose);
    const input = tiles();
    const order: string[] = [];
    const cb = { onFill: vi.fn(() => order.push('fill')), onSlab: vi.fn(() => order.push('slab')), onDone: vi.fn(() => order.push('done')) };
    client.build(input, cb, { cells: 16, cellM: 1, cellHM: 0.5 });
    expect(worker.sent[0].message.tiles).toBe(input);
    expect(worker.sent[0].transfer).toEqual([input.elevation.buffer, input.terrain.buffer, input.ford.buffer]);
    worker.emit({ kind: 'fill', id: 1, snapshot: new VoxelVolume(16).snapshot(), originM: [0, 0, 0],
      cellM: 1, cellHM: 0.5, cells: 16, cellsY: 16, topOccupiedCell: 0,
      originalTopY: new Float32Array(1), surfaceMaterial: new Uint8Array(1), biome: 'forest', fillMs: 1, solidCells: 0 });
    const slab = { kind: 'slab', id: 1 };
    worker.emit(slab);
    worker.emit({ kind: 'done', id: 1, meshMs: 3, slabs: 1 });
    expect(order).toEqual(['fill', 'slab', 'done']);
    expect(cb.onSlab).toHaveBeenCalledWith(slab);
    expect(cb.onDone).toHaveBeenCalledWith({ meshMs: 3, slabs: 1 });
    client.dispose();
    expect(worker.terminated).toBe(true);
  });

  it('terminates a crashed arena worker before accepting another build', () => {
    const workers: ControlledWorker[] = [];
    const client = createArenaVolumeClient(() => {
      const worker = new ControlledWorker(); workers.push(worker); return worker as unknown as Worker;
    });
    cleanup.push(client.dispose);
    workers[0].crash();
    expect(workers[0].terminated).toBe(true);
    client.build(tiles(), { onFill: vi.fn(), onSlab: vi.fn(), onDone: vi.fn() });
    expect(workers).toHaveLength(2);
    expect(workers[1].sent).toHaveLength(1);
  });
});

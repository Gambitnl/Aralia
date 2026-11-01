import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFootingMeshes } from '../useFootingMeshes';
import type { FootingWorkerRequest, FootingWorkerResponse } from '../footingMeshWorker';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { LoadedChunk } from '@/systems/world3d/types';
import type { FootingMeshOutput } from '@/systems/world3d/footingMeshJob';

class FakeWorker {
  onmessage: ((event: MessageEvent<FootingWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror = null;
  messages: FootingWorkerRequest[] = [];
  terminate = vi.fn();
  postMessage(message: FootingWorkerRequest) { this.messages.push(structuredClone(message)); }
  reply(id: number, outputs: FootingMeshOutput[]) { this.onmessage?.({ data: { id, outputs } } as MessageEvent<FootingWorkerResponse>); }
  builds() { return this.messages.filter((m): m is Extract<FootingWorkerRequest, { type: 'build' }> => m.type === 'build'); }
}
const ground = { cols: 2, rows: 2, heights: [50, 50, 50, 50] } as GroundWorld;
const terrain = { positions: new Float32Array(3), indices: new Uint32Array(0), normals: new Float32Array(3), colors: new Float32Array(3) };
const chunks = [{ cx: 0, cy: 0, bundle: { terrain } }] as LoadedChunk[];
const detail = (x: number) => [{ centerX: x, centerZ: 0, innerRadius: 8, outerRadius: 16, maxEdgeM: .2, heightAt: () => 0 }];
const output = (key = '0|0'): FootingMeshOutput[] => [{ key, terrain, roads: [] }];
const workers: FakeWorker[] = [];
const factory = () => { const worker = new FakeWorker(); workers.push(worker); return worker as unknown as Worker; };
afterEach(() => { workers.length = 0; vi.restoreAllMocks(); });

describe('moving footing worker ownership', () => {
  it('coalesces obsolete windows, publishes one complete latest batch, and disposes on unmount', async () => {
    const first = detail(0), second = detail(6), third = detail(12);
    const hook = renderHook(({ details }) => useFootingMeshes(ground, chunks, details, details, true, false, factory), { initialProps: { details: first } });
    await waitFor(() => expect(workers[0].builds()).toHaveLength(1));
    const worker = workers[0], oldId = worker.builds()[0].request.id;
    hook.rerender({ details: second }); hook.rerender({ details: third });
    expect(worker.builds()).toHaveLength(1);
    act(() => worker.reply(oldId, output()));
    expect(hook.result.current.size).toBe(0);
    expect(worker.builds()).toHaveLength(2);
    const latest = worker.builds()[1].request;
    expect(latest.terrainDetails[0].centerX).toBe(12);
    expect('heightAt' in latest.terrainDetails[0]).toBe(false);
    act(() => worker.reply(latest.id, output()));
    expect(hook.result.current.get('0|0')?.source).toBe(chunks[0].bundle);
    hook.rerender({ details: detail(18) });
    expect(hook.result.current.size).toBe(1); // retain the previous complete batch
    const late = worker.onmessage;
    hook.unmount();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    act(() => late?.({ data: { id: latest.id, outputs: output('wrong') } } as MessageEvent<FootingWorkerResponse>));
  });

  it('reinitializes a crashed worker on the next request without reviving its stale response', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hook = renderHook(({ details }) => useFootingMeshes(ground, chunks, details, details, true, false, factory), { initialProps: { details: detail(0) } });
    await waitFor(() => expect(workers[0].builds()).toHaveLength(1));
    const first = workers[0], stale = first.onmessage;
    act(() => first.onerror?.({ message: 'crashed' } as ErrorEvent));
    hook.rerender({ details: detail(6) });
    await waitFor(() => expect(workers).toHaveLength(2));
    expect(workers[1].messages[0].type).toBe('init');
    act(() => stale?.({ data: { id: first.builds()[0].request.id, outputs: output() } } as MessageEvent<FootingWorkerResponse>));
    expect(hook.result.current.size).toBe(0);
    act(() => workers[1].reply(workers[1].builds()[0].request.id, output()));
    expect(hook.result.current.size).toBe(1);
    hook.unmount();
    expect(workers.every(w => w.terminate.mock.calls.length === 1)).toBe(true);
  });
});

/**
 * useOffThreadBridgeAtlas (GG-555): screens get the canonical atlas from the
 * cache, from the atlas worker, or (with no Worker) from a synchronous build.
 * The bridge and the worker client are mocked, so no test builds a real world.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { FmgWorldResult } from '../../../systems/worldforge/fmg/generateWorld';

const fake = (name: string) => ({ name }) as unknown as FmgWorldResult;

const env = vi.hoisted(() => ({
  cache: new Map<number, unknown>(),
  worker: true,
  pending: new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>(),
  prepareCalls: [] as number[],
  builds: [] as number[],
}));

vi.mock('../../../systems/worldforge/bridge/legacySubmapBridge', () => ({
  peekBridgeAtlas: (seed: number) => env.cache.get(seed),
  getBridgeAtlas: (seed: number) => {
    env.builds.push(seed);
    const atlas = { name: `sync-${seed}` };
    env.cache.set(seed, atlas);
    return atlas;
  },
}));

vi.mock('../responsiveAtlasPreparation', () => ({
  canPrepareResponsiveAtlasOffThread: () => env.worker,
  prepareResponsiveAtlas: ({ seed }: { seed: number }) => {
    env.prepareCalls.push(seed);
    return new Promise((resolve, reject) => env.pending.set(seed, { resolve, reject }));
  },
}));

const { useOffThreadBridgeAtlas } = await import('../useOffThreadBridgeAtlas');

beforeEach(() => {
  env.cache.clear();
  env.pending.clear();
  env.prepareCalls = [];
  env.builds = [];
  env.worker = true;
});

describe('useOffThreadBridgeAtlas', () => {
  it('returns a cached atlas at once and starts no worker', () => {
    const cached = fake('cached');
    env.cache.set(7, cached);
    const { result } = renderHook(() => useOffThreadBridgeAtlas(7));
    expect(result.current.atlas).toBe(cached);
    expect(env.prepareCalls).toEqual([]);
    expect(env.builds).toEqual([]);
  });

  it('builds on the current thread when there is no Worker', () => {
    env.worker = false;
    const { result } = renderHook(() => useOffThreadBridgeAtlas(8));
    expect(result.current.atlas).toEqual({ name: 'sync-8' });
    expect(env.prepareCalls).toEqual([]);
  });

  it('waits for the worker, then returns its atlas, with no main-thread build', async () => {
    const { result } = renderHook(() => useOffThreadBridgeAtlas(9));
    expect(result.current.atlas).toBeNull();
    expect(env.prepareCalls).toEqual([9]);
    const built = fake('worker-9');
    env.pending.get(9)!.resolve({ atlas: built });
    await waitFor(() => expect(result.current.atlas).toBe(built));
    expect(env.builds).toEqual([]);
  });

  it('never returns the old seed atlas after a seed change', async () => {
    const { result, rerender } = renderHook(({ seed }) => useOffThreadBridgeAtlas(seed), { initialProps: { seed: 1 } });
    const first = fake('worker-1');
    env.pending.get(1)!.resolve({ atlas: first });
    await waitFor(() => expect(result.current.atlas).toBe(first));
    rerender({ seed: 2 });
    expect(result.current.atlas).toBeNull();
    // A late reply for seed 1 must not overwrite seed 2.
    const second = fake('worker-2');
    env.pending.get(2)!.resolve({ atlas: second });
    await waitFor(() => expect(result.current.atlas).toBe(second));
  });

  it('reports a worker failure', async () => {
    const { result } = renderHook(() => useOffThreadBridgeAtlas(5));
    env.pending.get(5)!.reject(new Error('worker died'));
    await waitFor(() => expect(result.current.error).toBe('worker died'));
    expect(result.current.atlas).toBeNull();
  });

  it('returns nothing for a null seed', () => {
    const { result } = renderHook(() => useOffThreadBridgeAtlas(null));
    expect(result.current).toEqual({ atlas: null, error: null });
    expect(env.prepareCalls).toEqual([]);
  });
});

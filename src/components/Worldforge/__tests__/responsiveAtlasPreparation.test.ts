/**
 * These tests protect GG-41's off-thread atlas preparation boundary.
 *
 * They prove that a worker-shaped structured clone keeps the canonical seed
 * output byte-for-byte unchanged, that the rebuilt exact-cell lookup still
 * resolves the same cells, and that the browser client yields instead of
 * running generation before its worker replies.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { liveWorkerCount } from '../../../workers/workerClient';
import { findCellAtPoint } from '../atlasSvg';
import {
  clearResponsiveAtlasPreparationCacheForTests,
  prepareResponsiveAtlas,
  prepareResponsiveAtlasNow,
} from '../responsiveAtlasPreparation';
import type {
  ResponsiveAtlasPrepared,
  ResponsiveAtlasResponse,
} from '../responsiveAtlasProtocol';
import {
  getBridgeAtlas,
  installPreparedBridgeAtlas,
} from '../../../systems/worldforge/bridge/legacySubmapBridge';

const CONTROLLED_SEED = 1337;

// The runtime quadtree contains function accessors, so it is intentionally not
// part of the serializable canonical data boundary. Every generated field and
// ordered array remains in this byte comparison.
function canonicalAtlasBytes(atlas: ResponsiveAtlasPrepared['atlas']): string {
  return JSON.stringify(atlas, (key, value) => (key === 'q' ? undefined : value));
}

let prepared: ResponsiveAtlasPrepared;

beforeAll(() => {
  prepared = prepareResponsiveAtlasNow({ seed: CONTROLLED_SEED });
});

describe('responsive atlas preparation', () => {
  it('survives the worker boundary byte-for-byte and restores exact-cell lookup', () => {
    const canonicalBefore = getBridgeAtlas(CONTROLLED_SEED);
    const bytesBefore = canonicalAtlasBytes(canonicalBefore);
    const quadtreeProbeCells = [0, 100, 999, 4_999, canonicalBefore.pack.cells.p.length - 1];
    const originalQuadtreeHits = quadtreeProbeCells.map((cellIndex) => {
      const [x, y] = canonicalBefore.pack.cells.p[cellIndex];
      return canonicalBefore.pack.cells.q?.find(x, y);
    });

    // structuredClone is the browser postMessage algorithm used in production.
    const transferred = structuredClone(prepared);
    expect(transferred.transferProperties.gridPrecipitation).not.toHaveLength(0);

    const installed = installPreparedBridgeAtlas(
      CONTROLLED_SEED,
      transferred.atlas,
      transferred.transferProperties,
    );
    expect(canonicalAtlasBytes(installed)).toBe(bytesBefore);
    expect(getBridgeAtlas(CONTROLLED_SEED)).toBe(installed);

    // Exercise the function-bearing lookup that structured clone cannot carry.
    // Multiple probes across the generated point set must resolve exactly as
    // the original tree did, not merely match the SVG helper's linear scan.
    quadtreeProbeCells.forEach((cellIndex, probeIndex) => {
      const [x, y] = installed.pack.cells.p[cellIndex];
      expect(installed.pack.cells.q?.find(x, y)).toEqual(originalQuadtreeHits[probeIndex]);
    });

    const sampleCell = 100;
    const samplePoint = installed.pack.cells.p[sampleCell];
    expect(findCellAtPoint(installed, samplePoint[0], samplePoint[1])).toBe(sampleCell);
  }, 20_000);

  it('returns control before an off-thread preparation response arrives', async () => {
    clearResponsiveAtlasPreparationCacheForTests();
    let responseHandler: ((event: MessageEvent<ResponsiveAtlasResponse>) => void) | null = null;
    const postMessage = vi.fn();
    const terminate = vi.fn();
    const fakeWorker = {
      get onmessage() { return responseHandler; },
      set onmessage(handler) { responseHandler = handler; },
      onerror: null,
      postMessage,
      terminate,
    } as unknown as Worker;

    let settled = false;
    const resultPromise = prepareResponsiveAtlas(
      { seed: CONTROLLED_SEED },
      () => fakeWorker,
    ).then((result) => {
      settled = true;
      return result;
    });

    expect(postMessage).toHaveBeenCalledWith({ seed: CONTROLLED_SEED });
    await Promise.resolve();
    expect(settled).toBe(false);

    const transferred = structuredClone(prepared);
    const atlasResponse: ResponsiveAtlasResponse = {
      type: 'atlas',
      atlas: transferred.atlas,
      transferProperties: transferred.transferProperties,
    };
    (responseHandler as any)({ data: atlasResponse } as MessageEvent<ResponsiveAtlasResponse>);
    expect(settled).toBe(false);

    const modelResponse: ResponsiveAtlasResponse = {
      type: 'model',
      model: transferred.model,
    };
    (responseHandler as any)({ data: modelResponse } as MessageEvent<ResponsiveAtlasResponse>);
    const result = await resultPromise;

    expect(result.model).toEqual(prepared.model);
    expect(canonicalAtlasBytes(result.atlas)).toBe(canonicalAtlasBytes(prepared.atlas));
    expect(terminate).toHaveBeenCalledOnce();
  }, 20_000);
});

// These fake workers exercise cache ownership and failures without regenerating
// the atlas. The existing structured-clone test above remains the data proof.
class AtlasTestWorker {
  onmessage: ((event: MessageEvent<ResponsiveAtlasResponse>) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  onmessageerror: ((event: { message: string }) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  asWorker(): Worker { return this as unknown as Worker; }
  emit(data: ResponsiveAtlasResponse): void {
    this.onmessage?.({ data } as MessageEvent<ResponsiveAtlasResponse>);
  }
  complete(): void {
    this.emit({ type: 'model', model: prepared.model });
    this.emit({ type: 'atlas', atlas: prepared.atlas, transferProperties: prepared.transferProperties });
  }
}

describe('atlas worker cache and cleanup', () => {
  it('shares a promise for sorted dungeon keys and accepts model before atlas', async () => {
    clearResponsiveAtlasPreparationCacheForTests();
    const worker = new AtlasTestWorker();
    const factory = vi.fn(() => worker.asWorker());
    const first = prepareResponsiveAtlas({ seed: CONTROLLED_SEED, clearedDungeonPaths: ['b', 'a'] }, factory);
    expect(prepareResponsiveAtlas({ seed: CONTROLLED_SEED, clearedDungeonPaths: ['a', 'b'] }, factory)).toBe(first);
    expect(factory).toHaveBeenCalledOnce();
    worker.complete();
    const result = await first;
    expect(result.atlas).toBe(getBridgeAtlas(CONTROLLED_SEED));
    expect(result.model).toBe(prepared.model);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(prepareResponsiveAtlas({ seed: CONTROLLED_SEED, clearedDungeonPaths: ['a', 'b'] }, factory)).toBe(first);
  });

  it.each(['protocol', 'crash', 'empty crash', 'decode'] as const)('evicts %s failures and releases the worker before retry', async (kind) => {
    clearResponsiveAtlasPreparationCacheForTests();
    const baseline = liveWorkerCount();
    const worker = new AtlasTestWorker();
    const first = prepareResponsiveAtlas({ seed: CONTROLLED_SEED }, () => worker.asWorker());
    const text = kind === 'empty crash' ? 'Atlas preparation worker failed.' : 'atlas failed';
    const rejected = expect(first).rejects.toThrow(text);
    if (kind === 'protocol') worker.emit({ type: 'error', message: text });
    else if (kind === 'decode') worker.onmessageerror?.({ message: text });
    else worker.onerror?.({ message: kind === 'empty crash' ? '' : text });
    await rejected;
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(liveWorkerCount()).toBe(baseline);
    const retryWorker = new AtlasTestWorker();
    const retry = prepareResponsiveAtlas({ seed: CONTROLLED_SEED }, () => retryWorker.asWorker());
    expect(retry).not.toBe(first);
    retryWorker.complete();
    await retry;
  });

  it('does not cache a constructor failure', async () => {
    clearResponsiveAtlasPreparationCacheForTests();
    const first = prepareResponsiveAtlas({ seed: CONTROLLED_SEED }, () => { throw new Error('spawn failed'); });
    await expect(first).rejects.toThrow('spawn failed');
    const worker = new AtlasTestWorker();
    const retry = prepareResponsiveAtlas({ seed: CONTROLLED_SEED }, () => worker.asWorker());
    expect(retry).not.toBe(first);
    worker.complete();
    await retry;
  });

  it('terminates and evicts a synchronous postMessage failure', async () => {
    clearResponsiveAtlasPreparationCacheForTests();
    const worker = new AtlasTestWorker();
    worker.postMessage.mockImplementation(() => { throw new Error('clone failed'); });
    const first = prepareResponsiveAtlas({ seed: CONTROLLED_SEED }, () => worker.asWorker());
    await expect(first).rejects.toThrow('clone failed');
    expect(worker.terminate).toHaveBeenCalledOnce();
    const replacement = new AtlasTestWorker();
    const retry = prepareResponsiveAtlas({ seed: CONTROLLED_SEED }, () => replacement.asWorker());
    expect(retry).not.toBe(first);
    replacement.complete();
    await retry;
  });

  it('ignores a saved duplicate callback after completion', async () => {
    clearResponsiveAtlasPreparationCacheForTests();
    const worker = new AtlasTestWorker();
    const first = prepareResponsiveAtlas({ seed: CONTROLLED_SEED }, () => worker.asWorker());
    const callback = worker.onmessage!;
    worker.complete();
    await first;
    callback({ data: { type: 'model', model: prepared.model } } as MessageEvent<ResponsiveAtlasResponse>);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});

// Clearing the promise cache never cancels a worker. If a previous attempt then
// fails, its cleanup must not evict the newer attempt under the same world key.
it('keeps a replacement cached when an older cleared attempt fails', async () => {
  clearResponsiveAtlasPreparationCacheForTests();
  const oldWorker = new AtlasTestWorker();
  const old = prepareResponsiveAtlas({ seed: CONTROLLED_SEED }, () => oldWorker.asWorker());
  const rejected = expect(old).rejects.toThrow('obsolete failure');
  clearResponsiveAtlasPreparationCacheForTests();
  const replacement = new AtlasTestWorker();
  const factory = vi.fn(() => replacement.asWorker());
  const current = prepareResponsiveAtlas({ seed: CONTROLLED_SEED }, factory);
  oldWorker.onerror!({ message: 'obsolete failure' });
  await rejected;
  expect(prepareResponsiveAtlas({ seed: CONTROLLED_SEED }, factory)).toBe(current);
  replacement.complete();
  await current;
  expect(factory).toHaveBeenCalledOnce();
});

/**
 * These tests protect GG-41's off-thread atlas preparation boundary.
 *
 * They prove that a worker-shaped structured clone keeps the canonical seed
 * output byte-for-byte unchanged, that the rebuilt exact-cell lookup still
 * resolves the same cells, and that the browser client yields instead of
 * running generation before its worker replies.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
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

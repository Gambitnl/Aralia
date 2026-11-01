/**
 * This file prepares the canonical atlas and its pure SVG model without making
 * React render perform either expensive calculation.
 *
 * MapPane calls the asynchronous client in browsers, which delegates to
 * responsiveAtlasWorker.ts. Tests and non-worker environments use the same
 * synchronous core. The result is installed into the established bridge cache,
 * so travel, exact-cell entry, 3D, politics, and preferences continue to read
 * one canonical atlas object. Worker cleanup uses the shared one-shot owner;
 * failed preparations are evicted so reopening the map can retry.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 13:12:07
 * Dependents: components/MapPane.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { runWorkerTask } from '../../workers/workerClient';
import {
  installPreparedBridgeAtlas,
} from '../../systems/worldforge/bridge/legacySubmapBridge';
import { prepareResponsiveAtlasNow } from './responsiveAtlasCore';
import type {
  ResponsiveAtlasPrepared,
  ResponsiveAtlasRequest,
  ResponsiveAtlasResponse,
} from './responsiveAtlasProtocol';

// ============================================================================
// Browser worker client and cache
// ============================================================================
// Reopening the same seed and cleared-dungeon state reuses the completed
// preparation. Different inputs get separate promises, so stale worker replies
// can never overwrite the currently requested world.
// ============================================================================

type WorkerFactory = () => Worker;

const preparedCache = new Map<string, Promise<ResponsiveAtlasPrepared>>();

export function responsiveAtlasPreparationKey(
  seed: number,
  clearedDungeonPaths?: readonly string[],
): string {
  const cleared = [...(clearedDungeonPaths ?? [])].sort();
  return `${seed}:${cleared.join('|')}`;
}

export function canPrepareResponsiveAtlasOffThread(): boolean {
  return typeof Worker !== 'undefined';
}

export function prepareResponsiveAtlasOnCurrentThread(
  request: ResponsiveAtlasRequest,
): ResponsiveAtlasPrepared {
  const prepared = prepareResponsiveAtlasNow(request);
  return {
    ...prepared,
    atlas: installPreparedBridgeAtlas(
      request.seed,
      prepared.atlas,
      prepared.transferProperties,
    ),
  };
}

function defaultWorkerFactory(): Worker {
  return new Worker(new URL('./responsiveAtlasWorker.ts', import.meta.url), { type: 'module' });
}

export function prepareResponsiveAtlas(
  request: ResponsiveAtlasRequest,
  workerFactory: WorkerFactory = defaultWorkerFactory,
): Promise<ResponsiveAtlasPrepared> {
  const key = responsiveAtlasPreparationKey(request.seed, request.clearedDungeonPaths);
  const cached = preparedCache.get(key);
  if (cached) return cached;

  // Unit-test and server-like environments have no Worker. They still use the
  // same deterministic core, while supported browsers always take the worker.
  if (!canPrepareResponsiveAtlasOffThread() && workerFactory === defaultWorkerFactory) {
    const installed = prepareResponsiveAtlasOnCurrentThread(request);
    const resolved = Promise.resolve(installed);
    preparedCache.set(key, resolved);
    return resolved;
  }

  let atlasPart: Pick<ResponsiveAtlasPrepared, 'atlas' | 'transferProperties'> | null = null;
  let modelPart: Pick<ResponsiveAtlasPrepared, 'model'> | null = null;

  // The shared one-shot owner releases the worker on either outcome. Keep both
  // replies together, then install into the same canonical cache after release.
  const pending = runWorkerTask<ResponsiveAtlasRequest, ResponsiveAtlasResponse, ResponsiveAtlasPrepared>({
    factory: workerFactory,
    request,
    formatError: (event) => {
      const message = event && typeof event === 'object' && 'message' in event ? event.message : '';
      return typeof message === 'string' && message ? message : 'Atlas preparation worker failed.';
    },
    handle: (message, settle) => {
      if (message.type === 'error') {
        settle.reject(new Error(message.message));
        return;
      }
      if (message.type === 'atlas') atlasPart = message;
      else modelPart = message;
      if (!atlasPart || !modelPart) return;
      settle.resolve({
        atlas: atlasPart.atlas,
        model: modelPart.model,
        transferProperties: atlasPart.transferProperties,
      });
    },
  }).then((prepared) => ({
    ...prepared,
    atlas: installPreparedBridgeAtlas(request.seed, prepared.atlas, prepared.transferProperties),
  })).catch((error: unknown) => {
    // A failed attempt must not poison reopening this world. An older failure
    // must also leave a replacement promise alone if the test cache was cleared.
    if (preparedCache.get(key) === pending) preparedCache.delete(key);
    throw error;
  });

  preparedCache.set(key, pending);
  return pending;
}

// Tests clear only this GG-41 promise cache. The canonical atlas cache remains
// owned by legacySubmapBridge and keeps its established session semantics.
export function clearResponsiveAtlasPreparationCacheForTests(): void {
  preparedCache.clear();
}

export { prepareResponsiveAtlasNow } from './responsiveAtlasCore';

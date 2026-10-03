// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 22:08:44
 * Dependents: components/MapPane.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file prepares the canonical atlas and its pure SVG model without making
 * React render perform either expensive calculation.
 *
 * MapPane calls the asynchronous client in browsers, which delegates to
 * responsiveAtlasWorker.ts. Tests and non-worker environments use the same
 * synchronous core. The result is installed into the established bridge cache,
 * so travel, exact-cell entry, 3D, politics, and preferences continue to read
 * one canonical atlas object.
 */
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

  const pending = new Promise<ResponsiveAtlasPrepared>((resolve, reject) => {
    const worker = workerFactory();
    let atlasPart: Pick<ResponsiveAtlasPrepared, 'atlas' | 'transferProperties'> | null = null;
    let modelPart: Pick<ResponsiveAtlasPrepared, 'model'> | null = null;

    // Finish exactly once and release the worker after either outcome.
    const stopWithError = (message: string) => {
      worker.terminate();
      preparedCache.delete(key);
      reject(new Error(message));
    };

    worker.onerror = (event) => {
      stopWithError(event.message || 'Atlas preparation worker failed.');
    };
    worker.onmessage = (event: MessageEvent<ResponsiveAtlasResponse>) => {
      if (event.data.type === 'error') {
        stopWithError(event.data.message);
        return;
      }
      if (event.data.type === 'atlas') {
        atlasPart = event.data;
      } else {
        modelPart = event.data;
      }
      if (!atlasPart || !modelPart) return;

      worker.terminate();
      resolve({
        atlas: installPreparedBridgeAtlas(
          request.seed,
          atlasPart.atlas,
          atlasPart.transferProperties,
        ),
        model: modelPart.model,
        transferProperties: atlasPart.transferProperties,
      });
    };
    worker.postMessage(request);
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

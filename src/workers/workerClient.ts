/**
 * @file workerClient.ts
 * @description One shared helper for talking to Web Workers (review task C12,
 * agora-9ed9.12).
 *
 * WHY THIS EXISTS
 * Before this file, every feature that used a worker (about 18 call sites across
 * World3D, BattleMap, Worldforge, Design Preview and the ocean systems) wrote its
 * own spawn / onmessage / onerror / terminate code. Some terminated on unmount,
 * some did not, and the river's solver worker was spawned from two different
 * files. This helper gives those sites one small, typed contract:
 *
 *   - createWorkerClient: a long-lived worker. Typed post(), one onMessage
 *     handler, errors surfaced as plain strings, idempotent dispose(), and a
 *     lazy respawn on the next post() if the worker died.
 *   - runWorkerTask: a one-shot job. Spawn, send one request, let the caller
 *     decide when a reply finishes the job, then ALWAYS terminate the worker
 *     (on success, failure, crash or abort).
 *   - liveWorkerCount: how many workers created through this helper are still
 *     alive. Used by tests and by devtools to check that leaving a screen does
 *     not leak workers.
 *
 * WHY THE CALLER PASSES A FACTORY, NOT A PATH
 * Vite only bundles a worker when it sees the literal
 * `new Worker(new URL('./x.ts', import.meta.url), { type: 'module' })` in the
 * source file that owns the worker. A generic helper that took a path string
 * would silently break the production build. So each feature keeps its literal
 * spawn line inside a tiny factory function and hands that factory here.
 *
 * WHAT WAS PRESERVED
 * Each worker's own message protocol is unchanged; this helper only owns
 * lifecycle and typing. Sites not yet migrated keep working exactly as before.
 *
 * DEFERRED
 * Pooling (several workers sharing one job queue) is not implemented: no current
 * caller needs more than one worker per feature. The migration list for the
 * remaining call sites lives in docs/architecture/domains/workers.md.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 25/10/2026, 13:12:07
 * Dependents: components/BattleMap/terrain/createArenaVolumeClient.ts, components/DesignPreview/steps/createLandVolumeClient.ts, components/World3D/createGroundWorkerChunkLoader.ts, components/World3D/createVolumeBubbleClient.ts, components/World3D/createWorkerChunkLoader.ts, components/World3D/createWorldGenClient.ts, components/World3D/water/riverReachScene.ts, components/Worldforge/responsiveAtlasPreparation.ts, systems/world3d/river/riverWorkerSpawn.ts, workers/useWorkerClient.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/** Builds one worker. Must contain the literal `new Worker(new URL(...))` line. */
export type WorkerFactory = () => Worker;

// ---------------------------------------------------------------------------
// Live-worker accounting (leak detection)
// ---------------------------------------------------------------------------

// Every worker spawned through this helper is counted until it is terminated.
// A WeakSet would not let us count, so a plain Set is used; entries are always
// removed on terminate, so it cannot grow without bound.
const liveWorkers = new Set<Worker>();

/** Number of helper-spawned workers that have not been terminated yet. */
export function liveWorkerCount(): number {
  return liveWorkers.size;
}

function spawn(factory: WorkerFactory): Worker {
  const worker = factory();
  liveWorkers.add(worker);
  return worker;
}

function kill(worker: Worker): void {
  // Remove from the count first so a throwing terminate() (seen in some test
  // fakes) cannot leave a phantom "live" worker behind.
  liveWorkers.delete(worker);
  worker.onmessage = null;
  worker.onerror = null;
  worker.onmessageerror = null;
  worker.terminate();
}

/** Turns a worker ErrorEvent (or anything else) into a readable message. */
function describeError(e: unknown, prefix: string): string {
  const detail = e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
    ? (e as { message: string }).message
    : String(e);
  return prefix ? `${prefix}: ${detail}` : detail;
}

// ---------------------------------------------------------------------------
// Long-lived client
// ---------------------------------------------------------------------------

export interface WorkerClientOptions<Res, Req = unknown> {
  factory: WorkerFactory;
  /** Called for every message the worker posts (never after dispose). */
  onMessage: (msg: Res) => void;
  /** Called when the worker crashes or a message cannot be deserialized. */
  onError?: (message: string) => void;
  /** Keep a feature's existing failure text while sharing worker cleanup. */
  formatError?: (event: unknown) => string;
  /** Initialize each new worker, then replay any requests stranded by a crash. */
  onSpawn?: (post: (msg: Req, transfer?: Transferable[]) => void) => void;
  /** Prefix added to error messages, e.g. "[river] The live solver failed". */
  errorPrefix?: string;
  /** Spawn on first post() instead of immediately. Default false. */
  lazy?: boolean;
}

export interface WorkerClient<Req> {
  /** Warm or restart the worker before recording a new correlated request. */
  start: () => void;
  /** Send a typed request. Respawns the worker if it was never created. */
  post: (msg: Req, transfer?: Transferable[]) => void;
  /** Terminate the worker. Safe to call more than once. */
  dispose: () => void;
  readonly disposed: boolean;
  /** The underlying worker, for callers that need MessageChannel ports etc. */
  readonly worker: Worker | null;
}

export function createWorkerClient<Req, Res>(opts: WorkerClientOptions<Res, Req>): WorkerClient<Req> {
  let worker: Worker | null = null;
  let disposed = false;
  const prefix = opts.errorPrefix ?? '';

  const ensure = (): Worker => {
    if (worker) return worker;
    const w = spawn(opts.factory);
    worker = w;
    // A queued callback from a retired generation cannot deliver stale data or
    // terminate its replacement. Disposing also detaches the original handlers.
    w.onmessage = (e: MessageEvent) => {
      if (disposed || worker !== w) return;
      opts.onMessage(e.data as Res);
    };
    w.onerror = (e) => {
      if (disposed || worker !== w) return;
      // Terminate and clear the crashed worker so a subsequent post() respawns cleanly
      worker = null;
      kill(w);
      opts.onError?.(opts.formatError ? opts.formatError(e) : describeError(e, prefix));
    };
    w.onmessageerror = (e) => {
      if (disposed || worker !== w) return;
      opts.onError?.(opts.formatError ? opts.formatError(e) : describeError(e, prefix || 'Worker message could not be read'));
    };
    try {
      opts.onSpawn?.((msg, transfer) => {
        if (disposed || worker !== w) return;
        if (transfer && transfer.length > 0) w.postMessage(msg, transfer);
        else w.postMessage(msg);
      });
    } catch (error) {
      // Initialization can throw before the caller receives its client. Release
      // that otherwise unreachable worker and preserve the original exception.
      if (worker === w) worker = null;
      kill(w);
      throw error;
    }
    return w;
  };

  if (!opts.lazy) ensure();

  return {
    start() {
      if (!disposed) ensure();
    },
    post(msg, transfer) {
      if (disposed) return;
      const w = ensure();
      if (transfer && transfer.length > 0) w.postMessage(msg, transfer);
      else w.postMessage(msg);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (worker) kill(worker);
      worker = null;
    },
    get disposed() { return disposed; },
    get worker() { return worker; },
  };
}

// ---------------------------------------------------------------------------
// One-shot task
// ---------------------------------------------------------------------------

export interface WorkerTaskSettle<Out> {
  resolve: (value: Out) => void;
  reject: (error: Error) => void;
}

export interface WorkerTaskOptions<Req, Res, Out> {
  factory: WorkerFactory;
  request: Req;
  transfer?: Transferable[];
  /**
   * Called for each reply. Call settle.resolve / settle.reject to finish the
   * job; any other reply (progress, logs) just keeps the job running.
   */
  handle: (msg: Res, settle: WorkerTaskSettle<Out>) => void;
  /** Prefix for crash messages, e.g. "[river] The flow worker failed". */
  errorPrefix?: string;
  /** Preserve a feature's crash and unreadable-message text. */
  formatError?: (event: unknown) => string;
  /** Aborting rejects the promise and terminates the worker. */
  signal?: AbortSignal;
}

export function runWorkerTask<Req, Res, Out>(opts: WorkerTaskOptions<Req, Res, Out>): Promise<Out> {
  return new Promise<Out>((resolve, reject) => {
    if (opts.signal?.aborted) {
      reject(new Error('Worker task aborted before start'));
      return;
    }
    const worker = spawn(opts.factory);
    let settled = false;
    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      kill(worker);
      opts.signal?.removeEventListener('abort', onAbort);
      fn();
    };
    const settle: WorkerTaskSettle<Out> = {
      resolve: (value) => finish(() => resolve(value)),
      reject: (error) => finish(() => reject(error)),
    };
    const onAbort = (): void => settle.reject(new Error('Worker task aborted'));
    opts.signal?.addEventListener('abort', onAbort);

    worker.onmessage = (e: MessageEvent) => {
      if (settled) return;
      try {
        opts.handle(e.data as Res, settle);
      } catch (err) {
        settle.reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    worker.onerror = (e) => settle.reject(new Error(opts.formatError ? opts.formatError(e) : describeError(e, opts.errorPrefix ?? '')));
    worker.onmessageerror = (e) => settle.reject(new Error(opts.formatError ? opts.formatError(e) : describeError(e, opts.errorPrefix || 'Worker message could not be read')));

    try {
      if (opts.transfer && opts.transfer.length > 0) worker.postMessage(opts.request, opts.transfer);
      else worker.postMessage(opts.request);
    } catch (err) {
      settle.reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

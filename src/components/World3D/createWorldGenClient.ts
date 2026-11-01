/**
 * @file createWorldGenClient.ts
 * @description Host-side client for staged, off-thread 3D world entry. Owns a
 * single world-gen worker and streams the two build stages back to the consumer:
 *
 *   Stage A — terrain + town. The worker returns the `ground` data (props empty)
 *             plus the local + region artifacts. The client rebuilds the cheap
 *             per-chunk loader closure from `ground` (via buildGroundLoaderFromWorld)
 *             and hands it to the consumer so the scene can render immediately.
 *   Stage B — props. The worker returns the props array; the client patches it
 *             into the SAME `ground` object the scene already holds, so dressing
 *             pops in without a second world.
 *
 * Correlation + supersession: each request gets a monotonic id and only the
 * latest id is "live". A re-entry (React StrictMode double-mount, or a fast
 * re-entry to a new cell) supersedes the previous request — late replies from a
 * superseded request are dropped, exactly like createWorkerChunkLoader's pending
 * map. The worker is owned here and disposed on unmount; a dead worker respawns
 * on the next generate().
 *
 * A workerFactory is injectable so tests can drive a synchronous fake worker.
 * See docs/superpowers/specs/2026-07-06-staged-offthread-3d-world-entry-design.md.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 12:28:04
 * Dependents: components/DesignPreview/steps/PreviewBattleMapScenarioLab.tsx, components/World3D/World3DWrapper.tsx, systems/travel/prepareTravelBattlefield.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { buildGroundLoaderFromWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { ChunkLoader } from '@/systems/world3d/types';
import type { LocalArtifact, RegionArtifact } from '@/systems/worldforge/artifacts';
import type { WorldGenRequest, WorldGenProgress } from './worldGenCore';
import { createWorkerClient } from '@/workers/workerClient';

type WorkerFactory = () => Worker;

const defaultWorkerFactory: WorkerFactory = () =>
  new Worker(new URL('./worldGenWorker.ts', import.meta.url), { type: 'module' });

/** Stage A delivered to the consumer: the render-ready world + rebuilt loader. */
export interface WorldGenStageAResult {
  ground: GroundWorld;
  local: LocalArtifact;
  region: RegionArtifact | undefined;
  loader: ChunkLoader;
  /**
   * GG-573: present when the caller set `handOffGround`. The world-gen worker
   * posts this same Stage A ground into the channel, so pass the port to
   * `createGroundWorkerChunkLoader(ground, …, { groundPort })`: the mesh worker
   * then reads it there, and the main thread does not clone the ground a
   * second time. Use it once; unused, it holds one queued copy until dropped.
   */
  meshGroundPort?: MessagePort;
}

/** Consumer callbacks for one generate() request. */
export interface WorldGenStages {
  /** A sub-step boundary was crossed (drives the loading-screen label). */
  onProgress?: (stage: WorldGenProgress) => void;
  /** Terrain + town ready — render now. */
  onStageA: (result: WorldGenStageAResult) => void;
  /** Props patched into the Stage A ground — dressing can render. */
  onStageB: (ground: GroundWorld) => void;
  /** The worker failed to build this world (no-fallback: surface it). */
  onError?: (message: string) => void;
  /**
   * GG-573 (2026-11-02): also send the Stage A ground to a chunk-mesh worker
   * (see `WorldGenStageAResult.meshGroundPort`). Posting a 700-building ground
   * from the main thread to the mesh worker took 0.3 to 0.6 s of main-thread
   * structured clone; the world-gen worker now does that copy instead.
   */
  handOffGround?: boolean;
}

/** A world-gen client that owns a worker and must be disposed when done. */
export interface DisposableWorldGenClient {
  generate: (req: WorldGenRequest, stages: WorldGenStages) => void;
  dispose: () => void;
}

/** Messages the worker posts back. */
type WorkerResponse =
  | { type: 'progress'; id: number; stage: WorldGenProgress }
  | { type: 'stageA'; id: number; ground: GroundWorld; local: LocalArtifact; region: RegionArtifact | undefined }
  | { type: 'stageB'; id: number; props: GroundWorld['props']; propSource?: GroundWorld['propSource'] }
  | { type: 'error'; id: number; message: string };

export function createWorldGenClient(
  workerFactory: WorkerFactory = defaultWorkerFactory,
): DisposableWorldGenClient {
  let disposed = false;
  let nextId = 1;
  /** Only the latest request is live; its ground is held so Stage B can patch it. */
  let activeId = 0;
  let activeStages: WorldGenStages | null = null;
  let activeGround: GroundWorld | null = null;
  /** The receiving end of the active request's mesh hand-off channel, if any. */
  let activeMeshPort: MessagePort | null = null;
  const dropMeshPort = (): void => {
    activeMeshPort?.close();
    activeMeshPort = null;
  };

  const handleMessage = (msg: WorkerResponse): void => {
    if (disposed) return;
    // Drop replies from a superseded (or unknown) request.
    if (msg.id !== activeId || !activeStages) return;

    if (msg.type === 'progress') {
      activeStages.onProgress?.(msg.stage);
    } else if (msg.type === 'stageA') {
      activeGround = msg.ground;
      activeStages.onStageA({
        ground: msg.ground,
        local: msg.local,
        region: msg.region,
        loader: buildGroundLoaderFromWorld(msg.ground) as ChunkLoader,
        ...(activeMeshPort ? { meshGroundPort: activeMeshPort } : {}),
      });
      // The port now belongs to the consumer (or to nobody, if it ignored it).
      activeMeshPort = null;
    } else if (msg.type === 'stageB') {
      // Patch props into the ground the scene already holds — one world, dressing
      // fills in. If Stage A was somehow missed, there is nothing to patch.
      if (activeGround) {
        activeGround.props = msg.props;
        // Carry the exact first baseline with its art, so the save owner can
        // retain it. Legacy replies keep their original object shape.
        if (msg.propSource) activeGround.propSource = msg.propSource;
        activeStages.onStageB(activeGround);
      }
    } else if (msg.type === 'error') {
      activeStages.onError?.(msg.message);
    }
  };

  const client = createWorkerClient<{ type: 'generate'; id: number; req: WorldGenRequest; meshPort?: MessagePort }, WorkerResponse>({
    factory: workerFactory,
    onMessage: handleMessage,
    // If the worker dies, surface the failure to the active no-fallback caller
    // and drop it so a later generate() can respawn a fresh worker. Without the
    // callback, one-shot production consumers would wait forever and never
    // reach their explicit source-gap state.
    formatError: (event) => event instanceof ErrorEvent && event.message
        ? event.message
        : 'World generation worker failed before completing the source artifact.',
    onError: (message) => {
      activeStages?.onError?.(message);
      // The shared client releases the failed worker before this callback, so
      // synchronous one-shot disposal cannot strand it. A later generate warms
      // a new worker while keeping the same request/stage protocol.
    },
  });

  const generate = (req: WorldGenRequest, stages: WorldGenStages): void => {
    if (disposed) return;
    client.start();
    const id = nextId++;
    activeId = id;
    activeStages = stages;
    activeGround = null;
    dropMeshPort();
    if (stages.handOffGround && typeof MessageChannel !== 'undefined') {
      const channel = new MessageChannel();
      activeMeshPort = channel.port2;
      client.post({ type: 'generate', id, req, meshPort: channel.port1 }, [channel.port1]);
    } else {
      client.post({ type: 'generate', id, req });
    }
  };

  const dispose = (): void => {
    disposed = true;
    activeStages = null;
    activeGround = null;
    dropMeshPort();
    try {
      client.dispose();
    } catch {
      /* worker may already be gone */
    }
  };

  // The shared client warms the worker up front, preserving first-entry latency.

  return { generate, dispose };
}

/**
 * Build one complete GroundWorld and dispose its worker immediately afterward.
 *
 * World3D uses the streaming client because it can render Stage A before props
 * arrive. Production systems such as a travel encounter need the opposite
 * contract: do not project combat until the full source artifact is ready. This
 * adapter preserves the same worker pipeline while giving those callers one
 * promise and one explicit error boundary.
 */
export function loadCompleteGroundWorld(
  req: WorldGenRequest,
  workerFactory: WorkerFactory = defaultWorkerFactory,
): Promise<GroundWorld> {
  const client = createWorldGenClient(workerFactory);

  return new Promise<GroundWorld>((resolve, reject) => {
    let settled = false;
    const finish = (result: { ground: GroundWorld } | { error: Error }): void => {
      if (settled) return;
      settled = true;
      client.dispose();
      if ('ground' in result) resolve(result.ground);
      else reject(result.error);
    };

    client.generate(req, {
      // Stage A is intentionally not exposed: travel combat must not extract a
      // partially dressed world and then disagree with the 3D source view.
      onStageA: () => {},
      onStageB: (ground) => finish({ ground }),
      onError: (message) => finish({ error: new Error(message) }),
    });
  });
}

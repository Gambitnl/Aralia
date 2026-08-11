/**
 * @file createVolumeBubbleClient.ts — the main thread's half of the bubble build.
 *
 * Owns one `volumeBubbleWorker`, sends it the `GroundWorld` once, and turns its
 * messages back into things three.js can draw. Mirrors
 * `createGroundWorkerChunkLoader`, including its self-healing spawn: a worker
 * that dies is replaced on the next build rather than leaving the caller
 * posting into the void.
 *
 * The volume the worker sends becomes the caller's. Edits — carve, bore — run
 * on the main thread against that object, and the worker is never told. One
 * owner, so there is nothing to keep in sync and nothing to drift.
 *
 * `workerFactory` is injectable so a test can drive this with a synchronous
 * fake instead of a real Worker.
 */
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { VoxelVolume } from '@/systems/worldforge/terrain/voxelVolume';
import type { GroundBand } from '@/systems/worldforge/terrain/materials';
import type {
  BubbleSlab,
  BubbleTintField,
} from '@/systems/worldforge/terrain/volumeBubbleCore';

type WorkerFactory = () => Worker;

const defaultWorkerFactory: WorkerFactory = () =>
  new Worker(new URL('./volumeBubbleWorker.ts', import.meta.url), { type: 'module' });

/** The bubble's voxels and where they sit. Handed over once, at `onFill`. */
export interface BubbleVolume {
  volume: VoxelVolume;
  originM: [number, number, number];
  cellM: number;
  cellsPerEdge: number;
  /** The pre-carve drawn-ground height per column — the strata datum. */
  originalTopY: Float32Array;
  /** How long the fill took INSIDE the worker, ms. */
  fillMs: number;
  solidCells: number;
  slabCount: number;
  /**
   * Which ground this bubble is made of — the stack most of its columns stand
   * on, named (`grassland`, `mountain+snow`, ...). The material is built from
   * it, so a rebuild that changes this key rebuilds the shader.
   */
  stackKey: string;
  /** The bands that stack carries — what the material and any re-mesh read. */
  stack: readonly GroundBand[];
  /** Every stack in the footprint, by key, with its sampled column count. */
  stackCounts: Record<string, number>;
  /** Share of columns whose ground is NOT `stackKey`, 0 to 1. */
  minorityShare: number;
  /**
   * The per-column top tint the worker meshed with — so a MAIN-THREAD re-mesh
   * after a carve or a slump draws the same surface it replaced.
   *
   * It has to cross because the sampler behind it reads the whole
   * `GroundWorld`, and that lives in the worker. Without it every re-meshed
   * slab repainted its full sixteen metres at the bubble's reference tint,
   * which is `settle-hooks.md` gap 1: a visibly darker, rougher patch that
   * spread as a slump touched more slabs.
   */
  tintField: BubbleTintField;
}

/**
 * A trench cut into the bubble BEFORE it is first meshed.
 *
 * A capture-rig feature with a diagnostic job. The incremental path — edit the
 * live volume, re-mesh the slabs the edit touched — puts the right cells in the
 * volume (measured) and the right triangles in the scene (measured) and still
 * draws the trench as a hole. Cutting before the build instead runs the cut
 * through the ONE path nine critic rounds already proved, so a proof frame of a
 * cut face does not depend on the broken one, and the two together say exactly
 * where the fault is.
 */
export interface BubblePreCut {
  xM: number;
  zM: number;
  /** Half-width, metres. */
  radiusM: number;
  depthM: number;
  lengthM: number;
  axis: 'x' | 'z';
}

export interface BubbleRequest {
  centerXM: number;
  centerZM: number;
  extentM: number;
  cellM: number;
  preCut?: BubblePreCut;
  /** The voxels, once. Arrives before any slab. */
  onFill: (v: BubbleVolume) => void;
  /** One mesh slab, as it finishes. Called many times. */
  onSlab: (slab: BubbleSlab) => void;
  /** Every slab has been delivered. */
  onDone: (stats: { meshMs: number; drawnSlabs: number }) => void;
}

export interface VolumeBubbleClient {
  /** Start a build. A newer build supersedes an older one's callbacks. */
  build: (req: BubbleRequest) => void;
  dispose: () => void;
}

export function createVolumeBubbleClient(
  ground: GroundWorld,
  workerFactory: WorkerFactory = defaultWorkerFactory,
): VolumeBubbleClient {
  let worker: Worker | null = null;
  let disposed = false;
  let nextId = 1;
  /* Only the newest build's callbacks are live. A stale build's slabs are
   * dropped rather than queued: the player moved, and drawing ground around
   * where they used to stand is worse than drawing nothing. */
  const inFlight = new Map<number, BubbleRequest>();

  const spawn = (): void => {
    const w = workerFactory();
    w.onmessage = (ev: MessageEvent) => {
      const m = ev.data;
      const req = inFlight.get(m.id);
      if (!req) return;
      if (m.type === 'fill') {
        req.onFill({
          volume: VoxelVolume.fromSnapshot(m.snapshot),
          originM: m.originM,
          cellM: m.cellM,
          cellsPerEdge: m.cellsPerEdge,
          originalTopY: m.originalTopY,
          fillMs: m.fillMs,
          solidCells: m.solidCells,
          slabCount: m.slabCount,
          stackKey: m.stackKey,
          stack: m.stack,
          stackCounts: m.stackCounts,
          minorityShare: m.minorityShare,
          tintField: m.tintField,
        });
      } else if (m.type === 'slab') {
        req.onSlab(m.slab as BubbleSlab);
      } else if (m.type === 'done') {
        inFlight.delete(m.id);
        req.onDone({ meshMs: m.meshMs, drawnSlabs: m.drawnSlabs });
      }
    };
    w.onerror = () => {
      if (worker === w) worker = null;
    };
    w.postMessage({ type: 'init', ground });
    worker = w;
  };

  const build = (req: BubbleRequest): void => {
    if (disposed) return;
    if (!worker) spawn();
    // Supersede: anything still in flight belongs to a position the caller has
    // already left behind.
    inFlight.clear();
    const id = nextId++;
    inFlight.set(id, req);
    worker!.postMessage({
      type: 'build',
      id,
      centerXM: req.centerXM,
      centerZM: req.centerZM,
      extentM: req.extentM,
      cellM: req.cellM,
      preCut: req.preCut,
    });
  };

  const dispose = (): void => {
    disposed = true;
    inFlight.clear();
    try {
      worker?.terminate();
    } catch {
      /* already gone */
    }
    worker = null;
  };

  // Warm up front so the first build does not pay spawn + init latency.
  spawn();

  return { build, dispose };
}

/**
 * @file createArenaVolumeClient.ts — the main thread's half of the arena build.
 *
 * Owns one `arenaVolumeWorker`, hands it the flattened tile grid, and turns its
 * messages back into things three.js can draw.
 *
 * Simpler than the streamed world's bubble client in one way that matters: an
 * arena does not move. There is no player to follow, no rebuild when they walk,
 * and therefore no superseding — one build per encounter, and the volume it
 * produces lives as long as the map does.
 *
 * The volume the worker sends becomes the caller's. Carves run on the main
 * thread against that object and the worker is never told. One owner, so there
 * is nothing to keep in sync and nothing to drift.
 *
 * `workerFactory` is injectable so a test can drive this with a synchronous
 * fake instead of a real Worker.
 */
import { VoxelVolume } from '@/systems/worldforge/terrain/voxelVolume';
import {
  arenaBiomeStack,
  transfersOfArenaTiles,
  type ArenaTiles,
} from './arenaVolume';
import type {
  ArenaDoneMessage,
  ArenaFillMessage,
  ArenaSlabMessage,
  ArenaWorkerMessage,
} from './arenaVolumeWorker';
import type { GroundBand } from '@/systems/worldforge/terrain/materials';

type WorkerFactory = () => Worker;

const defaultWorkerFactory: WorkerFactory = () =>
  new Worker(new URL('./arenaVolumeWorker.ts', import.meta.url), { type: 'module' });

/** The arena's voxels and where they sit. Handed over once, at `onFill`. */
export interface ArenaVolumeHandle {
  volume: VoxelVolume;
  originM: [number, number, number];
  /** Cell size on X and Z, scene units. */
  cellM: number;
  /** Cell size on Y, metres. */
  cellHM: number;
  cells: number;
  /** Cells on Y. */
  cellsY: number;
  topOccupiedCell: number;
  /** The pre-carve drawn-ground height per column — the strata datum. */
  originalTopY: Float32Array;
  /** Surface substance per column, for the top-surface tint. */
  surfaceMaterial: Uint8Array;
  /** The stack the material draws its bands from. */
  biomeStack: readonly GroundBand[];
  fillMs: number;
  solidCells: number;
}

export interface ArenaBuildCallbacks {
  onFill: (v: ArenaVolumeHandle) => void;
  onSlab: (slab: ArenaSlabMessage) => void;
  onDone: (stats: { meshMs: number; slabs: number }) => void;
}

export interface ArenaVolumeClient {
  build: (
    tiles: ArenaTiles,
    cb: ArenaBuildCallbacks,
    opts?: { cells?: number; cellM?: number; cellHM?: number },
  ) => void;
  dispose: () => void;
}

export function createArenaVolumeClient(
  workerFactory: WorkerFactory = defaultWorkerFactory,
): ArenaVolumeClient {
  let worker: Worker | null = null;
  let disposed = false;
  let nextId = 1;
  const inFlight = new Map<number, ArenaBuildCallbacks>();

  const spawn = (): void => {
    const w = workerFactory();
    w.onmessage = (ev: MessageEvent<ArenaWorkerMessage>) => {
      const m = ev.data;
      const cb = inFlight.get(m.id);
      if (!cb) return;
      if (m.kind === 'fill') {
        const f = m as ArenaFillMessage;
        cb.onFill({
          volume: VoxelVolume.fromSnapshot(f.snapshot),
          originM: f.originM,
          cellM: f.cellM,
          cellHM: f.cellHM,
          cells: f.cells,
          cellsY: f.cellsY,
          topOccupiedCell: f.topOccupiedCell,
          originalTopY: f.originalTopY,
          surfaceMaterial: f.surfaceMaterial,
          biomeStack: arenaBiomeStack(f.biome),
          fillMs: f.fillMs,
          solidCells: f.solidCells,
        });
      } else if (m.kind === 'slab') {
        cb.onSlab(m as ArenaSlabMessage);
      } else if (m.kind === 'done') {
        const d = m as ArenaDoneMessage;
        inFlight.delete(d.id);
        cb.onDone({ meshMs: d.meshMs, slabs: d.slabs });
      }
    };
    w.onerror = () => {
      /* A worker that died takes its build with it. The next build respawns
       * rather than posting into a corpse — the ground-chunk loader's
       * self-healing pattern, which has already saved one live session. */
      if (worker === w) worker = null;
    };
    worker = w;
  };

  const build = (
    tiles: ArenaTiles,
    cb: ArenaBuildCallbacks,
    opts: { cells?: number; cellM?: number; cellHM?: number } = {},
  ): void => {
    if (disposed) return;
    if (!worker) spawn();
    const id = nextId++;
    inFlight.set(id, cb);
    worker!.postMessage(
      { kind: 'build', id, tiles, cells: opts.cells, cellM: opts.cellM, cellHM: opts.cellHM },
      transfersOfArenaTiles(tiles),
    );
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

  spawn();

  return { build, dispose };
}

/**
 * Copy a small selection of current solver cells for an explicit diagnostic.
 * These depths are raw cell-average inventory, unlike the temporally smoothed
 * displayed frame, whose small depths can be rounded to zero. The copier never
 * steps the solver, makes a frame, or copies an entire grid.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/10/2026, 05:34:52
 * Dependents: components/World3D/water/riverLiveClient.ts, systems/world3d/river/riverLive.ts, systems/world3d/river/riverWorker.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { RiverSolverGrid } from './riverSolver';

export const RIVER_CELL_INSPECTION_LIMIT = 64;

/** Reject rather than trim a request: the caller must know exactly what was read. */
export function validateRiverCellIds(input: unknown, cellCount?: number): number[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > RIVER_CELL_INSPECTION_LIMIT) {
    throw new Error('[river] Cell inspection requires 1 to 64 unique cell IDs.');
  }
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const id of input) {
    if (!Number.isSafeInteger(id) || id < 0 || (cellCount !== undefined && id >= cellCount) || seen.has(id)) {
      throw new Error('[river] Cell inspection IDs must be unique integers inside the solver grid.');
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export interface RawRiverCell {
  cellId: number;
  i: number;
  j: number;
  /** Cell-average raw Float64 depth and depth times velocity; no display rounding. */
  h: number;
  hu: number;
  hv: number;
  bed: number;
  ground: number;
  cellAreaM2: number;
  cellVolumeM3: number;
  center: [number, number];
  /** World-space x/z extent [x0, z0, x1, z1], not the cell-center mesh quad. */
  worldBounds: [number, number, number, number];
}

export interface RawRiverCells {
  grid: RiverSolverGrid;
  worldBounds: [number, number, number, number];
  solverTime: number;
  solverSteps: number;
  liveSimTime: number;
  cells: RawRiverCell[];
}

/** One synchronous worker-handler observation; pairing with a drawn frame is unproved. */
export interface LiveCellInspection extends RawRiverCells {
  requestId: number;
  workerRunId: string;
  observationSequence: number;
  pendingEdit: boolean;
  paused: boolean;
  displayPairing: 'unavailable';
}

/** Only these scalar reads are needed; the full solver's operations are inaccessible here. */
export interface RiverCellInspectionSource {
  grid: RiverSolverGrid;
  h: Float64Array;
  hu: Float64Array;
  hv: Float64Array;
  bed: Float64Array;
  ground: Float64Array;
  time: number;
  steps: number;
  liveSimTime: number;
}

export function copyRawRiverCells(source: RiverCellInspectionSource, input: unknown): RawRiverCells {
  const { nx, nz, dx, x0, z0 } = source.grid;
  // Validate all IDs before touching cell arrays, including an invalid last ID.
  const ids = validateRiverCellIds(input, nx * nz);
  const cellAreaM2 = dx * dx;
  const cells = ids.map(cellId => {
    const i = cellId % nx;
    const j = Math.floor(cellId / nx);
    const x = x0 + i * dx;
    const z = z0 + j * dx;
    const h = source.h[cellId];
    return {
      cellId, i, j, h, hu: source.hu[cellId], hv: source.hv[cellId],
      bed: source.bed[cellId], ground: source.ground[cellId], cellAreaM2,
      cellVolumeM3: h * cellAreaM2,
      center: [x + dx / 2, z + dx / 2] as [number, number],
      worldBounds: [x, z, x + dx, z + dx] as [number, number, number, number],
    };
  });
  return {
    grid: { nx, nz, dx, x0, z0 }, worldBounds: [x0, z0, x0 + nx * dx, z0 + nz * dx],
    solverTime: source.time, solverSteps: source.steps, liveSimTime: source.liveSimTime, cells,
  };
}

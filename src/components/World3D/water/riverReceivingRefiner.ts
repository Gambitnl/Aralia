// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 08:07:47
 * Dependents: components/World3D/water/riverLiveClient.ts, components/World3D/water/riverReachScene.ts, systems/world3d/river/riverMapWorker.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { RiverGridSpec } from '@/systems/world3d/river/riverReach';
import type { LiveFlowSnapshot } from '@/systems/world3d/river/riverLive';
import type { WaterSheetArrays } from '@/systems/world3d/river/riverWaterSheet';
import type { RiverReachData } from '@/systems/world3d/river/riverWorker';
import { RiverSurfaceMirror } from './riverSurfaceMirror';
import { riverStandingGeometryFrom, riverWaterGeometryFrom } from './riverWaterMaterial';

/** Authoritative view ownership; the mapper never invents another mask. */
export interface RiverReceivingConfiguration {
  grid: RiverGridSpec; mask: Uint8Array | null; maskVersion: number; enabled: boolean; configId: string;
}
/** Optional optical output. The existing hydraulic snapshot stays unchanged. */
export type RiverViewFlowSnapshot = LiveFlowSnapshot & {
  preparedReceiving?: RiverPreparedReceivingSheet; receivingError?: string;
};

export interface RiverPreparedReceivingSheet {
  /** Unique across replacement views and disable/re-enable transitions. */
  configId: string;
  /** A changed ownership mask must not consume geometry made for its predecessor. */
  maskVersion: number;
  sheet: WaterSheetArrays;
  mainStandingTriangles: Uint32Array;
  standingStats: { baseTriangles: number; refinedBaseTriangles: number; addedTriangles: number; vertices: number };
  elapsedMs: number;
}

/**
 * Unused worker experiment: run the existing native receiving refinement with
 * the same half-float fields, ownership bytes and noise sampler as the view.
 * This changes where work runs, not its equations or topology. Mapper wiring
 * remains off until exact parity and a controlled FPS comparison are accepted.
 */
export class RiverReceivingRefiner {
  private readonly mirror: RiverSurfaceMirror;

  constructor(grid: RiverGridSpec, mask: Uint8Array, private readonly maskVersion: number, private readonly configId: string) {
    if (mask.length !== grid.nx * grid.nz * 4 || !Number.isSafeInteger(maskVersion) || maskVersion < 0 || !configId) {
      throw new Error('Receiving ownership mask/version does not match the grid');
    }
    const empty = new Float32Array(0);
    // The existing mirror constructor reads only grid, three flow arrays and
    // surface. Its legacy type also names terrain/solver data which this
    // optical calculation never reads. Empty placeholders are never sampled:
    // refine installs authoritative half arrays before its first flow query.
    // No substitute sampler is introduced.
    this.mirror = new RiverSurfaceMirror({ grid, t0: empty, t1: empty, t2: empty,
      surface: empty } as RiverReachData);
    this.mirror.setMainRapidsMorphology(mask.slice(), true);
  }

  refine(snapshot: Pick<LiveFlowSnapshot, 't0h' | 't1h' | 't2h' | 'surface' | 'sheet'>): RiverPreparedReceivingSheet {
    const start = performance.now();
    this.mirror.setFlowHalf(snapshot.t0h, snapshot.t1h, snapshot.t2h, snapshot.surface);
    const geometry = riverStandingGeometryFrom(snapshot.sheet,
      (x, z) => this.mirror.mainRapidsShare(x, z),
      (x, z) => this.mirror.broadStandingHeightAt(x, z),
      (x, z) => this.mirror.broadStandingHeightAt(x, z, true), this.mirror.mainRapidsBounds);
    const prepared: RiverPreparedReceivingSheet = {
      configId: this.configId, maskVersion: this.maskVersion,
      sheet: { pos: geometry.getAttribute('position').array as Float32Array,
        nor: geometry.getAttribute('normal').array as Float32Array, index: geometry.getIndex()!.array as Uint32Array },
      mainStandingTriangles: geometry.userData.mainStandingTriangles as Uint32Array,
      standingStats: geometry.userData.standingStats,
      elapsedMs: performance.now() - start,
    };
    // Only the disposable Three wrapper is released; its typed arrays are the
    // payload. Native field/sheet inputs stay attached for the normal mapper.
    geometry.dispose();
    return prepared;
  }
}

export function receivingSheetMatches(prepared: RiverPreparedReceivingSheet | undefined,
  maskVersion: number, enabled: boolean, configId: string): prepared is RiverPreparedReceivingSheet {
  return enabled && !!prepared && prepared.maskVersion === maskVersion && prepared.configId === configId;
}

/** Transfer only new refinement arrays, never the original field/sheet inputs. */
export function receivingSheetTransfer(prepared: RiverPreparedReceivingSheet): ArrayBuffer[] {
  return [prepared.sheet.pos, prepared.sheet.nor, prepared.sheet.index, prepared.mainStandingTriangles]
    .map(array => array.buffer as ArrayBuffer);
}

/** Reuse the existing sheet-to-Three adapter and preserve native metadata. */
export function preparedReceivingGeometry(prepared: RiverPreparedReceivingSheet) {
  const geometry = riverWaterGeometryFrom(prepared.sheet);
  geometry.userData.mainStandingTriangles = prepared.mainStandingTriangles;
  geometry.userData.standingStats = prepared.standingStats;
  return geometry;
}

/** Receives one bounded comparison command at a time. The renderer owns pace;
 * there are no timers or catch-up loops here, and failures retain owned water. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/10/2026, 03:01:38
 * Dependents: components/World3D/water/waterfallTerrainComparisonView.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { type TerrainComparisonWorkerRequest, type TerrainComparisonWorkerResponse } from './waterfallTerrainComparisons';
import { packWaterfallPresentation, isPackedWaterfallPresentation } from './waterfallPresentationSnapshot';
import { WaterfallTerrainInspection } from './waterfallTerrainInspection';
import { WaterfallContactView } from '@/components/World3D/water/waterfallContactView';
import type { RiverWaterUniforms } from '@/components/World3D/water/riverWaterMaterial';
// One geometry-only scratch builder lives beside the selected solver. It uses
// the live construction and all active geometry checks, without a second
// renderer/device. Only the historical world-storage comparison is omitted.
let builder: WaterfallContactView | null = null;
let preparedId: string | null = null;
let preparedTime = -1;


const run = new WaterfallTerrainInspection();
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<TerrainComparisonWorkerRequest>) => void) | null;
  postMessage(message: TerrainComparisonWorkerResponse, transfer?: Transferable[]): void;
  close(): void;
};
scope.onmessage = async ({ data }) => {
  if (data.type === 'dispose') { await run.executeYielding(data); builder?.dispose(); scope.close(); return; }
  try {
    const started = performance.now();
    const result = await run.executeYielding(data);
    if (!result) return;
    const snapshot = result.snapshot;
    const executed = performance.now();
    const selected=snapshot.snapshots[0];
    if(selected){
      if(!builder){builder=new WaterfallContactView({x:0,z:0,tx:1,tz:0},{} as RiverWaterUniforms,true);builder.setRepresentation('local');builder.setUnresolvedThicknessPolicy('report');builder.setLegacyGeometryComparison(false);}
      // Different courses may share a clock. A reset also invalidates the cache.
      if(preparedId!==selected.id || data.type==='reset')builder.clearSnapshot();
      if(preparedId!==selected.id || preparedTime!==selected.snapshot.receipt.time || data.type==='reset'){
        snapshot.preparedSurface=builder.prepareSurfacePacket(selected.snapshot);
        preparedId=selected.id;preparedTime=selected.snapshot.receipt.time;
      }
    }
    const prepared = performance.now();
    const transfer=Object.values(snapshot.preparedSurface?.arrays??{}).map(a=>a.buffer as ArrayBuffer);
    // Only advancing replies with a newly qualified surface use the smaller
    // display record. Selection, pause, source controls and failures retain full
    // snapshots, including release bookkeeping required by optical studies.
    const outgoing=data.type==='step' && snapshot.reading.running && !snapshot.reading.failure && snapshot.preparedSurface
      ? {...snapshot,snapshots:snapshot.snapshots.map(s=>({id:s.id,snapshot:packWaterfallPresentation(s.snapshot)}))} : snapshot;
    for (const {snapshot: display} of outgoing.snapshots) if (isPackedWaterfallPresentation(display)) transfer.push(display.packedParcels.buffer as ArrayBuffer);
    const packed = performance.now();
    // The last solver tick alone misses transaction/snapshot copying, surface
    // qualification and packing. Report the complete pre-send command as well
    // as its disjoint phases; transfer/delivery remains outside this interval.
    outgoing.workerTimings = { executeMs: executed-started-result.yieldMs, surfaceMs: prepared-executed,
      packMs: packed-prepared, totalMs: packed-started-result.yieldMs, yieldMs: result.yieldMs };
    scope.postMessage({ type: 'snapshot', requestId: data.requestId, ...outgoing },transfer);
  } catch (error) {
    scope.postMessage({ type: 'error', requestId: data.requestId, error: error instanceof Error ? error.message : String(error), retainedSnapshot: run.snapshot() });
  }
};

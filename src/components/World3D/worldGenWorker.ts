/**
 * @file worldGenWorker.ts
 * @description Web Worker entry for staged, off-thread 3D world entry. Thin glue
 * around `runWorldGen` — receives a `generate` request, runs the two-stage
 * assembly OFF the main thread, and posts each stage back as it completes.
 *
 * Why this is built this way:
 * - `getWorldforgeLocalForCell` + `makeGroundWorld` are hundreds of milliseconds
 *   of synchronous CPU. Running them here keeps the React main thread responsive,
 *   so the staged loading screen animates instead of freezing.
 * - No-fallback directive: if assembly throws, the failure is posted back as an
 *   `error` message for the host to surface — never silently swallowed.
 *
 * Known limitations/deferred issues:
 * - Web Workers do not run in Node/jsdom/Vitest. All logic therefore lives in the
 *   pure, synchronously-testable `worldGenCore.ts`; this file is untestable glue,
 *   matching chunkWorker.ts / chunkWorkerCore.ts.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 22:46:21
 * Dependents: components/World3D/createWorldGenClient.ts, services/saveLoad/loadHistoricalTownSource.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/// <reference lib="webworker" />
import { runWorldGen, type WorldGenRequest } from './worldGenCore';
import type { GameState } from '../../types';

const ctx = self as unknown as Worker;

ctx.onmessage = async (ev: MessageEvent) => {
  // Historical loads use the same heavy-generation worker and shared one-shot
  // lifecycle. No stage or source artifact mounts while preflight is pending.
  if(ev.data?.type==='historicalTownLoad'&&typeof ev.data.id==='number'&&ev.data.state){
    const {id,state}=ev.data as {id:number;state:GameState};
    try {
      const {prepareHistoricalTownLoad}=await import('../../systems/worldforge/town/prepareHistoricalTownLoad');
      ctx.postMessage({type:'historicalTownLoad',id,result:prepareHistoricalTownLoad(state)});
    }catch(error){
      ctx.postMessage({type:'error',id,message:`Saved-town source check failed: ${error instanceof Error?error.message:String(error)}`});
    }
    return;
  }
  const msg = ev.data as { type?: string; id?: number; req?: WorldGenRequest; meshPort?: MessagePort };
  if (msg?.type !== 'generate' || typeof msg.id !== 'number' || !msg.req) return;
  const { id, req, meshPort } = msg;
  try {
    await runWorldGen(req, {
      emitProgress: (stage) => ctx.postMessage({ type: 'progress', id, stage }),
      emitStageA: (a) => {
        ctx.postMessage({ type: 'stageA', id, ground: a.ground, local: a.local, region: a.region });
        // GG-573: the same ground goes to the chunk-mesh worker from HERE, so
        // the main thread does not serialize it a second time. It is posted
        // after the main-thread reply, so Stage A reaches the page first; the
        // mesh worker queues its loads until this init arrives.
        // The port is not closed here: a close right after the post can drop
        // the queued message. The mesh worker closes its end after it reads.
        if (meshPort) meshPort.postMessage({ type: 'init', ground: a.ground });
      },
      emitStageB: (props, propSource) => ctx.postMessage({ type: 'stageB', id, props, ...(propSource ? { propSource } : {}) }),
    });
  } catch (err) {
    ctx.postMessage({
      type: 'error',
      id,
      message: `[worldGen] village entry failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
};

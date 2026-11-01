/**
 * @file oceanMouthWorker.ts — the river mouth's near field (`oceanMouthMath.ts`,
 * `MouthField`), stepped in a worker so the frame never waits on it.
 *
 * WHY A WORKER. The near field is 6,160 cells of shallow water at 100 Hz
 * (the beach's clock), about a tenth of one core (`mouth/probeSpin.ts`:
 * 96 ms of work per second of mouth), and its spin-up takes about 2 s at
 * the start. On the main thread both would stall frames; here the frame
 * pays only the texture upload. The beach worker is the model.
 *
 * THE PROTOCOL (plain data):
 *   in  { type: 'init', design, cascades, n, seed }
 *   out { type: 'ready', cells, inflowCells, spinUpMs }
 *   in  { type: 'advance', id, t, budget }   bring the mouth to time t, at most
 *        `budget` fixed steps now (Infinity for a pinned clock)
 *   out { type: 'state', id, step, reached, a, b, c, ledger, stats }
 *        a, b and c are the three half-float texture payloads (transferred;
 *        c, the river's own slope, since round 1c).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/10/2026, 06:42:06
 * Dependents: systems/world3d/ocean/oceanMouth.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/// <reference lib="webworker" />
import type { CascadeParams } from './oceanConfig';
import {
  MouthClock, createMouthSim, mouthHandoverLengthM, packMouthState, riverFetchM, type MouthDesign, type MouthSim,
  youngPlumeExits, youngSeaOf, type YoungSea,
} from './oceanMouthMath';

// ROUND 10: edgeWarpM, each forced band's phase warp at the sea edge's rows (`createMouthSim`; null for a band not forced).
interface InitMsg { type: 'init'; design: MouthDesign; cascades: CascadeParams[]; n: number; seed: number; edgeWarpM?: (Float64Array | null)[] }
interface AdvanceMsg { type: 'advance'; id: number; t: number; budget: number }

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let sim: MouthSim | null = null;
let clock: MouthClock | null = null;
let blendM = 1;
// ROUND 9 (law 1): the young sea's record (the same one oceanMouth.ts builds from the same inputs), for the pack.
let young: YoungSea | null = null;

ctx.onmessage = (e: MessageEvent<InitMsg | AdvanceMsg>) => {
  const m = e.data;
  try {
    if (m.type === 'init') {
      const t0 = performance.now();
      sim = createMouthSim(m.design, m.cascades, m.n, m.seed, undefined, m.edgeWarpM);
      clock = new MouthClock(sim);
      blendM = mouthHandoverLengthM(m.cascades);
      // ROUND 3: the wind-locked band's fetch over the near field's wet cells, the median (the surface's
      // crest stretch reads it: `crestStretchOf`); the sea's own fetch where no band is wind-locked.
      const loc = m.design.bands.find((b) => b.local) ?? null;
      let localFetchM = loc ? loc.fetchM : Infinity;
      if (loc) {
        const f = sim.field;
        const all: number[] = [];
        for (let j = 0; j < f.na; j += 2) for (let i = 0; i < f.ns; i += 2) if (f.h[j * f.ns + i] > 1e-2) all.push(riverFetchM(m.design, f, i, j, loc));
        all.sort((x, y) => x - y);
        if (all.length) localFetchM = all[Math.floor(all.length / 2)];
      }
      const locIdx = m.design.bands.findIndex((b) => b.local);
      young = locIdx < 0 ? null : youngSeaOf(m.design, m.cascades[locIdx], localFetchM);
      if (young !== null) youngPlumeExits(m.design, young);
      ctx.postMessage({
        type: 'ready',
        localFetchM,
        cells: sim.field.ns * sim.field.na,
        inflowCells: sim.field.inflowCells.length,
        spinUpMs: performance.now() - t0,
      });
      return;
    }
    if (m.type === 'advance') {
      if (!sim || !clock) throw new Error('[ocean] The mouth worker got advance before init.');
      const t0 = performance.now();
      const r = clock.advanceTo(m.t, m.budget);
      const ms = performance.now() - t0;
      const f = sim.field;
      // Round 11: the hand-over starts where each row's edge waves break in full (`mouthHandoverStarts`).
      const pack = packMouthState(sim.design, f, blendM, undefined, young, sim.handoverS);
      ctx.postMessage({
        type: 'state',
        id: m.id,
        step: f.step,
        reached: r.reached,
        a: pack.a,
        b: pack.b,
        c: pack.c,
        // Round 5 (GG-394): the banks' sand for the beach's wet band.
        ...(pack.d ? { d: pack.d } : {}),
        ledger: { ...f.ledger },
        stats: { steps: r.steps, ms, courant: f.lastCourant, volumeM3: f.volume(), riverWaterM3: f.tracerVolume() },
      }, pack.d ? [pack.a.buffer, pack.b.buffer, (pack.c as Uint16Array).buffer, pack.d.buffer] : [pack.a.buffer, pack.b.buffer, (pack.c as Uint16Array).buffer]);
    }
  } catch (err) {
    ctx.postMessage({ type: 'error', message: String(err instanceof Error ? err.stack ?? err.message : err) });
  }
};

/**
 * @file oceanBeachWorker.ts — the beach's swash, sand and debris, stepped in
 * a worker so the frame never waits on them.
 *
 * WHY A WORKER. The swash is 12,672 cells of shallow water stepped at 100 Hz
 * with its sand stores and foam: measured on the CPU at 150 to 300 ms of work
 * per second of beach time, a sixth to a third of one core. On the main
 * thread that is 2.5 to 5 ms of every 60 Hz frame; here it costs the frame
 * only the texture upload. The physics is `oceanBeachMath.ts`, unchanged.
 *
 * THE PROTOCOL (all messages are plain data):
 *   in  { type: 'init', cascades, n, seed, match? }   match: the match look's swash (round 16)
 *   out { type: 'ready', modes, keptShare, dt, grid, items, foamTile }
 *   in  { type: 'advance', id, t, budget }   bring the beach to time t,
 *        taking at most `budget` fixed steps now (Infinity for a pinned clock)
 *   out { type: 'state', id, step, reached, a, b, d, debris, poses, ledger, stats }
 *        a, b and d are the three half-float texture payloads (transferred).
 *
 * The clock (`BeachClock`) makes the result a function of t alone, so a
 * capture that pins t = 42.0 gets the same beach however the worker got
 * there.
 */
/// <reference lib="webworker" />
import type { CascadeParams } from './oceanConfig';
import { BEACH_LACE_WEIGHTS, BEACH_MATCH_SWASH, buildSwashFoamTile, createBeachSim, debrisPoses, packBeachState, type BeachSim } from './oceanBeachMath';
// Round 7: the wake's lace image and its coverage table (read-only imports;
// the beach draws its foam with the wake's round-11 lace method; round 8 mixes
// the channels with its own weights, BEACH_LACE_WEIGHTS).
import { wakeLaceCdfTable, wakeLaceImage } from './oceanWakeMath';

let sim: BeachSim | null = null;

interface InitMsg { type: 'init'; cascades: CascadeParams[]; n: number; seed: number; match?: boolean }
interface AdvanceMsg { type: 'advance'; id: number; t: number; budget: number }

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<InitMsg | AdvanceMsg>) => {
  const m = e.data;
  try {
    if (m.type === 'init') {
      // Round 16: the match look's swash (BEACH_MATCH_SWASH) when the page asks for it.
      sim = createBeachSim({ cascades: m.cascades, n: m.n, seed: m.seed, ...(m.match ? { match: BEACH_MATCH_SWASH } : {}) });
      const foamTile = buildSwashFoamTile(m.seed);
      const wakeLace = wakeLaceImage(512);
      const wakeLaceCdf = new Float32Array(wakeLaceCdfTable(wakeLace, 512, undefined, undefined, BEACH_LACE_WEIGHTS));
      ctx.postMessage({
        type: 'ready',
        modes: sim.waves.modes,
        keptShare: sim.waves.keptShare,
        dt: sim.field.dt,
        grid: sim.site.grid,
        items: sim.debris.items,
        foamTile,
        wakeLace,
        wakeLaceCdf,
      }, [foamTile.buffer, wakeLace.buffer, wakeLaceCdf.buffer]);
      return;
    }
    if (m.type === 'advance') {
      if (!sim) throw new Error('[ocean] The beach worker got advance before init.');
      const t0 = performance.now();
      const r = sim.clock.advanceTo(m.t, m.budget);
      const ms = performance.now() - t0;
      const pack = packBeachState(sim.field);
      const f = sim.field;
      ctx.postMessage({
        type: 'state',
        id: m.id,
        step: f.step,
        reached: r.reached,
        a: pack.a,
        b: pack.b,
        d: pack.d,
        debris: sim.debris.data.slice(),
        poses: debrisPoses(sim),
        ledger: { ...f.ledger },
        stats: {
          steps: r.steps,
          ms,
          courant: f.lastCourant,
          sheetM3: f.sheetVolume(),
          soakedM3: f.soakedVolume(),
        },
      }, [pack.a.buffer, pack.b.buffer, pack.d.buffer]);
    }
  } catch (err) {
    ctx.postMessage({ type: 'error', message: String(err instanceof Error ? err.stack ?? err.message : err) });
  }
};

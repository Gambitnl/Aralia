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
 *   in  { type: 'init', cascades, n, seed }
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
import { buildSwashFoamTile, createBeachSim, debrisPoses, packBeachState, type BeachSim } from './oceanBeachMath';

let sim: BeachSim | null = null;

interface InitMsg { type: 'init'; cascades: CascadeParams[]; n: number; seed: number }
interface AdvanceMsg { type: 'advance'; id: number; t: number; budget: number }

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<InitMsg | AdvanceMsg>) => {
  const m = e.data;
  try {
    if (m.type === 'init') {
      sim = createBeachSim({ cascades: m.cascades, n: m.n, seed: m.seed });
      const foamTile = buildSwashFoamTile(m.seed);
      ctx.postMessage({
        type: 'ready',
        modes: sim.waves.modes,
        keptShare: sim.waves.keptShare,
        dt: sim.field.dt,
        grid: sim.site.grid,
        items: sim.debris.items,
        foamTile,
      }, [foamTile.buffer]);
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

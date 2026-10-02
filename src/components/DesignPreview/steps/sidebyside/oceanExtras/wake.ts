/**
 * @file oceanExtras/wake.ts — mounts the wake of a moving hull in the ocean
 * viewer: a stern trawler on a racetrack course, its Kelvin waves, its
 * white water and its bubble lane.
 *
 * The simulation is `src/systems/world3d/ocean/oceanWake.ts` (the GPU field
 * and the surface's read), `oceanWakeMath.ts` (the model, every constant,
 * and the CPU mirror) and `oceanWakeBoat.ts` (the hull and its fit to the
 * sea). This file builds them against the viewer's sea, hands the read to
 * the surface, and steps both once a frame. `?extras=wake` turns it on;
 * `&sea=waterpro` is the sea of the reference's boat-mode frames.
 *
 * THE SURFACE HOOK. The wake is drawn by the surface's own shader, through
 * `surface.setWake(reader)` (a change to oceanSurface.ts routed by the lead;
 * the wake report has its exact text). When the surface does not have the
 * hook yet, this mount FAILS with that message: the wake's height, slope
 * and foam belong in the one water shader, and a second water mesh drawn
 * over it would fight it for depth and shade the wake by other rules.
 *
 * DETERMINISM. The wake and the hull are pure functions of the sea time (see
 * oceanWake.ts). A pinned clock gives the same frame on every run with no
 * warm-up.
 *
 * THE LOOK. `&wakelook=<spec>` picks the read's controls (`parseWakeLook`
 * in oceanWakeMath.ts: `r2`, `r3`, `r4`, or `field:value` tokens over the
 * default), so a capture rig shows any build of the read from the one file
 * on disk, with no save and no reload of the shared viewer. The resolved
 * look is `probe.look`.
 */
import * as THREE from 'three/webgpu';
import type { OceanSurface } from '@/systems/world3d/ocean/oceanSurface';
import { createOceanWake, type OceanWakeReader } from '@/systems/world3d/ocean/oceanWake';
import { createWakeBoat } from '@/systems/world3d/ocean/oceanWakeBoat';
import {
  measureWakeHalfAngleDeg,
  realizeWakeCpu,
  wakeFoamAt,
  wakeFroude,
  wakePressureForHull,
  wakeBreaking,
  wakeDepositCpu,
  wakeEdgeFade,
  wakeWindowMask,
  parseWakeLook,
  WAKE_TOUCH_DEFAULT,
} from '@/systems/world3d/ocean/oceanWakeMath';
import type { OceanExtra, OceanExtraContext } from '../oceanExtras';

export const enabledByDefault = false;

type WakeSurface = OceanSurface & { setWake?: (reader: OceanWakeReader | null) => void };

/**
 * Camera poses relative to the hull, for the capture scripts. `back` is
 * meters behind the hull's center along the course, `side` meters to the
 * side, `up` the eye height; the camera looks at `lookAhead` meters ahead
 * of the hull's center at `lookUp` height.
 *
 *   chase    Water Pro's boat mode (wake/ref/boat-w-17.png, -23.png): right
 *            behind and above, horizon 10% down the frame, the stern at
 *            two thirds, the foam band filling the bottom middle.
 *   quarter  the V3 video's "wake generators" card (ref/video-v3/t0027.png):
 *            off the port quarter, low, the hull up and left, the white
 *            water streaming from the transom to the right of the frame.
 *            (Judged through round 15; kept so older frames can be shot
 *            again.)
 *   quarter-m  the same card RE-MATCHED (wake round 16, the lead's ruling;
 *            `.agent/scratch/ocean-gauntlet/wake/r16/tools/poseFit16.py`,
 *            the proof sheet `wake/r16/final/pose-proof16.png`): the
 *            trail's line 15.4 degrees below the horizontal on screen, its
 *            start under the stern at 0.595, 0.498 of the frame and out of
 *            the right edge at 0.696, the horizon at the top edge, and a
 *            band of +-3.5 m 0.10 of the frame's height by the stern and
 *            0.13 at the right edge, as the reference's white band measures
 *            (0.10 to 0.12). The old pose looked 31 degrees off the course,
 *            16 degrees down, and drew the trail at 24 degrees with the
 *            horizon 20% down. This one looks 55 degrees off the course and
 *            25 degrees down, 35 m from the transom; the look point is 2.1
 *            m under the course line (with it on the line the frame's center
 *            must lie on the trail, and the reference's trail passes 0.05 of
 *            the height over its center). Judged crop 990 431 610 391 (the
 *            reference's 660 300 452 290, the stern out to the right edge,
 *            clear of the hull), the reference scaled to 610 x 391.
 *   high     the whole V from above and behind, for the Kelvin angle.
 */
const POSES: Record<string, { back: number; side: number; up: number; lookAhead: number; lookUp: number; fov: number }> = {
  chase: { back: 58, side: 0, up: 26, lookAhead: 12, lookUp: -6, fov: 55 },
  quarter: { back: 42, side: -22, up: 12, lookAhead: -6, lookUp: 0, fov: 50 },
  'quarter-m': { back: 30, side: -31.4, up: 16.2, lookAhead: -7.7, lookUp: -2.1, fov: 50 },
  high: { back: 120, side: 0, up: 150, lookAhead: -60, lookUp: 0, fov: 55 },
};

export default async function mount(ctx: OceanExtraContext): Promise<OceanExtra> {
  const surface = ctx.field.surface as WakeSurface;
  if (typeof surface.setWake !== 'function') {
    throw new Error(
      '[ocean] The wake piece draws through the surface hook `setWake(reader)` in '
      + 'oceanSurface.ts, and this surface does not have it yet. The change is written '
      + 'out in the wake report (ocean gauntlet); until it lands, capture with '
      + '.agent/scratch/ocean-gauntlet/wake/shootWake.mjs, which serves the surface '
      + 'with the hook applied in its own browser only.',
    );
  }
  const lookSpec = new URLSearchParams(window.location.search).get('wakelook') ?? '';
  const wake = createOceanWake({
    overcast: ctx.sky.uOvercast, sunDir: ctx.sky.sunDir, field: ctx.field, look: parseWakeLook(lookSpec),
  });
  surface.setWake(wake.reader);
  const boat = createWakeBoat(ctx.field, wake.hull, {
    sunDir: ctx.sky.sunDir, overcast: ctx.sky.uOvercast, wakeHeight: wake.heightAt,
  });
  ctx.scene.add(boat.group);

  /** True while a probe owns the wake's buffers: the frame step skips. */
  let hold = false;
  const readBuf = async (attr: unknown) => new Float32Array(await (ctx.renderer as unknown as {
    getArrayBufferAsync(a: unknown): Promise<ArrayBuffer>;
  }).getArrayBufferAsync(attr));

  const poseAt = (name: string, tS: number) => {
    const q = POSES[name];
    if (!q) throw new Error(`[ocean] No wake pose "${name}". Poses: ${Object.keys(POSES).join(', ')}.`);
    const p = wake.course.at(tS);
    const hx = Math.cos(p.headingRad);
    const hz = Math.sin(p.headingRad);
    const lx = -hz;
    const lz = hx;
    const pos: [number, number, number] = [
      p.xM - q.back * hx + q.side * lx, q.up, p.zM - q.back * hz + q.side * lz,
    ];
    const look: [number, number, number] = [p.xM + q.lookAhead * hx, q.lookUp, p.zM + q.lookAhead * hz];
    return { pos, look, fov: q.fov };
  };

  const probe: Record<string, unknown> = {
    froude: wakeFroude(wake.hull, wake.course.spec.speedMs),
    /** The look the read was built with, and the spec it came from. */
    look: wake.look,
    lookSpec,
    historyS: wake.historyS,
    coherenceS: wake.coherenceS,
    poseNames: Object.keys(POSES),
    /** The camera pose `name` relative to the hull at sea time t. */
    pose: poseAt,
    /** Put the viewer's camera at pose `name` for sea time t. */
    setPose: (name: string, tS: number) => {
      const q = poseAt(name, tS);
      ctx.camera.position.set(...q.pos);
      ctx.camera.lookAt(new THREE.Vector3(...q.look));
      ctx.camera.fov = q.fov;
      ctx.camera.updateProjectionMatrix();
      return q;
    },
    /** The hull's center and heading at sea time t. */
    boatAt: (tS: number) => wake.course.at(tS),
    /**
     * A touch on the water at world (x, z) at sea time t (default: the
     * clock now), with the default splash or the given radius, head and
     * duration: ripples from a point. Returns the touch count.
     */
    touch: (xM: number, zM: number, tS?: number, o: Partial<{ radiusM: number; headM: number; durS: number }> = {}) => {
      wake.touches.push({ xM, zM, tS: tS ?? wake.last.timeS, ...WAKE_TOUCH_DEFAULT, ...o });
      wake.touches.sort((a, b) => a.tS - b.tS);
      return wake.touches.length;
    },
    clearTouches: () => { wake.touches.length = 0; },
    /** Set a wake tuning uniform by name; an unknown name throws. */
    set: (name: string, value: number) => {
      const u = wake.tune[name];
      if (!u) throw new Error(`[ocean] No wake tuning uniform named "${name}".`);
      u.value = value;
    },
    get: () => Object.fromEntries(Object.entries(wake.tune).map(([k, u]) => [k, u.value])),
    setBoatVisible: (v: boolean) => { boat.group.visible = v; },
    /** The last step's window and pieces. */
    state: () => ({
      timeS: wake.last.timeS,
      window: wake.last.window,
      pieces: wake.last.set?.segs.length ?? 0,
      wavePieces: wake.last.set?.waveCount ?? 0,
      waveHistoryS: wake.last.set?.waveHistoryS ?? 0,
    }),
    /** The hull's fitted (heave, pitch slope, roll slope). */
    boatPose: async () => Array.from(await readBuf(boat.pose)).slice(0, 3),
    /**
     * THE KERNEL PROOF. Step the wake at sea time t, read the GPU output
     * back, and compare it texel by texel with the CPU mirror (float64):
     * `realizeWakeCpu` under the same window mask for the height and the
     * world slopes; `wakeFoamAt`, `wakeBreaking` and `wakeDepositCpu` for
     * the foam. Returns the relative RMS and the largest error of each, and
     * the half-angles measured on the CPU field.
     */
    crossCheck: async (tS: number) => {
      // The viewer's frames keep stepping the wake while this awaits its
      // readbacks; `hold` stops them, so the buffers read are this step's.
      hold = true;
      let a: Float32Array;
      let b: Float32Array;
      try {
        wake.step(ctx.renderer, tS);
        a = await readBuf(wake.outA);
        b = await readBuf(wake.outB);
      } finally {
        hold = false;
      }
      const w = wake.last.window!;
      const set = wake.last.set!;
      const cpu = realizeWakeCpu(set.segs.slice(0, set.waveCount), wakePressureForHull(wake.hull), wake.grid, wake.coherenceS, wake.last.touches);
      const { nu, nv, texelM } = wake.grid;
      const cells = nu * nv;
      const churn = new Float64Array(cells);
      const brk = new Float64Array(cells);
      const lat = new Float64Array(cells);
      const beh = new Float64Array(cells);
      for (let j = 0; j < nv; j += 1) {
        for (let i = 0; i < nu; i += 1) {
          const c = j * nu + i;
          const f = wakeFoamAt(i * texelM, j * texelM, set.segs, wake.hull);
          churn[c] = f.foam * wakeEdgeFade(w, i * texelM, j * texelM);
          brk[c] = wakeBreaking(cpu.eta[c], Math.hypot(cpu.etaU[c], cpu.etaV[c]), f.lateralM, f.behindM, wake.hull);
          lat[c] = f.lateralM;
          beh[c] = f.behindM;
        }
      }
      const dep = wakeDepositCpu(brk, lat, beh, wake.grid, wake.course.spec.speedMs, wake.hull);
      const acc = { eta: [0, 0, 0], slope: [0, 0, 0], foam: [0, 0, 0] };
      const add = (k: 'eta' | 'slope' | 'foam', gpu: number, ref: number) => {
        const d = gpu - ref;
        acc[k][0] += d * d;
        acc[k][1] += ref * ref;
        acc[k][2] = Math.max(acc[k][2], Math.abs(d));
      };
      for (let j = 0; j < nv; j += 1) {
        for (let i = 0; i < nu; i += 1) {
          const c = j * nu + i;
          const m = wakeWindowMask(w, wake.hull, i * texelM, j * texelM);
          add('eta', b[4 * c + 1], cpu.eta[c] * m);
          const ex = (cpu.etaU[c] * w.hx + cpu.etaV[c] * w.lx) * m;
          const ez = (cpu.etaU[c] * w.hz + cpu.etaV[c] * w.lz) * m;
          add('slope', a[4 * c], ex);
          add('slope', a[4 * c + 1], ez);
          add('foam', a[4 * c + 2], Math.max(churn[c], dep.foam[c] * wakeEdgeFade(w, i * texelM, j * texelM)));
        }
      }
      const out: Record<string, number> = {};
      for (const k of ['eta', 'slope', 'foam'] as const) {
        out[`${k}RelRms`] = Math.sqrt(acc[k][0] / Math.max(acc[k][1], 1e-30));
        out[`${k}MaxErr`] = acc[k][2];
      }
      let breakers = 0;
      for (let c = 0; c < cells; c += 1) if (brk[c] > 0.5) breakers += 1;
      const ang = measureWakeHalfAngleDeg(cpu, w, 60, 250, wake.course.spec.speedMs);
      return {
        ...out, peakDeg: ang.peakDeg, edgeDeg: ang.edgeDeg, breakingTexels: breakers,
        pieces: set.segs.length, wavePieces: set.waveCount,
      };
    },
    /**
     * The wake's cost: its compute alone (pack, 17 stages, unpack, the fit),
     * saturating, ms per step. The frame-level cost of the shading is the
     * viewer's `__OCEAN__.bench` with and without `extras=wake`.
     */
    benchStep: async (iters = 200) => {
      const r = ctx.renderer;
      for (let i = 0; i < 10; i += 1) wake.step(r, 42 + i * 0.016);
      await readBuf(wake.outA);
      const t0 = performance.now();
      for (let i = 0; i < iters; i += 1) {
        wake.step(r, 42 + i * 0.016);
        boat.update(r, wake.course.at(42 + i * 0.016));
      }
      await readBuf(wake.outA);
      return (performance.now() - t0) / iters;
    },
    /** The same at a sea time mid-turn (up to 48 pieces), ms per step. */
    benchTurn: async (iters = 200) => {
      const r = ctx.renderer;
      const t = 250;
      for (let i = 0; i < 10; i += 1) wake.step(r, t + i * 0.016);
      const pieces = wake.last.set?.segs.length ?? 0;
      await readBuf(wake.outA);
      const t0 = performance.now();
      for (let i = 0; i < iters; i += 1) wake.step(r, t + i * 0.016);
      await readBuf(wake.outA);
      return { ms: (performance.now() - t0) / iters, pieces };
    },
    /**
     * The wake's compute pass on the GPU's own clock: the pass's begin and
     * end timestamps (the renderer's timestamp queries, `trackTimestamp`),
     * read back after each of `iters` steps; the median and the 10th and
     * 90th percentiles, ms. The clock runs while other pages' work may be
     * interleaved, so a shared GPU reads high; the low percentile is the
     * best estimate of the pass alone. `t` 42 is the straight, 250 a turn.
     */
    gpuStepMs: async (iters = 60, t = 42) => {
      const r = ctx.renderer as unknown as {
        backend: { get(o: unknown): {
          currentTimestampQueryBuffers?: { resultBuffer: GPUBuffer };
          timeStampQuerySet?: GPUQuerySet;
        } };
      };
      const out: number[] = [];
      hold = true;
      try {
        for (let i = 0; i < iters; i += 1) {
          // three r172 writes a pass's timestamps only on the pass that made
          // its query set; drop the set so every step makes and writes one.
          r.backend.get(wake.dispatchList).timeStampQuerySet = undefined;
          wake.step(ctx.renderer, t + i * 0.016);
          await readBuf(wake.outA);
          const q = r.backend.get(wake.dispatchList).currentTimestampQueryBuffers;
          if (!q) throw new Error('[ocean] No timestamp buffers on the wake pass: is trackTimestamp on?');
          const buf = q.resultBuffer;
          if (buf.mapState !== 'unmapped') continue;
          await buf.mapAsync(GPUMapMode.READ);
          const ts = new BigUint64Array(buf.getMappedRange().slice(0));
          buf.unmap();
          out.push(Number(ts[1] - ts[0]) / 1e6);
        }
      } finally {
        hold = false;
      }
      out.sort((a, b) => a - b);
      const at = (f: number) => out[Math.min(out.length - 1, Math.floor(f * out.length))];
      return { p10: at(0.1), p50: at(0.5), p90: at(0.9), n: out.length };
    },
    /**
     * THE FRAME ON THE GPU'S CLOCK, with the wake and without it. The wake's
     * passes (its compute, the hull fit) and the render's (the scene and the
     * output pass) are timed by their own begin and end timestamps and
     * summed; the sea's compute, the same both ways, is left out. Three blocks of `iters` frames: with, without,
     * with; the surface's shader is rebuilt only between blocks (a rebuild
     * of the water shader takes seconds, so it is never inside a block).
     * While it runs, the renderer's timestamp setup is wrapped so every
     * pass writes its timestamps (three r172 writes them only on the first
     * pass of each context); the wrap is removed after. Returns the 10th,
     * 50th and 90th percentiles of each, ms, and the wake's own passes
     * alone: on a shared GPU the low percentile is the frame alone.
     */
    gpuFrameMs: async (iters = 40) => {
      type Ctx = { timeStampQuerySet?: GPUQuerySet; currentTimestampQueryBuffers?: { resultBuffer: GPUBuffer } };
      const be = (ctx.renderer as unknown as {
        backend: { get(o: unknown): Ctx; initTimestampQuery(c: unknown, d: unknown): void };
      }).backend;
      const orig = be.initTimestampQuery.bind(be);
      const touched = new Set<unknown>();
      // The wrap is installed only for the synchronous span of one frame's
      // submits, so the viewer's own frames, which run while this awaits,
      // keep three's timestamp setup as it is. A query set is dropped, not
      // destroyed: a later viewer frame may still resolve it.
      const wrapped = (c: unknown, d: unknown) => {
        be.get(c).timeStampQuerySet = undefined;
        touched.add(c);
        orig(c, d);
      };
      const r = ctx.renderer;
      const read = async (c: unknown): Promise<number> => {
        const buf = be.get(c).currentTimestampQueryBuffers?.resultBuffer;
        if (!buf || buf.mapState !== 'unmapped') return NaN;
        const ok = await Promise.race([
          buf.mapAsync(GPUMapMode.READ).then(() => true),
          new Promise<boolean>((res) => setTimeout(() => res(false), 3000)),
        ]);
        if (!ok) return NaN;
        const ts = new BigUint64Array(buf.getMappedRange().slice(0));
        buf.unmap();
        return Number(ts[1] - ts[0]) / 1e6;
      };
      const frame = async (withWake: boolean, t: number) => {
        // The sea's own compute is the same both ways and is not timed:
        // what is summed is the wake's passes and the render's.
        ctx.field.step(r, t);
        touched.clear();
        be.initTimestampQuery = wrapped;
        try {
          if (withWake) { wake.step(r, t); boat.update(r, wake.course.at(t)); }
          r.render(ctx.scene, ctx.camera);
        } finally {
          be.initTimestampQuery = orig;
        }
        const mine = [...touched];
        await readBuf(ctx.field.buffers.disp);
        let sum = 0;
        let own = 0;
        let fitMs = 0;
        for (const c of mine) {
          const ms = await read(c);
          sum += ms;
          if (c === wake.dispatchList) own += ms;
          if (c === boat.dispatchList) fitMs += ms;
        }
        return { sum, own, fitMs };
      };
      const block = async (withWake: boolean) => {
        surface.setWake!(withWake ? wake.reader : null);
        // The rebuild compiles on the first frames; they are not timed.
        for (let i = 0; i < 4; i += 1) await frame(withWake, 42);
        const sums: number[] = [];
        const owns: number[] = [];
        const fits: number[] = [];
        for (let i = 0; i < iters; i += 1) {
          const f = await frame(withWake, 42);
          sums.push(f.sum);
          owns.push(f.own);
          fits.push(f.fitMs);
        }
        return { sums, owns, fits };
      };
      const pct = (x: number[]) => {
        const s2 = x.filter((v) => Number.isFinite(v)).sort((p, q) => p - q);
        const at = (f: number) => s2[Math.min(s2.length - 1, Math.floor(f * s2.length))];
        return { p10: at(0.1), p50: at(0.5), p90: at(0.9) };
      };
      hold = true;
      try {
        const a1 = await block(true);
        const b1 = await block(false);
        const a2 = await block(true);
        return {
          withWake: pct([...a1.sums, ...a2.sums]),
          without: pct(b1.sums),
          wakePass: pct([...a1.owns, ...a2.owns]),
          fitPass: pct([...a1.fits, ...a2.fits]),
        };
      } finally {
        hold = false;
        surface.setWake!(wake.reader);
      }
    },
    /**
     * THE COST, A AGAINST B, IN ONE PAGE. The GPU here is shared with other
     * pages, so an absolute reading drifts with their load; alternating
     * keeps the drift off the difference. A is the whole frame with the
     * wake (sea step, wake step, hull fit, render); B the same frame with
     * the wake's read taken out of the surface and its steps skipped (the
     * hull still drawn). `rounds` pairs of `iters` saturating frames each;
     * returns every round and the medians. Rebuilds the surface's shader
     * twice per round (setWake), outside the timed loops.
     */
    abBench: async (rounds = 4, iters = 120) => {
      const r = ctx.renderer;
      const fence = () => readBuf(ctx.field.buffers.disp);
      const run = async (withWake: boolean) => {
        surface.setWake!(withWake ? wake.reader : null);
        // Warm: the first frames after a rebuild compile the pipeline.
        for (let i = 0; i < 12; i += 1) {
          ctx.field.step(r, 42 + i * 0.016);
          if (withWake) { wake.step(r, 42 + i * 0.016); boat.update(r, wake.course.at(42 + i * 0.016)); }
          r.render(ctx.scene, ctx.camera);
        }
        await fence();
        const t0 = performance.now();
        for (let i = 0; i < iters; i += 1) {
          const t = 60 + i * 0.016;
          ctx.field.step(r, t);
          if (withWake) { wake.step(r, t); boat.update(r, wake.course.at(t)); }
          r.render(ctx.scene, ctx.camera);
        }
        await fence();
        return (performance.now() - t0) / iters;
      };
      const a: number[] = [];
      const b: number[] = [];
      for (let k = 0; k < rounds; k += 1) {
        a.push(await run(true));
        b.push(await run(false));
      }
      surface.setWake!(wake.reader);
      const med = (x: number[]) => [...x].sort((p, q) => p - q)[Math.floor(x.length / 2)];
      const diffs = a.map((v, k) => v - b[k]);
      return { withWake: a, without: b, medWith: med(a), medWithout: med(b), medDiff: med(diffs) };
    },
  };

  /** The sea time of the last frame step, for the camera follow. */
  let lastSimT = 42;

  return {
    update(simTime) {
      if (hold) return;
      lastSimT = simTime;
      wake.step(ctx.renderer, simTime);
      boat.update(ctx.renderer, wake.course.at(simTime));
    },
    /**
     * PIN THE CAMERA TO THE SHIP (Remy, 2026-09-28). The hull's center on the
     * course and its heading at the last step, 2 m up (about the deck), for
     * the viewer's "Pin camera to ship" button. Read only while that button
     * is on, so no capture changes.
     */
    followTarget: () => {
      const p = wake.course.at(lastSimT);
      return { xM: p.xM, yM: 2, zM: p.zM, headingRad: p.headingRad };
    },
    dispose() {
      surface.setWake?.(null);
      ctx.scene.remove(boat.group);
      boat.dispose();
      wake.dispose();
    },
    probe,
  };
}


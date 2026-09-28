/**
 * @file oceanExtras/foam.ts — mounts the persistent foam in the ocean viewer.
 *
 * The simulation is `src/systems/world3d/ocean/oceanFoam.ts` (the GPU field
 * and the surface's read) and `oceanFoamMath.ts` (the model and every
 * constant). This file builds it against the viewer's sea, hands its read to
 * the surface, and steps it once a frame. `?extras=foam` turns it on;
 * `&sea=storm` gives it a sea that breaks.
 *
 * THE SURFACE HOOK. The foam is drawn by the surface's own shader, through
 * `surface.setFoam(reader)` (a change to oceanSurface.ts routed by the lead;
 * see the foam report for its exact text). When the surface does not have
 * the hook yet, this mount FAILS with that message rather than drawing a
 * second foam over the old one: the old fold-only foam would still show its
 * 97 m grid under any overlay, and a capture would judge the two mixed.
 *
 * A pinned clock (`dtS` = 0) steps the foam as a pure function of (seed,
 * time, view): see `planFoamStep` in oceanFoamMath.ts.
 */
import type { OceanSurface } from '@/systems/world3d/ocean/oceanSurface';
import { createOceanFoam, type OceanFoamReader } from '@/systems/world3d/ocean/oceanFoam';
import { foamCellOf, FOAM_LEVELS } from '@/systems/world3d/ocean/oceanFoamMath';
import type { OceanExtra, OceanExtraContext } from '../oceanExtras';

export const enabledByDefault = false;

type FoamSurface = OceanSurface & { setFoam?: (reader: OceanFoamReader) => void };

export default async function mount(ctx: OceanExtraContext): Promise<OceanExtra> {
  const surface = ctx.field.surface as FoamSurface;
  if (typeof surface.setFoam !== 'function') {
    throw new Error(
      '[ocean] The foam piece draws through the surface hook `setFoam(reader)` in '
      + 'oceanSurface.ts, and this surface does not have it yet. The change is written '
      + 'out in the foam report (ocean gauntlet); until it lands, capture with '
      + '.agent/scratch/ocean-gauntlet/foam/shootFoam.mjs, which serves the surface '
      + 'with the hook applied in its own browser only.',
    );
  }
  const foam = createOceanFoam(ctx.field, { overcast: ctx.sky.uOvercast, sunDir: ctx.sky.sunDir });
  surface.setFoam(foam.reader);

  /** The store of one level as a window-ordered image, row-major from (ox, oz). */
  const windowImage = async (li: number) => {
    const r = await foam.probe.read(ctx.renderer, li);
    const n = r.level.n;
    const img = new Float32Array(n * n);
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        img[j * n + i] = r.data[foamCellOf(r.level, r.win.ox + i, r.win.oz + j)];
      }
    }
    return { img, n, win: r.win, texelM: r.level.texelM };
  };

  const probe: Record<string, unknown> = {
    tuneNames: Object.keys(foam.tune),
    /** Set a foam tuning uniform by name; an unknown name throws. */
    set: (name: string, value: number) => {
      const u = foam.tune[name];
      if (!u) throw new Error(`[ocean] No foam tuning uniform named "${name}".`);
      u.value = value;
      // A change to the source or the step invalidates the store.
      if (['modulation', 'deficitLo', 'deficitHi', 'decay', 'prodPerStep', 'fMax', 'wWind', 'wShort', 'breakerDecay', 'gateLo', 'gateHi', 'groupGain', 'residualDecay', 'residualYield', 'gateAlone', 'diffusion', 'lottery', 'inPlace', 'breakerTurn', 'lifeVar', 'depositPow', 'layLo', 'layHi', 'layTex', 'layDecay', 'seedTex', 'seedLo', 'seedHi', 'segDepth', 'segLo', 'segHi', 'segAcross', 'segAlong', 'curve', 'ageClock', 'ageDecay', 'ageB0', 'ageB1'].includes(name)) {
        foam.probe.invalidate();
      }
    },
    get: () => Object.fromEntries(Object.entries(foam.tune).map(([k, u]) => [k, u.value])),
    state: () => ({
      cursorStep: foam.probe.cursorStep,
      restarts: foam.probe.restarts,
      lastSteps: foam.probe.lastSteps,
      lastWarmupMs: foam.probe.lastWarmupMs,
      windows: foam.probe.windows,
    }),
    /**
     * Coverage statistics of one level's store over its window: the mean of
     * min(F, 1) (the drawn area, see `foamLaceAlpha`), the fraction over a
     * few thresholds, and the maximum.
     */
    stats: async (li = 0) => {
      const { img, n } = await windowImage(li);
      let cov = 0; let f01 = 0; let f03 = 0; let f1 = 0; let mx = 0;
      for (let k = 0; k < img.length; k += 1) {
        const f = img[k];
        cov += Math.min(Math.max(f, 0), 1);
        if (f > 0.1) f01 += 1;
        if (f > 0.3) f03 += 1;
        if (f > 1) f1 += 1;
        if (f > mx) mx = f;
      }
      const c = n * n;
      return { meanCoverage: cov / c, over01: f01 / c, over03: f03 / c, over1: f1 / c, max: mx };
    },
    /**
     * The normalized autocorrelation of one level's coverage, box-blurred to
     * `blurM`, at a lag of (lagXM, lagZM) meters: 1 is the same pattern one
     * lag away. With the lag at the wind sea's patch it measures the grid.
     */
    autocorr: async (li: number, lagXM: number, lagZM: number, blurM = 6) => {
      const { img, n, texelM } = await windowImage(li);
      const r = Math.max(0, Math.round(blurM / texelM / 2));
      const src = img.map((f) => Math.min(Math.max(f, 0), 1));
      const tmp = new Float32Array(n * n);
      const b = new Float32Array(n * n);
      for (let j = 0; j < n; j += 1) {
        for (let i = 0; i < n; i += 1) {
          let s = 0; let k = 0;
          for (let d = -r; d <= r; d += 1) { const ii = i + d; if (ii >= 0 && ii < n) { s += src[j * n + ii]; k += 1; } }
          tmp[j * n + i] = s / k;
        }
      }
      for (let j = 0; j < n; j += 1) {
        for (let i = 0; i < n; i += 1) {
          let s = 0; let k = 0;
          for (let d = -r; d <= r; d += 1) { const jj = j + d; if (jj >= 0 && jj < n) { s += tmp[jj * n + i]; k += 1; } }
          b[j * n + i] = s / k;
        }
      }
      const lx = Math.round(lagXM / texelM);
      const lz = Math.round(lagZM / texelM);
      let m = 0; for (const v of b) m += v; m /= b.length;
      let num = 0; let den = 0;
      for (let j = Math.max(0, -lz); j < Math.min(n, n - lz); j += 1) {
        for (let i = Math.max(0, -lx); i < Math.min(n, n - lx); i += 1) {
          const a = b[j * n + i] - m;
          num += a * (b[(j + lz) * n + i + lx] - m);
          den += a * a;
        }
      }
      return den > 0 ? num / den : 0;
    },
    /**
     * One level's coverage as a PNG data URL, grey = min(F, 1), window
     * ordered (+X right, +Z down), every `stride`-th texel.
     */
    image: async (li = 0, stride = 1) => {
      const { img, n } = await windowImage(li);
      const w = Math.floor(n / stride);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = w;
      const g = canvas.getContext('2d');
      if (!g) throw new Error('[ocean] no 2d canvas for the foam image');
      const id = g.createImageData(w, w);
      for (let j = 0; j < w; j += 1) {
        for (let i = 0; i < w; i += 1) {
          const v = Math.round(255 * Math.min(Math.max(img[(j * stride) * n + i * stride], 0), 1));
          const o = (j * w + i) * 4;
          id.data[o] = v; id.data[o + 1] = v; id.data[o + 2] = v; id.data[o + 3] = 255;
        }
      }
      g.putImageData(id, 0, 0);
      return canvas.toDataURL('image/png');
    },
    /** Lay foam down: `OceanFoam.setStamp`. For the wake piece and captures. */
    setStamp: (i: number, x: number, z: number, r: number, sv: number) => foam.setStamp(i, x, z, r, sv),
    /** The GPU lace and hash against their CPU mirrors (`OceanFoam.probe.mirrorCheck`). */
    mirrorCheck: (count?: number) => foam.probe.mirrorCheck(ctx.renderer, count),
    /**
     * The render pass's GPU time from timestamp queries with the foam read
     * on and bypassed (`bypass`), interleaved, and the foam step's compute
     * time the same way with the step on and skipped: `samples` of each,
     * min and median, ms. The differences are the read's and the step's
     * own costs. Under other GPU load the minimum is the honest number.
     */
    gpuCost: async (samples = 30) => {
      const r = ctx.renderer as unknown as {
        renderAsync(s: unknown, c: unknown): Promise<void>;
        computeAsync(n: unknown): Promise<void>;
        info: { updateTimestamp(type: string, t: number): void };
        hasFeature(f: string): boolean;
      };
      if (!r.hasFeature('timestamp-query')) {
        throw new Error('[ocean] gpuCost needs the timestamp-query feature, which this adapter lacks.');
      }
      const drawOn: number[] = [];
      const drawOff: number[] = [];
      const stepMs: number[] = [];
      let sink: number[] = drawOn;
      let csink: number[] | null = null;
      const orig = r.info.updateTimestamp.bind(r.info);
      r.info.updateTimestamp = (type: string, t: number) => {
        if (type === 'render') sink.push(t);
        if (type === 'compute' && csink) csink.push(t);
        orig(type, t);
      };
      const fence = async () => {
        await (ctx.renderer as unknown as { getArrayBufferAsync(a: unknown): Promise<ArrayBuffer> })
          .getArrayBufferAsync(ctx.field.buffers.disp);
      };
      try {
        for (let k = 0; k < samples + 3; k += 1) {
          for (const on of [true, false]) {
            foam.tune.bypass.value = on ? 0 : 1;
            sink = on ? drawOn : drawOff;
            await r.renderAsync(ctx.scene, ctx.camera);
            await fence();
            await new Promise((res) => setTimeout(res, 4));
          }
          csink = stepMs;
          await r.computeAsync(foam.stepNodes as unknown);
          await fence();
          csink = null;
          await new Promise((res) => setTimeout(res, 4));
        }
      } finally {
        r.info.updateTimestamp = orig;
        foam.tune.bypass.value = 0;
        foam.probe.invalidate();
      }
      const stat = (a: number[]) => {
        const k = a.slice(3).sort((x, y) => x - y);
        return { minMs: k[0], medianMs: k[Math.floor(k.length / 2)], samples: k.length };
      };
      return { drawOn: stat(drawOn), drawOff: stat(drawOff), step: stat(stepMs) };
    },
    /** The foam step alone, both levels, saturating, ms per step. */
    benchStep: (iters?: number) => foam.probe.benchStep(ctx.renderer, iters),
    /**
     * The step's CPU cost: one `renderer.compute(stepNodes)` call, the whole
     * step in one list, timed alone on the main thread (its encode and
     * submit; nothing here waits on the GPU), `iters` times with a fence
     * between calls so no call queues behind another. Min and median, ms.
     * Added for the performance pass (2026-09-25): the A/B's bench total
     * carries the step unnamed, and this splits its CPU side from its GPU
     * side (`gpuCost().step`). Probe only; the step itself is unchanged.
     */
    stepCpu: async (iters = 30) => {
      const r = ctx.renderer as unknown as {
        compute(n: unknown): void;
        getArrayBufferAsync(a: unknown): Promise<ArrayBuffer>;
      };
      const ts: number[] = [];
      for (let i = 0; i < iters; i += 1) {
        const t0 = performance.now();
        r.compute(foam.stepNodes as unknown);
        ts.push(performance.now() - t0);
        await r.getArrayBufferAsync(ctx.field.buffers.disp);
      }
      // performance.now() is quantized to 0.1 ms in a page that is not
      // cross-origin isolated, and one call sits under that. So also time
      // `iters` calls back to back (no fence: the CPU never waits on the
      // GPU here) and divide: the mean cost of one call.
      const bt: number[] = [];
      const b0 = performance.now();
      for (let i = 0; i < iters; i += 1) {
        const t0 = performance.now();
        r.compute(foam.stepNodes as unknown);
        bt.push(performance.now() - t0);
      }
      const batchPerCallMs = (performance.now() - b0) / iters;
      await r.getArrayBufferAsync(ctx.field.buffers.disp);
      // The steps ran on the live store; a warm-up rebuilds it.
      foam.probe.invalidate();
      const k = ts.slice(3).sort((a, b) => a - b);
      const bk = bt.slice().sort((a, b) => a - b);
      return {
        minMs: k[0], medianMs: k[Math.floor(k.length / 2)], samples: k.length,
        batchPerCallMs, batchMedianMs: bk[Math.floor(bk.length / 2)], batchMaxMs: bk[bk.length - 1],
        batchSlow: bt.map((v, i) => [i, v]).filter(([, v]) => v >= 1).slice(0, 5),
      };
    },
    /**
     * The step's GPU cost with the submit overhead taken out: `perSubmit`
     * whole steps inside ONE `renderer.compute` list (the same nodes
     * repeated; each repeat is a further step of the store), `submits`
     * submits back to back, one fence, ms per step. Against `benchStep`
     * (one step a submit) the difference is what a separate submit costs.
     * Added for the performance pass (2026-09-25). Probe only.
     */
    benchStepBatched: async (perSubmit = 10, submits = 20) => {
      const r = ctx.renderer as unknown as {
        compute(n: unknown): void;
        getArrayBufferAsync(a: unknown): Promise<ArrayBuffer>;
      };
      const list: unknown[] = [];
      for (let i = 0; i < perSubmit; i += 1) list.push(...(foam.stepNodes as unknown[]));
      const fence = () => r.getArrayBufferAsync(ctx.field.buffers.disp);
      r.compute(list);
      await fence();
      const t0 = performance.now();
      for (let i = 0; i < submits; i += 1) r.compute(list);
      await fence();
      const msPerStep = (performance.now() - t0) / (submits * perSubmit);
      foam.probe.invalidate();
      return { msPerStep, perSubmit, submits };
    },
    levels: FOAM_LEVELS,
  };

  return {
    update(simTime, dtS) {
      foam.step(ctx.renderer, ctx.camera, simTime, dtS === 0);
    },
    dispose() {
      foam.dispose();
    },
    probe,
  };
}

/**
 * @file oceanExtras/spray.ts — mounts sea spray in the ocean viewer.
 *
 * The simulation is `src/systems/world3d/ocean/oceanSpray.ts`. This file
 * only builds it against the viewer's sea, adds the strand mesh to the scene,
 * steps it once a frame, and publishes the probes the capture scripts in
 * `.agent/scratch/ocean-gauntlet/spray/` read (rootCheck.mjs, seenCheck.mjs,
 * perfBatch.mjs). `?extras=spray` turns it on; `&sea=storm` gives
 * it a wind that produces spray. On the default sea the Beaufort factor
 * leaves only a trace, which is the honest result for 11.5 m/s.
 *
 * The step ignores `dtS`: the spray keeps its own fixed-step cursor and
 * reaches `simTime` from it, so a pinned capture reproduces (see the
 * determinism note in oceanSpray.ts).
 */
import * as THREE from 'three/webgpu';
import { createOceanSpray } from '@/systems/world3d/ocean/oceanSpray';
import type { OceanExtra, OceanExtraContext } from '../oceanExtras';

export const enabledByDefault = false;

export default async function mount(ctx: OceanExtraContext): Promise<OceanExtra> {
  // The sky's overcast node is handed through, so under `&sea=storm` the
  // puffs are lit by the same deck the water reflects (see oceanSpray.ts).
  const spray = createOceanSpray(ctx.field, { sunDir: ctx.sky.sunDir, overcast: ctx.sky.uOvercast });
  ctx.scene.add(spray.mesh);

  const probe: Record<string, unknown> = {
    count: spray.count,
    windSpeedMs: spray.wind.speedMs,
    windDirRad: spray.wind.dirRad,
    crestSpeedMs: spray.wind.crestSpeedMs,
    windFactor: spray.probe.windFactor,
    /** Live: cursor step, steps run last frame, restarts so far. */
    state: () => ({
      cursorStep: spray.probe.cursorStep,
      lastSteps: spray.probe.lastSteps,
      restarts: spray.probe.restarts,
    }),
    /** Reads the buffers back: alive count and the spread of spawn steps. */
    census: () => spray.probe.census(ctx.renderer),
    /** The first n live particles, for debugging the strand draw. */
    dump: (n?: number) => spray.probe.dump(ctx.renderer, n),
    /**
     * Show or hide the strands. A capture of the surface's foam mask
     * (`__OCEAN__.setDebug(2)`) with the strands hidden is the map the roots
     * are checked against: a root must sit on drawn foam.
     */
    setVisible: (v: boolean) => { spray.mesh.visible = v; },
    /**
     * The update dispatch alone and the clear dispatch alone, ms per call,
     * saturating (see `OceanSpray.probe`). For `spray/perfSpray.mjs`, which
     * round-robins them with `__OCEAN__.bench` in one page load. Both move
     * the cursor off the pinned time, so the next frame restarts the spray.
     */
    benchStep: (iters?: number) => spray.probe.benchStep(ctx.renderer, iters),
    benchClear: (iters?: number) => spray.probe.benchClear(ctx.renderer, iters),
    /**
     * The seen deficit on a grid of water, projected: for x from x0 to x1 and
     * z from z0 to z1 at step m, each point's seen deficit and its displaced
     * position in screen pixels. `spray/seenCheck.mjs` compares it with the
     * surface's foam mask.
     */
    seenGrid: async (x0: number, x1: number, z0: number, z1: number, m: number) => {
      const pts: number[] = [];
      for (let z = z0; z <= z1; z += m) for (let x = x0; x <= x1; x += m) pts.push(x, z);
      const res = await spray.probe.seenAt(ctx.renderer, ctx.camera, new Float32Array(pts));
      const cam = ctx.camera;
      cam.updateMatrixWorld();
      const w = ctx.renderer.domElement.clientWidth;
      const h = ctx.renderer.domElement.clientHeight;
      const v = new THREE.Vector3();
      const out: number[] = [];
      for (let k = 0; k < pts.length / 2; k += 1) {
        v.set(res[k * 4 + 1], res[k * 4 + 2], res[k * 4 + 3]).project(cam);
        out.push(res[k * 4], (v.x * 0.5 + 0.5) * w, (0.5 - v.y * 0.5) * h);
      }
      return out;
    },
    /** The kernels batched in one pass, ms per dispatch (see oceanSpray.ts). */
    benchBatch: (batch?: number, reps?: number) => spray.probe.benchBatch(ctx.renderer, batch, reps),
    /**
     * Every live strand's root and tip in screen pixels of the current
     * camera and canvas (x right, y down), with its root strength and age.
     * The rooting check (`spray/rootCheck.mjs`) overlays these on the foam
     * mask. A point behind the camera comes back with `behind: true`.
     */
    roots: async () => {
      const rows = await spray.probe.dump(ctx.renderer, spray.count);
      const cam = ctx.camera;
      cam.updateMatrixWorld();
      const canvas = ctx.renderer.domElement;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const v = new THREE.Vector3();
      const toPx = (p: number[]) => {
        v.set(p[0], p[1], p[2]).applyMatrix4(cam.matrixWorldInverse);
        const behind = v.z > 0;
        v.applyMatrix4(cam.projectionMatrix);
        return { x: (v.x * 0.5 + 0.5) * w, y: (0.5 - v.y * 0.5) * h, behind };
      };
      return rows.map((r) => ({
        root: toPx(r.root as number[]),
        tip: toPx(r.tip as number[]),
        strength: r.strength,
        ageS: r.ageS,
        alongM: r.alongM,
        tauS: r.tauS,
        hAboveM: r.hAboveM,
        root3: r.root,
        tip3: r.tip,
        dist: Math.hypot(
          (r.root as number[])[0] - cam.position.x,
          (r.root as number[])[2] - cam.position.z,
        ),
      }));
    },
    /**
     * The whole frame WITH the spray, saturating, the way `__OCEAN__.bench`
     * measures the sea: `iters` iterations of sea step + spray step + render
     * enqueued with no rAF between, one fence. `__OCEAN__.bench` never calls
     * a piece's update, so its total leaves the spray's compute out; this
     * puts it back. `sprayStepMs` is the spray dispatch alone, `seaMs` the
     * sea's dispatch chain alone, `drawMs` the render alone (sprites in).
     * Consumes spray steps; a pinned capture afterwards must re-pin.
     */
    bench: async (iters = 200) => {
      const r = ctx.renderer;
      const sea = (t: number) => ctx.field.step(r, t);
      const draw = () => r.render(ctx.scene, ctx.camera);
      // Warm up.
      for (let i = 0; i < 20; i += 1) { sea(i * 0.01); spray.stepOnce(r, ctx.camera); draw(); }
      await spray.fence(r);

      const s0 = performance.now();
      for (let i = 0; i < iters; i += 1) sea(100 + i * 0.016);
      await spray.fence(r);
      const seaMs = (performance.now() - s0) / iters;

      const sprayStepMs = await spray.probe.benchStep(r, iters);

      const d0 = performance.now();
      for (let i = 0; i < iters; i += 1) draw();
      await spray.fence(r);
      const drawMs = (performance.now() - d0) / iters;

      const b0 = performance.now();
      for (let i = 0; i < iters; i += 1) {
        sea(200 + i * 0.016);
        spray.stepOnce(r, ctx.camera);
        draw();
      }
      await spray.fence(r);
      const totalMs = (performance.now() - b0) / iters;
      const census = await spray.probe.census(r);
      // Last: it kills every particle. Its time is the per-call floor, so
      // sprayStepMs - clearMs is the update kernel's own GPU time.
      const clearMs = await spray.probe.benchClear(r, iters);
      return { seaMs, sprayStepMs, clearMs, drawMs, totalMs, iters, alive: census.alive };
    },
  };

  return {
    update(simTime) {
      spray.step(ctx.renderer, ctx.camera, simTime);
    },
    dispose() {
      ctx.scene.remove(spray.mesh);
      spray.dispose();
    },
    probe,
  };
}

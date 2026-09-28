/**
 * @file oceanExtras/seabed.ts — mounts the sea floor in the ocean viewer.
 *
 * `?extras=seabed&sea=shallow` turns it on: a sand lagoon behind a reef under
 * the `shallow` sea state (a real depth, so TMA shortens the long waves as a
 * shoal does). The simulation is `src/systems/world3d/ocean/oceanSeabed.ts`
 * (the GPU caustic web and the see-through reader) and `oceanSeabedMath.ts`
 * (the optics, the bathymetry and every constant). This file builds it
 * against the viewer's sea, hands the reader to the surface, adds the floor
 * mesh, and draws the web once a frame.
 *
 * THE SURFACE HOOK. The floor is seen through the water by the surface's own
 * shader, through `surface.setSeabed(reader)` (a change to oceanSurface.ts
 * routed by the lead; the exact text is in the caustics report). When the
 * surface does not have the hook yet, this mount FAILS with that message: the
 * floor would be drawn only from under the water, and a capture from above
 * would show the old deep sea under a label that says shallows.
 *
 * The web is a pure function of the sea's time: a pinned clock gives the
 * same floor every run.
 */
import * as THREE from 'three/webgpu';
import type { OceanSurface } from '@/systems/world3d/ocean/oceanSurface';
import { createOceanSeabed, type OceanSeabedReader } from '@/systems/world3d/ocean/oceanSeabed';
import type { OceanExtra, OceanExtraContext } from '../oceanExtras';

/** Off unless asked for: the floor belongs to the shallows, not to the open sea. */
export const enabledByDefault = false;

type SeabedSurface = OceanSurface & { setSeabed?: (reader: OceanSeabedReader | null) => void };

export default async function mount(ctx: OceanExtraContext): Promise<OceanExtra> {
  const surface = ctx.field.surface as SeabedSurface;
  if (typeof surface.setSeabed !== 'function') {
    throw new Error(
      '[ocean] The seabed piece is seen through the surface hook `setSeabed(reader)` in '
      + 'oceanSurface.ts, and this surface does not have it yet. The change is written out '
      + 'in the caustics report (ocean gauntlet); until it lands, capture with '
      + '.agent/scratch/ocean-gauntlet/caustics/shootCaustics.mjs, which serves the surface '
      + 'with the hook applied in its own browser only.',
    );
  }
  const seabed = createOceanSeabed({
    field: ctx.field,
    sunDir: ctx.sky.sunDir,
    overcast: ctx.sky.uOvercast,
  });
  surface.setSeabed(seabed.reader);
  ctx.scene.add(seabed.mesh);

  let floorOnly = false;
  let stepping = true;
  const probe: Record<string, unknown> = {
    ...seabed.probe,
    layerStats: (li: number) => (seabed.probe.layerStats as (r: unknown, i: number) => Promise<unknown>)(ctx.renderer, li),
    crossCheck: (li: number) => (seabed.probe.crossCheck as (r: unknown, i: number) => Promise<unknown>)(ctx.renderer, li),
    layerImage: (li: number) => (seabed.probe.layerImage as (r: unknown, i: number) => Promise<string>)(ctx.renderer, li),
    /**
     * The floor alone: hide the water and draw the floor mesh from above, so
     * the floor and its web can be judged without the surface over them.
     * A diagnosis, not a look: false puts the water back.
     */
    floorOnly: (on: boolean) => {
      floorOnly = on;
      ctx.field.surface.mesh.visible = !on;
    },
    benchStep: (iters?: number, parts?: string) => (seabed.probe.benchStep as (r: unknown, c: unknown, n?: number, p?: string) => Promise<unknown>)(ctx.renderer, ctx.camera, iters, parts),
    /** Draw the web each frame (true, the default) or hold the last one: for a frame-time A/B. */
    setStepping: (on: boolean) => { stepping = on; },
    /**
     * Hand the reader to the surface (true, the default) or take it back
     * (false): the surface rebuilds its shader each way. For a frame-time A/B
     * of the see-through shading.
     */
    setReader: (on: boolean) => { surface.setSeabed?.(on ? seabed.reader : null); },
    /**
     * GPU timestamps, ms: the caustic pass alone, and the whole scene pass
     * with the see-through reader and without it, alternated per sample so
     * the two sides share the GPU's load. The scene pass is the viewer's own
     * (surface, sky, anything mounted), at the current pose.
     */
    gpuTimes: async (samples = 20) => {
      const passMs = seabed.probe.gpuPassMs as (r: unknown, f: () => Promise<void>, n: number) => Promise<number[]>;
      const caustic = await (seabed.probe.causticPassMs as (r: unknown, n: number) => Promise<number[]>)(ctx.renderer, samples);
      // The scene is timed into a target of the canvas's size (a new camera
      // per sample, see `gpuPassMs`); the canvas pass's own context reused
      // its first timestamp. No multisampling: the fragment shader runs once
      // a pixel either way, and the reader is fragment work.
      const size = ctx.renderer.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.RenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
      const timeScene = async () => {
        const prev = ctx.renderer.getRenderTarget();
        ctx.renderer.setRenderTarget(rt);
        await ctx.renderer.renderAsync(ctx.scene, ctx.camera.clone());
        ctx.renderer.setRenderTarget(prev);
      };
      const withReader: number[] = [];
      const without: number[] = [];
      try {
        for (let i = 0; i < samples; i += 1) {
          surface.setSeabed?.(null);
          await timeScene();
          without.push(...await passMs(ctx.renderer, timeScene, 1));
          surface.setSeabed?.(seabed.reader);
          await timeScene();
          withReader.push(...await passMs(ctx.renderer, timeScene, 1));
        }
      } finally {
        surface.setSeabed?.(seabed.reader);
        rt.dispose();
      }
      return { caustic, withReader, without };
    },
  };

  return {
    update() {
      if (stepping) seabed.step(ctx.renderer, ctx.camera);
      if (floorOnly) seabed.mesh.visible = true;
    },
    dispose() {
      surface.setSeabed?.(null);
      ctx.scene.remove(seabed.mesh);
      seabed.dispose();
    },
    probe,
  };
}

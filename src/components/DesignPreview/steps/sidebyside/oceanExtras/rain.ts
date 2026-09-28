/**
 * @file oceanExtras/rain.ts — mounts the rain piece in the ocean viewer.
 *
 * `?extras=rain` turns it on; `&sea=storm` gives it the sea it was measured
 * against. The simulation is `src/systems/world3d/ocean/oceanRain.ts`; this
 * file only builds it, adds it to the scene and steps it once a frame.
 *
 * The rain leans with the sea's own wind: the drift heading is read from the
 * sea state's strongest foam-driving cascade (`rainDriftDirRad`), so a storm
 * whose wind sea runs at 0.35 rad rains along 0.35 rad.
 *
 * The storm's cloud deck is the sky module's: `oceanSky.ts` has an overcast
 * state and the viewer sets it under `sea=storm`, so `stormCeiling` is 0
 * here and the rain's dome carries the murk alone. The deck code in
 * `oceanRain.ts` stays, switched off, for a viewer that has no overcast sky;
 * `OceanRainOptions.stormCeiling` says what it is for.
 */
import * as THREE from 'three/webgpu';
import type { OceanExtra, OceanExtraContext } from '../oceanExtras';
import { createOceanRain } from '@/systems/world3d/ocean/oceanRain';
import { STORM_RAIN, rainDriftDirRad } from '@/systems/world3d/ocean/oceanRainMath';

/** Off unless asked for: rain belongs to the storm, not to the shipped sea. */
export const enabledByDefault = false;

// Reused each frame so the update allocates nothing.
const sizeScratch = new THREE.Vector2();

export default async function mount(ctx: OceanExtraContext): Promise<OceanExtra> {
  const rain = createOceanRain({
    params: { ...STORM_RAIN, driftDirRad: rainDriftDirRad(ctx.field.cascades) },
    seed: ctx.seed,
    buffers: ctx.field.buffers,
    cascades: ctx.field.cascades,
    stormCeiling: 0,
  });
  ctx.scene.add(rain.group);

  return {
    update(simTime: number) {
      // NO RAIN UNDER THE WATER (GG-296, routed by the underwater piece). The
      // murk dome draws with no depth test, so under the surface it grayed
      // the whole view: row 600 of the storm view from below went from
      // (0, 20, 33) to (79, 80, 79). Above the water nothing changes: the
      // camera there is at y >= 0, and the group stays visible.
      rain.group.visible = ctx.camera.position.y >= 0;
      if (!rain.group.visible) return;
      // The drawing-buffer height, not the CSS height: the pixel floor on
      // streak width must count device pixels.
      const size = ctx.renderer.getDrawingBufferSize(sizeScratch);
      // The sea's dense center follows the camera (the viewer's frame loop
      // calls `surface.setCenter`, 2026-09-25), so the rain reads the sea
      // about the same center. With the camera at x = z = 0 it stays 0.
      rain.setSeaCenter(ctx.field.surface.center.x, ctx.field.surface.center.y);
      rain.update(ctx.camera, size.y, simTime);
    },
    dispose() {
      rain.dispose();
    },
    probe: rain.probe,
  };
}

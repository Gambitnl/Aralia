/**
 * @file oceanExtras/beach.ts — mounts the beach in the ocean viewer.
 *
 * `?extras=beach&sea=shallow` turns it on: the lagoon of the caustics piece
 * with a sand cay in it, whose long side facing the swell is a beach with a
 * swash that runs up the sand and drains into it, wet sand that dries, and
 * shells, sticks and seaweed the sheet pushes about. The simulation is
 * `src/systems/world3d/ocean/oceanBeach.ts` (the GPU look), its worker
 * `oceanBeachWorker.ts`, and `oceanBeachMath.ts` (the physics and every
 * constant).
 *
 * THE BEACH BRINGS ITS OWN SEA FLOOR. It builds the caustics piece's floor
 * (`createOceanSeabed`) from the lagoon plus the cay, with its own hook, and
 * hands that floor's reader to the surface (`setSeabed`). So `extras=beach`
 * does not list `seabed`; listing both fails the mount, because two floors
 * would fight over the one reader slot.
 *
 * A PINNED CAPTURE must wait for the beach: the worker brings it to the
 * pinned time from its fixed start, which takes a few seconds the first time
 * (about a quarter of a second of work per second of beach time). Poll
 * `__OCEAN__.extras.beach.settled()` after `setTime` before the shot.
 */
import type { OceanSurface } from '@/systems/world3d/ocean/oceanSurface';
import type { OceanSeabedReader } from '@/systems/world3d/ocean/oceanSeabed';
import { createOceanBeach } from '@/systems/world3d/ocean/oceanBeach';
import type { OceanExtra, OceanExtraContext } from '../oceanExtras';

/** Off unless asked for: the beach belongs to the shallows, not to the open sea. */
export const enabledByDefault = false;

type SeabedSurface = OceanSurface & { setSeabed?: (reader: OceanSeabedReader | null) => void };

export default async function mount(ctx: OceanExtraContext): Promise<OceanExtra> {
  const surface = ctx.field.surface as SeabedSurface;
  if (typeof surface.setSeabed !== 'function') {
    throw new Error('[ocean] The beach is seen through the surface hook `setSeabed(reader)`, and this surface does not have it.');
  }
  const listed = new URLSearchParams(window.location.search).get('extras') ?? '';
  if (listed.split(',').map((s) => s.trim()).includes('seabed')) {
    throw new Error(
      '[ocean] extras=beach brings its own sea floor (the lagoon with the cay). '
      + 'Mount it without `seabed`: two floors would fight over the surface\'s one reader.',
    );
  }
  const beach = await createOceanBeach({
    field: ctx.field,
    sunDir: ctx.sky.sunDir,
    overcast: ctx.sky.uOvercast,
    skyClouds: ctx.sky.cloudReflTexture,
    seed: ctx.seed,
  });
  surface.setSeabed(beach.seabed.reader);
  ctx.scene.add(beach.seabed.mesh);
  ctx.scene.add(beach.group);

  let stepping = true;
  const probe: Record<string, unknown> = {
    ...beach.probe,
    seabed: beach.seabed.probe,
    /**
     * Stop asking the worker for new states (true, the default, keeps it
     * running): for a frame-time A/B. The floor's caustic web keeps drawing.
     */
    setStepping: (on: boolean) => { stepping = on; },
    /**
     * Hand the floor's reader to the surface (true, the default) or take it
     * back (false): the surface rebuilds its shader each way.
     */
    setReader: (on: boolean) => { surface.setSeabed?.(on ? beach.seabed.reader : null); },
  };

  return {
    update(simTime: number, dtS: number) {
      // A pinned clock hands the pieces a zero step (see oceanExtras.ts).
      beach.update(ctx.renderer, ctx.camera, simTime, dtS === 0, stepping);
    },
    dispose() {
      surface.setSeabed?.(null);
      ctx.scene.remove(beach.seabed.mesh);
      ctx.scene.remove(beach.group);
      beach.dispose();
    },
    probe,
  };
}

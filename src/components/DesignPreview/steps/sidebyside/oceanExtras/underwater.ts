/**
 * @file oceanExtras/underwater.ts — mounts the underwater view in the ocean viewer.
 *
 * `?extras=underwater` turns it on; `&sea=storm` gives the storm from below.
 * The system is `src/systems/world3d/ocean/oceanUnderwater.ts` (the GPU
 * side) and `oceanUnderwaterMath.ts` (every number and its CPU twin); this
 * file only builds it, adds it to the scene and steps it once a frame.
 *
 * WHAT IT DRAWS DEPENDS ON THE EYE. Above the reach of the waves it draws
 * nothing and costs nothing but a height compare; within that reach it
 * tests the waterline per pixel; below it draws the whole underwater view.
 * So the piece can be left mounted over the above-water poses.
 *
 * THE CAPTURE PROBE, `__OCEAN__.extras.underwater`:
 *
 *   mode()               'above', 'straddle' or 'under', for the last frame
 *   setTune(name, v)     one of the tuning uniforms (see `tune` there)
 *   getTune()            all of them
 *   setPart(part, on)    'underside', 'dome', 'shafts', 'snow', 'meniscus'
 *   setDebugColor(rgb)   the dome in one flat scene-linear color, for the
 *                        tone-map check; null to draw the scene
 *   lensRms              the lens tiles' spread, from the spectrum
 *   benchPiece(frames, rounds)  the piece's own GPU cost: blocks of whole
 *                        frames (sea step, piece update, render) with every
 *                        part on, then off (its compute passes skip when no
 *                        visible part reads them), then the old view (off,
 *                        and the surface drawn), alternating. Alternating in
 *                        small blocks keeps a GPU shared with other
 *                        processes from loading one side more than the
 *                        other. `pieceMs` is on - off; `vsOldViewMs` is
 *                        on - old view. Since round 4 each block is the
 *                        viewer's `__OCEAN__.bench(frames)` `totalMs`: that
 *                        bench PAUSES the live loop and drains its queue
 *                        first. Round 3 fenced its own blocks with the live
 *                        loop still running, so each block waited behind the
 *                        frames the loop had queued (the probe trap in the
 *                        domain doc's "## Frame cost"), and on a loaded GPU
 *                        it gave 22 to 28 ms frames and a negative piece cost
 *                        (round 4, first run).
 *
 * It needs the surface drawn front side only, which oceanSurface.ts owns;
 * the mount fails with a clear message if that ever changes.
 */
import * as THREE from 'three/webgpu';
import type { OceanExtra, OceanExtraContext } from '../oceanExtras';
import { createOceanUnderwater } from '@/systems/world3d/ocean/oceanUnderwater';

/** Off unless asked for, until it has won its views. */
export const enabledByDefault = false;

// Reused each frame so the update allocates nothing.
const sizeScratch = new THREE.Vector2();

export default async function mount(ctx: OceanExtraContext): Promise<OceanExtra> {
  const uw = createOceanUnderwater({ field: ctx.field, sky: ctx.sky, seed: ctx.seed });
  ctx.scene.add(uw.group);
  // Build every pipeline now, before the page reports ready (see warmUp).
  uw.warmUp(ctx.renderer, ctx.camera, ctx.scene);

  return {
    update(simTime: number) {
      // The drawing-buffer height, not the CSS height: the flakes' pixel
      // floor must count device pixels.
      const size = ctx.renderer.getDrawingBufferSize(sizeScratch);
      uw.update(ctx.renderer, ctx.camera, simTime, size.y);
    },
    dispose() {
      uw.dispose();
    },
    probe: {
      mode: () => uw.mode,
      setTune: (name: string, value: number) => {
        const u = uw.tune[name];
        if (!u) throw new Error(`[ocean] No underwater tuning uniform named "${name}". Names: ${Object.keys(uw.tune).join(', ')}.`);
        u.value = value;
      },
      getTune: () => Object.fromEntries(Object.entries(uw.tune).map(([k, u]) => [k, u.value])),
      setPart: (part: string, on: boolean) => uw.setPart(part, on),
      setDebugColor: (rgb: [number, number, number] | null) => uw.setDebugColor(rgb),
      setDebugShare: (on: boolean) => uw.setDebugShare(on),
      setDebugTerm: (term: number) => uw.setDebugTerm(term),
      lensRms: uw.lensRms,
      benchPiece: async (frames = 60, rounds = 6, only: string[] | null = null) => {
        // The viewer's bench, which pauses the live loop (see the header).
        const viewer = (globalThis as unknown as {
          __OCEAN__?: { bench?: (iters: number) => Promise<{ totalMs: number }> };
        }).__OCEAN__;
        const bench = viewer?.bench;
        if (typeof bench !== 'function') {
          throw new Error('[ocean] benchPiece needs the viewer probe __OCEAN__.bench, which pauses the live loop; it is not there.');
        }
        // `only` names the parts toggled; the rest stay on. Default: all.
        const parts = only ?? ['underside', 'dome', 'snow', 'meniscus', 'shafts'];
        // A block of whole frames. 'on' is the piece as shipped; 'off' hides
        // every part but keeps the surface's skip, so on - off is the piece's
        // own work; 'bare' also draws the surface, which is the old view
        // (`extras=none`), so on - bare is what going under costs the frame.
        const block = async (kind: 'on' | 'off' | 'bare'): Promise<number> => {
          for (const part of parts) uw.setPart(part, kind === 'on');
          uw.setPart('surfaceSkip', kind !== 'bare');
          return (await bench(frames)).totalMs;
        };
        // Warm every kind first: a first-run compile must not land in a block.
        await block('on');
        await block('off');
        await block('bare');
        const on: number[] = [];
        const off: number[] = [];
        const bare: number[] = [];
        for (let k = 0; k < rounds; k += 1) {
          on.push(await block('on'));
          off.push(await block('off'));
          bare.push(await block('bare'));
        }
        for (const part of parts) uw.setPart(part, true);
        uw.setPart('surfaceSkip', true);
        const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
        return {
          onMs: med(on), offMs: med(off), bareMs: med(bare),
          pieceMs: med(on.map((x, i) => x - off[i])),
          vsOldViewMs: med(on.map((x, i) => x - bare[i])),
          onMinMs: Math.min(...on), offMinMs: Math.min(...off), bareMinMs: Math.min(...bare), mode: uw.mode,
        };
      },
    },
  };
}

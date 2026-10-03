/**
 * @file rocks.ts — the rocks piece of the ocean viewer (`?extras=rocks`).
 *
 * Low, dark rocks stand in the surf, and the sea breaks on them: the water
 * runs up the struck face, a fast high crest bursts up in a plume of spray,
 * the run-up that passes a face's top edge washes over the top and cascades
 * back off every face, foam gathers round the base and drifts off, and the
 * rock is wet and dark below the last run-up. The model is
 * `src/systems/world3d/ocean/oceanRocksMath.ts`; the GPU side and the draw
 * are `oceanRocks.ts`. This file places the rocks and publishes the probe.
 *
 * THE BAR (Remy's ruling on the Water and Land sheet, q33: real footage,
 * asked for clip by clip; both clips approved):
 *   - "Waves crashing on rocks off Beach 4, Kalaloch Beach, Washington 02",
 *     Joe Mabel, CC BY-SA 4.0, Wikimedia Commons
 *     (https://commons.wikimedia.org/wiki/File:Waves_crashing_on_rocks_off_Beach_4,_Kalaloch_Beach,_Washington_02.webm):
 *     a telephoto view from the shore at dusk onto one low rock; frames
 *     k2_004, k2_012 and k2_014 show a wave rising against the rock and
 *     breaking over it in a white burst.
 *   - "Big Waves Hitting Shore and Sea Lions - Free Stock Creative Commons
 *     Video", Freestocks, CC BY 3.0, Wikimedia Commons
 *     (https://commons.wikimedia.org/wiki/File:Big_Waves_Hitting_Shore_and_Sea_Lions_-_Free_Stock_Creative_Commons_Video.webm):
 *     daylight; frames sl_002 to sl_005 show a wave bursting up a rock in a
 *     tall plume, then a white sheet cascading back off the rock face.
 * The judged views (`ROCK_POSES` below) are framed on those frames.
 *
 * WHERE THE ROCKS STAND. The `surf` state's waves travel toward -Z (in
 * this pipeline a cascade's waves go toward its windDirRad + pi; see
 * oceanSeaStates.ts), so a camera on the -Z side of the rocks looking
 * toward +Z is a camera on the shore with the waves coming at it, as in
 * both clips: the struck faces are the far faces, the plume stands up
 * behind the rock, and the wash comes over the top toward the eye. The
 * shared test sun is then behind the camera (the daylight view); the
 * Kalaloch view asks for a low sun ahead through `?sun=` (dusk).
 *
 * Added by the rocks piece of the ocean gauntlet (round 1, 2026-09-29).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 29/09/2026, 19:24:38
 * Dependents: None (Orphan)
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { FOAM_DISC_SLOTS } from '@/systems/world3d/ocean/oceanFoam';
import { createOceanRocks } from '@/systems/world3d/ocean/oceanRocks';
import { rockFoamSources, type RockSpec } from '@/systems/world3d/ocean/oceanRocksMath';
import type { OceanExtra, OceanExtraContext } from '../oceanExtras';

export const enabledByDefault = false;

/**
 * THREE ROCKS (round 2: blocks). Both judges read round 1's rock as "one
 * smooth, rubbery hump". The main rock is now a cluster of four jointed
 * blocks (`lobes`) cut by 14 joint planes, 6.7 by 4.4 m: a tall block on
 * its seaward side standing 2.2 m out of the still water, a 1.6 m block
 * beside it, a low 1.0 m shelf on the shore side that the wash pours over,
 * and a knob on its flank (the Kalaloch rock: three or four rounded blocks
 * with dark gaps; sl_003: a lumpy stack). On the `surf` sea shoaled over
 * the reef the large crests reach 2 m at the rock: they burst on the tall
 * block and wash over the low ones. The two small rocks, 2.6 and 3.2 m
 * across and 1.0 and 1.4 m high, are awash at most crests.
 */
export const ROCK_SPECS: readonly RockSpec[] = [
  {
    xM: 0, zM: -60, halfLengthM: 3.0, halfWidthM: 2.2, headingRad: 0.18, topM: 2.2, baseM: 4.5,
    squareness: 3.2, flatness: 4.5, taper: 0.18, tiltAlong: 0.04, tiltAcross: -0.04,
    lumps: 0.07, creaseM: 0.14, seed: 101, facets: 14,
    lobes: [
      { dxM: -0.9, dzM: 0.5, halfLengthM: 2.0, halfWidthM: 1.6, upM: 2.2, downM: 4.5, headingRad: 0.25, squareness: 5, flatness: 5 },
      { dxM: 1.4, dzM: -0.2, halfLengthM: 1.7, halfWidthM: 1.4, upM: 1.6, downM: 4.5, headingRad: -0.3, squareness: 4, flatness: 4.5 },
      { dxM: 0.3, dzM: -1.0, halfLengthM: 2.6, halfWidthM: 1.3, upM: 1.0, downM: 4.5, headingRad: 0.05, squareness: 3.5, flatness: 4 },
      { dxM: -1.6, dzM: 0.1, halfLengthM: 1.9, halfWidthM: 1.3, upM: 1.3, downM: 4.5, headingRad: 0.6, squareness: 3.2, flatness: 3.6 },
    ],
  },
  {
    xM: -7.2, zM: -57.5, halfLengthM: 1.3, halfWidthM: 1.0, headingRad: -0.6, topM: 1.0, baseM: 4,
    squareness: 2.8, flatness: 3.5, taper: 0.25, tiltAlong: 0.1, tiltAcross: 0.04,
    lumps: 0.1, creaseM: 0.1, seed: 202, facets: 9,
    lobes: [
      { dxM: -0.3, dzM: 0.1, halfLengthM: 1.0, halfWidthM: 0.9, upM: 1.0, downM: 4, headingRad: 0.2, squareness: 4, flatness: 4 },
      { dxM: 0.45, dzM: -0.1, halfLengthM: 0.9, halfWidthM: 0.75, upM: 0.7, downM: 4, headingRad: -0.4, squareness: 3.5, flatness: 3.5 },
    ],
  },
  {
    xM: 6.3, zM: -64, halfLengthM: 1.6, halfWidthM: 1.2, headingRad: 0.9, topM: 1.4, baseM: 4,
    squareness: 3.0, flatness: 4.0, taper: 0.22, tiltAlong: -0.06, tiltAcross: 0.05,
    lumps: 0.1, creaseM: 0.12, seed: 303, facets: 10,
    lobes: [
      { dxM: 0.4, dzM: 0.1, halfLengthM: 1.2, halfWidthM: 1.0, upM: 1.4, downM: 4, headingRad: 0.1, squareness: 4.5, flatness: 4.5 },
      { dxM: -0.6, dzM: -0.1, halfLengthM: 1.1, halfWidthM: 0.9, upM: 0.9, downM: 4, headingRad: -0.5, squareness: 3.5, flatness: 3.8 },
    ],
  },
];

/**
 * Where the white water goes (Remy's one-water rule). Round 3: the sea's
 * one foam field is the only default path (foam round 10's source
 * registry), so the foam piece must run on the page: `extras=foam,rocks`
 * (or `extras=all`). Without it the mount fails with that message, rather
 * than draw rocks with no white water. `?rockFoam=own` is the round-1
 * stopgap grid, kept for an A/B only.
 */
function foamPathParam(): 'field' | 'own' {
  const q = new URLSearchParams(globalThis.location?.search ?? '');
  const v = q.get('rockFoam');
  if (v === 'own') return 'own';
  if (v !== null && v !== 'field') throw new Error(`[ocean] ?rockFoam=${v}: use field or own.`);
  const extras = (q.get('extras') ?? '').split(',').map((s) => s.trim());
  if (!extras.includes('foam') && !extras.includes('all')) {
    throw new Error(
      '[ocean] The rocks send their white water into the sea\'s one foam field, so the foam '
      + 'piece must run too: use extras=foam,rocks (or ?rockFoam=own for the old stopgap grid).',
    );
  }
  return 'field';
}

/**
 * Round 5: how the plume is drawn. The default is one ray march a pixel
 * (oceanSplash.ts, WHY A MARCH); `?plume=slices` draws round 4's slice stack
 * for an A/B only.
 */
function plumeDrawParam(): 'march' | 'slices' {
  const v = new URLSearchParams(globalThis.location?.search ?? '').get('plume');
  if (v === null || v === 'march') return 'march';
  if (v === 'slices') return 'slices';
  throw new Error(`[ocean] ?plume=${v}: use march or slices.`);
}

export default async function mount(ctx: OceanExtraContext): Promise<OceanExtra> {
  const rocks = createOceanRocks({
    renderer: ctx.renderer,
    scene: ctx.scene,
    camera: ctx.camera,
    field: ctx.field,
    sunDir: ctx.sky.sunDir,
    overcast: ctx.sky.uOvercast,
    specs: ROCK_SPECS,
    // The main rock at icosphere level 6 (40,962 vertices, 6 cm edges: its
    // joints and ledges are sharp at the telephoto's 7 mm a pixel), the
    // small ones at 5.
    meshLevels: [6, 5, 5],
    foamPath: foamPathParam(),
    plumeDraw: plumeDrawParam(),
  });

  const probe: Record<string, unknown> = {
    /** The pinned time the drawn state belongs to (null while it is being built). */
    settled: () => rocks.settledTime,
    /** Where the white water went: 'field' (the sea's foam field) or 'own' (the rocks' own grid). */
    foamPath: () => rocks.foamPath,
    stats: () => rocks.stats(),
    /** Round 4: the foam discs handed to the sea's foam field now (x, z, radius, strength, t0, t1). */
    discs: () => rockFoamSources(rocks.sim, rocks.sim.time, FOAM_DISC_SLOTS).map((d) => [d.xM, d.zM, d.rM, +d.s.toFixed(3), d.t0S, d.t1S]),
    /** Round 4: the live splash particles (x, y, z, kind, owner, vx, vy, vz, age: nine numbers a particle), for a plot of where the burst stands. */
    splashDump: () => {
      const p = rocks.sim.splash;
      const out: number[] = [];
      for (let a = 0; a < p.alive; a += 1) {
        const i = p.aliveIndex[a];
        out.push(+p.pos[i * 3].toFixed(3), +p.pos[i * 3 + 1].toFixed(3), +p.pos[i * 3 + 2].toFixed(3), p.kind[i], p.owner[i],
          +p.vel[i * 3].toFixed(2), +p.vel[i * 3 + 1].toFixed(2), +p.vel[i * 3 + 2].toFixed(2), +p.age[i].toFixed(3));
      }
      return out;
    },
    /** The splash's debug draw: 0 the shipped draw, 1 the sun and sky shares as color, 2 every quad opaque. */
    debugSpray: (m: number) => rocks.debugSpray(m),
    /** Round 5: the marched plume's debug draw: 0 the shipped draw, 1 its opacity as grey, 2 the depth prepass. */
    debugPlume: (m: number) => rocks.debugPlume(m),
    /** What the rocks do from t0 to t1 (see `OceanRocks.scan`); pass the pinned time as `now`. */
    scan: (t0: number, t1: number, every?: number, now?: number) => rocks.scan(t0, t1, every, now),
    tables: () => rocks.tables.map((t) => ({
      center: [t.centerX, t.centerZ], topM: t.topM, topAreaM2: t.topAreaM2,
      waterline: Array.from(t.waterlineM), rim: Array.from(t.rimM), slopeDeg: Array.from(t.slopeRad, (r) => (r * 180) / Math.PI),
    })),
    /** Show or hide one part: 'spray', 'foam', 'rocks', 'patch'. */
    setVisible: (part: string, on: boolean) => {
      for (const o of rocks.group.children) {
        if (part === 'spray' && (o.name === 'oceanRockSpray' || o.name.startsWith('oceanRockPlume'))) o.visible = on;
        else if (part === 'drops' && o.name === 'oceanRockSpray') o.visible = on;
        else if (part === 'plume' && o.name.startsWith('oceanRockPlume')) o.visible = on;
        else if (part === 'water' && o.name.startsWith('oceanRockWater')) o.visible = on;
        else if (part === 'foam' && o.name.startsWith('oceanRockFoam')) o.visible = on;
        else if (part === 'rocks' && /^oceanRock\d/.test(o.name)) o.visible = on;
        else if (part === 'patch' && o.name === 'oceanRockFinePatch') o.visible = on;
      }
    },
  };

  return {
    update: (simTime, dtS) => rocks.update(simTime, dtS),
    dispose: () => rocks.dispose(),
    probe,
  };
}

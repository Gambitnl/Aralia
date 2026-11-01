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
 * Last Sync: 11/10/2026, 01:38:15
 * Dependents: None (Orphan)
 * Imports: 4 files
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
 * ROCKS ROUND 18: THE MAIN ROCK IS THE CLIP'S (GG-418; the lead: seventeen rounds judged the wrong rock).
 * k2_012's rock, measured (rocks/r18/clipMask18.py, clipProfile18.py; the stone the frame's darkest
 * surface, its foot where the sea starts under it): 0.522 of the frame's width by 0.228 of its height,
 * centered at (0.510, 0.459), 4.07 times wider than tall (k2_013 4.08, k2_014 3.92); a flat crest (0.84
 * of the top within 0.12 of the height of its local crest) over u 0.2 to 0.75 of the width, falling to
 * 0.48 at the left end and 0.57 at the right; its base at the waterline 0.81 of its width. At the judged
 * camera (round 13's, 85 m, fov 3.49 deg: 9.6 mm a pixel of the clip's 960 x 540 at the rock) that is
 * 4.8 m by 1.2 m of silhouette over the sea. The four lobes below were solved for that silhouette
 * (rocks/r18/lobes18.ts: coordinate descent on the lobes' centers, sizes and heights for the IoU of the
 * mesh's projection over the judged instant's water, 1.4 m, against the clip's mask, with the rear-left
 * lobe at least 0.4 m more seaward, where the clip's plume stands): IoU 0.84 (round 17's loaf, rendered:
 * 0.39). The rock is 6.3 by 4.8 m at still water and 2.23 m high, its flat crest 5 m long over the judged
 * instant's 1.4 m water (the loaf's 3.6 m): a wide low cluster, as both clips show
 * (sl_003's rock too is about four times wider than tall). Round 17's rock is ROCK_SPEC_LOAF.
 *
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
    xM: 0, zM: -60, halfLengthM: 3.0, halfWidthM: 2.2, headingRad: 0.18, topM: 2.27, baseM: 4.5,
    squareness: 3.2, flatness: 4.5, taper: 0.12, tiltAlong: 0, tiltAcross: 0,
    lumps: 0.07, creaseM: 0.14, seed: 101, facets: 14,
    lobes: [
      // A, the rear-left block the crest strikes first (the clip's plume column peaks over u 0.0 to 0.4).
      { dxM: 0.45, dzM: 0.9, halfLengthM: 2.2, halfWidthM: 2.4, upM: 2.2, downM: 4.5, headingRad: 0, squareness: 5, flatness: 5.5 },
      // B, the right-center block (the flat crest over u 0.5 to 0.75).
      { dxM: -0.85, dzM: 0.3, halfLengthM: 2.12, halfWidthM: 1.25, upM: 2.27, downM: 4.5, headingRad: 0, squareness: 4.5, flatness: 5 },
      // C, the right tail, falling to 0.57 of the rock's height at its end.
      { dxM: -2.25, dzM: 0.3, halfLengthM: 2.7, halfWidthM: 1.4, upM: 2.06, downM: 4.5, headingRad: 0.07, squareness: 3.8, flatness: 4.2 },
      // D, the low left-front blocks (the top at 0.48 to 0.65 of the height over u 0 to 0.2).
      { dxM: 1.6, dzM: -1.05, halfLengthM: 2.0, halfWidthM: 1.85, upM: 1.9, downM: 4.5, headingRad: -0.11, squareness: 4.2, flatness: 4.5 },
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
 * ROCKS ROUND 18: THE ROUND-17 MAIN ROCK, kept for the lead's control (`?rockShape=loaf`, the `rk18-loaf`
 * frames): the four-block loaf of rounds 2 to 17, 6.7 by 4.4 m and 2.2 m high, its blocks domed toward
 * the middle. The Kalaloch frame's rock (k2_012) is a wide low cluster: GG-418.
 */
export const ROCK_SPEC_LOAF: RockSpec = {
  xM: 0, zM: -60, halfLengthM: 3.0, halfWidthM: 2.2, headingRad: 0.18, topM: 2.2, baseM: 4.5,
  squareness: 3.2, flatness: 4.5, taper: 0.18, tiltAlong: 0.04, tiltAcross: -0.04,
  lumps: 0.07, creaseM: 0.14, seed: 101, facets: 14,
  lobes: [
    { dxM: -0.9, dzM: 0.5, halfLengthM: 2.0, halfWidthM: 1.6, upM: 2.2, downM: 4.5, headingRad: 0.25, squareness: 5, flatness: 5 },
    { dxM: 1.4, dzM: -0.2, halfLengthM: 1.7, halfWidthM: 1.4, upM: 1.6, downM: 4.5, headingRad: -0.3, squareness: 4, flatness: 4.5 },
    { dxM: 0.3, dzM: -1.0, halfLengthM: 2.6, halfWidthM: 1.3, upM: 1.0, downM: 4.5, headingRad: 0.05, squareness: 3.5, flatness: 4 },
    { dxM: -1.6, dzM: 0.1, halfLengthM: 1.9, halfWidthM: 1.3, upM: 1.3, downM: 4.5, headingRad: 0.6, squareness: 3.2, flatness: 3.6 },
  ],
};

/** Round 18: `?rockShape=loaf` draws round 17's main rock (the control); absent or `kalaloch`, the clip's. */
function rockSpecsParam(): readonly RockSpec[] {
  const v = new URLSearchParams(globalThis.location?.search ?? '').get('rockShape');
  if (v === null || v === 'kalaloch') return ROCK_SPECS;
  if (v === 'loaf') return [ROCK_SPEC_LOAF, ...ROCK_SPECS.slice(1)];
  throw new Error(`[ocean] ?rockShape=${v}: use kalaloch or loaf.`);
}

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
 * Round 5: how the plume is drawn: one ray march a pixel (oceanSplash.ts,
 * WHY A MARCH). Round 6 removed round 4's slice stack (`?plume=slices`):
 * its detail, erosion and gains were looks, and the grids it read are gone
 * (oceanSplash.ts, THE SLICE DRAW IS GONE). The parameter now fails with a
 * clear message rather than drawing a different plume.
 */
function plumeDrawParam(): 'march' {
  const v = new URLSearchParams(globalThis.location?.search ?? '').get('plume');
  if (v === null || v === 'march') return 'march';
  throw new Error(`[ocean] ?plume=${v}: only march is drawn since rocks round 6 (the slice stack was removed).`);
}

export default async function mount(ctx: OceanExtraContext): Promise<OceanExtra> {
  const rocks = createOceanRocks({
    renderer: ctx.renderer,
    scene: ctx.scene,
    camera: ctx.camera,
    field: ctx.field,
    sunDir: ctx.sky.sunDir,
    overcast: ctx.sky.uOvercast,
    // Round 18: `?rockShape=loaf` swaps in round 17's main rock (rockSpecsParam).
    specs: rockSpecsParam(),
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
    /** Round 6: the pinned start's sea at the faces, for a CPU replay of the model (oceanRocks.ts, dumpPrime). */
    dumpPrime: () => rocks.dumpPrime(),
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
    // Rocks round 14: the stone's film debug view (OceanRocks.debugRock).
    debugRock: (m: number) => rocks.debugRock(m),
    // Rocks round 18: the march's turbulence multiplier on or off (THE EDGE TEARS), for the A/B.
    turbulence: (on: boolean) => rocks.setTurbulence(on),
    // Round 19: the march's dome source (THE PLUME SEES THE DOME), for the A/B.
    dome: (on: boolean) => rocks.setDome(on),
    /** What the rocks do from t0 to t1 (see `OceanRocks.scan`); pass the pinned time as `now`. */
    scan: (t0: number, t1: number, every?: number, now?: number) => rocks.scan(t0, t1, every, now),
    tables: () => rocks.tables.map((t) => ({
      center: [t.centerX, t.centerZ], topM: t.topM, topAreaM2: t.topAreaM2,
      waterline: Array.from(t.waterlineM), rim: Array.from(t.rimM), slopeDeg: Array.from(t.slopeRad, (r) => (r * 180) / Math.PI),
    })),
    /** Round 10: turn one of the splash model's round-10 laws off or on ('breakup', 'bubbleMist'), for a cost ablation. */
    ablateLaw: (law: 'breakup' | 'bubbleMist', on: boolean) => { rocks.sim.splash.lawsOn[law] = on; },
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
        // Round 10: the sheets', strands' and drops' sprites (createOceanSplashDropDraw), for a cost ablation.
        else if (part === 'sprites' && o.name === 'oceanRockDrops') o.visible = on;
      }
    },
  };

  return {
    update: (simTime, dtS) => rocks.update(simTime, dtS),
    dispose: () => rocks.dispose(),
    probe,
  };
}

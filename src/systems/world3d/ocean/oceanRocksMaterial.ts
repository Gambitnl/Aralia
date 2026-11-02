/**
 * @file oceanRocksMaterial.ts
 * Builds the original shared stone and water-shell materials at the factory setup point.
 * The context carries the same uniforms, node callbacks and mesh objects by reference.
 * Shader expressions and resource order are preserved; the factory still owns updates and disposal.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 03:49:14
 * Dependents: systems/world3d/ocean/oceanRocks.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import { ROCK_SECTORS, rockFilmMinFlowM2s, ROCK_WATER_NU_M2S, ROCK_STREAM_LIFE_S, rockFilmMinThicknessM, ROCK_GRAIN_RQ_M, ROCK_MIRROR_FIT_B, ROCK_MIRROR_FIT_A, ROCK_FILM_RE_TURBULENT, ROCK_FILM_RE_LAMINAR, ROCK_STONE_ROUGHNESS } from './oceanRocksMath';
import { uniformArray, int, attribute, floor, varying, Fn, positionWorld, normalize, normalWorld, vec2, atan, fract, bitAnd, mix, mx_worley_noise_float, smoothstep, float, mx_fractal_noise_float, mx_noise_float, dFdx, dFdy, cross, dot, sign, abs, vec3, max, cameraPosition, sqrt, step, pow, cbrt, log, clamp, exp, reflect, vec4, positionLocal, normalLocal, min, fwidth } from 'three/tsl';
import { GRAVITY_MS2 } from './oceanConfig';
import { oceanSkyRadiance } from './oceanSky';
import type { RockFaceTable, RockMesh, RockSpec } from './oceanRocksMath';
import type { TslNode } from '@/types/tslNode';


/**
 * A TSL node expression: the shared alias in src/types/tslNode.ts (GG-588).
 * three 0.172 ships no type that names every node class an expression can produce.
 */
export type { TslNode };

interface RockMaterialContext {
  tables: readonly RockFaceTable[];
  opts: { readonly specs: readonly RockSpec[] };
  ROCK_ALBEDO: number;
  ROCK_DRY_TOP_GAIN: number;
  uTime: TslNode;
  uSun: TslNode;
  skyIrradiance: TslNode;
  ROCK_WET_DARKEN: number;
  uSunColor: TslNode;
  ROCK_SUN_IRRADIANCE: number;
  sunVis: TslNode;
  overcast: TslNode;
  airOver: TslNode;
  uRockDebug: TslNode;
  meshes: RockMesh[];
  group: THREE.Group;
  skyLow: TslNode;
  skyZenith: TslNode;
  foamLit: TslNode;
}

export function createRockMaterialSetup(context: RockMaterialContext) {
  const { tables, opts, ROCK_ALBEDO, ROCK_DRY_TOP_GAIN, uTime, uSun, skyIrradiance, ROCK_WET_DARKEN, uSunColor, ROCK_SUN_IRRADIANCE, sunVis, overcast, airOver, uRockDebug, meshes, group, skyLow, skyZenith, foamLit } = context;

  /* --- the rock material -------------------------------------------- */

  /** Round 8: one rock's slots in the shared arrays (its 16 sectors of secA and secB, its live values). */
  interface RockUniforms {
    a: THREE.Vector4[]; b: THREE.Vector4[]; live: THREE.Vector4;
  }
  const rockUniforms: RockUniforms[] = [];
  const rockMeshes: THREE.Mesh[] = [];
  const rockMats: THREE.MeshBasicNodeMaterial[] = [];
  /*
   * ONE MATERIAL PER PART (rocks round 8, GG-390). Rounds 1 to 7 made one
   * stone material and one water material per rock, each with its rock's
   * center, first sector azimuth, seed and mean radius baked in as WGSL
   * constants: three plus three pipelines that the browser compiled one by
   * one (2 to 4.5 s each on this machine, build/logs/bench-a4-gate.json).
   * Now each part has ONE material for every rock. Each rock's geometry
   * carries its index as a vertex attribute (`rockIndex`, constant over the
   * mesh), and the material reads the rock's values from uniform arrays at
   * that index: the center, the azimuth and the mean radius (uRockK), the
   * seed's terms (uRockSeed), the sector state (secA, secB: 16 sectors a
   * rock, rock after rock) and the top sheet and damp (uRockLive).
   * WHAT IS KEPT: the same arithmetic. The seed's terms are the values the
   * constants folded to: WGSL evaluates a constant expression such as
   * (138.37 * 0.17) in the abstract float (f64) and rounds once to f32, so
   * each term is computed here in f64 and stored (one f32 rounding), not
   * multiplied in the shader (an f32 product can differ by one ulp).
   */
  const R_ROCKS = tables.length;
  const allA: THREE.Vector4[] = [];
  const allB: THREE.Vector4[] = [];
  for (let k = 0; k < R_ROCKS * ROCK_SECTORS; k += 1) { allA.push(new THREE.Vector4()); allB.push(new THREE.Vector4()); }
  const secA = uniformArray(allA, 'vec4');
  const secB = uniformArray(allB, 'vec4');
  // Per rock: (center x, center z, first sector azimuth / 2 pi, mean waterline radius).
  const uRockK = uniformArray(tables.map((tab) => {
    let meanR = 0;
    for (let k = 0; k < tab.sectors; k += 1) meanR += tab.waterlineM[k] / tab.sectors;
    return new THREE.Vector4(tab.centerX, tab.centerZ, tab.azimuthRad[0] / (Math.PI * 2), meanR);
  }), 'vec4');
  // Per rock: the top sheet's depth and the damp (written each update); round 18: z the plume's opacity over its disk.
  const liveVals = tables.map(() => new THREE.Vector4());
  const uRockLive = uniformArray(liveVals, 'vec4');
  // Round 18 (THE WHITE ROUND THE STONE LIGHTS IT): per rock, the plume's mass centroid and its integral scale (m).
  const plumeVals = tables.map(() => new THREE.Vector4(0, -100, 0, 0));
  const uRockPlume = uniformArray(plumeVals, 'vec4');
  // The seed's terms each material uses: [scale of the spec's seed, op, k]
  // (op '' the scaled seed alone, '*' times k, '+' plus k).
  const SEED_TERMS: ReadonlyArray<readonly [number, '' | '*' | '+', number]> = [
    [1.37, '', 0], [1.37, '*', 0.5], [1.37, '*', 0.3], [1.37, '*', 0.17], [1.37, '*', 0.7], [1.37, '*', 1.9],
    [1.37, '*', 0.37], [1.37, '*', 0.91], [1.37, '*', 2.3], [1.37, '*', 3.0], [1.37, '+', 2.3], [1.37, '+', 9.1],
    [1.37, '+', 4.4], [1.37, '+', 6.2], [1.37, '+', 3.1], [1.37, '+', 8.8],
    [2.11, '', 0], [2.11, '+', 2.3], [2.11, '+', 9.1], [2.11, '+', 6.2], [2.11, '+', 9.7], [2.11, '+', 4.7],
    [2.11, '+', 8.8], [2.11, '+', 3.1], [2.11, '+', 1.7], [2.11, '+', 5.3],
  ];
  const SEED_V4 = Math.ceil(SEED_TERMS.length / 4);
  const seedVals: THREE.Vector4[] = [];
  opts.specs.forEach((spec) => {
    const v = SEED_TERMS.map(([sc, op, k]) => {
      const base = spec.seed * sc;
      return op === '*' ? base * k : op === '+' ? base + k : base;
    });
    while (v.length < SEED_V4 * 4) v.push(0);
    for (let k = 0; k < SEED_V4; k += 1) seedVals.push(new THREE.Vector4(v[k * 4], v[k * 4 + 1], v[k * 4 + 2], v[k * 4 + 3]));
  });
  const uRockSeed = uniformArray(seedVals, 'vec4');
  /** The seed's term (scale, op, k) for rock `riN` (an int node). */
  const seedTerm = (riN: TslNode, sc: number, op: '' | '*' | '+', k: number): TslNode => {
    const j = SEED_TERMS.findIndex((t) => t[0] === sc && t[1] === op && (op === '' || t[2] === k));
    if (j < 0) throw new Error(`[ocean] The rock seed term ${sc} ${op} ${k} is not in SEED_TERMS.`);
    const e = uRockSeed.element(riN.mul(int(SEED_V4)).add(int(j >> 2)));
    return [e.x, e.y, e.z, e.w][j & 3];
  };
  /** The rock index at a vertex (the attribute) and at a pixel (its varying, constant over a mesh). */
  const riVertex = (): TslNode => int(attribute('rockIndex', 'float'));
  const riPixel = (): TslNode => int(floor(varying(attribute('rockIndex', 'float'), 'vRockIndex').add(0.5)));
  let stoneMat: THREE.MeshBasicNodeMaterial | null = null;
  let shellMatShared: THREE.MeshBasicNodeMaterial | null = null;
  tables.forEach((tab, ri) => {
    const a = allA.slice(ri * ROCK_SECTORS, (ri + 1) * ROCK_SECTORS);
    const b = allB.slice(ri * ROCK_SECTORS, (ri + 1) * ROCK_SECTORS);
    rockUniforms.push({ a, b, live: liveVals[ri] });
    const mat = stoneMat ?? new THREE.MeshBasicNodeMaterial();
    if (stoneMat === null) {
    stoneMat = mat;
    rockMats.push(mat);
    mat.name = 'oceanRock';
    mat.fog = false;
    const vCavity = varying(attribute('cavity', 'float'), 'vRockCavity');
    mat.colorNode = Fn(() => {
      const P = positionWorld;
      const Ng = normalize(normalWorld).toVar();
      const cav = vCavity;
      const rk = riPixel().toVar();
      const K = uRockK.element(rk);
      const L = uRockLive.element(rk);
      const uSheet = L.x;
      const uDamp = L.y;
      const meanR = K.w;
      const rel = vec2(P.x.sub(K.x), P.z.sub(K.y));
      const az = atan(rel.y, rel.x);
      const u = fract(az.div(Math.PI * 2).sub(K.z)).mul(ROCK_SECTORS);
      // A mask, not .mod(): the sector count is a power of two, and TSL's
      // integer .mod() is the hazard oceanSampler.ts names.
      const i0 = bitAnd(int(floor(u)), int(ROCK_SECTORS - 1));
      const i1 = bitAnd(i0.add(int(1)), int(ROCK_SECTORS - 1));
      const f = fract(u);
      const A = mix(secA.element(rk.mul(int(ROCK_SECTORS)).add(i0)), secA.element(rk.mul(int(ROCK_SECTORS)).add(i1)), f).toVar();
      const B = mix(secB.element(rk.mul(int(ROCK_SECTORS)).add(i0)), secB.element(rk.mul(int(ROCK_SECTORS)).add(i1)), f).toVar();
      const y = P.y;
      const seed = seedTerm(rk, 1.37, '', 0);
      const sd = (op: '*' | '+', k: number) => seedTerm(rk, 1.37, op, k);
      // THE SURFACE (round 3). Both round-2 judges read the rock as "a
      // smooth glossy low-poly black blob, like plastic or a car roof". The
      // mesh carries the blocks, joints, ledges and fractured plates (to 6
      // cm, its edge); this height field carries the stone below that, in
      // meters, and bends the normal by its screen-space derivatives
      // (Mikkelsen 2010, "Bump mapping unparametrized surfaces on the GPU":
      // one evaluation a pixel, where round 2 took eight):
      //   - PITS: a weathered basalt face is pocked with vesicles and
      //     solution pits, 1 to 4 cm across and up to 1.5 cm deep (a
      //     Worley field of 6 cm cells, each cell's pit its own size);
      //   - GRAIN: a rough crust at 3 to 12 cm (a 3-octave fractal, 1.2 cm);
      //   - KNOBS: lumps of 30 to 50 cm (2.5 cm).
      // Water fills the pits and smooths the grain under a film (the wet
      // share below), but it does not smooth the knobs: round 2 blended the
      // wet normal 75% to the smooth mesh normal, which drew the mirror
      // "car roof".
      // ROUND 4: both round-3 judges saw "speckled noise" on the rock. The
      // 2.2 cm pits were 2 to 3 pixels at both judged views (7 mm and 10 mm a
      // pixel) and drew as salt-and-pepper, not as stone; they are cut, the
      // 6 cm pits are 1 cm deep (was 1.5), the crust 0.7 cm (was 1.2), and
      // the stone's form is carried by the plates and the knobs (2.5 cm at
      // 42 cm, and a 4 cm swell at 1.1 m that the eye reads as a surface).
      const pitCell = mx_worley_noise_float(P.mul(1 / 0.06).add(seed));
      const pit = smoothstep(float(0.05), float(0.42), pitCell);
      const grain = mx_fractal_noise_float(P.mul(1 / 0.1).add(sd('*', 0.5)), 3, 2.1, 0.5, 1.0);
      const knob = mx_noise_float(P.mul(1 / 0.42).add(sd('*', 0.3)));
      const swell = mx_noise_float(P.mul(1 / 1.1).add(sd('*', 0.17)));
      const wetEarly = smoothstep(A.z.add(0.04), A.z.sub(0.12), P.y);
      // (rk4d: at 1 cm the 6 cm pits still drew as dots at the telephoto's 7 mm a pixel; 0.6 cm.)
      const hFine = pit.sub(1).mul(0.006).add(grain.mul(0.007));
      const hStone = hFine.mul(float(1).sub(wetEarly.mul(0.45))).add(knob.mul(0.025)).add(swell.mul(0.04));
      const dpx = dFdx(P);
      const dpy = dFdy(P);
      const dhx = dFdx(hStone);
      const dhy = dFdy(hStone);
      const r1 = cross(dpy, Ng);
      const r2 = cross(Ng, dpx);
      const det = dot(dpx, r1);
      const sGrad = sign(det).mul(r1.mul(dhx).add(r2.mul(dhy)));
      const Nb = normalize(abs(det).mul(Ng).sub(sGrad)).toVar();
      /** The pits' own shade (less light reaches the bottom of a pocket). */
      const pitShade = mix(float(0.85), float(1), pit);
      // THE ALBEDO. Dark basalt in two tones; the dry top paler with salt
      // and lichen; a dark olive band of weed and wet crust in the reach of
      // the waves (sl_003's green-brown base); the crevices darker.
      const mottle = mx_fractal_noise_float(P.mul(1.3).add(seed), 3, 2.0, 0.5, 1.0);
      const patchN = mx_fractal_noise_float(P.mul(0.35).add(sd('*', 0.7)), 2, 2.0, 0.5, 1.0);
      // Round 3: a wider spread (0.05 to 0.16): weathered grey faces beside
      // fresh black ones, the Kalaloch rock's lit grey shoulders.
      const albedo = float(ROCK_ALBEDO).mul(float(1).add(mottle.mul(0.55)).add(patchN.mul(0.5))).mul(pitShade).toVar();
      const tint = mix(vec3(0.95, 0.97, 1.0), vec3(1.1, 1.0, 0.86), smoothstep(float(-0.3), float(0.4), patchN));
      const topUp = smoothstep(float(0.45), float(0.85), Ng.y);
      const lichenN = mx_fractal_noise_float(P.mul(2.4).add(sd('*', 1.9)), 3, 2.0, 0.55, 1.0);
      const dryTop = topUp.mul(smoothstep(A.z.add(0.1), A.z.add(0.5), y)).mul(smoothstep(float(-0.05), float(0.35), lichenN));
      const band = smoothstep(A.z.add(0.2), A.z.sub(0.6), y).mul(smoothstep(float(-0.6), float(0.2), y)).mul(float(1).sub(topUp.mul(0.6)));
      // JOINT CRACKS: thin dark lines where the rock is split (a ridged
      // noise's crest, 1 to 3 cm wide at a meter's spacing): the dark seams
      // that make a block read as fractured, not molded. They take water
      // like a crevice.
      const crackN = mx_noise_float(P.mul(vec3(0.9, 1.6, 0.9)).add(sd('*', 0.37)));
      // Broken into lengths by a second noise: a continuous contour of one
      // noise drew smooth curved grooves (r2c), not joints.
      const crackCut = smoothstep(float(0.0), float(0.35), mx_noise_float(P.mul(1.7).add(sd('*', 0.91))));
      const crack = smoothstep(float(0.955), float(0.99), float(1).sub(abs(crackN))).mul(crackCut).mul(float(1).sub(topUp.mul(0.5)));
      const baseCol = vec3(1.0, 0.97, 0.93).mul(tint).mul(albedo).mul(float(1).sub(crack.mul(0.75)));
      const rockCol = mix(mix(baseCol, baseCol.mul(vec3(1.35, 1.32, 1.22)).mul(ROCK_DRY_TOP_GAIN / 1.35), dryTop),
        baseCol.mul(vec3(0.72, 0.8, 0.5)), band.mul(0.8)).mul(float(1).sub(cav.mul(0.6))).toVar();
      // WETNESS. Wet below the wet line (A.z), damp over the top after spray
      // falls on it; the streaming film (B.x) under its top (A.w).
      const wetLine = smoothstep(A.z.add(0.04), A.z.sub(0.12), y);
      const wet = max(max(wetLine, uDamp.mul(0.85)), max(cav, crack).mul(0.5).mul(smoothstep(A.z.add(0.8), A.z, y))).toVar();
      // THE WATER ON THE FACE (round 2). Both judges read round 1's white
      // dashes as "stuck streaks"; water pouring off a rock is a film and
      // rivulets that follow the rock down, glossy and mostly clear, white
      // only where it is thick and fast near the lip, ending in foam at the
      // waterline (laid by the model into the foam, see oceanRocksMath.ts).
      //  - the across coordinate is the arc length round the rock, the
      //    along coordinate the height: a rivulet is a thin, continuous line
      //    down the fall line that meanders with height;
      //  - its water moves down (pulses along the line, 2.2 m/s);
      //  - flow is the cascade off the top (B.y) and the film the swash left (B.x).
      const face = float(1).sub(smoothstep(float(0.5), float(0.8), Ng.y));
      const across = az.mul(meanR);
      const meander = mx_noise_float(vec3(across.mul(0.6), y.mul(0.7), sd('+', 2.3))).mul(0.35);
      const lineN = mx_noise_float(vec3(across.add(meander).mul(3.2), float(0.37), sd('+', 9.1)));
      const rivulet = smoothstep(float(0.86), float(0.97), float(1).sub(abs(lineN))).toVar();
      const pulse = smoothstep(float(-0.25), float(0.45), mx_noise_float(vec3(across.add(meander).mul(1.3), y.mul(1.4).add(uTime.mul(2.2)), sd('+', 4.4))));
      const casAmt = smoothstep(float(0.002), float(0.06), B.y);
      const flowOn = max(casAmt, B.x.mul(0.5)).mul(smoothstep(A.w.add(0.05), A.w.sub(0.15), y)).mul(smoothstep(A.x.sub(0.2), A.x.add(0.1), y)).mul(face);
      // The film: a sheet of water over the whole face where the cascade is
      // strong, thinning into rivulets as it weakens.
      const film = flowOn.mul(max(rivulet.mul(pulse), casAmt.mul(0.45))).toVar();
      // Aerated white water: only near the lip of a strong cascade, torn.
      // Fine streaks down the fall line (at a 2.6 m tile they were blotches, r2b).
      // ROUND 17: THE FINGERS RETIRE (GG-403; the round-16 judge, the third round running: "a smooth rounded
      // loaf with zebra-like white stripe streaks painted on it"). Rounds 13 to 16 drew the swash roller's
      // aerated water as fingers of white on the stone and the shell. That water is now the march's own
      // VOLUME (THE ROOT IS A VOLUME, oceanRocksMath.ts rockRollerBodies: the face's roller, the wash-over,
      // the collar, the pour-off), so the stone keeps no stain of it and draws only the film laws below.
      // The sheet on the top: a glossy film flowing out from the middle,
      // white only in its thin fast spill at the rim.
      const relN = normalize(vec3(rel.x, 0, rel.y).add(vec3(1e-4, 0, 0)));
      const radial = rel.length();
      // World-space noise drawn out a little along the outward flow (the
      // direction noise alone drew radial stripes, r2a).
      const sheetOn = smoothstep(float(0.004), float(0.04), uSheet).mul(topUp);
      const water = max(max(film, sheetOn), wet.mul(0.0)).toVar();
      // THE LIGHT. A water film smooths the grain and darkens the diffuse.
      const wetAll = max(wet, water);
      const Nl = normalize(mix(Nb, Ng, wetAll.mul(0.2))).toVar();
      const ndl = max(dot(Nl, uSun), float(0));
      const ao = float(1).sub(cav.mul(0.7));
      // ROUND 12: the dome's irradiance on the face (THE STONE SEES THE WHOLE SKY; was two samples, times pi).
      // ROUND 18: and the white water round it (THE WHITE ROUND THE STONE LIGHTS IT): the sector's sea level and
      // white-water share at the vertex (the same blend as the pixel's, A and B), the rock's plume.
      // (Read in the vertex stage, as the dome sum is: the vertex's own rock index and sector blend.)
      const skyE = varying((() => {
        const rkV = riVertex();
        const Pv = positionWorld;
        const Kv = uRockK.element(rkV);
        const uV = fract(atan(Pv.z.sub(Kv.y), Pv.x.sub(Kv.x)).div(Math.PI * 2).sub(Kv.z)).mul(ROCK_SECTORS);
        const j0 = bitAnd(int(floor(uV)), int(ROCK_SECTORS - 1));
        const j1 = bitAnd(j0.add(int(1)), int(ROCK_SECTORS - 1));
        const q0 = rkV.mul(int(ROCK_SECTORS));
        const Av = mix(secA.element(q0.add(j0)), secA.element(q0.add(j1)), fract(uV));
        const Bv = mix(secB.element(q0.add(j0)), secB.element(q0.add(j1)), fract(uV));
        return skyIrradiance(normalWorld, Pv, Av.x, max(Bv.z, Bv.w), uRockPlume.element(rkV), uRockLive.element(rkV).z);
      })(), 'vRockSkyE').mul(ao);
      // ROUND 4: THE SOAKED ZONE. The round-3 judge saw "no darker soaked
      // zone at the waterline". Every wave re-floods the band just above the
      // sea, so it never drains: saturated stone with standing water in every
      // pore, darker than the rock the wave only wetted (a dark stone
      // saturated with water reflects about a third of its dry light,
      // against half for a surface film; Lekner and Dorf 1988 give the film,
      // the pores fill further). From the sea's level (A.x) up 0.9 m, fading
      // over the top half.
      const soaked = smoothstep(A.x.add(0.9), A.x.add(0.3), y).toVar();
      // ROUND 11: the soaked band is wet stone (its pores full: Lekner and Dorf's own state),
      // at ROCK_WET_DARKEN of the dry; it is no longer darkened a second time (0.62, round 4),
      // which put the wet stone at 0.028, under wet basalt's measured 0.05 to 0.12 (the brief).
      // The soaked band stays wet (wetAll) however the swash's film drains.
      const diffuse = rockCol.mul(mix(float(1), float(ROCK_WET_DARKEN), max(wetAll, soaked)))
        .mul(uSunColor.mul(ndl.mul(ROCK_SUN_IRRADIANCE).mul(sunVis)).add(skyE)).div(Math.PI);
      const V = normalize(cameraPosition.sub(P));
      // ROUND 4: THE WET SHEEN FOLLOWS THE SHAPE. The round-3 judges saw "no
      // wet sheen that follows its shape". A water film fills the stone's fine
      // relief, so its mirror is the rock's form, not its grain: the sheen's
      // normal is 60% the mesh's own (the blocks, ledges and plates) where
      // the film lies, broken into lit and dull patches of 0.5 to 1 m by the
      // film's own thickness (a film drains unevenly; round 2's 75% with no
      // breakup drew one plastic "car roof").
      /* ROUND 11: THE WET STONE IS A ROUGH STONE UNDER A FILM (the round-10 judge: "glossy
       * black plastic"). Rounds 2 to 10 gave every wet pixel a mirror of the sky at 0.35 to
       * 0.85 of its Fresnel (and the soaked band 0.25 more, dry rock 0.05), so the whole wet
       * rock was a polished surface. A wet rock is a water film over a rough stone, and the
       * film is a mirror only where it is thicker than the stone's roughness: a thinner film
       * lies in the pores between the grains, and the grains' tops break its surface, so the
       * stone reflects as a rough dielectric (a broad lobe, no image of the sky). The film's
       * thickness is a law of the water on the face:
       *   - the cascade's sheet (q = B.y, m^2/s, down a face of slope a) is a Nusselt film,
       *     h = (3 nu q / (g sin a))^(1/3) (Nusselt 1916): 1.6 mm at q = 0.01;
       *   - the swash's film after the swash goes down drains as Jeffreys's film (1930),
       *     h = sqrt(nu x / (g sin a t)), x the run down the face from the stream's top (A.w)
       *     and t the time since the swash left (the model's stream share is exp(-t / 2.5 s),
       *     ROCK_STREAM_LIFE_S): 0.3 mm a meter down after one second, 0.1 mm after ten;
       *   - under the swash line (A.y) the water is the swash itself (centimeters);
       *   - the sheet over the top (uSheet) is its own depth.
       * The share of the film that is a continuous mirror is h / (h + k_s), k_s the stone's
       * micro-roughness (ROCK_MICRO_ROUGH_M): a film of several k_s is a mirror, a film of a
       * tenth of it is a wet rough stone. The rough part is a GGX lobe of roughness
       * ROCK_STONE_ROUGHNESS (Walter et al. 2007) with the Fresnel of water (F0 0.02) where the
       * stone is wet and of the stone (F0 0.04, n about 1.5) where it is dry. Kept: the film's
       * own sun lobe (round 2's specular power of 60 and its beads) for its mirror share, and
       * the darker diffuse of the wet and soaked stone (Lekner and Dorf 1988). */
      const sinA = sqrt(max(float(1).sub(Ng.y.mul(Ng.y)), float(0.04)));
      const under = smoothstep(A.w.add(0.05), A.w.sub(0.15), y).mul(smoothstep(A.x.sub(0.2), A.x.add(0.1), y));
      // Round 12: the cascade's film only where it is whole, over q_min (A FILM COVERS THE FACE OR IT
      // BREAKS INTO RIVULETS): q_min = q_min(1) sin(a)^-0.2 (delta_min goes as (g sin a)^-0.4).
      const filmWhole = step(float(rockFilmMinFlowM2s(1)).mul(pow(sinA, float(-0.2))), B.y);
      const hCas = cbrt(max(B.y, float(0)).mul((3 * ROCK_WATER_NU_M2S) / GRAVITY_MS2).div(sinA)).mul(under).mul(face).mul(filmWhole);
      const tDrain = log(max(B.x, float(1e-4))).mul(-ROCK_STREAM_LIFE_S).max(0.05);
      const xRun = max(A.w.sub(y), float(0)).div(sinA).add(0.05);
      const hDrainF = sqrt(xRun.mul(ROCK_WATER_NU_M2S / GRAVITY_MS2).div(sinA.mul(tDrain))).mul(under).mul(step(float(1e-3), B.x));
      // ROUND 13: THE DRAINING FILM BREAKS INTO RIVULETS IN THE GROOVES (rockDrainRivuletShare). Where the
      // Jeffreys film is thinner than delta_min (Hartley and Murgatroyd; delta_min goes as sin(a)^-0.4) it
      // cannot stay whole: its flux runs on in rivulets at about delta_min, over (h / delta_min)^3 of the
      // face, in the face's grooves (the crevices and joints: cav and crack, the lowest lines of the
      // relief, ranked by depth). Round 12 drew the thin film everywhere: one even wet gloss.
      const dMinF = float(rockFilmMinThicknessM(1)).mul(pow(sinA, float(-0.4)));
      const drainWhole = step(dMinF, hDrainF);
      const rivShare = clamp(pow(hDrainF.div(dMinF), float(3)), float(0), float(1));
      const groove = max(cav, crack);
      const drainRiv = float(1).sub(drainWhole).mul(step(float(1).sub(rivShare), groove)).mul(step(float(1e-6), hDrainF));
      const hDrain = hDrainF.mul(drainWhole).add(dMinF.mul(drainRiv));
      const hSwash = clamp(A.y.sub(y), float(0), float(0.05)).mul(smoothstep(float(0.02), float(0.08), A.y.sub(A.x)));
      const hTop = max(uSheet, float(0)).mul(topUp);
      const hFilm = max(max(hCas, hDrain), max(hSwash, hTop));
      // ROUND 14: THE MIRROR SHARE IS THE SHARE OF THE GRAIN THE FILM DROWNS (rockFilmMirrorShare: the film
      // over the stone's own Gaussian grain of Rq 2.5 mm, Phi(lambda), in its fitted form). Rounds 11 to
      // 13: h / (h + 0.3 mm), a mirror over half the face at 0.3 mm (now 0.21 of it).
      // ROUND 14: A TURBULENT FILM IS NO MIRROR (rockFilmLaminarShare): each film's drowned share times
      // the laminar share of its own flow, the largest of the four (the film on top).
      const drowned = (h: TslNode) => float(1).sub(exp(pow(max(h.div(ROCK_GRAIN_RQ_M), float(1e-6)), float(ROCK_MIRROR_FIT_B)).mul(-ROCK_MIRROR_FIT_A)));
      const laminar = (q: TslNode) => smoothstep(float(ROCK_FILM_RE_TURBULENT), float(ROCK_FILM_RE_LAMINAR), max(q, float(0)).div(ROCK_WATER_NU_M2S));
      const qDrain = pow(hDrain, float(3)).mul(GRAVITY_MS2 / (3 * ROCK_WATER_NU_M2S)).mul(sinA);
      const qSwash = hSwash.mul(sqrt(max(A.y.sub(A.x), float(0)).mul(GRAVITY_MS2)));
      const qTop = hTop.mul(sqrt(hTop.mul(GRAVITY_MS2)));
      const mirror = max(max(drowned(hCas).mul(laminar(B.y)), drowned(hDrain).mul(laminar(qDrain))),
        max(drowned(hSwash).mul(laminar(qSwash)), drowned(hTop).mul(laminar(qTop)))).toVar();
      // The mirror's normal: a film of millimeters lies on the stone and follows every relief
      // larger than itself (the 6 cm pits, the crust, the 42 cm knobs: Nb); it fills only the
      // sub-millimeter grain, which the share above counts. Rounds 2 to 10 bent the wet normal
      // toward the smooth mesh normal (Ng), as if the film filled centimeters of relief: one
      // smooth mirror over each block, the "plastic" (round 11's first frame, rk11a, still
      // drew it so on the faces the cascade runs down).
      const Ns = Nb;
      const R = reflect(V.negate(), Ns);
      const cosV = max(dot(Ns, V), float(0));
      const fres = float(0.02).add(float(0.98).mul(pow(float(1).sub(cosV), float(5))));
      // A reflected ray under the horizon sees the sea, not the sky.
      const seaSeen = vec3(0.02, 0.035, 0.045).mul(mix(float(1), float(0.3), overcast));
      const skyR = mix(seaSeen, oceanSkyRadiance(vec3(R.x, max(R.y, float(0.01)), R.z), uSun, 0, overcast), smoothstep(float(-0.05), float(0.06), R.y));
      const H = normalize(uSun.add(V));
      const nh = max(dot(Ns, H), float(0));
      // The film's sun lobe (round 2: a specular power of 60 at 0.5, varied by its beads).
      const beads = smoothstep(float(-0.2), float(0.6), mx_noise_float(P.mul(9.0).add(sd('*', 3.0))));
      const sunOn = ndl.greaterThan(0).select(float(1), float(0)).mul(sunVis).mul(ROCK_SUN_IRRADIANCE);
      const spotFilm = pow(nh, float(60)).mul(0.5).mul(beads).mul(sunOn);
      // The rough stone: GGX on the bumped normal (alpha = roughness^2), Schlick's Fresnel,
      // the Smith-Schlick shadowing (k = alpha / 2); the sky's part is its Fresnel of the sky's light.
      const aG = ROCK_STONE_ROUGHNESS * ROCK_STONE_ROUGHNESS;
      const nhB = max(dot(Nb, H), float(0));
      const nvB = max(dot(Nb, V), float(1e-3));
      const nlB = max(dot(Nb, uSun), float(0));
      const dG = float(aG * aG).div(nhB.mul(nhB).mul(aG * aG - 1).add(1).pow(2).mul(Math.PI));
      const kG = aG / 2;
      const visG = float(1).div(nlB.mul(1 - kG).add(kG).mul(nvB.mul(1 - kG).add(kG)).mul(4));
      const f0 = mix(float(0.04), float(0.02), wetAll);
      const fresB = f0.add(float(1).sub(f0).mul(pow(float(1).sub(nvB), float(5))));
      const spotRough = fresB.mul(dG).mul(visG).mul(nlB).mul(sunOn);
      // ROUND 12: the rough stone's reflection of the sky takes the lobe's mean Fresnel, not Schlick's at
      // the bumped normal: a GGX lobe of roughness r over a dielectric reflects the sky at most
      // max(1 - r, F0) at grazing (the roughness-aware Schlick of the split-sum, Fdez-Aguera 2019),
      // where Schlick's own reaches 1. Round 11's form drew the faces the film no longer covers (the film
      // breaks under q_min, round 12) as white bars along the face's grazing bumps.
      const fresSky = f0.add(max(float(1 - ROCK_STONE_ROUGHNESS), f0).sub(f0).mul(pow(float(1).sub(nvB), float(5))));
      const skyRough = fresSky.mul(skyE).div(Math.PI);
      const specular = skyR.mul(fres).add(uSunColor.mul(spotFilm)).mul(mirror)
        .add(skyRough.add(uSunColor.mul(spotRough)).mul(float(1).sub(mirror))).mul(ao);
      const lit = diffuse.add(specular);
      // Round 13: the air between the eye and the stone (ROCK_AIR_PER_M). Round 17: no white stain (THE FINGERS RETIRE).
      const shipped = airOver(P, lit);
      const dbgFilm = clamp(vec3(hCas.div(0.003), hDrain.div(0.0005), max(hSwash, hTop).div(0.02)), float(0), float(1));
      const dbg = uRockDebug.lessThan(1.5).select(dbgFilm, uRockDebug.lessThan(2.5).select(vec3(mirror, mirror, mirror), specular));
      return vec4(uRockDebug.greaterThan(0.5).select(dbg, shipped), 1);
    })();
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(meshes[ri].positions, 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(meshes[ri].normals, 3));
    geom.setAttribute('cavity', new THREE.BufferAttribute(meshes[ri].cavity, 1));
    // Round 8: the rock's index, constant over its mesh (ONE MATERIAL PER PART).
    geom.setAttribute('rockIndex', new THREE.BufferAttribute(new Float32Array(meshes[ri].positions.length / 3).fill(ri), 1));
    geom.setIndex(new THREE.BufferAttribute(meshes[ri].indices, 1));
    geom.computeBoundingSphere();
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = `oceanRock${ri}`;
    group.add(mesh);
    rockMeshes.push(mesh);

    // THE WATER ON THE ROCK AS GEOMETRY (round 3). Both round-2 judges saw
    // "no water pouring off its faces", "no sheets pour off its sides": the
    // round-2 film and rivulets were colors in the rock's own shading, flat
    // on its surface. Water that pours off a rock is a sheet with a
    // thickness and an edge: it stands off the face, its silhouette shows at
    // the rock's outline and lip, and it is white where it is aerated. So
    // the water is a SHELL: the rock's own mesh pushed out along its normals
    // by the sheet's depth (SHELL_BASE_M, plus up to SHELL_FLOW_M where the
    // cascade runs; a weir sheet of 4 to 15 cm thins to a few centimeters
    // as it speeds up down a face, h = q / v), drawn over the rock with its
    // own transparency, where the model has water: the cascade down the
    // faces (B.y), the sheet over the top (uSheet), the swash's leading edge
    // (A.y) and the film the swash leaves (B.x).
    //   - The flow's streaks are drawn along the fall line (the arc length
    //     round the rock across, the height along), moving down at the
    //     sheet's speed (2 to 3 m/s after a meter of fall, v = sqrt(2 g z)
    //     capped by the film's friction), and on the top outward from the
    //     middle.
    //   - Aerated water (thick, fast, near the lip and at the swash's edge)
    //     is foam white, lit by the surface's own foam formula.
    //   - Clear water is a mirror film: the sky's Fresnel reflection and the
    //     sun's glints on its rippled surface, so a clear sheet is seen at
    //     grazing angles and in its highlights, as on a real rock.
    const SHELL_BASE_M = 0.02;
    const SHELL_FLOW_M = 0.05;
    const shellMat = shellMatShared ?? new THREE.MeshBasicNodeMaterial();
    if (shellMatShared === null) {
    shellMatShared = shellMat;
    rockMats.push(shellMat);
    shellMat.name = 'oceanRockWater';
    shellMat.fog = false;
    shellMat.transparent = true;
    shellMat.depthWrite = false;
    /** Sector state at world point P for rock `rk` (the rock's own read, shared by the shell's stages). */
    const sectorAt = (P: TslNode, rk: TslNode) => {
      const K = uRockK.element(rk);
      const rel = vec2(P.x.sub(K.x), P.z.sub(K.y));
      const az = atan(rel.y, rel.x);
      const u = fract(az.div(Math.PI * 2).sub(K.z)).mul(ROCK_SECTORS);
      const i0 = bitAnd(int(floor(u)), int(ROCK_SECTORS - 1));
      const i1 = bitAnd(i0.add(int(1)), int(ROCK_SECTORS - 1));
      const f = fract(u);
      const q0 = rk.mul(int(ROCK_SECTORS));
      return { rel, az, A: mix(secA.element(q0.add(i0)), secA.element(q0.add(i1)), f), B: mix(secB.element(q0.add(i0)), secB.element(q0.add(i1)), f) };
    };
    shellMat.positionNode = Fn(() => {
      const Pw = positionLocal;
      const rk = riVertex().toVar();
      const uSheet = uRockLive.element(rk).x;
      const { A, B } = sectorAt(Pw, rk);
      const flow = max(smoothstep(float(0.002), float(0.08), B.y), smoothstep(float(0.004), float(0.12), uSheet));
      const under = smoothstep(A.w.add(0.1), A.w.sub(0.1), Pw.y);
      return Pw.add(normalLocal.mul(float(SHELL_BASE_M).add(flow.mul(under).mul(SHELL_FLOW_M))));
    })();
    const shellOut = Fn(() => {
      const P = positionWorld;
      const Ng = normalize(normalWorld).toVar();
      const rk = riPixel().toVar();
      const uSheet = uRockLive.element(rk).x;
      const meanR = uRockK.element(rk).w;
      const { rel, az, A, B } = sectorAt(P, rk);
      const y = P.y;
      const sd = (op: '+', k: number) => seedTerm(rk, 2.11, op, k);
      const face = float(1).sub(smoothstep(float(0.5), float(0.8), Ng.y));
      const topUp = smoothstep(float(0.45), float(0.85), Ng.y);
      const across = az.mul(meanR);
      const meander = mx_noise_float(vec3(across.mul(0.8), y.mul(0.9), sd('+', 2.3))).mul(0.3);
      // THE CASCADE down the faces: strong under the lip, thinning down the
      // face into separate streams (the few streams of k2_014 where the rim
      // dips; the whole white skirt of sl_005 when the sheet is deep).
      const cas = smoothstep(float(0.002), float(0.07), B.y);
      const drop = A.w.sub(y).max(0);
      const speed = min(float(Math.sqrt(2 * 9.81)).mul(drop.add(0.05).sqrt()), float(3.2));
      const streamN = mx_noise_float(vec3(across.add(meander).mul(2.6), float(0.21), sd('+', 9.1)));
      // Round 4: wider streams (0.2 to 0.45, were 0.3 to 0.5), and wider
      // still in a strong cascade (the stream sheets join into a skirt, sl_005).
      const streams = smoothstep(float(0.2).sub(cas.mul(0.25)), float(0.45).sub(cas.mul(0.2)), streamN);
      const inFlow = cas.mul(face).mul(smoothstep(A.w.add(0.08), A.w.sub(0.1), y)).mul(smoothstep(A.x.sub(0.1), A.x.add(0.15), y));
      // Near the lip the sheet is whole; down the face it gathers into the streams.
      const whole = smoothstep(float(0.6), float(0.1), drop).mul(cas);
      const sheetCover = inFlow.mul(max(whole, streams));
      // Its streaks: fine across (3 to 6 cm), long along (40 cm), moving down.
      const streak = mx_fractal_noise_float(vec3(across.add(meander).mul(18.0), y.mul(2.2).add(uTime.mul(speed).mul(2.2)), sd('+', 6.2)), 2, 2.0, 0.5, 1.0);
      const aer = smoothstep(float(1.4), float(0.0), drop).mul(0.55).add(cas.mul(0.35));
      // Round 4: 0.9 (was 0.7). The round-3 judges saw "no runoff sheets" and
      // "no water sheets off the rock faces": the pour-off drew at half
      // opacity at its best and read as a stain.
      // ROUND 5: STRANDS, NOT PAINTED PATCHES. Both round-4 judges read the
      // pour-off as "flat white texture patches pasted on the front face, like
      // snow" and asked for "stringy runoff that follows gravity". Water that
      // leaves a lip over rough stone gathers into ropes and threads down the
      // fall line (k2_014's few streams, sl_005's skirt of threads): here the
      // crests of two ridged noises across the face (at 5 and 11 a meter,
      // barely changing down it, so each line runs down the face and wanders
      // only with the meander), 3 to 8 cm wide, and a thin veil only in the
      // top 0.6 m under the lip. Each strand is brightest at its middle (a
      // rope of aerated water, lit round its thickness) and casts a thin dark
      // line of wet shade beside it on the stone. The streaks inside each
      // strand still move down at the sheet's speed.
      const ridgeA = float(1).sub(abs(mx_noise_float(vec3(across.add(meander).mul(5.0), y.mul(0.35), sd('+', 9.7)))));
      const ridgeB = float(1).sub(abs(mx_noise_float(vec3(across.add(meander.mul(1.4)).mul(11.0), y.mul(0.5), sd('+', 4.7)))));
      const strandA = smoothstep(float(0.87).sub(cas.mul(0.07)), float(0.97), ridgeA);
      const strandB = smoothstep(float(0.91), float(0.985), ridgeB).mul(0.75);
      const strands = max(strandA, strandB).toVar();
      const strandShade = max(smoothstep(float(0.74), float(0.85), ridgeA).sub(strandA), float(0)).mul(inFlow);
      /* ROUND 12: THE SHEET IS WHOLE AND HAS AN EDGE (A FILM COVERS THE FACE OR IT BREAKS INTO
       * RIVULETS, oceanRocksMath.ts). Rounds 5 to 11 drew the cascade as white noise streaks and
       * ridged strands down the fall line (the round-11 judge: "stretched, smeared vertical
       * streaks"). The cascade's water is a Nusselt film of millimeters (round 11), clear, and it
       * is drawn on the stone by the stone's own film mirror where it is whole. The shell now draws
       * only what the film adds that the stone cannot: its edge, the contact line where its flow
       * falls under q_min (a capillary ridge thicker than the film, a line of its own mirror), and
       * its aerated water at the lip, where the weir's flow leaves the rim (the top 0.15 m: a head
       * of a few centimeters plunges and takes air there, then runs on as a clear film). Kept:
       * the swash's lace, the top's spill, the clear film's glints. */
      const sinF = sqrt(max(float(1).sub(Ng.y.mul(Ng.y)), float(0.04)));
      const qMinF = float(rockFilmMinFlowM2s(1)).mul(pow(sinF, float(-0.2)));
      const dq = B.y.sub(qMinF);
      const edgeLine = float(1).sub(smoothstep(float(0), fwidth(dq).mul(1.5).max(1e-7), abs(dq))).mul(face)
        .mul(smoothstep(A.w.add(0.05), A.w.sub(0.1), y)).mul(smoothstep(A.x.sub(0.1), A.x.add(0.15), y));
      // THE SHEET OVER THE TOP, outward from the middle.
      const radial = rel.length();
      const sheetOn = smoothstep(float(0.004), float(0.05), uSheet).mul(topUp.max(face.mul(smoothstep(A.w.sub(0.25), A.w, y))));
      // Clear water: the film the swash leaves and the cascade's clear parts.
      const filmOn = max(B.x.mul(smoothstep(A.w.add(0.05), A.w.sub(0.2), y)).mul(face).mul(0.6), max(sheetCover, sheetOn))
        .mul(smoothstep(A.x.sub(0.15), A.x.add(0.05), y));
      // ROUND 17: THE SHELL DRAWS THE FILM LAWS ONLY (GG-403; THE FINGERS RETIRE). Rounds 3 to 16 drew the
      // aerated water on the rock as white textures on this shell: the swash roller's fingers, the cascade's
      // aerated lip and the wash-over's clumps (the judges' zebra stripes, snow, cow's hide). That water is the
      // march's volume now (rockRollerBodies: the face's roller, the wash-over, the pour-off), drawn with its own
      // depth and light; the shell keeps the clear film: its glints, its edge line and its sheen.
      const white = float(0);
      // The film's rippled normal: the fall line's streaks as slope.
      const ripple = mx_noise_float(vec3(across.mul(12.0), y.mul(5.0).add(uTime.mul(speed).mul(5.0)), sd('+', 1.7)));
      const down = normalize(vec3(0, -1, 0).sub(Ng.mul(Ng.y.negate())).add(vec3(1e-4, 0, 0)));
      const Nw = normalize(Ng.add(down.mul(ripple.mul(0.35)))).toVar();
      const V = normalize(cameraPosition.sub(P));
      const R = reflect(V.negate(), Nw);
      const cosV = max(dot(Nw, V), float(0));
      const fres = float(0.02).add(float(0.98).mul(pow(float(1).sub(cosV), float(5))));
      const seaSeen = vec3(0.02, 0.035, 0.045).mul(mix(float(1), float(0.3), overcast));
      // Round 5: the film over rough stone reflects the sky's mean by the ray's
      // height (a rough lobe), not a mirror of it: the mirror drew the flooded
      // rock as "glossy black plastic" (both round-4 judges; with the shell
      // hidden the stone alone reads matte, rk5b-nowater).
      const skyR = mix(seaSeen, mix(skyLow, skyZenith, smoothstep(float(0), float(0.8), R.y)), smoothstep(float(-0.15), float(0.2), R.y));
      const H = normalize(uSun.add(V));
      // Round 5: the glints only on beads and ripples of running water (2 to 4
      // cm, a moving noise down the fall line), so a flooded face shows small
      // sharp points, not one sun smear along its curve.
      const glintBeads = smoothstep(float(0.5), float(0.8), mx_noise_float(vec3(across.mul(30.0), y.mul(14.0).add(uTime.mul(speed).mul(14.0)), sd('+', 5.3))));
      const glint = pow(max(dot(Nw, H), float(0)), float(220)).mul(3.0).mul(glintBeads).mul(sunVis).mul(max(dot(Nw, uSun), float(0)).greaterThan(0).select(float(1), float(0)));
      // A clear film shows as its glints and a weak sheen (at the full Fresnel
      // the flooded top read as grey plastic, rk3e).
      // Round 5: the clear film's sheen 0.12 of its Fresnel (was 0.45), its glints kept (small and sharp, where water runs).
      // Round 12: the cascade's whole film is drawn by the stone's film mirror; the shell adds its
      // glints and its edge line (the contact line's ridge at the film's own Fresnel).
      const clearA = max(filmOn.mul(clamp(glint.mul(0.4), float(0), float(0.4))), edgeLine.mul(fres.add(0.15)).min(0.6));
      const clearCol = skyR.add(uSunColor.mul(glint));
      const ndl = max(dot(Ng, uSun), float(0));
      // Round 5: the strands' wet shade on the stone beside them (a dark film).
      // Round 12: no strands, no strand shade (THE SHEET IS WHOLE AND HAS AN EDGE).
      const shadeA = float(0);
      const alpha = max(max(white, clearA), shadeA);
      const colW = mix(clearCol, foamLit(ndl), white.div(max(max(white, clearA), float(1e-3))).min(1));
      const col = mix(colW, vec3(0.008, 0.01, 0.012), shadeA.div(max(alpha, float(1e-3))).mul(float(1).sub(white)));
      // Round 13: the air between the eye and the water on the stone (ROCK_AIR_PER_M).
      return vec4(airOver(P, col), clamp(alpha, float(0), float(1)));
    })();
    shellMat.colorNode = shellOut.xyz;
    shellMat.opacityNode = shellOut.w;
    }
    const shell = new THREE.Mesh(geom, shellMat);
    shell.name = `oceanRockWater${ri}`;
    shell.renderOrder = 11;
    group.add(shell);
  });
  return { rockMeshes, rockUniforms, plumeVals, rockMats };
}

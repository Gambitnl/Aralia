/**
 * @file substanceGroundMaterial.ts — the material that makes a cut face read as
 * the substance it cut, shared by every surface that draws a voxel volume.
 *
 * This shader was built and judged over nine critic rounds on the volume-ground
 * sandbox (`?step=volume`), where it lived inside the page that grew it. The
 * live world now draws the same voxels, and a second copy of nine rounds of
 * tuning is not a thing anyone can keep in step — the first divergence would be
 * a bug nobody could see, because both pictures would look plausible.
 *
 * So the material moved here, verbatim. Its history, its measurements and the
 * reasoning behind every constant are preserved in the comments below, because
 * each one of them records a fault that was found by looking.
 *
 * WHAT IT NEEDS FROM A GEOMETRY
 *
 * - `aCutDepth`, per vertex: depth below the ORIGINAL ground surface, meters.
 * - `aAO`, per vertex: baked occupancy ambient occlusion, 0 buried to 1 open.
 *
 * Both come out of `surfaceNets.meshCellRange`. Without them every face draws
 * at depth zero in one flat tone, which is the "no inside" fault the whole
 * campaign exists to remove.
 *
 * WHAT IT NEEDS IN `userData`, before first compile:
 *
 * - `shiftM`: scene-to-world offset, so world-locked noise stays world-locked.
 * - `cellM`, `originM`: the voxel grid, so the fragment stage can snap to CELLS.
 */
import * as THREE from 'three';
import {
  substance,
  cutGrainFor,
  cutAuxFor,
  DEFAULT_STACK,
  type GroundBand,
} from '@/systems/worldforge/terrain/materials';
/* --------------------------------------------------- substance-true ground */

/** The shader's fixed band capacity. The stack pads up to it. */
export const MAX_BANDS = 6;

/**
 * Wrap the scene-to-world shift into a hash-safe range.
 *
 * The noise hashes world coordinates in float32. Cell 785 sits tens of
 * kilometers from the world origin, and at x ~ 30,000 m a speckle frequency
 * of 27 cycles per meter asks fract() about the 6th significant digit —
 * beyond float32. The result was not subtle: the surface stamped one
 * identical anchor-shaped glyph everywhere the precision collapsed.
 *
 * Wrapping the SHIFT (constant per world) keeps every in-shader coordinate
 * small while staying continuous across the patch and deterministic per
 * world. The pattern would only seam at the 1024 m wrap boundary, and a
 * patch is at most 240 m and never straddles it.
 */
export function wrapShift(s: readonly [number, number, number]): [number, number, number] {
  const wrap = (v: number) => ((v % 1024) + 1024) % 1024;
  return [wrap(s[0]), wrap(s[1]), wrap(s[2])];
}

/**
 * A 3×3 rotation as a GLSL mat3 literal, from Euler angles.
 *
 * The octave-noise fix below needs each octave sampled in its OWN rotated
 * frame. Value noise on an axis-aligned integer lattice has a visible grid
 * anisotropy, and when every octave shares the frame those artifacts line up
 * into legible motifs — the round-two critique named hexagon outlines and
 * "macaroni" loops tiling the topsoil. Rotating each octave by its own
 * irrational-angle frame decorrelates the lattices; nothing can line up.
 */
function rotMat3(ax: number, ay: number, az: number): string {
  const e = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(ax, ay, az)).elements;
  const v = [e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]];
  return `mat3(${v.map((x) => x.toFixed(6)).join(', ')})`;
}

/**
 * The ground material that makes a cut face READ as the substance it cut.
 *
 * ROUND THREE'S ONE BIG CHANGE: exposed faces sample their material PER VOXEL
 * CELL, not per fragment of smooth noise. Round two had the right data — true
 * depth per vertex against the original-ground datum — but the fragment stage
 * fed that depth into continuous world-space noise, so every cut face rendered
 * as one smooth-shaded material with soft stains. Teardown's pixels change
 * material voxel by voxel; the crater-rim overhang ledges (the one place our
 * ground read stratified) work precisely because their geometry steps per
 * cell. This makes the ALBEDO step per cell everywhere:
 *
 * - The fragment snaps to the voxel cell BEHIND the face it is drawing
 *   (`floor((wp - gridOrigin)/cellM - normal * 0.5)`) and everything material
 *   is decided from that cell id and its center point: one flat color per
 *   voxel face, ± value jitter, NO cross-cell interpolation.
 * - The strata band is chosen with a HARD step at the cell's own depth, and
 *   the depth carries a per-cell jitter — so layer seams crumble cell by cell
 *   instead of running as a machined sawtooth.
 * - Features are cell-discrete: root strands wander across topsoil cells,
 *   stones are 1–3-cell hard-edged blobs in subsoil, bedrock beds are bands
 *   of whole cells with occasional dark parting seams.
 * - The weathered TOP surface keeps continuous noise (grass is not voxels)
 *   but each octave now lives in its own rotated frame — see rotMat3.
 * - Cut darkening, baked occupancy-AO, and the distance-invariant edge
 *   detector carry over from round two unchanged.
 *
 * All of it is GPU work on baked attributes. No per-frame CPU, no textures.
 */
/**
 * Gap 6 (two rounds open): strength of the per-cell facet snap on cut faces,
 * 0..1. Zero disables it — this constant is the flag the round-8 brief asked
 * for. Shading only: no vertex moves, so the sliver/seam protections cannot
 * regress. See the normal_fragment_begin injection for the mechanism.
 */
export const CUT_FACET_SNAP = 0.5;

/**
 * Where a face stops being weathered ground and starts being a CUT, in cells.
 *
 * The threshold clears the datum quantization — original-top heights are
 * cell-quantized, so open-ground vertices can read a fraction of a cell of
 * false depth. Exported because it is not only a shader constant: anything that
 * wants to DRAW this material as a cut (the `?step=volume` land-type swatches)
 * has to know how deep a face must be before the cut treatment is fully on, and
 * a second copy of the number would drift the first time this one is tuned.
 */
export const CUT_ENGAGE_START_CELLS = 0.34;

/** How far below that start the cut treatment reaches full strength, meters. */
export const CUT_ENGAGE_RAMP_M = 0.3;

/** The depth at which a face of this material draws as a full cut, meters. */
export function cutEngagedDepthM(cellM: number): number {
  return cellM * CUT_ENGAGE_START_CELLS + CUT_ENGAGE_RAMP_M;
}

/**
 * @param stack Which ground column the bands are read from.
 *
 * The stack was `DEFAULT_STACK` and nothing else for nine critic rounds, and
 * IMPL-1's first open call is what that costs: a bubble of forest litter let
 * into a pale snow-and-sand mountainside, geometrically seamless and tonally a
 * hard edge. The registry has carried a per-biome table (`BIOME_GROUND`) the
 * whole time; this parameter is the wire between them. `DEFAULT_STACK` remains
 * the default, so every existing caller is unchanged.
 */
export function makeSubstanceGroundMaterial(
  stack: readonly GroundBand[] = DEFAULT_STACK,
): THREE.MeshStandardMaterial {
  const depths = new Array<number>(MAX_BANDS).fill(1e9);
  const colors: THREE.Vector3[] = [];
  const grains: THREE.Vector3[] = [];
  const auxes: THREE.Vector3[] = [];
  for (let i = 0; i < MAX_BANDS; i++) {
    const band = stack[Math.min(i, stack.length - 1)];
    const s = substance(band.substance);
    const g = cutGrainFor(s);
    const a = cutAuxFor(s);
    if (i < stack.length) {
      depths[i] = Number.isFinite(band.depthM) ? band.depthM : 1e9;
    }
    colors.push(new THREE.Vector3(s.rgb[0], s.rgb[1], s.rgb[2]));
    grains.push(new THREE.Vector3(g.freqPerM, g.amp, g.speckle));
    auxes.push(new THREE.Vector3(a.rootiness, a.banding, 0));
  }

  const m = new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uShift = {
      value: new THREE.Vector3().fromArray(
        wrapShift((m.userData.shiftM as [number, number, number] | undefined) ?? [0, 0, 0]),
      ),
    };
    shader.uniforms.uBandDepth = { value: depths };
    shader.uniforms.uBandColor = { value: colors };
    shader.uniforms.uBandGrain = { value: grains };
    shader.uniforms.uBandAux = { value: auxes };
    shader.uniforms.uBandCount = { value: stack.length };
    /* The per-vertex TOP-SURFACE tint, off unless a geometry supplies `aTint`.
     *
     * The band stack describes ONE ground column, and a combat arena is the
     * first surface where that is not enough: a rock outcrop, a sand bar and a
     * dungeon flagstone are gameplay-legible features and a board where all
     * three read as forest litter is a board that got harder to play. So the
     * arena hands each vertex the ratio between its own tile's surface
     * substance and this stack's top band, and the weathered top multiplies by
     * it. Only the top: a cut through a rock tile must still show the arena's
     * true strata rather than a tinted lie about them, which is why the mix
     * rides `1 - gCut` below. Zero here leaves every other surface bit-identical. */
    shader.uniforms.uTintMix = { value: (m.userData.tintMix as number | undefined) ?? 0 };
    /* The voxel grid itself, so the fragment stage can snap to CELLS. The
     * origin is wrapped by the same 1024 m modulus as the shift: 1024 is a
     * multiple of every cell size this page offers, so the wrapped grid still
     * lands exactly on the voxel lattice. */
    shader.uniforms.uCellM = { value: (m.userData.cellM as number | undefined) ?? 1 };
    shader.uniforms.uGridOrigin = {
      value: new THREE.Vector3().fromArray(
        wrapShift((m.userData.originM as [number, number, number] | undefined) ?? [0, 0, 0]),
      ),
    };
    m.userData.shader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float aCutDepth;
attribute float aAO;
attribute vec3 aTint;
uniform vec3 uShift;
varying float vCutDepth;
varying float vAO;
varying vec3 vTint;
varying vec3 vWPos;
varying vec3 vNrmW;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vCutDepth = aCutDepth;
vAO = aAO;
vTint = aTint;
vWPos = position + uShift;
vNrmW = normal;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uBandDepth[${MAX_BANDS}];
uniform vec3 uBandColor[${MAX_BANDS}];
uniform vec3 uBandGrain[${MAX_BANDS}];
uniform vec3 uBandAux[${MAX_BANDS}];
uniform int uBandCount;
uniform float uCellM;
uniform vec3 uGridOrigin;
uniform float uTintMix;
const mat3 ROT1 = ${rotMat3(0.0, 0.0, 0.0)};
const mat3 ROT2 = ${rotMat3(0.61, 1.13, 0.37)};
const mat3 ROT3 = ${rotMat3(-1.02, 0.53, 2.21)};
varying float vCutDepth;
varying float vAO;
varying vec3 vTint;
varying vec3 vWPos;
varying vec3 vNrmW;
float gCut;
float gEdge;
float vgHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float vgNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(vgHash(i), vgHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(vgHash(i + vec3(0.0, 1.0, 0.0)), vgHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(vgHash(i + vec3(0.0, 0.0, 1.0)), vgHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(vgHash(i + vec3(0.0, 1.0, 1.0)), vgHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
float vgFbm(vec3 p) {
  // Two octaves, not three: the third octave cost ~2 ms of GPU frame time
  // full-screen and read as pixel dither at judging distance.
  return vgNoise(p) * 0.65 + vgNoise(p * 2.13 + 7.7) * 0.35;
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec3 wp = vWPos;
  // Meters of world per screen pixel here — the level-of-detail signal every
  // fine octave below fades against. Detail past the pixel is pure aliasing:
  // the round-one "gray-triangle screen-door" on distant cut walls was
  // exactly the fine tooth and speckle shimmering below the Nyquist limit.
  float pfp = max(length(fwidth(vWPos)), 1e-5);

  /* ------------------------- the weathered TOP ------------------------- */
  // Continuous noise — grass and litter are not voxels — but every octave in
  // its OWN rotated frame, so the value-noise lattice anisotropy of the
  // octaves can never line up into a repeating motif. This is the fix for
  // the "hexagons and macaroni loops" wallpaper the round-two critique named.
  vec3 wr2 = ROT2 * wp;
  vec3 wr3 = ROT3 * wp;
  float macro = vgNoise(wp * 0.13 + 5.0) * 0.6 + vgNoise(wr2 * 0.033 + 2.0) * 0.4;
  float fineVis0 = 1.0 - smoothstep(0.06, 0.5, pfp * uBandGrain[0].x);
  float tg1 = vgNoise(wp * uBandGrain[0].x);
  float tg2 = vgNoise(wr2 * uBandGrain[0].x * 2.13 + 7.7);
  float tg3 = vgNoise(wr3 * uBandGrain[0].x * 9.0 + 57.3);
  float tgrain = tg1 * 0.65 + tg2 * 0.35;
  vec3 topAlb = uBandColor[0]
    * (1.0 + (macro - 0.5) * 0.55)
    * (1.0 + (tgrain - 0.5) * 2.0 * uBandGrain[0].y)
    * (1.0 + (tg3 - 0.5) * 0.30 * fineVis0);
  // The per-tile surface tint. A MULTIPLIER, so every octave above survives it.
  topAlb *= mix(vec3(1.0), vTint, uTintMix);

  /* --------------------- the CUT face, per VOXEL CELL --------------------- */
  // Snap into the solid cell BEHIND the face: everything material below is a
  // function of this cell id and its center — one flat color per voxel face,
  // ± value jitter, no cross-cell interpolation. This is the whole round.
  vec3 cid = floor((wp - uGridOrigin) / uCellM - vNrmW * 0.5);
  vec3 cp = uGridOrigin + (cid + 0.5) * uCellM;
  float h1 = vgHash(cid * 0.731 + 3.1);
  float h2 = vgHash(cid * 0.577 + 6.7);
  // The CELL's depth below the original ground: shift the interpolated vertex
  // depth to the cell-center height, then jitter it per cell — layer seams
  // then crumble cell by cell instead of running as a machined sawtooth.
  float cellDepth = max(vCutDepth + (wp.y - cp.y) + (h2 - 0.5) * uCellM * 0.9, 0.0);
  vec3 bandCol = uBandColor[0];
  vec3 bandGrain = uBandGrain[0];
  vec3 bandAux = uBandAux[0];
  for (int i = 1; i < ${MAX_BANDS}; i++) {
    if (i >= uBandCount) break;
    // A HARD step. The material of a cell is one nameable thing.
    float t = step(uBandDepth[i - 1], cellDepth);
    bandCol = mix(bandCol, uBandColor[i], t);
    bandGrain = mix(bandGrain, uBandGrain[i], t);
    bandAux = mix(bandAux, uBandAux[i], t);
  }
  // Flat per-cell value swing, wider for chunky substances. MODEST on
  // purpose: the first cut of this shader swung ±40% and the wall read as a
  // patchwork quilt — within one material the voxels vary a little; the
  // PUNCH belongs to the boundaries BETWEEN materials.
  /* ROUND 9: the ARM'S-LENGTH handoff. Below ~5 m of viewing distance the
   * flat per-cell tiles are the "4-step tint quilt" the round-8 verdict
   * named: a 1 m tile at arm's length is a decal, not matter. closeVis
   * measures the VIEW (absolute pixel footprint, a distance proxy), and the
   * cell gate keeps the 25 cm world — whose cells already ARE chips, and
   * whose look is protected — bit-identical. As closeVis rises, the per-cell
   * swing hands off to the quarter-cell chip cascade below. */
  float closeVis = (1.0 - smoothstep(0.004, 0.010, pfp)) * smoothstep(0.3, 0.8, uCellM);
  vec3 cutAlb = bandCol
    * (1.0 + (h1 - 0.5) * (0.16 + bandGrain.y * 0.35) * (1.0 - closeVis * 0.45));
  // Warm/cool tilt from a LOW-FREQUENCY field at the cell center, not from
  // the per-cell hash. The round-3 hash tilt made the 25 cm carve floor
  // jitter warm-tan/cool-slate cell to cell with no spatial coherence —
  // right at the over-jitter line. A slow field clusters the tilt into
  // hand-sized patches, so neighbors mostly agree and the variation reads
  // as mineral drift instead of confetti.
  float tiltN = vgNoise(cp * 0.33 + 13.0) - 0.5;
  cutAlb *= vec3(1.0 + tiltN * 0.11, 1.0, 1.0 - tiltN * 0.11);
  // Large-scale shading sampled at the cell CENTER: still flat per cell, but
  // coherent across cells so a 30 m look reads masses, not confetti.
  float cmacro = vgNoise(cp * 0.13 + 5.0) * 0.6 + vgNoise((ROT2 * cp) * 0.033 + 2.0) * 0.4;
  cutAlb *= 1.0 + (cmacro - 0.5) * 0.4;
  // Roots: dark strands WANDERING ACROSS CELLS in living soil — the level
  // set of a cell-center field, so each strand is a chain of whole faces.
  if (bandAux.x > 0.01) {
    float rn = vgNoise(vec3(cp.x * 1.1, cp.y * 2.3, cp.z * 1.1) + 91.0);
    float strand = 1.0 - smoothstep(0.04, 0.09, abs(rn - 0.5));
    float rooty = bandAux.x * clamp(1.0 - cellDepth * 1.3, 0.0, 1.0);
    cutAlb = mix(cutAlb, vec3(0.016, 0.011, 0.006), strand * rooty * 0.9);
  }
  // Stones: discrete 1–3-cell blobs in mineral granular bands (subsoil,
  // gravel), hard-edged because the field is sampled at cell centers only.
  if (bandAux.x < 0.01 && bandAux.y < 0.01 && bandGrain.z > 0.2 && cellDepth > uBandDepth[0]) {
    float blob = vgNoise(cp * (0.5 / uCellM) + 42.0);
    if (blob > 0.62) cutAlb = vec3(0.088, 0.086, 0.082) * (0.70 + 0.60 * h1);
  }
  // Bedrock beds: whole-cell bands in world Y, undulating with a slow warp,
  // each bed its own value, with a dark parting seam between beds. The beds
  // carry MORE contrast than the per-cell jitter — horizontal structure is
  // what makes rock read as rock instead of as static.
  if (bandAux.y > 0.01) {
    float bedTh = max(uCellM * 2.0, 0.8);
    float warp = (vgNoise(vec3(cp.x * 0.045, 1.0, cp.z * 0.045)) - 0.5) * 5.0;
    float bedC = (cp.y + warp) / bedTh;
    float bh = vgHash(vec3(floor(bedC) * 0.373, 1.7, 2.9));
    cutAlb *= 1.0 + (bh - 0.5) * (0.30 + 0.45 * bandAux.y);
    // BAND GROUPS: every ~3 beds share one slow value shift, so a tall cut
    // reads lighter and darker STOREYS of rock instead of the round-3
    // monotone ("between rim collar and floor it is one pale granite").
    // Coherent in bed space — horizontal structure, not more jitter.
    float bg = vgHash(vec3(floor(bedC / 3.0) * 0.517, 4.3, 8.1));
    cutAlb *= 1.0 + (bg - 0.5) * 0.30;
    if (fract(bedC) < 0.12) cutAlb *= 0.72;
    // Rock is DESATURATED, never repainted — but round 5 overshot: the 0.35
    // pull to gray plus the neutral ambience left the shade edge face at
    // sat 0.10, "dead neutral gray, warm hue gone" (round-5 critique, gap 1).
    // The pull eases and the warm tilt strengthens, so the stone stays a
    // grayER cousin of the soil while reading warm in sun AND shade. The
    // round-3 slate-blue fault cannot return from this: the tilt is warm.
    cutAlb = mix(cutAlb, vec3(dot(cutAlb, vec3(0.3333))), 0.22) * vec3(1.03, 1.0, 0.955);
  }
  // Mineral glints in hard rock: sparse bright cells, not additive noise.
  if (bandGrain.z > 0.35 && bandAux.y > 0.01) {
    if (vgHash(cid * 0.419 + 27.0) > 0.93) cutAlb += vec3(0.055, 0.052, 0.048);
  }
  // THE CHIP CASCADE — round 9's single biggest change. Round 8's verdict:
  // the 25 cm world's cut wall does arm's-length matter (fine chip mosaic,
  // zero quilt) and the 1 m scenes never get that language. The reason was
  // that all sub-cell grain here was one weak quantized dither; the 25 cm
  // world looks right because its CELLS are chip-sized and carry the FULL
  // material treatment. So the cascade rebuilds that structure at every
  // cell size: quarter-cell chips that inherit material-strength variation
  // as the viewer closes in (closeVis, the handoff from the per-cell swing
  // above), plus a sixteenth-cell grit for tooth. All layers world-locked,
  // snapped behind the face exactly like the cell id, faded by pixel
  // footprint before they can shimmer — so nothing changes at 9–30 m.
  float subM = uCellM * 0.25;
  vec3 sid = floor((wp - uGridOrigin) / subM - vNrmW * 0.5);
  float subVis = 1.0 - smoothstep(0.30, 1.10, pfp / subM);
  float ch1 = vgHash(sid * 0.613 + 9.4);
  float dq = floor(ch1 * 4.0);
  cutAlb *= 1.0 + ((dq - 1.5) / 1.5) * 0.105 * subVis;
  // Close up the chips are MATERIAL, not dither: per-chip value swing at
  // the amplitude the cells carry at range, and a per-chip warm/cool tilt
  // so neighboring chips read as different stones, not different tones.
  float ch2 = vgHash(sid * 0.379 + 17.2);
  cutAlb *= 1.0 + (ch2 - 0.5) * (0.16 + bandGrain.y * 0.35) * closeVis;
  cutAlb *= vec3(
    1.0 + (ch1 - 0.5) * 0.09 * closeVis,
    1.0,
    1.0 - (ch1 - 0.5) * 0.09 * closeVis
  );
  // The grit: a sixteenth-cell quantized micro-grain — the 25 cm world's
  // own quarter-cell dither, now present at every cell size. Gated by the
  // same cell gate as closeVis so the 25 cm world stays bit-identical.
  float gritM = uCellM * 0.0625;
  vec3 gid = floor((wp - uGridOrigin) / gritM - vNrmW * 0.5);
  float gritVis =
    (1.0 - smoothstep(0.30, 1.10, pfp / gritM)) * smoothstep(0.3, 0.8, uCellM);
  float gq = floor(vgHash(gid * 0.613 + 9.4) * 4.0);
  cutAlb *= 1.0 + ((gq - 1.5) / 1.5) * 0.10 * gritVis;
  // And a faint continuous tooth under it, so the steps don't read printed.
  float fineVis = 1.0 - smoothstep(0.03, 0.25, pfp);
  cutAlb *= 1.0 + (vgNoise(wr3 * 13.0) - 0.5) * 0.10 * fineVis;

  // The threshold clears the datum quantization: original-top heights are
  // cell-quantized, so open-ground vertices can read a fraction of a cell of
  // false depth — at 0.02 the hillside speckled with stray quantized patches.
  // Slightly higher start and a tighter ramp than round 3 (0.28/+0.45): the
  // wide ramp let quantized-datum fractions on open slopes sit half-blended,
  // and the half-damp drew faint topo-contour streaks across the 240 m top.
  gCut = smoothstep(uCellM * ${CUT_ENGAGE_START_CELLS.toFixed(2)}, uCellM * ${CUT_ENGAGE_START_CELLS.toFixed(2)} + ${CUT_ENGAGE_RAMP_M.toFixed(2)}, vCutDepth);
  vec3 alb = mix(topAlb, cutAlb, gCut);
  // Fresh-cut damp, mild: the per-cell value jitter now separates faces, so
  // the heavy round-two darkening would just re-murk the strata.
  alb *= mix(1.0, 0.88, gCut);
  // Edge = normal change PER METER OF SURFACE, not per pixel. Raw fwidth
  // grows with distance, and at 100 m it painted the mesher's quantization
  // kinks as identical stamped glyphs across every hillside. Dividing by the
  // world-space pixel footprint makes the detector distance-invariant: only
  // a genuinely sharp crest — a cut rim, a voxel edge seen up close — fires.
  gEdge = smoothstep(2.5, 7.0, length(fwidth(vNrmW)) / pfp);
  alb *= 1.0 + gEdge * 0.12;
  // Graded, never crushed: the floor is high enough that a shaft wall stays
  // readable on the way down, and the probe fan above already grades it.
  // Round 5: floor 0.34 -> 0.48, exponent 1.25 -> 1.1. The round-4 critic
  // sampled a shaded crater wall at 13% luminance ("near-black murk") — the
  // baked AO multiplying on top of the shade-side light deficit crushed the
  // 4-step dither below legibility. Contact shadow still grades (a bore
  // bottom reads darker than its mouth); it no longer erases the substance.
  alb *= mix(0.48, 1.0, pow(clamp(vAO, 0.0, 1.0), 1.1));
  diffuseColor.rgb = alb;
}`,
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
{
  // Two noise reads, third channel derived: a normal perturbation only has
  // to be incoherent with the light, not statistically independent.
  // Faded with pixel footprint: at distance the perturbation cannot resolve
  // and only shimmers — half of the screen-door artifact came from here.
  // Each read in its OWN rotated frame: sharing one axis-aligned lattice put
  // regular egg-crate bump ROWS across flat topsoil at 2 m (round-3 residual
  // motif) — the same lattice-anisotropy fault the albedo octaves had.
  float pn1 = vgNoise(ROT2 * vWPos * 5.0 + 11.3);
  float pn2 = vgNoise(ROT3 * vWPos * 5.0 + 47.9);
  float pertVis = 1.0 - smoothstep(0.05, 0.35, length(fwidth(vWPos)) * 5.0);
  vec3 pert = vec3(pn1, pn2, pn1 * pn2 * 2.0) - 0.5;
  // CELL-SNAPPED FACETS on cut faces — the two-round gap 5/6 ("9 m
  // marching-cube facets"), finally attempted because it can be done in
  // SHADING alone: the smooth interpolated normal is pulled partway toward a
  // quantized direction chosen PER VOXEL CELL (the cell id jitters the
  // normal before quantization, so neighboring cells pick neighboring but
  // distinct facet directions). A 9 m cut wall then reads as a mosaic of
  // cell-scale cut planes instead of one smooth marching-cube panel, while
  // the geometry — and every sliver/seam guarantee it carries — is
  // untouched. Gated by gCut so the weathered top never facets, and by the
  // CUT_FACET_SNAP flag so one constant turns it off.
  if (${CUT_FACET_SNAP.toFixed(2)} > 0.0 && gCut > 0.0) {
    vec3 cidN = floor((vWPos - uGridOrigin) / uCellM - vNrmW * 0.5);
    vec3 nj = vec3(
      vgHash(cidN * 0.731 + 3.1),
      vgHash(cidN * 0.577 + 6.7),
      vgHash(cidN * 0.419 + 27.0)
    ) - 0.5;
    vec3 qn = floor(normalize(normalize(vNrmW) + nj * 0.35) * 2.0 + 0.5);
    if (dot(qn, qn) > 1e-4) {
      /* ROUND 9: the sun comes back to the cut faces. The raw snap paid the
       * accepted deviation's debt — sun and shade edge faces both read mean
       * 82 at 15 m (the protected pair had 13 units of separation), because
       * half the facets turned fully off the sun. Two repairs, both on the
       * facet DIRECTION, never on the mosaic:
       *  - each facet is biased a third of the way back toward the TRUE
       *    face normal, so the family of facets stays centered on the face
       *    the light actually sees (the critic's own prescription);
       *  - the swing is CLAMPED: a facet turned past ~60° from its face
       *    shades near-black (the "hole" chips) or catches bare sky (the
       *    pale slivers), so outliers are pulled back inside the cone. */
      vec3 tn = normalize(vNrmW);
      vec3 fq = normalize(mix(normalize(qn), tn, 0.65));
      float fd = dot(fq, tn);
      fq = normalize(mix(fq, tn, clamp((0.62 - fd) * 2.2, 0.0, 1.0)));
      /* The round-8 snap mixed a WORLD-space facet into the VIEW-space
       * lighting normal — a frame mismatch that made the facet field an
       * uncontrolled rotation off the light (which is exactly how it erased
       * the sun). The facet goes through viewMatrix first, so a facet
       * family centered on the face normal is now centered on the face's
       * LIGHTING too: mosaic per cell, sun where the sun is. */
      vec3 fqV = normalize((viewMatrix * vec4(fq, 0.0)).xyz);
      normal = normalize(mix(normal, fqV, ${CUT_FACET_SNAP.toFixed(2)} * gCut));
    }
  }
  /* Round 9: on faceted cut faces the random perturbation halves — the
   * facet field already supplies the micro-variation there, and the pert's
   * only remaining effect on a cut face was to blur every facet a few
   * degrees off its plane (which reads as haze and eats the sun). */
  normal = normalize(normal + pert * (0.30 * pertVis + 0.85 * gEdge) * (1.0 - 0.5 * gCut));
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor *= mix(0.85, 1.0, gCut);`,
      );
  };
  /* NO customProgramCacheKey. A fixed key told three.js "this program never
   * changes", so every shader edit during development silently kept running
   * the first compiled version. The default key hashes the onBeforeCompile
   * source, which is exactly the invalidation this material needs. */
  return m;
}

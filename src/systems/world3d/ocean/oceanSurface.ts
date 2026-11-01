/**
 * @file oceanSurface.ts — the mesh, the sampling and the water shading.
 *
 * THE MESH IS WARPED, NOT UNIFORM
 *
 * A uniform grid that reaches the horizon wastes almost all of its vertices
 * on distant water. This grid is built in a local square [-1, 1]^2 and mapped
 * outward by a square law, so vertex density falls off with distance and the
 * near water — the water beside the hull, the water the player actually
 * reads — gets most of the triangles.
 *
 * The far water is then UNDER-SAMPLED, unavoidably: at 4 km out the vertex
 * spacing is tens of meters and a 5 m wave cannot be represented. The
 * displacement is faded out there. That is a level of detail, not a fallback:
 * the geometry genuinely cannot carry the signal, and pretending otherwise
 * would produce aliasing, not detail. The shading keeps a roughness floor so
 * the far water still reads as water rather than as a mirror.
 *
 * SAMPLING IS MANUAL BILINEAR FROM A STORAGE BUFFER
 *
 * The FFT output lives in storage buffers, so there is no hardware filtering.
 * `oceanSampler.ts` holds the read: four reads and three mixes per sample
 * point. The vertex stage reads each cascade's displacement once. The
 * fragment stage reads each cascade's normal from a mip chain,
 * `oceanNormalMip.ts`, at the level that matches the pixel's footprint, four
 * taps along its long axis of two levels each, 32 reads, and the result is
 * the mean normal under the pixel
 * rather than one texel of it. That is the price of keeping the whole
 * pipeline in buffers, and it is measured in the perf gate rather than
 * guessed at.
 *
 * THE SHADING IS A SKY, A BODY AND A SUN
 *
 * Water is a mirror over a dark volume. Each pixel mixes the body color
 * with the sky along the reflected ray by a Schlick fresnel, then adds the
 * sun. The sky is `oceanSky.ts`, the same function the viewer draws behind
 * the sea, with its baked cumulus (the blurred copy, `skyClouds`), so the
 * reflection and the background agree. The sun is a tight Beckmann lobe
 * that sets the DENSITY of glitter points, one jittered point per
 * world-space cell sized to the pixel, so a glint is a small bright fleck
 * and not a lit facet. Where a ray dips under the horizon the sea returns
 * itself, weighted by the share of the facet the eye can see (GG-276). The
 * far water hazes into that sky's horizon color; there is no scene fog.
 *
 * THE FAR FIELD (distance rounds 1 and 2). Past about 500 m a pixel holds
 * many unresolved facets. They lift the mean reflected ray and open the
 * fresnel incidence (REFLECT_BEND, FRESNEL_BEND), they spread the reflected
 * sky over a band of elevations (REFLECT_SPREAD), and the chop they hold
 * keeps a texture to the horizon (THE FAR FIELD KEEPS A TEXTURE): the far
 * footprint is read finer across the view (ANISO_FAR_DIV), gusts roughen
 * patches of it and leave smooth ones (GUST_M), the chop's crests draw as
 * one-row dashes (DASH_LEN_M) and its residual as a grain (GRAIN_L_M), and
 * the mean bends give way to them with range (SHEEN_K). A second haze term
 * closes the water on the horizon (HAZE_FAR_M), the grid's outer ring
 * reaches 25 km (OCEAN_SKIRT_M), and the sea drops away with the Earth's
 * curvature (EARTH_CURVE), so the horizon sits where it does on a real sea.
 * Distance round 3 replaces the dashes and grain with a measured texture,
 * the sea's own roughness under each far pixel (FAR_TEX_K), stops the far
 * taps' jitter (FAR_JITTER), closes the haze over the last 30 rows
 * (HAZE_FAR_POW) and thins it with the eye's height (HAZE_AIR_H_M).
 * Distance round 4 calms that texture where the footprint grows long
 * (FAR_CALM_LO_M), softens its dashes (FAR_SOFT_K), gives the far water the
 * haze's tone (FAR_TONE_K) and makes the far body less violet (DEEP_FAR).
 * Distance round 5 lets the far water reflect the clouds' mean over its lobe
 * of rays (FAR_CLOUD_K), opens the calm's fresnel less (FAR_CALM_OPEN_SHARE),
 * ends the near low rays nearer (NEAR_SELF_END_M), gives the mid field a navy
 * body (DEEP_MID) and closes the far haze a little nearer (HAZE_FAR_M).
 * Distance round 6 reads the far texture's energy at a coarser level, so it
 * draws as long horizontal streaks (FAR_TEX_BIAS), and keeps it to the line
 * (FAR_CALM_R6, HAZE_FAR_M). Distance round 7 limits the far read's span along
 * the view to what a hardware anisotropic filter spans (FAR_SPAN_K), lets the
 * short waves carry the grazing far field in place of the long ones
 * (FAR_FINE_GAIN) and keeps the far mean ray under the sun (FAR_RAY_CAP).
 * Distance round 8 lets the long waves modulate the short waves' roughness, so
 * the far sea has broad smooth and rough stretches (HYDRO_K), gives the far
 * sheen the reference's cyan grey and the far dark marks its navy
 * (FAR_SHEEN_R, FAR_TONE_DARK, DEEP_FAR_R8, DEEP_MID_R8), and calms the last
 * rows under the line while the rows under them darken (LINE_CALM_LO_M).
 * Distance round 9 blends the far water toward the color of its footprint's
 * mean, so the last rows fade into faint streaks and a sheen (FAR_MEAN_K).
 * Distance round 10 lets the sun glitter reach the mid field and thin into a
 * path (FAR_GLINT_END_M) and takes some saturation out of the mid field
 * (MID_DESAT_K).
 * Distance round 11 lowers the sun for the whole viewer (the test sun,
 * OCEAN_TEST_SUN in oceanSky.ts) and, with it, cuts the spark cells' lit
 * share and the far mean ray's cap (SPARK_SHARE_TEST_SUN, FAR_RAY_CAP_TEST_SUN).
 * The storm keeps the round-4 far field it was judged with.
 *
 * A floating body puts a waterline band into the foam through
 * `setContact` (GG-274). The tuning channel (`tune`) holds the swept terms
 * as uniforms for capture rigs, the sky's horizon terms among them; their
 * defaults are the shipped values.
 *
 * C5 SOURCE OWNERSHIP: shade expressions and their original parameters have separate owners.
 * This factory keeps every setter, live reader binding, material rebuild and mesh/resource lifecycle.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 25/10/2026, 04:16:12
 * Dependents: components/DesignPreview/steps/sidebyside/oceanExtras/beach.ts, components/DesignPreview/steps/sidebyside/oceanExtras/foam.ts, components/DesignPreview/steps/sidebyside/oceanExtras/mouth.ts, components/DesignPreview/steps/sidebyside/oceanExtras/seabed.ts, components/DesignPreview/steps/sidebyside/oceanExtras/wake.ts, systems/world3d/ocean/index.ts, systems/world3d/ocean/oceanField.ts, systems/world3d/ocean/oceanRocks.ts
 * Imports: 18 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { createSurfaceShade } from './oceanSurfaceShade';
import { OCEAN_MESH_SIDE, OCEAN_RADIUS_M, OCEAN_SKIRT_M, OCEAN_WARP_POWER, CONTACT_SLOTS, HAZE_PER_M, FAR_SLOPE_GAIN, FAR_FRESNEL_FLATTEN, CLOUD_REFLECTION, GLINT_RMS_SLOPE, SPARK_DENSITY, SPARK_BRIGHTNESS, REFLECT_BEND, FRESNEL_BEND, REFLECT_SPREAD, FAR_DASH_UP, FAR_DASH_FRESNEL, EARTH_CURVE, HAZE_FAR_M, GRAIN_K, SHEEN_K, FAR_JITTER, HAZE_FAR_POW, HAZE_AIR_H_M, FAR_CALM_R6, FAR_CALM_OPEN_SHARE, FAR_CLOUD_K, NEAR_SELF_END_M, FAR_TEX_BIAS, FAR_TEX_GAIN_R6, FAR_FINE_GAIN, FAR_COARSE_GAIN, FAR_RAY_CAP_TEST_SUN, FAR_RAY_CAP, HYDRO_SLOPE, FAR_SHEEN_R, FAR_SHEEN_B, FAR_TONE_DARK, FAR_DASH_NEAR, FAR_DASH_LINE, FAR_DASH_NEG, FAR_FRES_RELAX, SPARK_SHARE_TEST_SUN } from './oceanSurfaceShadeParams';
import { type TslNode } from './oceanSurfaceNodeTypes';
export { OCEAN_SURFACE_SHOALS, OCEAN_RADIUS_M, OCEAN_SKIRT_M, OCEAN_MESH_SIDE, OCEAN_WARP_POWER, RIVER_FRESNEL_TAPS, RIVER_FRESNEL_SPAN, CONTACT_SLOTS } from './oceanSurfaceShadeParams';
import * as THREE from 'three/webgpu';
import { Fn, abs, cameraPosition, clamp, dot, exp, float, max, min, mix, positionLocal, pow, smoothstep, sqrt, step, uniform, uniformArray, varying, varyingProperty, vec2, vec3, vec4 } from 'three/tsl';
import type { CascadeParams } from './oceanConfig';
// THE BUILD-TIME MEMO (build-time round 1, GG-388): three r172 does not cache
// a node's type, and the surface's shared graph made the type walk grow as a
// product with its depth (41 s alone, 264 s with foam, never with the rocks).
// The module memoizes the walk in the generate stage; the WGSL is the same.
import './oceanNodeTypeMemo';
// THE SAMPLER LIMIT (build-time round 1): a fragment stage over 16 samplers
// shares one sampler per sampler state; a stage under it is unchanged.
import './oceanSharedSamplers';
import { createOceanSampler } from './oceanSampler';
import { createOceanNormalMip } from './oceanNormalMip';
import type { OceanGpuBuffers } from './oceanCompute';
import { oceanFeetFromMeters } from './oceanUnits';
import { OCEAN_SKY_TUNE, OCEAN_SUN_DIR, OCEAN_TEST_SUN } from './oceanSky';
import type { OceanSeabedReader } from './oceanSeabed';
import type { OceanReflectorReader } from './oceanReflector';
import type { OceanWakeReader } from './oceanWake';
import type { OceanFoamReader } from './oceanFoam';
import type { OceanRiverReader } from './oceanMouth';
import type { OceanRockReader } from './oceanRocks';
import { OCEAN_BORE_GAMMA, OCEAN_BREAK_FULL, OCEAN_BREAK_START, OCEAN_CREST_TO_HEIGHT, oceanBathymetryFor } from './oceanBathymetry';

/**
 * A warped grid, dense at the center and sparse at the rim.
 *
 * The stored position is already in WORLD meters on the XZ plane, so the
 * vertex stage does no unwarping.
 */
export function createOceanGridGeometry(
  side = OCEAN_MESH_SIDE,
  radiusM = OCEAN_RADIUS_M,
  skirtM = OCEAN_SKIRT_M,
): THREE.BufferGeometry {
  const verts = side + 1;
  const pos = new Float32Array(verts * verts * 3);

  for (let j = 0; j < verts; j += 1) {
    for (let i = 0; i < verts; i += 1) {
      const u = (i / side) * 2 - 1;
      const v = (j / side) * 2 - 1;
      // Power warp: |u| -> |u|^p, sign preserved, so the center is dense.
      const x = Math.sign(u) * Math.abs(u) ** OCEAN_WARP_POWER * radiusM;
      const z = Math.sign(v) * Math.abs(v) ** OCEAN_WARP_POWER * radiusM;
      // The outer ring goes out to the skirt. See OCEAN_SKIRT_M.
      const rim = i === 0 || i === side || j === 0 || j === side;
      const k = rim ? skirtM / radiusM : 1;
      const o = (j * verts + i) * 3;
      pos[o] = x * k;
      pos[o + 1] = 0;
      pos[o + 2] = z * k;
    }
  }

  const idx: number[] = [];
  for (let j = 0; j < side; j += 1) {
    for (let i = 0; i < side; i += 1) {
      const a = j * verts + i;
      const b = a + 1;
      const c = a + verts;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  // The grid never leaves its radius, and the displacement is small next to
  // it, so a fixed sphere is both correct and cheaper than recomputing.
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.max(radiusM, skirtM) * 1.5);
  return g;
}

export interface OceanSurface {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.NodeMaterial;
  /**
   * Compute nodes the field must run each frame AFTER the FFT and before
   * the render: the normal mip chain. `OceanField.step` does this.
   */
  readonly dispatches: readonly TslNode[];
  /** The patch center `setCenter` last wrote, meters, for pieces that sample the sea. */
  readonly center: THREE.Vector2;
  /** Move the patch with the ship so the dense center follows the camera. */
  setCenter(xM: number, zM: number): void;
  /**
   * The tuning channel: named uniforms whose defaults are the shipped
   * values. For a capture rig's sweeps; nothing in the game sets them.
   */
  readonly tune: Readonly<Record<string, { value: number }>>;
  /**
   * 0 renders water; 1..5 isolate Jacobian, foam, normal, height, specular;
   * 6..8 fresnel, the reflected radiance and the body (times 4), unhazed.
   */
  /** The sea floor seen through the water (oceanSeabed.ts); null removes it. Rebuilds the shader. */
  setSeabed(reader: OceanSeabedReader | null): void;
  /**
   * An object seen in the water (oceanReflector.ts, the buoy's hull): the
   * reader shades the mirrored view ray and the surface mixes its radiance
   * into the reflected radiance before the Fresnel weight; null removes it.
   * Rebuilds the shader. With no reader the surface is unchanged to the pixel.
   */
  setReflector(reader: OceanReflectorReader | null): void;
  /**
   * The wake of a moving hull (oceanWake.ts): extra height in the vertex
   * stage, extra slope, foam and bubble light in the fragment stage; null
   * removes it. Rebuilds the shader.
   */
  setWake(reader: OceanWakeReader | null): void;
  /**
   * Draw the foam of a persistent foam field (oceanFoam.ts) in place of the
   * fold-only ramp; null goes back to the ramp. Rebuilds the fragment node.
   */
  setFoam(reader: OceanFoamReader | null): void;
  /**
   * THE ONE WATER (river mouth round 1, ADR 0006): a river, its mouth and its
   * plume, drawn by this surface. Per world point the reader gives the level
   * over the mean sea level, the sea depth, the flow and the river water's
   * share (`oceanMouth.ts`). The surface lifts its vertex by the level, damps
   * each FFT band by the depth and the opposing current, hands the bands the
   * near-field grid carries over to it, adds the river's own slope, and
   * tints its body by the river's turbid water. null removes it; rebuilds the
   * shader. With no reader the surface is unchanged to the pixel.
   */
  setRiver(reader: OceanRiverReader | null): void;
  /**
   * THE ONE SURFACE'S DISPLACEMENT (river mouth round 1c), a new node each
   * call: the FFT bands with every reader's share (the bathymetry's shoal
   * gain, the rocks' lee, the river's shares and hold, its level) and the
   * wake's and the rocks' lifts, in local meters before the earth's curve.
   * A mesh that draws the same water from its other side (the underwater
   * piece's underside) displaces by it, so the two never part. Its readers
   * are read when a material builds: such a material rebuilds on
   * `onDisplacementChange`. null while no reader moves the vertex (no
   * river, rock or wake reader): the plain bands, which the caller reads its
   * own way.
   */
  vertexDisplacement(): TslNode | null;
  /** Call `cb` after each reader change that moves the vertex (setRiver, setRocks, setWake). Returns the remover. */
  onDisplacementChange(cb: () => void): () => void;
  /**
   * THE ROCKS (rocks round 7, oceanRocks.ts; ADR 0006): the sea knows the
   * rocks that stand in it. Per world point the reader gives the reflected
   * wave off the struck faces (a lift in the vertex stage, its slope in the
   * fragment stage) and each band's share past the rocks (their lee).
   * null removes it; rebuilds the shader. With no reader the surface is
   * unchanged to the pixel.
   */
  setRocks(reader: OceanRockReader | null): void;
  setDebug(mode: number): void;
  /**
   * Put a floating body's waterline into the foam (GG-274): slot `i` of
   * CONTACT_SLOTS, center (xM, zM) in world meters, hull radius at the
   * waterline rM, strength s 0 to 1. s = 0 turns the slot off.
   */
  setContact(i: number, xM: number, zM: number, rM: number, s: number): void;
  /** Peak-to-trough scale actually in the mesh, FEET. For HUD and reports. */
  readonly significantWaveHeightFt: number;
}

/**
 * Build the ocean mesh and its material.
 *
 * @param hsM significant wave height of the summed cascades, meters. Used for
 *            the foam threshold and reported back in feet.
 */
export function createOceanSurface(
  bufs: OceanGpuBuffers,
  cascades: readonly CascadeParams[],
  hsM: number,
  opts: {
    side?: number;
    radiusM?: number;
    sunDir?: THREE.Vector3;
    /**
     * A `uniform(number)` node, 0 fair to 1 storm deck: the SAME node the
     * sky was built with (`OceanSky.uOvercast`), so one value drives the
     * deck and the water under it. Omitted, the water is fair weather.
     */
    overcast?: TslNode;
    /**
     * A `uniform(number)` node: mean-square slope rain adds to the sea
     * (`rainSlopeVariance` in oceanRainMath.ts). It widens the sun lobe and
     * bends the fresnel as any unresolved slope does. Omitted, 0.
     */
    rainSlopeVariance?: TslNode;
    /**
     * The baked clouds to reflect, `OceanSky.cloudReflTexture`: the blurred
     * copy, since a reflected ray over ripples swings by degrees per pixel.
     * Omitted, the water reflects the clear-sky gradient only.
     */
    skyClouds?: THREE.Texture;
    /**
     * A `uniform(number)` node, the sea's clock in seconds: the SAME node the
     * FFT kernels read (`OceanKernels.uTime`), so the far texture drifts with
     * the waves and a capture at a pinned time reproduces. Omitted, 0: the
     * far texture holds still.
     */
    time?: TslNode;
  } = {},
): OceanSurface {
  const n = bufs.n;


  const uCenter = uniform(new THREE.Vector2(0, 0));
  // The sun the sky module lights. Passing a different one here without
  // passing it to the sky too would put the glitter under a sun the sky
  // does not show.
  const sun = (opts.sunDir ?? OCEAN_SUN_DIR).clone().normalize();
  const uSun = uniform(sun);
  // Weather. Both default to a zero uniform rather than a constant so the
  // shader is the same whether or not a caller drives them.
  const uOvercast: TslNode = opts.overcast ?? uniform(0);
  const uRainVar: TslNode = opts.rainSlopeVariance ?? uniform(0);
  const uTime: TslNode = opts.time ?? uniform(0);
  /**
   * Debug channel. 0 renders water; the rest isolate one term.
   *
   * This exists because the first look at the sea showed a white sheet in the
   * foreground and no way to tell whether it was foam, glitter or scattering.
   * Guessing at that costs more than a uniform.
   *
   *   1 folding Jacobian   2 foam mask   3 normal   4 height   5 specular
   *   6 fresnel   7 reflected radiance   8 body (times 4)
   */
  const uDebug = uniform(0);
  // Contacts (GG-274): (x, z, radius, strength) per slot, all off.
  const contacts: THREE.Vector4[] = [];
  for (let i = 0; i < CONTACT_SLOTS; i += 1) contacts.push(new THREE.Vector4(0, 0, 1, 0));
  const uContacts = uniformArray(contacts, 'vec4');
  // One past the highest live slot; 0 skips the contact term entirely.
  const uContactCount = uniform(0, 'int');
  /**
   * Tuning channel. A few terms a lighting sweep varies, as named uniforms
   * whose defaults ARE the shipped values, so a capture rig compares values
   * in one page load rather than rebuilding the shader for each one. The
   * viewer's probe sets them (`__OCEAN__.setTune`); nothing in the game does.
   * Each default carries its reason where it is used below.
   */
  const tune = {
    haze: uniform(HAZE_PER_M),
    farSlopeGain: uniform(FAR_SLOPE_GAIN),
    fresnelFlatten: uniform(FAR_FRESNEL_FLATTEN),
    cloudReflection: uniform(CLOUD_REFLECTION),
    glintRms: uniform(GLINT_RMS_SLOPE),
    sparkDensity: uniform(SPARK_DENSITY),
    sparkBrightness: uniform(SPARK_BRIGHTNESS),
    reflBend: uniform(REFLECT_BEND),
    fresBend: uniform(FRESNEL_BEND),
    reflSpread: uniform(REFLECT_SPREAD),
    farDash: uniform(FAR_DASH_UP),
    farFres: uniform(FAR_DASH_FRESNEL),
    // Distance round 2: the curvature (0 is the flat plane of round 1), the
    // far haze's closing range, the gust patches, the grain and the bends'
    // far share, each the shipped value or a multiplier on it; then the
    // sky's horizon terms (oceanSky.ts).
    curve: uniform(EARTH_CURVE),
    hazeFar: uniform(HAZE_FAR_M),
    gust: uniform(1),
    grain: uniform(GRAIN_K),
    sheen: uniform(SHEEN_K),
    // Distance round 3: the measured far texture (0 draws round 2's dashes
    // and grain), the far taps' jitter (1 is round 2), the far haze's power
    // (2 is round 2) and the haze layer's height (0 is sea-level air at every
    // height). With these, `hazeFar` 6000 and the sky's `skyBandDim` 0.30 and
    // `skyBandK` 0.05 (and a re-bake), the surface draws round 2's frame.
    farTex: uniform(1),
    farJitter: uniform(FAR_JITTER),
    hazeFarPow: uniform(HAZE_FAR_POW),
    hazeAirH: uniform(HAZE_AIR_H_M),
    // Distance round 4: the far calm, the soft dashes, the far tone and the
    // far body color, each 1 for the shipped look and 0 for round 3. With
    // these at 0 and the sky's `skyBandFoot` 0, `skyGreyKMul` 1, `skyBandGrey`
    // 0.55 and `skyBandK` 0.035 (and a re-bake), the surface draws round 3's
    // frame.
    farCalm: uniform(FAR_CALM_R6),
    farSoft: uniform(1),
    farTone: uniform(1),
    farBody: uniform(1),
    // Distance round 5: the calm's opening share (1 is round 4), the far
    // clouds (0 is round 4), the near low rays' end, meters (600 is round 4)
    // and the mid-field body (0 is round 4). With these at their round-4
    // values, `hazeFar` 3000 and the sky's round-4 values (oceanSky.ts, THE
    // HAZE IS THIN AND BRIGHT; a re-bake), the surface draws round 4's frame.
    farCalmOpen: uniform(FAR_CALM_OPEN_SHARE),
    farCloud: uniform(FAR_CLOUD_K),
    nearSelfM: uniform(NEAR_SELF_END_M),
    midBody: uniform(1),
    // Distance round 6: the far texture's coarser energy read, levels (0 is
    // round 5), and its gain (1 is round 5). With these at their round-5
    // values, `farCalm` 1, `farCalmOpen` 0.7, `farCloud` 0.5, `hazeFar` 2500
    // and the sky's `skyCloudFade` 0, the surface draws round 5's frame.
    farTexBias: uniform(FAR_TEX_BIAS),
    farTexGain: uniform(FAR_TEX_GAIN_R6),
    // Distance round 7: the far span's share (0 is round 6), the fine and
    // coarse cascades' far gains (1 is round 6) and the far ray cap (1 is
    // round 6). With these, `farCalmOpen` 2.2 and the round-6 values of
    // round 6's own tunes, the surface draws round 6's frame.
    farSpan: uniform(1),
    farFineGain: uniform(FAR_FINE_GAIN),
    // River mouth round 6: a bisect channel for the river page (the rig's
    // `setTune`): each cascade's drawn slope on the river (riverSlopeK0..3)
    // and the near field's own slope (riverOwnK), all 1 by default. Read only
    // where a river reader is set, so no other scene's shader holds them.
    riverSlopeK0: uniform(1),
    riverSlopeK1: uniform(1),
    riverSlopeK2: uniform(1),
    riverSlopeK3: uniform(1),
    riverOwnK: uniform(1),
    // Round 9: the young sea's read, levels over the footprint's (a bisect tune; 0 by default, read only with a young sea).
    riverYoungLv: uniform(0),
    // Round 9: the young sea's drawn share, times (a bisect tune; 1 by default).
    riverYoungK: uniform(1),
    farCoarseGain: uniform(FAR_COARSE_GAIN),
    // Distance round 11: the test sun's far ray cap (FAR_RAY_CAP_TEST_SUN);
    // FAR_RAY_CAP is round 10.
    farRayCap: uniform(OCEAN_TEST_SUN ? FAR_RAY_CAP_TEST_SUN : FAR_RAY_CAP),
    // Distance round 8: the long waves' modulation of the short ones (0 is
    // round 7), the far sheen's tint (0 is round 7) and its red and blue
    // gains, the far tone's share kept off the dark marks (0 is round 7), the
    // far and mid bodies' navy (0 is round 7), and the last rows' calm: the
    // dash under the line and at it and its negative side (1 is round 7) and
    // the fresnel flattening's relax under the line (0 is round 7). With
    // these at their round-7 values the surface draws round 7's frame.
    hydro: uniform(1),
    hydroSlope: uniform(HYDRO_SLOPE),
    farSheen: uniform(1),
    farSheenR: uniform(FAR_SHEEN_R),
    farSheenB: uniform(FAR_SHEEN_B),
    farToneDark: uniform(FAR_TONE_DARK),
    farNavy: uniform(1),
    midNavy: uniform(1),
    farDashNear: uniform(FAR_DASH_NEAR),
    farDashLine: uniform(FAR_DASH_LINE),
    farDashNeg: uniform(FAR_DASH_NEG),
    farFresRelax: uniform(FAR_FRES_RELAX),
    // Distance round 9: the far water's blend toward its footprint's mean
    // (0 is round 8).
    farMean: uniform(1),
    // Distance round 10: the glitter's reach into the mid field and the mid
    // field's desaturation (0 is round 9 for both).
    farGlint: uniform(1),
    midDesat: uniform(1),
    // Distance round 11: the spark cells' lit share, times, for the test
    // sun (SPARK_SHARE_TEST_SUN); 1 is round 10.
    sparkShare: uniform(OCEAN_TEST_SUN ? SPARK_SHARE_TEST_SUN : 1),
    ...OCEAN_SKY_TUNE,
  };

  // The plane read and the range fade live in oceanSampler.ts, shared with
  // the buoyancy probe so a hull sits on the water that is drawn (GG-273).
  // `filtered`: the vertex displacement reads the bordered atlas, one
  // fetch a cascade (performance pass, iteration 5; see oceanSampler.ts).
  const { disp, sampleCascade, cascadeLod } = createOceanSampler(bufs, uCenter, { filtered: true });
  // The normal is read through a mip chain; see oceanNormalMip.ts. Its
  // dispatches run each frame after the FFT, from `OceanField.step`.
  const mip = createOceanNormalMip(bufs);

  /* --- vertex: displace ------------------------------------------- */

  const worldFlat = vec2(positionLocal.x, positionLocal.z).add(uCenter);
  /**
   * The reference "resolvable water" weight, carried to the fragment stage.
   *
   * It is the widest roll-off that still reaches zero: the range past which
   * the mesh holds nothing but swell. Foam folds to 1 across it, because a
   * whitecap smaller than a pixel is not a whitecap, it is a shade of gray.
   */
  const refLod = cascades
    .filter((c) => c.dispLod.floor === 0)
    .reduce((a, c) => (c.dispLod.endM > a.dispLod.endM ? c : a)).dispLod;
  const fade = cascadeLod(worldFlat, refLod).toVar();

  // Every cascade, each faded on its own terms, summed. Displacement is
  // geometry, so a cascade whose waves are shorter than the local vertex
  // spacing must be gone before it gets there.
  // THE REEF (rocks round 2, oceanBathymetry.ts): the depth under this
  // vertex, OCEAN_DEEP_M where the sea has no shelf, and each band's
  // shoaling gain there (exactly 1 in deep water and before a caller sets
  // the bands).
  const bathy = oceanBathymetryFor(bufs);
  const reefDepth = bathy.depthAt(worldFlat).toVar();
  let dispAcc: TslNode | null = null;
  /* THE ROCKS (rocks round 7, oceanRocks.ts; ADR 0006). Null for every sea
   * with no rock, so the vertex and fragment stages compute the same values:
   * the band share is the constant 1 and the lift the constant 0.
   * ONE SAMPLE A VERTEX (rocks round 7b, GG-388: the shader's build time).
   * setRocks builds the reader's vertex sample once (rockV, as setRiver
   * builds riverV); ONE Fn in the vertex flow returns its lee (a vec4, one
   * share a band) and assigns the two varyings the fragment reads, so the
   * shader holds one copy of the reader's graph, not one a band. The Fns
   * are rebuilt with the material, so they read the rockV they find then. */
  let rockReader: OceanRockReader | null = null;
  let rockV: { lee: TslNode; lift: TslNode; slope: TslNode } | null = null;
  const vRockLee = varyingProperty('vec4', 'vRockLee');
  const vRockSlope = varyingProperty('vec2', 'vRockSlope');
  const rockLeeOnce = Fn(() => {
    if (rockV === null) return vec4(1, 1, 1, 1);
    vRockLee.assign(rockV.lee);
    vRockSlope.assign(rockV.slope);
    return rockV.lee;
  })().toVar();
  const rockBandV = (ci: number) => [rockLeeOnce.x, rockLeeOnce.y, rockLeeOnce.z, rockLeeOnce.w][ci];
  const rockLift = Fn(() => (rockV === null ? float(0) : rockV.lift));
  // Each cascade's displacement is kept, for the river's per-band share.
  const dispC: TslNode[] = [];
  for (let ci = 0; ci < cascades.length; ci += 1) {
    const d = sampleCascade(disp, worldFlat, ci, cascades[ci].patchM)
      .xyz.mul(cascadeLod(worldFlat, cascades[ci].dispLod)).mul(bathy.bandGain(ci, reefDepth))
      // The rocks' lee (rocks round 7): the share of this band that passes them.
      .mul(rockBandV(ci));
    dispC.push(d);
    dispAcc = dispAcc === null ? d : dispAcc.add(d);
  }
  /* THE ONE WATER (river mouth round 1, ADR 0006; oceanMouth.ts). Null for
   * every sea before the mouth, so the vertex stage is the same node graph.
   * The laws, each the CPU twin's in oceanMouthMath.ts (a test holds the
   * twins to the closed forms):
   *   - SHOALING: a band's height grows as sqrt(cg(d0) / cg(d)) from the FFT's
   *     own depth d0 to the sea depth d (energy flux, Dean and Dalrymple
   *     1991), the group speed from Fenton and McKee's (1990) explicit
   *     dispersion, as the bathymetry module solves it;
   *   - THE CURRENT: wave action (Bretherton and Garrett 1968), r = -U.k / cg:
   *     the band grows as (1 - r)^(-1/2), breaks away from r = 0.5 (Chawla
   *     and Kirby 2002) and is blocked at r = 1, where U = -cg;
   *   - THE HAND-OVER: a band the near-field grid carries (it forces the
   *     grid's sea edge) gives its share to the grid's own level;
   *   - THE DEPTH HOLDS THE SUM: the bathymetry module's breaking share and
   *     the broken wave's H = 0.55 d take the summed crest or trough toward
   *     the height the depth keeps, which is 0 where the bed stands over the
   *     mean sea level: the river's water alone carries no sea wave. */
  let riverReader: OceanRiverReader | null = null;
  // Each band's group speed at its own FFT depth, for the shoaling ratio.
  const riverCg = (omega: number, depth: TslNode): TslNode => {
    const dd = max(depth, float(0.05));
    const kh0 = dd.mul((omega * omega) / 9.81);
    const t2 = exp(pow(kh0, float(0.75)).mul(2));
    // tanh(x) = 1 - 2 / (e^(2x) + 1); sinh(2kh) = (e^(2kh) - e^(-2kh)) / 2.
    const th = float(1).sub(float(2).div(t2.add(1)));
    const kh = kh0.div(pow(th, float(2 / 3)));
    const e2 = exp(kh.mul(2));
    const sh2 = e2.sub(float(1).div(e2)).mul(0.5);
    const nG = float(0.5).mul(float(1).add(kh.mul(2).div(max(sh2, float(1e-6)))));
    return nG.mul(omega).mul(dd).div(kh);
  };
  /* THE RIVER'S OWN SURFACE (river mouth round 2; the lead's point 2). A
   * WIND-LOCKED band (`MouthBand.local`, `windLockedBands`: its waves regrow
   * under the wind within the channel's width, Plant 1982) is not the sea's
   * waves carried in against the current: on the river it is the local wind
   * sea at the fetch over the water (`localBandShares`, the reader's
   * \`rippleH\`), with no current share and no hand-over. Round 1 gave it the
   * current's share like the swell's, and the 1 to 2 m/s outflow blocked it
   * (r = -U.k / cg near 2 for a 0.5 m ripple): the river drew as a glassy
   * mirror with whole clouds in it. Its slope share (\`rippleS\`) differs from
   * its height share (the young sea keeps the short waves, which carry the
   * slope, and loses the long ones): it goes to the fragment in vRiverFlow.z. */
  const riverShoal = (ci: number, st: { depth: TslNode }): TslNode => {
    const b = (riverReader as OceanRiverReader).bands[ci];
    const dd = max(st.depth, float(0.05));
    const cg = riverCg(b.omega, dd);
    const shoal = mix(sqrt(float(b.cg0MS).div(cg)), float(1), step(float(b.depth0M), dd));
    return shoal.div(bathy.bandGain(ci, reefDepth));
  };
  const riverBandShare = (ci: number, st: { depth: TslNode; velocity: TslNode; handover: TslNode }): TslNode => {
    const b = (riverReader as OceanRiverReader).bands[ci];
    const dd = max(st.depth, float(0.05));
    const cg = riverCg(b.omega, dd);
    // No \`select\` here (see oceanMouth.ts, "NO select IN THE READER"): choices are mixes by a step.
    // ONE SHOALING LAW (round 1c): the reader's energy-flux shoaling over the coast's own floor (which
    // holds the ebb bar) replaces the bathymetry module's Green's-law gain, which dispC carries for
    // the bar's shelf: without the divide the bar shoaled twice.
    const shoalOne = riverShoal(ci, st);
    // Off the near field the wind-locked band keeps the sea's own wind sea (no current share); on it the vertex
    // blends to the local wind sea (riverVertex, \`rippleW\`).
    if (b.local) return shoalOne;
    const r = dot(st.velocity, vec2(float(b.dirX), float(b.dirZ))).negate().div(cg);
    const grow = float(1).div(sqrt(max(float(1).sub(r), float(1e-4))));
    const cur = float(1).sub(step(float(1), r)).mul(grow.mul(float(1).sub(smoothstep(float(0.5), float(1), r))));
    const own = b.forced ? float(1).sub(st.handover) : float(1);
    return shoalOne.mul(cur).mul(own);
  };
  const riverHold = (eta: TslNode, depth: TslNode): TslNode => {
    const a = abs(eta);
    const dd = max(depth, float(0));
    const x = a.mul(OCEAN_CREST_TO_HEIGHT).div(max(dd, float(1e-3)));
    const brk = smoothstep(float(OCEAN_BREAK_START), float(OCEAN_BREAK_FULL), x);
    const held = dd.mul(OCEAN_BORE_GAMMA / OCEAN_CREST_TO_HEIGHT);
    return mix(float(1), min(float(1), held.div(max(a, float(1e-6)))), brk);
  };
  /* THE ENVELOPE HOLD (river mouth round 1c; the CPU twin is
   * `envelopeHoldCpu`, oceanMouthMath.ts). The crest-by-crest hold above
   * changes along one wave with the crest's own height. On the vertical that
   * is the broken crest's flat top, and it is kept. On the HORIZONTAL
   * displacement it made a fold at the edge of each held crest (a Gerstner
   * wave: J = 1 - k A^2 / H there, against 1 - k A unheld), and the folds
   * drew as navy back faces over the whole coast's sea at every low pose
   * (round 1b, the lead's seam 3; the reader off drew none). The horizontal
   * is held by the local significant height instead: the bands' Hs times
   * their shares summed in quadrature, kept to H = 0.55 d (the broken wave's
   * height). It changes only with the depth and the shares, so it folds
   * nothing; it is 0 where the sea depth is 0 (the river alone). */
  const riverEnvelopeHold = (hsLocal: TslNode, depth: TslNode): TslNode => {
    const dd = max(depth, float(0));
    const brk = smoothstep(float(OCEAN_BREAK_START), float(OCEAN_BREAK_FULL), hsLocal.div(max(dd, float(1e-3))));
    const keep = min(float(1), dd.mul(OCEAN_BORE_GAMMA).div(max(hsLocal, float(1e-6))));
    return mix(float(1), keep, brk).mul(step(float(1e-4), dd));
  };
  /** The river's vertex: the shared bands' sum, the held factor, and each band's final share. */
  const riverVertex = (): { disp: TslNode; shares: TslNode; extra: TslNode; flow: TslNode; lean: TslNode; sea: TslNode | null; warp: TslNode | null; crestJ: TslNode | null } => {
    const st = (riverReader as OceanRiverReader).sample(worldFlat);
    /* ROUND 9, LAW 2: THE CREST MOVES AT THE SHALLOW SPEED (\`phaseWarpMap\`, oceanMouthMath.ts). Each forced
     * band is read at its warped place, x + W dir (W the integral of k / k0 - 1 along its heading from the near
     * fields' one sea edge): its local wavelength there is 2 pi / k and its crest moves at omega / k, the shallow
     * speed (Hedges 1976 on h + H). The share laws below are unchanged. With no warp in the sample, the bands keep
     * their own read (round 8's vertex). */
    const bandsR = (riverReader as OceanRiverReader).bands;
    const warpV = st.warp ?? null;
    const dispR: TslNode[] = dispC.map((dc, ci) => {
      const b = bandsR[ci];
      if (warpV === null || !b.forced || ci > 3) return dc;
      const wv = [warpV.x, warpV.y, warpV.z, warpV.w][ci];
      const at = worldFlat.add(vec2(float(b.dirX), float(b.dirZ)).mul(wv));
      return sampleCascade(disp, at, ci, cascades[ci].patchM)
        .xyz.mul(cascadeLod(worldFlat, cascades[ci].dispLod)).mul(bathy.bandGain(ci, reefDepth)).mul(rockBandV(ci));
    });
    // The river's own slope and its column, read here once a vertex and
    // carried to the fragment (vRiverExtra), in place of nine texture reads a
    // pixel: with them in the fragment the surface's shader build took 840 s
    // on this machine's D3D11 path and once did not end (mouth round 1).
    const sl = (riverReader as OceanRiverReader).slope(worldFlat);
    // Round 3: w carries the local sea's weight (the crest stretch's blend in the fragment).
    const extra = vec4(sl.x, sl.y, st.column, st.rippleW);
    const sh: TslNode[] = [];
    let acc: TslNode | null = null;
    let hs2: TslNode | null = null;
    const loc = (riverReader as OceanRiverReader).bands.findIndex((b) => b.local);
    for (let ci = 0; ci < cascades.length; ci += 1) {
      const s = riverBandShare(ci, st);
      sh.push(s);
      const d = dispR[ci].mul(s);
      acc = acc === null ? d : acc.add(d);
      const hb = s.mul((riverReader as OceanRiverReader).bands[ci].hsM);
      hs2 = hs2 === null ? hb.mul(hb) : hs2.add(hb.mul(hb));
    }
    const hold = riverHold((acc as TslNode).y, st.depth);
    const holdH = riverEnvelopeHold(sqrt(hs2 as TslNode), st.depth);
    /* THE LOCAL WIND SEA ON THE NEAR FIELD (round 2). The sea's depth hold
     * takes every band to 0 where the bed stands over the mean sea level
     * (the river alone carries no SEA wave), and the river above s = 78 m and
     * every film on the banks drew as a perfect mirror. The wind-locked band
     * is not a sea wave: on the near field it is the local wind sea the
     * reader packs on the CPU (\`rippleH\`, \`rippleS\`: its fetch, and the
     * river's own water depth h holding it to H = 0.55 h), blended in by the
     * near field's hand-over (\`rippleW\`) from the sea's held share at the
     * grid's sea edge. */
    let locShare: TslNode | null = null;
    let locSlope: TslNode | null = null;
    let accHeld: TslNode = (acc as TslNode).mul(vec3(holdH, hold, holdH));
    if (loc >= 0) {
      locShare = mix(sh[loc].mul(hold), st.rippleH, st.rippleW);
      /* ROUND 9 (law 1): past the near field the open band's slope rides the current (\`currentShare\` at the
       * slope's r, the sample's \`openCur\`): it steepens against the outflow and is blocked by it, and the young
       * sea takes the share the current took. Without the young sea, round 8's share. */
      locSlope = mix(st.openCur === undefined ? sh[loc].mul(hold) : sh[loc].mul(hold).mul(st.openCur), st.rippleS, st.rippleW);
      // The local band leaves the held sum and comes back at its own share.
      accHeld = accHeld.sub(dispR[loc].mul(sh[loc]).mul(vec3(holdH, hold, holdH))).add(dispR[loc].mul(locShare));
    }
    const shHeld = sh.map((s, ci) => (ci === loc && locShare !== null ? locShare : s.mul(hold)));
    while (shHeld.length < 4) shHeld.push(float(1));
    /* THE BED SHEAR'S SURFACE ROUGHNESS (round 2; Brocchini and Peregrine
     * 2001). The bed's friction velocity from the solver's own Manning law,
     * u* = sqrt(g) n |U| / h^(1/6); the turbulence at the free surface
     * q = 0.85 u* (Nezu and Nakagawa 1993: u' / u* = 2.30 e^(-y / h) at
     * y = h); its eddies L = 0.77 h (their integral scale near the surface).
     * In Brocchini and Peregrine's diagram q^2 / (g L) and the Weber number
     * put a river like this one in the weak region: the surface is scarred
     * and dimpled, not broken, its height q^2 / (2 g) over L, so the slope's
     * variance is (q^2 / (2 g L))^2. It joins the unresolved roughness
     * (the sun lobe and the glints). On the Sarcelle (|U| 1 m/s, h 1 m) it
     * is 3e-7 against the wind ripple's 1e-2: the law says it is not what
     * breaks the reflection; the wind ripple is. */
    const hRiv = max(max(st.depth, st.column), float(0.1));
    const uStar = st.velocity.length().mul(Math.sqrt(9.81) * (riverReader as OceanRiverReader).manningN).div(pow(hRiv, float(1 / 6)));
    const qS = uStar.mul(0.85);
    const turbSlope = qS.mul(qS).div(hRiv.mul(2 * 9.81 * 0.77));
    /* THE RIVER'S FILM ON THE WIND-LOCKED BAND (round 5; \`filmSlick\` and
     * \`filmBandTake\`, oceanMouthMath.ts): what the slick still takes after the
     * shorter waves, from the band's waves under 30 cm, as a share of the
     * band's drawn slope variance (its octave estimate times its share
     * squared), at most the band's short share; the slope keeps the root of
     * the rest. Without a film the share is round 4's. */
    const film = (riverReader as OceanRiverReader).slick;
    const ripS0 = locSlope === null ? float(1) : locSlope;
    const ripS = film === undefined || st.sea === undefined || locSlope === null ? ripS0 : (() => {
      const rest = mix(float(film.restFarVar), float(film.restNearVar), st.rippleW);
      const v = ripS0.mul(ripS0).mul(film.bandVarUnit);
      const take = min(rest.div(max(v, float(1e-9))), mix(float(film.bandShortShare), float(film.bandShortShareNear), st.rippleW));
      return ripS0.mul(sqrt(max(float(1).sub(clamp(st.sea.w, float(0), float(1)).mul(take)), float(0))));
    })();
    /* THE BORE'S LEAN (river mouth round 3; the lead's point 1, the breakers
     * in the judged frame). A wave that shoals and breaks loses its sine's
     * shape: its front steepens and its back flattens, the saw-tooth of a
     * bore (Ruessink, Ramaekers and van Rijn 2012; the reader's `lean`, each
     * band's kappa by the depth, `boreLeanTable` in oceanMouthMath.ts). Round
     * 2's surf was a clipped sine whose white water lay on a 4 degree face.
     * The lean acts on the fragment's slopes and fold (vRiverLean); the
     * vertex keeps round 2's geometry. A lean in the vertex (x + kappa eta
     * dir) multiplied the surface's pipeline compile time by seven on this
     * machine's D3D11 path (33 s against 4.6 s; mouth3/wgslSize.mjs, tests C
     * to F) and put the page's ready time over the 60 s gate. */
    /* ROUND 9: one varying carries each forced band's warp and, in the local band's channel, the young sea's slope
     * share (law 1, the sample's \`young\`); another each forced band's k / k0 (1 in the local channel). */
    const youngV = st.young ?? float(0);
    const warpOut = warpV === null ? null : vec4(...[0, 1, 2, 3].map((ci) => (ci < bandsR.length && bandsR[ci].local ? youngV : [warpV.x, warpV.y, warpV.z, warpV.w][ci])));
    const jOut = warpV === null || st.crestJ === undefined ? null : st.crestJ;
    return {
      warp: warpOut,
      crestJ: jOut,
      lean: st.lean,
      // Round 5: the sea's own water under the plume (the reader's \`sea\`), or null (round 4's reader).
      sea: st.sea ?? null,
      flow: vec4(st.velocity.x, st.velocity.y, ripS, turbSlope.mul(turbSlope)),
      // The zero-weight term puts \`extra\`'s reads in the position's graph,
      // so the vertex stage sets them up (see the note below on varyings);
      // it adds nothing to the height.
      // The vertical held crest by crest, the horizontal by the envelope (above).
      disp: accHeld.add(vec3(float(0), st.level.add(extra.x.add(extra.y).add(extra.z).add(extra.w).mul(0))
        // Round 9: the same zero-weight term puts the young sea's and the crests' reads in the position's graph.
        .add(warpOut === null ? float(0) : warpOut.x.add(warpOut.y).add(warpOut.z).add(warpOut.w).mul(0))
        .add(jOut === null ? float(0) : jOut.x.add(jOut.y).add(jOut.z).add(jOut.w).mul(0)), float(0))),
      shares: vec4(shHeld[0], shHeld[1], shHeld[2], shHeld[3]),
      extra,
    };
  };
  /* THE RIVER'S VERTEX NODES ARE BUILT ONCE PER READER (setRiver), and the
   * vertex Fn and the fragment's varying of the band shares use the same
   * nodes. Why: three r172 does not set up the nodes under a varying (its
   * setup does not go into its child). A texture read that only the varying
   * holds has no UV at generate time, and the build fails ("reading 'build'"
   * in TextureNode.generateUV; river mouth round 1). Every node the shares
   * hold is also in the vertex position, so the position's setup sets them
   * up. What is kept: no reader, the same node graph as before. */
  let riverV: { disp: TslNode; shares: TslNode; extra: TslNode; flow: TslNode; lean: TslNode; sea: TslNode | null; warp: TslNode | null; crestJ: TslNode | null } | null = null;
  /* THE BAND SHARES REACH THE FRAGMENT AS A VARYING PROPERTY ASSIGNED IN THE
   * VERTEX STAGE (mouth round 1, the build-time hunt). As \`varying(shares)\`
   * built in the fragment, three r172 generated the shares' graph again in
   * the vertex flow (flowNodeFromShaderStage) with the held crest under it,
   * which holds every cascade's FFT read: the page then took 840 s or more to
   * build the surface (a bisect: with this one varying off it drew in 17 s).
   * Assigned here, in the vertex Fn where the displacement already stands,
   * the shares are one more line of the vertex stage. */
  const vRiverShare = varyingProperty('vec4', 'vRiverShare');
  // Round 2: the water's flow (xy), the wind-locked band's slope share (z), the bed shear's slope variance (w).
  const vRiverFlow = varyingProperty('vec4', 'vRiverFlow');
  // Round 3: each forced band's lean, kappa (1/m), for the fragment's slopes.
  const vRiverLean = varyingProperty('vec4', 'vRiverLean');
  // Round 5: the sea's own water under the plume (the stirred sand's column, its dilution, the river water's share).
  const vRiverSea = varyingProperty('vec4', 'vRiverSea');
  // Round 9: each forced band's phase warp (m) with the young sea's share in the local band's channel; each forced band's k / k0.
  const vRiverWarp = varyingProperty('vec4', 'vRiverWarp');
  const vRiverJ = varyingProperty('vec4', 'vRiverJ');
  const riverDisp = Fn(() => {
    if (riverV === null) return dispAcc;
    vRiverShare.assign(riverV.shares);
    vRiverFlow.assign(riverV.flow);
    vRiverLean.assign(riverV.lean);
    if (riverV.sea !== null) vRiverSea.assign(riverV.sea);
    if (riverV.warp !== null) vRiverWarp.assign(riverV.warp);
    if (riverV.crestJ !== null) vRiverJ.assign(riverV.crestJ);
    return riverV.disp;
  });
  /* THE WAKE (oceanWake.ts, the wake piece). Null for open water, so a
   * surface with no hull compiles and shades exactly as before. The lift
   * is a Fn so a rebuild after `setWake` reads the reader it finds then. */
  let wakeReader: OceanWakeReader | null = null;
  const wakeLift = Fn(() => (wakeReader === null ? float(0) : wakeReader.lift(worldFlat)));
  /* THE ONE SURFACE'S DISPLACEMENT, a node per call (round 1c; see
   * `vertexDisplacement`). The underwater piece's underside displaced by the
   * plain FFT bands alone: where a reader held this surface lower (the
   * river's depth hold over the coast, its hand-over, the land), the
   * underside's wave backs stood over the held top and drew the underside's
   * navy as flat slabs on the sea and as a band along the shore at every low
   * pose (river mouth round 1b, the lead's seam 3). */
  const vertexDisplacementNode = (): TslNode => riverDisp().add(vec3(float(0), wakeLift().add(rockLift()), float(0)));
  const vertexDisplacement = (): TslNode | null => (riverReader === null && rockReader === null && wakeReader === null
    ? null : vertexDisplacementNode());
  const displacementListeners = new Set<() => void>();
  const displacementChanged = () => { for (const cb of displacementListeners) cb(); };
  const sumDisp = vertexDisplacementNode().toVar();

  // THE SEA IS CURVED: see EARTH_CURVE. The drop is about the camera.
  const curveR = vec2(positionLocal.x.add(sumDisp.x).add(uCenter.x), positionLocal.z.add(sumDisp.z).add(uCenter.y))
    .sub(vec2(cameraPosition.x, cameraPosition.z));
  const displaced = vec3(
    positionLocal.x.add(sumDisp.x),
    sumDisp.y.sub(dot(curveR, curveR).mul(tune.curve)),
    positionLocal.z.add(sumDisp.z),
  );

  const vWorld = varying(displaced.add(vec3(uCenter.x, 0, uCenter.y)), 'vWorldPos');
  const vFade = varying(fade, 'vFade');
  /**
   * The UNDISPLACED grid position, carried separately.
   *
   * This is a correctness fix, not an optimization. The first draft sampled
   * the normal buffer at the DISPLACED world position, which is a different
   * point on the sea: horizontal displacement moves a crest several meters
   * sideways, so every normal was read from the wrong place. The result was a
   * visibly over-smoothed surface — the fine chop was present in the field and
   * smeared away by the lookup.
   *
   * The fields are indexed by the grid coordinate. Sample them there.
   */
  const vSample = varying(worldFlat, 'vSampleXZ');

  /* --- fragment: shade -------------------------------------------- */

  const material = new THREE.MeshBasicNodeMaterial();
  material.positionNode = displaced;

  /* THE SEA FLOOR (oceanSeabed.ts, the caustics piece). Null for the open
   * sea, so a surface with no floor compiles and shades exactly as before. */
  let seabedReader: OceanSeabedReader | null = null;
  let reflectorReader: OceanReflectorReader | null = null;
  /* THE FOAM FIELD (oceanFoam.ts, the foam piece). Null for the fold-only
   * ramp, so a surface with no field compiles and shades exactly as before. */
  let foamReader: OceanFoamReader | null = null;

  // Getters preserve late attachment and every subsequent reader access during shader rebuilds.
  const shade = createSurfaceShade({ vFade, vRiverShare, vSample, vWorld, uOvercast, tune, cascades, uTime, uRainVar, n, mip, vRiverWarp, vRiverFlow, vRiverJ, vRockLee, vRiverLean, cascadeLod, vRiverSea, vRockSlope, uSun, opts, hsM, uCenter, uContactCount, uContacts, uDebug }, {
    get riverV() { return riverV; },
    get riverReader() { return riverReader; },
    get rockReader() { return rockReader; },
    get wakeReader() { return wakeReader; },
    get foamReader() { return foamReader; },
    get reflectorReader() { return reflectorReader; },
    get seabedReader() { return seabedReader; },
  });

  material.fragmentNode = shade();
  // TOP FACE ONLY. The underwater piece (oceanUnderwater.ts) draws the
  // underside as its own back-face mesh on this geometry; a double-sided
  // surface would paint its top shading over it. Tested before landing on the
  // fair, Water Pro, eye-level and two storm frames: at most 10 pixels of
  // 1,440,000 changed, by at most 14 of 255 (crest folds that now hide their
  // back face; no holes).
  material.side = THREE.FrontSide;
  // The shader hazes the far water into its own sky. A scene fog on top of
  // that is a second haze in a second color, which is what drew the old
  // hard bright horizon line.
  material.fog = false;

  const mesh = new THREE.Mesh(
    createOceanGridGeometry(opts.side ?? OCEAN_MESH_SIDE, opts.radiusM ?? OCEAN_RADIUS_M),
    material,
  );
  mesh.frustumCulled = false;

  return {
    dispatches: mip.dispatches,
    tune,
    get center() { return uCenter.value; },
    mesh,
    material,
    setWake(reader: OceanWakeReader | null) {
      wakeReader = reader;
      material.fragmentNode = shade();
      material.needsUpdate = true;
      displacementChanged();
    },
    vertexDisplacement,
    onDisplacementChange(cb: () => void) {
      displacementListeners.add(cb);
      return () => { displacementListeners.delete(cb); };
    },
    setSeabed(reader: OceanSeabedReader | null) {
      seabedReader = reader;
      material.fragmentNode = shade();
      material.needsUpdate = true;
    },
    setReflector(reader: OceanReflectorReader | null) {
      reflectorReader = reader;
      material.fragmentNode = shade();
      material.needsUpdate = true;
    },
    setFoam(reader: OceanFoamReader | null) {
      foamReader = reader;
      material.fragmentNode = shade();
      material.needsUpdate = true;
    },
    setRiver(reader: OceanRiverReader | null) {
      if (reader !== null && cascades.length > 4) {
        throw new Error(`[ocean] The river reader carries four band shares; this sea has ${cascades.length} cascades.`);
      }
      if (reader !== null && reader.bands.length !== cascades.length) {
        throw new Error(`[ocean] The river reader holds ${reader.bands.length} bands for a sea of ${cascades.length}.`);
      }
      riverReader = reader;
      riverV = reader === null ? null : riverVertex();
      material.fragmentNode = shade();
      material.needsUpdate = true;
      displacementChanged();
    },
    setRocks(reader: OceanRockReader | null) {
      if (reader !== null && cascades.length > 4) {
        throw new Error(`[ocean] The rock reader carries four band shares; this sea has ${cascades.length} cascades.`);
      }
      rockReader = reader;
      rockV = reader === null ? null : reader.sample(worldFlat);
      material.fragmentNode = shade();
      material.needsUpdate = true;
      displacementChanged();
    },
    setDebug(mode: number) {
      uDebug.value = mode;
    },
    setContact(i: number, xM: number, zM: number, rM: number, s: number) {
      if (!Number.isInteger(i) || i < 0 || i >= CONTACT_SLOTS) {
        throw new Error(`[ocean] Contact slot ${i} is outside 0..${CONTACT_SLOTS - 1}.`);
      }
      contacts[i].set(xM, zM, rM, s);
      let live = 0;
      for (let k = 0; k < CONTACT_SLOTS; k += 1) if (contacts[k].w > 0) live = k + 1;
      uContactCount.value = live;
    },
    setCenter(xM: number, zM: number) {
      uCenter.value.set(xM, zM);
      mesh.position.set(xM, 0, zM);
    },
    significantWaveHeightFt: oceanFeetFromMeters(hsM),
  };
}

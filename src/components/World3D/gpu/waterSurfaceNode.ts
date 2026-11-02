/**
 * @file waterSurfaceNode.ts — ADR 0009 step 4: the world water's depth tint as
 * a TSL node material, for the game world on WebGPURenderer (`?gpu=1`).
 *
 * `water/waterSurfaceMaterial.ts` is a shared factory with WebGL users on other
 * pages, so it stays as it is. Its `onBeforeCompile` reads the per-vertex depth
 * encoding that `waterGeometry` packs into the color attribute (red = opacity
 * ramp, green = color ramp) and writes:
 *
 *   diffuse  = mix(shallowColor, deepColor, color.g)
 *   alpha    = mix(SHALLOW_OPACITY, DEEP_OPACITY, color.r)
 *   emissive = emissive * emissiveIntensity * mix(0.15, 1.0, color.g)
 *
 * Under WebGPU that hook is ignored, so the water drew as the stock material:
 * one flat blue multiplied by the depth encoding as if it were a tint. This
 * file sets the same three results through `colorNode`, `opacityNode` and
 * `emissiveNode`. `vertexColors` is OFF on the node material because the GLSL
 * replaced the vertex-color multiply; the attribute is read directly instead.
 * Roughness, metalness, DoubleSide and the shared ripple texture are the WebGL
 * material's own values.
 *
 * MOVING, REFLECTING, FOAMING WATER (agora-257c, 2026-10-27). Remy saw the world
 * river as a flat blue band: no reflection, no foam, no flow. Three causes:
 *
 *   1. No flow. The ripple was the WebGL material's normal map, moved by
 *      `texture.offset`, which a node texture does not apply; and one scroll
 *      direction for all water cannot follow a river anyway. The ripple now
 *      flows along the per-vertex `flow` attribute (WaterMesh.flow, m/s) with
 *      the two-phase flow-map method: two copies of the ripple slide with the
 *      flow, each resets every cycle, and each fades out while it resets, so
 *      the pattern moves without stretching. TSL `time` drives it, so no JS
 *      driver is needed.
 *   2. No reflection. The world sets no environment map, so the surface showed
 *      the sun highlight and nothing else. The water now reflects the sky
 *      colors (`setWaterSkyColors`, fed by World3DLighting's gradient sky)
 *      by the Fresnel term: little when the eye looks down, most at a grazing
 *      view. The reflection also raises the opacity, as reflected light does
 *      over clear shallow water.
 *   3. No foam. Foam now gathers where the water is thin (the shoreline, from
 *      the raw depth in color.b) and where it runs fast (the flow speed), in a
 *      noise pattern that moves with the flow.
 */
import { Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, DoubleSide } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  Fn,
  abs,
  attribute,
  cameraPosition,
  clamp,
  dot,
  float,
  fract,
  length,
  materialEmissive,
  max,
  mix,
  normalMap,
  normalize,
  positionWorld,
  pow,
  reflect,
  smoothstep,
  texture,
  time,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import { riverFootprintDiscard } from './riverFootprintCut';
import { waterSky } from '../water/waterSkyState';
import { canopyFieldPlacement, canopyFieldTexture } from '../water/canopyHeightField';
import {
  getRippleNormalTexture,
  RIPPLE_METERS_PER_TILE,
  WATER_COLOR,
  WATER_DEEP_OPACITY,
  WATER_SHALLOW_COLOR,
  WATER_SHALLOW_OPACITY,
} from '../water/waterSurfaceMaterial';
import type { TslNode } from '@/types/tslNode';

type N = TslNode; // Shared TSL alias (GG-588): see src/types/tslNode.ts.

/** Seconds per flow-map cycle: long enough not to pulse, short enough not to stretch. */
const FLOW_CYCLE_S = 1.6;
/** The fine ripple layer: its scale against the coarse one, and its flow share. */
const FINE_SCALE = 2.6;
const FINE_FLOW = 1.3;
/** Raw depth (color.b = depth / 2.5 m) under which the shoreline foams: 0.2 m. */
const SHORE_FOAM_DEPTH = 0.08;
/** Flow speeds, m/s, over which fast water foams. */
const FAST_FOAM_FROM_MPS = 1.2;
const FAST_FOAM_FULL_MPS = 2.6;
/** World meters per tile of the foam noise. */
const FOAM_METERS_PER_TILE = 7;
/** Foam color: off-white with a little of the water in it. */
const FOAM_COLOR = '#dfe7e4';

/**
 * What a low reflected ray meets instead of the sky: banks, trees and far
 * land, a dark olive in their own shade (sRGB; see THE BANKS IN THE REFLECTION).
 */
const REFLECTED_SURROUND_COLOR = '#3b4431';

/**
 * What a reflected ray meets when it passes under a tree crown: foliage seen
 * from below and from its shaded side, darker than the lit canopy top (sRGB).
 */
const REFLECTED_CANOPY_COLOR = '#27321f';

/**
 * DEEP WATER IS DARK, AS THE LIVE RIVER'S IS (agora-257c, 2026-10-28). The
 * static water lit its deep body like a painted blue surface: a diffuse deep
 * blue plus a saturated blue glow (the material emissive, WATER_COLOR) that
 * grew with depth. Once the town river on 17,4 had real depth (4 to 5 m), it
 * read as a vivid blue band, about (8, 58, 103) sRGB, right beside the live
 * river (riverSite=world), whose deep water reads dark gray, about (65, 60,
 * 50) with its reflection. Remy asked for the two to match (one water).
 *
 * The live river's model (riverWaterMaterial.ts): light that enters deep
 * water is absorbed, and only a little scatters back, `uScatterClear` times
 * the sky's light. The static water now takes that model for its deep body:
 * the glow is DEEP_SCATTER times the sky irradiance and grows with the color
 * ramp, and the diffuse body color darkens to DEEP_BODY_COLOR (the same
 * scatter as an albedo). The shallow end is unchanged: silt-green, mostly
 * transparent, the bed showing through.
 */
/** Back-scattered share of the sky light from deep clear water (riverWaterMaterial `uScatterClear`, linear). */
const DEEP_SCATTER = [0.012, 0.02, 0.014] as const;
/** Deep water's diffuse color: the same back-scatter as an sRGB albedo (linear 0.012, 0.02, 0.014). */
const DEEP_BODY_COLOR = '#1d271f';
/**
 * Horizontal distances, meters, at which a reflected ray tests the canopy
 * field (water/canopyHeightField.ts). Dense near the water, where a bank tree
 * fills the most of the reflection; sparse far out. Past the last step the
 * low-bank surround band stands in for the far tree line.
 */
const CANOPY_MARCH_M = [1.5, 3, 4.5, 6, 8, 10, 12.5, 15, 18, 21.5, 25.5, 30, 35, 41, 48, 56, 65, 76, 90];

/**
 * Sky colors the water reflects. The uniforms hold the SAME Color objects that
 * World3DLighting writes through `setWaterSkyColors` (water/waterSkyState.ts),
 * so the GPU reads each new sky without this module being imported there.
 */
const skyZenith = uniform(waterSky.zenith);
const skyHorizon = uniform(waterSky.horizon);

let foamTexture: DataTexture | null = null;

/**
 * A tiling foam-noise texture: summed sines with whole wave numbers (so it
 * wraps), pushed through a curve so most of it is clear and the crests are
 * patches. One channel, stored in red.
 */
function getFoamNoiseTexture(): DataTexture {
  if (foamTexture) return foamTexture;
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const waves: Array<[number, number, number, number]> = [
    [3, 1, 1.0, 0.0],
    [-2, 4, 0.8, 1.3],
    [5, -3, 0.6, 2.1],
    [7, 6, 0.4, 0.7],
    [-9, 4, 0.3, 2.9],
    [11, -10, 0.2, 1.7],
  ];
  const TAU = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const [kx, ky, amp, phase] of waves) v += amp * Math.sin(TAU * ((kx * x + ky * y) / size) + phase);
      const t = Math.max(0, Math.min(1, (v / 3.3) * 0.5 + 0.5));
      const i = (y * size + x) * 4;
      data[i] = Math.round(t * t * 255);
      data[i + 1] = data[i];
      data[i + 2] = data[i];
      data[i + 3] = 255;
    }
  }
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  foamTexture = tex;
  return tex;
}

let material: MeshStandardNodeMaterial | null = null;

/** The shared node water material, one instance for every chunk. */
export function getWaterSurfaceNodeMaterial(): MeshStandardNodeMaterial {
  if (material) return material;
  const m = new MeshStandardNodeMaterial();
  m.color = new Color(WATER_COLOR);
  m.emissive = new Color(WATER_COLOR).multiplyScalar(0.55);
  m.emissiveIntensity = 0.5;
  // Kept for the shared contract (tests, probes); `normalNode` below wins.
  m.normalMap = getRippleNormalTexture();
  m.normalScale.set(0.9, 0.9);
  m.roughness = 0.12;
  m.metalness = 0.25;
  m.transparent = true;
  m.opacity = 1;
  m.side = DoubleSide;
  // The color attribute is a depth encoding, not a tint (see the header).
  m.vertexColors = false;

  const depth: N = attribute('color', 'vec3');
  const opacityRamp: N = depth.r;
  const colorRamp: N = depth.g;
  const rawDepth: N = depth.b;

  // ── Flow map ────────────────────────────────────────────────────────────
  // uv() is world x/z over RIPPLE_METERS_PER_TILE (World3DScene's WaterPiece),
  // so a flow in m/s becomes tiles per second by the same division.
  const flowM: N = attribute('flow', 'vec2');
  const speed: N = length(flowM);
  const flowUv: N = flowM.div(RIPPLE_METERS_PER_TILE);
  const cycle: N = time.div(FLOW_CYCLE_S);
  const phase0: N = fract(cycle);
  const phase1: N = fract(cycle.add(0.5));
  // Weight of copy 1: full when copy 0 resets (phase0 at 0 or 1), none mid-cycle.
  const blend: N = abs(phase0.mul(2).sub(1));
  // Still water keeps the old slow drift, so a lake is not dead flat.
  const drift: N = vec2(0.013, 0.021).mul(time);
  const ripple = getRippleNormalTexture();
  const base: N = uv();
  const sampleLayer = (scale: number, flowShare: number, offset: N): N => {
    const at = (phase: N, shift: N): N =>
      base.mul(scale).add(drift).add(shift).sub(flowUv.mul(scale * flowShare).mul(phase.mul(FLOW_CYCLE_S)));
    const a: N = texture(ripple, at(phase0, offset));
    const b: N = texture(ripple, at(phase1, offset.add(vec2(0.37, 0.61))));
    return mix(a, b, blend).xyz.mul(2).sub(1);
  };
  const coarse: N = sampleLayer(1, 1, vec2(0, 0));
  const fine: N = sampleLayer(FINE_SCALE, FINE_FLOW, vec2(0.21, 0.83));
  // Sum the slopes, keep the up axis: two layers read as water, one as a tile.
  const tangentN: N = normalize(vec3(coarse.x.add(fine.x.mul(0.6)), coarse.y.add(fine.y.mul(0.6)), coarse.z));
  m.normalNode = normalMap(tangentN.mul(0.5).add(0.5), vec2(0.9, 0.9));

  // ── Fresnel sky reflection ──────────────────────────────────────────────
  // World-space normal from the same slopes (uv x -> world x, uv y -> world z).
  // The ripple texture stores the normal itself (its x and z already carry the
  // minus of the slope), so the scale is positive.
  const worldN: N = normalize(vec3(tangentN.x.mul(0.9), float(1), tangentN.y.mul(0.9)));
  const toEye: N = normalize(cameraPosition.sub(positionWorld));
  const facing: N = clamp(dot(worldN, toEye), 0, 1);
  // Reflection only where there is water: the depth ramp scales it. A still
  // pool is drawn in grid strips whose edges run past the shoreline at zero
  // depth; reflection at full strength there lit the whole strip and turned
  // the wetland pools on 17,4 into pale blue rectangles (Remy, 2026-10-28).
  const fresnel: N = float(0.02).add(float(0.98).mul(pow(float(1).sub(facing), 5))).mul(opacityRamp);
  const bounce: N = reflect(toEye.negate(), worldN);
  const skyOnly: N = mix(skyHorizon, skyZenith, smoothstep(0.0, 0.6, bounce.y));
  // THE BANKS IN THE REFLECTION (agora-257c, 2026-10-28). A low reflected ray
  // does not reach the sky: it meets the banks, the trees and the far land.
  // With the pale sky horizon there, and the Fresnel term strongest at the
  // same grazing angles, every pond read as a white sheet of paper and the
  // rivers as white bands (Remy's walk). Under about 13 degrees of elevation
  // the reflection now takes the surround, hazed toward the sky horizon at
  // the horizon itself, where the far land fades into the haze.
  const surround: N = mix(uniform(new Color(REFLECTED_SURROUND_COLOR)), skyHorizon, float(1).sub(smoothstep(0.0, 0.05, bounce.y)).mul(0.5));
  const skyOrBanks: N = mix(surround, skyOnly, smoothstep(0.08, 0.22, bounce.y));
  // THE TREES IN THE REFLECTION (agora-257c, 2026-10-28, GG-528). The band
  // above models low banks only. A forest pond's banks hold trees 15 to 20 m
  // tall, which a real pond reflects up to 30 degrees and more. The ray now
  // walks across the canopy height field: where it passes under a crown at
  // one of the march steps, it reflects canopy. Steps are fixed distances, so
  // a lone thin tree between two far steps can be missed (a forest edge is
  // not); the open question is noted in the domain doc.
  const flatLen: N = max(length(bounce.xz), 0.001);
  const flatDir: N = bounce.xz.div(flatLen);
  const rise: N = bounce.y.div(flatLen);
  const fieldOrigin: N = uniform(canopyFieldPlacement);
  let canopyHit: N = float(0);
  for (const d of CANOPY_MARCH_M) {
    const at: N = positionWorld.xz.add(flatDir.mul(d));
    const top: N = texture(canopyFieldTexture, at.sub(fieldOrigin.xy).mul(fieldOrigin.z)).level(float(0)).r;
    const rayY: N = positionWorld.y.add(rise.mul(d));
    canopyHit = max(canopyHit, smoothstep(-0.4, 0.4, top.sub(rayY)));
  }
  const sky: N = mix(skyOrBanks, uniform(new Color(REFLECTED_CANOPY_COLOR)), canopyHit);

  // ── Foam ────────────────────────────────────────────────────────────────
  const foamTex = getFoamNoiseTexture();
  const foamUv: N = positionWorld.xz.div(FOAM_METERS_PER_TILE);
  const foamFlow: N = flowM.div(FOAM_METERS_PER_TILE);
  const foamA: N = texture(foamTex, foamUv.sub(foamFlow.mul(phase0.mul(FLOW_CYCLE_S)))).r;
  const foamB: N = texture(foamTex, foamUv.add(vec2(0.5, 0.25)).sub(foamFlow.mul(phase1.mul(FLOW_CYCLE_S)))).r;
  const foamNoise: N = mix(foamA, foamB, blend);
  // Shore foam is the line where MOVING water meets its bank. Still sheets are
  // thin all over (a hydrology stream cell, a puddle-deep lake edge), and on
  // 12,6 foam by depth alone turned a town square's sheet into one white field.
  const shoreFoam: N = float(1)
    .sub(smoothstep(0, SHORE_FOAM_DEPTH, rawDepth))
    .mul(smoothstep(0.05, 0.3, speed));
  const fastFoam: N = smoothstep(FAST_FOAM_FROM_MPS, FAST_FOAM_FULL_MPS, speed);
  // The shoreline is a broken line; fast water carries patches.
  const foam: N = clamp(
    max(shoreFoam.mul(smoothstep(0.1, 0.45, foamNoise)), fastFoam.mul(smoothstep(0.35, 0.7, foamNoise))),
    0,
    1,
  ).mul(0.85);

  // ADR 0009 step 6, slice 10: the static water ribbon is dropped inside the
  // live river's footprint, where the live water draws (riverFootprintCut.ts).
  m.colorNode = Fn(() => {
    riverFootprintDiscard();
    // The deep end is the live river's dark body (see DEEP WATER IS DARK);
    // WATER_DEEP_COLOR stays the WebGL material's deep color.
    const water: N = mix(uniform(new Color(WATER_SHALLOW_COLOR)), uniform(new Color(DEEP_BODY_COLOR)), colorRamp);
    return mix(water, uniform(new Color(FOAM_COLOR)), foam);
  })();
  const bodyOpacity: N = mix(WATER_SHALLOW_OPACITY, WATER_DEEP_OPACITY, opacityRamp);
  // Reflected light covers the bed as opacity would; foam is opaque.
  m.opacityNode = max(bodyOpacity.add(float(1).sub(bodyOpacity).mul(fresnel)), foam);
  // A constant emissive over a depth-faded surface lights the transparent
  // margin as brightly as the channel; fade it with the water it belongs to.
  // The reflected sky rides the emissive, so it holds in the water's shade.
  //
  // The body glow: the shallow end keeps the old faint glow (15 % of the
  // material emissive) and the deep end takes the live river's back-scatter
  // of the sky light (see DEEP WATER IS DARK). The old glow rose to 100 % in
  // the deep channel, which is what painted deep water saturated blue.
  const skyIrradiance: N = mix(skyHorizon, skyZenith, 0.5);
  const deepGlow: N = vec3(DEEP_SCATTER[0], DEEP_SCATTER[1], DEEP_SCATTER[2]).mul(skyIrradiance);
  const bodyGlow: N = mix((materialEmissive as N).mul(0.15), deepGlow, colorRamp);
  m.emissiveNode = bodyGlow
    .mul(float(1).sub(foam))
    .add(sky.mul(fresnel));

  material = m;
  return m;
}

/** Test seam: drop the cached material so a fresh one is built. */
export function resetWaterSurfaceNodeMaterialForTest(): void {
  material?.dispose();
  material = null;
  foamTexture?.dispose();
  foamTexture = null;
}

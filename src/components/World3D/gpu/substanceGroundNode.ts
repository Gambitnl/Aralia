/**
 * @file substanceGroundNode.ts — ADR 0009 step 4: the substance-true ground
 * (`terrain/substanceGroundMaterial.ts`) as a TSL node material, for the game
 * world on WebGPURenderer (`?gpu=1`).
 *
 * The WebGL material is nine critic rounds of GLSL injected through
 * `onBeforeCompile`. Under WebGPU that hook is ignored without a message, and
 * the volume-ground bubble under the player drew as one flat white
 * `MeshStandardMaterial` (the plaza ground in the step-1 shots). The GLSL file
 * stays as it is: it has WebGL users on the battle map arena, the land-type
 * swatches and the `?step=volume` sandbox. This file is its node twin:
 *
 * - the same hash and value noise (`vgHash`, `vgNoise`), the same two rotated
 *   octave frames (the Euler angles are imported from the GLSL module);
 * - the weathered TOP (continuous noise, per-tile tint through `aTint`);
 * - the CUT face per VOXEL CELL: cell id snapped behind the face, hard band
 *   steps at the jittered cell depth, roots, stones, bedrock beds, glints, the
 *   quarter-cell chip cascade and the sixteenth-cell grit, the cut damp, the
 *   distance-invariant edge lift and the baked occupancy AO;
 * - the normal: cell-snapped facets on cut faces and the rotated-frame
 *   perturbation, both gated as in the GLSL;
 * - the roughness: `roughness * mix(0.85, 1.0, gCut)`.
 *
 * The band loop is unrolled in JS over the stack length, which is exactly what
 * the GLSL's `if (i >= uBandCount) break;` selects. The band tables are
 * constants per material instead of uniforms; they never change after
 * construction in the GLSL either.
 *
 * HOST CONTRACT, unchanged: `VolumeGroundBubble.aimMaterial` writes
 * `userData.shader.uniforms.{uShift,uGridOrigin,uCellM,uTintMix}.value`. The
 * node material exposes its uniform nodes under those names, and a uniform
 * node's `.value` is the same write.
 *
 * FRAME NOTE. The GLSL perturbs the VIEW-space normal after
 * `normal_fragment_begin`, which has already flipped it for a back face
 * (`faceDirection`). On the node path the renderer multiplies `normalNode` by
 * `faceDirection` afterwards, so this file flips first, perturbs, then flips
 * back; the product is the GLSL's normal on both faces.
 */
import { DoubleSide, Euler, Matrix3, Matrix4, Vector3 } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  Fn,
  If,
  abs as tslAbs,
  attribute,
  cameraViewMatrix,
  clamp,
  dot,
  faceDirection,
  float,
  floor,
  fract,
  fwidth,
  length,
  materialRoughness,
  max as tslMax,
  mix,
  normalView,
  normalize as tslNormalize,
  oneMinus,
  positionGeometry,
  pow,
  smoothstep,
  step,
  uniform,
  varying,
  vec3,
  vec4,
} from 'three/tsl';
import {
  substance,
  cutGrainFor,
  cutAuxFor,
  DEFAULT_STACK,
  type GroundBand,
} from '@/systems/worldforge/terrain/materials';
import {
  CUT_ENGAGE_RAMP_M,
  CUT_ENGAGE_START_CELLS,
  CUT_FACET_SNAP,
  MAX_BANDS,
  SUBSTANCE_OCTAVE_EULERS,
} from '../terrain/substanceGroundMaterial';

/* eslint-disable @typescript-eslint/no-explicit-any */
type N = any;

/** `vgHash(vec3)`: the GLSL's sin-free hash. */
const vgHash = Fn(([p0]: [N]) => {
  const p = fract(p0.mul(0.1031)).toVar();
  p.addAssign(dot(p, p.yzx.add(33.33)));
  return fract(p.x.add(p.y).mul(p.z));
});

/** `vgNoise(vec3)`: trilinear value noise with a smoothstep fade. */
const vgNoise = Fn(([x]: [N]) => {
  const i = floor(x);
  const f0 = fract(x);
  const f = f0.mul(f0).mul(float(3.0).sub(f0.mul(2.0)));
  const h = (dx: number, dy: number, dz: number) => vgHash(i.add(vec3(dx, dy, dz)));
  return mix(
    mix(mix(h(0, 0, 0), h(1, 0, 0), f.x), mix(h(0, 1, 0), h(1, 1, 0), f.x), f.y),
    mix(mix(h(0, 0, 1), h(1, 0, 1), f.x), mix(h(0, 1, 1), h(1, 1, 1), f.x), f.y),
    f.z,
  );
});

/** The GLSL's `mat3` octave frame from Euler angles, as a constant mat3 uniform. */
function rotationUniform(e: readonly [number, number, number]): N {
  const m4 = new Matrix4().makeRotationFromEuler(new Euler(e[0], e[1], e[2]));
  return uniform(new Matrix3().setFromMatrix4(m4));
}

export interface SubstanceGroundNodeUniforms {
  uShift: { value: Vector3 };
  uGridOrigin: { value: Vector3 };
  uCellM: { value: number };
  uTintMix: { value: number };
}

/**
 * The node twin of `makeSubstanceGroundMaterial(stack)`.
 *
 * `userData.shader.uniforms` carries the four live uniforms under the GLSL
 * names, so `VolumeGroundBubble.aimMaterial` drives both materials the same way.
 */
export function makeSubstanceGroundNodeMaterial(
  stack: readonly GroundBand[] = DEFAULT_STACK,
): MeshStandardNodeMaterial {
  // The band tables, built exactly as the GLSL factory builds its uniforms.
  const depths = new Array<number>(MAX_BANDS).fill(1e9);
  const colors: Vector3[] = [];
  const grains: Vector3[] = [];
  const auxes: Vector3[] = [];
  for (let i = 0; i < MAX_BANDS; i++) {
    const band = stack[Math.min(i, stack.length - 1)];
    const s = substance(band.substance);
    const g = cutGrainFor(s);
    const a = cutAuxFor(s);
    if (i < stack.length) {
      depths[i] = Number.isFinite(band.depthM) ? band.depthM : 1e9;
    }
    colors.push(new Vector3(s.rgb[0], s.rgb[1], s.rgb[2]));
    grains.push(new Vector3(g.freqPerM, g.amp, g.speckle));
    auxes.push(new Vector3(a.rootiness, a.banding, 0));
  }
  const bandCount = Math.min(stack.length, MAX_BANDS);
  const v3 = (v: Vector3): N => vec3(v.x, v.y, v.z);

  const m = new MeshStandardNodeMaterial();
  m.roughness = 1;
  m.side = DoubleSide;

  const uShift = uniform(new Vector3());
  const uGridOrigin = uniform(new Vector3());
  const uCellM = uniform(1);
  const uTintMix = uniform(0);
  m.userData.shader = {
    uniforms: { uShift, uGridOrigin, uCellM, uTintMix } as unknown as SubstanceGroundNodeUniforms,
  };

  const ROT2 = rotationUniform(SUBSTANCE_OCTAVE_EULERS[1]);
  const ROT3 = rotationUniform(SUBSTANCE_OCTAVE_EULERS[2]);

  // The varyings: the GLSL's vCutDepth, vAO, vTint, vWPos, vNrmW.
  const vCutDepth: N = attribute('aCutDepth', 'float');
  const vAO: N = attribute('aAO', 'float');
  const vTint: N = attribute('aTint', 'vec3');
  const vWPos: N = varying((positionGeometry as N).add(uShift), 'vAraliaSgWPos');
  const vNrmW: N = attribute('normal', 'vec3');

  // Shared between the color, normal and roughness stages (the GLSL globals).
  // Meters of world per screen pixel: the level-of-detail signal.
  const pfp: N = tslMax(length(fwidth(vWPos)), 1e-5).toVar('araliaSgPfp');
  const gCut: N = smoothstep(
    uCellM.mul(CUT_ENGAGE_START_CELLS),
    uCellM.mul(CUT_ENGAGE_START_CELLS).add(CUT_ENGAGE_RAMP_M),
    vCutDepth,
  ).toVar('araliaSgCut');
  // Edge = normal change per METER of surface, not per pixel.
  const gEdge: N = smoothstep(2.5, 7.0, length(fwidth(vNrmW)).div(pfp)).toVar('araliaSgEdge');

  m.colorNode = Fn(() => {
    const wp: N = vWPos;

    /* ------------------------- the weathered TOP ------------------------- */
    const wr2: N = ROT2.mul(wp);
    const wr3: N = ROT3.mul(wp);
    const g0 = grains[0];
    const macro: N = vgNoise(wp.mul(0.13).add(5.0)).mul(0.6).add(vgNoise(wr2.mul(0.033).add(2.0)).mul(0.4));
    const fineVis0: N = oneMinus(smoothstep(0.06, 0.5, pfp.mul(g0.x)));
    const tg1: N = vgNoise(wp.mul(g0.x));
    const tg2: N = vgNoise(wr2.mul(g0.x).mul(2.13).add(7.7));
    const tg3: N = vgNoise(wr3.mul(g0.x).mul(9.0).add(57.3));
    const tgrain: N = tg1.mul(0.65).add(tg2.mul(0.35));
    const topAlb: N = v3(colors[0])
      .mul(macro.sub(0.5).mul(0.55).add(1.0))
      .mul(tgrain.sub(0.5).mul(2.0).mul(g0.y).add(1.0))
      .mul(tg3.sub(0.5).mul(0.30).mul(fineVis0).add(1.0))
      .toVar();
    // The per-tile surface tint: a multiplier, so every octave above survives it.
    topAlb.mulAssign(mix(vec3(1.0), vTint, uTintMix));

    /* --------------------- the CUT face, per VOXEL CELL --------------------- */
    const cid: N = floor(wp.sub(uGridOrigin).div(uCellM).sub(vNrmW.mul(0.5)));
    const cp: N = uGridOrigin.add(cid.add(0.5).mul(uCellM));
    const h1: N = vgHash(cid.mul(0.731).add(3.1));
    const h2: N = vgHash(cid.mul(0.577).add(6.7));
    const cellDepth: N = tslMax(
      vCutDepth.add(wp.y.sub(cp.y)).add(h2.sub(0.5).mul(uCellM).mul(0.9)),
      0.0,
    ).toVar();
    // The band stack, a HARD step per band; unrolled over the stack length.
    let bandCol: N = v3(colors[0]);
    let bandGrain: N = v3(grains[0]);
    let bandAux: N = v3(auxes[0]);
    for (let i = 1; i < bandCount; i++) {
      const t: N = step(depths[i - 1], cellDepth);
      bandCol = mix(bandCol, v3(colors[i]), t);
      bandGrain = mix(bandGrain, v3(grains[i]), t);
      bandAux = mix(bandAux, v3(auxes[i]), t);
    }
    bandCol = bandCol.toVar();
    bandGrain = bandGrain.toVar();
    bandAux = bandAux.toVar();
    // The arm's-length handoff: per-cell swing hands off to the chip cascade.
    const closeVis: N = oneMinus(smoothstep(0.004, 0.010, pfp)).mul(smoothstep(0.3, 0.8, uCellM)).toVar();
    const cutAlb: N = bandCol
      .mul(h1.sub(0.5).mul(float(0.16).add(bandGrain.y.mul(0.35))).mul(oneMinus(closeVis.mul(0.45))).add(1.0))
      .toVar();
    // Warm/cool tilt from a low-frequency field at the cell center.
    const tiltN: N = vgNoise(cp.mul(0.33).add(13.0)).sub(0.5);
    cutAlb.mulAssign(vec3(tiltN.mul(0.11).add(1.0), 1.0, oneMinus(tiltN.mul(0.11))));
    // Large-scale shading sampled at the cell center.
    const cmacro: N = vgNoise(cp.mul(0.13).add(5.0)).mul(0.6).add(vgNoise(ROT2.mul(cp).mul(0.033).add(2.0)).mul(0.4));
    cutAlb.mulAssign(cmacro.sub(0.5).mul(0.4).add(1.0));
    // Roots: dark strands wandering across cells in living soil.
    If(bandAux.x.greaterThan(0.01), () => {
      const rn: N = vgNoise(vec3(cp.x.mul(1.1), cp.y.mul(2.3), cp.z.mul(1.1)).add(91.0));
      const strand: N = oneMinus(smoothstep(0.04, 0.09, tslAbs(rn.sub(0.5))));
      const rooty: N = bandAux.x.mul(clamp(oneMinus(cellDepth.mul(1.3)), 0.0, 1.0));
      cutAlb.assign(mix(cutAlb, vec3(0.016, 0.011, 0.006), strand.mul(rooty).mul(0.9)));
    });
    // Stones: discrete 1-3-cell blobs in mineral granular bands.
    If(
      bandAux.x.lessThan(0.01)
        .and(bandAux.y.lessThan(0.01))
        .and(bandGrain.z.greaterThan(0.2))
        .and(cellDepth.greaterThan(depths[0])),
      () => {
        const blob: N = vgNoise(cp.mul(float(0.5).div(uCellM)).add(42.0));
        If(blob.greaterThan(0.62), () => {
          cutAlb.assign(vec3(0.088, 0.086, 0.082).mul(h1.mul(0.60).add(0.70)));
        });
      },
    );
    // Bedrock beds: whole-cell bands in world Y with a slow warp.
    If(bandAux.y.greaterThan(0.01), () => {
      const bedTh: N = tslMax(uCellM.mul(2.0), 0.8);
      const warp: N = vgNoise(vec3(cp.x.mul(0.045), 1.0, cp.z.mul(0.045))).sub(0.5).mul(5.0);
      const bedC: N = cp.y.add(warp).div(bedTh).toVar();
      const bh: N = vgHash(vec3(floor(bedC).mul(0.373), 1.7, 2.9));
      cutAlb.mulAssign(bh.sub(0.5).mul(float(0.30).add(bandAux.y.mul(0.45))).add(1.0));
      // Band groups: every ~3 beds share one slow value shift.
      const bg: N = vgHash(vec3(floor(bedC.div(3.0)).mul(0.517), 4.3, 8.1));
      cutAlb.mulAssign(bg.sub(0.5).mul(0.30).add(1.0));
      If(fract(bedC).lessThan(0.12), () => {
        cutAlb.mulAssign(0.72);
      });
      // Rock is desaturated, never repainted, and tilted warm.
      cutAlb.assign(mix(cutAlb, vec3(dot(cutAlb, vec3(0.3333))), 0.22).mul(vec3(1.03, 1.0, 0.955)));
    });
    // Mineral glints in hard rock: sparse bright cells.
    If(bandGrain.z.greaterThan(0.35).and(bandAux.y.greaterThan(0.01)), () => {
      If(vgHash(cid.mul(0.419).add(27.0)).greaterThan(0.93), () => {
        cutAlb.addAssign(vec3(0.055, 0.052, 0.048));
      });
    });
    // The chip cascade: quarter-cell chips, faded by pixel footprint.
    const subM: N = uCellM.mul(0.25);
    const sid: N = floor(wp.sub(uGridOrigin).div(subM).sub(vNrmW.mul(0.5)));
    const subVis: N = oneMinus(smoothstep(0.30, 1.10, pfp.div(subM)));
    const ch1: N = vgHash(sid.mul(0.613).add(9.4)).toVar();
    const dq: N = floor(ch1.mul(4.0));
    cutAlb.mulAssign(dq.sub(1.5).div(1.5).mul(0.105).mul(subVis).add(1.0));
    const ch2: N = vgHash(sid.mul(0.379).add(17.2));
    cutAlb.mulAssign(ch2.sub(0.5).mul(float(0.16).add(bandGrain.y.mul(0.35))).mul(closeVis).add(1.0));
    cutAlb.mulAssign(
      vec3(
        ch1.sub(0.5).mul(0.09).mul(closeVis).add(1.0),
        1.0,
        oneMinus(ch1.sub(0.5).mul(0.09).mul(closeVis)),
      ),
    );
    // The grit: a sixteenth-cell quantized micro-grain.
    const gritM: N = uCellM.mul(0.0625);
    const gid: N = floor(wp.sub(uGridOrigin).div(gritM).sub(vNrmW.mul(0.5)));
    const gritVis: N = oneMinus(smoothstep(0.30, 1.10, pfp.div(gritM))).mul(smoothstep(0.3, 0.8, uCellM));
    const gq: N = floor(vgHash(gid.mul(0.613).add(9.4)).mul(4.0));
    cutAlb.mulAssign(gq.sub(1.5).div(1.5).mul(0.10).mul(gritVis).add(1.0));
    // A faint continuous tooth under it.
    const fineVis: N = oneMinus(smoothstep(0.03, 0.25, pfp));
    cutAlb.mulAssign(vgNoise(wr3.mul(13.0)).sub(0.5).mul(0.10).mul(fineVis).add(1.0));

    const alb: N = mix(topAlb, cutAlb, gCut).toVar();
    // Fresh-cut damp, mild.
    alb.mulAssign(mix(1.0, 0.88, gCut));
    alb.mulAssign(gEdge.mul(0.12).add(1.0));
    // Graded, never crushed: the baked occupancy AO.
    alb.mulAssign(mix(0.48, 1.0, pow(clamp(vAO, 0.0, 1.0), 1.1)));
    return alb;
  })();

  m.normalNode = Fn(() => {
    // The GLSL's `normal` after normal_fragment_begin: view-space, flipped on a
    // back face. The renderer multiplies by faceDirection again afterwards, so
    // the result is flipped back at the end.
    const normal: N = (normalView as N).mul(faceDirection).toVar();
    // Two noise reads, third channel derived, each in its own rotated frame,
    // faded with the pixel footprint.
    const pn1: N = vgNoise(ROT2.mul(vWPos).mul(5.0).add(11.3));
    const pn2: N = vgNoise(ROT3.mul(vWPos).mul(5.0).add(47.9));
    const pertVis: N = oneMinus(smoothstep(0.05, 0.35, length(fwidth(vWPos)).mul(5.0)));
    const pert: N = vec3(pn1, pn2, pn1.mul(pn2).mul(2.0)).sub(0.5);
    // Cell-snapped facets on cut faces, gated by gCut and CUT_FACET_SNAP.
    if (CUT_FACET_SNAP > 0.0) {
      If(gCut.greaterThan(0.0), () => {
        const cidN: N = floor(vWPos.sub(uGridOrigin).div(uCellM).sub(vNrmW.mul(0.5)));
        const nj: N = vec3(
          vgHash(cidN.mul(0.731).add(3.1)),
          vgHash(cidN.mul(0.577).add(6.7)),
          vgHash(cidN.mul(0.419).add(27.0)),
        ).sub(0.5);
        const qn: N = floor(tslNormalize(tslNormalize(vNrmW).add(nj.mul(0.35))).mul(2.0).add(0.5)).toVar();
        If(dot(qn, qn).greaterThan(1e-4), () => {
          const tn: N = tslNormalize(vNrmW);
          // Each facet biased a third of the way back toward the true normal,
          // and the swing clamped inside the cone.
          const fq: N = tslNormalize(mix(tslNormalize(qn), tn, 0.65)).toVar();
          const fd: N = dot(fq, tn);
          fq.assign(tslNormalize(mix(fq, tn, clamp(float(0.62).sub(fd).mul(2.2), 0.0, 1.0))));
          // The facet goes through the view matrix first (frame match).
          const fqV: N = tslNormalize(cameraViewMatrix.mul(vec4(fq, 0.0)).xyz);
          normal.assign(tslNormalize(mix(normal, fqV, float(CUT_FACET_SNAP).mul(gCut))));
        });
      });
    }
    // On faceted cut faces the random perturbation halves.
    normal.assign(
      tslNormalize(
        normal.add(pert.mul(pertVis.mul(0.30).add(gEdge.mul(0.85))).mul(oneMinus(gCut.mul(0.5)))),
      ),
    );
    return normal.mul(faceDirection);
  })();

  m.roughnessNode = (materialRoughness as N).mul(mix(0.85, 1.0, gCut));

  return m;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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
 * Each sample is four reads and three mixes. Three cascades, two buffers each,
 * makes 24 reads per sample point. That is the price of keeping the whole
 * pipeline in buffers, and it is measured in the perf gate rather than
 * guessed at.
 */
import * as THREE from 'three/webgpu';
import {
  Fn,
  bitAnd,
  cameraPosition,
  clamp,
  dot,
  float,
  floor,
  fract,
  int,
  max,
  mix,
  normalize,
  positionLocal,
  pow,
  reflect,
  smoothstep,
  storage,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type { CascadeParams } from './oceanConfig';
import { log2Exact } from './oceanConfig';
import type { OceanGpuBuffers } from './oceanCompute';
import { oceanFeetFromMeters } from './oceanUnits';

/**
 * How far the mesh reaches, meters.
 *
 * 9 km is the true geometric horizon from a 9 m deck on an Earth-sized world
 * (sqrt(2 R h) = 10.7 km). Reaching past it would draw water the curve of the
 * world hides.
 */
export const OCEAN_RADIUS_M = 9000;

/** Vertices per side of the warped grid. */
export const OCEAN_MESH_SIDE = 512;

/**
 * The warp exponent.
 *
 * Vertex spacing at distance x goes as x^(1 - 1/p), so a higher p buys near
 * detail at the cost of far detail. Measured on the 512 grid at 9 km:
 *
 *   p = 2   ->  5 m spacing at 50 m out.  The 45 m wind-sea peak gets 9
 *               samples and the chop below 10 m is lost. It looked smeared.
 *   p = 3   ->  3.3 m at 50 m, 0.24 m at 1 m, 15 m at 500 m. The near water
 *               resolves and the far water is inside the detail fade anyway.
 */
export const OCEAN_WARP_POWER = 3;

/**
 * A warped grid, dense at the center and sparse at the rim.
 *
 * The stored position is already in WORLD meters on the XZ plane, so the
 * vertex stage does no unwarping.
 */
export function createOceanGridGeometry(
  side = OCEAN_MESH_SIDE,
  radiusM = OCEAN_RADIUS_M,
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
      const o = (j * verts + i) * 3;
      pos[o] = x;
      pos[o + 1] = 0;
      pos[o + 2] = z;
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
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radiusM * 1.5);
  return g;
}

/**
 * A TSL node expression.
 *
 * three 0.172 does not export `ShaderNodeObject` from `three/tsl`, and the
 * concrete node classes differ per expression — `vec2(a, b)` is a JoinNode
 * while `vec2(a, b).add(c)` is an OperatorNode. Naming one of them in a helper
 * signature rejects the other. This alias is the honest statement that the
 * shape is not expressible with the types this version ships.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TslNode = any;

export interface OceanSurface {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.NodeMaterial;
  /** Move the patch with the ship so the dense center follows the camera. */
  setCenter(xM: number, zM: number): void;
  /** 0 renders water; 1..5 isolate Jacobian, foam, normal, height, specular. */
  setDebug(mode: number): void;
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
  opts: { side?: number; radiusM?: number; sunDir?: THREE.Vector3 } = {},
): OceanSurface {
  const n = bufs.n;
  // Validates that n is radix-2 before any index math assumes it.
  log2Exact(n);
  const cells = n * n;

  const disp = storage(bufs.disp, 'vec4', bufs.disp.count).toReadOnly();
  const norm = storage(bufs.norm, 'vec4', bufs.norm.count).toReadOnly();

  const uCenter = uniform(new THREE.Vector2(0, 0));
  const sun = opts.sunDir ?? new THREE.Vector3(0.42, 0.30, -0.85).normalize();
  const uSun = uniform(sun);
  /**
   * Debug channel. 0 renders water; the rest isolate one term.
   *
   * This exists because the first look at the sea showed a white sheet in the
   * foreground and no way to tell whether it was foam, glitter or scattering.
   * Guessing at that costs more than a uniform.
   *
   *   1 folding Jacobian   2 foam mask   3 normal   4 height   5 specular
   */
  const uDebug = uniform(0);

  /**
   * Bilinear read of a cascade plane at a world XZ position.
   *
   * The index wrap is a mask, not a modulo: the grid edge is a power of two,
   * and TSL's integer `.mod()` miscompiles to WGSL silently. A negative index
   * masks correctly in two's complement, which is exactly the wrap wanted.
   */
  const sampleCascade = (
    buf: TslNode,
    world: TslNode,
    cascadeIdx: number,
    patchM: number,
  ): TslNode => {
    const texel = world.div(float(patchM)).mul(float(n));
    const base = floor(texel);
    const f = fract(texel);

    const ix = int(base.x);
    const iz = int(base.y);
    const m = int(n - 1);
    const x0 = bitAnd(ix, m);
    const x1 = bitAnd(ix.add(int(1)), m);
    const z0 = bitAnd(iz, m);
    const z1 = bitAnd(iz.add(int(1)), m);
    const off = int(cascadeIdx * cells);

    const at = (xi: TslNode, zi: TslNode) => buf.element(
      off.add(bitAnd(zi, m).mul(int(n))).add(xi),
    );

    const a = at(x0, z0);
    const b = at(x1, z0);
    const c = at(x0, z1);
    const d = at(x1, z1);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  };

  /**
   * The distance roll-off for one cascade.
   *
   * Beyond `startM` the mesh spacing exceeds that cascade's wave scale, so the
   * contribution is rolled off rather than aliased. Each cascade carries its
   * own range and its own floor: the ripple is gone by 48 m, the swell keeps
   * 60% of itself forever, because a 126 m wave is still resolvable at 3 km.
   */
  const cascadeLod = (world: TslNode, lod: CascadeParams['dispLod']): TslNode => {
    const r = world.sub(uCenter).length();
    const k = float(1).sub(smoothstep(float(lod.startM), float(lod.endM), r));
    return k.mul(float(1 - lod.floor)).add(float(lod.floor));
  };

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
  let dispAcc: TslNode | null = null;
  for (let ci = 0; ci < cascades.length; ci += 1) {
    const d = sampleCascade(disp, worldFlat, ci, cascades[ci].patchM)
      .xyz.mul(cascadeLod(worldFlat, cascades[ci].dispLod));
    dispAcc = dispAcc === null ? d : dispAcc.add(d);
  }
  const sumDisp = (dispAcc as TslNode).toVar();

  const displaced = vec3(
    positionLocal.x.add(sumDisp.x),
    sumDisp.y,
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

  const shade = Fn(() => {
    const f = vFade;

    // Combine cascades by summing SLOPES. n is stored as (nx, nz, ny); ny is
    // the folding Jacobian, and it goes to zero on a fold, so it is floored
    // before the divide. That floor is a guard on a genuine singularity, not
    // a stand-in for the real value.
    //
    // NORMALS OUTLIVE GEOMETRY. Each cascade fades on its own NORMAL range,
    // which reaches much further than its displacement range: a fragment can
    // shade a 0.3 m ripple long after the mesh has stopped being able to bend
    // into one. That is the whole reason the third cascade fixes the
    // water-level view — the near sea gains surface texture, not just shape.
    let slopeAcc: TslNode | null = null;
    // The folding Jacobians of the steep cascades, combined by ADDING THEIR
    // DEFICITS. See `drivesFoam` in oceanConfig for the measurement that
    // justifies the linearization. Each deficit carries its own range fade, so
    // foam does not survive past the range where its cascade is resolvable.
    let foamDeficit: TslNode | null = null;
    for (let ci = 0; ci < cascades.length; ci += 1) {
      const c = cascades[ci];
      const nc = sampleCascade(norm, vSample, ci, c.patchM).toVar();
      const lod = cascadeLod(vSample, c.normalLod).toVar();
      const s = vec2(nc.x, nc.y).div(max(nc.z, float(0.08))).mul(lod);
      slopeAcc = slopeAcc === null ? s : slopeAcc.add(s);
      if (c.drivesFoam) {
        const d = float(1).sub(nc.z).mul(lod);
        foamDeficit = foamDeficit === null ? d : foamDeficit.add(d);
      }
    }
    const foamJac = float(1).sub(foamDeficit as TslNode);
    const slope = (slopeAcc as TslNode).toVar();
    const nrm = normalize(vec3(slope.x, float(1), slope.y)).toVar();

    const viewDir = normalize(cameraPosition.sub(vWorld)).toVar();
    const cosView = clamp(dot(nrm, viewDir), float(0), float(1)).toVar();

    // Schlick fresnel at the water/air interface. F0 = 0.02 for water.
    const fres = float(0.02).add(float(0.98).mul(pow(float(1).sub(cosView), float(5))));

    // A cheap analytic sky: horizon haze below, deep blue above.
    const refl = reflect(viewDir.negate(), nrm).toVar();
    const up = clamp(refl.y, float(0), float(1));
    const sky = mix(vec3(0.58, 0.68, 0.80), vec3(0.10, 0.28, 0.62), pow(up, float(0.5)));

    // Sun glitter.
    //
    // THE LOBE WIDENS WITH DISTANCE, and that is not a style choice. Near the
    // camera each pixel covers a fraction of a wavelet and a tight lobe is
    // correct. Far away one pixel covers many wavelets whose normals point
    // everywhere, and the correct answer is their AVERAGE — a broad sheen. A
    // tight lobe out there samples one normal out of thousands and flickers,
    // which is the sparkle crawl that gives cheap water away.
    const dist0 = vec2(vWorld.x, vWorld.z).sub(uCenter).length().toVar();
    const wide = smoothstep(float(150), float(3000), dist0).toVar();
    const specPow = mix(float(360), float(28), wide);
    const specGain = mix(float(3.2), float(0.5), wide);
    const spec = pow(clamp(dot(refl, uSun), float(0), float(1)), specPow).mul(specGain);

    // Subsurface: light passes through a crest and comes back green. Keyed to
    // height and to how much the crest faces away from the sun.
    const hNorm = clamp(vWorld.y.div(float(hsM * 0.9)), float(-1), float(1));
    const sss = clamp(hNorm, float(0), float(1))
      .mul(clamp(float(1).sub(dot(nrm, uSun)), float(0), float(1)))
      .mul(float(0.55));

    const deep = vec3(0.008, 0.045, 0.075);
    const shallow = vec3(0.06, 0.31, 0.32);
    const body = mix(deep, shallow, sss);

    // Foam where the surface folds.
    //
    // ONLY THE WIND SEA CAN FOLD. The swell's Jacobian was measured on the
    // CPU across the whole choppiness range and never falls below 0.82: a
    // 126 m wave 3 m high is not steep enough to break. Multiplying the two
    // Jacobians together would only dilute the signal that matters.
    //
    // The 0.60-to-0.38 ramp is measured, not guessed. At the shipped
    // choppiness the wind-sea Jacobian passes 0.60 across 2.1% of the surface
    // and 0.50 across 0.4%. A first pass used a 0.72 threshold, which whitened
    // 7.4% and read as surf rather than as whitecaps.
    const jac = foamJac.mul(f).add(float(1).sub(f)).toVar();
    const foam = smoothstep(float(0.60), float(0.38), jac).mul(f);

    const water = mix(body, sky, fres).add(vec3(spec, spec, spec));
    const col = mix(water, vec3(0.86, 0.90, 0.92), foam.mul(0.85)).toVar();

    const jacView = vec3(clamp(jac, float(0), float(1)));
    const foamView = vec3(foam);
    const nrmView = nrm.mul(float(0.5)).add(float(0.5));
    const hView = vec3(clamp(vWorld.y.div(float(hsM)).mul(0.5).add(0.5), float(0), float(1)));
    const specView = vec3(clamp(spec, float(0), float(1)));
    const dbg = uDebug;
    const shown = mix(
      col,
      mix(
        jacView,
        mix(foamView, mix(nrmView, mix(hView, specView, clamp(dbg.sub(4), float(0), float(1))), clamp(dbg.sub(3), float(0), float(1))), clamp(dbg.sub(2), float(0), float(1))),
        clamp(dbg.sub(1), float(0), float(1)),
      ),
      clamp(dbg, float(0), float(1)),
    );

    // Distance haze so the horizon resolves into sky instead of ending.
    const haze = smoothstep(float(2500), float(8600), dist0);
    return vec4(mix(shown, vec3(0.66, 0.73, 0.82), haze.mul(float(1).sub(clamp(uDebug, float(0), float(1))))), float(1));
  });

  material.fragmentNode = shade();
  material.side = THREE.DoubleSide;

  const mesh = new THREE.Mesh(
    createOceanGridGeometry(opts.side ?? OCEAN_MESH_SIDE, opts.radiusM ?? OCEAN_RADIUS_M),
    material,
  );
  mesh.frustumCulled = false;

  return {
    mesh,
    material,
    setDebug(mode: number) {
      uDebug.value = mode;
    },
    setCenter(xM: number, zM: number) {
      uCenter.value.set(xM, zM);
      mesh.position.set(xM, 0, zM);
    },
    significantWaveHeightFt: oceanFeetFromMeters(hsM),
  };
}

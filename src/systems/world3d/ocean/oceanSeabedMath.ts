/**
 * @file oceanSeabedMath.ts — the CPU side of the sea floor: the water's
 * optics, the refraction of the sun into the water, the caustic layers, the
 * bathymetry, and the light that comes back up out of shallow water.
 *
 * WHY A SEPARATE FILE. `oceanSeabed.ts` builds GPU objects and imports
 * `three/webgpu`. A test that imports it must start a renderer to reach a
 * function that only does arithmetic. So the arithmetic lives here, with no
 * three import, as `oceanRainMath.ts` does for the rain. Each GPU formula in
 * `oceanSeabed.ts` that has a twin here names it, and the tests hold the twin.
 *
 * WHAT THE PIECE IS. Shallow water over a sandy floor, seen from above: the
 * floor seen through the water and bent by the waves, a moving web of caustic
 * light on it, and the water turning from pale turquoise over shallow sand to
 * deep blue where the floor falls away. Two effects make the color, and both
 * are measured water optics, not a painted gradient:
 *
 *   1. Water absorbs red light fast and blue light slowly (Pope and Fry 1997).
 *      White sand seen through a few meters of clear water loses most of its
 *      red on the way down and on the way back up, and what is left is
 *      turquoise. Deeper, the green goes too, and the floor fades into the
 *      water's own deep blue.
 *   2. The waves are lenses. Each short wave focuses the sun a few meters
 *      under it, and the floor at that depth shows a web of bright lines that
 *      moves with the waves. The web is computed from the real wave normals
 *      (see `oceanSeabed.ts`), not scrolled from a texture.
 *
 * UNITS. Metric, internal only, as every file under `ocean/` (see the unit
 * rule in `oceanConfig.ts`). Depths are positive meters below the mean sea
 * level y = 0.
 */

import type { CascadeParams } from './oceanConfig';
import { directionalSpectrum } from './oceanSpectrum';

/** A 3-vector, as a plain tuple so this file needs no three import. */
export type V3 = readonly [number, number, number];

/* ------------------------------------------------------------------ */
/* Water optics                                                        */
/* ------------------------------------------------------------------ */

/**
 * Refractive index of sea water, visible light. Pure water is 1.333 at 589 nm
 * and 20 C; salt adds about 0.006 at 35 PSU (Quan and Fry 1995). 1.339 bends
 * a vertical sun's slope into the water by 1 - 1/1.339 = 0.253 of the slope.
 */
export const WATER_IOR = 1.339;

/**
 * Per-channel attenuation of clear tropical lagoon water, per meter of PATH,
 * for the red, green and blue channels (about 600, 550 and 465 nm).
 *
 * `downPerM` attenuates the light that goes DOWN to the floor (the sun beam
 * and the skylight). Green and blue are the absorption of pure water (Pope
 * and Fry 1997: 0.0565 at 550 nm, 0.0120 at 465) plus a small back-scatter
 * and the dissolved matter of clear coastal water, Jerlov's type IB diffuse
 * attenuation (0.069 and 0.027 per meter; Jerlov 1976, as tabulated by
 * Solonenko and Mobley 2015) over the mean cosine of the light: 0.065 and
 * 0.03 per meter of path. RED IS THE CHANNEL, NOT ONE WAVELENGTH: the
 * camera's red spans about 580 to 700 nm, where pure water absorbs 0.09
 * (580), 0.24 (600), 0.35 (650) and 0.65 (700) per meter, so over the one to
 * five meters of a lagoon the channel loses light at about 0.3 to 0.4 per
 * meter (the long end dies in the first meter, and what is left is harder).
 * 0.34. At Pope and Fry's 600 nm value alone (0.27) the sand at 2.5 m read
 * (94, 146, 137) sRGB from above, greyer than the reference's turquoise
 * (63 to 99, 141 to 167, 141 to 165); at 0.42 it matched from above and the
 * sand one meter under the eye lost its warmth. 0.34 is between the two
 * (`caustics/calibrate.ts` and `cmp-c17-c18.png` in the gauntlet scratch).
 *
 * `upPerM` attenuates the IMAGE of the floor on its way back up. Forward
 * scattering blurs light out of the image as well as absorbing it, so it is
 * the beam attenuation a + b, not the diffuse one: clear lagoon water has a
 * scattering of about 0.02 to 0.05 per meter (Petzold 1972, clear ocean
 * 0.037), so 0.36, 0.09 and 0.05.
 */
export interface WaterOptics {
  readonly downPerM: V3;
  readonly upPerM: V3;
}

export const LAGOON_WATER: WaterOptics = {
  downPerM: [0.34, 0.065, 0.03],
  upPerM: [0.36, 0.09, 0.05],
};

/**
 * Transmittance of a path through the water, per channel: Beer-Lambert.
 * The GPU twin is `pathTransmit` in oceanSeabed.ts.
 */
export function transmittance(perM: V3, pathM: number): V3 {
  const l = Math.max(pathM, 0);
  return [Math.exp(-perM[0] * l), Math.exp(-perM[1] * l), Math.exp(-perM[2] * l)];
}

/* ------------------------------------------------------------------ */
/* Refraction                                                          */
/* ------------------------------------------------------------------ */

function dot3(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function norm3(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
}

/**
 * Snell's law in vector form, with the GLSL and WGSL `refract` semantics:
 * `i` is the unit incident direction (toward the surface), `n` the unit
 * normal on the incident side (dot(i, n) < 0), `eta` = n1 / n2. Returns null
 * on total internal reflection. The GPU uses WGSL's own `refract`; this twin
 * is for the tests and for the constants computed on the CPU below.
 */
export function refractDir(i: V3, n: V3, eta: number): V3 | null {
  const cosI = -dot3(i, n);
  const k = 1 - eta * eta * (1 - cosI * cosI);
  if (k < 0) return null;
  const a = eta;
  const b = eta * cosI - Math.sqrt(k);
  return [a * i[0] + b * n[0], a * i[1] + b * n[1], a * i[2] + b * n[2]];
}

/**
 * Fresnel transmittance of unpolarized light from air into water at an
 * incidence cosine `cosI`: 1 minus the mean of the s and p reflectances.
 * 0.980 at normal incidence, 0.977 for a sun 60 degrees up, 0.58 at 85
 * degrees from the vertical.
 */
export function fresnelTransmit(cosI: number, ior = WATER_IOR): number {
  const ci = Math.min(Math.max(cosI, 0), 1);
  const si2 = 1 - ci * ci;
  const st2 = si2 / (ior * ior);
  if (st2 >= 1) return 0;
  const ct = Math.sqrt(1 - st2);
  const rs = (ci - ior * ct) / (ci + ior * ct);
  const rp = (ior * ci - ct) / (ior * ci + ct);
  return 1 - 0.5 * (rs * rs + rp * rp);
}

/** The sun under a flat sea. */
export interface SunInWater {
  /** Unit direction the refracted beam TRAVELS in the water (y < 0). */
  readonly down: V3;
  /** Cosine of the sun's zenith angle in air. */
  readonly cosAir: number;
  /** Cosine of the refracted beam's zenith angle in the water. */
  readonly cosWater: number;
  /** Fresnel transmittance of the beam into the water. */
  readonly transmit: number;
  /**
   * Horizontal travel of the flat-sea beam per meter of depth, (x, z). The
   * caustic layers are stored relative to this mean offset; see
   * `causticTileShift`.
   */
  readonly offsetPerM: readonly [number, number];
}

/**
 * Refract the sun into a flat sea.
 *
 * @param sunDir unit vector TOWARD the sun (the sky module's convention).
 */
export function sunInWater(sunDir: V3, ior = WATER_IOR): SunInWater {
  const s = norm3(sunDir);
  if (s[1] <= 0) throw new Error('[ocean] The sun is below the horizon; the sea floor has no direct light.');
  const down = refractDir([-s[0], -s[1], -s[2]], [0, 1, 0], 1 / ior);
  // A ray from above always enters a denser medium, so this cannot be null.
  const d = down as V3;
  return {
    down: d,
    cosAir: s[1],
    cosWater: -d[1],
    transmit: fresnelTransmit(s[1], ior),
    offsetPerM: [d[0] / -d[1], d[2] / -d[1]],
  };
}

/**
 * Horizontal landing offset per meter of depth of the sun beam refracted by a
 * surface facet whose shading slope is `slope` (the surface's convention: the
 * normal is normalize(slope.x, 1, slope.y), so slope = -grad(h)).
 * The GPU twin is the landing point in the caustic pass of oceanSeabed.ts.
 */
export function beamOffsetPerM(sunDir: V3, slope: readonly [number, number], ior = WATER_IOR): [number, number] {
  const s = norm3(sunDir);
  const n = norm3([slope[0], 1, slope[1]]);
  const r = refractDir([-s[0], -s[1], -s[2]], n, 1 / ior);
  if (r === null || r[1] >= 0) throw new Error('[ocean] The refracted beam does not go down.');
  return [r[0] / -r[1], r[2] / -r[1]];
}

/**
 * The linear part of the beam's landing offset in the facet slope: a 2x2
 * matrix J, row-major [dOx/dsx, dOx/dsz, dOz/dsx, dOz/dsz], so a small slope
 * s moves the beam's landing point by depth * J s. For a vertical sun it is
 * -(1 - 1/n) times the identity (the minus because the shading slope is
 * -grad(h)): the beam bends toward the crest. Central differences of the
 * exact refraction, step 1e-4.
 *
 * The long waves use it (see `oceanSeabed.ts`): their curvature is too
 * gentle to fold the light at these depths, so their effect on the caustic
 * web is this linear shift and focus.
 */
export function beamSlopeJacobian(sunDir: V3, ior = WATER_IOR): [number, number, number, number] {
  const h = 1e-4;
  const px = beamOffsetPerM(sunDir, [h, 0], ior);
  const mx = beamOffsetPerM(sunDir, [-h, 0], ior);
  const pz = beamOffsetPerM(sunDir, [0, h], ior);
  const mz = beamOffsetPerM(sunDir, [0, -h], ior);
  return [
    (px[0] - mx[0]) / (2 * h), (pz[0] - mz[0]) / (2 * h),
    (px[1] - mx[1]) / (2 * h), (pz[1] - mz[1]) / (2 * h),
  ];
}

/**
 * Angular radius of the sun's disc, radians: 0.2665 degrees. A caustic line
 * is the image of that disc through a wave lens, so at depth it blurs.
 */
export const SUN_ANGULAR_RADIUS = (0.2665 * Math.PI) / 180;

/**
 * Blur radius of a caustic line on the floor, meters: the sun's disc refracted
 * into the water (its angular radius shrinks by cosAir / (n cosWater), from
 * Snell's law differentiated) times the beam's path to the floor. 1.4 cm at
 * 3 m under a sun 60 degrees up, 5.6 cm at 12 m.
 */
export function sunBlurM(depthM: number, sun: SunInWater, ior = WATER_IOR): number {
  const angW = SUN_ANGULAR_RADIUS * (sun.cosAir / (ior * sun.cosWater));
  return (Math.max(depthM, 0) / sun.cosWater) * angW;
}

/* ------------------------------------------------------------------ */
/* Caustic layers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Depths, meters, at which the caustic web is computed. A floor between two
 * of them blends the two nearest in log depth.
 *
 * Why these. A wave of steepness ak and wavenumber k focuses the sun at
 * the depth 1 / ((1 - 1/n) a k^2), so each depth has its own focusing
 * wavelength: measured on the `shallow` sea's ripple band (the CPU
 * reference, `.agent/scratch/ocean-gauntlet/caustics/causticCpu.ts`), the
 * web's first bright lines appear by 1 m, the contrast (standard deviation
 * over the mean) peaks between 2 and 5 m and falls slowly after, and the
 * cells coarsen with depth. The layers double in depth so the web's
 * character changes by the same step between each pair; past 12 m the sun's
 * blur (`sunBlurM`) and the overlap of many folds soften it, which the
 * texture's mip chain carries.
 */
export const CAUSTIC_LAYER_DEPTHS_M: readonly number[] = [1.5, 3, 6, 12];

/**
 * Weights of the caustic layers for a floor at `depthM`, and how much of the
 * web's contrast shows. A floor above the first layer blends that layer
 * toward flat light (contrast grows with depth until the first focus, so at
 * the waterline there is no web); a floor below the last keeps the last.
 * The GPU twin is `causticAt` in oceanSeabed.ts.
 */
export function causticLayerWeights(depthM: number, layers = CAUSTIC_LAYER_DEPTHS_M): {
  weights: number[];
  contrast: number;
} {
  const w = layers.map(() => 0);
  const d = Math.max(depthM, 0);
  if (d <= layers[0]) {
    w[0] = 1;
    return { weights: w, contrast: d / layers[0] };
  }
  const last = layers.length - 1;
  if (d >= layers[last]) {
    w[last] = 1;
    return { weights: w, contrast: 1 };
  }
  for (let i = 0; i < last; i += 1) {
    if (d <= layers[i + 1]) {
      const t = Math.log(d / layers[i]) / Math.log(layers[i + 1] / layers[i]);
      w[i] = 1 - t;
      w[i + 1] = t;
      break;
    }
  }
  return { weights: w, contrast: 1 };
}

/**
 * Where a floor point reads its caustic tile, meters: the point moved back
 * along the flat-sea beam by its depth. The tiles store the web relative to
 * the flat-sea landing point, so layers at different depths line up and a
 * blend between two of them does not show two copies of the web offset by the
 * beam's slant.
 */
export function causticTileShift(x: number, z: number, depthM: number, sun: SunInWater): [number, number] {
  return [x - sun.offsetPerM[0] * depthM, z - sun.offsetPerM[1] * depthM];
}

/**
 * The CPU caustic of one depth over one periodic surface patch, for the
 * tests and the calibration scripts. It is a TWIN of the GPU pass, not a
 * copy: the GPU rasterizes each surface triangle onto the floor with the
 * ratio of its areas, and this splats sub-sampled points, which converges to
 * the same map. Both put the mean at exactly 1.
 *
 * @param slopeAt  shading slope (-grad h) of the surface at a patch point.
 * @param dispAt   the surface's own displacement (dx, h, dz) at a patch point.
 * @returns        res x res intensities, row-major (z, x), over [0, patchM)^2,
 *                 stored at the landing point less the flat-sea offset.
 */
export function splatCausticCpu(opts: {
  patchM: number;
  srcN: number;
  res: number;
  depthM: number;
  sunDir: V3;
  sub?: number;
  slopeAt: (x: number, z: number) => [number, number];
  dispAt: (x: number, z: number) => [number, number, number];
}): Float64Array {
  const { patchM, srcN, res, depthM } = opts;
  const sub = opts.sub ?? 4;
  const sun = sunInWater(opts.sunDir);
  const img = new Float64Array(res * res);
  const step = patchM / (srcN * sub);
  // Energy per sub-sample: its horizontal area, spread over one floor texel.
  const texel = patchM / res;
  const e = (step * step) / (texel * texel);
  for (let j = 0; j < srcN * sub; j += 1) {
    for (let i = 0; i < srcN * sub; i += 1) {
      const gx = (i + 0.5) * step;
      const gz = (j + 0.5) * step;
      const [dx, h, dz] = opts.dispAt(gx, gz);
      const off = beamOffsetPerM(opts.sunDir, opts.slopeAt(gx, gz));
      const path = depthM + h;
      const lx = gx + dx + off[0] * path - sun.offsetPerM[0] * depthM;
      const lz = gz + dz + off[1] * path - sun.offsetPerM[1] * depthM;
      // Bilinear splat into the periodic floor tile.
      const u = lx / texel - 0.5;
      const v = lz / texel - 0.5;
      const u0 = Math.floor(u);
      const v0 = Math.floor(v);
      const fu = u - u0;
      const fv = v - v0;
      const wrap = (k: number) => ((k % res) + res) % res;
      const a = wrap(u0); const b = wrap(u0 + 1);
      const c = wrap(v0); const d = wrap(v0 + 1);
      img[c * res + a] += e * (1 - fu) * (1 - fv);
      img[c * res + b] += e * fu * (1 - fv);
      img[d * res + a] += e * (1 - fu) * fv;
      img[d * res + b] += e * fu * fv;
    }
  }
  return img;
}

/**
 * How much a cascade focuses the sun at a depth: (1 - 1/n) depth kappa_rms,
 * where kappa_rms is the RMS curvature of its height, the square root of
 * the sum over its grid of |k|^4 Psi(k) dk^2 (the spectrum of the height's
 * Laplacian). The web's brightness under that cascade swings by about this
 * fraction (the lens law, see `splatCausticCpu`'s test). The GPU reads a
 * long cascade's curvature per pixel only where this is a percent or more.
 */
export function cascadeFocusAt(c: CascadeParams, n: number, depthM: number, ior = WATER_IOR): number {
  const dk = (2 * Math.PI) / c.patchM;
  let sum = 0;
  for (let j = 1; j < n; j += 1) {
    for (let i = 1; i < n; i += 1) {
      const kx = (i - n / 2) * dk;
      const kz = (j - n / 2) * dk;
      const k2 = kx * kx + kz * kz;
      sum += k2 * k2 * directionalSpectrum(kx, kz, c) * dk * dk;
    }
  }
  return (1 - 1 / ior) * depthM * Math.sqrt(sum);
}

/* ------------------------------------------------------------------ */
/* Light on the floor, and back up                                     */
/* ------------------------------------------------------------------ */

/**
 * The floor's light, in the surface shader's scene-linear units.
 *
 * `sunE` is the sun's irradiance on a surface square to the beam and `skyE`
 * the sky's on a flat one, both in air. They are calibrated, not physical:
 * the ocean's sky gradient and sun are eye-tuned values (`oceanSky.ts`), so
 * the floor is tied to the one sunlit diffuse surface a reference shows. Dry
 * sand on the Water Pro demo's island (`ref/demo/orbit-away-far.png`, the
 * beach, and `default-0.png`) is (178, 167, 144) sRGB mean; sand of albedo
 * (0.50, 0.45, 0.36) under these lands at (180, 167, 143) through the
 * viewer's ACES tone map (`.agent/scratch/ocean-gauntlet/caustics/
 * calibrate.ts`). The ratio, 6.7 to 1 at a 60 degree sun, is inside the
 * measured clear-sky range of direct to diffuse light at that height (4 to
 * 10; Iqbal 1983).
 */
export interface FloorLight {
  readonly sunE: number;
  readonly skyE: number;
}

export const FLOOR_LIGHT: FloorLight = { sunE: 2.4, skyE: 0.315 };

/**
 * The floor's albedos. Carbonate sand of a coral lagoon is bright and a
 * little warm (0.4 to 0.6 in the visible; Hochberg et al. 2003 measured
 * 0.45 to 0.55 at 550 nm); a seagrass canopy over it is dark and green
 * (0.03 to 0.08); dead coral rubble and rock heads are a grey brown (0.15
 * to 0.25).
 */
export const SAND_ALBEDO: V3 = [0.5, 0.42, 0.3];
export const SAND_PALE_ALBEDO: V3 = [0.58, 0.54, 0.45];
export const GRASS_ALBEDO: V3 = [0.035, 0.06, 0.03];
export const ROCK_ALBEDO: V3 = [0.16, 0.14, 0.11];

/**
 * Radiance of a flat, sunlit floor at `depthM`, per channel: albedo / pi
 * times the sun beam (Fresnel, the path down, the caustic factor) plus the
 * skylight (a diffuse Fresnel of 0.93 and a path of depth / 0.8, the mean
 * cosine of diffuse light under water). The GPU twin is `floorRadiance`.
 */
export function floorRadianceCpu(opts: {
  depthM: number;
  albedo: V3;
  sun: SunInWater;
  optics?: WaterOptics;
  light?: FloorLight;
  caustic?: number;
  cosFloor?: number;
  sunVis?: number;
}): V3 {
  const o = opts.optics ?? LAGOON_WATER;
  const L = opts.light ?? FLOOR_LIGHT;
  const c = opts.caustic ?? 1;
  const cosF = opts.cosFloor ?? opts.sun.cosWater;
  const vis = opts.sunVis ?? 1;
  // The beam's irradiance square to itself in the water: the horizontal
  // irradiance is conserved through the surface, less the Fresnel loss, and
  // the beam is narrower under water by cosAir / cosWater.
  const beamW = L.sunE * opts.sun.transmit * (opts.sun.cosAir / opts.sun.cosWater);
  const tSun = transmittance(o.downPerM, opts.depthM / opts.sun.cosWater);
  const tSky = transmittance(o.downPerM, opts.depthM / 0.8);
  const out: number[] = [];
  for (let k = 0; k < 3; k += 1) {
    const e = beamW * cosF * c * tSun[k] * vis + L.skyE * 0.93 * tSky[k];
    out.push((opts.albedo[k] / Math.PI) * e);
  }
  return out as unknown as V3;
}

/**
 * The light that leaves the water's underside toward the eye, per channel:
 * the floor seen through `pathM` of water, plus the water's own in-scatter,
 * which is the deep body color `body` weighted by what the path hides
 * (single scattering in a uniform column: Lee et al. 1998's shallow-water
 * model has this form). The surface shader then takes (1 - Fresnel) of it,
 * as it does of the deep body. The GPU twin is the reader's `through` and
 * `trans` in oceanSeabed.ts, which the surface combines as
 * body * (1 - trans) + through.
 */
export function upwellingCpu(floor: V3, body: V3, pathM: number, optics: WaterOptics = LAGOON_WATER): V3 {
  const t = transmittance(optics.upPerM, pathM);
  return [
    floor[0] * t[0] + body[0] * (1 - t[0]),
    floor[1] * t[1] + body[1] * (1 - t[1]),
    floor[2] * t[2] + body[2] * (1 - t[2]),
  ];
}

/* ------------------------------------------------------------------ */
/* The bathymetry                                                      */
/* ------------------------------------------------------------------ */

/**
 * The shape of the floor: a sand lagoon behind a reef, with a wall down to
 * the open sea. Every length in meters. See `LAGOON_SEABED` for the values
 * and the reason for each.
 */
export interface SeabedParams {
  readonly seed: number;
  /** Side of the square the map covers, centered on (centerX, centerZ). */
  readonly extentM: number;
  /** Texels per side of the map. */
  readonly res: number;
  readonly centerX: number;
  readonly centerZ: number;
  /** Center and mean radius of the lagoon, the sand flat inside the reef. */
  readonly lagoonX: number;
  readonly lagoonZ: number;
  readonly lagoonRadiusM: number;
  /** How far the reef line wanders in and out, and over what length. */
  readonly edgeWarpM: number;
  readonly edgeWarpScaleM: number;
  /** Mean depth of the sand flat and the spread of its low hills. */
  readonly flatDepthM: number;
  readonly flatVarM: number;
  readonly flatScaleM: number;
  /** Sand waves on the flat: height, wavelength, heading. */
  readonly sandWaveM: number;
  readonly sandWaveLengthM: number;
  readonly sandWaveDirRad: number;
  /** A shoal just inside the reef line: how much shallower, and how far in. */
  readonly rimM: number;
  readonly rimInM: number;
  readonly rimWidthM: number;
  /** Shallowest the flat may get. */
  readonly minDepthM: number;
  /** Depth of the open sea past the wall, and the wall's horizontal run. */
  readonly deepM: number;
  readonly wallRunM: number;
  /** Seagrass patches: feature size, and the depths they grow in. */
  readonly grassScaleM: number;
  readonly grassCover: number;
  readonly grassMinDepthM: number;
  readonly grassMaxDepthM: number;
  /** Coral heads: feature size, share of the flat, height. */
  readonly headScaleM: number;
  readonly headCover: number;
  readonly headHeightM: number;
  /** Sand ripple marks: wavelength, height, crest heading, and wander. */
  readonly rippleLengthM: number;
  readonly rippleHeightM: number;
  readonly rippleDirRad: number;
  readonly rippleWarpPeriods: number;
  readonly rippleWarpScaleM: number;
  /**
   * A sand cay in the lagoon (the beach piece, `SeabedIsland`). Absent in
   * `LAGOON_SEABED`, so the caustics piece's floor is unchanged.
   */
  readonly island?: SeabedIsland;
}

/**
 * THE LAGOON. A sand flat inside a reef, like the island shallows in the
 * Water Pro demo and the sand floor of the v9 lake.
 *
 *   flat 3.8 m +- 2.0 m    Lagoon floors of Pacific atolls sit at 2 to 10 m
 *                          on their sand flats; 3.8 m puts most of the flat in
 *                          the 2 to 6 m band where the caustic web is
 *                          sharpest (see CAUSTIC_LAYER_DEPTHS_M) and the water
 *                          reads turquoise.
 *   rim 2.4 m, 35 m in     A sand shoal behind the reef crest, the palest
 *                          water in the frame, as the pale band along the
 *                          reference island's shore.
 *   wall to 42 m over 150 m A fore-reef that rounds over the crest, falls at
 *                          about 0.4 over its upper terrace and eases to the
 *                          open sea floor: past 20 m the floor is out of sight
 *                          and the water is the lagoon's deep blue.
 *   sand waves 0.3 m, 17 m Megaripples of a lagoon flat under a swell; they
 *                          shade the flat in broad bands.
 *   ripple marks 0.55 m    Wave orbital ripples: 0.65 of the orbital diameter
 *                          at the bed (Wiberg and Harris 1994). The `shallow`
 *                          sea's swell (T 9.2 s, 0.43 m, 4.5 m of water) has a
 *                          bed orbital velocity of 0.29 m/s and a diameter of
 *                          0.86 m, so 0.55 m. Height 0.15 of that, 8 cm,
 *                          drawn as a normal; crests square to the swell.
 *   seagrass, coral heads  Dark patches that show the floor is there from a
 *                          height, as the reference's dark weed does.
 */
export const LAGOON_SEABED: SeabedParams = {
  seed: 0x5eabed,
  extentM: 1280,
  res: 1024,
  centerX: 0,
  centerZ: 60,
  lagoonX: 0,
  lagoonZ: 60,
  lagoonRadiusM: 330,
  edgeWarpM: 70,
  edgeWarpScaleM: 240,
  flatDepthM: 3.8,
  flatVarM: 2.0,
  flatScaleM: 95,
  sandWaveM: 0.3,
  sandWaveLengthM: 17,
  sandWaveDirRad: -0.88 + Math.PI / 2,
  rimM: 2.4,
  rimInM: 35,
  rimWidthM: 28,
  minDepthM: 0.7,
  deepM: 42,
  wallRunM: 150,
  grassScaleM: 30,
  grassCover: 0.22,
  grassMinDepthM: 2.5,
  grassMaxDepthM: 12,
  headScaleM: 9,
  headCover: 0.05,
  headHeightM: 1.3,
  rippleLengthM: 0.55,
  rippleHeightM: 0.08,
  rippleDirRad: -0.88,
  rippleWarpPeriods: 3,
  rippleWarpScaleM: 9,
};

/**
 * The back reef, where coral heads crowd: centered this far in from the reef
 * line, meters, and this wide (a Gaussian's scale). On Pacific atolls the
 * reef flat behind the crest is 50 to 200 m of coral heads, rubble and sand
 * before the lagoon's open sand; 70 +- 50 m puts it in the high judged frame.
 * The boost multiplies `headCover` at its center.
 */
const BACK_REEF_M: readonly [number, number] = [70, 50];
const BACK_REEF_BOOST = 1.6;

/**
 * Spur and groove: the target spacing between spurs, meters; how far they
 * reach down the wall and in over the crest; and their relief on the wall.
 */
const SPUR_SPACING_M = 14;
const SPUR_REACH_M: readonly [number, number] = [28, 12];
const SPUR_RELIEF_M = 2.5;

/**
 * Coral heads, 0 to 1: one knoll or none in each cell of `headScaleM`, at a
 * jittered point, of a random radius (0.12 to 0.40 of the cell), its outline
 * wobbled by a small noise. `cover` is the share of the floor they take:
 * a knoll covers about a fifth of its cell on average, so a cell holds one
 * with the probability cover / 0.2. Cellular, not a thresholded noise: a
 * thresholded value noise drew square blocks on its grid.
 */
function coralHeads(p: SeabedParams, x: number, z: number, cover: number): number {
  const S = p.headScaleM;
  const prob = Math.min(cover / 0.2, 1);
  const cx = Math.floor(x / S);
  const cz = Math.floor(z / S);
  const wobble = 1 + 0.35 * fbm2(x / 2.5, z / 2.5, p.seed + 85, 2);
  let h = 0;
  for (let dj = -1; dj <= 1; dj += 1) {
    for (let di = -1; di <= 1; di += 1) {
      const ix = cx + di;
      const iz = cz + dj;
      if (hash2(ix, iz, p.seed + 81) > prob) continue;
      const px = (ix + 0.15 + 0.7 * hash2(ix, iz, p.seed + 82)) * S;
      const pz = (iz + 0.15 + 0.7 * hash2(ix, iz, p.seed + 83)) * S;
      const r = S * (0.12 + 0.28 * hash2(ix, iz, p.seed + 84));
      const d = Math.hypot(x - px, z - pz) / (r * wobble);
      h = Math.max(h, 1 - smooth(0.55, 1, d));
    }
  }
  return h;
}

/** Integer hash to [0, 1). Deterministic across platforms (32-bit integer ops only). */
function hash2(ix: number, iz: number, seed: number): number {
  let h = (Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iz | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Value noise in [-1, 1], quintic fade, one cell per unit. */
export function valueNoise2(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = hash2(x0, z0, seed);
  const b = hash2(x0 + 1, z0, seed);
  const c = hash2(x0, z0 + 1, seed);
  const d = hash2(x0 + 1, z0 + 1, seed);
  return 2 * ((a + (b - a) * ux) * (1 - uz) + (c + (d - c) * ux) * uz) - 1;
}

/**
 * Each octave of `fbm2` is rotated by 37 degrees from the last and seeded
 * apart, so the value noise's axis-aligned grid does not show as a lattice.
 * The rotations are a table: the map calls fbm2 about 20 million times.
 */
const FBM_MAX_OCTAVES = 8;
const FBM_COS = Array.from({ length: FBM_MAX_OCTAVES }, (_, o) => Math.cos(o * 0.6458));
const FBM_SIN = Array.from({ length: FBM_MAX_OCTAVES }, (_, o) => Math.sin(o * 0.6458));

/** Fractal sum of value noise, normalized to about [-1, 1]. */
export function fbm2(x: number, z: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  const oct = Math.min(octaves, FBM_MAX_OCTAVES);
  for (let o = 0; o < oct; o += 1) {
    const c = FBM_COS[o];
    const s = FBM_SIN[o];
    sum += amp * valueNoise2((x * c - z * s) * f, (x * s + z * c) * f, seed + o * 1013);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** One point of the floor. */
export interface SeabedPoint {
  /** Depth under the mean sea level, meters, positive down. */
  readonly depthM: number;
  /** Seagrass cover, 0 to 1. */
  readonly grass: number;
  /** Rock and coral cover, 0 to 1. */
  readonly rock: number;
  /** Phase warp of the ripple marks, in ripple periods. */
  readonly warp: number;
}

/**
 * The floor at one world point. The map is this function sampled on a grid;
 * the tests call it directly. Pure and deterministic in (params, x, z).
 */
export function seabedPointAt(p: SeabedParams, x: number, z: number): SeabedPoint {
  const seed = p.seed;
  // The reef line: a circle whose radius wanders by a warped fbm.
  const ws = 1 / p.edgeWarpScaleM;
  // Five octaves, 240 m down to 15 m: with three the line ran straight for
  // a hundred meters in the high frame, which a blind critic read as a
  // "knife-straight diagonal edge".
  const wx = fbm2(x * ws, z * ws, seed + 11, 5) * p.edgeWarpM;
  const wz = fbm2(x * ws + 5.2, z * ws - 1.7, seed + 12, 5) * p.edgeWarpM;
  const rr = Math.hypot(x - p.lagoonX + wx, z - p.lagoonZ + wz);
  const inside = p.lagoonRadiusM - rr;

  // The flat: low hills, sand waves bent by the hills, the shoal behind the reef.
  const fs = 1 / p.flatScaleM;
  const hills = fbm2(x * fs, z * fs, seed + 21, 4);
  const cw = Math.cos(p.sandWaveDirRad);
  const sw = Math.sin(p.sandWaveDirRad);
  const bend = fbm2(x / 45, z / 45, seed + 23, 2) * 2.2;
  const sandWave = Math.sin(((x * cw + z * sw) / p.sandWaveLengthM) * 2 * Math.PI + bend) * p.sandWaveM
    * (0.6 + 0.4 * fbm2(x / 70, z / 70, seed + 24, 2));
  const rim = p.rimM * Math.exp(-(((inside - p.rimInM) / p.rimWidthM) ** 2));
  let flat = p.flatDepthM + p.flatVarM * hills + sandWave - rim;

  // Coral heads: isolated knolls where a noise peaks, thickest on the back
  // reef (BACK_REEF_BOOST over the band BACK_REEF_M in from the reef line),
  // where the flat is shallow and the water the reef filters is clearest.
  const backReef = Math.exp(-(((inside - BACK_REEF_M[0]) / BACK_REEF_M[1]) ** 2));
  let head = coralHeads(p, x, z, p.headCover * (1 + BACK_REEF_BOOST * backReef)) * smooth(12, 40, inside);
  // THE CAY (the beach piece): no coral heads within 40 m of its shore, so
  // the swash zone and the sand shoal round it stay clean sand. With no
  // island the factor is not applied at all.
  const isl = p.island;
  const islS = isl ? islandFrameAt(isl, x, z).s : 0;
  if (isl) head *= 1 - smooth(-40, -25, islS);

  // SPUR AND GROOVE. The top of a fore-reef is combed into coral spurs
  // square to the reef line with sand grooves between them, 10 to 20 m apart
  // (Shinn 1963; spacing and relief grow with wave exposure). They run from
  // the reef crest down the upper wall. The spacing is fitted to a whole
  // number of spurs around the lagoon, so the angle's wrap draws no seam.
  // The phase wanders by three radians over 18 m, so the spacing runs from
  // about half to one and a half of SPUR_SPACING_M; the reach wanders by 12 m,
  // and a patch noise breaks some spurs into knolls.
  const theta = Math.atan2(z - p.lagoonZ, x - p.lagoonX);
  const around = Math.round((2 * Math.PI * p.lagoonRadiusM) / SPUR_SPACING_M);
  const spurPhase = theta * around + 3 * fbm2(x / 18, z / 18, seed + 33, 2);
  // Each spur (counted around the lagoon without the wander) is present with
  // a chance of 0.7 and has its own width, so they do not stand at even
  // intervals ("suspiciously even", a critic).
  const spurIndex = Math.floor((theta * around) / (2 * Math.PI) + 0.5);
  const spurHere = hash2(spurIndex, 7, seed + 36) < 0.7 ? 1 : 0.15;
  const spurWidth = 0.15 + 0.45 * hash2(spurIndex, 11, seed + 37);
  const reach = 12 * fbm2(x / 30, z / 30, seed + 35, 2);
  const spurBand = smooth(-SPUR_REACH_M[0] + reach, -SPUR_REACH_M[0] + reach + 12, inside)
    * (1 - smooth(SPUR_REACH_M[1] - 8 + reach * 0.5, SPUR_REACH_M[1] + reach * 0.5, inside));
  const spurBreak = 0.35 + 0.65 * smooth(-0.35, 0.15, fbm2(x / 9, z / 9, seed + 34, 2));
  const spur = smooth(spurWidth, 0.8, Math.sin(spurPhase)) * spurBand * spurBreak * spurHere;
  head = Math.max(head, spur);
  flat -= head * p.headHeightM * (0.7 + 0.3 * fbm2(x / 3, z / 3, seed + 32, 2));
  flat = Math.max(flat, p.minDepthM);

  // The wall: from the flat's depth at the reef line down to the open sea,
  // steepest at the top.
  const deep = p.deepM + 6 * fbm2(x / 130, z / 130, seed + 41, 3);
  let depth: number;
  if (inside >= 0) {
    depth = flat;
  } else {
    const t = Math.min(-inside / p.wallRunM, 1);
    // A reef crest rounds over into its wall: the fall starts flat over its
    // first eighth instead of breaking at an edge, and the upper slope is a
    // square law, not a cube (about 0.4 at its steepest over the first 30 m,
    // the spur-and-groove terrace of a fore-reef), so the turquoise deepens
    // to blue over a band tens of meters wide ("a hard line into flat navy",
    // a critic, of the cube over 90 m).
    const fall = (1 - (1 - t) ** 2) * smooth(0, 0.125, t);
    // The spurs stand proud of the wall and the grooves cut into it.
    depth = Math.max(flat + (deep - flat) * fall - (spur - 0.4 * spurBand) * SPUR_RELIEF_M * (1 - t), p.minDepthM);
  }

  // THE CAY rises out of the floor: the higher of the two, joined over
  // 0.3 m of height, so its terrace runs down into the lagoon flat.
  if (isl) depth = -smax(-depth, islandHeightAt(isl, x, z), 0.3);

  // Seagrass in the middle depths of the flat, in ragged patches.
  const gs = 1 / p.grassScaleM;
  const gw = fbm2(x * gs * 2.1, z * gs * 2.1, seed + 51, 2) * 0.35;
  const gN = 0.5 + 0.5 * fbm2(x * gs + gw, z * gs - gw, seed + 52, 4);
  const gT = 1 - p.grassCover * 1.6;
  const grassBand = smooth(p.grassMinDepthM, p.grassMinDepthM + 1.5, depth)
    * (1 - smooth(p.grassMaxDepthM - 3, p.grassMaxDepthM, depth));
  let grass = smooth(gT, gT + 0.1, gN) * grassBand * smooth(5, 25, inside) * (1 - head);
  // Bare sand on the cay's near terrace, the shallows a swimmer wades.
  if (isl) grass *= 1 - smooth(-30, -15, islS);

  // Rock: the coral heads, and rubble down the wall's upper half.
  const wallRock = inside < 0 ? smooth(0, 0.15, -inside / p.wallRunM) * (1 - smooth(0.4, 0.8, -inside / p.wallRunM)) : 0;
  const rock = Math.max(head, wallRock * (0.5 + 0.5 * smooth(-0.2, 0.3, fbm2(x / 6, z / 6, seed + 61, 3))));

  const warp = fbm2(x / p.rippleWarpScaleM, z / p.rippleWarpScaleM, seed + 71, 2) * p.rippleWarpPeriods;
  return { depthM: depth, grass, rock, warp };
}

/* ------------------------------------------------------------------ */
/* The island (the beach piece)                                         */
/* ------------------------------------------------------------------ */

/**
 * A sand cay in the lagoon: the land the beach piece (`oceanBeach.ts`) runs
 * its swash up. OPTIONAL: `LAGOON_SEABED` has none, so every scene of the
 * caustics piece is unchanged; the beach piece builds its floor from
 * `LAGOON_CAY_SEABED`, which is the lagoon plus this island.
 *
 * The still-water shoreline is an ellipse whose radius wanders by a noise of
 * the angle (periodic, so the outline has no seam). The ground is a function
 * of s, the distance landward of that shoreline along the ray from the
 * island's center: a planar beach face, a flatter terrace under the water, a
 * berm and a gently rising backshore on the land, and beach cusps across the
 * upper face. Lengths in meters, heights up from the mean sea level.
 */
export interface SeabedIsland {
  readonly centerX: number;
  readonly centerZ: number;
  /** Semi-axes of the still-water shoreline, and the first axis' heading from +X toward +Z. */
  readonly semiMajorM: number;
  readonly semiMinorM: number;
  readonly headingRad: number;
  /** How far the shoreline wanders in and out, and over what length of shore. */
  readonly shoreWarpM: number;
  readonly shoreWarpScaleM: number;
  /** Foreshore slope (tan beta) and the depth of its toe, where the terrace begins. */
  readonly faceSlope: number;
  readonly faceToeM: number;
  /** The terrace's slope under the toe, down to the lagoon floor. */
  readonly terraceSlope: number;
  /** Berm crest height, the backshore's slope landward of it, and the cay's top. */
  readonly bermM: number;
  readonly backSlope: number;
  readonly crestM: number;
  /**
   * The beach's own sand, linear albedo: on the island and under the water
   * near it (full above 0.3 m of depth, gone below 2 m), in place of the
   * lagoon's pale carbonate.
   */
  readonly sandAlbedo: V3;
  /** Beach cusps: spacing along the shore, relief, and the band of s they sit in. */
  readonly cuspSpacingM: number;
  readonly cuspHeightM: number;
  readonly cuspCenterM: number;
  readonly cuspWidthM: number;
}

/**
 * THE CAY. A low sand island inside the lagoon's reef, as coral lagoons have
 * (Stoddart and Steers 1977: reef-top cays 1 to 4 m high, a few hundred
 * meters long).
 *
 *   ellipse 90 x 55 m      Its long side faces the swell: the heading puts
 *                          the first axis along (0.797, 0.603), so the side
 *                          at -B faces (0.603, -0.797), the way the `shallow`
 *                          sea's swell arrives from (it travels toward
 *                          (-0.603, 0.797), `oceanSeaStates.ts`; measured on
 *                          its spectrum, the energy-weighted heading is 2.218
 *                          rad). A beach faces the waves because refraction
 *                          turns them square to it.
 *   face 1:11, toe 0.7 m   A medium-sand foreshore: Bascom (1951) measured
 *                          1:7 to 1:15 for 0.3 to 0.5 mm sand; the toe at
 *                          0.7 m is the depth where the plunging step meets
 *                          the low-tide terrace on such a beach.
 *   step 1:7               Under the toe the bed drops at 1:7 to the lagoon flat
 *                          (the plunging step and the steep nearshore of an
 *                          intermediate beach, Masselink and Short 1993), so
 *                          the water is 2 m deep 10 m off the toe: the
 *                          turquoise of the reference's near water, where a
 *                          1:20 shoal had kept it under a meter and pale.
 *   sand (0.38, 0.31, 0.20) A beach of quartz and shell: tan, darker and
 *                          warmer than the lagoon floor's carbonate. Set so
 *                          dry sand under this light draws near the Water Pro
 *                          shore shot's (154, 142, 113) sRGB (its luma ratio
 *                          to the lagoon sand's (180, 167, 143), taken back
 *                          through a 2.2 power: 0.36, 0.31, 0.21), warmed a
 *                          step (0.38, 0.31, 0.20) because the tone map and
 *                          the wet film's sky took saturation from it (0.137
 *                          against the reference's 0.174 on the judged crop).
 *   berm 0.95 m, top 1.8 m The berm stands at the reach of the largest swash
 *                          (Stockdon's R2 is 0.6 m on this sea, `oceanBeachMath.ts`);
 *                          the backshore rises 1:40 to a 1.8 m top.
 *   cusps 12 m, 5 cm       Swash cusps: 1.5 times the swash excursion (Werner and
 *                          Fink 1993; the excursion here is about 7 m), about
 *                          the synchronous edge-wave length g T^2 tan(beta) / 2 pi
 *                          (Guza and Inman 1975: 12 m for T 9.2 s, 1:11). Their
 *                          horns point seaward and their bays hold the swash.
 */
export const LAGOON_CAY: SeabedIsland = {
  centerX: -60,
  centerZ: -80,
  semiMajorM: 90,
  semiMinorM: 55,
  headingRad: Math.atan2(0.603, 0.797),
  shoreWarpM: 4,
  shoreWarpScaleM: 45,
  faceSlope: 1 / 11,
  faceToeM: 0.7,
  terraceSlope: 1 / 7,
  bermM: 0.95,
  backSlope: 1 / 40,
  crestM: 1.8,
  sandAlbedo: [0.38, 0.31, 0.2],
  cuspSpacingM: 12,
  cuspHeightM: 0.05,
  cuspCenterM: 4.5,
  cuspWidthM: 3.5,
};

/** The island's local frame at a world point: distance landward of the shoreline, and the angle round it. */
export interface IslandFrame {
  /** Meters landward of the still-water shoreline along the ray from the center; negative in the water. */
  readonly s: number;
  /** The shoreline's parametric angle at this ray, radians. */
  readonly theta: number;
  /** The shoreline's radius on this ray, m. */
  readonly edgeM: number;
}

/** Where a world point stands relative to the island's shoreline. */
export function islandFrameAt(isl: SeabedIsland, x: number, z: number): IslandFrame {
  const c = Math.cos(isl.headingRad);
  const sn = Math.sin(isl.headingRad);
  const dx = x - isl.centerX;
  const dz = z - isl.centerZ;
  const u = dx * c + dz * sn;
  const w = -dx * sn + dz * c;
  const theta = Math.atan2(w / isl.semiMinorM, u / isl.semiMajorM);
  const r = Math.hypot(u, w);
  // The ellipse's radius on the ray at this parametric angle, and the
  // shoreline's wander: a noise read on a circle in noise space, so it is
  // periodic in the angle.
  const re = Math.hypot(isl.semiMajorM * Math.cos(theta), isl.semiMinorM * Math.sin(theta));
  const meanR = (isl.semiMajorM + isl.semiMinorM) / 2;
  const k = meanR / isl.shoreWarpScaleM;
  const warp = fbm2(Math.cos(theta) * k + 3.1, Math.sin(theta) * k - 7.3, 0x15a4d, 3) * isl.shoreWarpM;
  const edge = re + warp;
  // The ray through the point meets the ellipse at the same parametric
  // angle only on the axes; elsewhere this is the radial distance to the
  // outline at that angle, within the slope's own spread (cos of at most
  // 25 degrees on this ellipse).
  return { s: edge - r, theta, edgeM: edge };
}

/** Smooth maximum of two heights over a blend width k, m (a softplus join). */
function smax(a: number, b: number, k: number): number {
  const d = a - b;
  if (d > 6 * k) return a;
  if (d < -6 * k) return b;
  return b + k * Math.log1p(Math.exp(d / k));
}

/**
 * The island's ground height at a world point, m up from the mean sea
 * level. Past the terrace's foot it keeps falling at the terrace slope, so a
 * smooth maximum with the lagoon floor ends it there.
 */
export function islandHeightAt(isl: SeabedIsland, x: number, z: number): number {
  const f = islandFrameAt(isl, x, z);
  const s = f.s;
  const sToe = -isl.faceToeM / isl.faceSlope;
  const sBerm = isl.bermM / isl.faceSlope;
  // The face, and the bed under its toe, joined over about a meter: a
  // gentler terrace is the higher of the two lines seaward of the toe, a
  // steeper step the lower one.
  const face = isl.faceSlope * s;
  const terrace = -isl.faceToeM + isl.terraceSlope * (s - sToe);
  let hgt = isl.terraceSlope > isl.faceSlope ? -smax(-face, -terrace, 0.12) : smax(face, terrace, 0.12);
  // The berm and the backshore: the face turns over the crest into a 1:40
  // rise, capped at the top.
  if (s > sBerm - 3) {
    const back = Math.min(isl.bermM + isl.backSlope * (s - sBerm), isl.crestM);
    // Past the berm the ground is the backshore; the join is a smooth
    // minimum over 0.15 m of height.
    hgt = -smax(-hgt, -back, 0.05);
  }
  // Cusps across the upper face: a whole number of them round the island,
  // so the angle's wrap draws no seam.
  const perim = Math.PI * (3 * (isl.semiMajorM + isl.semiMinorM)
    - Math.sqrt((3 * isl.semiMajorM + isl.semiMinorM) * (isl.semiMajorM + 3 * isl.semiMinorM)));
  const nC = Math.round(perim / isl.cuspSpacingM);
  const band = Math.exp(-(((s - isl.cuspCenterM) / isl.cuspWidthM) ** 2));
  hgt += isl.cuspHeightM * Math.cos(f.theta * nC) * band;
  return hgt;
}

/** The lagoon with the cay: the beach piece's floor. */
export const LAGOON_CAY_SEABED: SeabedParams = { ...LAGOON_SEABED, island: LAGOON_CAY };

/** The floor as a map: RGBA per texel = (depth, grass, rock, warp). */
export interface SeabedMap {
  readonly params: SeabedParams;
  readonly res: number;
  readonly texelM: number;
  /** World X, Z of texel (0, 0)'s CENTER. */
  readonly originX: number;
  readonly originZ: number;
  /** 4 floats per texel, row-major (z, x). */
  readonly data: Float32Array;
  readonly minDepthM: number;
  readonly maxDepthM: number;
}

/** Sample `seabedPointAt` at every texel center. */
export function buildSeabedMap(p: SeabedParams = LAGOON_SEABED): SeabedMap {
  const res = p.res;
  const texelM = p.extentM / res;
  const originX = p.centerX - p.extentM / 2 + texelM / 2;
  const originZ = p.centerZ - p.extentM / 2 + texelM / 2;
  const data = new Float32Array(res * res * 4);
  let minD = Infinity;
  let maxD = -Infinity;
  for (let j = 0; j < res; j += 1) {
    const z = originZ + j * texelM;
    for (let i = 0; i < res; i += 1) {
      const x = originX + i * texelM;
      const s = seabedPointAt(p, x, z);
      const o = (j * res + i) * 4;
      data[o] = s.depthM;
      data[o + 1] = s.grass;
      data[o + 2] = s.rock;
      data[o + 3] = s.warp;
      if (s.depthM < minD) minD = s.depthM;
      if (s.depthM > maxD) maxD = s.depthM;
    }
  }
  return { params: p, res, texelM, originX, originZ, data, minDepthM: minD, maxDepthM: maxD };
}

/**
 * Bilinear read of the map's depth at a world point, clamped at the edge, as
 * the GPU's linear filter with clamp-to-edge reads it. Past the edge the
 * floor is the edge's: the map is built so its whole border is open sea.
 */
export function seabedDepthAt(map: SeabedMap, x: number, z: number): number {
  const u = Math.min(Math.max((x - map.originX) / map.texelM, 0), map.res - 1);
  const v = Math.min(Math.max((z - map.originZ) / map.texelM, 0), map.res - 1);
  const i0 = Math.min(Math.floor(u), map.res - 2);
  const j0 = Math.min(Math.floor(v), map.res - 2);
  const fu = u - i0;
  const fv = v - j0;
  const at = (i: number, j: number) => map.data[(j * map.res + i) * 4];
  return (at(i0, j0) * (1 - fu) + at(i0 + 1, j0) * fu) * (1 - fv)
    + (at(i0, j0 + 1) * (1 - fu) + at(i0 + 1, j0 + 1) * fu) * fv;
}

/**
 * Where a refracted view ray from a surface point meets the floor: fixed-point
 * iteration t <- (y + depth(p + r t)) / -r.y, as the GPU does it
 * (`hitFloor` in oceanSeabed.ts). The ray leaves the water surface steeply
 * (refraction bends every ray to within 48 degrees of the vertical), so the
 * horizontal run per meter of depth is at most 1.1, and on floor slopes
 * under 0.5 the map contracts: three steps land within a few millimeters.
 *
 * @returns the path length along `dir` and the hit point.
 */
export function hitFloorCpu(map: SeabedMap, p: V3, dir: V3, steps = 3): { pathM: number; x: number; z: number } {
  const down = Math.max(-dir[1], 1e-3);
  let t = (p[1] + seabedDepthAt(map, p[0], p[2])) / down;
  for (let s = 0; s < steps; s += 1) {
    const x = p[0] + dir[0] * t;
    const z = p[2] + dir[2] * t;
    t = Math.max((p[1] + seabedDepthAt(map, x, z)) / down, 0);
  }
  return { pathM: t, x: p[0] + dir[0] * t, z: p[2] + dir[2] * t };
}

/**
 * @file oceanSeabed.test.ts — the CPU side of the sea floor.
 *
 * The GPU side (`oceanSeabed.ts`) is proved by its own cross-check in the
 * page (`__OCEAN__.extras.seabed.crossCheck`: the caustic layers against the
 * CPU splat of the same field, correlation 0.91 to 0.98) and by captures.
 * What is checked here is the arithmetic the shaders mirror: Snell's law and
 * Fresnel, the sun under the water, the beam's slope Jacobian, the caustic
 * web against the lens law of a sinusoid, energy conservation, the layer
 * blend, the light on the floor and back up, the bathymetry, the walk of a
 * refracted ray to the floor, and the `shallow` sea state's depth effects.
 */
import { describe, expect, it } from 'vitest';
import {
  CAUSTIC_LAYER_DEPTHS_M,
  FLOOR_LIGHT,
  LAGOON_SEABED,
  LAGOON_WATER,
  SAND_ALBEDO,
  WATER_IOR,
  beamOffsetPerM,
  beamSlopeJacobian,
  buildSeabedMap,
  causticLayerWeights,
  causticTileShift,
  cascadeFocusAt,
  fbm2,
  floorRadianceCpu,
  fresnelTransmit,
  hitFloorCpu,
  refractDir,
  seabedDepthAt,
  seabedPointAt,
  splatCausticCpu,
  sunBlurM,
  sunInWater,
  transmittance,
  upwellingCpu,
  valueNoise2,
  type V3,
} from '../oceanSeabedMath';
import { OCEAN_SEA_STATES } from '../oceanSeaStates';
import { dispersionOmega, jonswapPeakOmega, tmaFactor } from '../oceanSpectrum';

const SUN: V3 = [-0.321, 0.866, -0.383];
const len = (v: V3) => Math.hypot(v[0], v[1], v[2]);

describe('refractDir', () => {
  it('obeys Snell: n1 sin(i) = n2 sin(t), and stays unit length', () => {
    for (const deg of [0, 10, 30, 60, 85]) {
      const a = (deg * Math.PI) / 180;
      const i: V3 = [Math.sin(a), -Math.cos(a), 0];
      const t = refractDir(i, [0, 1, 0], 1 / WATER_IOR)!;
      expect(len(t)).toBeCloseTo(1, 10);
      const sinT = Math.hypot(t[0], t[2]);
      expect(sinT * WATER_IOR).toBeCloseTo(Math.sin(a), 10);
      expect(t[1]).toBeLessThan(0);
    }
  });

  it('passes a ray at normal incidence straight through', () => {
    const t = refractDir([0, -1, 0], [0, 1, 0], 1 / WATER_IOR)!;
    expect(t[0]).toBeCloseTo(0, 12);
    expect(t[1]).toBeCloseTo(-1, 12);
  });

  it('returns null past the critical angle (water to air)', () => {
    const crit = Math.asin(1 / WATER_IOR);
    const a = crit + 0.05;
    expect(refractDir([Math.sin(a), Math.cos(a), 0], [0, -1, 0], WATER_IOR)).toBeNull();
    const b = crit - 0.05;
    expect(refractDir([Math.sin(b), Math.cos(b), 0], [0, -1, 0], WATER_IOR)).not.toBeNull();
  });
});

describe('fresnelTransmit', () => {
  it('is 1 - ((n - 1) / (n + 1))^2 at normal incidence', () => {
    const r0 = ((WATER_IOR - 1) / (WATER_IOR + 1)) ** 2;
    expect(fresnelTransmit(1)).toBeCloseTo(1 - r0, 10);
    expect(fresnelTransmit(1)).toBeCloseTo(0.979, 3);
  });

  it('falls monotonically to 0 at grazing incidence', () => {
    let prev = fresnelTransmit(1);
    for (let c = 0.95; c > 0; c -= 0.05) {
      const t = fresnelTransmit(c);
      expect(t).toBeLessThanOrEqual(prev + 1e-12);
      prev = t;
    }
    expect(fresnelTransmit(0)).toBeCloseTo(0, 10);
  });
});

describe('sunInWater', () => {
  it('bends the sun toward the vertical by Snell and keeps its azimuth', () => {
    const s = sunInWater(SUN);
    const sinAir = Math.sqrt(1 - s.cosAir ** 2);
    const sinWater = Math.sqrt(1 - s.cosWater ** 2);
    expect(sinWater * WATER_IOR).toBeCloseTo(sinAir, 8);
    expect(s.cosWater).toBeGreaterThan(s.cosAir);
    // The beam travels away from the sun: its horizontal run points opposite
    // the sun's horizontal direction.
    const hs = Math.hypot(SUN[0], SUN[2]);
    const ho = Math.hypot(s.offsetPerM[0], s.offsetPerM[1]);
    expect((s.offsetPerM[0] * SUN[0] + s.offsetPerM[1] * SUN[2]) / (hs * ho)).toBeCloseTo(-1, 8);
    expect(ho).toBeCloseTo(sinWater / s.cosWater, 8);
  });

  it('throws for a sun under the horizon', () => {
    expect(() => sunInWater([0.5, -0.1, 0])).toThrow(/below the horizon/);
  });
});

describe('beamSlopeJacobian', () => {
  it('is -(1 - 1/n) I for a vertical sun: the beam bends toward the crest', () => {
    const j = beamSlopeJacobian([0, 1, 0]);
    const a = 1 - 1 / WATER_IOR;
    expect(j[0]).toBeCloseTo(-a, 4);
    expect(j[3]).toBeCloseTo(-a, 4);
    expect(j[1]).toBeCloseTo(0, 6);
    expect(j[2]).toBeCloseTo(0, 6);
  });

  it('predicts the offset of a small slope under the real sun', () => {
    const j = beamSlopeJacobian(SUN);
    const base = beamOffsetPerM(SUN, [0, 0]);
    const s: [number, number] = [0.02, -0.015];
    const got = beamOffsetPerM(SUN, s);
    expect(got[0] - base[0]).toBeCloseTo(j[0] * s[0] + j[1] * s[1], 4);
    expect(got[1] - base[1]).toBeCloseTo(j[2] * s[0] + j[3] * s[1], 4);
  });
});

describe('splatCausticCpu', () => {
  it('conserves energy: the mean of any web is 1', () => {
    const img = splatCausticCpu({
      patchM: 5, srcN: 64, res: 64, depthM: 3, sunDir: SUN, sub: 2,
      slopeAt: (x, z) => [0.15 * Math.sin(2.1 * x + 1.3 * z), 0.12 * Math.cos(1.7 * z - 0.4 * x)],
      dispAt: (x, z) => [0.02 * Math.cos(x), 0.03 * Math.sin(z), 0],
    });
    let m = 0; for (const v of img) m += v; m /= img.length;
    expect(m).toBeCloseTo(1, 6);
  });

  it('is flat light under a flat sea', () => {
    const img = splatCausticCpu({
      patchM: 4, srcN: 32, res: 32, depthM: 5, sunDir: SUN, sub: 2,
      slopeAt: () => [0, 0], dispAt: () => [0, 0, 0],
    });
    for (const v of img) expect(v).toBeCloseTo(1, 6);
  });

  it('focuses a sinusoid by the lens law 1 / (1 - d (1 - 1/n) a k^2)', () => {
    // h = a cos(k x); the shading slope is -dh/dx = a k sin(k x). A vertical
    // sun at 20 m: d (1 - 1/n) a k^2 = 0.25, so the crest brightens to 4/3 and
    // the trough dims to 4/5.
    const P = 4; const k = (2 * Math.PI) / P; const a = 0.02; const d = 20;
    const res = 256;
    const img = splatCausticCpu({
      patchM: P, srcN: 256, res, depthM: d, sunDir: [0, 1, 0], sub: 4,
      slopeAt: (x) => [a * k * Math.sin(k * x), 0],
      dispAt: (x) => [0, a * Math.cos(k * x), 0],
    });
    const g = d * (1 - 1 / WATER_IOR) * a * k * k;
    // Row 0 of the tile, columns at the crest (x = 0) and trough (x = P / 2).
    const at = (x: number) => {
      const i = Math.round(x / (P / res) - 0.5);
      let s = 0; for (let j = 0; j < res; j += 1) s += img[j * res + ((i % res) + res) % res];
      return s / res;
    };
    expect(at(0) + at(P) / 1e9).toBeCloseTo(1 / (1 - g), 1);
    expect(Math.abs(at(0) - 1 / (1 - g)) / (1 / (1 - g))).toBeLessThan(0.03);
    expect(Math.abs(at(P / 2) - 1 / (1 + g)) / (1 / (1 + g))).toBeLessThan(0.03);
  });
});

describe('causticLayerWeights', () => {
  it('sums to 1 and puts all weight on a layer at its own depth', () => {
    for (const d of [0.2, 1, 1.5, 2, 3, 4.4, 6, 9, 12, 30]) {
      const { weights } = causticLayerWeights(d);
      expect(weights.reduce((s, w) => s + w, 0)).toBeCloseTo(1, 12);
    }
    CAUSTIC_LAYER_DEPTHS_M.forEach((d, i) => {
      expect(causticLayerWeights(d).weights[i]).toBeCloseTo(1, 12);
    });
  });

  it('blends in log depth: halfway in log is half and half', () => {
    const d = Math.sqrt(3 * 6);
    const { weights } = causticLayerWeights(d);
    expect(weights[1]).toBeCloseTo(0.5, 10);
    expect(weights[2]).toBeCloseTo(0.5, 10);
  });

  it('fades the web to flat light toward the waterline', () => {
    expect(causticLayerWeights(0).contrast).toBe(0);
    expect(causticLayerWeights(0.75).contrast).toBeCloseTo(0.5, 12);
    expect(causticLayerWeights(5).contrast).toBe(1);
  });
});

describe('causticTileShift and sunBlurM', () => {
  it('moves a floor point back up the flat-sea beam by its depth', () => {
    const sun = sunInWater(SUN);
    const [x, z] = causticTileShift(10, -4, 3, sun);
    expect(x).toBeCloseTo(10 - sun.offsetPerM[0] * 3, 12);
    expect(z).toBeCloseTo(-4 - sun.offsetPerM[1] * 3, 12);
  });

  it('blurs a caustic line in proportion to its depth, about 1.4 cm at 3 m', () => {
    const sun = sunInWater(SUN);
    expect(sunBlurM(6, sun)).toBeCloseTo(2 * sunBlurM(3, sun), 12);
    expect(sunBlurM(3, sun)).toBeGreaterThan(0.01);
    expect(sunBlurM(3, sun)).toBeLessThan(0.02);
  });
});

describe('light on the floor and back up', () => {
  const sun = sunInWater(SUN);

  it('is the floor itself at no path, and the water itself at a long one', () => {
    const floor: V3 = [0.5, 0.4, 0.3];
    const body: V3 = [0.02, 0.07, 0.19];
    const a = upwellingCpu(floor, body, 0);
    a.forEach((v, k) => expect(v).toBeCloseTo(floor[k], 12));
    const b = upwellingCpu(floor, body, 500);
    b.forEach((v, k) => expect(v).toBeCloseTo(body[k], 6));
  });

  it('loses red first: turquoise over white sand', () => {
    const t = transmittance(LAGOON_WATER.upPerM, 5);
    expect(t[0]).toBeLessThan(t[1]);
    expect(t[1]).toBeLessThan(t[2]);
    const f = floorRadianceCpu({ depthM: 5, albedo: SAND_ALBEDO, sun });
    const f0 = floorRadianceCpu({ depthM: 0, albedo: SAND_ALBEDO, sun });
    for (let k = 0; k < 3; k += 1) expect(f[k]).toBeLessThan(f0[k]);
    expect(f[0] / f0[0]).toBeLessThan(f[1] / f0[1]);
    expect(f[1] / f0[1]).toBeLessThan(f[2] / f0[2]);
  });

  it('is albedo / pi times the sun beam and the skylight at the waterline', () => {
    const f = floorRadianceCpu({ depthM: 0, albedo: [1, 1, 1], sun });
    const beam = FLOOR_LIGHT.sunE * sun.transmit * (sun.cosAir / sun.cosWater);
    expect(f[1]).toBeCloseTo((beam * sun.cosWater + FLOOR_LIGHT.skyE * 0.93) / Math.PI, 10);
  });

  it('scales the sun term by the caustic factor and not the skylight', () => {
    const one = floorRadianceCpu({ depthM: 3, albedo: [1, 1, 1], sun, caustic: 1 });
    const two = floorRadianceCpu({ depthM: 3, albedo: [1, 1, 1], sun, caustic: 2 });
    const none = floorRadianceCpu({ depthM: 3, albedo: [1, 1, 1], sun, caustic: 0 });
    for (let k = 0; k < 3; k += 1) expect(two[k] - one[k]).toBeCloseTo(one[k] - none[k], 10);
  });
});

describe('noise', () => {
  it('is deterministic and bounded', () => {
    for (let i = 0; i < 200; i += 1) {
      const x = i * 0.731 - 40; const z = i * 1.37 + 3;
      const v = valueNoise2(x, z, 7);
      expect(v).toBe(valueNoise2(x, z, 7));
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
      expect(Math.abs(fbm2(x, z, 9, 4))).toBeLessThanOrEqual(1);
    }
    expect(valueNoise2(1.5, 2.5, 7)).not.toBe(valueNoise2(1.5, 2.5, 8));
  });
});

describe('the lagoon bathymetry', () => {
  // A coarse copy of the shipped map: the same shape at an 8th of the texels,
  // so the whole map builds in a test's time.
  const coarse = { ...LAGOON_SEABED, res: 128 };
  const map = buildSeabedMap(coarse);

  it('is the same map every build', () => {
    const again = buildSeabedMap(coarse);
    expect(again.data).toEqual(map.data);
  });

  it('is open sea all around its rim, so the clamp past its edge is open sea too', () => {
    const r = map.res;
    for (let i = 0; i < r; i += 1) {
      for (const [a, b] of [[i, 0], [i, r - 1], [0, i], [r - 1, i]]) {
        expect(map.data[(b * r + a) * 4]).toBeGreaterThan(30);
      }
    }
  });

  it('holds a sand flat of lagoon depths inside the reef', () => {
    let n = 0; let sum = 0;
    for (let k = 0; k < 400; k += 1) {
      const a = (k / 400) * 2 * Math.PI;
      const rr = 150 * Math.sqrt((k % 20) / 20);
      const p = seabedPointAt(LAGOON_SEABED, LAGOON_SEABED.lagoonX + rr * Math.cos(a), LAGOON_SEABED.lagoonZ + rr * Math.sin(a));
      expect(p.depthM).toBeGreaterThanOrEqual(LAGOON_SEABED.minDepthM);
      expect(p.depthM).toBeLessThan(9);
      sum += p.depthM; n += 1;
    }
    expect(sum / n).toBeGreaterThan(2.5);
    expect(sum / n).toBeLessThan(5);
  });

  it('reads the map back at texel centers exactly, as the GPU filter does', () => {
    for (const [i, j] of [[10, 20], [64, 64], [100, 37]]) {
      const x = map.originX + i * map.texelM;
      const z = map.originZ + j * map.texelM;
      expect(seabedDepthAt(map, x, z)).toBeCloseTo(map.data[(j * map.res + i) * 4], 5);
    }
  });

  it('walks a refracted ray to the floor within a centimeter in three steps', () => {
    for (const [x, z] of [[0, 60], [120, 200], [-200, -40]]) {
      for (const [dx, dz] of [[0, 0], [0.7, 0.2], [-0.5, 0.6]]) {
        const d = [dx, -1, dz] as const;
        const l = Math.hypot(d[0], d[1], d[2]);
        const dir: V3 = [d[0] / l, d[1] / l, d[2] / l];
        const hit = hitFloorCpu(map, [x, 0.1, z], dir);
        const floorY = -seabedDepthAt(map, hit.x, hit.z);
        const rayY = 0.1 + dir[1] * hit.pathM;
        expect(Math.abs(rayY - floorY)).toBeLessThan(0.01);
      }
    }
  });
});

describe('the shallow sea state', () => {
  const sea = OCEAN_SEA_STATES.shallow;

  it('has a real depth on every cascade and contiguous bands', () => {
    for (const c of sea) expect(c.depthM).toBe(4.5);
    for (let i = 1; i < sea.length; i += 1) expect(sea[i].cutoffLowM).toBe(sea[i - 1].cutoffHighM);
  });

  it('holds every band longest wave about three times in its patch, the ripple six', () => {
    // The last band runs to its patch, as `waterpro`'s sea band does; its
    // energy is at its shoaled peak (59 m, next test), seven times a patch.
    for (const c of sea.slice(0, -1)) expect(c.patchM / c.cutoffHighM).toBeGreaterThan(2.9);
    expect(sea[0].patchM / sea[0].cutoffHighM).toBeGreaterThan(6);
    expect(sea[sea.length - 1].patchM / 63).toBeGreaterThan(6);
  });

  it('shortens the swell over the shoal from 135 m to about 59 m and keeps a tenth of its energy', () => {
    const swell = sea.find((c) => c.name === 'swell')!;
    const wp = jonswapPeakOmega(swell.windSpeedMs, swell.fetchM);
    // Solve omega(k, h) = wp for k by bisection.
    const kAt = (h: number) => {
      let lo = 1e-4; let hi = 10;
      for (let i = 0; i < 100; i += 1) {
        const mid = 0.5 * (lo + hi);
        if (dispersionOmega(mid, h) < wp) lo = mid; else hi = mid;
      }
      return 0.5 * (lo + hi);
    };
    const deep = (2 * Math.PI) / kAt(1000);
    const shoal = (2 * Math.PI) / kAt(swell.depthM);
    expect(deep).toBeGreaterThan(125);
    expect(shoal).toBeGreaterThan(55);
    expect(shoal).toBeLessThan(63);
    expect(tmaFactor(wp, swell.depthM)).toBeLessThan(0.15);
    expect(tmaFactor(wp, 1000)).toBe(1);
  });

  it('leaves the wind sea deep-water waves', () => {
    const chop = sea.find((c) => c.name === 'chop')!;
    const wp = jonswapPeakOmega(chop.windSpeedMs, chop.fetchM);
    expect(tmaFactor(wp, chop.depthM)).toBe(1);
  });
});

describe('cascadeFocusAt', () => {
  const sea = OCEAN_SEA_STATES.shallow;

  it('grows in proportion to depth', () => {
    const c = sea[1];
    expect(cascadeFocusAt(c, 64, 8)).toBeCloseTo(2 * cascadeFocusAt(c, 64, 4), 10);
  });

  it('reads the chop and not the swell at the deepest layer', () => {
    const deepest = CAUSTIC_LAYER_DEPTHS_M[CAUSTIC_LAYER_DEPTHS_M.length - 1];
    const chop = sea.find((c) => c.name === 'chop')!;
    const swell = sea.find((c) => c.name === 'swell')!;
    expect(cascadeFocusAt(chop, 128, deepest)).toBeGreaterThan(0.01);
    expect(cascadeFocusAt(swell, 128, deepest)).toBeLessThan(0.01);
  });
});

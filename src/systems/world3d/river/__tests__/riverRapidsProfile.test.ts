/** Numeric passage checks; settled flow and rendered turbulence need the
 * separate reference gauntlet. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { carveMainRapids, mainRapidsAt, mainRapidsProfile, mainRapidsChuteAt, MAIN_CHANNEL_S, MAIN_RAPIDS_FEATURES, setRiverHeadwaters } from '../riverHeadwaters';
import { defaultRiverCourse, placeBoulders, setRiverShape } from '../riverReach';

describe('localized main rapids bed', () => {
  beforeEach(() => { setRiverHeadwaters(true); setRiverShape(null); });
  afterEach(() => { setRiverHeadwaters(false); setRiverShape(null); });
  const point = (u: number, n = 0) => {
    const p = mainRapidsAt(MAIN_CHANNEL_S + u);
    return { x: p.x + p.tz * n, z: p.z - p.tx * n };
  };
  const bed = (u: number, n = 0, originalDistance = Infinity) => {
    const p = point(u, n);
    // Preserve the original cuts-only compatibility proof. Raised support has
    // separate finite-boundary, chute and actual cap tests in riverMainRibs.
    return carveMainRapids(p.x, p.z, 30, 0, originalDistance, false);
  };

  it('keeps unequal oblique cuts local with a bypass at every mouth', () => {
    expect(new Set(MAIN_RAPIDS_FEATURES.map(f => f.drop)).size).toBe(3);
    for (const f of MAIN_RAPIDS_FEATURES) {
      const u = f.lip + f.ramp + 1;
      const center = f.center + f.obliquity * (u - f.lip);
      expect(mainRapidsProfile(u, center).cut).toBeCloseTo(f.drop, 7);
      expect(mainRapidsProfile(f.lip, f.center).cut).toBe(0);
      for (const n of [-5, 5]) expect(mainRapidsProfile(u, n).cut).toBe(0);
      expect(f.center + f.obliquity * (u + 3 - f.lip)).not.toBe(center);
    }
  });

  it('has smooth finite gradients and a connected downhill bed route', () => {
    for (let u = 30; u <= 125; u += 0.25) for (let n = -6; n <= 6; n += 0.25) {
      const h = bed(u, n), base = 5.2 - 0.035 * u + 1.5 * (Math.abs(n) / 8.5) ** 3;
      expect(Number.isFinite(h)).toBe(true);
      expect(h).toBeLessThanOrEqual(base + 1e-7);
      expect(Math.abs(bed(u + 0.1, n) - h)).toBeLessThan(0.045);
      expect(Math.abs(bed(u, n + 0.1) - h)).toBeLessThan(0.045);
    }
    // Permit lane changes around pockets, but no newly raised bed barrier.
    let reachable = new Set(Array.from({ length: 21 }, (_, i) => i));
    for (let u = 35; u < 119; u += 0.5) {
      const next = new Set<number>();
      for (const i of reachable) for (const j of [i - 1, i, i + 1]) {
        if (j >= 0 && j <= 20 && bed(u + 0.5, -5 + j * 0.5) <= bed(u, -5 + i * 0.5) + 0.005) next.add(j);
      }
      expect(next.size).toBeGreaterThan(0);
      reachable = next;
    }
  });

  it('preserves the low-water thread, original ownership, banks and distant bed', () => {
    for (let u = 41; u <= 113; u += 0.5) expect(mainRapidsProfile(u).thread).toBe(1);
    for (const u of [0, 25, 130, 220, 400]) {
      expect(mainRapidsProfile(u).cut).toBe(0);
      expect(mainRapidsProfile(u).thread).toBe(0);
      expect(bed(u)).toBeCloseTo(5.2 - 0.035 * u, 7);
    }
    for (let u = 30; u <= 125; u += 1) {
      for (const n of [-6.8, 6.8]) expect(bed(u, n)).toBeCloseTo(5.2 - 0.035 * u + 1.5 * (Math.abs(n) / 8.5) ** 3, 7);
      expect(bed(u, 0, 0)).toBeCloseTo(5.2 - 0.035 * u, 7);
    }
  });

  it('retains downstream rocks and native central obstacles outside local mouths', () => {
    setRiverHeadwaters(false);
    const legacy = placeBoulders(defaultRiverCourse(), () => 0, 20260928);
    setRiverHeadwaters(true);
    const current = placeBoulders(defaultRiverCourse(), () => 0, 20260928);
    const downstream = (b: typeof legacy[number]) => b.s !== undefined && b.s >= -60 && b.s < MAIN_CHANNEL_S;
    expect(current.filter(downstream)).toEqual(legacy.filter(downstream));
    const trial = current.filter(b => b.s !== undefined && b.s >= MAIN_CHANNEL_S + 35 && b.s <= MAIN_CHANNEL_S + 119);
    expect(trial.filter(b => !mainRapidsChuteAt(b.s! - MAIN_CHANNEL_S) && Math.abs(b.n!) < 2.5).length).toBeGreaterThan(3);
    expect(current.every(b => Number.isFinite(b.x + b.y + b.z + b.rx + b.ry + b.rz))).toBe(true);
    // Use native ellipsoid footprints, rather than treating retained rocks
    // as decorative objects. A half-meter route must survive their blockage.
    const clear = (u: number, n: number) => {
      const p = point(u, n);
      return trial.every(b => (p.x - b.x) ** 2 + (p.z - b.z) ** 2 > (0.85 * Math.max(b.rx, b.rz)) ** 2);
    };
    let reachable = new Set(Array.from({ length: 23 }, (_, i) => i).filter(i => clear(35, -5.5 + i * 0.5)));
    for (let u = 35; u < 119; u += 0.5) {
      const next = new Set<number>();
      for (const i of reachable) for (const j of [i - 1, i, i + 1]) {
        if (j >= 0 && j <= 22 && clear(u + 0.5, -5.5 + j * 0.5)) next.add(j);
      }
      expect(next.size).toBeGreaterThan(0);
      reachable = next;
    }
  });
});

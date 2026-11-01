/** Geometry proof only. New settled hydraulic fixtures and rendered review remain required. */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { defaultRiverCourse, makeTerrainHeight, placeBoulders, mainBoulderShape, setRiverShape, applyMainRibCaps } from '../riverReach';
import { LiveRiver } from '../riverLive';
import { mainRibUplift, mainRapidsChuteAt, mainRapidsAt, projectMainRapids, setRiverHeadwaters } from '../riverHeadwaters';

const caps = new Set([102463419, 924926638, 331829731, 267574660, 837373192]);
afterEach(() => { setRiverHeadwaters(false); setRiverShape(null); });

describe('bounded rooted main rapids ribs', () => {
  it('keeps finite support, original ownership and the oblique chute protected', () => {
    setRiverHeadwaters(true);
    const course = defaultRiverCourse();
    for (let u = 80; u <= 112; u += .25) for (let n = -10; n <= 10; n += .25) {
      const chute = mainRapidsChuteAt(u), lift = mainRibUplift(u, n, 30, Math.abs(n));
      expect(Number.isFinite(lift)).toBe(true);
      expect(lift).toBeGreaterThanOrEqual(0); expect(lift).toBeLessThanOrEqual(.55 + 1e-12);
      if (u < 86 || u > 106 || Math.abs(n) >= 8.5 || (chute && Math.abs(n - chute.center) <= chute.halfWidth + .5)) expect(lift).toBe(0);
      expect(mainRibUplift(u, n, Math.abs(n), Math.abs(n))).toBe(0);
    }
    for (let x = 56; x < 86; x += .5) for (let z = -5; z < 30; z += .5) {
      const p = projectMainRapids(x, z), original = course.project(x, z).d;
      if (original <= p.d) expect(mainRibUplift(p.s - 1000, p.n, original, p.d)).toBe(0);
    }
  });

  it.each([
    { widthScale: .6, depthScale: 2, dischargeM3S: .5 },
    { widthScale: 1, depthScale: 1, dischargeM3S: 4 },
    { widthScale: 1, depthScale: 1, dischargeM3S: 12 },
  ])('preserves native rocks and supports actual cap triangles at %j', shape => {
    setRiverHeadwaters(true); setRiverShape(shape);
    const course = defaultRiverCourse(), nativeTerrain = makeTerrainHeight(course, 20260928, false), terrain = makeTerrainHeight(course, 20260928);
    const native = placeBoulders(course, nativeTerrain, 20260928, nativeTerrain);
    const rocks = placeBoulders(course, terrain, 20260928, nativeTerrain);
    expect(rocks.map(b => b.seed)).toEqual(native.map(b => b.seed));
    // Old-bank identities can lie beside the new main channel: their complete records stay exact.
    expect(rocks.filter(b => (b.s ?? 0) < 1000)).toEqual(native.filter(b => (b.s ?? 0) < 1000));
    expect(rocks.filter(b => !caps.has(b.seed))).toEqual(native.filter(b => !caps.has(b.seed)));
    const matched = rocks.filter(b => (b.s ?? 0) >= 1000 && caps.has(b.seed));
    // Fresh nondefault builds can have different native identities. The prototype
    // leaves those unmatched rocks unchanged rather than inventing a new policy.
    for (const b of matched) {
      const old = native.find(v => v.seed === b.seed)!;
      expect([b.rx, b.ry, b.rz, b.rot, b.seed]).toEqual([old.rx, old.ry, old.rz, old.rot, old.seed]);
      for (const other of rocks) if (other !== b) expect(Math.hypot(b.x - other.x, b.z - other.z)).toBeGreaterThanOrEqual(.85 * (Math.max(b.rx, b.rz) + Math.max(other.rx, other.rz)) - 1e-9);
      const meshShape = mainBoulderShape(b);
      expect(Array.from(meshShape.positions).every(Number.isFinite)).toBe(true);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(meshShape.positions, 3));
      geometry.setIndex(new THREE.BufferAttribute(meshShape.indices, 1));
      const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material);
      const ray = new THREE.Raycaster(), direction = new THREE.Vector3(0, -1, 0);
      let contacts = 0;
      // Independent THREE triangle ray intersections check the real underside,
      // rather than copying the placement loop or accepting nominal ry burial.
      for (let z = meshShape.bounds.minZ + .0625; z < meshShape.bounds.maxZ; z += .125) for (let x = meshShape.bounds.minX + .0625; x < meshShape.bounds.maxX; x += .125) {
        ray.set(new THREE.Vector3(x, meshShape.bounds.maxY + 1, z), direction);
        const hits = ray.intersectObject(mesh);
        if (!hits.length) continue;
        contacts++;
        expect(hits[hits.length - 1].point.y).toBeLessThanOrEqual(terrain(x, z) + 1e-6);
      }
      expect(contacts).toBeGreaterThan(20);
      geometry.dispose(); material.dispose();
    }
    // The final terrain adds precisely the shared support, never a second pillow.
    for (let x = 60; x < 82; x += .5) for (let z = 2; z < 18; z += .5) {
      const p = projectMainRapids(x, z), lift = mainRibUplift(p.s - 1000, p.n, course.project(x, z).d, p.d);
      expect(terrain(x, z) - nativeTerrain(x, z)).toBeCloseTo(lift, 12);
    }
  }, 60000);

  it('supports the five native-init caps through live LOW, NORMAL and HIGH edits without advancing the solver', () => {
    const live = new LiveRiver(20260928, true);
    expect(live.boulders.filter(b => (b.s ?? 0) >= 1000 && caps.has(b.seed))).toHaveLength(5);
    const initialized = live.boulders.map(b => ({ ...b }));
    for (const shape of [
      { widthScale: 1, depthScale: 1, dischargeM3S: 4 },
      { widthScale: .6, depthScale: 2, dischargeM3S: .5 },
      { widthScale: 1, depthScale: 1, dischargeM3S: 12 },
    ]) {
      live.applyEdit({ shape, course: null });
      const terrain = makeTerrainHeight(live.course, 20260928);
      const matched = live.boulders.filter(b => (b.s ?? 0) >= 1000 && caps.has(b.seed));
      expect(matched).toHaveLength(5);
      for (const b of matched) {
        const initial = initialized.find(rock => rock.seed === b.seed)!;
        expect([b.x, b.z, b.rx, b.ry, b.rz, b.rot, b.seed]).toEqual([initial.x, initial.z, initial.rx, initial.ry, initial.rz, initial.rot, initial.seed]);
        // Live edits recalculate y from sampled ground; roundoff does not alter
        // the shared Float32 mesh, but unrelated native rocks can move with edits.
        expect(b.y).toBeCloseTo(initial.y, 12);
        for (const other of live.boulders) if (other !== b) expect(Math.hypot(b.x - other.x, b.z - other.z)).toBeGreaterThanOrEqual(.85 * (Math.max(b.rx, b.rz) + Math.max(other.rx, other.rz)) - 1e-9);
        const s = mainBoulderShape(b), P = s.positions, I = s.indices;
        // Downward-facing triangle centroids are additional underside checks on
        // the actual live meshes, independent of the footprint grid used to place them.
        for (let t = 0; t < I.length; t += 3) {
          const a = I[t] * 3, c = I[t + 1] * 3, d = I[t + 2] * 3;
          const ny = (P[c + 2] - P[a + 2]) * (P[d] - P[a]) - (P[c] - P[a]) * (P[d + 2] - P[a + 2]);
          if (ny >= 0) continue;
          const x = (P[a] + P[c] + P[d]) / 3, z = (P[a + 2] + P[c + 2] + P[d + 2]) / 3;
          expect((P[a + 1] + P[c + 1] + P[d + 1]) / 3).toBeLessThanOrEqual(terrain(x, z) + .02);
        }
      }
    }
  }, 60000);

  it('ignores invalid support without corrupting native caps', () => {
    setRiverHeadwaters(true); setRiverShape(null);
    const course = defaultRiverCourse(), terrain = makeTerrainHeight(course, 20260928), native = makeTerrainHeight(course, 20260928, false);
    const rocks = placeBoulders(course, terrain, 20260928, native);
    const before = rocks.map(b => ({ ...b }));
    applyMainRibCaps(rocks, () => NaN, 20260928);
    expect(rocks).toEqual(before);
  }, 60000);

  it('counts a pending native position when that cap will later be skipped', () => {
    setRiverHeadwaters(true); setRiverShape(null);
    const course = defaultRiverCourse(), terrain = makeTerrainHeight(course, 20260928), native = makeTerrainHeight(course, 20260928, false);
    const rocks = placeBoulders(course, terrain, 20260928, native);
    const first = { ...rocks.find(b => b.seed === 102463419)! }, pending = { ...rocks.find(b => b.seed === 924926638)! };
    const target = mainRapidsAt(1090);
    first.x = 0; first.z = 0;
    pending.x = target.x + target.tz * 6; pending.z = target.z - target.tx * 6;
    const trial = [first, pending], before = trial.map(b => ({ ...b }));
    // The first target is occupied by the pending native rock. Its own later
    // target lacks valid terrain, so excluding pending positions would overlap it.
    applyMainRibCaps(trial, (x, z) => Math.hypot(x - pending.x, z - pending.z) < .01 ? terrain(x, z) : NaN, 20260928);
    expect(trial).toEqual(before);
  }, 60000);
});

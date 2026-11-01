/**
 * Checks the cliff's attached rock mass independently of texture appearance.
 * These checks catch open seams, collapsed ledges and wrong surface queries;
 * the parent gauntlet still owns neutral and textured rendered acceptance.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { appendWaterfallCoreCollar, buildWaterfallCliffGeometry, createWaterfallCoreSampler } from '../riverWaterfallCliff';
import { defaultRiverCourse, makeTerrainHeight, RIVER_SHAPE_DEFAULT } from '@/systems/world3d/river/riverReach';
import { WATERFALL, riverHeadwatersEnabled, setRiverHeadwaters, waterfallHydraulics, waterfallRockBoundary, waterfallSourceRockHeight } from '@/systems/world3d/river/riverHeadwaters';

type Slab = { footprint: { n: number; h: number }[]; depth: number; frontTriangles: number[]; bridgeTriangles: number[] };
describe('attached waterfall cliff slabs', () => {
  const course = defaultRiverCourse(); const crest = course.at(WATERFALL.crestS);
  const shape = RIVER_SHAPE_DEFAULT; const width = waterfallHydraulics(shape).width;
  let geometry: THREE.BufferGeometry; let positions: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  let indices: THREE.BufferAttribute; let slabs: Slab[];
  let sample: ReturnType<typeof createWaterfallCoreSampler>;
  const nAt = (i: number) => (positions.getX(i) - crest.x) * crest.tz - (positions.getZ(i) - crest.z) * crest.tx;
  const fAt = (i: number) => (positions.getX(i) - crest.x) * crest.tx + (positions.getZ(i) - crest.z) * crest.tz;
  const forward = (p: THREE.Vector3) => (p.x - crest.x) * crest.tx + (p.z - crest.z) * crest.tz;
  const edgeKey = (a: number, b: number) => Math.min(a, b) + ':' + Math.max(a, b);
  beforeAll(() => {
    geometry = buildWaterfallCliffGeometry({ seed: 20260928, shape, course });
    positions = geometry.getAttribute('position'); indices = geometry.index!;
    slabs = geometry.userData.attachedSlabs as Slab[];
    sample = createWaterfallCoreSampler({ seed: 20260928, shape, course });
  }, 60000);
  afterAll(() => geometry.dispose());

  it('retains constructed rails and streams the same native face identities', () => {
    const source = sample.nativeBoundary;
    for (const name of ['crest', 'floor'] as const) {
      expect([...source.constructedRails[name]].sort((a,b)=>a-b))
        .toEqual([...source.legacyRails[name]].sort((a,b)=>a-b));
    }
    let count = 0;
    source.forEachFace((element, ids, points, cap) => {
      expect(ids).toEqual([indices.getX(element), indices.getX(element+1), indices.getX(element+2)]);
      // Check actual coordinates at bounded representative faces rather than
      // turning the geometry visitor into a second retained core copy.
      if (element % 3000 === 0) for (let k=0;k<3;k++) {
        expect(points[k]).toEqual([positions.getX(ids[k]),positions.getY(ids[k]),positions.getZ(ids[k])]);
      }
      expect(typeof cap).toBe('boolean'); count++;
    });
    expect(count).toBe(indices.count/3); expect(source.faceCount).toBe(count);
  });

  it('observes a real crest transition without changing its knots or drawing', () => {
    const edge = [[-155.75,77.3016586303711,-35.25],[-155.25,77.29853057861328,-35.25]];
    const n = (p:number[]) => (p[0]-crest.x)*crest.tz-(p[2]-crest.z)*crest.tx;
    const plain = sample.traceEdge(n(edge[0]),edge[0][1],n(edge[1]),edge[1][1]);
    const events: Parameters<NonNullable<Parameters<typeof sample.traceEdge>[4]>>[0][] = [];
    const observed = sample.traceEdge(n(edge[0]),edge[0][1],n(edge[1]),edge[1][1],event=>events.push(event));
    expect(observed.map(k=>[k.t,...k.point.toArray()])).toEqual(plain.map(k=>[k.t,...k.point.toArray()]));
    const selected = events.filter(e=>e.kind==='selected-span');
    expect(selected.some(e=>e.feature?.kind==='crest-rail')).toBe(true);
    expect(selected.some(e=>e.feature?.kind==='face')).toBe(true);
    expect(selected.every(e=>e.lo!<e.hi!&&e.feature!.vertices.length>=2)).toBe(true);
    expect(events.some(e=>e.kind==='rejected-face')).toBe(true);
  });

  it('closes every inserted front and base ring onto exactly two faces', () => {
    const counts = new Map<string, number>();
    for (const slab of slabs) {
      expect(slab.frontTriangles.length).toBeGreaterThan(0);
      expect(slab.bridgeTriangles.length).toBeGreaterThan(0);
      for (let t = 0; t < slab.bridgeTriangles.length; t += 2) {
        const a = slab.bridgeTriangles[t], b = slab.bridgeTriangles[t + 1];
        counts.set(edgeKey(indices.getX(a), indices.getX(a + 1)), 0);
        counts.set(edgeKey(indices.getX(b + 1), indices.getX(b + 2)), 0);
      }
    }
    for (let t = 0; t < indices.count; t += 3) for (let e = 0; e < 3; e += 1) {
      const key = edgeKey(indices.getX(t + e), indices.getX(t + (e + 1) % 3));
      if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
    }
    expect(counts.size).toBeGreaterThan(50);
    expect([...counts.values()].filter(count => count !== 2)).toEqual([]);
  });

  it('gives every slab finite top and underside area with its base still attached', () => {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (const [slabIndex, slab] of slabs.entries()) {
      let upArea = 0, downArea = 0;
      for (const t of slab.bridgeTriangles) {
        a.fromBufferAttribute(positions, indices.getX(t)); b.fromBufferAttribute(positions, indices.getX(t + 1)); c.fromBufferAttribute(positions, indices.getX(t + 2));
        const normal = b.clone().sub(a).cross(c.clone().sub(a));
        expect(normal.length()).toBeGreaterThan(1e-7);
        if (normal.y > 0) upArea += normal.y * 0.5; else downArea -= normal.y * 0.5;
      }
      // The nearest right buttress deliberately thins at its upper join.
      // Its exposed top must retain real area despite that tapered thickness;
      // the other ledges retain their existing broader top-area contract.
      const span = Math.max(...slab.footprint.map(p => p.n)) - Math.min(...slab.footprint.map(p => p.n));
      // Either oriented cap sum can include the thinned upper ledge. Retain
      // at least half the footprint span times its 0.2m minimum thickness;
      // the unchanged slabs retain their original five-square-meter bound.
      const minimumCapArea = slabIndex === 3 ? span * 0.1 : 5;
      expect(upArea).toBeGreaterThan(minimumCapArea); expect(downArea).toBeGreaterThan(minimumCapArea);
      const lower: number[] = [], upper: number[] = [];
      for (let k = 0; k < slab.bridgeTriangles.length; k += 2) {
        const t = slab.bridgeTriangles[k]; const front = indices.getX(t + 1), base = indices.getX(t + 2);
        expect(nAt(front)).toBeCloseTo(nAt(base), 4);
        expect(positions.getY(front)).toBeCloseTo(positions.getY(base), 5);
        const thickness = fAt(front) - fAt(base);
        if (slabIndex === 3) {
          expect(thickness).toBeGreaterThanOrEqual(0.1999); expect(thickness).toBeLessThanOrEqual(1.8001);
          const n = nAt(front), top = waterfallSourceRockHeight(n, width, waterfallRockBoundary(n, width));
          const h = 100 * (positions.getY(front) + 4) / (top + 4);
          if (h < 50) lower.push(thickness); else if (h > 61) upper.push(thickness);
        } else expect(thickness).toBeCloseTo(slab.depth, 4);
      }
      if (slabIndex === 3) {
        // Inspect the actual stored joining faces, independently of the
        // taper formula: lower support must be thicker than the upper lip.
        expect(lower.length).toBeGreaterThan(0); expect(upper.length).toBeGreaterThan(0);
        const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
        expect(mean(lower) - mean(upper)).toBeGreaterThan(1);
      }
    }
  });

  it('keeps caps finite instead of extruding internal triangulation cracks', () => {
    for (const slab of slabs) for (let t = 0; t < slab.bridgeTriangles.length; t += 2) {
      const index = indices.getX(slab.bridgeTriangles[t]); const n = nAt(index), y = positions.getY(index);
      const top = waterfallSourceRockHeight(n, width, waterfallRockBoundary(n, width));
      const h = 100 * (y + 4) / (top + 4);
      const distance = Math.min(...slab.footprint.map((a, k) => {
        const b = slab.footprint[(k + 1) % slab.footprint.length];
        return Math.abs((b.n - a.n) * (h - a.h) - (b.h - a.h) * (n - a.n)) / Math.hypot(b.n - a.n, b.h - a.h);
      }));
      expect(distance).toBeLessThan(0.001);
    }
  });

  it('preserves the wet corridor and its exact launch rail', () => {
    for (const n of [-width * 0.45, 0, width * 0.45]) {
      for (const y of [8, 25, 50, 70]) expect(forward(sample(n, y))).toBeCloseTo(-3.8, 3);
      const top = waterfallSourceRockHeight(n, width, waterfallRockBoundary(n, width));
      const p = sample(n, top);
      expect(p.y).toBeCloseTo(top, 2); expect(forward(p)).toBeCloseTo(waterfallRockBoundary(n, width), 2);
    }
  });

  it('returns the actual crest and floor rails between boundary vertices', () => {
    for (const n of [-142.13, -125.27, -91.11, -44.18, -21.37, 21.37, 44.18, 91.11, 125.27, 142.13]) {
      const top = waterfallSourceRockHeight(n, width, waterfallRockBoundary(n, width));
      for (const height of [top, -4]) {
        const rail: number[] = [];
        for (let i = 0; i < positions.count; i += 1) {
          const vertexTop = waterfallSourceRockHeight(nAt(i), width, waterfallRockBoundary(nAt(i), width));
          if (Math.abs(positions.getY(i) - (height === -4 ? -4 : vertexTop)) < 0.0001) rail.push(i);
        }
        rail.sort((a, b) => nAt(a) - nAt(b));
        const right = rail.findIndex(i => nAt(i) >= n); expect(right).toBeGreaterThan(0);
        const a = rail[right - 1], b = rail[right], t = (n - nAt(a)) / (nAt(b) - nAt(a));
        const expected = new THREE.Vector3().fromBufferAttribute(positions, a).lerp(new THREE.Vector3().fromBufferAttribute(positions, b), t);
        expect(sample(n, height).distanceTo(expected)).toBeLessThan(0.00001);
      }
    }
  });

  it('supports the dry crest within a short rock shoulder', () => {
    for (const n of [-40, -25, 25, 40]) {
      const boundary = waterfallRockBoundary(n, width), top = waterfallSourceRockHeight(n, width, boundary);
      const p = sample(n, -4 + (top + 4) * 0.86);
      const recess = boundary - forward(p);
      expect(recess).toBeGreaterThan(0.5); expect(recess).toBeLessThan(2.3);
    }
  });

  it('supports near-fall dry shoulders without the former broad roof', () => {
    // LOW was the clearest rendered failure: n=15 advanced 19.2m between
    // these heights. Check both flows and sides, outside the full worn notch;
    // a six-meter bound retains finite relief and attached slab overhangs.
    for (const selected of [shape, { ...shape, widthScale: 0.6, depthScale: 2, dischargeM3S: 0.5 }]) {
      const sampler = selected === shape ? sample : createWaterfallCoreSampler({ seed: 20260928, shape: selected, course });
      const w = waterfallHydraulics(selected).width;
      for (const n of [-25, -20, -15, 15, 20, 25]) {
        const widestWornEdge = w * (0.5 + (1 - 0.68) * 0.75) + 0.8 + 4.5;
        if (Math.abs(n) <= widestWornEdge + 4) continue;
        const top = waterfallSourceRockHeight(n, w, waterfallRockBoundary(n, w));
        const lower = sampler(n, -4 + (top + 4) * 0.68), upper = sampler(n, -4 + (top + 4) * 0.84);
        expect(forward(upper) - forward(lower)).toBeLessThan(6);
        // The actual crest is a bent native rail, already checked above;
        // interpolation between its vertices differs from the analytic curve.
      }
      for (const n of [-w * 0.45, 0, w * 0.45]) for (const y of [8, 25, 50, 70]) {
        expect(forward(sampler(n, y))).toBeCloseTo(-3.8, 3);
      }
    }
  }, 60000);

  it('joins collars through every native crest and floor rail bend', () => {
    const nA = -44.18, nB = -38.27;
    for (const y of [200, -10]) {
      const knots = sample.traceEdge(nA, y, nB, y);
      expect(knots.length).toBeGreaterThan(4);
      const rail = new Map<string, THREE.Vector3>();
      for (let i = 0; i < positions.count; i++) {
        const n = nAt(i), height = positions.getY(i);
        const top = waterfallSourceRockHeight(n, width, waterfallRockBoundary(n, width));
        if (n > nA && n < nB && Math.abs(height - (y < -4 ? -4 : top)) < 0.0001) {
          const p = new THREE.Vector3().fromBufferAttribute(positions, i); rail.set(p.toArray().join(','), p);
        }
      }
      expect(rail.size).toBeGreaterThan(2);
      for (const p of rail.values()) expect(knots.some(k => k.point.distanceTo(p) < 1e-6)).toBe(true);
      const pa = new THREE.Vector3(crest.x + crest.tz * nA - crest.tx * 4, y, crest.z - crest.tx * nA - crest.tz * 4);
      const pb = new THREE.Vector3(crest.x + crest.tz * nB - crest.tx * 4, y, crest.z - crest.tx * nB - crest.tz * 4);
      const collar: number[] = []; appendWaterfallCoreCollar(sample, pa, pb, crest, collar);
      expect(collar.length).toBe((knots.length - 1) * 18);
      for (let i = 1; i < knots.length; i++) {
        expect(new THREE.Vector3().fromArray(collar, (i - 1) * 18 + 6).distanceTo(knots[i - 1].point)).toBeLessThan(1e-6);
        expect(new THREE.Vector3().fromArray(collar, (i - 1) * 18 + 12).distanceTo(knots[i].point)).toBeLessThan(1e-6);
      }
    }
  });

  it('follows native interior triangle transitions in either edge direction', () => {
    const a = { n: -43.27, y: 50.18 }, b = { n: -37.11, y: 51.27 };
    const knots = sample.traceEdge(a.n, a.y, b.n, b.y);
    const reverse = sample.traceEdge(b.n, b.y, a.n, a.y);
    expect(knots.length).toBeGreaterThan(5);
    for (let i = 1; i < knots.length; i++) {
      const start = knots[i - 1], end = knots[i]; if (end.t - start.t < 1e-8) continue;
      const t = (start.t + end.t) / 2, actual = start.point.clone().lerp(end.point, 0.5);
      expect(actual.distanceTo(sample(a.n + (b.n - a.n) * t, a.y + (b.y - a.y) * t))).toBeLessThan(0.0001);
    }
    expect(reverse.length).toBe(knots.length);
    knots.forEach((k, i) => {
      const r = reverse[reverse.length - 1 - i];
      expect(r.t).toBeCloseTo(1 - k.t, 8); expect(r.point.distanceTo(k.point)).toBeLessThan(0.0001);
    });
  });

  it('retains both native cap endpoints at a slab front transition', () => {
    const slab = slabs[0];
    const n = slab.footprint.reduce((sum, p) => sum + p.n, 0) / slab.footprint.length;
    const h = slab.footprint.reduce((sum, p) => sum + p.h, 0) / slab.footprint.length;
    const y = -4 + (waterfallSourceRockHeight(n, width, waterfallRockBoundary(n, width)) + 4) * h / 100;
    const nA = Math.min(...slab.footprint.map(p => p.n)) - 1, nB = Math.max(...slab.footprint.map(p => p.n)) + 1;
    const knots = sample.traceEdge(nA, y, nB, y);
    // An ideal cap has duplicate t endpoints. Native Float32 storage can
    // give it a few micrometers of projected width; retain that real cap
    // rather than requiring the trace to flatten the stored geometry.
    const caps = knots.slice(1).map((k, i) => ({ a: knots[i], b: k }))
      .filter(({ a, b }) => Math.abs(a.t - b.t) < 1e-5 && a.point.distanceTo(b.point) > 0.0001);
    // A stored cap is two triangles, so a native edge intersection can
    // divide its thickness into several consecutive trace pieces.
    const transitions: Array<{ t: number; thickness: number }> = [];
    for (const { a, b } of caps) {
      expect(a.point.y).toBeCloseTo(b.point.y, 5);
      const thickness = Math.abs(forward(a.point) - forward(b.point));
      const prior = transitions[transitions.length - 1];
      if (prior && Math.abs(prior.t - a.t) < 1e-5) prior.thickness += thickness;
      else transitions.push({ t: a.t, thickness });
    }
    expect(transitions.length).toBe(2);
    transitions.forEach(transition => expect(transition.thickness).toBeCloseTo(slab.depth, 3));
  });

  it('closes eligible fine and outer edges sampled from the real mountain', () => {
    const enabled = riverHeadwatersEnabled(); setRiverHeadwaters(true);
    try {
      const height = makeTerrainHeight(course, 20260928); let collars = 0;
      // A narrow set of actual terrain cells checks high/low joins without
      // launching the numerical river or rendering the whole landscape.
      for (const step of [0.5, 2]) for (const n of [-120, -70, -35, -15, 0, 15, 35, 70, 120]) {
        const f = waterfallRockBoundary(n, width), x = crest.x + crest.tx * f + crest.tz * n, z = crest.z + crest.tz * f - crest.tx * n;
        const cx = Math.floor(x / step) * step, cz = Math.floor(z / step) * step;
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          const points = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([i, j]) => {
            const px = cx + (dx + i) * step, pz = cz + (dz + j) * step;
            return new THREE.Vector3(px, Math.fround(height(px, pz)), pz);
          });
          if (Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)) <= 30) continue;
          for (let i = 0; i < 4; i++) {
            const a = points[i], b = points[(i + 1) % 4]; if (Math.abs(a.y - b.y) > 2) continue;
            const collar: number[] = []; appendWaterfallCoreCollar(sample, a, b, crest, collar);
            expect(collar.length).toBeGreaterThanOrEqual(18); expect(collar.every(Number.isFinite)).toBe(true); collars++;
          }
        }
      }
      expect(collars).toBeGreaterThan(20);
    } finally { setRiverHeadwaters(enabled); }
  }, 60000);

  it('queries the frontmost real face on each side of a ledge edge', () => {
    // Compare the accelerated sampler against independent brute-force ray
    // intersection. Include slab interiors and both sides of a cap edge.
    // An exactly edge-on cap has no query-plane area; Float32 positions can
    // turn it into a microscopic sliver, so its singular midpoint is not a
    // stable independent ray oracle. Two-centimeter offsets test the actual
    // ledge transition without accepting a point from behind the front face.
    const queries: Array<{ n: number; y: number }> = [];
    for (const slab of slabs) {
      const n = slab.footprint.reduce((s, p) => s + p.n, 0) / slab.footprint.length;
      const h = slab.footprint.reduce((s, p) => s + p.h, 0) / slab.footprint.length;
      const top = waterfallSourceRockHeight(n, width, waterfallRockBoundary(n, width));
      queries.push({ n, y: -4 + (top + 4) * h / 100 });
      const t = slab.bridgeTriangles[Math.floor(slab.bridgeTriangles.length / 4) * 2];
      const ids = [indices.getX(t), indices.getX(t + 1), indices.getX(t + 2)];
      const capN = ids.reduce((s, i) => s + nAt(i), 0) / 3, capY = ids.reduce((s, i) => s + positions.getY(i), 0) / 3;
      queries.push({ n: capN, y: capY - 0.02 }, { n: capN, y: capY + 0.02 });
    }
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), hit = new THREE.Vector3();
    for (const query of queries) {
      const origin = new THREE.Vector3(crest.x + crest.tz * query.n + crest.tx * 100, query.y, crest.z - crest.tx * query.n + crest.tz * 100);
      const ray = new THREE.Ray(origin, new THREE.Vector3(-crest.tx, 0, -crest.tz)); let best = -Infinity;
      for (let t = 0; t < indices.count; t += 3) {
        a.fromBufferAttribute(positions, indices.getX(t)); b.fromBufferAttribute(positions, indices.getX(t + 1)); c.fromBufferAttribute(positions, indices.getX(t + 2));
        if (ray.intersectTriangle(a, b, c, false, hit)) best = Math.max(best, forward(hit));
      }
      expect(best).not.toBe(-Infinity); expect(forward(sample(query.n, query.y))).toBeCloseTo(best, 3);
    }
  }, 60000);
});

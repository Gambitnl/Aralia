import { describe, expect, it } from 'vitest';
import { buildBankCommonGeometry, type FrozenBankTerrain, type BankCommonGeometry } from '../riverBankCommonGeometry';
type V = [number, number, number]; // x,y,z, same as captured packet
const d = 1 / 64, x = 36, z = 22;
function packet(tris: V[][], sources = ['ground-control'], owners = tris.map(() => 0)): FrozenBankTerrain {
  return { identity: 'analytic-control', sourceSha256: 'a'.repeat(64), vertices: tris.flat(2),
    triangles: owners.map(objectIndex => ({ objectIndex })), objects: sources.map(sourceName => ({ sourceName })) };
}
function square(bottom: (x: number, z: number) => number, x0 = x, z0 = z): V[][] {
  const p: V[] = [[x0, bottom(x0, z0), z0], [x0 + d, bottom(x0 + d, z0), z0],
    [x0 + d, bottom(x0 + d, z0 + d), z0 + d], [x0, bottom(x0, z0 + d), z0 + d]];
  return [[p[0], p[2], p[1]], [p[0], p[3], p[2]]]; // upward orientation
}
function geometry(p: FrozenBankTerrain): BankCommonGeometry {
  const r = buildBankCommonGeometry(p); if (!r.ok) throw new Error(r.reason); return r.geometry;
}
describe('unwired fixed bank continuous terrain qualification', () => {
  it('integrates analytic clipped slope with an independent rectangle-range bracket', () => {
    const g = geometry(packet(square(xx => xx - x)));
    expect(g.describeCell(0).status).toBe('ordinary-ground-qualified');
    const q = g.measureGroundAtLevel(0, d / 2), expected = d ** 3 / 8;
    expect(q.volumeM3).toBeCloseTo(expected, 18);
    expect(q.wetAreaM2).toBeCloseTo(d * d / 2, 18);
    expect(q.depthSquaredIntegralM4).toBeCloseTo(d ** 4 / 24, 20);
    expect(q.potentialIntegralM4).toBeCloseTo(d ** 4 / 24, 20);
    expect(q.volumeBracketM3[0]).toBeLessThanOrEqual(expected);
    expect(q.volumeBracketM3[1]).toBeGreaterThanOrEqual(expected);
    expect(q.volumeBracketM3[1] - q.volumeBracketM3[0]).toBeGreaterThan(expected * 0.01);
    expect(q.basinResolved).toBe(true);
    expect(q.basinComponents).toBe(1);
    expect(g.measureGroundAtLevel(0, 0).wetPolygons).toEqual([]);
  });
  it('keeps arbitrarily small positive film rather than rounding it dry', () => {
    const g = geometry(packet(square(() => 0))), q = g.measureGroundAtLevel(0, 1e-12);
    expect(q.volumeM3).toBe(d * d * 1e-12);
    expect(q.wetAreaM2).toBe(d * d);
    expect(q.wetPolygons.length).toBe(2);
    expect(q.volumeBracketM3).toEqual([q.volumeM3, q.volumeM3]);
    const dry = g.measureGroundAtLevel(0, 0);
    expect(dry.volumeM3).toBe(0); expect(dry.wetAreaM2).toBe(0);
    expect(dry.wetPolygons).toEqual([]); expect(dry.basinComponents).toBe(0);
  });
  it('rejects double counted ground and continuously uncovered geometry', () => {
    const tris = square(() => 0);
    const overlap = geometry(packet([...tris, tris[0]])).describeCell(0);
    expect(overlap.status).toBe('overlapping-ground'); expect(overlap.groundOverlapM2).toBeGreaterThan(0);
    const hole = geometry(packet([tris[0]])).describeCell(0);
    expect(hole.status).toBe('uncovered-ground'); expect(hole.groundCoverageM2).toBe(d * d / 2);
  });
  it('reports an actual underside gap even when an affine upper plane wins', () => {
    const ground = square(() => 0), lower = square(() => 1).map(t => [...t].reverse()), upper = square(() => 1.1);
    const g = geometry(packet([...ground, ...lower, ...upper], ['ground-control', 'rock-control'], [0, 0, 1, 1, 1, 1]));
    const q = g.describeCell(0);
    expect(q.status).toBe('undercut-water-relevance-unresolved');
    expect(q.undercut?.gapM).toBe(1);
    expect(q.undercut?.topY).toBe(1.1);
    expect(() => g.measureGroundAtLevel(0, 0.1)).toThrow('undercut');
  });
  it('does not approve rock coverage from absence of a center underside', () => {
    const g = geometry(packet([...square(() => 0), ...square(() => 1)], ['ground-control', 'rock-control'], [0, 0, 1, 1]));
    expect(g.describeCell(0).status).toBe('rock-water-relevance-unresolved');
  });
  it('detects disconnected wet ground basins without inventing allocation', () => {
    // Piecewise affine roof over the center x rail leaves two separate lows.
    const p: V[][] = [];
    for (const [a, b] of [[0, d / 2], [d / 2, d]]) {
      const h = (xx: number) => 1 - Math.abs(xx - (x + d / 2)) / (d / 2);
      const A: V = [x + a, h(x + a), z], B: V = [x + b, h(x + b), z], C: V = [x + b, h(x + b), z + d], D: V = [x + a, h(x + a), z + d];
      p.push([A, C, B], [A, D, C]);
    }
    const g = geometry(packet(p)), q = g.measureGroundAtLevel(0, 0.25);
    expect(q.basinComponents).toBe(2); expect(q.basinResolved).toBe(false);
    const atRidge = g.measureGroundAtLevel(0, 1);
    expect(atRidge.basinComponents).toBe(2); expect(atRidge.basinResolved).toBe(false);
    const aboveRidge = g.measureGroundAtLevel(0, 1 + 1e-12);
    expect(aboveRidge.basinComponents).toBe(1); expect(aboveRidge.basinResolved).toBe(true);
  });
  it('refuses fixed source/bin caps and malformed coordinates', () => {
    const t = square(() => 0)[0];
    const many = buildBankCommonGeometry(packet(Array(25).fill(t)));
    expect(many.ok).toBe(false); if (!many.ok) expect(many.reason).toContain('per-bin');
    const broad: V[][] = [[[36, 0, 22], [38, 0, 24], [38, 0, 22]]];
    const r = buildBankCommonGeometry(packet(Array(7).fill(broad[0])));
    expect(r.ok).toBe(false); if (!r.ok) expect(r.reason).toContain('insertion');
    const invalid = packet(square(() => 0));
    expect(buildBankCommonGeometry({ ...invalid, vertices: [NaN, ...Array(17).fill(0)] }).ok).toBe(false);
  });
  it('never exposes mutable private terrain vertices through wet geometry', () => {
    const g = geometry(packet(square(() => 0))), before = g.measureGroundAtLevel(0, 0.5);
    const point = before.wetPolygons[0][0];
    expect(Object.isFrozen(point)).toBe(true);
    expect(Object.isFrozen(before.wetPolygons[0])).toBe(true);
    expect(Object.isFrozen(before.wetPolygons)).toBe(true);
    expect(Reflect.set(point, 2, 100)).toBe(false);
    const after = g.measureGroundAtLevel(0, 0.5);
    expect(after.volumeM3).toBe(before.volumeM3);
    expect(after.potentialIntegralM4).toBe(before.potentialIntegralM4);
    expect(after.wetPolygons).toEqual(before.wetPolygons);
    expect(after.wetPolygons[0][0]).not.toBe(point);
    expect(g.describeCell(0).status).toBe('ordinary-ground-qualified');
  });
});

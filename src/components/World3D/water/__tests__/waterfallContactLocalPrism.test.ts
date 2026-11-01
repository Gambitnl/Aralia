/** Coordinate checks for native contact prisms; these do not execute a GPU. */
import { describe, expect, it } from 'vitest';
import { createContactLocalPrism, measureFootprintContactPrism, measureUploadedContactPrismRelative, measureClosedContactCorners, measureOriginalContactPrism, measureUploadedContactPrism, measureWorldContactPrism, type PrismVector } from '../waterfallContactLocalPrism';

describe('native contact local prism representation', () => {
  it('keeps the original triangle integration bit-identical for skewed and thin packets', () => {
    function original(c: ArrayLike<number>) {
      const p=(i:number)=>[c[i*3],c[i*3+1],c[i*3+2]];
      const faces=[[0,1,2,3],[7,6,5,4],[1,0,4,5],[2,1,5,6],[3,2,6,7],[0,3,7,4]];
      let signedVolume=0;const moment=[0,0,0];
      for(const f of faces)for(const tri of [[f[0],f[1],f[2]],[f[0],f[2],f[3]]]) {
        const [a,b,d]=tri.map(p),cross=[b[1]*d[2]-b[2]*d[1],b[2]*d[0]-b[0]*d[2],b[0]*d[1]-b[1]*d[0]];
        const volume=a.reduce((sum,x,i)=>sum+x*cross[i],0)/6;signedVolume+=volume;
        for(let k=0;k<3;k++)moment[k]+=volume*(a[k]+b[k]+d[k])/4;
      }
      const volume=Math.abs(signedVolume),centroid=moment.map(x=>x/signedVolume);
      return {signedVolume,volume,centroid,firstMoment:centroid.map(x=>x*volume)};
    }
    for(let i=0;i<120;i++) {
      const frame=createContactLocalPrism([[0,60,0],[.4,60.3,0],[.4,60.3,.2],[0,60,.2]],10**(-2-i/5));
      expect(measureClosedContactCorners(frame.localCorners)).toEqual(original(frame.localCorners));
      expect(measureClosedContactCorners(frame.worldCorners)).toEqual(original(frame.worldCorners));
    }
  });
  const flat: PrismVector[] = [[0, 60, 0], [1, 60, 0], [1, 60, 1], [0, 60, 1]];
  // Plain copies compare values across the test environment's typed-array realms.
  const copyFrame = (frame: ReturnType<typeof createContactLocalPrism>) => ({
    ...frame, origin: [...frame.origin], u: [...frame.u], v: [...frame.v], normal: [...frame.normal],
    localCorners: Array.from(frame.localCorners), worldCorners: Array.from(frame.worldCorners),
  });

  it('reuses temporary corners without changing measurements or retained results', () => {
    const storage = { localCorners: new Float32Array(24), worldCorners: new Float64Array(24) };
    const scratch = new Float64Array(24);
    const retained = createContactLocalPrism(flat, .01), before = copyFrame(retained);
    for (const thickness of [.04, 1e-8, 1e-50, Number.MIN_VALUE]) {
      const points = flat.map(p => [p[0] * 2, p[1] + p[0] * .25, p[2]] as PrismVector);
      const owned = createContactLocalPrism(points, thickness);
      const borrowed = createContactLocalPrism(points, thickness, storage);
      expect(borrowed).toEqual(owned);
      const world = measureWorldContactPrism(borrowed, scratch), saved = structuredClone(world);
      expect(world).toEqual(measureWorldContactPrism(owned));
      expect(measureOriginalContactPrism(borrowed, scratch)).toEqual(measureOriginalContactPrism(owned));
      expect(world).toEqual(saved);
      expect(copyFrame(retained)).toEqual(before);
    }
  });

  it('rejects undersized or aliased scratch before changing the measured geometry', () => {
    const frame = createContactLocalPrism(flat, .01), before = copyFrame(frame);
    expect(() => createContactLocalPrism(flat, .01, { localCorners: new Float32Array(23), worldCorners: new Float64Array(24) })).toThrow('storage');
    const shared = new ArrayBuffer(192);
    expect(() => createContactLocalPrism(flat, .01, { localCorners: new Float32Array(shared, 0, 24), worldCorners: new Float64Array(shared) })).toThrow('storage');
    for (const measure of [measureWorldContactPrism, measureOriginalContactPrism]) {
      expect(() => measure(frame, new Float64Array(23))).toThrow('storage');
      expect(() => measure(frame, frame.worldCorners)).toThrow('storage');
      expect(() => measure(frame, new Float64Array(frame.localCorners.buffer))).toThrow('storage');
    }
    expect(copyFrame(frame)).toEqual(before);
  });

  it('retains thin geometry that the original altitude corners cannot store', () => {
    const frame = createContactLocalPrism(flat, 1e-8);
    const old = measureWorldContactPrism(frame), local = measureUploadedContactPrism(frame);
    expect(old.volume).toBe(0);
    expect(Math.abs(local.volume / 1e-8 - 1)).toBeLessThan(1e-6);
    expect(local.centroid).toEqual([.5, 60, .5]);
    expect(frame.localCorners[2]).toBeGreaterThan(0);
    expect(frame.localCorners[14]).toBeLessThan(0);
  });

  it('preserves an oblique prism volume and first moment from uploaded fields', () => {
    const points: PrismVector[] = [[0, 60, 0], [.4, 60.3, 0], [.4, 60.3, .2], [0, 60, .2]];
    const frame = createContactLocalPrism(points, 10.514e-6);
    const measured = measureUploadedContactPrism(frame), original = measureOriginalContactPrism(frame);
    expect(Math.abs(measured.volume / (.1 * 10.514e-6) - 1)).toBeLessThan(1e-6);
    expect(Math.abs(measured.volume / original.volume - 1)).toBeLessThan(1e-6);
    for (let axis = 0; axis < 3; axis++) {
      expect(Math.abs(measured.centroid[axis] - original.centroid[axis])).toBeLessThan(1e-6);
      expect(measured.firstMoment[axis]).toBeCloseTo(measured.volume * measured.centroid[axis], 12);
    }
  });

  it('keeps the same uploaded geometry and translated moments at another altitude', () => {
    const translation: PrismVector = [10000, -5000, 25];
    const moved = flat.map(p => p.map((x, axis) => x + translation[axis]) as PrismVector);
    const a = createContactLocalPrism(flat, 1e-8), b = createContactLocalPrism(moved, 1e-8);
    expect(Array.from(b.localCorners)).toEqual(Array.from(a.localCorners));
    const before = measureUploadedContactPrism(a), after = measureUploadedContactPrism(b);
    expect(after.volume).toBe(before.volume);
    for (let axis = 0; axis < 3; axis++) expect(after.centroid[axis] - before.centroid[axis]).toBe(translation[axis]);
  });

  it('detects corruption of the actual local corner packet independently of owned volume', () => {
    const frame = createContactLocalPrism(flat, .01);
    const before = measureUploadedContactPrism(frame).volume;
    for (let i = 0; i < 8; i++) frame.localCorners[i * 3 + 2] *= 2;
    expect(measureUploadedContactPrism(frame).volume).toBeCloseTo(before * 2, 12);
  });

  it('references a flat prism below binary64 world-coordinate spacing', () => {
    const frame = createContactLocalPrism(flat, 1e-16);
    const reference = measureFootprintContactPrism(flat, 1e-16, frame.origin);
    const local = measureUploadedContactPrismRelative(frame), old = measureOriginalContactPrism(frame);
    expect(reference.volume).toBe(1e-16);
    expect(reference.centroid).toEqual([.5, 60, .5]);
    expect(reference.firstMoment).toEqual([5e-17, 6e-15, 5e-17]);
    expect(Math.abs(local.volume / reference.volume - 1)).toBeLessThan(.01);
    expect(local.relativeCentroid).toEqual(reference.relativeCentroid);
    expect(old.volume).toBe(0);
    expect(old.centroid.every(Number.isNaN)).toBe(true);
  });

  it.each([1e-16, 10.514e-6])('compares oblique thickness %s with independent footprint area', thickness => {
    const points: PrismVector[] = [[10, 60, 20], [10.4, 60.3, 20], [10.4, 60.3, 20.2], [10, 60, 20.2]];
    const frame = createContactLocalPrism(points, thickness);
    const reference = measureFootprintContactPrism(points, thickness, frame.origin);
    const local = measureUploadedContactPrismRelative(frame);
    expect(Math.abs(reference.volume / (.1 * thickness) - 1)).toBeLessThan(1e-12);
    expect(Math.abs(local.volume / reference.volume - 1)).toBeLessThan(.01);
    expect(Math.hypot(...local.relativeCentroid.map((x, i) => x - reference.relativeCentroid[i]))).toBeLessThan(1e-6);
    expect(reference.firstMoment.every(Number.isFinite)).toBe(true);
    if (thickness === 1e-16) expect(Math.abs(measureOriginalContactPrism(frame).volume / reference.volume - 1)).toBeGreaterThan(.01);
  });

  it('uses an area-weighted asymmetric footprint centroid rather than the frame origin', () => {
    const points: PrismVector[] = [[0, 60, 0], [2, 60, 0], [1, 60, 1], [0, 60, 1]];
    const frame = createContactLocalPrism(points, 1e-16);
    const reference = measureFootprintContactPrism(points, 1e-16, frame.origin);
    const local = measureUploadedContactPrismRelative(frame);
    expect(reference.volume).toBe(1.5e-16);
    expect(reference.centroid[0]).toBeCloseTo(7 / 9, 14);
    expect(reference.centroid[2]).toBeCloseTo(4 / 9, 14);
    expect(reference.centroid[0]).not.toBe(frame.origin[0]);
    expect(Math.hypot(...local.relativeCentroid.map((x, i) => x - reference.relativeCentroid[i]))).toBeLessThan(1e-6);
  });

  it('retains the explicit film centroid offset before a world-coordinate addition', () => {
    const reference = measureFootprintContactPrism(flat, 1e-16, [0, 60, 0], [0, 5e-17, 0]);
    expect(reference.relativeCentroid).toEqual([.5, 5e-17, .5]);
    // The absolute centroid rounds to the base altitude, while the comparison
    // still retains the physical half-height independently in a common frame.
    expect(reference.centroid[1]).toBe(60);
  });

  it('rejects local underflow honestly instead of rescuing it from owned volume', () => {
    const frame = createContactLocalPrism(flat, 1e-50);
    const reference = measureFootprintContactPrism(flat, 1e-50, frame.origin);
    expect(reference.volume).toBe(1e-50);
    expect(() => measureUploadedContactPrism(frame)).toThrow('underflow');
  });

  it('detects independent volume and centroid corruption against the unchanged footprint', () => {
    const frame = createContactLocalPrism(flat, .01);
    const reference = measureFootprintContactPrism(flat, .01, frame.origin);
    for (let i = 0; i < 8; i++) frame.localCorners[i * 3 + 2] *= 2;
    expect(Math.abs(measureUploadedContactPrism(frame).volume / reference.volume - 1)).toBeGreaterThan(.01);
    for (let i = 0; i < 8; i++) frame.localCorners[i * 3] += .02;
    const corrupted = measureUploadedContactPrismRelative(frame);
    expect(Math.hypot(...corrupted.relativeCentroid.map((x, i) => x - reference.relativeCentroid[i]))).toBeGreaterThan(1e-6);
  });

  it('rejects zero-area and self-crossed original footprints', () => {
    expect(() => measureFootprintContactPrism([[0, 60, 0], [1, 60, 0], [2, 60, 0], [3, 60, 0]], .01)).toThrow();
    expect(() => measureFootprintContactPrism([[0, 60, 0], [1, 60, 1], [1, 60, 0], [0, 60, 1]], .01)).toThrow('winding');
  });

  it('rejects inverted local rings and a reflected placement basis', () => {
    const reversed = createContactLocalPrism(flat, .01);
    const front = reversed.localCorners.slice(0, 12);
    reversed.localCorners.copyWithin(0, 12, 24); reversed.localCorners.set(front, 12);
    expect(() => measureUploadedContactPrism(reversed)).toThrow('orientation');
    const reflected = createContactLocalPrism(flat, .01);
    reflected.normal = reflected.normal.map(x => -x) as PrismVector;
    expect(() => measureUploadedContactPrism(reflected)).toThrow('orientation');
  });

  it('retains the stored film director length and winding sign', () => {
    const reference = measureFootprintContactPrism(flat, .01, [0, 60, 0], [0, .01, 0], [0, 2, 0]);
    expect(reference.volume).toBe(.02);
    expect(reference.relativeCentroid[1]).toBe(.01);
    expect(() => measureFootprintContactPrism(flat, .01, [0, 60, 0], [0, 0, 0], [1, 0, 0])).toThrow('director');
  });

  it('requires valid planar geometry and reports collapsed closed geometry honestly', () => {
    expect(() => createContactLocalPrism(flat, 0)).toThrow('Invalid contact prism');
    expect(() => createContactLocalPrism([[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, .01, 1]], .1)).toThrow('Nonplanar contact prism');
    const collapsed = measureClosedContactCorners(new Float32Array(24));
    expect(collapsed.volume).toBe(0);
    expect(collapsed.centroid.every(Number.isNaN)).toBe(true);
  });
});

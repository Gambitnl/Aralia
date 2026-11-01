/** Numerical attribution gates for the isolated measured-albedo prototype.
 * GPU parity and rendered material acceptance remain separate proof steps. */
import { describe, expect, it } from 'vitest';
import { Fn, float, vec2 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { blendRockGaussian, createRockHistogramTextures, prepareRockHistogram, reconstructRockHistogram, rockCornerHash,
  rockPatchCoordinates, rockPatchCoordinatesFloat32, rockCornerHashTsl, prepareRockMipFiltering, type RockHistogram, sampleRockStochasticCpu, sampleRockStochasticTsl } from '../riverRockStochastic';

const image = (side: number, color: (i: number) => number[]) => Uint8Array.from({ length: side * side * 4 }, (_, k) => k % 4 === 3 ? 255 : color(Math.floor(k / 4))[k % 4]);
const linear = (v: number) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
describe('isolated histogram-preserving rock sampling', () => {
  it('registers captured textures in both probe and scene builders and isolates shader stages', () => {
    const data = prepareRockHistogram(image(4, i => [i, i, i]), 4, 4), maps = createRockHistogramTextures(data, prepareRockMipFiltering(data, 16));
    const renderer = new THREE.WebGPURenderer({ canvas: { width: 1, height: 1, style: {}, addEventListener() {}, setAttribute() {} } as unknown as HTMLCanvasElement });
    // These installed runtime inspection members are absent from @types/three.
    type BuildProbe = {
      shaderStage: 'fragment' | 'vertex';
      flowStagesNode: (node: THREE.Node, output: string) => unknown;
      uniforms: Record<'fragment' | 'vertex', Array<{ type: string }>>;
      bindings: Record<'fragment' | 'vertex', Record<string, unknown>>;
      codes: Record<'fragment' | 'vertex', Array<{ code: string }>>;
    };
    const backend = renderer.backend as unknown as { createNodeBuilder: (object: null, renderer: THREE.WebGPURenderer) => BuildProbe };
    const probe = backend.createNodeBuilder(null, renderer), scene = backend.createNodeBuilder(null, renderer);
    for (const [builder, explicit] of [[probe, true], [scene, false]] as const) {
      builder.shaderStage = 'fragment';
      builder.flowStagesNode(Fn(() => sampleRockStochasticTsl(data, maps, vec2(1, 2), explicit ? float(3.5) : undefined)
        .add(sampleRockStochasticTsl(data, maps, vec2(3, 4), explicit ? float(3.5) : undefined)))(), 'vec3');
      expect(builder.uniforms.fragment.filter(u => u.type === 'texture')).toHaveLength(2);
      expect(Object.keys(builder.bindings.fragment)).not.toHaveLength(0);
      const code = builder.codes.fragment.map(c => c.code).join('\n');
      expect(code.match(/fn riverRockHistogramSample/g)).toHaveLength(1);
      expect(code.match(/textureSampleLevel\(/g)).toHaveLength(6);
    }
    // A function compiled for one stage must not suppress the other stage's
    // bindings even when both stages belong to the same builder object.
    probe.shaderStage = 'vertex';
    probe.flowStagesNode(Fn(() => sampleRockStochasticTsl(data, maps, vec2(5, 6), float(0)))(), 'vec3');
    expect(probe.uniforms.vertex.filter(u => u.type === 'texture')).toHaveLength(2);
    maps.gaussian.dispose(); maps.inverse.dispose();
  });
  it('uses native mip generation because installed WebGPU DataTexture upload only transfers level zero', () => {
    const data = prepareRockHistogram(image(4, i => [i, i, i]), 4, 4), filtered = prepareRockMipFiltering(data, 16);
    const maps = createRockHistogramTextures(data, filtered);
    const renderer = new THREE.WebGPURenderer({ canvas: { width: 1, height: 1, style: {}, addEventListener() {}, setAttribute() {} } as unknown as HTMLCanvasElement });
    const backend = renderer.backend as unknown as {
      device: { queue: { writeTexture: (destination: { mipLevel: number }) => void } };
      set: (texture: THREE.Texture, value: object) => void;
      textureUtils: { updateTexture: (texture: THREE.Texture, options: { image: unknown }) => void };
    };
    const levels: number[] = [];
    backend.device = { queue: { writeTexture: destination => { levels.push(destination.mipLevel); } } };
    backend.set(maps.gaussian, { texture: {}, textureDescriptorGPU: { format: 'rgba16float' } });
    // This deliberately reproduces the failed configuration against the real
    // installed upload implementation, using a recording queue and no GPU.
    const legacy = maps.gaussian.mipmaps;
    maps.gaussian.mipmaps = filtered.gaussianMips.map(mip => ({ data: new Uint16Array(mip.data.length), width: mip.width, height: mip.height }));
    backend.textureUtils.updateTexture(maps.gaussian, { image: maps.gaussian.image });
    expect(levels).toEqual([0]);
    maps.gaussian.mipmaps = legacy;
    expect(maps.gaussian.mipmaps).toEqual([]);
    expect(maps.gaussian.generateMipmaps).toBe(true);
    maps.gaussian.dispose(); maps.inverse.dispose();
  });
  it('keeps constant measured colors at every filtered LOD and preserves LOD zero', () => {
    const data = prepareRockHistogram(image(16, () => [77, 115, 162]), 16, 16), filtered = prepareRockMipFiltering(data, 32);
    expect(filtered.levels).toBe(5);
    expect(filtered.inverseRows.slice(0, data.inverse.length)).toEqual(data.inverse);
    for (const lod of [0, 0.25, 1, 2.5, 4]) {
      expect(sampleRockStochasticCpu(data, -223.3554, 63.2519, filtered, lod)).toEqual(sampleRockStochasticCpu(data, -223.3554, 63.2519));
    }
    const varied = prepareRockHistogram(image(16, i => [(i * 47) % 256, (i * 29 + 81) % 256, (i * 13 + 122) % 256]), 16, 16);
    expect(sampleRockStochasticCpu(varied, -223.3554, 63.2519, prepareRockMipFiltering(varied, 32), 0)).toEqual(sampleRockStochasticCpu(varied, -223.3554, 63.2519));
    const maps = createRockHistogramTextures(data, filtered);
    // Installed WebGPU DataTexture upload ignores manual levels. An empty
    // list permits the native generation path to populate nonzero levels.
    expect(maps.gaussian.mipmaps).toHaveLength(0);
    expect(maps.gaussian.generateMipmaps).toBe(true);
    expect(maps.inverse.image.height).toBe(5);
    maps.gaussian.dispose(); maps.inverse.dispose();
  });
  it('averages native Gaussian texels and integrates nonlinear inverse colors instead of mapping only their mean', () => {
    const side = 4, lutSize = 257;
    const data: RockHistogram = { width: side, height: side, tileMeters: 1.5, lutSize, gaussianLimit: 2,
      origin: [0, 0, 0], basis: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], approximation: 'narrow nonlinear filter fixture',
      gaussian: Float32Array.from({ length: side * side * 4 }, (_, k) => k % 4 === 3 ? 0 : ((Math.floor(k / 4) % side + Math.floor(k / (side * 4))) % 2 ? -1 : 1)),
      inverse: Float32Array.from({ length: lutSize * 4 }, (_, k) => k % 4 === 3 ? 0 : ((Math.floor(k / 4) / (lutSize - 1) * 2 - 1) * 2) ** 2) };
    const filtered = prepareRockMipFiltering(data, 256);
    expect(Array.from(filtered.gaussianMips[1].data)).toEqual(Array(16).fill(0));
    expect(filtered.variances).toEqual([[0, 0, 0], [1, 1, 1], [1, 1, 1]]);
    sampleRockStochasticCpu(data, 13.5, -7.5, filtered, 2).forEach(v => { expect(v).toBeGreaterThan(0.8); expect(v).toBeLessThan(1.1); });
    expect(reconstructRockHistogram(data, [0, 0, 0])).toEqual([0, 0, 0]);
  });
  it('remains continuous across fractional mip levels and shared triangle edges', () => {
    const data = prepareRockHistogram(image(16, i => [(i * 47) % 256, (i * 29 + 81) % 256, (i * 13 + 122) % 256]), 16, 16), filtered = prepareRockMipFiltering(data, 64);
    for (const lod of [0.75, 1, 2.25]) {
      const a = sampleRockStochasticCpu(data, 0.45 - 1e-7, Math.sqrt(3) * 0.45, filtered, lod - 1e-6);
      const b = sampleRockStochasticCpu(data, 0.45 + 1e-7, Math.sqrt(3) * 0.45, filtered, lod + 1e-6);
      a.forEach((v, c) => expect(Math.abs(v - b[c])).toBeLessThan(0.00001));
    }
  });
  it('uses Float32 world coordinates and arithmetic for renderer parity at large signed positions', () => {
    const data = prepareRockHistogram(image(32, i => [(i * 47) % 256, (i * 29 + 81) % 256, (i * 13 + 122) % 256]), 32, 32);
    for (const x of [-299.569, 582.257]) {
      const xf = Math.fround(x), y = Math.fround(173.729);
      // Both doubles represent the same GPU input texel. They must have the
      // same oracle result even on a high-contrast measured texture fixture.
      expect(sampleRockStochasticCpu(data, xf - 1e-7, y)).toEqual(sampleRockStochasticCpu(data, xf + 1e-7, y));
      const p = rockPatchCoordinatesFloat32(xf, y);
      [...p.weights, ...p.uv.flat()].forEach(v => expect(v).toBe(Math.fround(v)));
      expect(p.uv).not.toEqual(rockPatchCoordinates(xf, y).uv);
      sampleRockStochasticCpu(data, xf, y).forEach(v => expect(v).toBe(Math.fround(v)));
    }
    expect(rockPatchCoordinatesFloat32(0, 0).weights).toEqual([1, 0, 0]);
    expect(rockCornerHashTsl(vec2(-7, 23), 8191)).toBeDefined();
  });
  it('preserves a uniform measured texture at every triangular phase', () => {
    const data = prepareRockHistogram(image(16, () => [77, 115, 162]), 16, 16);
    for (const [x, y] of [[0, 0], [0.6, 0.2], [-19.3, 15.8], [200.27, -31.9]]) {
      sampleRockStochasticCpu(data, x, y).forEach((v, c) => expect(v).toBeCloseTo(linear([77, 115, 162][c] / 255), 7));
    }
  });
  it('reconstructs measured linear RGB through the decorrelation and inverse histogram', () => {
    const rgba = image(32, i => [(i * 47) % 256, (i * 29 + 81) % 256, (i * 13 + 122) % 256]);
    const data = prepareRockHistogram(rgba, 32, 32);
    data.basis.forEach((a, i) => data.basis.forEach((b, j) => expect(a.reduce((sum, v, k) => sum + v * b[k], 0)).toBeCloseTo(Number(i === j), 10)));
    for (let i = 0; i < 1024; i++) {
      const actual = reconstructRockHistogram(data, Array.from(data.gaussian.subarray(i * 4, i * 4 + 3)));
      actual.forEach((v, c) => expect(Math.abs(v - linear(rgba[i * 4 + c] / 255))).toBeLessThan(0.003));
    }
  });
  it('removes the barycentric contrast lattice for independent unit-variance samples', () => {
    const means = [0, 0, 0], squares = [0, 0, 0]; const count = 8192;
    for (let i = 0; i < count; i++) {
      const values = [0, 1, 2].map(patch => {
        // Twelve independent uniforms have mean zero and variance one.
        let g = -6; for (let k = 0; k < 12; k++) g += rockCornerHash(i, patch * 12 + k, 8191) / 4294967296;
        return [g, g, g];
      });
      for (const [k, weights] of [[1, 0, 0], [0.5, 0.5, 0], [1 / 3, 1 / 3, 1 / 3]].entries()) {
        const v = blendRockGaussian(values, weights)[0]; means[k] += v / count; squares[k] += v * v / count;
      }
    }
    const variance = squares.map((v, k) => v - means[k] ** 2);
    variance.forEach(v => expect(Math.abs(v - 1)).toBeLessThan(0.04));
  });
  it('keeps offsets deterministic over signed coordinates and physical tile units', () => {
    // Independent uint32 modular arithmetic oracle for the WGSL contract.
    const mask = 0xffffffffn;
    for (const x of [-1024, -3, 0, 1, 1024]) {
      let h = ((BigInt(x) & mask) * 0x8da6b343n ^ 7n * 0xd8163841n ^ 8191n) & mask;
      h = ((h ^ (h >> 16n)) * 0x7feb352dn) & mask; h = ((h ^ (h >> 15n)) * 0x846ca68bn) & mask;
      expect(rockCornerHash(x, 7, 8191)).toBe(Number((h ^ (h >> 16n)) & mask));
    }
    expect(rockCornerHash(-3, 7, 8191)).not.toBe(rockCornerHash(3, 7, 8191));
    expect(rockPatchCoordinates(-15.2, 40.8, 1.5)).toEqual(rockPatchCoordinates(-30.4, 81.6, 3));
    for (const p of [[0, 0], [-2.3, 5.7], [120.25, -3.5]]) {
      const data = rockPatchCoordinates(p[0], p[1]); expect(data.weights.reduce((a, b) => a + b)).toBeCloseTo(1, 12); data.weights.forEach(w => expect(w).toBeGreaterThanOrEqual(0));
    }
  });
  it('remains continuous across shared triangular edges on signed coordinates', () => {
    const data = prepareRockHistogram(image(32, i => [(i * 47) % 256, (i * 29 + 81) % 256, (i * 13 + 122) % 256]), 32, 32);
    for (const ix of [-7, 0, 21]) {
      const sy = 3.6, sx = ix + 0.4, y = sy * Math.sqrt(3) / 2 * data.tileMeters, x = (sx + sy / 2) * data.tileMeters;
      const a = sampleRockStochasticCpu(data, x - 1e-8, y), b = sampleRockStochasticCpu(data, x + 1e-8, y);
      a.forEach((v, c) => expect(Math.abs(v - b[c])).toBeLessThan(0.00001));
    }
  });
  it('constructs a base-level linear TSL graph with numerical textures', () => {
    const data = prepareRockHistogram(image(16, i => [i, i, i]), 16, 16), maps = createRockHistogramTextures(data);
    expect(maps.gaussian.generateMipmaps).toBe(false); expect(maps.inverse.generateMipmaps).toBe(false);
    expect(sampleRockStochasticTsl(data, maps, vec2(-17.3, 12.1))).toBeDefined();
    maps.gaussian.dispose(); maps.inverse.dispose();
    // This is a graph construction check, not GPU numerical parity. The
    // latter needs explicit LOD-zero RGB/hash readback in the owner's harness.
  });
});

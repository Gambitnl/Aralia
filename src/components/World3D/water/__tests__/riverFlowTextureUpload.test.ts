/** Exact transfer parity: fewer bytes must never mean missing water changes. */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { riverFlowDirtyRect, updateRiverFlowTexture } from '../riverFlowTextureUpload';
import { RiverFlowTextureDeltaTracker } from '@/systems/world3d/river/riverFlowTextureDelta';

function fixture(width = 7, height = 5) {
  const original = Uint16Array.from({ length: width * height * 4 }, (_, i) => i);
  const texture = new THREE.DataTexture(original, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.generateMipmaps = false; texture.needsUpdate = true;
  const gpu = original.slice();
  const writeTexture = vi.fn((_destination: unknown, buffer: ArrayBufferLike, layout: GPUImageDataLayout, size: GPUExtent3DDict) => {
    const data = new Uint16Array(buffer);
    const destination = _destination as { origin: GPUOrigin3DDict };
    const x = destination.origin.x!, y = destination.origin.y!;
    for (let row = 0; row < size.height!; row++) {
      const offset = layout.offset! / 2 + row * layout.bytesPerRow! / 2;
      gpu.set(data.subarray(offset, offset + size.width * 4), ((y + row) * width + x) * 4);
    }
  });
  const state = { initialized: true, version: texture.version };
  const backend = { isWebGPUBackend: true, device: { queue: { writeTexture } },
    get: () => ({ texture: {}, textureDescriptorGPU: { format: 'rgba16float' } }) };
  const renderer = { backend, _textures: { get: () => state } } as unknown as THREE.WebGPURenderer;
  return { texture, original, gpu, writeTexture, state, backend, renderer,
    apply: (next: Uint16Array) => updateRiverFlowTexture(renderer, texture, next) };
}

describe('exact flow texture uploads', () => {
  it('uses worker lineage and repairs skipped packets, mapper restarts and externally replaced arrays exactly', () => {
    const f = fixture(), tracker = new RiverFlowTextureDeltaTracker('one');
    const send = (next: Uint16Array, skip = false) => {
      const delta = tracker.capture(7, 5, [next, next, next]);
      if (!skip) updateRiverFlowTexture(f.renderer, f.texture, next, delta, 0);
      return delta;
    };
    send(f.original.slice());
    let next = f.original.slice(); next[0]++; send(next);
    expect(f.gpu).toEqual(next);
    next = next.slice(); next[4]++; send(next, true);
    next = next.slice(); next[next.length - 1]++; send(next);
    expect(f.gpu).toEqual(next);
    // A false empty region from a different lineage must not conceal changes.
    const wrong = { ...tracker.capture(7, 5, [next, next, next]), epoch: 'restart', rectangles: [null, null, null] as [null, null, null] };
    next = next.slice(); next[8]++;
    updateRiverFlowTexture(f.renderer, f.texture, next, wrong);
    expect(f.gpu).toEqual(next);
    f.texture.image.data = next.slice();
    const malformed = { ...wrong, rectangles: [{ x: 999, y: 0, width: 1, height: 1 }, null, null] as import('@/systems/world3d/river/riverFlowTextureDelta').RiverFlowTextureDelta['rectangles'] };
    next = next.slice(); next[12]++;
    updateRiverFlowTexture(f.renderer, f.texture, next, malformed);
    expect(f.gpu).toEqual(next);
  });
  it('covers changes in every channel at both grid edges and preserves all GPU bits', () => {
    const f = fixture(); const next = f.original.slice();
    next[0] = 0x8000; next[next.length - 1] = 0x7e01;
    next[(2 * 7 + 3) * 4 + 2] = 0xffff;
    f.apply(next);
    expect(f.gpu).toEqual(next);
    expect(f.texture.image.data).toBe(next);
    expect(f.texture.version).toBe(f.state.version);
    expect(f.writeTexture).toHaveBeenCalledOnce();
    expect(riverFlowDirtyRect(f.original, next, 7, 5)).toEqual({ x: 0, y: 0, width: 7, height: 5 });
  });

  it('uploads only the enclosing rectangle with full source stride and no staging copy', () => {
    const f = fixture(); const next = f.original.slice();
    next[(1 * 7 + 2) * 4 + 1]++;
    next[(3 * 7 + 4) * 4 + 3]++;
    f.apply(next);
    expect(f.gpu).toEqual(next);
    expect(f.writeTexture).toHaveBeenCalledWith(
      expect.objectContaining({ origin: { x: 2, y: 1, z: 0 } }), next.buffer,
      { offset: (7 + 2) * 8, bytesPerRow: 7 * 8 },
      { width: 3, height: 3, depthOrArrayLayers: 1 },
    );
  });

  it('adopts identical arrays without uploads and handles successive disjoint changes', () => {
    const f = fixture(); f.apply(f.original.slice());
    expect(f.writeTexture).not.toHaveBeenCalled();
    for (let i = 0; i < f.original.length; i += 11) {
      const next = (f.texture.image.data as Uint16Array).slice(); next[i] ^= 0xffff;
      f.apply(next); expect(f.gpu).toEqual(next);
    }
  });

  it('handles subarray byte offsets, including half-word-aligned data', () => {
    const a = new Uint16Array(4 * 3 * 4 + 1).subarray(1);
    const b = a.slice(); b[(2 * 4 + 3) * 4 + 3] = 7;
    expect(riverFlowDirtyRect(a, b, 4, 3)).toEqual({ x: 3, y: 2, width: 1, height: 1 });
    const f = fixture(); const buffer = new Uint16Array(f.original.length + 5);
    buffer.set(f.original, 5); const next = buffer.subarray(5); next[4]++;
    f.apply(next); expect(f.gpu).toEqual(next);
  });

  it.each(['uninitialized', 'pending', 'flipped', 'mipmapped', 'webgl'] as const)('uses the full native upload for %s textures', reason => {
    const f = fixture();
    if (reason === 'uninitialized') f.state.initialized = false;
    if (reason === 'pending') f.texture.needsUpdate = true;
    if (reason === 'flipped') f.texture.flipY = true;
    if (reason === 'mipmapped') f.texture.generateMipmaps = true;
    if (reason === 'webgl') f.backend.isWebGPUBackend = false;
    const version = f.texture.version, next = f.original.slice(); next[4]++;
    f.apply(next);
    expect(f.writeTexture).not.toHaveBeenCalled();
    expect(f.texture.version).toBe(version + 1);
    expect(f.texture.image.data).toBe(next);
  });

  it('falls back to a full upload if direct enqueue throws', () => {
    const f = fixture(); f.writeTexture.mockImplementationOnce(() => { throw new Error('device unavailable'); });
    const version = f.texture.version, next = f.original.slice(); next[4]++;
    f.apply(next);
    expect(f.texture.version).toBe(version + 1);
    expect(f.texture.image.data).toBe(next);
  });

  it('rejects inconsistent comparison dimensions', () => {
    expect(() => riverFlowDirtyRect(new Uint16Array(4), new Uint16Array(8), 1, 1)).toThrow(/dimensions/);
  });
});

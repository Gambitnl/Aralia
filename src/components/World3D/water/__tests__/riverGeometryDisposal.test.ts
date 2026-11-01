/** Final view teardown preserves shared live geometry and frees each allocation once. */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { withRiverGeometryDisposal } from '../riverGeometryDisposal';

function fixture() {
  const allocations = new Map<object, { buffer?: { destroy(): void } }>();
  const backend = {
    has: (owner: object) => allocations.has(owner),
    get: (owner: object) => allocations.get(owner) ?? {},
    destroyAttribute(attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
      const owner = (attribute as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute
        ? (attribute as THREE.InterleavedBufferAttribute).data : attribute;
      allocations.get(owner)!.buffer!.destroy();
      allocations.delete(attribute);
    },
  };
  return { allocations, backend };
}

describe('river shared attribute final teardown', () => {
  it('frees shared camera/reflection index and vertex allocations once without changing live attributes', () => {
    const f = fixture(), geometry = new THREE.PlaneGeometry(2, 3), mirror = new THREE.BufferGeometry();
    mirror.setIndex(geometry.index);
    for (const [name, attribute] of Object.entries(geometry.attributes)) mirror.setAttribute(name, attribute);
    const buffers = [geometry.index!, ...Object.values(geometry.attributes)].map(attribute => {
      const buffer = { destroy: vi.fn() }; f.allocations.set(attribute, { buffer }); return buffer;
    });
    const original = f.backend.destroyAttribute;
    withRiverGeometryDisposal(f, () => {
      for (const g of [geometry, mirror]) {
        f.backend.destroyAttribute(g.index!);
        for (const attribute of Object.values(g.attributes)) f.backend.destroyAttribute(attribute);
      }
    });
    expect(buffers.every(b => b.destroy.mock.calls.length === 1)).toBe(true);
    expect(f.allocations.size).toBe(0);
    expect(mirror.index).toBe(geometry.index);
    expect(mirror.attributes.position).toBe(geometry.attributes.position);
    expect(f.backend.destroyAttribute).toBe(original);
  });

  it('handles undrawn attributes and multiple interleaved views over one actual buffer', () => {
    const f = fixture(), data = new THREE.InterleavedBuffer(new Float32Array(24), 6);
    const position = new THREE.InterleavedBufferAttribute(data, 3, 0), normal = new THREE.InterleavedBufferAttribute(data, 3, 3);
    const buffer = { destroy: vi.fn() }; f.allocations.set(data, { buffer });
    withRiverGeometryDisposal(f, () => {
      f.backend.destroyAttribute(new THREE.BufferAttribute(new Float32Array(3), 3));
      f.backend.destroyAttribute(position); f.backend.destroyAttribute(normal);
    });
    expect(buffer.destroy).toHaveBeenCalledOnce();
  });

  it('retains an actual destroy failure and restores the original renderer method', () => {
    const f = fixture(), attribute = new THREE.BufferAttribute(new Float32Array(3), 3);
    f.allocations.set(attribute, { buffer: { destroy: () => { throw Error('device failure'); } } });
    const original = f.backend.destroyAttribute;
    expect(() => withRiverGeometryDisposal(f, () => f.backend.destroyAttribute(attribute))).toThrow('device failure');
    expect(f.backend.destroyAttribute).toBe(original);
  });
});

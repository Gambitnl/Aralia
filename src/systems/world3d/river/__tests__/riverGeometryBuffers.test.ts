import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { reuseRiverGeometryBuffers } from '@/components/World3D/water/riverGeometryBuffers';

function sheet(height = 0): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,height,0, 1,height,0, 0,height,1]), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0,1,0, 0,1,0, 0,1,0]), 3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array([0,1,2]), 1));
  g.computeBoundingBox(); g.computeBoundingSphere();
  g.userData.mainStandingTriangles = g.getIndex()!.array;
  return g;
}

describe('native river geometry buffer reuse', () => {
  it('keeps GPU attribute identities while adopting exact displaced positions and bounds', () => {
    const a = sheet(), b = sheet(3);
    const position = a.getAttribute('position'), normal = a.getAttribute('normal'), index = a.getIndex()!;
    const oldDisposed = vi.fn(), nextDisposed = vi.fn();
    a.addEventListener('dispose', oldDisposed); b.addEventListener('dispose', nextDisposed);
    expect(reuseRiverGeometryBuffers(a,b)).toBe(true);
    expect(a.getAttribute('position')).toBe(position);
    expect(a.getAttribute('position').array).toBe(b.getAttribute('position').array);
    expect(a.getAttribute('normal')).toBe(normal);
    expect(a.getIndex()).toBe(index);
    expect((position as THREE.BufferAttribute).version).toBe(1);
    expect((normal as THREE.BufferAttribute).version).toBe(0);
    expect(index.version).toBe(0);
    expect(a.boundingBox!.min.y).toBe(3);
    expect(a.userData.mainStandingTriangles).toBe(b.userData.mainStandingTriangles);
    expect(oldDisposed).not.toHaveBeenCalled(); expect(nextDisposed).toHaveBeenCalledOnce();
    a.dispose();
  });

  it('uploads changed face order even when index capacity is unchanged', () => {
    const a = sheet(), b = sheet();
    b.getIndex()!.array.set([0,2,1]);
    expect(reuseRiverGeometryBuffers(a,b)).toBe(true);
    expect(a.getIndex()!.array).toEqual(new Uint32Array([0,2,1]));
    expect(a.getIndex()!.version).toBe(1);
    a.dispose();
  });

  it('falls back atomically when wet faces require a different capacity', () => {
    const a = sheet(), b = sheet(4), original = a.getAttribute('position').array;
    b.setIndex(new THREE.BufferAttribute(new Uint32Array([0,1,2, 0,2,1]),1));
    const disposed = vi.fn(); b.addEventListener('dispose', disposed);
    expect(reuseRiverGeometryBuffers(a,b)).toBe(false);
    expect(a.getAttribute('position').array).toBe(original);
    expect((a.getAttribute('position') as THREE.BufferAttribute).version).toBe(0);
    expect(disposed).not.toHaveBeenCalled(); a.dispose(); b.dispose();
  });

  it('rejects changed attribute formats without dropping future attributes', () => {
    const a = sheet(), b = sheet();
    b.setAttribute('normal', new THREE.BufferAttribute(new Uint8Array(9),3,true));
    expect(reuseRiverGeometryBuffers(a,b)).toBe(false);
    b.setAttribute('normal', a.getAttribute('normal').clone());
    b.setAttribute('futureFlow', new THREE.BufferAttribute(new Float32Array(3),1));
    expect(reuseRiverGeometryBuffers(a,b)).toBe(false);
    a.dispose(); b.dispose();
  });
});

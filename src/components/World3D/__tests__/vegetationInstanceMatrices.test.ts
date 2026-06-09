import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { syncVegetationInstanceMatrices, type VegetationInstanceMatrixTarget } from '../vegetationInstanceMatrices';
import { buildVegetationScatter } from '@/systems/world3d/vegetationScatter';
import type { ChunkData } from '@/systems/world3d/types';

/**
 * These tests protect the renderer-side follow-up to W3D-G25.
 *
 * The scene code is intentionally kept thin, so this file exercises the pure
 * matrix-sync helper directly: the same scatter key should skip a second write
 * pass, while a different key should repaint the mesh.
 */

const chunk = (biome: string): ChunkData => ({
  cx: 4,
  cy: 5,
  resolution: 8,
  heights: new Float32Array(64).fill(40),
  biomeIds: new Array(64).fill(biome),
  rivers: [],
  roads: [],
  sites: [],
});

class FakeInstancedMesh implements VegetationInstanceMatrixTarget {
  instanceMatrix = { needsUpdate: false };
  writes: Array<{ index: number; matrix: THREE.Matrix4 }> = [];

  setMatrixAt(index: number, matrix: THREE.Matrix4): void {
    this.writes.push({ index, matrix: matrix.clone() });
  }
}

describe('syncVegetationInstanceMatrices', () => {
  it('writes once for a scatter key and skips the repeat payload', () => {
    const scatter = buildVegetationScatter(chunk('forest'));
    const mesh = new FakeInstancedMesh();
    const cacheRef = { current: null as string | null };

    const firstPass = syncVegetationInstanceMatrices(mesh, scatter, cacheRef);
    expect(firstPass).toBe(true);
    expect(mesh.writes).toHaveLength(scatter.positions.length / 3);
    expect(cacheRef.current).toBe(scatter.cacheKey);

    mesh.instanceMatrix.needsUpdate = false;
    const secondPass = syncVegetationInstanceMatrices(mesh, scatter, cacheRef);
    expect(secondPass).toBe(false);
    expect(mesh.writes).toHaveLength(scatter.positions.length / 3);
    expect(mesh.instanceMatrix.needsUpdate).toBe(false);
  });

  it('repaints when the stable scatter key changes', () => {
    const mesh = new FakeInstancedMesh();
    const cacheRef = { current: null as string | null };
    const firstScatter = buildVegetationScatter(chunk('forest'));
    const secondScatter = buildVegetationScatter(chunk('jungle'));

    expect(syncVegetationInstanceMatrices(mesh, firstScatter, cacheRef)).toBe(true);
    const firstWriteCount = mesh.writes.length;

    expect(syncVegetationInstanceMatrices(mesh, secondScatter, cacheRef)).toBe(true);
    expect(mesh.writes.length).toBeGreaterThan(firstWriteCount);
    expect(cacheRef.current).toBe(secondScatter.cacheKey);
  });
});

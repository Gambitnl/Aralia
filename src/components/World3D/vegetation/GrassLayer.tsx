/**
 * @file GrassLayer.tsx
 * @description Near-camera instanced grass for the streamed 3D world
 * (beautification wave vegetation lift). Cheap crossed-quad clusters,
 * biome-tinted from the terrain vertex colors, deterministic per chunk.
 * Distance falloff: only chunks within GRASS_CHUNK_RADIUS (Chebyshev) of the
 * anchor chunk mount a grass mesh at all; far terrain keeps its painted color.
 * Standard materials only — WebGL and WebGPU compatible (no TSL).
 */
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { LoadedChunk } from '@/systems/world3d/types';
import { WORLD3D_CONFIG } from '@/systems/world3d/config';
import { buildGrassField } from '@/systems/worldforge/vegetation/grassField';

/** Chunks within this Chebyshev radius of the player's chunk grow grass. */
export const GRASS_CHUNK_RADIUS = 1;

/** Crossed-quad blade-cluster geometry: two quads at 90°, base y=0, unit height,
 * tapered toward the tip so blades read grassy instead of billboard-y. */
function buildBladeGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const halfW = 0.5;
  const tipW = 0.12;
  const planes = [0, Math.PI / 2];
  for (const ang of planes) {
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const base = positions.length / 3;
    positions.push(
      -halfW * dx, 0, -halfW * dz,
      halfW * dx, 0, halfW * dz,
      tipW * dx, 1, tipW * dz,
      -tipW * dx, 1, -tipW * dz,
    );
    const nx = -dz;
    const nz = dx;
    for (let i = 0; i < 4; i++) normals.push(nx, 0, nz);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  g.setIndex(indices);
  return g;
}

let bladeGeometry: THREE.BufferGeometry | null = null;
const GRASS_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  side: THREE.DoubleSide,
  roughness: 1,
});

export const GrassLayer: React.FC<{
  chunk: LoadedChunk;
  anchor: { cx: number; cy: number };
  position: [number, number, number];
}> = ({ chunk, anchor, position }) => {
  const near =
    Math.max(Math.abs(chunk.cx - anchor.cx), Math.abs(chunk.cy - anchor.cy)) <= GRASS_CHUNK_RADIUS;
  const terrain = chunk.bundle.terrain;
  const field = useMemo(() => {
    if (!near) return null;
    return buildGrassField(terrain, chunk.cx, chunk.cy, {
      chunkSize: WORLD3D_CONFIG.CHUNK_WORLD_SIZE,
    });
  }, [near, terrain, chunk.cx, chunk.cy]);

  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh || !field) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    for (let i = 0; i < field.count; i++) {
      const s = field.scales[i];
      rotation.setFromAxisAngle(axis, field.rotations[i]);
      // Sink the base 3cm so bilinear-vs-triangulated height mismatch can
      // never leave a blade floating above the surface.
      pos.set(field.positions[i * 3], field.positions[i * 3 + 1] - 0.03, field.positions[i * 3 + 2]);
      scale.set(s * 0.3, s * 0.6, s * 0.3);
      matrix.compose(pos, rotation, scale);
      mesh.setMatrixAt(i, matrix);
      // Treat the palette floats as sRGB (like the tree/bush layers do):
      // copying them raw into the linear working space displays them washed
      // out — the first shots read as whitish streaks (2026-07-04 eyeball).
      color.setRGB(
        field.tints[i * 3],
        field.tints[i * 3 + 1],
        field.tints[i * 3 + 2],
        THREE.SRGBColorSpace,
      );
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    GRASS_MATERIAL.needsUpdate = true;
  }, [field]);

  if (!field || field.count === 0) return null;
  if (!bladeGeometry) bladeGeometry = buildBladeGeometry();
  return (
    <instancedMesh
      ref={ref}
      key={field.cacheKey}
      args={[bladeGeometry, GRASS_MATERIAL, field.count]}
      position={position}
      frustumCulled={false}
    />
  );
};

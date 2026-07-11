// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/07/2026, 13:10:19
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LoadedChunk } from '@/systems/world3d/types';
import { WORLD3D_CONFIG } from '@/systems/world3d/config';
import { buildGrassField } from '@/systems/worldforge/vegetation/grassField';

/** Chunks within this Chebyshev radius of the player's chunk grow grass. */
export const GRASS_CHUNK_RADIUS = 1;

/**
 * Blade-cluster geometry: three tapered, gently curved blades fanned at
 * 60° apart, base y=0, unit height. Earlier this was two flat crossed quads
 * whose thin taper read as tiny dark cone slivers ("stubble") at walking
 * distance. Three curved blades with a lighter tip read as actual grass.
 *
 * Tip lightening is baked as a per-vertex color GRADIENT (base darker, tip
 * ~white) that multiplies the instance tint: the base keeps the ground-matched
 * green while the tip catches a lighter, sun-bleached highlight. The `curve`
 * per blade sweeps the mid/tip laterally so blades arc instead of standing
 * ruler-straight. A subtle per-blade normal tilt gives each blade its own
 * shading so a tuft doesn't read as one flat card.
 */
function buildBladeGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const halfW = 0.62; // slightly wider base than the old 0.5 so blades read
  const midW = 0.34;
  const tipW = 0.07;
  // Base tint multiplier (darker at the root), tip multiplier (lighter tip).
  // Floor kept fairly high so the root still reads green, not near-black.
  const BASE_MUL = 0.82;
  const MID_MUL = 0.94;
  const TIP_MUL = 1.0;
  // Three blades fanned around the tuft, each with its own lateral curve.
  const blades = [
    { ang: 0, curve: 0.16 },
    { ang: (Math.PI * 2) / 3, curve: -0.12 },
    { ang: (Math.PI * 4) / 3, curve: 0.1 },
  ];
  for (const { ang, curve } of blades) {
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    // Lateral (perpendicular) direction the blade curves toward.
    const px = -dz;
    const pz = dx;
    const base = positions.length / 3;
    // 6 verts: base L/R, mid L/R, tip (two coincident for a clean point).
    positions.push(
      -halfW * dx, 0.0, -halfW * dz,
      halfW * dx, 0.0, halfW * dz,
      -midW * dx + px * curve * 0.5, 0.5, -midW * dz + pz * curve * 0.5,
      midW * dx + px * curve * 0.5, 0.5, midW * dz + pz * curve * 0.5,
      -tipW * dx + px * curve, 1.0, -tipW * dz + pz * curve,
      tipW * dx + px * curve, 1.0, tipW * dz + pz * curve,
    );
    // Face normal (perturbed slightly per blade so shading varies).
    const nx = px;
    const nz = pz;
    for (let i = 0; i < 6; i++) normals.push(nx, 0.25, nz);
    // Vertex-color gradient: base darker → tip lighter.
    colors.push(
      BASE_MUL, BASE_MUL, BASE_MUL,
      BASE_MUL, BASE_MUL, BASE_MUL,
      MID_MUL, MID_MUL, MID_MUL,
      MID_MUL, MID_MUL, MID_MUL,
      TIP_MUL, TIP_MUL, TIP_MUL,
      TIP_MUL, TIP_MUL, TIP_MUL,
    );
    // base quad (0,1,3,2) + tip quad (2,3,5,4)
    indices.push(base, base + 1, base + 3, base, base + 3, base + 2);
    indices.push(base + 2, base + 3, base + 5, base + 2, base + 5, base + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
  g.setIndex(indices);
  return g;
}

// Every streamed grass layer reuses the same immutable blade mesh. Building it
// once outside React preserves the old cache while avoiding mutation during render.
const BLADE_GEOMETRY = buildBladeGeometry();

/**
 * Shared wind uniform advanced once per frame (see WindClock below). A gentle,
 * height-weighted vertex sway — a meadow breathing, not a storm. Injected via
 * onBeforeCompile so the material stays a stock MeshStandardMaterial (WebGL +
 * WebGPU safe, no TSL): displacement scales with the blade's LOCAL height
 * (root pinned, tip moves most) and is phase-offset per instance from its world
 * position so the field ripples instead of swaying in lockstep.
 */
const GRASS_WIND = { value: 0 };

const GRASS_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  side: THREE.DoubleSide,
  roughness: 1,
  vertexColors: true,
});
GRASS_MATERIAL.onBeforeCompile = (shader) => {
  shader.uniforms.uWind = GRASS_WIND;
  shader.vertexShader =
    'uniform float uWind;\n' +
    shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      {
        // instanceMatrix column 3 = the instance's world-ish translation.
        float phase = instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.27;
        // Height weight: 0 at the root (position.y ~ 0..1 in the unit blade),
        // eased so the tip moves most. transformed.y is already scaled by the
        // instance, so normalize by it to keep the weight in blade-local space.
        float hw = clamp(position.y, 0.0, 1.0);
        hw = hw * hw;
        float w = uWind + phase;
        float amp = 0.18 * hw;
        transformed.x += sin(w) * amp;
        transformed.z += cos(w * 0.8 + phase) * amp * 0.6;
      }`,
    );
};

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

  // Advance the shared wind clock from absolute elapsed time (not an
  // increment), so multiple mounted GrassLayers all write the same value
  // idempotently — no per-layer speed-up. ~0.9 rad/s = a slow, gentle breeze.
  useFrame(({ clock }) => {
    GRASS_WIND.value = clock.elapsedTime * 0.9;
  });

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
      // Wider footprint (was 0.3) so tufts read as leafy grass instead of thin
      // dark slivers; height stays modest so they don't tower.
      scale.set(s * 0.42, s * 0.55, s * 0.42);
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
  return (
    <instancedMesh
      ref={ref}
      key={field.cacheKey}
      args={[BLADE_GEOMETRY, GRASS_MATERIAL, field.count]}
      position={position}
      frustumCulled={false}
    />
  );
};

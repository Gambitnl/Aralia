/**
 * @file FarShells.tsx — render the far-distance terrain shells (2026-07-21).
 *
 * Two static vertex-colored grid meshes built worker-side by farShells.ts:
 * the region ring (continues the streamed window's terrain to ~7.6 km) and the
 * atlas horizon ring (distant ranges to ~20 km). Geometry is built once per
 * window entry from typed arrays — no streaming, no per-frame work. Materials
 * match the chunk terrain (standard, vertex colors, flat shading) so lighting
 * and fog treat near and far ground as one surface. Both meshes ignore
 * raycasting so ground picking and click-to-move never hit the backdrop.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { FarShellGrid } from '@/systems/worldforge/bridge/farShells';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { isWebGpuWorldEnabled } from './webgpuWorldFlag';
import { getGroundDetailTexture, getGroundNormalTexture } from './terrain/groundDetailTexture';
import { useTerrainSurfaceNoiseNodeMaterial } from './gpu/terrainSurfaceNoiseNode';

const WEBGPU_WORLD = isWebGpuWorldEnabled();
/** The streamed ground's detail tile and normal strength (World3DScene TerrainPiece). */
const GROUND_TEXTURE_METERS_PER_TILE = 3;
const GROUND_NORMAL_SCALE = new THREE.Vector2(0.6, 0.6);

function buildShellGeometry(
  grid: FarShellGrid,
  origin: SceneOrigin,
): THREE.BufferGeometry {
  const { cols, rows, spacingM, heightsM, colors } = grid;
  const positions = new Float32Array(cols * rows * 3);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      positions[idx * 3] = grid.originXM + col * spacingM - origin.x;
      positions[idx * 3 + 1] = heightsM[idx];
      positions[idx * 3 + 2] = grid.originZM + row * spacingM - origin.z;
    }
  }
  // HOLE (2026-08-24): drop every quad that lies wholly inside the streamed
  // window. The window has real terrain there, and the shell's samples are ~61 m
  // apart, so under a town — whose ground is flattened into pads — the coarse
  // shell plane cut UP through the detail terrain and rendered as flat green
  // patches over the streets. Quads that straddle the border are kept, so the
  // seam still closes and no gap opens at the window edge.
  const hole = grid.holeM;
  const insideHole = (col: number, row: number): boolean => {
    if (!hole) return false;
    const x = grid.originXM + col * spacingM;
    const z = grid.originZM + row * spacingM;
    return x >= hole.minX && x <= hole.maxX && z >= hole.minZ && z <= hole.maxZ;
  };

  const indices = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let w = 0;
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      if (
        insideHole(col, row) && insideHole(col + 1, row)
        && insideHole(col, row + 1) && insideHole(col + 1, row + 1)
      ) continue;
      const a = row * cols + col;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      // Counter-clockwise seen from +Y (matches the chunk terrain winding).
      indices[w++] = a; indices[w++] = c; indices[w++] = b;
      indices[w++] = b; indices[w++] = c; indices[w++] = d;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
  // World-x/z UVs, as the streamed ground has them (its detail map lines up across the seam).
  const uv = new Float32Array(cols * rows * 2);
  for (let k = 0; k < cols * rows; k++) {
    uv[k * 2] = (positions[k * 3] + origin.x) / GROUND_TEXTURE_METERS_PER_TILE;
    uv[k * 2 + 1] = (positions[k * 3 + 2] + origin.z) / GROUND_TEXTURE_METERS_PER_TILE;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  // `w` is the USED index count; the buffer was sized for a full grid.
  geometry.setIndex(new THREE.BufferAttribute(indices.subarray(0, w), 1));
  geometry.computeVertexNormals();
  return geometry;
}

const ShellMesh: React.FC<{ grid: FarShellGrid; origin: SceneOrigin; groundLook?: boolean }> = ({
  grid,
  origin,
  groundLook = false,
}) => {
  const geometry = useMemo(() => buildShellGeometry(grid, origin), [grid, origin]);
  // THE SHELL LOOKS LIKE THE GROUND (2026-10-27, agora-257c). The region
  // shell drew flat-shaded with a plain material, so every 61 m quad was a
  // visible facet and the shell read lighter than the streamed ground beside
  // it (no detail map, no surface noise): a hard straight edge at the loaded
  // area. On WebGPU it now uses the streamed ground's own material, and both
  // shells shade smoothly (the ground has since 2026-07-30). The horizon shell
  // (500 m samples to 20 km) keeps the plain material: a 3 m detail map there
  // would only shimmer.
  const groundDetail = useMemo(() => getGroundDetailTexture(), []);
  const groundNormal = useMemo(() => getGroundNormalTexture(), []);
  const gpuMaterial = useTerrainSurfaceNoiseNodeMaterial(WEBGPU_WORLD && groundLook, {
    map: groundDetail,
    normalMap: groundNormal,
    normalScale: GROUND_NORMAL_SCALE,
    roughness: 0.95,
  });
  React.useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      /* NAMED, because an unnamed ground surface is one nothing else can
       * address. `__volBubble.setTerrainVisible` hides the streamed skin so a
       * cut in the volume can be photographed, and it left these standing: the
       * region ring is a full ground surface at terrain height under the
       * player, so a trench dug through the bubble kept reading as a flat pale
       * patch even with the heightfield gone. That measurement was written up
       * as "the cut has no floor". */
      name="world3d:far-shell"
      geometry={geometry}
      receiveShadow={false}
      castShadow={false}
      // The backdrop must never swallow ground picks or NPC clicks.
      raycast={() => null}
      frustumCulled={false}
    >
      {gpuMaterial ? <primitive object={gpuMaterial} attach="material" /> : <meshStandardMaterial vertexColors roughness={1} />}
    </mesh>
  );
};

/** Mount both shells when the ground world carries them (region entries). */
export const FarShells: React.FC<{
  ground: GroundWorld | null | undefined;
  sceneOrigin: SceneOrigin;
}> = ({ ground, sceneOrigin }) => {
  const shells = ground?.farShells;
  if (!shells) return null;
  return (
    <>
      <ShellMesh grid={shells.region} origin={sceneOrigin} groundLook />
      {shells.horizon && <ShellMesh grid={shells.horizon} origin={sceneOrigin} />}
    </>
  );
};

export default FarShells;

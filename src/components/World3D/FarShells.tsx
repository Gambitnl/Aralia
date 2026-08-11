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
  const indices = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let w = 0;
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
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
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

const ShellMesh: React.FC<{ grid: FarShellGrid; origin: SceneOrigin }> = ({
  grid,
  origin,
}) => {
  const geometry = useMemo(() => buildShellGeometry(grid, origin), [grid, origin]);
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
      <meshStandardMaterial vertexColors flatShading roughness={1} />
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
      <ShellMesh grid={shells.region} origin={sceneOrigin} />
      {shells.horizon && <ShellMesh grid={shells.horizon} origin={sceneOrigin} />}
    </>
  );
};

export default FarShells;

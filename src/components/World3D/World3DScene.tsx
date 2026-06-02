/**
 * @file World3DScene.tsx
 * @description R3F shell for the streamed 3D world. Renders one bundle of meshes per
 * loaded chunk (terrain + water + roads + sites + instanced vegetation).
 *
 * Floating-origin rendering: the streamer works in absolute world meters (which can be
 * ~30k for a mid-world demo), but the R3F scene is drawn relative to a fixed `sceneOrigin`
 * near the player so rendered coordinates stay near 0. This avoids float-precision loss,
 * keeps the camera/light math simple, and lets the directional light actually cover the
 * visible area. The camera controller converts its reported target back to world coords
 * (via sceneToWorld) so the streamer keeps receiving absolute positions.
 *
 * Shadows are gated off by WORLD3D_CONFIG.STREAMED_WORLD_SHADOWS (a real-time shadow pass
 * over dozens of streamed chunks is expensive and was contributing to renderer stalls /
 * WebGL context loss). A webglcontextlost/restored handler keeps a transient loss from
 * leaving the canvas permanently blank.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import FreeRoamCameraController from './FreeRoamCameraController';
import { useChunkStreaming } from './useChunkStreaming';
import type { ChunkLoader, LoadedChunk } from '@/systems/world3d/types';
import { chunkOriginWorld } from '@/systems/world3d/coords';
import { worldToScene, type SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { WORLD3D_CONFIG } from '@/systems/world3d/config';

interface World3DSceneProps {
  loader: ChunkLoader;
  /** World-space position to center streaming + the scene origin on at mount. */
  start: readonly [number, number, number];
  /**
   * Scene-space Y (meters) of the terrain surface at the spawn point. With vertical
   * exaggeration the ground can sit hundreds of meters up, so the camera and its look-at
   * target are lifted by this so they frame the ground instead of looking at empty sky.
   * Defaults to 0 (flat) when the host doesn't know the spawn elevation.
   */
  startSurfaceY?: number;
  /** Optional override for camera position callback (for terrain height injection). */
  onPositionChange?: (worldX: number, worldZ: number) => void;
  /** Optional callback for chunk update notifications (loaded count). */
  onChunkUpdate?: (loadedCount: number) => void;
}

const SHADOWS = WORLD3D_CONFIG.STREAMED_WORLD_SHADOWS;

// --- per-chunk rendering ---

/** Chunk-local-space origin (meters) for a chunk, relative to the scene origin. */
function chunkScenePos(cx: number, cy: number, origin: SceneOrigin): [number, number, number] {
  const o = chunkOriginWorld(cx, cy);
  const s = worldToScene(o.x, o.y, origin);
  return [s.x, 0, s.z];
}

function useDisposableGeometry(arr: {
  positions: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  colors?: Float32Array;
}) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(arr.normals, 3));
    if (arr.colors) g.setAttribute('color', new THREE.BufferAttribute(arr.colors, 3));
    g.setIndex(new THREE.BufferAttribute(arr.indices, 1));
    return g;
  }, [arr]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

const TerrainPiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => {
  const geometry = useDisposableGeometry(chunk.bundle.terrain);
  return (
    <mesh geometry={geometry} position={chunkScenePos(chunk.cx, chunk.cy, origin)} receiveShadow={SHADOWS}>
      <meshStandardMaterial vertexColors flatShading />
    </mesh>
  );
};

const WaterPiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => {
  const water = chunk.bundle.water;
  // Hooks must run unconditionally: build geometry from water or a tiny empty stand-in.
  const geometry = useDisposableGeometry(
    water ?? { positions: new Float32Array(0), indices: new Uint32Array(0), normals: new Float32Array(0) },
  );
  if (!water) return null;
  return (
    <mesh geometry={geometry} position={chunkScenePos(chunk.cx, chunk.cy, origin)}>
      <meshStandardMaterial color="#2a5a8a" transparent opacity={0.75} />
    </mesh>
  );
};

const RoadPiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => {
  const roads = chunk.bundle.roads;
  const geometry = useDisposableGeometry(
    roads ?? { positions: new Float32Array(0), indices: new Uint32Array(0), normals: new Float32Array(0) },
  );
  if (!roads) return null;
  return (
    <mesh geometry={geometry} position={chunkScenePos(chunk.cx, chunk.cy, origin)}>
      <meshStandardMaterial color="#9a8458" />
    </mesh>
  );
};

const SitePieces: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => {
  return (
    <group position={chunkScenePos(chunk.cx, chunk.cy, origin)}>
      {chunk.bundle.sites.map((s) => (
        <mesh key={`${chunk.cx}|${chunk.cy}|${s.id}`} position={[s.localX, s.surfaceY + s.radius * 0.5, s.localZ]} castShadow={SHADOWS}>
          <boxGeometry args={[s.radius, s.radius, s.radius]} />
          <meshStandardMaterial color={s.kind === 'town' ? '#caa46a' : s.kind === 'dungeon' ? '#555555' : '#888888'} />
        </mesh>
      ))}
    </group>
  );
};

const VegetationPiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => {
  const veg = chunk.bundle.vegetation;
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = veg ? veg.positions.length / 3 : 0;
  useEffect(() => {
    if (!ref.current || !veg) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const s = veg.scales[i];
      q.setFromAxisAngle(axis, veg.rotations[i]);
      pos.set(veg.positions[i * 3], veg.positions[i * 3 + 1], veg.positions[i * 3 + 2]);
      scl.set(s * 2, s * 5, s * 2);
      m.compose(pos, q, scl);
      ref.current.setMatrixAt(i, m);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, [veg, count]);
  if (!veg || count === 0) return null;
  return (
    <group position={chunkScenePos(chunk.cx, chunk.cy, origin)}>
      <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow={SHADOWS}>
        <coneGeometry args={[1, 1, 6]} />
        <meshStandardMaterial color="#2f5d2f" flatShading />
      </instancedMesh>
    </group>
  );
};

const ChunkPieces: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => (
  <>
    <TerrainPiece chunk={chunk} origin={origin} />
    <WaterPiece chunk={chunk} origin={origin} />
    <RoadPiece chunk={chunk} origin={origin} />
    <SitePieces chunk={chunk} origin={origin} />
    <VegetationPiece chunk={chunk} origin={origin} />
  </>
);

const World3DScene: React.FC<World3DSceneProps> = ({ loader, start, startSurfaceY = 0, onPositionChange: onPositionChangeOverride, onChunkUpdate }) => {
  const { loaded, update } = useChunkStreaming(loader);

  // Lift the camera + its look-at target to the spawn ground elevation. With vertical
  // exaggeration the terrain can rise hundreds of meters, so a fixed low camera ends up
  // below/behind the hills, framing only sky. The horizontal offset is wide (oblique cross-view,
  // ~55° from vertical) so the now-exaggerated hill silhouettes read against the sky rather than
  // being viewed near-top-down (which flattens relief). Sized to the ~1km streamed window.
  const camPosition = useMemo<[number, number, number]>(
    () => [380, startSurfaceY + 260, 380],
    [startSurfaceY],
  );

  // Notify parent when chunk count changes.
  React.useEffect(() => {
    if (onChunkUpdate) {
      onChunkUpdate(loaded.length);
    }
  }, [loaded.length, onChunkUpdate]);

  // Fixed scene origin near the player; the scene is drawn relative to it (coords ~0).
  const sceneOrigin: SceneOrigin = useMemo(() => ({ x: start[0], z: start[2] }), [start]);

  // Kick off the first window once (in absolute world coords).
  React.useEffect(() => {
    update(start[0], start[2]);
  }, [update, start]);

  // Use the override if provided (for terrain height injection), otherwise default behavior.
  const onPositionChange = useCallback((x: number, z: number) => {
    update(x, z);
    if (onPositionChangeOverride) {
      onPositionChangeOverride(x, z);
    }
  }, [update, onPositionChangeOverride]);

  return (
    <div style={{ width: '100%', height: '78vh', minHeight: '520px', flex: '1 1 auto', background: '#9fb8d0', borderRadius: '12px', overflow: 'hidden' }}>
      <Canvas
        shadows={SHADOWS}
        camera={{ fov: 55, near: 1, far: 6000, position: camPosition }}
        onCreated={({ gl }) => {
          const el = gl.domElement;
          el.addEventListener(
            'webglcontextlost',
            (e) => {
              e.preventDefault(); // allows the browser to fire webglcontextrestored
              // eslint-disable-next-line no-console
              console.warn('[world3d] WebGL context lost — will attempt restore');
            },
            false,
          );
          el.addEventListener(
            'webglcontextrestored',
            () => {
              // eslint-disable-next-line no-console
              console.warn('[world3d] WebGL context restored');
            },
            false,
          );
        }}
      >
        <hemisphereLight args={[0x88bbff, 0x556644, 0.9]} />
        <directionalLight position={[120, 200, 80]} intensity={1.6} />
        <fog attach="fog" args={[0x9fb8d0, 900, 4500]} />
        <FreeRoamCameraController initialTarget={[0, startSurfaceY, 0]} sceneOrigin={sceneOrigin} onPositionChange={onPositionChange} />
        {loaded.map((c) => (
          <ChunkPieces key={`${c.cx}|${c.cy}`} chunk={c} origin={sceneOrigin} />
        ))}
      </Canvas>
    </div>
  );
};

export default World3DScene;

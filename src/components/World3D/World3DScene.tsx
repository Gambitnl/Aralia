/**
 * @file World3DScene.tsx
 * @description Thin R3F shell for the streamed 3D world. Renders one mesh per loaded chunk
 * from the streamer's geometry arrays. Placeholder material — Plan 3 adds real
 * terrain texturing, water, roads, and props.
 *
 * Why this is built this way:
 * - A separate `ChunkMesh` sub-component is designed to memoize and wrap the Three.js BufferGeometry
 *   creation. This prevents unnecessary and expensive garbage collection thrashing and GPU buffer allocations
 *   during normal camera pans.
 * - Flat shading on `meshStandardMaterial` represents chunk heights cleanly in Plan 2.
 * - A fog layer handles far chunk blending seamlessly.
 */

import React, { useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import FreeRoamCameraController from './FreeRoamCameraController';
import { useChunkStreaming } from './useChunkStreaming';
import type { ChunkLoader, LoadedChunk } from '@/systems/world3d/types';
import { chunkOriginWorld } from '@/systems/world3d/coords';

interface World3DSceneProps {
  loader: ChunkLoader;
  /** World-space position to center streaming on at mount. */
  start: readonly [number, number, number];
}

const LOD_COLOR: Record<string, string> = {
  full: '#5a7a4a',
  mid: '#4a6a44',
  low: '#3a5038',
  culled: '#2a3a2a',
};

const ChunkMesh: React.FC<{ chunk: LoadedChunk }> = ({ chunk }) => {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(chunk.geometry.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(chunk.geometry.normals, 3));
    g.setIndex(new THREE.BufferAttribute(chunk.geometry.indices, 1));
    return g;
  }, [chunk.geometry]);

  const origin = chunkOriginWorld(chunk.cx, chunk.cy);
  return (
    <mesh geometry={geometry} position={[origin.x, 0, origin.y]} receiveShadow>
      <meshStandardMaterial color={LOD_COLOR[chunk.lod] ?? '#5a7a4a'} flatShading />
    </mesh>
  );
};

const World3DScene: React.FC<World3DSceneProps> = ({ loader, start }) => {
  const { loaded, update } = useChunkStreaming(loader);

  // Kick off the first window once.
  React.useEffect(() => {
    update(start[0], start[2]);
  }, [update, start]);

  const onPositionChange = useCallback((x: number, z: number) => update(x, z), [update]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '600px', background: '#9fb8d0', borderRadius: '12px', overflow: 'hidden' }}>
      <Canvas shadows camera={{ fov: 55, near: 1, far: 2000, position: [start[0] + 120, 160, start[2] + 120] }}>
        <hemisphereLight args={[0x88bbff, 0x556644, 0.9]} />
        <directionalLight position={[200, 300, 100]} intensity={1.6} castShadow />
        <fog attach="fog" args={[0x9fb8d0, 300, 1200]} />
        <FreeRoamCameraController initialTarget={start} onPositionChange={onPositionChange} />
        {loaded.map((c) => (
          <ChunkMesh key={`${c.cx}|${c.cy}`} chunk={c} />
        ))}
      </Canvas>
    </div>
  );
};

export default World3DScene;

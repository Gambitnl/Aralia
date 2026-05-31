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

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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

// --- per-chunk rendering ---

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

const TerrainPiece: React.FC<{ chunk: LoadedChunk }> = ({ chunk }) => {
  const geometry = useDisposableGeometry(chunk.bundle.terrain);
  const origin = chunkOriginWorld(chunk.cx, chunk.cy);
  return (
    <mesh geometry={geometry} position={[origin.x, 0, origin.y]} receiveShadow>
      <meshStandardMaterial vertexColors flatShading />
    </mesh>
  );
};

const WaterPiece: React.FC<{ chunk: LoadedChunk }> = ({ chunk }) => {
  const water = chunk.bundle.water;
  // Hooks must run unconditionally: build geometry from water or a tiny empty stand-in.
  const geometry = useDisposableGeometry(
    water ?? { positions: new Float32Array(0), indices: new Uint32Array(0), normals: new Float32Array(0) },
  );
  if (!water) return null;
  const origin = chunkOriginWorld(chunk.cx, chunk.cy);
  return (
    <mesh geometry={geometry} position={[origin.x, 0, origin.y]}>
      <meshStandardMaterial color="#2a5a8a" transparent opacity={0.75} />
    </mesh>
  );
};

const RoadPiece: React.FC<{ chunk: LoadedChunk }> = ({ chunk }) => {
  const roads = chunk.bundle.roads;
  const geometry = useDisposableGeometry(
    roads ?? { positions: new Float32Array(0), indices: new Uint32Array(0), normals: new Float32Array(0) },
  );
  if (!roads) return null;
  const origin = chunkOriginWorld(chunk.cx, chunk.cy);
  return (
    <mesh geometry={geometry} position={[origin.x, 0, origin.y]}>
      <meshStandardMaterial color="#9a8458" />
    </mesh>
  );
};

const SitePieces: React.FC<{ chunk: LoadedChunk }> = ({ chunk }) => {
  const origin = chunkOriginWorld(chunk.cx, chunk.cy);
  return (
    <group position={[origin.x, 0, origin.y]}>
      {chunk.bundle.sites.map((s) => (
        <mesh key={s.id} position={[s.localX, s.radius * 0.5, s.localZ]} castShadow>
          <boxGeometry args={[s.radius, s.radius, s.radius]} />
          <meshStandardMaterial color={s.kind === 'town' ? '#caa46a' : s.kind === 'dungeon' ? '#555555' : '#888888'} />
        </mesh>
      ))}
    </group>
  );
};

const VegetationPiece: React.FC<{ chunk: LoadedChunk }> = ({ chunk }) => {
  const veg = chunk.bundle.vegetation;
  const origin = chunkOriginWorld(chunk.cx, chunk.cy);
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
    <group position={[origin.x, 0, origin.y]}>
      <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow>
        <coneGeometry args={[1, 1, 6]} />
        <meshStandardMaterial color="#2f5d2f" flatShading />
      </instancedMesh>
    </group>
  );
};

const ChunkPieces: React.FC<{ chunk: LoadedChunk }> = ({ chunk }) => (
  <>
    <TerrainPiece chunk={chunk} />
    <WaterPiece chunk={chunk} />
    <RoadPiece chunk={chunk} />
    <SitePieces chunk={chunk} />
    <VegetationPiece chunk={chunk} />
  </>
);

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
          <ChunkPieces key={`${c.cx}|${c.cy}`} chunk={c} />
        ))}
      </Canvas>
    </div>
  );
};

export default World3DScene;

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 17:58:48
 * Dependents: components/World3D/World3DDemo.tsx, components/World3D/World3DWrapper.tsx
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import { syncVegetationInstanceMatrices } from './vegetationInstanceMatrices';
import { useChunkStreaming } from './useChunkStreaming';
import World3DNameplates from './World3DNameplates';
import type { ChunkLoader, LoadedChunk } from '@/systems/world3d/types';
import { chunkOriginWorld } from '@/systems/world3d/coords';
import { worldToScene, type SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { WORLD3D_CONFIG } from '@/systems/world3d/config';
import type { PlayerWorldPosition } from '@/types';

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
  /** Live player position for distance-gated label overlays. */
  playerWorldPos?: PlayerWorldPosition | null;
  /**
   * Camera framing: 'continent' (default) is the high oblique km-scale
   * view; 'ground' frames a walking-scale scene (Worldforge ground mode) â€”
   * low, close, overlooking the spawn like a diorama.
   */
  viewProfile?: 'continent' | 'ground';
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
      <meshStandardMaterial color="#6f5a3e" /> {/* darker earth: road ribbons must contrast with grass at walking scale */}
    </mesh>
  );
};

// Roof rise scales with the building's narrow span (classic pitched-roof
// proportion) but stays within walkable-scale bounds.
const roofHeight = (w: number, d: number): number =>
  Math.max(1.2, Math.min(3, Math.min(w, d) * 0.5));

const SitePieces: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => {
  return (
    <group position={chunkScenePos(chunk.cx, chunk.cy, origin)}>
      {chunk.bundle.sites.map((s) =>
        s.markerOnly ? null : s.boxWidth && s.boxDepth && s.boxHeight ? (
          // Footprint-true building (Worldforge town plans): rotated box
          // sized by the plot's actual edges, walls warm plaster-and-timber
          <group
            key={`${chunk.cx}|${chunk.cy}|${s.id}`}
            position={[s.localX, s.surfaceY, s.localZ]}
            rotation={[0, s.rotationY ?? 0, 0]}
          >
            <mesh position={[0, s.boxHeight * 0.5, 0]} castShadow={SHADOWS}>
              <boxGeometry args={[s.boxWidth, s.boxHeight, s.boxDepth]} />
              <meshStandardMaterial color={s.colorHex ?? '#b09a72'} />
            </mesh>
            {/* Hip roof: a 4-segment cone is a pyramid whose base square is
                45°-rotated, so the extra π/4 yaw realigns its edges with the
                walls; 1.08 base scale gives a small eave overhang. */}
            <mesh
              position={[0, s.boxHeight + roofHeight(s.boxWidth, s.boxDepth) * 0.5, 0]}
              rotation={[0, Math.PI / 4, 0]}
              scale={[s.boxWidth * 1.08, roofHeight(s.boxWidth, s.boxDepth), s.boxDepth * 1.08]}
              castShadow={SHADOWS}
            >
              <coneGeometry args={[Math.SQRT1_2, 1, 4]} />
              <meshStandardMaterial color="#7a4a32" flatShading />
            </mesh>
            {/* Door on the street-facing wall (doorZSign), half-proud of the
                plaster so it reads at walking distance. */}
            <mesh
              position={[0, Math.min(2.2, s.boxHeight * 0.8) / 2, (s.doorZSign ?? -1) * s.boxDepth * 0.5]}
            >
              <boxGeometry args={[1.3, Math.min(2.2, s.boxHeight * 0.8), 0.4]} />
              <meshStandardMaterial color="#4a3220" />
            </mesh>
            {/* Shuttered windows flanking the door, mirrored on the rear
                wall — skipped on plots too narrow to carry them. */}
            {s.boxWidth >= 5 &&
              ([-1, 1] as const).flatMap((sideX) =>
                ([-1, 1] as const).map((sideZ) => (
                  <mesh
                    key={`w${sideX}${sideZ}`}
                    position={[sideX * s.boxWidth! * 0.27, 1.6, sideZ * s.boxDepth! * 0.5]}
                  >
                    <boxGeometry args={[0.9, 1.0, 0.3]} />
                    <meshStandardMaterial color="#2f3a4d" />
                  </mesh>
                )),
              )}
          </group>
        ) : (
          <mesh key={`${chunk.cx}|${chunk.cy}|${s.id}`} position={[s.localX, s.surfaceY + s.radius * 0.5, s.localZ]} castShadow={SHADOWS}>
            <boxGeometry args={[s.radius, s.radius, s.radius]} />
            <meshStandardMaterial color={s.kind === 'town' ? '#caa46a' : s.kind === 'dungeon' ? '#555555' : '#888888'} />
          </mesh>
        ),
      )}
    </group>
  );
};

const VegetationPiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => {
  const veg = chunk.bundle.vegetation;
  const ref = useRef<THREE.InstancedMesh>(null);
  // Track the last vegetation payload key so identical worker-cloned scatters do not
  // rewrite every instance matrix again. If vegetation disappears, the key resets so the
  // next mount still repopulates the new mesh.
  const lastVegetationCacheKey = useRef<string | null>(null);
  useEffect(() => {
    if (!veg || !ref.current) {
      lastVegetationCacheKey.current = null;
      return;
    }
    syncVegetationInstanceMatrices(ref.current, veg, lastVegetationCacheKey);
  }, [veg?.cacheKey]);
  const count = veg ? veg.positions.length / 3 : 0;
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

const World3DScene: React.FC<World3DSceneProps> = ({
  loader,
  start,
  startSurfaceY = 0,
  playerWorldPos = null,
  onPositionChange: onPositionChangeOverride,
  onChunkUpdate,
  viewProfile = 'continent',
}) => {
  const { loaded, update } = useChunkStreaming(loader);

  // Lift the camera + its look-at target to the spawn ground elevation. With vertical
  // exaggeration the terrain can rise hundreds of meters, so a fixed low camera ends up
  // below/behind the hills, framing only sky. The horizontal offset is wide (oblique cross-view,
  // ~55Â° from vertical) so the now-exaggerated hill silhouettes read against the sky rather than
  // being viewed near-top-down (which flattens relief). Sized to the ~1km streamed window.
  const camPosition = useMemo<[number, number, number]>(
    () =>
      viewProfile === 'ground'
        ? [60, startSurfaceY + 35, 60] // walking-scale diorama framing
        : [380, startSurfaceY + 260, 380],
    [startSurfaceY, viewProfile],
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
              console.warn('[world3d] WebGL context lost â€” will attempt restore');
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
        {/* Ground profile pulls the fog in to meet the artifact-edge haze;
            continent keeps the km-scale falloff. */}
        <fog attach="fog" args={viewProfile === 'ground' ? [0x9fb8d0, 350, 1600] : [0x9fb8d0, 900, 4500]} />
        <FreeRoamCameraController
          initialTarget={[0, startSurfaceY, 0]}
          sceneOrigin={sceneOrigin}
          onPositionChange={onPositionChange}
          // Walking scale: allow dollying to 2 m (eye level beside a door)
          // instead of the continent's 20 m floor.
          minDistance={viewProfile === 'ground' ? 2 : 20}
          maxDistance={viewProfile === 'ground' ? 800 : 2000}
        />
        <World3DNameplates
          loaded={loaded}
          sceneOrigin={sceneOrigin}
          playerWorldPos={playerWorldPos}
        />
        {loaded.map((c) => (
          <ChunkPieces key={`${c.cx}|${c.cy}`} chunk={c} origin={sceneOrigin} />
        ))}
      </Canvas>
    </div>
  );
};

export default World3DScene;


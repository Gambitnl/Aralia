// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 17:45:59
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
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';
import FreeRoamCameraController from './FreeRoamCameraController';
import { syncVegetationInstanceMatrices } from './vegetationInstanceMatrices';
import { useChunkStreaming } from './useChunkStreaming';
import World3DNameplates from './World3DNameplates';
import GroundAgents from './GroundAgents';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { ChunkLoader, LoadedChunk } from '@/systems/world3d/types';
import { chunkOriginWorld } from '@/systems/world3d/coords';
import { worldToScene, type SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { WORLD3D_CONFIG } from '@/systems/world3d/config';
import type { PlayerWorldPosition } from '@/types';
import { useForgeTexture, getSemanticAssetKey } from '@/systems/worldforge/bridge/forgeMaterials';
import type { ForgeAssetService } from '@/systems/worldforge/assets/forgeAssetService';

export const ForgeAssetContext = React.createContext<ForgeAssetService | undefined>(undefined);

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
  /** Service for runtime AI-generated textures. */
  forgeAssetService?: ForgeAssetService;
  /** WF ground world — when present, townsfolk walk its streets (ground mode). */
  groundWorld?: GroundWorld | null;
  /** Fractional hour driving agent schedules/motion (live game clock). */
  agentClock?: number;
}

const SHADOWS = WORLD3D_CONFIG.STREAMED_WORLD_SHADOWS;

// Sun direction shared by the atmospheric sky and the directional light so the
// lit side of terrain/buildings matches where the sun visibly sits in the sky.
const SUN_DIRECTION: [number, number, number] = [120, 150, 80];

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
  const service = React.useContext(ForgeAssetContext);
  const tex = useForgeTexture(getSemanticAssetKey({ surface: 'ground' }), service);
  return (
    <mesh geometry={geometry} position={chunkScenePos(chunk.cx, chunk.cy, origin)} receiveShadow={SHADOWS}>
      <meshStandardMaterial vertexColors flatShading map={tex || null} />
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
      {/* Low roughness + slight metalness gives the water a sun specular sheen
          instead of reading as flat blue paint. */}
      <meshStandardMaterial color="#1d4f7a" transparent opacity={0.82} roughness={0.18} metalness={0.15} />
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
      <meshStandardMaterial color="#a08b62" /> {/* packed dirt: light enough to read against grass at walking scale (shot-1 review) */}
    </mesh>
  );
};

const WallPiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => {
  const walls = chunk.bundle.walls;
  const geometry = useDisposableGeometry(
    walls ?? { positions: new Float32Array(0), indices: new Uint32Array(0), normals: new Float32Array(0) },
  );
  if (!walls) return null;
  return (
    <mesh geometry={geometry} position={chunkScenePos(chunk.cx, chunk.cy, origin)} castShadow={SHADOWS} receiveShadow={SHADOWS}>
      <meshStandardMaterial color="#9a9387" roughness={0.95} side={THREE.DoubleSide} /> {/* weathered stone rampart */}
    </mesh>
  );
};

const DeckPiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => {
  const decks = chunk.bundle.decks;
  const geometry = useDisposableGeometry(
    decks ?? { positions: new Float32Array(0), indices: new Uint32Array(0), normals: new Float32Array(0) },
  );
  if (!decks) return null;
  return (
    <mesh geometry={geometry} position={chunkScenePos(chunk.cx, chunk.cy, origin)} castShadow={SHADOWS} receiveShadow={SHADOWS}>
      <meshStandardMaterial color="#6b4b2f" roughness={0.9} side={THREE.DoubleSide} /> {/* timber dock/bridge planking */}
    </mesh>
  );
};

// Roof rise scales with the building's narrow span (classic pitched-roof
// proportion) but stays within walkable-scale bounds.
const roofHeight = (w: number, d: number): number =>
  Math.max(1.2, Math.min(3, Math.min(w, d) * 0.5));

// Enterable buildings have a smaller wall envelope inside the reserved plot.
// Their roof should hug that wall envelope with a readable eave instead of
// spanning the whole plot and exposing an open soffit gap.
const EAVE_M = 0.45;

function roofFootprint(s: LoadedChunk['bundle']['sites'][number]): { width: number; depth: number } {
  if (
    s.parts &&
    typeof s.wallWidthM === 'number' &&
    typeof s.wallDepthM === 'number'
  ) {
    return {
      width: s.wallWidthM + EAVE_M * 2,
      depth: s.wallDepthM + EAVE_M * 2,
    };
  }

  // Legacy solid-shell sites still use the plot footprint eave. This preserves
  // continent-mode buildings and older chunks that do not carry interior parts.
  return {
    width: (s.boxWidth ?? 0) * 1.08,
    depth: (s.boxDepth ?? 0) * 1.08,
  };
}

// Debug toggle: ?wf_roofless=1 hides roofs on interior-bearing buildings so
// rooms/furnishings/occupants can be inspected (and captured) from above.
const ROOFLESS =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('wf_roofless') === '1';

/**
 * One footprint-true building (Worldforge town plan): rotated walls/parts +
 * hip roof + door/windows. The roof AUTO-HIDES when the camera moves inside
 * the building so the player can look around an interior without the
 * clip-through-the-wall hack — converting the camera into the group's local
 * frame each frame makes the inside-test rotation-correct.
 */
const SiteBuilding: React.FC<{ site: LoadedChunk['bundle']['sites'][number] }> = ({ site: s }) => {
  const groupRef = useRef<THREE.Group>(null);
  const roofRef = useRef<THREE.Mesh>(null);
  const localCam = useRef(new THREE.Vector3());

  const service = React.useContext(ForgeAssetContext);
  const role = s.colorHex === '#c8923f' ? 'market' : s.colorHex === '#b09a72' ? 'house' : s.kind;
  const wallTex = useForgeTexture(getSemanticAssetKey({ surface: 'wall', role }), service);
  const roofTex = useForgeTexture(getSemanticAssetKey({ surface: 'roof', role }), service);

  useFrame(({ camera }) => {
    const roof = roofRef.current;
    const group = groupRef.current;
    if (!roof || !group) return;
    if (ROOFLESS && s.parts) {
      roof.visible = false;
      return;
    }
    // Camera in the building's local frame (origin at the wall base center).
    localCam.current.copy(camera.position);
    group.worldToLocal(localCam.current);
    const halfW = ((s.wallWidthM ?? s.boxWidth ?? 0) / 2) + 0.5;
    const halfD = ((s.wallDepthM ?? s.boxDepth ?? 0) / 2) + 0.5;
    const inside =
      !!s.parts &&
      Math.abs(localCam.current.x) <= halfW &&
      Math.abs(localCam.current.z) <= halfD &&
      localCam.current.y <= (s.boxHeight ?? 0) + 1.0;
    roof.visible = !inside;
  });

  const roof = roofFootprint(s);
  const rHeight = roofHeight(roof.width, roof.depth);

  return (
    <group ref={groupRef} position={[s.localX, s.surfaceY, s.localZ]} rotation={[0, s.rotationY ?? 0, 0]}>
      {s.parts ? (
        // Seamless interior (Worldforge L4): perimeter + room walls with real
        // door gaps, plus furnishing blocks. Parts use +z = inward-from-street;
        // doorZSign maps that onto whichever face the street actually is.
        s.parts.map((p, i) => (
          <mesh
            key={`part-${i}`}
            position={[p.x, (p.baseY ?? 0) + p.h * 0.5, p.z * -(s.doorZSign ?? -1)]}
            castShadow={SHADOWS}
          >
            <boxGeometry args={[p.w, p.h, p.d]} />
            {/* Apply wall texture only to tall perimeter/interior walls (h >= 2.0) */}
            <meshStandardMaterial color={p.colorHex} map={p.h >= 2.0 ? (wallTex || null) : null} />
          </mesh>
        ))
      ) : (
        <mesh position={[0, (s.boxHeight ?? 0) * 0.5, 0]} castShadow={SHADOWS}>
          <boxGeometry args={[s.boxWidth, s.boxHeight, s.boxDepth]} />
          <meshStandardMaterial color={s.colorHex ?? '#b09a72'} map={wallTex || null} />
        </mesh>
      )}
      {/* Hip roof: a 4-segment cone is a pyramid whose base square is
          45°-rotated, so the extra π/4 yaw realigns its edges with the walls.
          visible is driven per-frame by the camera-inside test above. */}
      <mesh
        ref={roofRef}
        position={[0, (s.boxHeight ?? 0) + rHeight * 0.5, 0]}
        rotation={[0, Math.PI / 4, 0]}
        scale={[roof.width, rHeight, roof.depth]}
        castShadow={SHADOWS}
      >
        <coneGeometry args={[Math.SQRT1_2, 1, 4]} />
        <meshStandardMaterial color="#7a4a32" flatShading side={THREE.DoubleSide} map={roofTex || null} />
      </mesh>
      {/* Door slab + windows only dress the SOLID shell; with interior parts
          the entry gap in the perimeter wall is the door. */}
      {!s.parts && (
        <mesh
          position={[0, Math.min(2.2, (s.boxHeight ?? 0) * 0.8) / 2, (s.doorZSign ?? -1) * (s.boxDepth ?? 0) * 0.5]}
        >
          <boxGeometry args={[1.3, Math.min(2.2, (s.boxHeight ?? 0) * 0.8), 0.4]} />
          <meshStandardMaterial color="#4a3220" />
        </mesh>
      )}
      {!s.parts &&
        (s.boxWidth ?? 0) >= 5 &&
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
  );
};

const SitePieces: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => {
  return (
    <group position={chunkScenePos(chunk.cx, chunk.cy, origin)}>
      {chunk.bundle.sites.map((s) =>
        s.markerOnly ? null : s.boxWidth && s.boxDepth && s.boxHeight ? (
          <SiteBuilding key={`${chunk.cx}|${chunk.cy}|${s.id}`} site={s} />
        ) : (
          // Renders a simple primitive cube for legacy sites that don't have detailed
          // oriented-box footprints or enterable parts.
          <mesh key={`${chunk.cx}|${chunk.cy}|${s.id}`} position={[s.localX, s.surfaceY + s.radius * 0.5, s.localZ]} castShadow={SHADOWS}>
            <boxGeometry args={[s.radius, s.radius, s.radius]} />
            {/* 
              Choose the mesh color based on the site kind:
              - Town: Goldish sand color (#caa46a)
              - Dungeon: Dark stone grey (#555555)
              - Monster: High-contrast red (#d9534f) to highlight hostiles in ground mode
              - Other: Neutral light grey (#888888)
            */}
            <meshStandardMaterial color={s.kind === 'town' ? '#caa46a' : s.kind === 'dungeon' ? '#555555' : s.kind === 'monster' ? '#d9534f' : '#888888'} />
          </mesh>
        ),
      )}
    </group>
  );
};

const VegetationPiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => {
  const veg = chunk.bundle.vegetation;
  const bushes = chunk.bundle.bushes;
  const treeRef = useRef<THREE.InstancedMesh>(null);
  const bushRef = useRef<THREE.InstancedMesh>(null);
  // Track the last payload keys so identical worker-cloned scatters do not
  // rewrite every instance matrix again (W3D-G25). Trees and bushes are
  // separate instanced layers (variety dispatch 2026-06-12): distinct
  // geometry + per-instance palette colors, one draw call per kind.
  const lastTreeCacheKey = useRef<string | null>(null);
  const lastBushCacheKey = useRef<string | null>(null);
  useEffect(() => {
    if (!veg || !treeRef.current) {
      lastTreeCacheKey.current = null;
      return;
    }
    syncVegetationInstanceMatrices(treeRef.current, veg, lastTreeCacheKey, 'tree');
  }, [veg?.cacheKey]);
  useEffect(() => {
    if (!bushes || !bushRef.current) {
      lastBushCacheKey.current = null;
      return;
    }
    syncVegetationInstanceMatrices(bushRef.current, bushes, lastBushCacheKey, 'bush');
  }, [bushes?.cacheKey]);
  const treeCount = veg ? veg.positions.length / 3 : 0;
  const bushCount = bushes ? bushes.positions.length / 3 : 0;
  if (treeCount === 0 && bushCount === 0) return null;
  return (
    <group position={chunkScenePos(chunk.cx, chunk.cy, origin)}>
      {treeCount > 0 && (
        <instancedMesh ref={treeRef} args={[undefined, undefined, treeCount]} castShadow={SHADOWS}>
          <coneGeometry args={[1, 1, 8]} />
          {/* White base: per-instance palette colors multiply against it. */}
          <meshStandardMaterial color="#ffffff" flatShading />
        </instancedMesh>
      )}
      {bushCount > 0 && (
        <instancedMesh ref={bushRef} args={[undefined, undefined, bushCount]} castShadow={SHADOWS}>
          <sphereGeometry args={[1, 6, 4]} />
          <meshStandardMaterial color="#ffffff" flatShading />
        </instancedMesh>
      )}
    </group>
  );
};

const ChunkPieces: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => (
  <>
    <TerrainPiece chunk={chunk} origin={origin} />
    <WaterPiece chunk={chunk} origin={origin} />
    <RoadPiece chunk={chunk} origin={origin} />
    <WallPiece chunk={chunk} origin={origin} />
    <DeckPiece chunk={chunk} origin={origin} />
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
  forgeAssetService,
  groundWorld = null,
  agentClock,
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
    <div style={{ width: '100%', height: '100%', minHeight: '520px', flex: '1 1 auto', background: '#cdd9e6', borderRadius: '12px', overflow: 'hidden' }}>
      <ForgeAssetContext.Provider value={forgeAssetService}>
      <Canvas
        shadows={SHADOWS}
        camera={{ fov: 55, near: 1, far: 60000, position: camPosition }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
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
        {/* Atmospheric sky dome (Preetham scattering) — sun aligned to the
            directional light so highlights match the visible sun. Replaces the
            flat background colour with a real graduated sky + horizon haze. */}
        <Sky
          distance={45000}
          sunPosition={SUN_DIRECTION}
          turbidity={6}
          rayleigh={1.2}
          mieCoefficient={0.005}
          mieDirectionalG={0.8}
        />
        {/* Cool sky / warm bounce hemisphere fill + a warm sun key light. */}
        <hemisphereLight args={[0xbcd6ff, 0x6b6048, 0.75]} />
        <directionalLight position={SUN_DIRECTION} intensity={1.9} color={0xfff1da} />
        {/* Ground profile pulls the fog in to meet the artifact-edge haze;
            continent keeps the km-scale falloff. Warm horizon haze matches the
            sky so distant terrain dissolves into it instead of a flat wall. */}
        <fog attach="fog" args={viewProfile === 'ground' ? [0xcdd9e6, 450, 2000] : [0xcdd9e6, 1100, 5200]} />
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
        <GroundAgents ground={groundWorld} clock={agentClock} sceneOrigin={sceneOrigin} />
      </Canvas>
      </ForgeAssetContext.Provider>
    </div>
  );
};

export default World3DScene;


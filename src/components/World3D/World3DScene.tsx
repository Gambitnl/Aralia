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
import FreeRoamCameraController, { type CameraFrameRequest } from './FreeRoamCameraController';
import { syncVegetationInstanceMatrices } from './vegetationInstanceMatrices';
import { useChunkStreaming } from './useChunkStreaming';
import World3DNameplates from './World3DNameplates';
import GroundAgents from './GroundAgents';
import SceneCast, { type SceneCastMember } from './SceneCast';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { ChunkCoord, ChunkLoader, LoadedChunk, TerrainEdgeSkirt } from '@/systems/world3d/types';
import { buildRoofGeometry } from '@/systems/world3d/buildingModels';
import type { RoofForm } from '@/systems/worldforge/town/architectureStyle';
import { chunkOriginWorld, worldToChunk } from '@/systems/world3d/coords';
import { rebaseChunkPositions } from '@/systems/world3d/chunkRebase';
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
  /**
   * Bumping this (vs its previous value) pulls the 3D camera up to frame the
   * whole spawn town from above — the HUD "Town Cell" overhead view. Stays in
   * the same scene; no view switch.
   */
  frameTownCellNonce?: number;
  /**
   * Staged scene cast — the player + opening-situation strangers, rendered as
   * figures at the spawn so the opening predicament is visible in-world. Empty
   * once the opening is over.
   */
  sceneCast?: SceneCastMember[];
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

/**
 * One frontier skirt strip. Mounted unconditionally (stable hooks); the mesh
 * only renders while the strip's edge has no loaded neighbour. Interior seams
 * are bit-identical watertight, so a wall there could only ever show as an
 * MSAA dotted-hairline artifact — hence frontier-only.
 */
const FrontierSkirt: React.FC<{
  strip: TerrainEdgeSkirt;
  visible: boolean;
  dcx: number;
  dcy: number;
  scenePos: [number, number, number];
  tex: THREE.Texture | null;
}> = ({ strip, visible, dcx, dcy, scenePos, tex }) => {
  const rebased = useMemo(
    () => ({ ...strip, positions: rebaseChunkPositions(strip.positions, dcx, dcy) }),
    [strip, dcx, dcy],
  );
  const geometry = useDisposableGeometry(rebased);
  if (!visible) return null;
  return (
    <mesh geometry={geometry} position={scenePos} receiveShadow={SHADOWS}>
      <meshStandardMaterial vertexColors flatShading map={tex || null} />
    </mesh>
  );
};

const SKIRT_EDGES = [
  { edge: 'north', dx: 0, dy: -1 },
  { edge: 'east', dx: 1, dy: 0 },
  { edge: 'south', dx: 0, dy: 1 },
  { edge: 'west', dx: -1, dy: 0 },
] as const;

/**
 * Terrain renders under ONE shared transform: every chunk's positions are
 * rebased by its exact chunk offset from the anchor chunk (multiples of 128 m
 * — exact in float32) and the mesh sits at the ANCHOR's scene position. Two
 * neighbours then reach clip space through bit-identical vertex values AND a
 * bit-identical modelView matrix, so their shared border edges rasterize
 * watertight. With per-chunk translations, the per-mesh matrix rounding
 * disagreed in the last ulp and leaked a faint dotted hairline along seams.
 */
const TerrainPiece: React.FC<{
  chunk: LoadedChunk;
  origin: SceneOrigin;
  anchor: ChunkCoord;
  loadedKeys: Set<string>;
}> = ({ chunk, origin, anchor, loadedKeys }) => {
  const terrain = chunk.bundle.terrain;
  const rebased = useMemo(
    () => ({
      ...terrain,
      positions: rebaseChunkPositions(terrain.positions, chunk.cx - anchor.cx, chunk.cy - anchor.cy),
    }),
    [terrain, chunk.cx, chunk.cy, anchor],
  );
  const geometry = useDisposableGeometry(rebased);
  const service = React.useContext(ForgeAssetContext);
  const tex = useForgeTexture(getSemanticAssetKey({ surface: 'ground' }), service);
  const scenePos = chunkScenePos(anchor.cx, anchor.cy, origin);
  return (
    <>
      <mesh geometry={geometry} position={scenePos} receiveShadow={SHADOWS}>
        <meshStandardMaterial vertexColors flatShading map={tex || null} />
      </mesh>
      {terrain.skirts &&
        SKIRT_EDGES.map(({ edge, dx, dy }) => (
          <FrontierSkirt
            key={edge}
            strip={terrain.skirts![edge]}
            visible={!loadedKeys.has(`${chunk.cx + dx}|${chunk.cy + dy}`)}
            dcx={chunk.cx - anchor.cx}
            dcy={chunk.cy - anchor.cy}
            scenePos={scenePos}
            tex={tex ?? null}
          />
        ))}
    </>
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
      {/* Ground/walking-scale water. Metalness is kept near-zero: a metallic
          surface goes black wherever it isn't catching a light, which is most
          of the frame at the low/grazing, back-lit angles normal at eye level —
          that was the "dark pit" read (TG4). A brighter dielectric tint plus a
          small emissive lift keeps it reading as blue water from any angle,
          while a low roughness still gives the sun a specular sheen. */}
      <meshStandardMaterial
        color="#2f78b4"
        emissive="#123a5c"
        emissiveIntensity={0.35}
        transparent
        opacity={0.86}
        roughness={0.22}
        metalness={0.0}
      />
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
  // Styled-architecture slice: each town's ramparts carry their style family's
  // wall tint as per-vertex colors (buildWallMesh); the white base avoids
  // re-tinting them. Runs without a tint bake the legacy #9a9387 stone.
  return (
    <mesh geometry={geometry} position={chunkScenePos(chunk.cx, chunk.cy, origin)} castShadow={SHADOWS} receiveShadow={SHADOWS}>
      <meshStandardMaterial vertexColors color="#ffffff" roughness={0.95} side={THREE.DoubleSide} />
    </mesh>
  );
};

const GatePiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => {
  const gates = chunk.bundle.gates;
  const geometry = useDisposableGeometry(
    gates ?? { positions: new Float32Array(0), indices: new Uint32Array(0), normals: new Float32Array(0) },
  );
  if (!gates) return null;
  // Gatehouse towers/lintels at town road gates (buildGateMesh), vertex-tinted
  // with the burg's wall color so they read as part of the same rampart.
  return (
    <mesh geometry={geometry} position={chunkScenePos(chunk.cx, chunk.cy, origin)} castShadow={SHADOWS} receiveShadow={SHADOWS}>
      <meshStandardMaterial vertexColors color="#ffffff" roughness={0.95} side={THREE.DoubleSide} />
    </mesh>
  );
};

const DeckPiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => {
  const decks = chunk.bundle.decks;
  const geometry = useDisposableGeometry(
    decks ?? { positions: new Float32Array(0), indices: new Uint32Array(0), normals: new Float32Array(0) },
  );
  if (!decks) return null;
  // TG5: docks and bridges share one mesh but carry per-vertex tint — weathered
  // dark timber for quays, pale dressed stone/planking for bridge spans — so a
  // quay and a bridge span read distinctly. `vertexColors` consumes the per-deck
  // colors emitted by buildDeckMesh; the white base avoids tinting them.
  return (
    <mesh geometry={geometry} position={chunkScenePos(chunk.cx, chunk.cy, origin)} castShadow={SHADOWS} receiveShadow={SHADOWS}>
      <meshStandardMaterial vertexColors color="#ffffff" roughness={0.9} side={THREE.DoubleSide} />
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

// Styled roof geometry (Task 7): buildings share BufferGeometries per
// (form, rounded dims) so a town of near-identical houses allocates a
// handful of geometries instead of one per building. Cache entries are
// module-lifetime — tiny faceted meshes, bounded by the dim rounding.
const roofGeomCache = new Map<string, THREE.BufferGeometry>();
function useRoofGeometry(form: RoofForm, w: number, d: number, h: number): THREE.BufferGeometry {
  return React.useMemo(() => {
    const key = `${form}|${w.toFixed(1)}|${d.toFixed(1)}|${h.toFixed(1)}`;
    let geo = roofGeomCache.get(key);
    if (!geo) {
      const a = buildRoofGeometry(form, w, d, h);
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(a.positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(a.normals, 3));
      geo.setIndex(new THREE.BufferAttribute(a.indices, 1));
      roofGeomCache.set(key, geo);
    }
    return geo;
  }, [form, w, d, h]);
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
  // Explicit role wins (styled-architecture chunks carry it). The colorHex
  // sniff survives ONLY as a legacy tail for old chunks minted before `role`
  // existed — palette wall colors would break it, so it must never be primary.
  const role = s.role ?? (s.colorHex === '#c8923f' ? 'market' : s.colorHex === '#b09a72' ? 'house' : s.kind);
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
  // Styled roof form from the burg's architecture family; absent = legacy hip.
  const roofForm: RoofForm = s.roofForm ?? 'hip';
  const roofGeom = useRoofGeometry(roofForm, roof.width, roof.depth, rHeight);

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
      {/* Styled roof (Task 7): real-size buildRoofGeometry mesh with its base
          at y=0, placed at wall-top Y — no scale/yaw/half-rise offsets (those
          were artifacts of the old 4-segment cone-as-pyramid). visible is
          driven per-frame by the camera-inside test above. */}
      <mesh ref={roofRef} position={[0, s.boxHeight ?? 0, 0]} geometry={roofGeom} castShadow={SHADOWS}>
        <meshStandardMaterial color={s.roofColorHex ?? '#7a4a32'} flatShading side={THREE.DoubleSide} map={roofTex || null} />
      </mesh>
      {/* Chimney: style-family flag, solid shells only (interior-parts buildings
          would need a flue through the rooms), and never on flat parapet roofs. */}
      {s.chimney && !s.parts && roofForm !== 'flat' && (
        <mesh position={[roof.width * 0.3, (s.boxHeight ?? 0) + rHeight * 0.9, 0]} castShadow={SHADOWS}>
          <boxGeometry args={[0.6, 1.4, 0.6]} />
          <meshStandardMaterial color="#6e6c66" />
        </mesh>
      )}
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

const ChunkPieces: React.FC<{
  chunk: LoadedChunk;
  origin: SceneOrigin;
  anchor: ChunkCoord;
  loadedKeys: Set<string>;
}> = ({ chunk, origin, anchor, loadedKeys }) => (
  <>
    <TerrainPiece chunk={chunk} origin={origin} anchor={anchor} loadedKeys={loadedKeys} />
    <WaterPiece chunk={chunk} origin={origin} />
    <RoadPiece chunk={chunk} origin={origin} />
    <WallPiece chunk={chunk} origin={origin} />
    <GatePiece chunk={chunk} origin={origin} />
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
  frameTownCellNonce = 0,
  sceneCast,
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
  // Anchor chunk for the shared terrain transform (see TerrainPiece). Frozen
  // with the scene origin so rebased coordinates stay small for the session.
  const anchorChunk: ChunkCoord = useMemo(
    () => worldToChunk(sceneOrigin.x, sceneOrigin.z),
    [sceneOrigin],
  );
  // Loaded-chunk key set: frontier skirts draw only on edges with no neighbour.
  const loadedKeys = useMemo(() => new Set(loaded.map((c) => `${c.cx}|${c.cy}`)), [loaded]);

  // Overhead "Town Cell" framing (HUD button). When frameTownCellNonce changes,
  // build a one-shot command that lifts the camera to fit the spawn town. The
  // spawn town is the one nearest the scene origin (the origin sits on the
  // spawn); height fits its half-extent in the 55° vertical FOV with margin,
  // clamped under the ground dolly ceiling. Nonce 0 = no command yet.
  const townFrameRequest = useMemo<CameraFrameRequest | null>(() => {
    if (!frameTownCellNonce) return null;
    const towns = groundWorld?.towns ?? [];
    let target: [number, number, number] = [0, startSurfaceY, 0];
    let halfM = 160;
    if (towns.length) {
      let best = towns[0];
      let bestDist = Infinity;
      for (const t of towns) {
        const s = worldToScene(t.xM, t.zM, sceneOrigin);
        const dist = Math.hypot(s.x, s.z);
        if (dist < bestDist) { bestDist = dist; best = t; }
      }
      const s = worldToScene(best.xM, best.zM, sceneOrigin);
      target = [s.x, startSurfaceY, s.z];
      halfM = best.halfM;
    }
    const height = Math.min(1400, Math.max(120, halfM * 2.6));
    return { nonce: frameTownCellNonce, target, height };
  }, [frameTownCellNonce, groundWorld, sceneOrigin, startSurfaceY]);

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
        onCreated={({ gl, scene }) => {
          // Dev hook (like __wf3dSetPose): lets headless probes inspect the live
          // scene graph — chunk mesh counts, geometry sizes, transforms.
          (window as unknown as { __wf3dScene?: THREE.Scene }).__wf3dScene = scene;
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
          // Ground ceiling raised to 1500 m so the "Town Cell" overhead framing
          // (up to ~1400 m for a big capital) isn't clamped by MapControls.update().
          maxDistance={viewProfile === 'ground' ? 1500 : 2000}
          frameRequest={townFrameRequest}
        />
        <World3DNameplates
          loaded={loaded}
          sceneOrigin={sceneOrigin}
          playerWorldPos={playerWorldPos}
        />
        {loaded.map((c) => (
          <ChunkPieces
            key={`${c.cx}|${c.cy}`}
            chunk={c}
            origin={sceneOrigin}
            anchor={anchorChunk}
            loadedKeys={loadedKeys}
          />
        ))}
        <GroundAgents ground={groundWorld} clock={agentClock} sceneOrigin={sceneOrigin} />
        {sceneCast && sceneCast.length > 0 && (
          <SceneCast cast={sceneCast} surfaceY={startSurfaceY} />
        )}
      </Canvas>
      </ForgeAssetContext.Provider>
    </div>
  );
};

export default World3DScene;


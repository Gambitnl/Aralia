// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 21:08:12
 * Dependents: components/Combat/InPlaceCombatScene.tsx, components/World3D/World3DDemo.tsx, components/World3D/World3DWrapper.tsx
 * Imports: 29 files
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
import * as THREE from 'three';
import World3DLighting from './World3DLighting';
import { canopyInterior, NEUTRAL_INTERIOR, type CanopyInterior } from './canopyInterior';
import InteriorLights from './InteriorLights';
import InteriorOccupants from './InteriorOccupants';
import { InteriorHourProvider, useInteriorHour, emissiveForPart } from './InteriorHourContext';
import FreeRoamCameraController, { type CameraFrameRequest } from './FreeRoamCameraController';
import { syncVegetationInstanceMatrices } from './vegetationInstanceMatrices';
import { VegetationTrees } from './vegetation/VegetationTrees';
import { GrassLayer } from './vegetation/GrassLayer';
import { useChunkStreaming } from './useChunkStreaming';
import World3DNameplates from './World3DNameplates';
import GroundAgents from './GroundAgents';
import GroundProps from './GroundProps';
import DungeonEntrances from './DungeonEntrances';
import SceneCast, { type SceneCastMember } from './SceneCast';
import PlayerAvatar from './PlayerAvatar';
import GroundMovePlane from './GroundMovePlane';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { ChunkCoord, ChunkLoader, LoadedChunk, TerrainEdgeSkirt } from '@/systems/world3d/types';
import { buildRoofGeometry } from '@/systems/world3d/buildingModels';
import type { RoofForm } from '@/systems/worldforge/town/architectureStyle';
import { chunkOriginWorld, worldToChunk } from '@/systems/world3d/coords';
import { rebaseChunkPositions } from '@/systems/world3d/chunkRebase';
import { worldToScene, type SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { WORLD3D_CONFIG } from '@/systems/world3d/config';
import {
  isSitePartRenderable,
  sitePartLocalOffset,
} from '@/systems/worldforge/bridge/sitePartTransform';
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
  /**
   * Click-to-talk: called with an NPC figure's id when the player clicks it in
   * the 3D world. Wired to the same `talk` action the 2D action pane uses, so
   * the conversation/dialogue opens with full bookkeeping.
   */
  onSelectNpc?: (npcId: string) => void;
  /**
   * Click-to-move (interactive-3D locomotion): called with a clicked ground
   * destination in tile/world meters when the player clicks open ground. Wired
   * to `SET_PLAYER_GROUND_POS`, the same movement state the camera walk drives.
   */
  onGroundPick?: (xM: number, zM: number) => void;
  /**
   * Ground mode: the player's LOGICAL position (tile-local ground meters,
   * `playerGroundPos`) — drives the visible player avatar. Camera walk and
   * Locale-map click-to-move both write this state, so the body follows both.
   */
  playerGroundPos?: { xM: number; zM: number } | null;
  /** Ground mode: the real character — race/class/gear shape the avatar body. */
  playerCharacter?: import('@/types/character').PlayerCharacter | null;
  /**
   * Fractional hour driving the sun/sky/fog model (World3DLighting). Plumbed
   * for the game clock; defaults to a pleasant fixed late-morning.
   */
  timeOfDayHours?: number;
  /**
   * Fight-in-place slice 2: extra R3F content mounted INSIDE the Canvas after
   * the world/agents/avatar — the combat token layer, reachable-area disc, and
   * ground-pick plane. Rendered as-is so the combat surface can draw its actors
   * on the streamed terrain without World3DScene knowing anything about combat.
   */
  combatLayer?: React.ReactNode;
  /**
   * Fight-in-place slice 2: one-shot camera framing forwarded to the camera
   * controller (same mechanism as the "Town Cell" nonce, but caller-built so a
   * fight can frame its own combat area on initiative start).
   */
  cameraFrameRequest?: CameraFrameRequest | null;
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
  // Per-vertex street tiers (buildRoadMesh): pale avenues, warm paved streets,
  // packed-dirt lanes read under one white-base vertex-colored material. Inherited
  // regional roads bake the same #a08b62 dirt they used before this slice.
  return (
    <mesh geometry={geometry} position={chunkScenePos(chunk.cx, chunk.cy, origin)} receiveShadow={SHADOWS}>
      <meshStandardMaterial vertexColors color="#ffffff" roughness={0.95} />
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
 * Covering-color floor for roof materials (town-look-slice1, 2026-07-18).
 *
 * Away-from-sun roof planes receive only the hemisphere fill (~0.4 effective),
 * and the style families' coverings are dark albedos (slate #3f444b, aged clay
 * #5e3a2c) — the product rendered near-black at play distance (proof:
 * .agent/scratch/town-look-slice1/before-street.png, top-right roof). A bounded
 * self-illumination floor derived from the covering color itself keeps slate,
 * clay, and thatch reading as their material on every face while the sun side
 * still shades visibly brighter. Material-local by design: no scene light was
 * added or retuned, so this cannot affect any other surface.
 */
const ROOF_EMISSIVE_FLOOR = 0.3;

/**
 * One footprint-true building (Worldforge town plan): rotated walls/parts +
 * hip roof + door/windows. The roof AUTO-HIDES when the camera moves inside
 * the building so the player can look around an interior without the
 * clip-through-the-wall hack — converting the camera into the group's local
 * frame each frame makes the inside-test rotation-correct.
 */
const SiteBuilding: React.FC<{
  site: LoadedChunk['bundle']['sites'][number];
  /** Full room geometry is mounted only where the player can enter it. */
  renderInterior: boolean;
}> = ({ site: s, renderInterior }) => {
  const groupRef = useRef<THREE.Group>(null);
  const roofRef = useRef<THREE.Mesh>(null);
  const localCam = useRef(new THREE.Vector3());

  // Live integer game hour: windows/hearths derive emissive from the building's
  // baked schedule against this, so they light and darken with the clock without
  // a chunk re-mesh. Read once here (not inside the parts.map) per rules-of-hooks.
  const hour = useInteriorHour();

  const service = React.useContext(ForgeAssetContext);
  // Explicit role wins (styled-architecture chunks carry it). The colorHex
  // sniff survives ONLY as a legacy tail for old chunks minted before `role`
  // existed — palette wall colors would break it, so it must never be primary.
  const role = s.role ?? (s.colorHex === '#c8923f' ? 'market' : s.colorHex === '#b09a72' ? 'house' : s.kind);
  const wallTex = useForgeTexture(getSemanticAssetKey({ surface: 'wall', role }), service);
  const roofTex = useForgeTexture(getSemanticAssetKey({ surface: 'roof', role }), service);
  const hasLiveInterior = renderInterior && !!s.parts;
  // Shadow maps are camera-local too: distant shells keep their color and
  // silhouette, while nearby buildings retain the grounding/readability pass.
  const castsLocalShadow = SHADOWS && renderInterior;

  // A roof can be hidden only while its enterable interior is live. Restore it
  // immediately when player-proximity LOD turns that building back into a
  // shell; otherwise a roof hidden during an earlier visit could stay absent.
  React.useEffect(() => {
    if (!hasLiveInterior && roofRef.current) roofRef.current.visible = true;
  }, [hasLiveInterior]);

  useFrame(({ camera }) => {
    // Dense towns contain hundreds of distant shells. They can never hide
    // their roofs, so avoid a world-to-local camera transform for every one on
    // every frame. Only the handful of walk-up interiors need this live test.
    if (!hasLiveInterior) return;
    const roof = roofRef.current;
    const group = groupRef.current;
    if (!roof || !group) return;
    if (ROOFLESS && hasLiveInterior) {
      roof.visible = false;
      return;
    }
    // Camera in the building's local frame (origin at the wall base center).
    localCam.current.copy(camera.position);
    group.worldToLocal(localCam.current);
    const halfW = ((s.wallWidthM ?? s.boxWidth ?? 0) / 2) + 0.5;
    const halfD = ((s.wallDepthM ?? s.boxDepth ?? 0) / 2) + 0.5;
    const inside =
      hasLiveInterior &&
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

  // Solved roof (BGv2 Task 5): a blueprint-driven building whose plan resolved a
  // style carries a triangulated roof group in site-local meters. When present,
  // it REPLACES the legacy whole-rect prism (gated below). Positions live in the
  // unflipped part frame (+z inward), so the same doorZSign flip the box parts
  // apply per-vertex is applied here via the wrapping group's z scale.
  const solvedRoofGeom = React.useMemo(() => {
    if (!s.solvedRoof) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(s.solvedRoof.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(s.solvedRoof.normals, 3));
    g.setIndex(new THREE.BufferAttribute(s.solvedRoof.indices, 1));
    return g;
  }, [s.solvedRoof]);
  const hasSolvedRoof = !!solvedRoofGeom;

  return (
    <group ref={groupRef} position={[s.localX, s.surfaceY, s.localZ]} rotation={[0, s.rotationY ?? 0, 0]}>
      {hasLiveInterior ? (
        // Seamless interior (Worldforge L4): perimeter + room walls with real
        // door gaps, plus furnishing blocks. Parts use +z = inward-from-street;
        // doorZSign maps that onto whichever face the street actually is.
        s.parts!
          // A non-owning row house keeps its party wall for tactical geometry,
          // but the owning neighbor alone draws the shared masonry.
          .filter(isSitePartRenderable)
          .map((p, i) => {
          const off = sitePartLocalOffset(p, s.doorZSign ?? -1);
          // Window/hearth parts carry a `lightRole` and NO baked emissive; the
          // renderer decides their glow live from the hourly schedule. All other
          // parts stay dark.
          const em = emissiveForPart(p.lightRole, hour, s.litHours, s.hearthHours);
          return (
          <mesh
            key={`part-${i}`}
            position={[off.x, off.y, off.z]}
            // Roofs and shells provide the readable exterior shadow. Casting
            // every chair, wall segment, and window into the same map adds a
            // second full scene pass for little visual value.
            castShadow={false}
            receiveShadow={castsLocalShadow}
          >
            <boxGeometry args={[p.w, p.h, p.d]} />
            {/* Apply wall texture only to tall perimeter/interior walls (h >= 2.0) */}
            <meshStandardMaterial
              color={p.colorHex}
              map={p.h >= 2.0 ? (wallTex || null) : null}
              emissive={em.emissive}
              emissiveIntensity={em.emissiveIntensity}
            />
          </mesh>
          );
          })
      ) : (
        // Performance LOD: distant interior-bearing buildings retain their
        // footprint-true shell. Their authored parts remain in the payload and
        // mount intact as soon as the player enters this chunk.
        <mesh position={[0, (s.boxHeight ?? 0) * 0.5, 0]} castShadow={castsLocalShadow} receiveShadow={castsLocalShadow}>
          <boxGeometry args={[s.boxWidth, s.boxHeight, s.boxDepth]} />
          <meshStandardMaterial color={s.colorHex ?? '#b09a72'} map={wallTex || null} />
        </mesh>
      )}
      {/* Solved roof (BGv2 Task 5): the plan's actual roof (irregular planes,
          valleys, tower caps) baked to one geometry. Its Y already sits on the
          wall top (positions carry wallTopFt), so no boxHeight offset. The
          group's z scale applies the same doorZSign flip the box parts use.
          Auto-hides on camera-enter via roofRef, exactly like the prism. */}
      {hasSolvedRoof ? (
        <group scale={[1, 1, -(s.doorZSign ?? -1)]}>
          <mesh ref={roofRef} geometry={solvedRoofGeom!} castShadow={castsLocalShadow}>
            {/* Covering-color floor: see ROOF_EMISSIVE_FLOOR — dark coverings
                on hemisphere-only faces read as their material, not black. */}
            <meshStandardMaterial
              color={s.solvedRoof!.colorHex}
              flatShading
              side={THREE.DoubleSide}
              map={roofTex || null}
              emissive={s.solvedRoof!.colorHex}
              emissiveIntensity={ROOF_EMISSIVE_FLOOR}
            />
          </mesh>
        </group>
      ) : (
        /* Legacy styled roof (Task 7): real-size buildRoofGeometry prism with its
           base at y=0, placed at wall-top Y. Kept for non-blueprint props and any
           building whose plan resolved no style (no solved roof). visible is
           driven per-frame by the camera-inside test above. */
        <mesh ref={roofRef} position={[0, s.boxHeight ?? 0, 0]} geometry={roofGeom} castShadow={castsLocalShadow}>
          {/* Same covering-color floor as the solved roof so legacy prisms and
              solved roofs stay tonally consistent across one street. */}
          <meshStandardMaterial
            color={s.roofColorHex ?? '#7a4a32'}
            flatShading
            side={THREE.DoubleSide}
            map={roofTex || null}
            emissive={s.roofColorHex ?? '#7a4a32'}
            emissiveIntensity={ROOF_EMISSIVE_FLOOR}
          />
        </mesh>
      )}
      {/* Chimney: style-family flag, solid shells only (interior-parts buildings
          would need a flue through the rooms), and never on flat parapet roofs. */}
      {s.chimney && !s.parts && roofForm !== 'flat' && (
        <mesh position={[roof.width * 0.3, (s.boxHeight ?? 0) + rHeight * 0.9, 0]} castShadow={castsLocalShadow}>
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

const SitePieces: React.FC<{
  chunk: LoadedChunk;
  origin: SceneOrigin;
  detailAnchor: ChunkCoord;
  detailCenter: { x: number; z: number };
}> = ({ chunk, origin, detailAnchor, detailCenter }) => {
  // The streamer retains an 81-chunk landscape window. Mounting every room
  // piece throughout that window created tens of thousands of meshes, so only
  // the player's current chunk carries enterable detail at any one time.
  const renderInteriors = chunk.cx === detailAnchor.cx && chunk.cy === detailAnchor.cy;
  const chunkWorldOrigin = chunkOriginWorld(chunk.cx, chunk.cy);
  return (
    <group position={chunkScenePos(chunk.cx, chunk.cy, origin)}>
      {chunk.bundle.sites.map((s) =>
        s.markerOnly ? null : s.boxWidth && s.boxDepth && s.boxHeight ? (
          <SiteBuilding
            key={`${chunk.cx}|${chunk.cy}|${s.id}`}
            site={s}
            // A capital can place thousands of authored room pieces in one
            // chunk. Keep only walk-up interiors live; the shell swaps back to
            // full detail before the player is close enough to enter.
            renderInterior={renderInteriors && Math.hypot(
              chunkWorldOrigin.x + s.localX - detailCenter.x,
              chunkWorldOrigin.y + s.localZ - detailCenter.z,
            ) <= 18}
          />
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

const VegetationPiece: React.FC<{
  chunk: LoadedChunk;
  origin: SceneOrigin;
  anchor: ChunkCoord;
}> = ({ chunk, origin, anchor }) => {
  const veg = chunk.bundle.vegetation;
  const bushes = chunk.bundle.bushes;
  const bushRef = useRef<THREE.InstancedMesh>(null);
  // Track the last payload key so identical worker-cloned scatters do not
  // rewrite every instance matrix again (W3D-G25). Trees moved to the
  // procedural VegetationTrees layer (vegetation lift 2026-07-04); bushes
  // remain a single instanced sphere layer with palette colors.
  const lastBushCacheKey = useRef<string | null>(null);
  useEffect(() => {
    if (!bushes || !bushRef.current) {
      lastBushCacheKey.current = null;
      return;
    }
    syncVegetationInstanceMatrices(bushRef.current, bushes, lastBushCacheKey, 'bush');
  }, [bushes?.cacheKey]);
  const treeCount = veg ? veg.positions.length / 3 : 0;
  const bushCount = bushes ? bushes.positions.length / 3 : 0;
  // The lighting frustum follows the player, so vegetation beyond the adjacent
  // chunks cannot contribute a useful visible shadow. Keeping those instances
  // out of the shadow pass avoids replaying the whole 81-chunk forest.
  const castsNearbyShadow = SHADOWS
    && Math.max(Math.abs(chunk.cx - anchor.cx), Math.abs(chunk.cy - anchor.cy)) <= 1;
  if (treeCount === 0 && bushCount === 0) return null;
  return (
    <group position={chunkScenePos(chunk.cx, chunk.cy, origin)}>
      {/* Vegetation lift (beautification wave): procedural instanced trees
          replace the old placeholder cones. Same scatter positions, new look. */}
      {treeCount > 0 && veg && <VegetationTrees scatter={veg} castShadow={castsNearbyShadow} />}
      {bushCount > 0 && (
        <instancedMesh ref={bushRef} args={[undefined, undefined, bushCount]} castShadow={castsNearbyShadow}>
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
  detailAnchor: ChunkCoord;
  detailCenter: { x: number; z: number };
  loadedKeys: Set<string>;
}> = ({ chunk, origin, anchor, detailAnchor, detailCenter, loadedKeys }) => (
  <>
    <TerrainPiece chunk={chunk} origin={origin} anchor={anchor} loadedKeys={loadedKeys} />
    <WaterPiece chunk={chunk} origin={origin} />
    <RoadPiece chunk={chunk} origin={origin} />
    <WallPiece chunk={chunk} origin={origin} />
    <GatePiece chunk={chunk} origin={origin} />
    <DeckPiece chunk={chunk} origin={origin} />
    <SitePieces
      chunk={chunk}
      origin={origin}
      detailAnchor={detailAnchor}
      detailCenter={detailCenter}
    />
    <VegetationPiece chunk={chunk} origin={origin} anchor={detailAnchor} />
    {/* Near-camera instanced grass (vegetation lift): only chunks near the
        anchor mount a grass mesh — cheap distance falloff. */}
    <GrassLayer chunk={chunk} anchor={anchor} position={chunkScenePos(chunk.cx, chunk.cy, origin)} />
  </>
);

/** Exp-damp rate for the canopy transition: ~95% converged after ~2 s. */
const CANOPY_DAMP_LAMBDA = 1.5;

/** Value-equality for applied canopy interiors (null = no modulation). */
function sameInterior(a: CanopyInterior | null, b: CanopyInterior | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.lightMul === b.lightMul && a.fogNear === b.fogNear && a.fogFar === b.fogFar;
}

/**
 * Canopy atmosphere damper (forests Task 11): eases the APPLIED lighting
 * modulation toward the window's canopy target over ~2 s so entering/leaving
 * the woods breathes instead of popping (same exponential-fade idiom as
 * InteriorLights' camera fill). The damp lives here in the scene;
 * World3DLighting stays render-pure and just consumes the damped values via
 * its `interior` prop. At rest without canopy it hands over `interior: null`
 * — the exact pre-canopy render path — and non-forest windows START there,
 * so they never leave it (byte-identical behavior).
 */
const CanopyDampedLighting: React.FC<{
  viewProfile: 'continent' | 'ground';
  timeOfDayHours?: number;
  target: CanopyInterior | null;
  shadowReferenceY: number;
}> = ({ viewProfile, timeOfDayHours, target, shadowReferenceY }) => {
  // Applied values start at open-air neutral so a forest entry fades IN.
  const cur = useRef<CanopyInterior>({ ...NEUTRAL_INTERIOR });
  const [applied, setApplied] = React.useState<CanopyInterior | null>(null);
  useFrame((_, delta) => {
    const goal = target ?? NEUTRAL_INTERIOR;
    const c = cur.current;
    const converged =
      Math.abs(c.lightMul - goal.lightMul) < 1e-3 &&
      Math.abs(c.fogNear - goal.fogNear) < 0.5 &&
      Math.abs(c.fogFar - goal.fogFar) < 0.5;
    if (converged) {
      // Snap to the exact goal and rest: null outside canopy (base path), the
      // exact tunable values inside. The equality guard keeps steady-state
      // frames from triggering any re-render.
      c.lightMul = goal.lightMul;
      c.fogNear = goal.fogNear;
      c.fogFar = goal.fogFar;
      const rest = target ? { ...goal } : null;
      setApplied((prev) => (sameInterior(prev, rest) ? prev : rest));
      return;
    }
    c.lightMul = THREE.MathUtils.damp(c.lightMul, goal.lightMul, CANOPY_DAMP_LAMBDA, delta);
    c.fogNear = THREE.MathUtils.damp(c.fogNear, goal.fogNear, CANOPY_DAMP_LAMBDA, delta);
    c.fogFar = THREE.MathUtils.damp(c.fogFar, goal.fogFar, CANOPY_DAMP_LAMBDA, delta);
    setApplied({ ...c });
  });
  return (
    <World3DLighting
      viewProfile={viewProfile}
      timeOfDayHours={timeOfDayHours}
      interior={applied}
      shadowReferenceY={shadowReferenceY}
    />
  );
};

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
  onSelectNpc,
  onGroundPick,
  playerGroundPos = null,
  playerCharacter = null,
  timeOfDayHours,
  combatLayer,
  cameraFrameRequest = null,
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

  // Canopy atmosphere target (forests Task 11): the bridge resolved the
  // window's canopy once; this is the modulation the damper eases toward.
  // Null (no canopy / no ground world) keeps the lighting on its base path.
  const canopyTarget = useMemo(
    () => canopyInterior(groundWorld?.canopy ?? null),
    [groundWorld],
  );

  // Fixed scene origin near the player; the scene is drawn relative to it (coords ~0).
  const sceneOrigin: SceneOrigin = useMemo(() => ({ x: start[0], z: start[2] }), [start]);
  // Anchor chunk for the shared terrain transform (see TerrainPiece). Frozen
  // with the scene origin so rebased coordinates stay small for the session.
  const anchorChunk: ChunkCoord = useMemo(
    () => worldToChunk(sceneOrigin.x, sceneOrigin.z),
    [sceneOrigin],
  );
  // Interior detail follows locomotion instead of staying pinned to spawn.
  // Locale-map moves and click-to-move share this player position, so crossing
  // a chunk boundary swaps the detailed building set naturally.
  const detailAnchor: ChunkCoord = useMemo(
    () => playerGroundPos
      ? worldToChunk(playerGroundPos.xM, playerGroundPos.zM)
      : anchorChunk,
    [anchorChunk, playerGroundPos],
  );
  const detailCenter = useMemo(
    () => playerGroundPos
      ? { x: playerGroundPos.xM, z: playerGroundPos.zM }
      : { x: sceneOrigin.x, z: sceneOrigin.z },
    [playerGroundPos, sceneOrigin],
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

  // Dev hook (sibling to FreeRoamCameraController's __wf3dSetPose): drive the
  // click-to-talk path deterministically from a headless probe — a real 3D
  // mesh-click can't be pixel-simulated and R3F screenshots hang, so this lets
  // verification confirm click → talk → dialogue-opens end to end.
  React.useEffect(() => {
    const w = window as unknown as { __wf3dClickNpc?: (npcId: string) => void };
    w.__wf3dClickNpc = (npcId: string) => onSelectNpc?.(npcId);
    return () => { delete w.__wf3dClickNpc; };
  }, [onSelectNpc]);

  // Dev hook: drive click-to-move from a headless probe (a real ground raycast
  // needs WebGL, which the preview can't init). Takes tile/world meters — the
  // same values the pick plane would produce from a click.
  React.useEffect(() => {
    const w = window as unknown as { __wf3dMoveTo?: (xM: number, zM: number) => void };
    w.__wf3dMoveTo = (xM: number, zM: number) => onGroundPick?.(xM, zM);
    return () => { delete w.__wf3dMoveTo; };
  }, [onGroundPick]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '520px', flex: '1 1 auto', background: '#cdd9e6', borderRadius: '12px', overflow: 'hidden' }}>
      <ForgeAssetContext.Provider value={forgeAssetService}>
      <Canvas
        // Avoid a 4K backing buffer on DPR-2 monitors. Ground mode draws the
        // denser town/interior layers and therefore uses a 0.75 ceiling (still
        // a 1920px backing buffer in a 2560px-wide viewport); the lighter
        // continent view keeps the prior 0.85 ceiling for distant labels.
        dpr={viewProfile === 'ground' ? [0.65, 0.75] : [0.75, 0.85]}
        shadows={SHADOWS && viewProfile === 'ground' ? 'soft' : false}
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
        {/* Sun + sky + hemisphere fill + distance fog + soft follow-frustum
            shadows (ground profile). Time-of-day plumbed, fixed late-morning.
            Wrapped in the canopy damper (forests Task 11): under forest canopy
            the ambient dims and the fog pulls in, eased over ~2 s. */}
        <CanopyDampedLighting
          viewProfile={viewProfile}
          timeOfDayHours={timeOfDayHours}
          target={canopyTarget}
          shadowReferenceY={startSurfaceY}
        />
        {/* Interior lighting (ground profile): warm hearth flame point lights
            near the camera (nearest ≤4), lit-window emissive glow (baked into
            parts), and a camera-inside fill so any interior is readable. */}
        {viewProfile === 'ground' && (
          // One InteriorHour clock source for the hearth lights and live
          // occupants (windows already read it via the provider wrapping the
          // chunk pieces below). Honors the window.__wfAgentClock scrub override.
          <InteriorHourProvider clock={agentClock}>
            <InteriorLights loaded={loaded} origin={sceneOrigin} />
            <InteriorOccupants loaded={loaded} origin={sceneOrigin} />
          </InteriorHourProvider>
        )}
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
          // A fight's own framing request (combat start) takes precedence over
          // the HUD "Town Cell" overhead nonce when both are present.
          frameRequest={cameraFrameRequest ?? townFrameRequest}
        />
        <World3DNameplates
          loaded={loaded}
          sceneOrigin={sceneOrigin}
          playerWorldPos={playerWorldPos}
        />
        {/* One live-hour provider over the whole chunk subtree: SiteBuilding
            reads useInteriorHour() to light windows/hearths from each building's
            baked schedule. Re-renders only on the integer-hour boundary. */}
        <InteriorHourProvider clock={agentClock}>
          {loaded.map((c) => (
            <ChunkPieces
              key={`${c.cx}|${c.cy}`}
              chunk={c}
              origin={sceneOrigin}
              anchor={anchorChunk}
              detailAnchor={detailAnchor}
              detailCenter={detailCenter}
              loadedKeys={loadedKeys}
            />
          ))}
        </InteriorHourProvider>
        <GroundAgents ground={groundWorld} clock={agentClock} sceneOrigin={sceneOrigin} />
        {viewProfile === 'ground' && (
          <GroundProps ground={groundWorld} sceneOrigin={sceneOrigin} />
        )}
        {/* Pillar 2: world-grown dungeon entrances (sealed doors) as readable
            markers the player can walk up to and discover. */}
        {viewProfile === 'ground' && (
          <DungeonEntrances ground={groundWorld} sceneOrigin={sceneOrigin} />
        )}
        {sceneCast && sceneCast.length > 0 && (
          <SceneCast cast={sceneCast} surfaceY={startSurfaceY} onSelectNpc={onSelectNpc} />
        )}
        {/* The player's own body at the logical ground position. Skipped while
            the staged opening cast is up — that already renders a player figure
            at the spawn cluster, and two bodies would double-expose. */}
        {viewProfile === 'ground' && !(sceneCast && sceneCast.some((m) => m.isPlayer)) && (
          <PlayerAvatar
            groundPos={playerGroundPos}
            ground={groundWorld}
            sceneOrigin={sceneOrigin}
            startSurfaceY={startSurfaceY}
            character={playerCharacter}
          />
        )}
        {/* Click-to-move locomotion (ground mode): invisible pick plane over the
            tile. Rendered before the combat layer so a fight's own pick plane
            takes precedence while combat is active. */}
        {viewProfile === 'ground' && (
          <GroundMovePlane ground={groundWorld} sceneOrigin={sceneOrigin} onGroundPick={onGroundPick} />
        )}
        {/* Fight-in-place slice 2: the combat surface (tokens, reachable disc,
            ground-pick plane) drawn on the same streamed terrain. */}
        {combatLayer}
      </Canvas>
      </ForgeAssetContext.Provider>
    </div>
  );
};

export default World3DScene;


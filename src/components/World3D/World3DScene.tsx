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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 31/10/2026, 20:26:15
 * Dependents: components/Combat/InPlaceCombatScene.tsx, components/DesignPreview/steps/PreviewTown3D.tsx, components/World3D/World3DDemo.tsx, components/World3D/World3DWrapper.tsx, components/Worldforge/WorldforgeGroundDrilldown.tsx
 * Imports: 84 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import {CameraHeadingReporter} from './CameraHeadingReporter';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { buildBeamGeometry } from '@/systems/world3d/beamGeometry';
import { bakeInteriorSkyFactors, buildInteriorDaylight, daylightSegments, interiorSkyFactor } from '@/systems/world3d/interiorDaylight';
import { makeInteriorMaterial, quantizeSkyView, type InteriorMaterialLook } from './interiorDaylightMaterial';
import { SHADOW_ONLY_LAYER } from './World3DLighting';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { isWebGpuWorldEnabled } from './webgpuWorldFlag';

/** ADR 0009 step 1: the game world on WebGPURenderer (?gpu=1), read once per page load. */
const WEBGPU_WORLD = isWebGpuWorldEnabled();

/**
 * ONE WEBGPU RENDERER PER CANVAS (2026-10-30). R3F 9's Canvas calls
 * `root.configure` from a layout effect on every render with a measured
 * size, and `configure` awaits an async `gl` factory before it records the
 * renderer. In the game the container's size settles while the WebGPU
 * renderer initializes, so a second `configure` called the factory again: a
 * second WebGPURenderer on the same canvas replaced the first in R3F's state,
 * never got `setSize` (it stayed 300 x 150 with the camera's aspect 0), and
 * the game's WebGPU world drew a black frame. The demo page mounts at a
 * steady size, so it never showed. Every call for one canvas now gets the
 * same renderer promise.
 */
const worldGpuRenderers = new WeakMap<HTMLCanvasElement | OffscreenCanvas, Promise<THREE.WebGLRenderer>>();
// ADR 0009 step 6, slice 7 (2026-10-26): the river's test site in the WebGPU
// world (`?gpu=1&riverSite=1`), and since slice 10 the world's own river
// (`riverSite=world`: the world terrain and river line as the bed).
// It loads only on those addresses; it mounts its
// water pass on the post chain when the chain appears (water/riverWorldSite.ts).
const RIVER_SITE_MODE = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('riverSite') : null;
// Ordinary WebGL walking uses the qualified off-thread land/paving drawing.
// The explicit coarse comparison remains available; WebGPU keeps its existing
// opt-in until its own rendered qualification. Source ground and feet never move.
// Loaded-ring admission and protected river-preview exclusions still apply.
const CANONICAL_GROUND_DETAIL = typeof window !== 'undefined' && (
  new URLSearchParams(window.location.search).get('groundDetail') === 'canonical'
  || (!WEBGPU_WORLD && new URLSearchParams(window.location.search).get('groundDetail') !== 'coarse')
);
/** `?volumeBubble=show`: draw the volume bubble's lid before anything digs it. */
const VOLUME_BUBBLE_SHOW = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('volumeBubble') === 'show';
if (WEBGPU_WORLD && (RIVER_SITE_MODE === '1' || RIVER_SITE_MODE === 'world')) {
  void import('./water/riverWorldSite').then((m) => m.autoMountRiverWorldSite());
}
import World3DLighting from './World3DLighting';
import NightSky from './NightSky';
import VolumetricClouds from './VolumetricClouds';
import { canopyInterior, NEUTRAL_INTERIOR, type CanopyInterior } from './canopyInterior';
import InteriorLights from './InteriorLights';
import { ShelfFrameGeometry, ShelfContents } from './ShelfDisplay';
import { BedGeometry, BED_MATERIAL } from './BedDisplay';
import {AltarGeometry, AltarDressing} from './AltarDisplay';
import InteriorOccupants from './InteriorOccupants';
import {NearbyBuildingDoor,type NearbyBuildingDoorAction} from './NearbyBuildingDoor';
import {FurnishingFocusMarker} from './FurnishingFocusMarker';
import {NearbyFurnishing,type NearbyFurnishingAction,type ResolveFurnishingPlan} from './NearbyFurnishing';
import { createResidentDoorSampler, mergeResidentDoorOpens } from './residentDoorUse';
import { InteriorHourProvider, useInteriorHour, emissiveForPart } from './InteriorHourContext';
import FreeRoamCameraController, { type CameraFrameRequest } from './FreeRoamCameraController';
import {playerCameraFrame} from './playerCameraFrame';
import {createPlayerCameraSightline} from './playerCameraVisibility';
import { syncVegetationInstanceMatrices } from './vegetationInstanceMatrices';
import { VegetationTreeField } from './vegetation/VegetationTreeField';
import { UnderstoryField } from './vegetation/UnderstoryField';
import {
  advanceWaterRipple,
  getWaterSurfaceMaterial,
  RIPPLE_METERS_PER_TILE,
} from './water/waterSurfaceMaterial';
import { GrassLayer } from './vegetation/GrassLayer';
import { useChunkStreaming } from './useChunkStreaming';
import World3DNameplates from './World3DNameplates';
import GroundAgents from './GroundAgents';
import GroundProps from './GroundProps';
import DungeonEntrances from './DungeonEntrances';
import FarShells from './FarShells';
import VolumeGroundBubble from './VolumeGroundBubble';
import { substance } from '@/systems/worldforge/terrain/materials';
import { Material } from '@/systems/worldforge/terrain/voxelVolume';
import SceneCast, { type SceneCastMember } from './SceneCast';
import PlayerAvatar from './PlayerAvatar';
import { ActorPersonalSpaceContext } from './ActorPersonalSpaceContext';
import type { ActorSpace } from './actorPersonalSpace';
import PartyGroundActors from './PartyGroundActors';
import type { PartyCompanionPresence, CompanionPosition } from '@/systems/companions/companionWhereabouts';
import { GroundFurnishingContext } from './GroundFurnishingContext';
import { BuildingDoor } from './BuildingDoor';
import type { AvatarFootfall, FurnishingPick } from './groundFurnishingInteraction';
import GroundMovePlane from './GroundMovePlane';
import { GroundKeyboardDriver } from './useGroundKeyboardControls';
import { groundKeyboardHasInput, type GroundMovementIntent } from './groundLocomotion';
import { createMountedDeckWalkingSurfaces } from './groundBuildingMotion';
import { groundSurfaceY, type GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { GROUND_METERS_PER_CELL } from '@/systems/worldforge/bridge/groundWorldAdapter';
import { footingDetailReady, groundEditDetail, refineTerrainForDetails, type TerrainFootingDetail } from '@/systems/world3d/terrainFootingDetail';
import { groundShapesCutInto, onGroundEdit } from '@/systems/worldforge/bridge/groundRecord';
import { groundShapeBounds, type GroundShape } from '@/systems/worldforge/terrain/groundShapeProfile';
import { cutRoadMeshByGroundShapes } from '@/systems/world3d/groundEditRoadCut';
import { sceneFootingFocus } from './sceneFootingFocus';
import { useFootingMeshes } from './useFootingMeshes';
import { DrawingMesh, type FootingMeshOutput } from '@/systems/world3d/footingMeshJob';
import { refineRoadMeshForFooting, refineRoadMeshesForFooting, type FootingRoadMesh } from '@/systems/world3d/roadGeometry';
import { applyRoofSurfaceUvs, applyWallSurfaceUvs } from './buildingSurfaceUvs';
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
import { EffectComposer, N8AO, ToneMapping, SMAA } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { getGroundDetailTexture, getGroundNormalTexture } from './terrain/groundDetailTexture';
import {
  applyTerrainSurfaceNoise,
  TERRAIN_SURFACE_NOISE_CACHE_KEY,
} from './terrain/terrainSurfaceNoise';
// ADR 0009 step 4: the TSL twins of the terrain noise and the water tint,
// mounted only under ?gpu=1 (the onBeforeCompile hooks are ignored on WebGPU).
import { useTerrainSurfaceNoiseNodeMaterial } from './gpu/terrainSurfaceNoiseNode';
import { getWaterSurfaceNodeMaterial } from './gpu/waterSurfaceNode';
import { publishCanopyField } from './water/canopyHeightField';
import type { TreeBatchInput } from '@/systems/worldforge/vegetation/treeBatching';
import { getRoadSurfaceNodeMaterial, getRoadVergeNodeMaterial } from './gpu/roadSurfaceNode';
import { buildWorldGpuPost, type WorldGpuPostHandle } from './gpu/worldGpuPost';
import { publishWorldGround, publishWorldPlayer } from './water/worldGroundHook';
import type { WebGPURenderer } from 'three/webgpu';
import type { PlayerWorldPosition } from '@/types';
import { useForgeTexture, getSemanticAssetKey } from '@/systems/worldforge/bridge/forgeMaterials';
import type { ForgeAssetService } from '@/systems/worldforge/assets/forgeAssetService';
import { PerfProbe } from '@/devtools/perf';
import { setPerfSceneDiagnostics } from '@/devtools/perf/perfRegistry';
import { ForgeAssetContext } from './ForgeAssetContext';
import { buildExteriorGeometry } from './buildingExteriorGeometry';
import { townSurfaceTexture, houseSurfaceColor } from './townSurfaceTextures';

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
  /** Compass presentation only: camera direction never writes accepted feet. */
  onCameraBearingChange?: (degrees: number | null) => void;
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
  /** Actual mounted prop matrices for guarded source correction; never a pose setter. */
  onPropLayerReady?: (root: THREE.Group, ground: GroundWorld, origin: SceneOrigin, bodies: ReadonlyMap<string, import('./actorPersonalSpace').ActorBody>) => void;
  /** An expedition owns the viewport; retain this exact world while stopping its background frames. */
  suspended?: boolean;
  /** Fractional hour driving agent schedules/motion (live game clock). */
  agentClock?: number;
  /**
   * Bumping this (vs its previous value) pulls the 3D camera up to frame the
   * whole spawn town from above — the HUD "Town Cell" overhead view. Stays in
   * the same scene; no view switch.
   */
  frameTownCellNonce?: number;
  /** Explicit camera return to the rendered body; never a locomotion request. */
  framePlayerNonce?: number;
  onPlayerFrameUnavailable?: () => void;
  /**
   * Staged scene cast — the player + opening-situation strangers, rendered as
   * figures at the spawn so the opening predicament is visible in-world. Empty
   * once the opening is over.
   */
  sceneCast?: SceneCastMember[];
  partyCompanions?: PartyCompanionPresence[];
  partyPaused?: boolean;
  onCompanionPositionChange?: (id: string, position: CompanionPosition, trail: CompanionPosition[]) => void;
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
  onAvatarPositionChange?: (position: AvatarFootfall) => void;
  onAvatarMovementBlocked?: (position: { xM: number; zM: number; yM: number }) => void;
  onSelectFurnishing?: (pick: FurnishingPick) => void;
  onSelectDoor?: (pick: FurnishingPick) => void;
  /** Nearby town entries use the same guarded action as their rendered leaves. */
  onNearbyBuildingDoorChange?: (action: NearbyBuildingDoorAction | null) => void;
  onNearbyFurnishingChange?: (actions: NearbyFurnishingAction[]) => void;
  /** One reached object considered in the list; no movement or selection. */
  focusedFurnishingId?: string | null;
  resolveNearbyFurnishingPlan?: ResolveFurnishingPlan;
  onSelectResident?: (read: import('./groundResidentInteraction').ReadResidentPick) => void;
  openDoors?: ReadonlySet<string>;
  /**
   * Ground mode: requested horizontal route in tile-local meters, with actual
   * saved height for initial placement. The body reports its reached support;
   * neither a camera pan nor a destination can grant arrival on another floor.
   */
  playerGroundPos?: { xM: number; zM: number; yM?: number } | null;
  /** Transient destination receipt; accepted-footfall updates are not requests. */
  groundMoveRequest?: { xM: number; zM: number } | null;
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
  /**
   * Town-on-LAND mode (town3d's Land pane, Remy 2026-08-24): false hides the
   * streamed terrain SKIN — the sheet meshes, their frontier skirts, and the
   * far shells — so the volume bubble is the only visible ground. Chunk
   * heights still stream: buildings, streets, walls, water, and physics all
   * read them. Default true = the normal streamed world.
   */
  terrainSkin?: boolean;
  /** Volume bubble width override, meters (ground profile only). The Land
   * pane asks for a bubble that holds the whole burg. Pair a wide one with
   * `volumeBubbleHeightM`: extent alone still buys a CUBE. */
  volumeBubbleExtentM?: number;
  /** Volume bubble cell override, meters. */
  volumeBubbleCellM?: number;
  /**
   * Volume bubble HEIGHT override, meters (ground profile only). Omitted keeps
   * the cube. A wide bubble that stays a cube pays for hundreds of metres of
   * sky and rock, which is what capped the town pane's footprint at 480 m; the
   * worker treats this as a floor and fits it to the terrain it measures.
   */
  volumeBubbleHeightM?: number;
  /** Draw the water sheets in this flat OPAQUE color (LAND pane debug, Remy
   * 2026-08-24: see exactly where water sits on the volume ground). Absent =
   * the normal shared ripple material. */
  waterFlatColorHex?: string;
  /**
   * Per-layer visibility (LAND pane debug, Remy 2026-08-25): turn scene
   * components on and off one by one — trees, water, buildings — to see what
   * each contributes and what each costs. Absent key = visible. Implemented
   * as `visible` flags on wrapper groups, never as unmounts, so a toggle is
   * instant and no GPU state is rebuilt.
   */
  layers?: World3DLayerVisibility;
}

/** The scene's toggleable layers. Every key defaults to visible. */
export interface World3DLayerVisibility {
  trees?: boolean;
  bushes?: boolean;
  grass?: boolean;
  understory?: boolean;
  water?: boolean;
  buildings?: boolean;
  roads?: boolean;
  walls?: boolean;
  props?: boolean;
  agents?: boolean;
  farShells?: boolean;
}

const SHADOWS = WORLD3D_CONFIG.STREAMED_WORLD_SHADOWS;

/**
 * Ferns, saplings and fallen forest-floor pieces are walking-scale detail.
 * Keep them for the five-by-five chunk window around the player; beyond 256 m
 * their geometry is sub-pixel beneath the tree canopy, while the terrain,
 * trees and fog continue to carry the distant forest silhouette.
 */
const UNDERSTORY_CHUNK_RADIUS = 2;

// ============================================================================
// Opt-in mounted-scene census
// ============================================================================
// Development builds attach a factual inventory of the live scene to the
// performance session. `?perfCensus=1` additionally exposes the full raw rows
// on the document for deep browser investigations. Neither path writes game
// state, and the traversal runs only when the streamed scene composition moves.
// ============================================================================

interface World3DMeshCensusRow {
  path: string;
  type: string;
  geometry: string;
  material: string;
  instances: number;
  triangles: number;
  castShadow: boolean;
}

const World3DPerfCensusProbe: React.FC<{ loadedSignature: string }> = ({ loadedSignature }) => {
  const { scene } = useThree();
  const enabled = import.meta.env.DEV && typeof window !== 'undefined';
  const exposeRawRows = enabled
    && new URLSearchParams(window.location.search).get('perfCensus') === '1';

  useEffect(() => {
    // Lightweight R3F mocks used by structural tests may not provide a scene.
    // The diagnostic is optional, so absence must never affect the world shell.
    if (!enabled || !scene) return;

    // Wait one animation turn so every streamed child has committed its Three
    // object before the inventory walks the scene graph.
    const timeoutId = window.setTimeout(() => {
      const rows: World3DMeshCensusRow[] = [];
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();

      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
        const geometry = mesh.geometry;
        const instanceCount = object instanceof THREE.InstancedMesh ? object.count : 1;
        const baseTriangles = geometry.index
          ? geometry.index.count / 3
          : (geometry.getAttribute('position')?.count ?? 0) / 3;
        const path: string[] = [];
        let cursor: THREE.Object3D | null = object;
        while (cursor) {
          if (cursor.name) path.unshift(cursor.name);
          cursor = cursor.parent;
        }

        geometries.add(geometry);
        const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        meshMaterials.forEach((material) => materials.add(material));
        rows.push({
          path: path.join(' > ') || '(unnamed)',
          type: object.type,
          geometry: geometry.type,
          material: meshMaterials.map((material) => material.type).join('+'),
          instances: instanceCount,
          triangles: Math.round(baseTriangles * instanceCount),
          castShadow: object.castShadow,
        });
      });

      const totals = rows.reduce(
        (sum, row) => ({
          meshes: sum.meshes + 1,
          instances: sum.instances + row.instances,
          triangles: sum.triangles + row.triangles,
          shadowMeshes: sum.shadowMeshes + (row.castShadow ? 1 : 0),
          shadowTriangles: sum.shadowTriangles + (row.castShadow ? row.triangles : 0),
        }),
        { meshes: 0, instances: 0, triangles: 0, shadowMeshes: 0, shadowTriangles: 0 },
      );

      // Group the full inventory by its nearest named render family. Unnamed
      // instanced meshes remain together rather than being omitted; those are
      // usually vegetation and are often the dominant triangle source.
      const byFamily = new Map<string, typeof totals>();
      rows.forEach((row) => {
        const family = row.path.includes('world3d:trees:')
          ? 'trees'
          : row.path.includes('world3d:understory:')
            ? 'understory'
            : row.path.includes('world3d:grass')
              ? 'grass'
              : row.path.includes('groundAgentsCrowd')
                ? 'agents'
              : row.path.includes('ground-props')
          ? 'ground-props'
          : row.path.includes('world3d:site-building') || row.path.includes('world3d:sites')
            ? 'sites'
            : row.path.startsWith('world3d:')
              ? row.path.split(' > ')[0]
              : row.type === 'Mesh' && row.instances > 1
                ? 'unnamed-instanced'
                : 'unnamed-individual';
        const sum = byFamily.get(family)
          ?? { meshes: 0, instances: 0, triangles: 0, shadowMeshes: 0, shadowTriangles: 0 };
        sum.meshes += 1;
        sum.instances += row.instances;
        sum.triangles += row.triangles;
        if (row.castShadow) {
          sum.shadowMeshes += 1;
          sum.shadowTriangles += row.triangles;
        }
        byFamily.set(family, sum);
      });

      const families = [...byFamily.entries()]
        .map(([family, values]) => ({ family, ...values }))
        .sort((a, b) => b.triangles - a.triangles);
      const diagnostics = {
        ...totals,
        geometries: geometries.size,
        materials: materials.size,
        families,
      };
      setPerfSceneDiagnostics('world3d', diagnostics);

      if (exposeRawRows) {
        document.documentElement.dataset.world3dCensus = JSON.stringify({
          loadedSignature,
          totals: diagnostics,
          byFamily: families,
          topTriangleRows: rows.sort((a, b) => b.triangles - a.triangles).slice(0, 40),
        });
      }
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      setPerfSceneDiagnostics('world3d', null);
      delete document.documentElement.dataset.world3dCensus;
    };
  }, [enabled, exposeRawRows, loadedSignature, scene]);

  return null;
};

/**
 * World metres one tile of the ground texture spans.
 *
 * Chosen against the failure it has to avoid: too small and the tiling period is
 * obvious at walking distance (the ceiling the world3d critic set on target #1a),
 * too large and the texture stops reading as material at all. 12 m puts several
 * repeats inside the near field without the eye locking onto the period.
 */
const GROUND_TEXTURE_METERS_PER_TILE = 3;

/**
 * Ground normal-map strength. Low on purpose: the terrain already carries real
 * geometric relief, so this only has to break the flat-paint read at grazing
 * angles. Pushed higher the ground starts to look like crumpled foil, which is
 * the same failure the water ripple guards against.
 */
const GROUND_NORMAL_SCALE = new THREE.Vector2(0.6, 0.6);

/**
 * Module-level so the identity is stable across renders: three keys compiled
 * programs on this string, and a fresh closure every render would keep
 * invalidating the cache entry.
 */
const terrainProgramCacheKey = (): string => TERRAIN_SURFACE_NOISE_CACHE_KEY;

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
  // ADR 0009 step 4: the node twin of the material below, under ?gpu=1 only.
  const gpuMaterial = useTerrainSurfaceNoiseNodeMaterial(WEBGPU_WORLD, {
    map: tex || null,
    flatShading: true,
  });
  if (!visible) return null;
  return (
    <mesh name="world3d:terrain-skirt" geometry={geometry} position={scenePos} receiveShadow={SHADOWS}>
      {/* The skirt carries the same surface noise as the terrain it hangs off:
          without it the wall reads as a different material along the top edge,
          which is the one place a frontier skirt has to be invisible. */}
      {gpuMaterial ? (
        <primitive object={gpuMaterial} attach="material" />
      ) : (
        <meshStandardMaterial
          vertexColors
          flatShading
          map={tex || null}
          // Opaque from both sides, for the same reason as the terrain surface.
          side={THREE.DoubleSide}
          onBeforeCompile={applyTerrainSurfaceNoise}
          customProgramCacheKey={terrainProgramCacheKey}
        />
      )}
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
  /** Fine render patches, applied in order: the player's footing, then each ground edit (GG-533). */
  footingDetails?: readonly TerrainFootingDetail[];
  prepared?: DrawingMesh<FootingMeshOutput>;
}> = ({ chunk, origin, anchor, loadedKeys, footingDetails, prepared }) => {
  const originalTerrain = chunk.bundle.terrain;
  const inlineTerrain = useMemo(() => footingDetails?.length
    ? refineTerrainForDetails(originalTerrain, { x: chunk.cx * WORLD3D_CONFIG.CHUNK_WORLD_SIZE, z: chunk.cy * WORLD3D_CONFIG.CHUNK_WORLD_SIZE }, footingDetails)
    : originalTerrain, [originalTerrain, chunk.cx, chunk.cy, footingDetails]);
  const terrain = prepared?.value.terrain ?? inlineTerrain;
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
  const groundDetail = useMemo(() => getGroundDetailTexture(), []);
  const groundNormal = useMemo(() => getGroundNormalTexture(), []);
  const scenePos = chunkScenePos(anchor.cx, anchor.cy, origin);
  // ADR 0009 step 4: the node twin of the JSX material below, under ?gpu=1 only.
  const gpuMaterial = useTerrainSurfaceNoiseNodeMaterial(WEBGPU_WORLD, {
    map: tex ?? groundDetail,
    normalMap: groundNormal,
    normalScale: GROUND_NORMAL_SCALE,
    roughness: 0.95,
  });

  // The ground texture was wired but structurally inert: `map` was bound while
  // the geometry carried position/normal/color and NO uv, so the sampler read a
  // single texel for the entire world — the texture multiplied everything by one
  // flat colour. Found by the world3d critic, 2026-07-30.
  //
  // UVs come from WORLD x/z, not chunk-local x/z, for the same reason WaterPiece
  // does it (see its note): chunk-local UVs restart the pattern at every chunk
  // boundary and put a visible seam on every edge.
  useMemo(() => {
    const pos = geometry.getAttribute('position');
    if (!pos || pos.count === 0) return;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) + scenePos[0]) / GROUND_TEXTURE_METERS_PER_TILE;
      uv[i * 2 + 1] = (pos.getZ(i) + scenePos[2]) / GROUND_TEXTURE_METERS_PER_TILE;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }, [geometry, scenePos[0], scenePos[2]]);

  return (
    <>
      {/* Smooth-shaded, not flat (Remy's call 2026-07-30: BG3 is the bar, so the
          low-poly faceting goes). chunkGeometry already accumulates and
          normalizes per-VERTEX normals across adjacent faces — `flatShading` was
          throwing those away and re-deriving per-face normals in the shader, which
          is what made every triangle countable. */}
      {/* Ground material detail. `tex` comes from ForgeAssetContext and is
          undefined whenever no asset service is mounted — which is the case in
          the capture rig and in plain ground mode — so the ground rendered as
          one flat colour per biome at every distance. The generated detail and
          normal maps remove that dependency: Aralia is procedural, so its
          ground detail is generated rather than authored.

          The generated map is used only as a FALLBACK, so a real forge ground
          texture still wins when the asset service provides one. The normal map
          applies either way: it is what makes the surface catch the sun at
          grazing angles, which a colour map alone cannot do. */}
      {/* Surface noise in the 2.4-41 m band (terrainSurfaceNoise). The detail
          map above only carries sub-metre grain, so nothing existed between one
          metre and the 8 m per-vertex colour lattice — which is why natural
          material boundaries rendered as straight diagonal lines and why the
          ground measured as a numerically flat plane at walking distance. */}
      <mesh name="world3d:terrain" geometry={geometry} position={scenePos} receiveShadow={SHADOWS}>
        {gpuMaterial ? (
          <primitive object={gpuMaterial} attach="material" />
        ) : (
        <meshStandardMaterial
          vertexColors
          map={tex ?? groundDetail}
          normalMap={groundNormal}
          normalScale={GROUND_NORMAL_SCALE}
          roughness={0.95}
          /* Two-sided, so the ground is opaque from BELOW.
           *
           * Single-sided terrain is the last hollow thing in the streamed
           * world. The frontier walls close its sides and the underside plane
           * closes its bottom, but a camera that dipped under the surface still
           * looked up through the ground at open sky.
           *
           * There is no extra geometry and no lighting hack: three.js flips the
           * normal on a back face, so the underside faces down, the sun above
           * misses it, and it reads as dark rock rather than as grass on a
           * ceiling. */
          side={THREE.DoubleSide}
          onBeforeCompile={applyTerrainSurfaceNoise}
          customProgramCacheKey={terrainProgramCacheKey}
        />
        )}
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

/** Flat OPAQUE water materials for the LAND pane's debug look, one per color.
 * Shared across chunks — a per-chunk material would defeat batching and leak. */
const flatWaterMaterials = new Map<string, THREE.MeshStandardMaterial>();
function flatWaterMaterialFor(colorHex: string): THREE.MeshStandardMaterial {
  let m = flatWaterMaterials.get(colorHex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6, metalness: 0 });
    flatWaterMaterials.set(colorHex, m);
  }
  return m;
}

const WaterPiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin; flatColorHex?: string }> = ({ chunk, origin, flatColorHex }) => {
  const water = chunk.bundle.water;
  // Hooks must run unconditionally: build geometry from water or a tiny empty stand-in.
  const geometry = useDisposableGeometry(
    water ?? { positions: new Float32Array(0), indices: new Uint32Array(0), normals: new Float32Array(0) },
  );
  const scenePos = chunkScenePos(chunk.cx, chunk.cy, origin);

  // The sheets are 2-triangle quads, so the ripple has to come from a normal
  // map, and that needs UVs the geometry never carried. Deriving them from
  // WORLD x/z (chunk offset included) keeps the ripple continuous across chunk
  // seams — chunk-local UVs would restart the pattern at every boundary.
  useMemo(() => {
    const pos = geometry.getAttribute('position');
    if (!pos || pos.count === 0) return;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) + scenePos[0]) / RIPPLE_METERS_PER_TILE;
      uv[i * 2 + 1] = (pos.getZ(i) + scenePos[2]) / RIPPLE_METERS_PER_TILE;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    // Surface flow, m/s on world x/z (waterGeometry's WaterMesh.flow). The
    // WebGPU water moves its ripple and foam along it; still water is (0, 0).
    // A bundle baked before the field existed gets still water.
    const flow = (water as { flow?: Float32Array } | undefined)?.flow;
    geometry.setAttribute(
      'flow',
      new THREE.BufferAttribute(
        flow && flow.length === pos.count * 2 ? flow : new Float32Array(pos.count * 2),
        2,
      ),
    );
  }, [geometry, scenePos[0], scenePos[2]]);

  if (!water) return null;
  return (
    <mesh
      name="world3d:water"
      geometry={geometry}
      position={scenePos}
      // ADR 0009 step 4: the depth-tint node twin under ?gpu=1; the WebGL
      // material's onBeforeCompile is ignored on WebGPU.
      material={
        flatColorHex
          ? flatWaterMaterialFor(flatColorHex)
          : WEBGPU_WORLD
            ? getWaterSurfaceNodeMaterial()
            : getWaterSurfaceMaterial()
      }
    />
  );
};

/**
 * Feeds the water's canopy height field from the trees the world draws
 * (GG-528). Rebuilds when the set of tree chunks or the scene origin changes,
 * on the same payload signature VegetationTreeField keys its batches on.
 * WebGPU world only: the WebGL water does not read the field.
 */
const CanopyFieldPublisher: React.FC<{ inputs: readonly TreeBatchInput[] }> = ({ inputs }) => {
  const signature = inputs.map((i) => `${i.scatter.cacheKey}@${i.offset.join(',')}`).join('|');
  useEffect(() => {
    publishCanopyField(inputs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  return null;
};

/**
 * ADR 0009 step 5: the post chain of the WebGPU world (`?gpu=1`, ground
 * profile). The chain itself lives in gpu/worldGpuPost.ts: scene pass with
 * depth, GTAO, ACES tone mapping, SMAA. This component drives it from R3F:
 * a positive useFrame priority makes R3F skip its own render, and the chain
 * draws the frame instead, as the battle map's GPU scene does.
 *
 * The chain builds asynchronously (its display addons load on demand). Until
 * it exists the renderer draws the scene plain, so the first frames are not
 * black. If the build FAILS the world keeps drawing plain and says so on the
 * console and on `window.__wf3dPostChain`; it does not fake the post look.
 * Mounted only under the flag: the WebGL world does not reach this code.
 */
const WorldGpuPostChain: React.FC = () => {
  const { gl, scene, camera } = useThree();
  const handleRef = React.useRef<WorldGpuPostHandle | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    let built: WorldGpuPostHandle | null = null;
    const w = window as unknown as { __wf3dPostChain?: string; __wf3dPost?: WorldGpuPostHandle | null };
    w.__wf3dPostChain = 'building';
    buildWorldGpuPost(gl as unknown as WebGPURenderer, scene, camera).then((h) => {
      if (cancelled) { h.dispose(); return; }
      built = h;
      handleRef.current = h;
      // Dev hook, like __wf3dScene: a rig reads the chain or swaps its
      // composite (for example AO off) for an A/B measurement.
      w.__wf3dPost = h;
      w.__wf3dPostChain = 'ready';
    }).catch((e: unknown) => {
      w.__wf3dPostChain = 'failed';
      // eslint-disable-next-line no-console
      console.error('[world3d-webgpu] post chain failed to build; the world draws with no post:', e);
    });
    return () => {
      cancelled = true;
      handleRef.current = null;
      built?.dispose();
      w.__wf3dPost = null;
      delete w.__wf3dPostChain;
    };
  }, [gl, scene, camera]);
  const size = useThree((s) => s.size);
  useFrame(() => {
    // R3F sets the camera's aspect only when the SIZE changes. In the game the
    // async WebGPU start can leave the default camera made after the size was
    // set, with aspect 0: a degenerate projection and a black frame
    // (2026-10-30). Match it to the drawn size before every frame.
    const cam = camera as THREE.PerspectiveCamera;
    if (cam.isPerspectiveCamera && size.height > 0) {
      const aspect = size.width / size.height;
      if (cam.aspect !== aspect) { cam.aspect = aspect; cam.updateProjectionMatrix(); }
    }
    const h = handleRef.current;
    if (h) h.render();
    else gl.render(scene, camera);
  }, 1);
  return null;
};

/**
 * Scrolls the shared water ripple. One driver for the whole world: the material
 * and its texture are shared, so advancing it per chunk would multiply the
 * speed by the number of loaded chunks. WebGL water only: the WebGPU node water
 * moves its own ripple along each river's flow (gpu/waterSurfaceNode.ts).
 */
const WaterRippleDriver: React.FC = () => {
  useFrame(({ clock }) => advanceWaterRipple(clock.getElapsedTime()));
  return null;
};

const RoadPiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin; footingDetails?: readonly TerrainFootingDetail[]; cutShapes?: readonly GroundShape[]; prepared?: DrawingMesh<FootingMeshOutput> }> = ({ chunk, origin, footingDetails, cutShapes, prepared }) => {
  // Paving follows the same admitted render patch as the land beneath it.
  // The source road manifest and the player's physical support stay unchanged.
  const originalRoads = chunk.bundle.roads;
  // Each footing patch refines every bounded part the previous one produced.
  // A ground edit does not drape the paving: it removes the paving it cut
  // through (groundEditRoadCut.ts, GG-533), as a hole dug in a square does.
  const inlineRoads = useMemo(() => {
    if (!originalRoads) return [];
    const at = { x: chunk.cx * WORLD3D_CONFIG.CHUNK_WORLD_SIZE, z: chunk.cy * WORLD3D_CONFIG.CHUNK_WORLD_SIZE };
    let parts: FootingRoadMesh[] = [originalRoads];
    for (const d of footingDetails ?? []) parts = parts.flatMap((part) => refineRoadMeshesForFooting(part, at, d));
    if (cutShapes?.length) parts = parts.map((part) => cutRoadMeshByGroundShapes(part, at, cutShapes));
    return parts;
  }, [originalRoads, chunk.cx, chunk.cy, footingDetails, cutShapes]);
  const roads = prepared?.value.roads ?? inlineRoads;
  const resources = useMemo(() => roads.map(part => new DrawingMesh(part)), [roads]);
  // Each bounded draw mesh owns and disposes its geometry. Partitioning keeps
  // a dense square playable without dropping faces or raising a mesh's cap.
  return <>{resources.map((resource, index) => <RoadSurfacePiece key={index} resource={resource} chunk={chunk} origin={origin} />)}</>;
};

const RoadSurfacePiece: React.FC<{ resource: DrawingMesh<FootingRoadMesh>; chunk: LoadedChunk; origin: SceneOrigin }> = ({ resource, chunk, origin }) => {
  const roads = resource.value;
  const geometry = useDisposableGeometry(roads);
  // Road space per vertex (buildRoadMesh's `road`: along, across, half width,
  // surface kind) for the WebGPU road material. A bundle baked before the
  // field existed gets kind 0, which draws as packed earth.
  useMemo(() => {
    const pos = geometry.getAttribute('position');
    if (!pos || pos.count === 0) return;
    const road = (roads as { road?: Float32Array } | undefined)?.road;
    geometry.setAttribute(
      'road',
      new THREE.BufferAttribute(road && road.length === pos.count * 4 ? road : new Float32Array(pos.count * 4), 4),
    );
  }, [geometry, roads]);
  // WebGPU: each surface kind draws as the thing it is (gpu/roadSurfaceNode.ts:
  // flagstones, setts, cobbles, curbs, rutted earth, worn trails). WebGL keeps
  // the per-vertex street tiers under one white-base vertex-colored material.
  return (
    <mesh
      name="world3d:roads"
      geometry={geometry}
      position={chunkScenePos(chunk.cx, chunk.cy, origin)}
      receiveShadow={SHADOWS}
      {...(WEBGPU_WORLD ? { material: getRoadSurfaceNodeMaterial() } : {})}
    >
      {!WEBGPU_WORLD && <meshStandardMaterial vertexColors color="#ffffff" roughness={0.95} />}
    </mesh>
  );
};

/**
 * Road verges (roads step 3, 2026-10-28): the strip each side of a road that
 * fades into the ground (roadGeometry.buildRoadVergeMesh). WebGPU only; the
 * WebGL world keeps its plain ribbons.
 */
const RoadVergePiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin; footingDetails?: readonly TerrainFootingDetail[]; cutShapes?: readonly GroundShape[]; prepared?: DrawingMesh<FootingMeshOutput> }> = ({ chunk, origin, footingDetails, cutShapes, prepared }) => {
  const originalVerges = chunk.bundle.roadVerges;
  const inlineVerges = useMemo(() => {
    if (!originalVerges || !WEBGPU_WORLD || (!footingDetails?.length && !cutShapes?.length)) return originalVerges;
    const at = { x: chunk.cx * WORLD3D_CONFIG.CHUNK_WORLD_SIZE, z: chunk.cy * WORLD3D_CONFIG.CHUNK_WORLD_SIZE };
    let out = originalVerges;
    for (const d of footingDetails ?? []) out = refineRoadMeshForFooting(out, at, d);
    return cutShapes?.length ? cutRoadMeshByGroundShapes(out, at, cutShapes) : out;
  }, [originalVerges, chunk.cx, chunk.cy, footingDetails, cutShapes]);
  const verges = prepared?.value.roadVerges ?? inlineVerges;
  const geometry = useDisposableGeometry(
    verges ?? { positions: new Float32Array(0), indices: new Uint32Array(0), normals: new Float32Array(0) },
  );
  useMemo(() => {
    const pos = geometry.getAttribute('position');
    if (!pos || pos.count === 0) return;
    const road = (verges as { road?: Float32Array } | undefined)?.road;
    if (road && road.length === pos.count * 4) geometry.setAttribute('road', new THREE.BufferAttribute(road, 4));
  }, [geometry, verges]);
  if (!verges || !WEBGPU_WORLD) return null;
  return (
    <mesh
      name="world3d:road-verges"
      geometry={geometry}
      position={chunkScenePos(chunk.cx, chunk.cy, origin)}
      receiveShadow={SHADOWS}
      material={getRoadVergeNodeMaterial()}
    />
  );
};

/** Walking up to a house keeps the same material scale as its distant batch. */
const HousePartGeometry: React.FC<{ w: number; h: number; d: number; x: number; y: number; z: number }> = ({ w, h, d, x, y, z }) => {
  const geometry = useMemo(() => applyWallSurfaceUvs(new THREE.BoxGeometry(w, h, d), { x, y, z }), [w, h, d, x, y, z]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
};

/** A coopered silhouette stays inside the canonical furnishing envelope. The
 * bridge still owns size, placement, goods and interaction identity. */
const BarrelGeometry: React.FC<{ radius: number; height: number }> = ({ radius, height }) => {
  const geometry = useMemo(() => new THREE.LatheGeometry([
    new THREE.Vector2(0, -height / 2),
    new THREE.Vector2(radius * 0.78, -height / 2),
    new THREE.Vector2(radius * 0.87, -height * 0.4),
    new THREE.Vector2(radius * 0.92, -height * 0.15),
    new THREE.Vector2(radius * 0.92, height * 0.15),
    new THREE.Vector2(radius * 0.87, height * 0.4),
    new THREE.Vector2(radius * 0.78, height / 2),
    new THREE.Vector2(0, height / 2),
  ], 12), [radius, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
};

const WallPiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => {
  const walls = chunk.bundle.walls;
  const geometry = useDisposableGeometry(
    walls ?? { positions: new Float32Array(0), indices: new Uint32Array(0), normals: new Float32Array(0) },
  );
  // Meter-scaled masonry continues across chunk boundaries and the capped top.
  const stoneGeometry = useMemo(() => applyWallSurfaceUvs(geometry, {
    x: chunk.cx * WORLD3D_CONFIG.CHUNK_WORLD_SIZE, y: 0,
    z: chunk.cy * WORLD3D_CONFIG.CHUNK_WORLD_SIZE,
  }), [geometry, chunk.cx, chunk.cy]);
  const stone = townSurfaceTexture('stone');
  if (!walls) return null;
  // Styled-architecture slice: each town's ramparts carry their style family's
  // wall tint as per-vertex colors (buildWallMesh); the white base avoids
  // re-tinting them. Runs without a tint bake the legacy #9a9387 stone.
  return (
    <mesh name="world3d:walls" geometry={stoneGeometry} position={chunkScenePos(chunk.cx, chunk.cy, origin)} castShadow={SHADOWS} receiveShadow={SHADOWS}>
      <meshStandardMaterial vertexColors color="#ffffff" map={stone} bumpMap={stone} bumpScale={0.08} roughness={0.95} />
    </mesh>
  );
};

const GatePiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => {
  const gates = chunk.bundle.gates;
  const geometry = useDisposableGeometry(
    gates ?? { positions: new Float32Array(0), indices: new Uint32Array(0), normals: new Float32Array(0) },
  );
  // The rampart's own masonry, meter-scaled from the same world offset as the
  // wall runs, so a gate tower reads as the same stone (agora-257c, 2026-10-28:
  // without the map and with up-facing normals the gates drew near white).
  const stoneGeometry = useMemo(() => applyWallSurfaceUvs(geometry, {
    x: chunk.cx * WORLD3D_CONFIG.CHUNK_WORLD_SIZE, y: 0,
    z: chunk.cy * WORLD3D_CONFIG.CHUNK_WORLD_SIZE,
  }), [geometry, chunk.cx, chunk.cy]);
  const stone = townSurfaceTexture('stone');
  if (!gates) return null;
  // Gatehouse towers/lintels at town road gates and water gates (buildGateMesh),
  // vertex-tinted with the burg's wall color so they read as part of the same
  // rampart. Each face is wound once, outward: front faces only.
  return (
    <mesh name="world3d:gates" geometry={stoneGeometry} position={chunkScenePos(chunk.cx, chunk.cy, origin)} castShadow={SHADOWS} receiveShadow={SHADOWS}>
      <meshStandardMaterial vertexColors color="#ffffff" map={stone} bumpMap={stone} bumpScale={0.08} roughness={0.95} />
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
    <mesh name="world3d:decks" geometry={geometry} position={chunkScenePos(chunk.cx, chunk.cy, origin)} castShadow={SHADOWS} receiveShadow={SHADOWS}>
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
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(Array.from({ length: a.positions.length / 3 }, (_, i) => [a.positions[i * 3] / 4, a.positions[i * 3 + 2] / 4]).flat()), 2));
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
 * Smaller floor for wall-mounted construction dressing (courses, shutters,
 * foundations, facade trim). On a building face inside its own shadow the
 * derived contrast tones (bridge dressingContrastTone) compress back into the
 * shaded wall and vanish (proof: after-single-se.png before this floor — 81
 * courses in the payload, zero readable). Applies ONLY to parts tagged with
 * the bridge's MATERIAL_PART_TAG / FACADE_PART_TAG contract strings; walls,
 * furnishings, and light-role parts keep their exact previous response.
 */
const DRESSING_EMISSIVE_FLOOR = 0.22;

/**
 * LIVE INTERIORS DRAW BY LOOK (agora-257c, 2026-10-28). A live interior drew
 * every wall piece, floor, window and furnishing as its own mesh with its own
 * <meshStandardMaterial>: on 12,6 the buildings within 18 m of the player
 * carried about 2,350 part meshes, and they took 19 of a 31 ms frame (one
 * building alone about 16 ms; frame-time A/B, aerial pose). The cost was the
 * draw count, not the materials: sharing materials alone changed nothing.
 * Structure parts are now merged per building into one mesh per look (about
 * 20 looks a building), and every look shares one cached material. Doors and
 * furnishings keep their own meshes: they carry picking and their own shapes.
 * The material cache is never disposed; it holds one entry per distinct look
 * (a few dozen per town), and an hourly glow change adds new keys.
 */
const partMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
function sharedPartMaterial(
  color: THREE.ColorRepresentation,
  map: THREE.Texture | null,
  emissive: string,
  emissiveIntensity: number,
): THREE.MeshStandardMaterial {
  const key = `${new THREE.Color(color).getHexString()}|${map?.uuid ?? '-'}|${emissive}|${emissiveIntensity}`;
  let material = partMaterialCache.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, map, emissive, emissiveIntensity });
    partMaterialCache.set(key, material);
  }
  return material;
}

/**
 * INTERIOR DAYLIGHT (2026-11-02, Remy: "windows should allow light through").
 * Live interiors take their sky light through the windows only: each look's
 * material multiplies the indirect light by a sky factor (see
 * systems/world3d/interiorDaylight.ts and interiorDaylightMaterial.ts). The
 * cache works like partMaterialCache; the key adds the factor source and the
 * glass flag. Never disposed: a few dozen looks per town, plus up to 65 factor
 * steps for furnishings.
 */
const interiorMaterialCache = new Map<string, THREE.Material>();
function sharedInteriorMaterial(look: InteriorMaterialLook): THREE.Material {
  const key = `${new THREE.Color(look.color).getHexString()}|${look.map?.uuid ?? '-'}|${look.emissive}|${look.emissiveIntensity}|${look.skyView}|${look.glass ? 'g' : '-'}`;
  let material = interiorMaterialCache.get(key);
  if (!material) {
    material = makeInteriorMaterial(look, WEBGPU_WORLD);
    interiorMaterialCache.set(key, material);
  }
  return material;
}

/** The iron bands of a barrel, one material for every barrel. */
const BARREL_BAND_MATERIAL = new THREE.MeshStandardMaterial({ color: '#352f28', metalness: 0.5, roughness: 0.7 });
/** Bridge contract strings (interiorParts MATERIAL_PART_TAG / FACADE_PART_TAG).
 * Compared as literals so the scene bundle does not import the generator chain
 * (see vite-chunk-eager-3d-leak); the bridge tests pin the exported values. */
const DRESSING_TAGS = new Set(['building-material', 'facade']);

/**
 * One footprint-true building (Worldforge town plan): rotated walls/parts +
 * hip roof + door/windows. The roof AUTO-HIDES when the camera moves inside
 * the building so the player can look around an interior without the
 * clip-through-the-wall hack — converting the camera into the group's local
 * frame each frame makes the inside-test rotation-correct.
 */
// Body-position updates do not change most buildings. Reuse their render
// tree until the source site or interior admission changes; clock, door and
// resident context updates still reach every existing consumer.
const SiteBuilding: React.FC<{
  site: LoadedChunk['bundle']['sites'][number];
  /** Full room geometry is mounted only where the player can enter it. */
  renderInterior: boolean;
}> = React.memo(({ site: s, renderInterior }) => {
  const furnishingContext = React.useContext(GroundFurnishingContext);
  const [hoveredFurnishing, setHoveredFurnishing] = React.useState<number | null>(null);
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
  const wallKey = getSemanticAssetKey({ surface: 'wall', role, wallMaterial: s.parts?.find(p => p.wallMaterial)?.wallMaterial });
  const roofKey = getSemanticAssetKey({ surface: 'roof', role, roofCovering: s.solvedRoof?.roofCovering });
  const generatedWallTex = useForgeTexture(wallKey, service);
  const generatedRoofTex = useForgeTexture(roofKey, service);
  const wallTex = generatedWallTex ?? townSurfaceTexture('wall', wallKey);
  const roofTex = generatedRoofTex ?? townSurfaceTexture('roof', roofKey);
  // Exterior-only batches retain type-specific silhouettes and actual window
  // openings. Interior furniture still obeys the original walk-up budget.
  const exterior = useMemo(() => buildExteriorGeometry(s, wallKey), [s, wallKey]);
  useEffect(() => () => Object.values(exterior).forEach(g => g.dispose()), [exterior]);
  const hasExterior = exterior.walls.getAttribute('position').count > 0;
  const hasLiveInterior = renderInterior && !!s.parts;
  // Shadow maps are camera-local too: distant shells keep their color and
  // silhouette, while nearby buildings retain the grounding/readability pass.
  const castsLocalShadow = SHADOWS && renderInterior;

  // Structure parts merged by look (see LIVE INTERIORS DRAW BY LOOK). The
  // look depends on the hour (lit windows), so the merge keys on the whole
  // hour, as emissiveForPart does; it rebuilds at most once an hour.
  const wholeHour = Math.floor(hour);
  // Interior daylight (see INTERIOR DAYLIGHT): the window openings, floor
  // footprint, wall occluders and interreflection of this building. Null when
  // it has no floor or no window; those buildings keep the old materials.
  const daylight = useMemo(
    () => (hasLiveInterior && s.parts ? buildInteriorDaylight(s.parts, s.doorZSign ?? -1) : null),
    [hasLiveInterior, s],
  );
  const skyBakeCache = useRef<{ day: object | null; byLook: Map<string, Float32Array> }>({ day: null, byLook: new Map() });
  const mergedStructure = useMemo(() => {
    if (!hasLiveInterior || !s.parts) return [];
    const looks = new Map<string, {
      color: THREE.ColorRepresentation; mapped: boolean; emissive: string; emissiveIntensity: number; glass: boolean; pieces: THREE.BufferGeometry[];
    }>();
    for (const p of s.parts.filter(isSitePartRenderable)) {
      if (p.door || p.furnishing) continue;
      const off = sitePartLocalOffset(p, s.doorZSign ?? -1);
      const em = emissiveForPart(p.lightRole, wholeHour, s.litHours, s.hearthHours);
      const isDressing = em.emissiveIntensity === 0 && p.tag !== undefined && DRESSING_TAGS.has(p.tag);
      const mapped = p.tag === 'exterior' && p.lightRole !== 'window';
      const color = mapped ? houseSurfaceColor('wall', wallKey, p.colorHex) : p.colorHex;
      const emissive = isDressing ? p.colorHex : em.emissive;
      const emissiveIntensity = isDressing ? DRESSING_EMISSIVE_FLOOR : em.emissiveIntensity;
      // Glass is its own look: it casts no sun shadow and is see-through.
      const glass = !!daylight && p.lightRole === 'window';
      const key = `${new THREE.Color(color).getHexString()}|${mapped}|${emissive}|${emissiveIntensity}|${glass ? 'g' : '-'}`;
      // Boxes retain HousePartGeometry's UVs; directional timbers use their
      // actual sloped shape, then share the same site-local placement. With
      // interior daylight, large faces are split into DAYLIGHT_GRID_M cells
      // so the baked sky factor can fall off across a floor or wall.
      const piece = p.beam ? buildBeamGeometry(p.beam, -(s.doorZSign ?? -1))
        : applyWallSurfaceUvs(daylight && !glass
          ? new THREE.BoxGeometry(p.w, p.h, p.d, daylightSegments(p.w), daylightSegments(p.h), daylightSegments(p.d))
          : new THREE.BoxGeometry(p.w, p.h, p.d), off);
      piece.translate(off.x, off.y, off.z);
      const look = looks.get(key) ?? { color, mapped, emissive, emissiveIntensity, glass, pieces: [] };
      look.pieces.push(piece);
      looks.set(key, look);
    }
    return [...looks.entries()].map(([key, look]) => {
      const geometry = mergeGeometries(look.pieces, false) ?? new THREE.BufferGeometry();
      for (const piece of look.pieces) piece.dispose();
      if (daylight && geometry.getAttribute('position')) {
        // Glass shows the sky itself (factor 1); every other face takes the
        // factor of its own vertex position and normal.
        // The merge reruns each game hour (window glow changes the looks),
        // but the geometry of a look does not: reuse its bake.
        const n = geometry.getAttribute('position').count;
        const cache = skyBakeCache.current;
        if (cache.day !== daylight) { cache.day = daylight; cache.byLook.clear(); }
        let sky = cache.byLook.get(key);
        if (!sky || sky.length !== n) {
          sky = look.glass
            ? new Float32Array(n).fill(1)
            : bakeInteriorSkyFactors(daylight, geometry.getAttribute('position').array, geometry.getAttribute('normal').array);
          cache.byLook.set(key, sky);
        }
        geometry.setAttribute('skyView', new THREE.BufferAttribute(sky, 1));
      }
      return { key, geometry, color: look.color, mapped: look.mapped, emissive: look.emissive, emissiveIntensity: look.emissiveIntensity, glass: look.glass };
    });
  }, [hasLiveInterior, s, wallKey, wholeHour, daylight]);
  // One sky factor per furnishing, at the center of its top face (1/64 steps
  // so furnishings share materials). Recomputed only with the building.
  const furnishingSky = useMemo(() => {
    const out = new Map<number, number>();
    if (!daylight || !s.parts) return out;
    s.parts.forEach((p, i) => {
      if (!p.furnishing || !isSitePartRenderable(p)) return;
      const off = sitePartLocalOffset(p, s.doorZSign ?? -1);
      out.set(i, quantizeSkyView(interiorSkyFactor(daylight, { x: off.x, y: off.y + p.h / 2, z: off.z }, { x: 0, y: 1, z: 0 })));
    });
    return out;
  }, [daylight, s]);
  useEffect(() => () => mergedStructure.forEach((m) => m.geometry.dispose()), [mergedStructure]);

  // A roof can be hidden only while its enterable interior is live. Restore it
  // immediately when player-proximity LOD turns that building back into a
  // shell; otherwise a roof hidden during an earlier visit could stay absent.
  React.useEffect(() => {
    if (!hasLiveInterior && roofRef.current) {
      roofRef.current.visible = true;
      roofRef.current.layers?.set(0);
    }
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
    // INTERIOR DAYLIGHT: a hidden roof still shades the rooms. Before, it
    // went invisible, which also took it out of the shadow map, so the sun
    // lit the whole interior through the missing roof. On SHADOW_ONLY_LAYER
    // the camera and raycasts skip it, but the sun's shadow cameras keep it.
    roof.layers?.set(inside ? SHADOW_ONLY_LAYER : 0);
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
    const positions = s.solvedRoof.positions;
    const uv = new Float32Array(positions.length / 3 * 2);
    for (let i = 0; i < positions.length / 3; i++) {
      uv[i * 2] = positions[i * 3] / 4;
      uv[i * 2 + 1] = positions[i * 3 + 2] / 4;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(s.solvedRoof.indices, 1));
    return applyRoofSurfaceUvs(g);
  }, [s.solvedRoof]);
  React.useEffect(() => () => { solvedRoofGeom?.dispose(); }, [solvedRoofGeom]);
  const hasSolvedRoof = !!solvedRoofGeom;

  return (
    <group name="world3d:site-building" ref={groupRef} position={[s.localX, s.surfaceY, s.localZ]} rotation={[0, s.rotationY ?? 0, 0]}>
      {hasLiveInterior ? (
        // Seamless interior (Worldforge L4): perimeter + room walls with real
        // door gaps, plus furnishing blocks. Parts use +z = inward-from-street;
        // doorZSign maps that onto whichever face the street actually is.
        <>
        {mergedStructure.map((m) => (
          <mesh
            key={`look-${m.key}`}
            geometry={m.geometry}
            // INTERIOR DAYLIGHT: walls, floors and ceilings now cast the sun's
            // shadow, so sunlight enters only through the window and door
            // openings. Glass casts none (it passes the sun). These are the
            // ~20 merged looks of the few walk-up buildings, not every part.
            castShadow={!!daylight && castsLocalShadow && !m.glass}
            receiveShadow={castsLocalShadow}
          >
            <primitive
              object={daylight
                ? sharedInteriorMaterial({
                  color: m.color, map: m.mapped ? (wallTex || null) : null, emissive: m.emissive,
                  emissiveIntensity: m.emissiveIntensity, skyView: 'attribute', glass: m.glass,
                })
                : sharedPartMaterial(m.color, m.mapped ? (wallTex || null) : null, m.emissive, m.emissiveIntensity)}
              attach="material"
              dispose={null}
            />
          </mesh>
        ))}
        {s.parts!
          .map((p, i) => {
          // Hover reads the canonical parts array. Keep its original index while
          // hiding tactical-only party walls, or a table can name another item.
          if (!isSitePartRenderable(p)) return null;
          if (p.door) return <BuildingDoor key={`door-${p.door.id}`} part={p} siteId={s.id} rotationY={s.rotationY ?? 0} doorZSign={s.doorZSign ?? -1} />;
          // Structure draws merged by look (mergedStructure, below); only
          // furnishings mount one mesh each. The index i stays as it was.
          if (!p.furnishing) return null;
          const off = sitePartLocalOffset(p, s.doorZSign ?? -1);
          // Window/hearth parts carry a `lightRole` and NO baked emissive; the
          // renderer decides their glow live from the hourly schedule. Tagged
          // construction dressing gets the small self-color floor (see
          // DRESSING_EMISSIVE_FLOOR) so contrast tones survive building
          // self-shadow; every other part stays dark exactly as before.
          const em = emissiveForPart(p.lightRole, hour, s.litHours, s.hearthHours);
          const isDressing = em.emissiveIntensity === 0 && p.tag !== undefined && DRESSING_TAGS.has(p.tag);
          return (
          <mesh
            key={`part-${i}`}
            onPointerDown={p.furnishing && furnishingContext?.onSelect ? (event: ThreeEvent<PointerEvent>) => {
              // Right-drag belongs to the camera, even when it starts on a bed.
              if (event.button !== 0) return;
              event.stopPropagation();
              const group = groupRef.current;
              if (!group) return;
              const m = group.matrixWorld.elements;
              furnishingContext.onSelect!({ siteId: s.id, part: p, transform: {
                groupX: m[12] + furnishingContext.origin.x,
                groupZ: m[14] + furnishingContext.origin.z,
                surfaceY: m[13], rotationY: s.rotationY ?? 0, doorZSign: s.doorZSign ?? -1,
              } });
            } : undefined}
            onPointerOver={p.furnishing && furnishingContext?.onSelect ? (event: ThreeEvent<PointerEvent>) => {
              // Hover names the same nearest usable object as the click. A
              // farther barrel must not replace the table under the pointer.
              event.stopPropagation();
              document.body.style.cursor = 'pointer'; setHoveredFurnishing(i);
            } : undefined}
            onPointerOut={p.furnishing && furnishingContext?.onSelect ? () => { document.body.style.cursor = 'auto'; setHoveredFurnishing(null); } : undefined}
            position={[off.x, off.y, off.z]}
            // Asymmetric furniture detail shares the canonical reflection of its center.
            scale={p.furnishing && ['shelf', 'bed'].includes(p.furnishing.kind) ? [1, 1, -(s.doorZSign ?? -1)] : undefined}
            // Roofs and shells provide the readable exterior shadow. Casting
            // every chair, wall segment, and window into the same map adds a
            // second full scene pass for little visual value.
            castShadow={false}
            receiveShadow={castsLocalShadow}
          >
            {p.furnishing?.kind === 'barrel'
              ? <BarrelGeometry radius={Math.min(p.w, p.d) / 2} height={p.h} />
              : p.furnishing?.kind === 'shelf' ? <ShelfFrameGeometry part={p} />
              : p.furnishing?.kind === 'altar' ? <AltarGeometry part={p} />
              : p.furnishing?.kind === 'bed' ? <BedGeometry part={p} />
              : <HousePartGeometry w={p.w} h={p.h} d={p.d} x={off.x} y={off.y} z={off.z} />}
            {/* Apply wall texture only to tall perimeter/interior walls (h >= 2.0) */}
            {/* Shared by look (see SHARED PART MATERIALS); dispose={null}
                keeps an unmounting part from freeing a material others use. */}
            <primitive
              object={p.furnishing?.kind === 'bed' ? BED_MATERIAL : furnishingSky.has(i)
                // INTERIOR DAYLIGHT: one sky factor for the whole piece.
                ? sharedInteriorMaterial({
                  color: p.colorHex, map: null,
                  emissive: isDressing ? p.colorHex : em.emissive,
                  emissiveIntensity: isDressing ? DRESSING_EMISSIVE_FLOOR : em.emissiveIntensity,
                  skyView: furnishingSky.get(i)!,
                })
                : sharedPartMaterial(
                p.tag === 'exterior' && p.lightRole !== 'window' ? houseSurfaceColor('wall', wallKey, p.colorHex) : p.colorHex,
                p.tag === 'exterior' && p.lightRole !== 'window' ? (wallTex || null) : null,
                isDressing ? p.colorHex : em.emissive,
                isDressing ? DRESSING_EMISSIVE_FLOOR : em.emissiveIntensity,
              )}
              attach="material"
              dispose={null}
            />
            {p.furnishing?.kind === 'shelf' && <ShelfContents part={p} />}
            {p.furnishing?.kind === 'altar' && <AltarDressing part={p} />}
            {p.furnishing?.kind === 'barrel' && [-0.35, 0, 0.35].map(band => <mesh key={band} position={[0, p.h * band, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[Math.min(p.w, p.d) * 0.46, Math.min(p.w, p.d) * 0.0225, 4, 12]} />
              <primitive object={BARREL_BAND_MATERIAL} attach="material" dispose={null} />
            </mesh>)}
          </mesh>
          );
          })}
        </>
      ) : hasExterior ? (
        <>
          <mesh geometry={exterior.walls} castShadow={SHADOWS} receiveShadow={SHADOWS}>
            <meshStandardMaterial vertexColors map={wallTex} roughness={0.92} />
          </mesh>
          <mesh geometry={exterior.detail} receiveShadow={SHADOWS}>
            <meshStandardMaterial vertexColors roughness={0.88} />
          </mesh>
          <mesh geometry={exterior.glass}>
            <meshStandardMaterial vertexColors roughness={0.3} metalness={0.12} emissive="#e8ae64" emissiveIntensity={emissiveForPart('window', hour, s.litHours, s.hearthHours).emissiveIntensity} />
          </mesh>
        </>
      ) : (
        // Performance LOD: distant interior-bearing buildings retain their
        // footprint-true shell. Their authored parts remain in the payload and
        // mount intact as soon as the player enters this chunk.
        <mesh position={[0, (s.boxHeight ?? 0) * 0.5, 0]} castShadow={castsLocalShadow} receiveShadow={castsLocalShadow}>
          <boxGeometry args={[s.boxWidth, s.boxHeight, s.boxDepth]} />
          <meshStandardMaterial color={s.colorHex ?? '#b09a72'} map={wallTex || null} />
        </mesh>
      )}
      {/* The list and the world identify the same original source piece.
          Depth testing keeps the outline behind walls and other opaque objects. */}
      {hasLiveInterior && <FurnishingFocusMarker siteId={s.id} parts={s.parts}
        doorZSign={s.doorZSign ?? -1} focusedId={furnishingContext?.focusedFurnishingId} />}
      {hasLiveInterior && hoveredFurnishing !== null && s.parts?.[hoveredFurnishing]?.furnishing && (() => {
        const part = s.parts[hoveredFurnishing];
        const at = sitePartLocalOffset(part, s.doorZSign ?? -1);
        return <Html center position={[at.x, at.y + part.h / 2 + 0.2, at.z]} distanceFactor={8}>
          <div className="pointer-events-none whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-xs text-amber-100">Examine {part.furnishing!.kind.replace(/[-_]/g, ' ')}</div>
        </Html>;
      })()}
      {/* Solved roof (BGv2 Task 5): the plan's actual roof (irregular planes,
          valleys, tower caps) baked to one geometry. Its Y already sits on the
          wall top (positions carry wallTopFt), so no boxHeight offset. The
          group's z scale applies the same doorZSign flip the box parts use.
          Auto-hides on camera-enter via roofRef, exactly like the prism. */}
      {hasSolvedRoof ? (
        <group scale={[1, 1, -(s.doorZSign ?? -1)]}>
          <mesh ref={roofRef} geometry={solvedRoofGeom!} castShadow={SHADOWS} receiveShadow={SHADOWS}>
            {/* Covering-color floor: see ROOF_EMISSIVE_FLOOR — dark coverings
                on hemisphere-only faces read as their material, not black. */}
            <meshStandardMaterial
              color={houseSurfaceColor('roof', roofKey, s.solvedRoof!.colorHex)}
              flatShading
              side={THREE.DoubleSide}
              map={roofTex || null}
              emissive={houseSurfaceColor('roof', roofKey, s.solvedRoof!.colorHex)}
              emissiveMap={roofTex || null}
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
});

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
    <group name="world3d:sites" position={chunkScenePos(chunk.cx, chunk.cy, origin)}>
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
  // rewrite every instance matrix again (W3D-G25). Trees moved out of the
  // per-chunk path entirely (see VegetationTreeField); bushes remain a single
  // instanced sphere layer with palette colors.
  const lastBushCacheKey = useRef<string | null>(null);
  // A LAYOUT effect (ADR 0009, 2026-10-26; as GrassLayer and
  // VegetationTreeField): the instance colors must exist before the first
  // draw, because the WebGPU node graph is fixed at its first build and a
  // late `instanceColor` left the bushes white. Same work, only earlier.
  useLayoutEffect(() => {
    if (!bushes || !bushRef.current) {
      lastBushCacheKey.current = null;
      return;
    }
    syncVegetationInstanceMatrices(bushRef.current, bushes, lastBushCacheKey, 'bush');
  }, [bushes?.cacheKey]);
  const bushCount = bushes ? bushes.positions.length / 3 : 0;
  // The lighting frustum follows the player, so vegetation beyond the adjacent
  // chunks cannot contribute a useful visible shadow. Keeping those instances
  // out of the shadow pass avoids replaying the whole 81-chunk forest.
  const castsNearbyShadow = SHADOWS
    && Math.max(Math.abs(chunk.cx - anchor.cx), Math.abs(chunk.cy - anchor.cy)) <= 1;
  // Trees are NOT drawn here any more: per-chunk instanced meshes fragmented the
  // batching (2,340 trees across 379 meshes in a measured frame). They are
  // batched field-wide by VegetationTreeField at the scene root instead.
  if (bushCount === 0) return null;
  return (
    <group position={chunkScenePos(chunk.cx, chunk.cy, origin)}>
      {bushCount > 0 && (
        <instancedMesh name="world3d:bushes" ref={bushRef} args={[undefined, undefined, bushCount]} castShadow={castsNearbyShadow}>
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
  /** false = town-on-LAND mode: no sheet, no skirts; everything else stays. */
  terrainSkin?: boolean;
  waterFlatColorHex?: string;
  /** Fine render patches for the terrain: the player's footing, then each ground edit (GG-533). */
  footingDetails?: readonly TerrainFootingDetail[];
  /** The roads' footing patches (the player's only: a ground edit cuts roads, see `groundEditShapes`). */
  roadFootingDetails?: readonly TerrainFootingDetail[];
  /** The ground edits whose footprints remove the paving (groundEditRoadCut.ts). */
  groundEditShapes?: readonly GroundShape[];
  /** Per-layer visibility. Absent key = visible. See `World3DLayerVisibility`. */
  layers?: World3DLayerVisibility;
  prepared?: DrawingMesh<FootingMeshOutput>;
}> = ({ chunk, origin, anchor, detailAnchor, detailCenter, loadedKeys, terrainSkin = true, waterFlatColorHex, footingDetails, roadFootingDetails, groundEditShapes, layers, prepared }) => {
  const on = (k: keyof World3DLayerVisibility): boolean => layers?.[k] !== false;
  return (
  <>
    {terrainSkin && (
      <TerrainPiece chunk={chunk} origin={origin} anchor={anchor} loadedKeys={loadedKeys} footingDetails={footingDetails} prepared={prepared} />
    )}
    <group visible={on('water')}>
      <WaterPiece chunk={chunk} origin={origin} flatColorHex={waterFlatColorHex} />
    </group>
    <group visible={on('roads')}>
      <RoadPiece chunk={chunk} origin={origin} footingDetails={roadFootingDetails} cutShapes={groundEditShapes} prepared={prepared} />
      <RoadVergePiece chunk={chunk} origin={origin} footingDetails={roadFootingDetails} cutShapes={groundEditShapes} prepared={prepared} />
    </group>
    <group visible={on('walls')}>
      <WallPiece chunk={chunk} origin={origin} />
      <GatePiece chunk={chunk} origin={origin} />
    </group>
    <group visible={on('buildings')}>
      <DeckPiece chunk={chunk} origin={origin} />
      <SitePieces
        chunk={chunk}
        origin={origin}
        detailAnchor={detailAnchor}
        detailCenter={detailCenter}
      />
    </group>
    <group visible={on('bushes')}>
      <VegetationPiece chunk={chunk} origin={origin} anchor={detailAnchor} />
    </group>
    {/* Near-camera instanced grass (vegetation lift): only chunks near the
        anchor mount a grass mesh — cheap distance falloff. */}
    <group visible={on('grass')}>
      <GrassLayer chunk={chunk} anchor={anchor} position={chunkScenePos(chunk.cx, chunk.cy, origin)} />
    </group>
  </>
  );
};

/** Exp-damp rate for the canopy transition: ~95% converged after ~2 s. */
const CANOPY_DAMP_LAMBDA = 1.5;

/** Value-equality for applied canopy interiors (null = no modulation). */
/** Existing preview clocks remain readable; this never advances the game clock. */
function ResidentDoorPreviewClock({onChange}: {onChange: (clock: number | undefined) => void}) {
  const previous = useRef<number | undefined>(undefined);
  useFrame(() => {
    const clock = (window as unknown as {__wfAgentClock?: number}).__wfAgentClock;
    if (previous.current === clock) return;
    previous.current = clock;
    onChange(clock);
  }, -110);
  return null;
}

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

/**
 * The underside of the world.
 *
 * The streamed terrain is one triangle layer. Walls close the streaming
 * frontier and nothing closed the bottom, so a camera below grade looked
 * straight through the ground into an empty scene — the world was a sheet, not
 * a solid.
 *
 * This is the floor of that solid. One plane, at the same `GROUND_FLOOR_Y` the
 * frontier walls now reach, so the loaded region is closed on every side. It
 * faces DOWN, because it is only ever seen from beneath; an upward face would
 * be a second ground hiding under the real one.
 *
 * Its color is granite, read from the material registry rather than typed here.
 * Deep rock is what you would actually be looking at, and taking the value from
 * the registry stops the floor drifting away from the substance a cut face
 * shows at that depth.
 */
const WorldUnderside: React.FC = () => {
  const rock = substance(Material.Granite).rgb;
  // Wide enough to cover the streaming window from any angle inside it. Two
  // triangles, so the span costs nothing.
  const SPAN = WORLD3D_CONFIG.CHUNK_WORLD_SIZE * 24;
  return (
    <mesh position={[0, WORLD3D_CONFIG.GROUND_FLOOR_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[SPAN, SPAN]} />
      <meshStandardMaterial color={new THREE.Color(rock[0], rock[1], rock[2])} roughness={1} />
    </mesh>
  );
};

const World3DScene: React.FC<World3DSceneProps> = ({
  loader,
  start,
  startSurfaceY = 0,
  playerWorldPos = null,
  onPositionChange: onPositionChangeOverride,
  onCameraBearingChange,
  onChunkUpdate,
  viewProfile = 'continent',
  forgeAssetService,
  groundWorld = null,
  onPropLayerReady,
  agentClock,
  frameTownCellNonce = 0,
  framePlayerNonce = 0,
  onPlayerFrameUnavailable,
  sceneCast,
  partyCompanions,
  partyPaused,
  onCompanionPositionChange,
  onSelectNpc,
  onGroundPick,
  onAvatarPositionChange,
  onAvatarMovementBlocked,
  onSelectFurnishing,
  onSelectDoor,
  onNearbyBuildingDoorChange,
  onNearbyFurnishingChange,
  focusedFurnishingId,
  resolveNearbyFurnishingPlan,
  onSelectResident,
  openDoors,
  playerGroundPos = null,
  groundMoveRequest = null,
  playerCharacter = null,
  timeOfDayHours,
  combatLayer,
  cameraFrameRequest = null,
  terrainSkin = true,
  volumeBubbleExtentM,
  volumeBubbleCellM,
  volumeBubbleHeightM,
  waterFlatColorHex,
  layers,
  suspended = false,
}) => {
  /** Layer visibility: an absent key is VISIBLE. */
  const actualFootfall = useRef<AvatarFootfall | null>(null);
  // One bounded allocation owns full resident models in rooms AND on streets.
  // Both render layers read this committed set before drawing, so an active
  // commuter cannot become a second generic body at the doorway.
  const residentBodyOwners = useRef<ReadonlySet<string>>(new Set());
  const renderedScene = useRef<THREE.Scene | null>(null);
  // Both input owners share only transient pace intent. Accepted position and
  // character speed keep their existing authorities across save and reload.
  const movementIntent = useRef<GroundMovementIntent>({ sprinting: false }).current;
  useEffect(() => {
    // Only a new destination receipt can hand stopped keys back to click/Locale
    // walking. A saved-footfall update or modal cannot roll the body backward.
    if (groundMoveRequest && !groundKeyboardHasInput(movementIntent.keyboard)) {
      movementIntent.keyboardOwnsFeet = false;
    }
  }, [movementIntent, groundMoveRequest]);
  const onPointerGroundPick = useCallback((xM: number, zM: number) => {
    if (!groundKeyboardHasInput(movementIntent.keyboard)) movementIntent.keyboardOwnsFeet = false;
    onGroundPick?.(xM, zM);
  }, [movementIntent, onGroundPick]);
  const layerOn = (k: keyof World3DLayerVisibility): boolean => layers?.[k] !== false;
  const { loaded, update } = useChunkStreaming(loader);
  const playerSightline = useMemo(() => createPlayerCameraSightline(() => renderedScene.current), [loaded, start[0], start[2]]);
  const walkingSurfaces = useMemo(() => createMountedDeckWalkingSurfaces(), [groundWorld]);
  // This is a derived geometry cache, not game state. Retain real support when
  // camera-only movement unloads the bridge beneath the player's feet.
  useMemo(() => walkingSurfaces.updateLoaded(loaded), [walkingSurfaces, loaded]);

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
  const actorPersonalSpace=useMemo<ActorSpace>(()=>new Map(),[sceneOrigin]);
  const doorLedger=useRef<{source:typeof groundWorld;bodies:ActorSpace|null;opens:ReadonlySet<string>|undefined}>({source:groundWorld,bodies:actorPersonalSpace,opens:openDoors});
  React.useLayoutEffect(()=>{doorLedger.current.source=groundWorld;doorLedger.current.bodies=actorPersonalSpace;return()=>{
    if(doorLedger.current.source===groundWorld&&doorLedger.current.bodies===actorPersonalSpace)doorLedger.current.bodies=null;
  };},[actorPersonalSpace,groundWorld]);
  // Private leaves require the current rendered body's absolute-world feet,
  // not a clock-predicted point that may lie beyond a wall or a closed stair.
  const residentDoors = useMemo(() => createResidentDoorSampler(groundWorld, loaded, sceneOrigin,
    key=>actorPersonalSpace.get('resident:'+key)??null,{readBodies:()=>doorLedger.current.source===groundWorld?doorLedger.current.bodies:null,
      readOpenDoors:()=>doorLedger.current.source===groundWorld?doorLedger.current.opens:undefined}), [groundWorld, loaded, sceneOrigin, actorPersonalSpace]);
  const [previewDoorClock, setPreviewDoorClock] = React.useState<number | undefined>();
  const doorUsers = residentDoors(previewDoorClock ?? agentClock ?? 12);
  const effectiveOpenDoors = useMemo(() => mergeResidentDoorOpens(openDoors, doorUsers), [openDoors, doorUsers]);
  React.useLayoutEffect(()=>{doorLedger.current.opens=effectiveOpenDoors;},[effectiveOpenDoors]);
  const selectDoorWithBodies=useCallback((pick:FurnishingPick)=>onSelectDoor?.({...pick,readDoorBodies:()=>doorLedger.current.source===groundWorld?doorLedger.current.bodies:null}),[onSelectDoor,groundWorld]);
  const furnishingContext = useMemo(() => ({ origin: sceneOrigin, onSelect: onSelectFurnishing, onDoor: onSelectDoor?selectDoorWithBodies:undefined, onResident: onSelectResident, openDoors: effectiveOpenDoors, doorUsers, focusedFurnishingId }), [sceneOrigin, onSelectFurnishing, onSelectDoor, selectDoorWithBodies, onSelectResident, effectiveOpenDoors, doorUsers, focusedFurnishingId]);
  // ADR 0009 step 6, slice 10: the river's world mode builds its bed from the
  // ground world and places it against this origin (water/worldGroundHook.ts).
  // Published on every ground view since GG-533 step 2 (2026-10-29): the same
  // hook gives probes and, next, the game's spells the world's one ground
  // (`window.__wf3dGround`). Only the river's world mode listens to it, so
  // nothing else changes on the other addresses.
  useEffect(() => {
    if (viewProfile !== 'ground' || !groundWorld) return undefined;
    publishWorldGround({ ground: groundWorld, origin: sceneOrigin });
    return () => publishWorldGround(null);
  }, [groundWorld, sceneOrigin, viewProfile]);
  // One water, step 1 (2026-10-30): the player's foot, world m, for the live
  // river, which moves its reach along the world's river to follow it. The
  // walking avatar publishes its live foot too (onPositionChange below);
  // this one covers the start and a placed player.
  useEffect(() => {
    // Once the avatar walks, its live foot is the truth: the game's stored
    // position can be a click target the avatar has not reached (or cannot).
    if (viewProfile !== 'ground' || actualFootfall.current) return undefined;
    publishWorldPlayer(playerGroundPos ? { x: playerGroundPos.xM, z: playerGroundPos.zM } : { x: start[0], z: start[2] });
    return undefined;
  }, [playerGroundPos, start, viewProfile]);
  useEffect(() => () => publishWorldPlayer(null), []);
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
  // Every loaded chunk's trees, for the batched tree field and for the water's
  // canopy height field (water/canopyHeightField.ts, GG-528).
  const treeInputs = loaded.flatMap((c) => {
    const veg = c.bundle.vegetation;
    if (!veg || veg.positions.length === 0) return [];
    return [{
      scatter: veg,
      offset: chunkScenePos(c.cx, c.cy, sceneOrigin),
      castShadow: SHADOWS
        && Math.max(Math.abs(c.cx - anchorChunk.cx), Math.abs(c.cy - anchorChunk.cy)) <= 1,
    }];
  });
  // Loaded-chunk key set: frontier skirts draw only on edges with no neighbour.
  const loadedKeys = useMemo(() => new Set(loaded.map((c) => `${c.cx}|${c.cy}`)), [loaded]);
  // Refine around accepted feet and nearby independent people, never a remote
  // camera or requested click. Their retained positions choose render coverage
  // only; canonical ground still owns height and no person's feet are moved.
  const footingAnchorStep = GROUND_METERS_PER_CELL * 4;
  const focus = sceneFootingFocus({x:actualFootfall.current?.xM ?? playerGroundPos?.xM ?? start[0],z:actualFootfall.current?.zM ?? playerGroundPos?.zM ?? start[2]},
    [...(sceneCast ?? []).flatMap(member=>!member.isPlayer && member.position?.every(Number.isFinite)
      ? [{x:member.position[0]+sceneOrigin.x,z:member.position[2]+sceneOrigin.z}] : []),
      ...(partyCompanions ?? []).map(member => ({x:member.position.xM,z:member.position.zM}))],footingAnchorStep);
  const footingX=focus?.centerX,footingZ=focus?.centerZ,footingInnerRadius=focus?.innerRadius;
  const footingDetail = useMemo<TerrainFootingDetail | undefined>(() => {
    if (!CANONICAL_GROUND_DETAIL || RIVER_SITE_MODE || viewProfile !== 'ground' || !groundWorld
      || footingX==null || footingZ==null || footingInnerRadius==null) return undefined;
    return { centerX: footingX, centerZ: footingZ, innerRadius: footingInnerRadius, outerRadius: 16,
      maxEdgeM: GROUND_METERS_PER_CELL / 8, heightAt: (x, z) => groundSurfaceY(groundWorld, x, z) };
  }, [groundWorld, viewProfile, footingX, footingZ, footingInnerRadius]);
  const admittedFootingDetail = footingDetail && footingDetailReady(footingDetail, loadedKeys, WORLD3D_CONFIG.CHUNK_WORLD_SIZE) ? footingDetail : undefined;
  // THE GROUND EDITS ON THE DRAWN GROUND (agora-257c, 2026-10-29, GG-533).
  // Every shape a spell or a tool cut into the world's one ground (saved edits
  // replayed at build, and live ones) gets a fine render patch over its box,
  // drawn from the ground itself (terrainFootingDetail.ts groundEditDetail).
  // Unlike the footing patch this needs no URL flag: without it a 3 m spell
  // hole falls between the 8 m vertices and the land does not show the spell.
  // A live edit bumps the version; each patch joins only once its chunk ring
  // is loaded (footingDetailReady), as the footing patch does.
  const [groundEditVersion, setGroundEditVersion] = React.useState(0);
  useEffect(() => {
    if (!groundWorld) return undefined;
    return onGroundEdit((e) => { if (e.ground.heights === groundWorld.heights) setGroundEditVersion((v) => v + 1); });
  }, [groundWorld]);
  const groundEditDetails = useMemo<TerrainFootingDetail[]>(() => {
    if (!groundWorld || viewProfile !== 'ground') return [];
    return groundShapesCutInto(groundWorld).map((shape) => groundEditDetail(
      groundShapeBounds(shape), GROUND_METERS_PER_CELL / 2, (x, z) => groundSurfaceY(groundWorld, x, z),
    ));
    // groundEditVersion: a live edit adds a shape to the same heights array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groundWorld, viewProfile, groundEditVersion]);
  // The shapes themselves, for the roads they cut (one list per edit version).
  const groundEditShapes = useMemo<readonly GroundShape[]>(
    () => (groundWorld && viewProfile === 'ground' ? [...groundShapesCutInto(groundWorld)] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groundWorld, viewProfile, groundEditVersion],
  );
  const roadFootingDetails = useMemo(
    () => (admittedFootingDetail ? [admittedFootingDetail] : undefined),
    [admittedFootingDetail],
  );
  // One stable list per set of admitted patches, so a chunk loading elsewhere
  // does not make every chunk refine again.
  const footingDetailsRef = useRef<{ key: string; list: TerrainFootingDetail[] }>({ key: '', list: [] });
  const footingDetails = useMemo(() => {
    const list: TerrainFootingDetail[] = [];
    if (admittedFootingDetail) list.push(admittedFootingDetail);
    const flags: number[] = [];
    groundEditDetails.forEach((d, k) => {
      if (footingDetailReady(d, loadedKeys, WORLD3D_CONFIG.CHUNK_WORLD_SIZE)) { list.push(d); flags.push(k); }
    });
    const key = `${groundEditVersion}:${flags.join(',')}`;
    const prev = footingDetailsRef.current;
    if (!admittedFootingDetail && prev.key === key && prev.list.length === list.length) return prev.list;
    footingDetailsRef.current = { key: admittedFootingDetail ? '' : key, list };
    return list;
  }, [admittedFootingDetail, groundEditDetails, loadedKeys, groundEditVersion]);

  // A moving standing-ground patch is expensive to clip. Prepare its complete
  // terrain/paving batch off-thread, retaining the last complete drawing until
  // it arrives. Ground edits keep their current immediate cut/refinement path.
  // This affects drawing only; physical support and movement remain canonical.
  const prepareFootingOffThread = !!admittedFootingDetail && !!groundWorld && !groundEditShapes.length;
  const preparedFooting = useFootingMeshes(groundWorld, loaded, footingDetails, roadFootingDetails, prepareFootingOffThread, WEBGPU_WORLD);

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
      target = [s.x, groundSurfaceY(groundWorld!, best.xM, best.zM), s.z];
      halfM = best.halfM;
      // Fit real plot corners rather than the much larger terrain cell. This
      // keeps a small settlement inspectable after parcel-size changes too.
      const corners = groundWorld!.buildings
        .filter(b => b.id.startsWith(`wf-plot-${best.burgId}-`))
        .flatMap(b => b.cornersM);
      if (corners.length) {
        const minX = Math.min(...corners.map(p => p.x)), maxX = Math.max(...corners.map(p => p.x));
        const minZ = Math.min(...corners.map(p => p.z)), maxZ = Math.max(...corners.map(p => p.z));
        const center = worldToScene((minX + maxX) / 2, (minZ + maxZ) / 2, sceneOrigin);
        // The town may sit below the initial spawn terrain. Aim at its actual
        // surface so the frame command cannot point above the rooftops.
        target = [center.x, groundSurfaceY(groundWorld!, (minX + maxX) / 2, (minZ + maxZ) / 2), center.z];
        halfM = Math.max(maxX - minX, maxZ - minZ) / 2;
      }
    }
    const height = Math.min(1400, Math.max(35, halfM * 1.1));
    return { kind: 'town', nonce: frameTownCellNonce, target, height, oblique: true };
  }, [frameTownCellNonce, groundWorld, sceneOrigin, startSurfaceY]);

  const playerFrameRequest = useMemo(() => {
    if (!framePlayerNonce) return null;
    const foot = actualFootfall.current ?? (playerGroundPos ? {
      ...playerGroundPos, yM: playerGroundPos.yM ?? startSurfaceY,
    } : null);
    return playerCameraFrame(groundWorld, foot, sceneOrigin, framePlayerNonce, playerSightline);
    // Footing is intentionally sampled only on this explicit request, not on
    // every footfall. Ordinary orbiting and keyboard camera motion stay free.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framePlayerNonce, groundWorld, sceneOrigin]);
  const reportedPlayerFrame = useRef(0);
  useEffect(() => {
    if (!framePlayerNonce) { reportedPlayerFrame.current = 0; return; }
    if (playerFrameRequest || reportedPlayerFrame.current === framePlayerNonce) return;
    reportedPlayerFrame.current = framePlayerNonce;
    onPlayerFrameUnavailable?.();
  }, [framePlayerNonce, playerFrameRequest, onPlayerFrameUnavailable]);

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
    <div style={{ width: '100%', height: '100%', minHeight: 0, flex: '1 1 auto', visibility: suspended ? 'hidden' : 'visible', background: '#0e1a2b', borderRadius: '12px', overflow: 'hidden' }}>
      <ForgeAssetContext.Provider value={forgeAssetService}>
      <Canvas
        frameloop={suspended ? 'never' : 'always'}
        // Avoid a 4K backing buffer on DPR-2 monitors. Ground mode draws the
        // denser town/interior layers and therefore uses a 0.75 ceiling (still
        // a 1920px backing buffer in a 2560px-wide viewport); the lighter
        // continent view keeps the prior 0.85 ceiling for distant labels.
        dpr={viewProfile === 'ground' ? [0.65, 0.75] : [0.75, 0.85]}
        shadows={SHADOWS && viewProfile === 'ground' ? 'soft' : false}
        camera={{ fov: 55, near: 1, far: 60000, position: camPosition }}
        // ADR 0009 step 1: ?gpu=1 draws the world with WebGPURenderer. NO
        // FALLBACK: a renderer that comes up on another backend throws, as the
        // battle map's does. Tone mapping lives on the renderer, because the
        // WebGL post chain (and its ToneMapping effect) is off on this path.
        gl={WEBGPU_WORLD ? (props) => {
          const canvas = (props as { canvas: HTMLCanvasElement | OffscreenCanvas }).canvas;
          const made = worldGpuRenderers.get(canvas);
          if (made) return made;
          const making = (async () => {
          const { WebGPURenderer } = await import('three/webgpu');
          const renderer = new WebGPURenderer({ ...(props as ConstructorParameters<typeof WebGPURenderer>[0]), antialias: true });
          await renderer.init();
          const backend = (renderer as unknown as { backend?: { isWebGPUBackend?: boolean } }).backend;
          if (!backend?.isWebGPUBackend) {
            renderer.dispose();
            throw new Error('[world3d-webgpu] WebGPURenderer came up on a non-WebGPU backend; refusing to draw a fallback (remove &gpu=1 for the WebGL world)');
          }
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.05;
          (window as unknown as { __wf3dBackend?: string }).__wf3dBackend = 'webgpu';
          // R3F types the factory's result as a WebGLRenderer; WebGPURenderer is
          // the sibling it drives through the same surface.
          return renderer as unknown as THREE.WebGLRenderer;
          })();
          worldGpuRenderers.set(canvas, making);
          // A failed start is not kept: the next configure may try again.
          making.catch(() => { if (worldGpuRenderers.get(canvas) === making) worldGpuRenderers.delete(canvas); });
          return making;
        } : { antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        onCreated={({ gl, scene }) => {
          renderedScene.current = scene;
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
        {/* The turn-based overlay retains its own movement/collision authority. */}
        <ActorPersonalSpaceContext.Provider value={combatLayer ? null : actorPersonalSpace}>
        <GroundFurnishingContext.Provider value={furnishingContext}>
          <ResidentDoorPreviewClock onChange={setPreviewDoorClock} />
          <NearbyBuildingDoor ground={groundWorld} loaded={loaded}
            readFootfall={() => actualFootfall.current}
            enabled={viewProfile === 'ground' && !partyPaused && !combatLayer && !suspended}
            onChange={onNearbyBuildingDoorChange} />
          <NearbyFurnishing ground={groundWorld} loaded={loaded}
            readFootfall={() => actualFootfall.current} resolvePlan={resolveNearbyFurnishingPlan}
            enabled={viewProfile === 'ground' && !partyPaused && !combatLayer && !suspended}
            onChange={onNearbyFurnishingChange} />
        {!suspended && <PerfProbe id="world3d" label="World 3D" />}
        <World3DPerfCensusProbe
          loadedSignature={loaded.map((chunk) => `${chunk.cx}|${chunk.cy}|${chunk.lod}`).join(';')}
        />
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
        {/* Physically-based night sky (stars/moon/Bruneton dome), driven by
            the same game-clock hour as World3DLighting. Renders nothing while
            the true sun is up, so the daytime look is untouched. Volumetric
            clouds do NOT live here — they are a post-processing effect that
            rides the scene's own composer below (see VolumetricClouds), so
            they render in daylight too. */}
        <NightSky timeOfDayHours={timeOfDayHours} />
        {/* Interior lighting (ground profile): warm hearth flame point lights
            near the camera (nearest ≤4), lit-window emissive glow (baked into
            parts), and a camera-inside fill so any interior is readable. */}
        {viewProfile === 'ground' && (
          // One InteriorHour clock source for the hearth lights and live
          // occupants (windows already read it via the provider wrapping the
          // chunk pieces below). Honors the window.__wfAgentClock scrub override.
          <InteriorHourProvider clock={agentClock}>
            <InteriorLights loaded={loaded} origin={sceneOrigin} />
            <InteriorOccupants loaded={loaded} origin={sceneOrigin} ground={groundWorld} bodyOwners={residentBodyOwners} walkingSurfaces={walkingSurfaces} />
          </InteriorHourProvider>
        )}
        {viewProfile === 'ground' && onCameraBearingChange && <CameraHeadingReporter onChange={onCameraBearingChange} />}
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
          frameRequest={cameraFrameRequest ?? (framePlayerNonce ? playerFrameRequest : townFrameRequest)}
          playerSightline={viewProfile === 'ground' ? playerSightline : undefined}
          getPlayerTarget={() => {
            const foot = actualFootfall.current;
            if (!foot) return null;
            const local = worldToScene(foot.xM, foot.zM, sceneOrigin);
            return [local.x, foot.yM + 1.15, local.z];
          }}
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
              terrainSkin={terrainSkin}
              waterFlatColorHex={waterFlatColorHex}
              prepared={preparedFooting.get(`${c.cx}|${c.cy}`)?.source === c.bundle ? preparedFooting.get(`${c.cx}|${c.cy}`)?.meshes : undefined}
              footingDetails={prepareFootingOffThread ? undefined : footingDetails}
              roadFootingDetails={prepareFootingOffThread ? undefined : roadFootingDetails}
              groundEditShapes={groundEditShapes}
              layers={layers}
            />
          ))}
        </InteriorHourProvider>
        <WaterRippleDriver />
        {WEBGPU_WORLD && <CanopyFieldPublisher inputs={treeInputs} />}
        {/* Every chunk's trees in one batch set (2026-07-27). Sits outside the
            per-chunk groups because its instance positions are already scene
            space — see treeBatching.ts for why per-chunk meshes were dropped. */}
        <group visible={layerOn('trees')}>
        <VegetationTreeField inputs={treeInputs} />
        </group>
        {/* The forest floor — ferns, fallen logs and saplings (2026-08-04).
            Batched across chunks like the trees above, and for the same reason:
            it is the most numerous thing in the world. */}
        <group visible={layerOn('understory')}>
        <UnderstoryField
          chunks={loaded.flatMap((c) => {
            const u = c.bundle.understory;
            if (!u || u.count === 0) return [];
            const distance = Math.max(
              Math.abs(c.cx - detailAnchor.cx),
              Math.abs(c.cy - detailAnchor.cy),
            );
            if (distance > UNDERSTORY_CHUNK_RADIUS) return [];
            return [{ understory: u, offset: chunkScenePos(c.cx, c.cy, sceneOrigin) }];
          })}
        />
        </group>
        <group visible={layerOn('agents')}>
        <GroundAgents
          ground={groundWorld}
          loaded={loaded}
          clock={agentClock}
          sceneOrigin={sceneOrigin}
          bodyOwners={residentBodyOwners}
        />
        </group>
        {/* Far-distance terrain shells (2026-07-21): the region ring + atlas
            horizon that replace the old visible world edge. Static, built once
            per window; fog dissolves their outer rim into the sky. */}
        {/* The world's floor. Mounted with the ground profile, the only view
            from which a camera can get beneath the terrain. */}
        {viewProfile === 'ground' && <WorldUnderside />}
        {/* ADR 0002, wiring slice 1: the ground around the player is a real
            VOLUME, filled from this same GroundWorld in a worker and drawn with
            the substance material. It lies over the heightfield skin and dives
            under it at its rim, so the join has no seam and no wall. Nothing
            digs it yet — that is a later slice — but the volume it hands out is
            the object that carve will run against. */}
        {viewProfile === 'ground' && (
          <VolumeGroundBubble
            ground={groundWorld}
            sceneOrigin={sceneOrigin}
            playerGroundPos={playerGroundPos}
            extentM={volumeBubbleExtentM}
            cellM={volumeBubbleCellM}
            heightM={volumeBubbleHeightM}
            // Over the skin the lid draws only once something digs it
            // (VolumeGroundBubble `hideUntilCarved`); `?volumeBubble=show`
            // draws it at once for the A/B rigs.
            hideUntilCarved={terrainSkin && !VOLUME_BUBBLE_SHOW}
          />
        )}
        {/* THE HORIZON IS NOT PART OF THE SKIN (agora-0774).
            These shells were gated on `terrainSkin`, which made sense while
            only the skin drew ground — but the town-on-LAND pane turns the skin
            off and keeps a volume bubble, and beyond that bubble's rim it was
            then left with nothing: a hard silhouette against empty fog, with
            distant trees standing on air. The shells are a distant backdrop,
            not a sheet under the town (they carry a hole over the streamed
            window precisely so they never cut up through its detail), so they
            belong to the ground PROFILE, not to the skin. The `farShells` chip
            still hides them for anyone who wants the bare bubble. */}
        {viewProfile === 'ground' && (
          <group visible={layerOn('farShells')}>
            <FarShells ground={groundWorld} sceneOrigin={sceneOrigin} />
          </group>
        )}
        {viewProfile === 'ground' && (
          <group visible={layerOn('props')}>
            <GroundProps ground={groundWorld} sceneOrigin={sceneOrigin}
              onReady={onPropLayerReady ? root => onPropLayerReady(root, groundWorld!, sceneOrigin, actorPersonalSpace) : undefined} />
          </group>
        )}
        {/* Pillar 2: world-grown dungeon entrances (sealed doors) as readable
            markers the player can walk up to and discover. */}
        {viewProfile === 'ground' && (
          <DungeonEntrances ground={groundWorld} sceneOrigin={sceneOrigin} />
        )}
        {sceneCast && sceneCast.length > 0 && (
          <SceneCast cast={viewProfile === 'ground' && playerCharacter ? sceneCast.filter(member => !member.isPlayer) : sceneCast} surfaceY={startSurfaceY} onSelectNpc={onSelectNpc} />
        )}
        {/* A staged conversation keeps its NPCs, while the real player's one
            moving body follows the shared ground position. */}
        {viewProfile === 'ground' && (
          <PlayerAvatar
            groundPos={playerGroundPos}
            ground={groundWorld}
            sceneOrigin={sceneOrigin}
            startSurfaceY={startSurfaceY}
            character={playerCharacter}
            movementIntent={movementIntent}
            onPositionChange={pose => { actualFootfall.current = pose; publishWorldPlayer({ x: pose.xM, z: pose.zM }); onAvatarPositionChange?.(pose); }}
            onMovementBlocked={onAvatarMovementBlocked}
            openDoors={effectiveOpenDoors}
              walkingSurfaces={walkingSurfaces}
          />
        )}
        {viewProfile === 'ground' && groundWorld && partyCompanions?.length ? (
          <PartyGroundActors members={partyCompanions} ground={groundWorld} sceneOrigin={sceneOrigin}
            leader={actualFootfall} paused={partyPaused} openDoors={effectiveOpenDoors} walkingSurfaces={walkingSurfaces}
            onPosition={onCompanionPositionChange} onTalk={onSelectNpc} />
        ) : null}
        {/* Click-to-move locomotion (ground mode): invisible pick plane over the
            tile. Rendered before the combat layer so a fight's own pick plane
            takes precedence while combat is active. */}
        {viewProfile === 'ground' && (
          <GroundMovePlane ground={groundWorld} sceneOrigin={sceneOrigin} onGroundPick={onGroundPick ? onPointerGroundPick : undefined} />
        )}
        {/* Real-time keyboard WASD and Arrow key locomotion (ground mode). */}
        {viewProfile === 'ground' && (
          <GroundKeyboardDriver
            groundWorld={groundWorld}
            sceneOrigin={sceneOrigin}
            playerGroundPos={playerGroundPos}
            character={playerCharacter}
            movementIntent={movementIntent}
            onGroundPick={onGroundPick}
            openDoors={effectiveOpenDoors}
            getFootfall={() => actualFootfall.current}
            onGroundStop={onAvatarMovementBlocked}
              walkingSurfaces={walkingSurfaces}
          />
        )}
        {/* Fight-in-place slice 2: the combat surface (tokens, reachable disc,
            ground-pick plane) drawn on the same streamed terrain. */}
        {combatLayer}
        {/* BG3 parity, world3d-ground target #6 (ambient occlusion). Ported from
            the proven BattleMap3D stack rather than reinvented — including its
            two hard-won lessons:

            1. N8AO, not postprocessing's SSAOEffect. SSAO needs enableNormalPass,
               and under WebGL2 with three r172 + @react-three/postprocessing 3.x
               that fired `GL_INVALID_OPERATION: Read and write depth stencil
               attachments cannot be the same image` every frame. N8AO
               reconstructs normals from depth in its own pass, so no NormalPass.
            2. ToneMapping MUST be in this chain. While EffectComposer is
               mounted it sets `gl.toneMapping = NoToneMapping`, silently killing
               the ACESFilmic setting on the Canvas above — that is what made an
               earlier surface read as raw, uncomposited 3D.

            Ground profile only: the continent view draws at a scale where
            contact shading buys nothing and the extra pass is pure cost. */}
        {/* Cloud compositing needs color and depth from the same coverage
              sample. MSAA resolves leaf-edge color before the depth-aware sky
              pass, leaving bright sky fringes. Antialias the final image. */}
        {/* ADR 0009: the WebGL post chain (N8AO, clouds, ACES, SMAA) is off on
            the WebGPU path; step 5 draws that path through three's node
            PostProcessing instead (WorldGpuPostChain, below the composer). */}
        {viewProfile === 'ground' && !WEBGPU_WORLD && (
          <EffectComposer multisampling={0}>
            {/* aoRadius stays at BattleMap3D's 1.8 m, and the earlier claim that
                it "does not port" was wrong — corrected after the world3d critic
                measured it (2026-07-30).

                What happened: AO and ToneMapping were wired in ONE change, so the
                A/B had two variables. ToneMapping lifted the sky 86.9 → 176.2 and
                the whole frame read brighter, which was misread as "AO absent".
                It was never absent — at 1.8 the critic measured rock base
                60.7 → 29.9 (−51%) and grass tuft 81.7 → 45.3, while UNOCCLUDED
                open ground correctly held 94.2 → 94.0.

                Raising it to 5 was a net regression: unoccluded open ground dimmed
                94.0 → 85.3 (−9%, which AO must never do) and grass tufts crushed
                to 3.2x darker than baseline, reading as black scorch marks.

                Rule this leaves behind: never A/B two rendering changes at once,
                and a claimed AO pass must show that unoccluded ground did NOT
                darken. */}
            {/* BG3 parity world3d-ground #6, re-measured 2026-08-01 for the
                EXPLORATION camera (~100 m look-across), not the close combat
                camera the 1.8 value was tuned for. FINDINGS item 2 measured
                1.8 = no visible darkening, 5 = too faint, 7 = occluders seated,
                8 = muddies ground cover, at this camera. The in-code 1.8
                measurement (rock base 60.7->29.9) was a closer framing. The
                blind A/B critic (2026-08-01) flagged contact shading missing,
                supporting the larger radius here. Re-A/B vs open-ground luma:
                if unoccluded ground dims >3%, back off toward 5. */}
            <N8AO
              halfRes
              // Sparse AO samples made nearby plaster and floors visibly grainy.
              // Keep the existing radius, strength and resolution while giving
              // the contact-shadow estimate and denoiser more samples.
              quality="medium"
              aoRadius={7}
              distanceFalloff={3.5}
              intensity={3.2}
            />
            {/* Physically-based volumetric clouds (takram ray-march), driven
                by the same clock hour as the lighting. An Effect, not a
                second composer: Clouds joins this chain after AO and before
                tone mapping, wrapped in its own <Atmosphere> context for the
                sun/ECEF state. Works day AND night — NightSky only supplies
                the stars/moon/dome. Depth-buffer only (no normal pass). */}
            <VolumetricClouds timeOfDayHours={timeOfDayHours} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <SMAA />
          </EffectComposer>
        )}
        {/* ADR 0009 step 5: the same chain on WebGPU (GTAO, ACES, SMAA; no
            clouds until step 7), drawn by three's node PostProcessing. */}
        {viewProfile === 'ground' && WEBGPU_WORLD && <WorldGpuPostChain />}
        </GroundFurnishingContext.Provider>
        </ActorPersonalSpaceContext.Provider>
      </Canvas>
      </ForgeAssetContext.Provider>
    </div>
  );
};

export default World3DScene;


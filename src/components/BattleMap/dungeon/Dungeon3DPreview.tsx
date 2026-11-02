/**
 * This file presents a generated dungeon as an explorable three-dimensional scene.
 *
 * It consumes the plain placement records from dungeonSceneModel.ts and batches floors,
 * walls, doors, furniture, evidence, flames, and encounters into instanced meshes. Camera
 * presets and orbit controls make the result useful as both a whole-plan inspection tool and
 * an atmospheric preview. In mounted gameplay, each accepted grid position reports nearby plan
 * cells to the durable exploration ledger. No generation logic lives here, so the parchment and
 * 3D modes cannot disagree about what dungeon was built or what happened to it. A caller may now
 * supply the exact arrival cell selected by a level transition, allowing ascent to restore the
 * parent stair without changing collision or generation. Transition controls remain in the
 * expedition overlay; unsupported combat and completion interactions remain outside this renderer.
 *
 * Called by: PreviewDungeon.tsx when the user selects the 3D Expedition view.
 * Depends on: React Three Fiber for the canvas and drei for accessible camera controls/labels.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 00:18:50
 * Dependents: components/DesignPreview/steps/PreviewDungeon.tsx, components/World3D/DungeonExpeditionOverlay.tsx
 * Imports: 21 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, MapControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, N8AO, ToneMapping } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import {applyDungeonVisibility, createDungeonVisibilityUniforms, type DungeonVisibilityUniforms} from './dungeonVisibilityMaterial';
const DungeonVisibilityContext = React.createContext<DungeonVisibilityUniforms | null>(null);
import {applyDungeonIndirectLight, createDungeonIndirectLight, type DungeonIndirectLight} from './dungeonIndirectLight';
import {DungeonIndirectLighting} from './DungeonIndirectLighting';
const DungeonIndirectContext = React.createContext<DungeonIndirectLight | null>(null);
import { Button } from '../../ui/Button';
import {CarriedTorchIgnition,type CarriedTorchChoice} from './CarriedTorchIgnition';
import type { Cell, DungeonPlan, DungeonTheme } from '../../../systems/worldforge/dungeon/types';
import type { DungeonIdentity } from '../../../systems/worldforge/dungeon/world/dungeonIdentity';
import {
  canClaimDungeonTreasure,
  canClearDungeonEncounter,
  dungeonCellToScenePosition,
  dungeonEncounterEventId,
  dungeonSpawnCell,
  dungeonEntrancePlayerCell,
  dungeonPathToEncounterInteraction,
  dungeonPathToTreasureInteraction,
  findNextDungeonEncounterInteraction,
  findNextDungeonTreasureInteraction,
  moveDungeonPlayer,
  type DungeonMoveDirection,
} from '../../../systems/worldforge/dungeon/world/dungeonGameplay';
import { dungeonPlayerCameraFrame } from './dungeonPlayerCamera';
import { dungeonCaches } from '../../../systems/worldforge/dungeon/world/dungeonCaches';
import { dungeonObjectId, nearbyDungeonObjects, type DungeonObjectFinding } from '../../../systems/worldforge/dungeon/world/dungeonObjectActions';
import type {LightSource} from '../../../types/underdark';
import type {PlayerCharacter} from '../../../types/character';
import {DungeonPartyFigure} from './DungeonPartyFigure';
import {DungeonCreatureFigure} from './DungeonCreatureFigure';
import {visibleDungeonCreatures,type DungeonCreatureActor} from './dungeonCreatureActors';
import {createDungeonSurfaceMaterial} from './dungeonSurfaceMaterial';
import { revealedDungeonCellKeys } from '../../../systems/worldforge/dungeon/world/dungeonMap';
import { PerfProbe } from '../../../devtools/perf';
import {calculateDifficulty} from '../../../utils/combat/encounterDifficulty';
import {
  buildDungeonSceneModel,
  dungeonPlayerAccentLights,
  dungeonThemeLighting,
  type DungeonSceneInstance,
  type DungeonSceneLine,
  type DungeonSceneMarker,
  type DungeonSceneModel,
} from './dungeonSceneModel';

// ============================================================================
// Public view controls
// ============================================================================
// Presets are named for player intent rather than camera math. They remain stable controls even
// if the framing formula changes as the renderer evolves.
// ============================================================================

export type DungeonCameraPreset = 'player' | 'tactical' | 'entrance' | 'objective';

export interface Dungeon3DOverlays {
  graph: boolean;
  loops: boolean;
  critical: boolean;
  heatmap: boolean;
  rooms: boolean;
  props: boolean;
  spawns: boolean;
  secrets: boolean;
}

/** The deepest-level boss objective the mounted expedition can complete to finish the dungeon. */
export interface Dungeon3DObjectiveTarget {
  id: string;
  cell: Cell;
}

export interface Dungeon3DGameplay {
  identity: DungeonIdentity;
  /** Actual lead party identity and equipped gear; the renderer owns no character state. */
  playerCharacter?: PlayerCharacter;
  /** Explicit developer mode keeps progress simulators out of ordinary play. */
  developerTools?: boolean;
  /** Reading the map suspends walking and rendering without losing the accepted cell. */
  paused?: boolean;
  /** Accepted floor positions let the expedition require actual stair arrival. */
  onPlayerCellChange?: (cell: Cell) => void;
  /** Open only an ordinary door adjacent to accepted footing; the parent persists the route. */
  onOpenDoor?: (target: Cell, player: Cell) => void;
  objectFindings?: Readonly<Record<string, DungeonObjectFinding>>;
  onObjectInteraction?: (id:string,intent:'examine'|'collect'|'light_torch',inventoryIndex?:number) => void;
  carriedTorch?: LightSource;
  carriedTorchIndex?: number;
  /** Explicit carried sources keep a partly burned torch distinct from a fresh backup. */
  carriedTorchChoices?: readonly CarriedTorchChoice[];
  getTorchUseError?: (inventoryIndex:number,sourceObjectId:string)=>string|null;
  onExtinguishTorch?: () => void;
  claimedTreasureIds: readonly string[];
  onClaimTreasure: (eventId: string) => void;
  /** Encounters already cleared on this level, as persisted by the canonical lifecycle ledger. */
  clearedEncounterIds: readonly string[];
  /** Defeating a generated encounter reports its stable id; the reducer owns durable progress. */
  onClearEncounter: (eventId: string) => void;
  /** Start normal initiative against a currently visible source creature from accepted footing. */
  onStartEncounter?: (eventId: string, playerCell: Cell) => Promise<void>;
  partyLevels?: readonly number[];
  /** Current-level discovery already stored by the canonical dungeon lifecycle ledger. */
  discoveredCellKeys: readonly string[];
  /** Movement reports only newly visible canonical cell keys; the reducer owns persistence. */
  onDiscoverCells: (cellKeys: readonly string[]) => void;
  /** Present only when this mounted level exposes the deepest generated boss objective. */
  objective?: Dungeon3DObjectiveTarget | null;
  /** Reaching and defeating the boss reports its objective id so the dungeon can complete. */
  onCompleteObjective?: (objectiveId: string) => void;
  /** Exact floor cell selected by entry, descent, or parent ascent for this mounted level. */
  initialPlayerCell?: Cell;
}

interface Dungeon3DPreviewProps {
  plan: DungeonPlan;
  overlays: Dungeon3DOverlays;
  /** Present only in the mounted product expedition; design preview remains inspection-only. */
  gameplay?: Dungeon3DGameplay;
}

interface SceneProbeWindow extends Window {
  __dungeon3dReady?: boolean;
  __dungeon3dReadyOwner?: symbol;
  __dungeon3dViewState?: {
    preset: DungeonCameraPreset;
    autoRotate: boolean;
    fullscreen: boolean;
    visibleProps: number;
    totalProps: number;
  };
}

const NO_OBJECT_FINDINGS: Readonly<Record<string,DungeonObjectFinding>> = {};
const NO_CLAIMED_TREASURE: readonly string[] = [];
const NO_CLEARED_ENCOUNTERS: readonly string[] = [];
const NO_DISCOVERED_CELLS: readonly string[] = [];

// ============================================================================
// Instanced geometry
// ============================================================================
// Each visual category is one instanced mesh. This keeps a sixty-room dungeon practical while
// still allowing every cell and prop to carry its own transform and baked color variation.
// ============================================================================

type InstanceShape = 'box' | 'cylinder' | 'cone' | 'octahedron' | 'sphere' | 'arch';

const InstancedPieces: React.FC<{
  instances: DungeonSceneInstance[];
  shape?: InstanceShape;
  emissive?: boolean;
  baked?: boolean;
  useInstanceColors?: boolean;
  solidColor?: string;
  opacity?: number;
  castShadow?: boolean;
  surface?: 'floor'|'wall';
  cellFeet?: number;
  occluder?: boolean;
}> = ({
  instances,
  shape = 'box',
  emissive = false,
  baked = false,
  useInstanceColors = true,
  solidColor = '#ffffff',
  opacity = 1,
  castShadow = false,
  surface,
  cellFeet = 5,
  occluder = false,
}) => {
  const sightline = React.useContext(DungeonVisibilityContext);
  const indirect = React.useContext(DungeonIndirectContext);
  const renderMaterial = useMemo(() => {
    const material = surface ? createDungeonSurfaceMaterial(surface, cellFeet)
      : emissive || baked ? new THREE.MeshBasicMaterial({color:solidColor,vertexColors:false,
        transparent:opacity<1,opacity,toneMapped:false})
      : new THREE.MeshStandardMaterial({color:solidColor,vertexColors:false,
        roughness:shape==='box'?0.82:shape==='arch'?0.76:0.68,
        metalness:shape==='octahedron'?0.08:0.02,transparent:opacity<1,opacity});
    // Only foreground structure receives the cutaway. Floor, light sources,
    // characters, source collision and the untouched shadow pass remain intact.
    if (occluder && sightline) applyDungeonVisibility(material,sightline);
    if (!emissive && !baked && indirect) applyDungeonIndirectLight(material,indirect);
    return material;
  },[surface,cellFeet,emissive,baked,solidColor,opacity,shape,occluder,sightline,indirect]);
  useEffect(() => () => renderMaterial.dispose(),[renderMaterial]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const instanceColors = useMemo(() => {
    // Attach the color buffer declaratively so it exists before Three compiles the first
    // material program. Creating it later with setColorAt left some browsers on a black
    // no-instance-color shader even after the matrix batch was otherwise ready.
    const values = new Float32Array(instances.length * 3);
    const color = new THREE.Color();
    instances.forEach((instance, index) => {
      color.set(instance.color);
      // Retain seeded tint variation without painting the authored stone brown.
      if (surface) color.lerp(new THREE.Color('#c9c5b9'), 0.48);
      color.toArray(values, index * 3);
    });
    return values;
  }, [instances, surface]);

  // Populate matrices and colors only when the deterministic scene model changes. Camera motion
  // then costs no React updates and no per-object scene traversal.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const transform = new THREE.Object3D();
    instances.forEach((instance, index) => {
      transform.position.set(instance.x, instance.y, instance.z);
      transform.rotation.set(0, instance.rotation, 0);
      transform.scale.set(instance.sx, instance.sy, instance.sz);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [instances]);

  if (instances.length === 0) return null;

  // Instance colors have their own shader input. These primitives have no
  // per-vertex color attribute; enabling both inputs blackens growth and scars.
  // Keep the authored colors and existing lighting, geometry and interactions.
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, instances.length]}
      castShadow={castShadow}
      receiveShadow
      frustumCulled={false}
    >
      {useInstanceColors && <instancedBufferAttribute attach="instanceColor" args={[instanceColors, 3]} />}
      {shape === 'box' && <boxGeometry args={[1, 1, 1]} />}
      {shape === 'cylinder' && <cylinderGeometry args={[0.5, 0.5, 1, 8]} />}
      {shape === 'cone' && <coneGeometry args={[0.5, 1, 8]} />}
      {shape === 'octahedron' && <octahedronGeometry args={[0.58, 0]} />}
      {shape === 'sphere' && <sphereGeometry args={[0.5, 10, 8]} />}
      {/* A half torus is a real curved doorway head. Scaling and yaw come from DungeonPlan's
          authored door cell, so this shape adds no independent opening or collision rule. */}
      {shape === 'arch' && <torusGeometry args={[0.5, 0.11, 6, 18, Math.PI]} />}
      <primitive object={renderMaterial} attach="material" />
    </instancedMesh>
  );
};

const ColorBatchedPieces: React.FC<{
  instances: DungeonSceneInstance[];
  shape?: InstanceShape;
  baked?: boolean;
  emissive?: boolean;
  opacity?: number;
  castShadow?: boolean;
}> = ({ instances, shape = 'box', baked = false, emissive = false, opacity = 1, castShadow = false }) => {
  const batches = useMemo(() => {
    const byColor = new Map<string, DungeonSceneInstance[]>();
    for (const instance of instances) {
      const batch = byColor.get(instance.color);
      if (batch) batch.push(instance);
      else byColor.set(instance.color, [instance]);
    }
    return [...byColor.entries()];
  }, [instances]);

  // Debug overlays use one solid-color batch per room/type band. This avoids relying on the
  // fragile late-created instanceColor shader path while keeping the normal view at few draws.
  return <>{batches.map(([color, batch]) => (
    <InstancedPieces
      key={color}
      instances={batch}
      shape={shape}
      baked={baked}
      emissive={emissive}
      opacity={opacity}
      castShadow={castShadow}
      useInstanceColors={false}
      solidColor={color}
    />
  ))}</>;
};

// ============================================================================
// Debug graph and important markers
// ============================================================================
// The same graph/loop/critical toggles used by the parchment become elevated linework in 3D.
// Entrance and objective markers stay legible without covering the dungeon with room labels.
// ============================================================================

const SceneLines: React.FC<{ lines: DungeonSceneLine[]; overlays: Dungeon3DOverlays }> = ({ lines, overlays }) => {
  const visible = useMemo(() => lines.filter((line) => (
    (line.kind === 'critical' && overlays.critical)
    || (line.kind === 'loop' && overlays.loops)
    || (line.kind === 'graph' && overlays.graph)
  )), [lines, overlays.critical, overlays.graph, overlays.loops]);

  const geometry = useMemo(() => {
    const positions = new Float32Array(visible.length * 6);
    const colors = new Float32Array(visible.length * 6);
    visible.forEach((line, index) => {
      const color = new THREE.Color(line.color);
      positions.set([line.ax, 2.45, line.az, line.bx, 2.45, line.bz], index * 6);
      colors.set([color.r, color.g, color.b, color.r, color.g, color.b], index * 6);
    });
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    next.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return next;
  }, [visible]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  if (visible.length === 0) return null;
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial vertexColors transparent opacity={0.78} depthTest={false} />
    </lineSegments>
  );
};

const SceneMarker: React.FC<{ marker: DungeonSceneMarker; avoidParty?: boolean }> = ({ marker, avoidParty = false }) => (
  <group position={[marker.x, 0.08, marker.z]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.62, 0.08, 8, 32]} />
      <meshBasicMaterial color={marker.color} toneMapped={false} />
    </mesh>
    {/* Keep the known entrance ring and caption when the party stands here.
        Its inspection cone must not replace the body or cross the name label. */}
    {!avoidParty && <mesh position={[0, 0.72, 0]}>
      <coneGeometry args={[0.24, 0.62, 8]} />
      <meshBasicMaterial color={marker.color} toneMapped={false} />
    </mesh>}
    <Html style={{pointerEvents: 'none'}} zIndexRange={[0, 0]} position={[0, avoidParty ? 2.25 : 1.25, 0]} center distanceFactor={16} occlude>
      <span
        className="whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] shadow-xl"
        style={{ color: marker.color, borderColor: marker.color, background: 'rgba(5,7,10,0.86)' }}
      >
        {marker.label}
      </span>
    </Html>
  </group>
);

// The mounted expedition adds only two gameplay markers: the player's real grid position and the
// next reachable authored treasure room. Design Preview callers omit gameplay and keep their scene.
const DungeonPlayerMarker: React.FC<{position:{x:number;z:number};character?:PlayerCharacter;cellFeet:number}> = ({position,character,cellFeet}) => (
  character ? <DungeonPartyFigure character={character} position={position} cellFeet={cellFeet} /> :
  // Inspection callers without a character retain an honest position marker,
  // rather than pretending that a glowing primitive is the player's body.
  <group position={[position.x,0.025,position.z]}>
    <mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.24,0.3,24]} /><meshBasicMaterial color="#c9b88b" transparent opacity={0.7} /></mesh>
    <Html style={{pointerEvents:'none'}} zIndexRange={[0,0]} position={[0,0.4,0]} center distanceFactor={13}>
      <span data-testid="dungeon-player-marker" className="text-xs text-amber-100">You</span>
    </Html>
  </group>
);

const DungeonTreasureMarker: React.FC<{ position: { x: number; z: number } }> = ({ position }) => (
  <group position={[position.x, 0.12, position.z]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.48, 0.09, 8, 28]} />
      <meshBasicMaterial color="#fbbf24" toneMapped={false} />
    </mesh>
    <Html style={{pointerEvents: 'none'}} zIndexRange={[0, 0]} position={[0, 1.25, 0]} center distanceFactor={15} occlude>
      <span className="whitespace-nowrap rounded-full border border-amber-300 bg-amber-950/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100 shadow-xl">
        Treasure cache
      </span>
    </Html>
  </group>
);

// ============================================================================
// Camera rig
// ============================================================================
// Presets reposition the orbit camera without replacing manual control. The tactical preset
// frames the whole level, while entrance/objective presets drop close enough to inspect rooms.
// ============================================================================

const DungeonCamera: React.FC<{
  model: DungeonSceneModel;
  preset: DungeonCameraPreset;
  autoRotate: boolean;
  playerPosition?: {x: number; z: number};
  frameNonce: number;
}> = ({ model, preset, autoRotate, playerPosition, frameNonce }) => {
  const controlsRef = useRef<React.ElementRef<typeof MapControls>>(null);
  const { camera } = useThree();

  useEffect(() => {
    if(preset==='player' && playerPosition) {
      const frame=dungeonPlayerCameraFrame(model,playerPosition);
      if(!frame)return;
      camera.position.set(...frame.position);
      camera.updateProjectionMatrix();
      controlsRef.current?.target.set(...frame.target);
      controlsRef.current?.update();
      return;
    }
    const entrance = model.markers[0];
    const objective = model.markers[1];
    const tacticalFocus = {
      // Perspective enlarges the near (+x/+z) edge. A small aim bias spends the generous far
      // margin there and protects near-edge rooms from touching the bottom of the canvas.
      x: model.bounds.centerX + model.bounds.width * 0.1,
      z: model.bounds.centerZ + model.bounds.depth * 0.1,
    };
    // Product exploration follows accepted floor steps. Design presets retain
    // their existing whole-plan and room framing for inspection.
    const closeMarker = preset === 'player' && playerPosition
      ? {...playerPosition, radius: 3}
      : preset === 'entrance'
      ? entrance
      : preset === 'objective'
        ? objective
        : null;
    const focus = closeMarker ?? tacticalFocus;
    const closeRadius = closeMarker?.radius ?? 0;
    const footprintDiagonal = Math.hypot(model.bounds.width, model.bounds.depth);
    const distance = preset === 'tactical' ? footprintDiagonal * 0.57 : Math.max(9, closeRadius * 3.2);
    const height = preset === 'tactical' ? footprintDiagonal * 0.36 : Math.max(5.5, closeRadius * 1.75);

    // The footprint diagonal keeps long rotated layouts inside the perspective frame. Close
    // presets still derive their distance from the named room, not an unrelated global span.
    camera.position.set(focus.x + distance * 0.62, height, focus.z + distance * 0.76);
    camera.updateProjectionMatrix();
    controlsRef.current?.target.set(
      focus.x,
      preset === 'tactical' ? -footprintDiagonal * 0.06 : 0.45,
      focus.z,
    );
    controlsRef.current?.update();
  }, [camera, model, preset, playerPosition?.x, playerPosition?.z, frameNonce]);

  return (
    <MapControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={Math.max(40, Math.max(model.bounds.width, model.bounds.depth) * 1.7)}
      minPolarAngle={0.18}
      maxPolarAngle={Math.PI / 2.05}
      autoRotate={autoRotate}
      autoRotateSpeed={0.35}
      screenSpacePanning={false}
    />
  );
};

// ============================================================================
// Camera-aware prop hierarchy
// ============================================================================
// Every generated prop remains in the scene model. Tactical views show room-defining objects,
// history evidence, and lights; entrance/objective views restore minor dressing for inspection.
// This is presentation-level detail control only and never edits the deterministic dungeon plan.
// ============================================================================

interface VisibleDungeonProps {
  low: DungeonSceneInstance[];
  tall: DungeonSceneInstance[];
  evidence: DungeonSceneInstance[];
  flames: DungeonSceneInstance[];
  boxes: DungeonSceneInstance[];
  cylinders: DungeonSceneInstance[];
  cones: DungeonSceneInstance[];
  spheres: DungeonSceneInstance[];
  octahedrons: DungeonSceneInstance[];
  semanticFlames: DungeonSceneInstance[];
  visibleCount: number;
  totalCount: number;
}

function selectVisibleDungeonProps(model: DungeonSceneModel, preset: DungeonCameraPreset): VisibleDungeonProps {
  const keep = (instance: DungeonSceneInstance) => preset !== 'tactical' || instance.detail !== true;
  // Flame parts can be offset slightly from the source prop (for example two candles on one
  // tray), so match the nearest bounded accent light instead of requiring identical coordinates.
  const ownsAccentLight = (instance: DungeonSceneInstance) => model.lights.some((light) => (
    ((light.x - instance.x) ** 2) + ((light.z - instance.z) ** 2) < 0.04
  ));
  const low = model.lowProps.filter(keep);
  const tall = model.tallProps.filter(keep);
  const evidence = model.evidence.filter(keep);
  const flames = preset === 'tactical'
    ? model.flames.filter((flame) => model.lights.some((light) => light.x === flame.x && light.z === flame.z))
    : model.flames;

  // The semantic arrays contain composed primitive parts rather than one generic shape per
  // prop. They remain grouped into six instanced batches, so richer silhouettes do not create
  // one React object or draw call per generated decoration.
  const boxes = model.propBoxes.filter(keep);
  const cylinders = model.propCylinders.filter(keep);
  const cones = model.propCones.filter(keep);
  const spheres = model.propSpheres.filter(keep);
  const octahedrons = model.propOctahedrons.filter(keep);
  const semanticFlames = preset === 'tactical'
    ? model.propFlames.filter(ownsAccentLight)
    : model.propFlames;

  // Tactical views show only flames that own one of the strict ten accent lights. Close views
  // restore every generated torch/candle, and the HUD reports both counts honestly.
  return {
    low,
    tall,
    evidence,
    flames,
    boxes,
    cylinders,
    cones,
    spheres,
    octahedrons,
    semanticFlames,
    visibleCount: low.length + tall.length + evidence.length + flames.length,
    totalCount: model.lowProps.length + model.tallProps.length + model.evidence.length + model.flames.length,
  };
}

// ============================================================================
// Atmospheric ground
// ============================================================================
// A single flat quad the color of the void read as an unfinished placeholder slab. This ground
// instead paints a procedural radial stone wash: a dim quarried floor directly beneath the
// dungeon that falls off smoothly to the theme's darkness at the rim, so the level sits in
// atmospheric gloom with no visible hard edge. The texture is deterministic per theme palette,
// carries a faint mottled grain, and is disposed with the component. It adds one draw call.
// ============================================================================

const AtmosphericGround: React.FC<{ model: DungeonSceneModel }> = ({ model }) => {
  const texture = useMemo(() => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Center is a dim quarried stone (fog tinted toward floor, then darkened); the rim resolves
    // to the pure background so the plane edge and the fog color are the same, hiding the seam.
    const center = new THREE.Color(model.palette.fog)
      .lerp(new THREE.Color(model.palette.floor), 0.45)
      .multiplyScalar(0.5);
    const mid = new THREE.Color(model.palette.fog).multiplyScalar(0.62);
    const rim = new THREE.Color(model.palette.background);

    const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.03, size / 2, size / 2, size * 0.5);
    gradient.addColorStop(0, `#${center.getHexString()}`);
    gradient.addColorStop(0.5, `#${mid.getHexString()}`);
    gradient.addColorStop(1, `#${rim.getHexString()}`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // A little mottled grain, densest at the center, keeps the ground reading as worn stone
    // rather than a smooth vignette wash while never competing with the dungeon for attention.
    for (let i = 0; i < 2800; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const dx = (x - size / 2) / (size / 2);
      const dy = (y - size / 2) / (size / 2);
      const falloff = Math.max(0, 1 - Math.hypot(dx, dy));
      const alpha = Math.random() * 0.06 * falloff;
      ctx.fillStyle = Math.random() > 0.5 ? `rgba(228,214,190,${alpha})` : `rgba(0,0,0,${alpha * 1.5})`;
      ctx.fillRect(x, y, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [model.palette.background, model.palette.floor, model.palette.fog]);

  useEffect(() => () => texture?.dispose(), [texture]);

  // The plane is large enough that its rim is well past the carved footprint and already faded to
  // background, so the tactical camera never frames a straight black edge.
  const span = Math.max(model.bounds.width, model.bounds.depth) * 2.6;
  return (
    <mesh position={[model.bounds.centerX, -0.14, model.bounds.centerZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[span, span]} />
      {texture
        ? <meshStandardMaterial map={texture} roughness={1} metalness={0} />
        : <meshStandardMaterial color={model.palette.background} roughness={1} />}
    </mesh>
  );
};

// ============================================================================
// Complete scene
// ============================================================================
// Limited accent lights are selected by the pure model. The remaining form comes from baked
// instance colors plus two broad non-shadowing lights, matching the dungeon spec's restrained
// lighting budget and avoiding a shadow map per torch.
// ============================================================================

const DungeonScene: React.FC<{
  plan: DungeonPlan;
  clearSightline: boolean;
  softLighting: boolean;
  model: DungeonSceneModel;
  /** The plan's theme, used only to select this scene's lighting recipe. */
  theme: DungeonTheme;
  overlays: Dungeon3DOverlays;
  preset: DungeonCameraPreset;
  autoRotate: boolean;
  frameNonce: number;
  visibleProps: VisibleDungeonProps;
  readyOwner: symbol;
  playerPosition?: { x: number; z: number };
  playerCharacter?: PlayerCharacter;
  cellFeet: number;
  treasurePosition?: { x: number; z: number };
  showPreviewObjective: boolean;
  creatureActors?: readonly DungeonCreatureActor[];
}> = ({
  plan,
  clearSightline,
  softLighting,
  model,
  theme,
  overlays,
  preset,
  autoRotate,
  frameNonce,
  visibleProps,
  readyOwner,
  playerPosition,
  playerCharacter,
  cellFeet,
  treasurePosition,
  showPreviewObjective,
  creatureActors,
}) => {
  const masonry = theme === 'crypt' || theme === 'sewer';
  const sightline = useMemo(()=>createDungeonVisibilityUniforms(),[]);
  const indirect = useMemo(()=>createDungeonIndirectLight(plan),[plan,model]);
  useEffect(()=>()=>indirect.dispose(),[indirect]);
  const sightTarget = useMemo(() => new THREE.Vector3(),[]);
  useFrame(({camera}) => {
    sightline.dungeonSightEnabled.value = playerPosition && clearSightline ? 1 : 0;
    indirect.uniforms.dungeonBounceStrength.value = softLighting ? 0.65 : 0;
    if (playerPosition) sightline.dungeonSightTarget.value.copy(
      sightTarget.set(playerPosition.x,0.65,playerPosition.z).applyMatrix4(camera.matrixWorldInverse));
  });
  // Junction paving shares the constructed floor's authored stone. Separate
  // batches retain each source part while ordinary furniture keeps its material.
  const pavingProps = useMemo(() => {
    const isPaving = (part: DungeonSceneInstance) => part.purposeLandmark === true && part.roomPurpose === 'junction';
    return {
      boxes: visibleProps.boxes.filter(part => !isPaving(part)),
      cylinders: visibleProps.cylinders.filter(part => !isPaving(part)),
      pavingBoxes: visibleProps.boxes.filter(isPaving),
      pavingCylinders: visibleProps.cylinders.filter(isPaving),
    };
  }, [visibleProps]);

  const readyFrames = useRef(0);
  // Per-theme lighting recipe. Before this lookup all five themes shared one hardcoded
  // ambient/hemisphere/sun/torch budget, so crypt, cavern, and frost differed only in hue.
  const lighting = dungeonThemeLighting(theme);
  const activeLights = useMemo(() => playerPosition ? dungeonPlayerAccentLights(model, playerPosition) : model.lights, [model, playerPosition]);
  const fogDensity = 0.46 / Math.max(model.bounds.width, model.bounds.depth);

  // A seed, theme, or overlay rebuild invalidates the previous canvas proof. Reset both the
  // local frame counter and public probe together; the next three real render frames restore
  // readiness without a timer or a stale flag from the previous dungeon.
  useEffect(() => {
    readyFrames.current = 0;
    const probeWindow = window as SceneProbeWindow;
    if (probeWindow.__dungeon3dReadyOwner === readyOwner) probeWindow.__dungeon3dReady = false;
  }, [model, readyOwner]);

  // Publish a deterministic readiness flag after the renderer has produced multiple frames.
  // Browser verification can then distinguish a mounted canvas from a genuinely drawn scene.
  useFrame(() => {
    if (readyFrames.current < 3) readyFrames.current += 1;
    const probeWindow = window as SceneProbeWindow;
    if (readyFrames.current === 3 && probeWindow.__dungeon3dReadyOwner === readyOwner) {
      probeWindow.__dungeon3dReady = true;
    }
  });

  return (
      <DungeonVisibilityContext.Provider value={sightline}>
      <DungeonIndirectContext.Provider value={indirect}>
      <DungeonIndirectLighting light={indirect} sightline={sightline} playerPosition={playerPosition} />
      <color attach="background" args={[model.palette.background]} />
      {/* Scale fog to the generated footprint. A fixed cave-like density hid an entire
          large dungeon from the tactical camera even though close rooms looked correct. A modest
          multiplier deepens the crypt gloom and swallows the atmospheric ground's outer rim. */}
      <fogExp2 attach="fog" args={[model.palette.fog, fogDensity * lighting.fogMultiplier]} />
      {/* Moody-but-readable budget: a low cold ambient plus a soft cool hemisphere establish a
          legible base for the whole plan, a gentle warm key gives walls and props form, and the
          torch point lights are boosted so they pool warm light across the now-lit floor. The old
          values flattened everything to bright uniform tan and let the accent torches vanish. */}
      <ambientLight color={model.palette.ambient} intensity={lighting.ambientIntensity} />
      <hemisphereLight args={[model.palette.ambient, model.palette.background, lighting.hemisphereIntensity]} />
      <directionalLight color={model.palette.sun} intensity={lighting.sunIntensity} position={[24, 38, 16]} />
      {/* Every shadow-casting point light costs six extra full scene passes. All ten torches
          casting put a 28-room crypt at 5,267 draw calls and 13.6M triangles per frame; only the
          leading few torches contribute perceptible contact shadowing, so the shadow pass is now
          budgeted per theme while the light count, positions, and colours are unchanged. */}
      {activeLights.map((light, index) => (
        <pointLight
          key={`${light.x}:${light.z}:${index}`}
          userData={{dungeonFixedLight:true}}
          position={[light.x, light.y, light.z]}
          color={light.color}
          // Tone-mapped bodies and masonry share the same nearby fixtures. Keep
          // their source positions/ranges while avoiding a clipped orange wash.
          intensity={lighting.torchIntensity * 0.18}
          distance={lighting.torchDistance}
          decay={2}
          castShadow={index < lighting.shadowCasters}
          shadow-mapSize={[512, 512]}
          shadow-bias={-0.0006}
          // normalBias offsets the shadow lookup along the surface normal, the
          // term that scales with the grazing angle a torch makes against a wall
          // a foot away. Constant bias alone cannot cover both that and a contact
          // shadow without detaching one of them; it is kept for the flat cases.
          // Added with wall casting above — before it, nothing large and
          // near-tangent was in the shadow pass at all.
          shadow-normalBias={0.035}
          shadow-near={0.1}
          // Was a flat 20 while the light itself dies at `distance` (9-12 by
          // theme). The extra range spent 512-px cube-map depth precision on
          // space no torch reaches; tracking the light keeps precision where the
          // shadow actually is.
          shadow-far={lighting.torchDistance + 1}
        />
      ))}

      {/* A procedural radial stone wash replaces the former hard-edged black slab, letting the
          dungeon sit in atmospheric gloom instead of a void with a visible rectangle. */}
      <AtmosphericGround model={model} />

      {/* Floors and walls now light per instance so torches pool warm light across the stone and
          the baked room/corridor color split plus per-cell noise reads as real material variety.
          Debug overlays keep their flat baked banding for unambiguous inspection. */}
      {overlays.rooms || overlays.heatmap || overlays.critical ? (
        <ColorBatchedPieces instances={model.floors} baked />
      ) : (
        <InstancedPieces instances={model.floors} useInstanceColors surface={masonry ? 'floor' : undefined} cellFeet={cellFeet} />
      )}
      {/* Walls cast (2026-09-09, agora-75ed.1). Every torch is a bounded shadow-
          casting point light, but the walls — the only real occluders a dungeon
          has — were absent from the shadow pass, so torchlight crossed five feet
          of solid stone and lit the floor of the next room. Props, architecture
          and doors already cast; walls are ONE instanced mesh, so this adds one
          draw per cube face per casting torch, not one per wall.
          Wall CAPS deliberately still do not cast: they are 0.07-unit lids
          sitting on top of walls that already block, so they doubled the added
          triangle cost (crypt tactical +0.97M -> +0.48M) for no occlusion a
          floor-level torch can see. */}
      <InstancedPieces occluder instances={model.walls} useInstanceColors castShadow surface={masonry ? 'wall' : undefined} cellFeet={cellFeet} />
      <InstancedPieces occluder instances={model.wallCaps} useInstanceColors surface={masonry ? 'floor' : undefined} cellFeet={cellFeet} />
      {/* Architecture remains visible when the optional prop overlay is hidden. These bounded
          batches are raised from real wall/door cells: rotated supports for crypts, curved rock
          masses for caverns, ice spires for frost, and one true half-ring per authored doorway. */}
      {/* These six batches use the per-instance color buffer rather than ColorBatchedPieces.
          WHY: architecture colours are mixed with continuous coordinate noise, so grouping by
          exact hex produced one single-instance draw per piece — a frost plan reached 110
          instanced meshes and thousands of calls per frame. The declarative instanceColor path
          (the same one floors and walls already use) keeps identical shading at one draw per
          shape. Debug overlays keep ColorBatchedPieces, where the colours really are banded. */}
      <InstancedPieces occluder instances={model.architectureBoxes} shape="box" castShadow useInstanceColors />
      <InstancedPieces occluder instances={model.architectureCylinders} shape="cylinder" castShadow useInstanceColors />
      <InstancedPieces occluder instances={model.architectureCones} shape="cone" castShadow useInstanceColors />
      <InstancedPieces occluder instances={model.architectureSpheres} shape="sphere" castShadow useInstanceColors />
      <InstancedPieces occluder instances={model.architectureOctahedrons} shape="octahedron" castShadow useInstanceColors />
      <InstancedPieces occluder instances={model.arches} shape="arch" castShadow useInstanceColors />
      {/* Suspended theme atmosphere: cavern spores, frost snow, crypt dust. One unlit instanced
          batch; the motes carry their own theme colour so no per-theme branch lives here. */}
      <InstancedPieces
        instances={model.themeMotes}
        shape="sphere"
        emissive
        opacity={0.62}
        useInstanceColors
      />
      <ColorBatchedPieces instances={model.liquids} opacity={0.72} />
      {/* Growth and old scars respond to the same light as the floor; color is not luminescence. */}
      <InstancedPieces instances={model.solidSurfaces} />
      <InstancedPieces
        occluder
        instances={model.doors.filter((door) => door.state === 'door')}
        useInstanceColors={false}
        solidColor="#7b5134"
        castShadow
      />
      <InstancedPieces
        occluder
        instances={model.doors.filter((door) => door.state === 'bricked')}
        useInstanceColors={false}
        solidColor="#8a4739"
        castShadow
      />
      {overlays.secrets && (
        <InstancedPieces
          occluder
          instances={model.doors.filter((door) => door.state === 'secret')}
          useInstanceColors={false}
          solidColor={model.palette.wallCap}
          castShadow
        />
      )}
      {overlays.props && (
        <>
          {/* Furniture, natural growth, treasure, traps, and historical scars now keep their
              generated meaning through composed silhouettes. Six bounded batches replace the
              former low/tall/evidence placeholders without changing the DungeonPlan. */}
          <ColorBatchedPieces instances={pavingProps.boxes} shape="box" castShadow />
          <InstancedPieces instances={pavingProps.pavingBoxes} shape="box" surface={masonry ? 'floor' : undefined} cellFeet={cellFeet} />
          <ColorBatchedPieces instances={pavingProps.cylinders} shape="cylinder" castShadow />
          <InstancedPieces instances={pavingProps.pavingCylinders} shape="cylinder" surface={masonry ? 'floor' : undefined} cellFeet={cellFeet} />
          <ColorBatchedPieces instances={visibleProps.cones} shape="cone" castShadow />
          <ColorBatchedPieces instances={visibleProps.spheres} shape="sphere" castShadow />
          <ColorBatchedPieces instances={visibleProps.octahedrons} shape="octahedron" baked />
          <InstancedPieces instances={visibleProps.semanticFlames} shape="sphere" emissive useInstanceColors={false} solidColor={model.palette.flame} />
        </>
      )}
      {overlays.spawns && creatureActors === undefined && (
        <>
          {/* Floor halos make encounter locations readable at tactical range; cones preserve
              vertical position in close views. Both layers are instanced, not per-spawn meshes. */}
          <ColorBatchedPieces instances={model.spawnHalos} shape="cylinder" emissive opacity={0.58} />
          <ColorBatchedPieces instances={model.spawns} shape="cone" emissive opacity={0.96} />
        </>
      )}
      {/* Gameplay depicts only currently visible, uncleared source inhabitants.
          The design preview retains its full-plan inspection cones. */}
      <group userData={{dungeonDynamic:true}}>{creatureActors?.map(actor => <DungeonCreatureFigure key={actor.eventId} actor={actor} cellFeet={cellFeet} />)}</group>
      <SceneLines lines={model.lines} overlays={overlays} />
      {/* Generated objective waypoints belong to the design preview. The expedition keeps its
          real entrance marker, while the existing capture switch can still hide all markers. */}
      {(window as unknown as { __dungeon3dMarkers?: boolean }).__dungeon3dMarkers !== false
        && model.markers
          // The generated boss waypoint is a preview aid, not learned expedition knowledge.
          // Keep source encounter markers and the real entrance; neither geometry nor threats change.
          .filter((marker) => showPreviewObjective || marker.label !== 'Objective')
          .map((marker) => <SceneMarker key={marker.label} marker={marker}
            avoidParty={!showPreviewObjective && Boolean(playerPosition
              && Math.hypot(marker.x - playerPosition.x, marker.z - playerPosition.z) < 1.2)} />)}
      {treasurePosition ? <DungeonTreasureMarker position={treasurePosition} /> : null}
      {playerPosition ? <group userData={{dungeonDynamic:true}}><DungeonPlayerMarker position={playerPosition} character={playerCharacter} cellFeet={cellFeet} /></group> : null}
      <DungeonCamera model={model} preset={preset} autoRotate={autoRotate} playerPosition={playerPosition} frameNonce={frameNonce} />
    </DungeonIndirectContext.Provider>
    </DungeonVisibilityContext.Provider>
  );
};

// ============================================================================
// Post-processing stack — N8AO + Bloom + tone mapping + Vignette (dark dungeon)
// ============================================================================
// Copy of the BattleMap3D pattern (see FINDINGS works: use N8AO, not SSAO —
// N8AO reconstructs normals from depth and needs no NormalPass, sidestepping
// the WebGL2 depth-stencil GL_INVALID_OPERATION). ToneMapping MUST be in the
// stack: while an EffectComposer is mounted it sets gl.toneMapping =
// NoToneMapping, which would otherwise silently drop ACES and read as "raw
// 3D". Every dungeon is underground, so this uses the dark-biome profile.
// SETTLED 2026-09-09 (agora-75ed.1), replacing the 2026-08-03 NOTE that asked a
// vision-capable critic to re-measure the inherited battle-map aoRadius of 1.8.
// MEASURED: on the crypt entrance preset (seed 20260730) the old settings moved
// 1.3% of the frame; the AO was doing almost nothing at either dungeon camera.
// WHY it could not work: aoRadius is a WORLD-unit radius, but this preview has
// two fixed presets at very different ranges — entrance sits ~9-18 units out,
// tactical ~0.57 x the footprint diagonal (55+ units on a 28-room crypt). One
// world radius cannot serve both: tuned for the entrance it vanishes at
// tactical, tuned for tactical it smears at the entrance. The fix is therefore
// NOT a better number but a different unit — screenSpaceRadius reinterprets
// aoRadius as PIXELS, which is scale-free across both presets. The desktop
// player view uses a narrower contact band so shading does not bury the masonry.
// depthAwareUpsampling keeps halfRes (and its cost) while stopping the half-res
// AO from bleeding across wall silhouettes. quality "medium" raises the sample
// count from the "performance" preset, which was visibly under-sampled once the
// radius actually covered geometry.
// ============================================================================
const PostProcessingStack: React.FC = () => (
  <EffectComposer>
    <N8AO
      halfRes
      depthAwareUpsampling
      screenSpaceRadius
      quality="medium"
      aoRadius={16}
      distanceFalloff={1}
      intensity={1.25}
    />
    <Bloom
      mipmapBlur
      luminanceThreshold={1}
      luminanceSmoothing={0.25}
      intensity={0.3}
    />
    <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    <Vignette
      offset={0.3}
      darkness={0.3}
      blendFunction={BlendFunction.NORMAL}
    />
  </EffectComposer>
);

// ============================================================================
// Frame profiler dev hook (development inspection only)
// ============================================================================
// Exposes window.__dungeonProfile so an external, repeatable profiling script can
// measure real per-frame cost, draw calls, triangles, and instance counts for the
// live scene. It renders nothing and holds no generation state; removing it changes
// no dungeon output. The renderer, scene, and camera are read through useThree so
// the harness never needs to reach into React Three Fiber internals.
// See tools/dungeon-profile/ for the harness and the committed budget/results.
// ============================================================================

interface DungeonProfileWindow extends Window {
  __dungeonProfile?: {
    start: () => void;
    stop: () => DungeonProfileResult;
    result: () => DungeonProfileResult;
    instanceSummary: () => DungeonInstanceSummary;
    benchRender: (iterations: number, maxMs?: number) => { iterations: number; msPerFrame: number; totalMs: number };
    renderInfo: () => { calls: number; triangles: number; points: number; lines: number };
    memoryInfo: () => { geometries: number; textures: number };
  };
}

interface DungeonProfileResult {
  frames: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  min: number | null;
  max: number | null;
  mean: number | null;
  render: { calls: number; triangles: number; points: number; lines: number };
  memory: { geometries: number; textures: number };
  programs: number | null;
  instances: DungeonInstanceSummary;
}

interface DungeonInstanceSummary {
  meshes: number;
  instancedMeshes: number;
  totalInstances: number;
  lineSegments: number;
  points: number;
}

const FrameProfiler: React.FC = () => {
  const { gl, scene, camera } = useThree();
  const recording = useRef<{ on: boolean; times: number[] }>({ on: false, times: [] });
  const last = useRef(performance.now());

  useFrame(() => {
    const now = performance.now();
    const dt = now - last.current;
    last.current = now;
    if (recording.current.on) recording.current.times.push(dt);
  });

  useEffect(() => {
    const pctl = (sorted: number[], p: number): number | null =>
      sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : null;

    const instanceSummary = (): DungeonInstanceSummary => {
      let meshes = 0;
      let instancedMeshes = 0;
      let totalInstances = 0;
      let lineSegments = 0;
      let points = 0;
      scene.traverse((object) => {
        const obj = object as THREE.Object3D & { isInstancedMesh?: boolean; isMesh?: boolean; isLineSegments?: boolean; isPoints?: boolean; count?: number };
        if (obj.isInstancedMesh) { instancedMeshes += 1; totalInstances += obj.count ?? 0; }
        else if (obj.isMesh) meshes += 1;
        else if (obj.isLineSegments) lineSegments += 1;
        else if (obj.isPoints) points += 1;
      });
      return { meshes, instancedMeshes, totalInstances, lineSegments, points };
    };

    const result = (): DungeonProfileResult => {
      const times = recording.current.times.slice();
      const sorted = [...times].sort((a, b) => a - b);
      const sum = times.reduce((a, b) => a + b, 0);
      const r = gl.info.render;
      const m = gl.info.memory;
      return {
        frames: times.length,
        p50: pctl(sorted, 0.5),
        p95: pctl(sorted, 0.95),
        p99: pctl(sorted, 0.99),
        min: sorted.length ? sorted[0] : null,
        max: sorted.length ? sorted[sorted.length - 1] : null,
        mean: times.length ? sum / times.length : null,
        render: { calls: r.calls, triangles: r.triangles, points: r.points, lines: r.lines },
        memory: { geometries: m.geometries, textures: m.textures },
        programs: gl.info.programs ? gl.info.programs.length : null,
        instances: instanceSummary(),
      };
    };

    const api = {
      start: () => { recording.current = { on: true, times: [] }; },
      stop: () => { recording.current.on = false; return result(); },
      result,
      instanceSummary,
      // True render cost, unbounded by vsync. Each frame is rendered and then a
      // 1x1 readPixels forces the WHOLE pipeline to complete before the next frame.
      // finish() alone is not enough: on deferred / software (SwiftShader) backends
      // nothing consumes the framebuffer, so fragment rasterization is elided and
      // the loop reports a fictitious sub-millisecond cost. A synchronous readback
      // stalls until every fragment is actually shaded, making the number portable
      // and conservative across GPU and no-GPU backends alike.
      benchRender: (iterations: number, maxMs = 4000) => {
        const rawGl = gl.getContext();
        const pixel = new Uint8Array(4);
        const drainFrame = () => {
          gl.render(scene, camera);
          // Bind the default framebuffer (gl.render leaves its own target bound) and
          // read one pixel to force completion of all preceding raster work.
          rawGl.bindFramebuffer(rawGl.FRAMEBUFFER, null);
          rawGl.readPixels(0, 0, 1, 1, rawGl.RGBA, rawGl.UNSIGNED_BYTE, pixel);
        };
        // Warm up so shader compilation is not billed to the first timed frame.
        drainFrame();
        const t0 = performance.now();
        let ran = 0;
        // Stop at the iteration count or the time cap, whichever comes first. Fast
        // GPU backends complete every iteration; a slow software backend still
        // yields a stable mean from the frames it manages inside the cap.
        while (ran < iterations && performance.now() - t0 < maxMs) {
          drainFrame();
          ran += 1;
        }
        const totalMs = performance.now() - t0;
        return { iterations: ran, msPerFrame: totalMs / Math.max(1, ran), totalMs };
      },
      renderInfo: () => ({ ...gl.info.render }),
      memoryInfo: () => ({ ...gl.info.memory }),
    };

    (window as DungeonProfileWindow).__dungeonProfile = api;
    return () => {
      if ((window as DungeonProfileWindow).__dungeonProfile === api) {
        delete (window as DungeonProfileWindow).__dungeonProfile;
      }
    };
  }, [gl, scene, camera]);

  return null;
};

// ============================================================================
// Preview chrome and fullscreen behavior
// ============================================================================
// The wrapper owns only presentation controls. Generator controls stay in PreviewDungeon so a
// seed/theme/history change updates the parchment and 3D view together.
// ============================================================================

export const Dungeon3DPreview: React.FC<Dungeon3DPreviewProps> = ({ plan, overlays, gameplay }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  // A short-lived outgoing Design Preview instance must not clear readiness for the incoming
  // canvas. Ownership keeps the public flag tied to whichever preview mounted most recently.
  const readyOwnerRef = useRef(Symbol('dungeon-3d-ready'));
  const [preset, setPreset] = useState<DungeonCameraPreset>(gameplay ? 'player' : 'tactical');
  const [clearSightline,setClearSightline] = useState(true);
  const [softLighting,setSoftLighting] = useState(true);
  // A repeated preset click restores framing after the player manually orbits.
  const [cameraFrameNonce, setCameraFrameNonce] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [playerCell, setPlayerCell] = useState<Cell>(() => (
    gameplay?.initialPlayerCell ?? dungeonEntrancePlayerCell(plan)
  ));
  const arrivalOwner = useRef<{identity?: string; cell?: Cell} | null>(null);
  const [lastClaimedTreasureId, setLastClaimedTreasureId] = useState<string | null>(null);
  const [lastClearedEncounterId, setLastClearedEncounterId] = useState<string | null>(null);
  const [startingEncounter, setStartingEncounter] = useState(false);
  const [encounterError, setEncounterError] = useState<string | null>(null);
  const encounterStartRef = useRef(false);
  const claimedTreasureIds = gameplay?.claimedTreasureIds ?? NO_CLAIMED_TREASURE;
  const clearedEncounterIds = gameplay?.clearedEncounterIds ?? NO_CLEARED_ENCOUNTERS;
  const discoveredCellKeys = gameplay?.discoveredCellKeys ?? NO_DISCOVERED_CELLS;
  const objectFindings = gameplay?.objectFindings ?? NO_OBJECT_FINDINGS;
  const nearbyObjects = gameplay?.onObjectInteraction
    ? nearbyDungeonObjects(plan,gameplay.identity,playerCell,discoveredCellKeys,{claimedTreasureIds,clearedEncounterIds}) : [];
  // Keep model inputs stable when only footing or unrelated field notes change.
  const hiddenKey = gameplay ? plan.props.flatMap((prop,index) =>
    prop.kind === 'dropped-coins' && objectFindings[dungeonObjectId(gameplay.identity,index)] === 'collected' ? [index] : []).join(',') : '';
  const hiddenPropIndices = useMemo(() => hiddenKey ? hiddenKey.split(',').map(Number) : [],[hiddenKey]);
  const caches = useMemo(() => gameplay ? dungeonCaches(plan,gameplay.identity) : [],[plan,gameplay?.identity.dungeonId]);
  const knownCells = new Set(discoveredCellKeys);
  const cacheRenderKey = caches.flatMap((cache,index) => cache.existingPropIndex!==undefined || knownCells.has(cache.cell.x+','+cache.cell.y)
    ? [index+':'+(cache.plundered || claimedTreasureIds.includes(cache.id) ? 'o':'c')] : []).join('|');
  const cacheScene = useMemo(() => {
    const cacheProps: typeof plan.props = [];
    const openedChestIndices:number[] = [];
    for(const token of cacheRenderKey ? cacheRenderKey.split('|') : []) {
      const [index,open]=token.split(':');const cache=caches[Number(index)];
      const propIndex=cache.existingPropIndex??plan.props.length+cacheProps.length;
      if(cache.existingPropIndex===undefined)cacheProps.push(cache.prop);
      if(open==='o')openedChestIndices.push(propIndex);
    }
    return {cacheProps,openedChestIndices};
  },[caches,cacheRenderKey,plan.props.length]);
  // Newly observed hazard cells change only this compact model key. Ordinary
  // footsteps do not rebuild all source geometry, and concealed traps stay hidden.
  const trapKey = gameplay ? plan.traps.flatMap((trap,index) =>
    knownCells.has(Math.floor(trap.x/plan.cellFt)+','+Math.floor(trap.y/plan.cellFt)) ? [index] : []).join(',') : undefined;
  const visibleTrapIndices = useMemo(() => trapKey === undefined ? undefined :
    trapKey ? trapKey.split(',').map(Number) : [], [trapKey]);
  const model = useMemo(() => buildDungeonSceneModel(plan, {
    hiddenPropIndices,...cacheScene,visibleTrapIndices,
    showRoomTypes: overlays.rooms,
    showDifficulty: overlays.heatmap,
    showCritical: overlays.critical,
  }), [overlays.critical, overlays.heatmap, overlays.rooms, plan, hiddenPropIndices,cacheScene,visibleTrapIndices]);
  const visibleProps = useMemo(() => selectVisibleDungeonProps(model, preset), [model, preset]);
  const treasureInteraction = useMemo(() => (
    gameplay
      ? findNextDungeonTreasureInteraction(
        plan,
        gameplay.identity,
        claimedTreasureIds,
        playerCell,
      )
      : null
  ), [claimedTreasureIds, gameplay, plan, playerCell]);
  const treasurePath = useMemo(() => (
    gameplay && treasureInteraction
      ? dungeonPathToTreasureInteraction(plan, playerCell, treasureInteraction)
      : []
  ), [gameplay, plan, playerCell, treasureInteraction]);
  // Current visibility is separate from remembered parchment discovery. A
  // ranged approach keeps this exact square and starts initiative, not a free hit.
  const currentlyVisibleCellKeys = useMemo(() => revealedDungeonCellKeys(
    plan, playerCell, gameplay?.carriedTorch?.brightRadius ?? 0,
  ), [plan, playerCell, gameplay?.carriedTorch?.brightRadius]);
  const creatureActors = useMemo(() => gameplay
    ? visibleDungeonCreatures(plan,gameplay.identity,currentlyVisibleCellKeys,clearedEncounterIds)
    : undefined, [plan,gameplay?.identity,currentlyVisibleCellKeys,clearedEncounterIds]);
  const encounterInteraction = useMemo(() => (
    gameplay
      ? findNextDungeonEncounterInteraction(
        plan,
        gameplay.identity,
        clearedEncounterIds,
        playerCell,
        gameplay.onStartEncounter ? currentlyVisibleCellKeys : undefined,
      )
      : null
  ), [clearedEncounterIds, gameplay, plan, playerCell, currentlyVisibleCellKeys]);
  const encounterPath = useMemo(() => (
    gameplay && encounterInteraction
      ? dungeonPathToEncounterInteraction(plan, playerCell, encounterInteraction)
      : []
  ), [encounterInteraction, gameplay, plan, playerCell]);
  const encounterSpawn = gameplay && encounterInteraction ? plan.spawns.find(spawn =>
    dungeonEncounterEventId(gameplay.identity, spawn.roomId, dungeonSpawnCell(plan, spawn)) === encounterInteraction.eventId) : undefined;
  const encounterRisk = encounterSpawn && gameplay?.partyLevels?.length
    ? calculateDifficulty([{cr: encounterSpawn.cr, quantity: 1}], [...gameplay.partyLevels]).tier : undefined;
  const playerPosition = gameplay ? dungeonCellToScenePosition(plan, playerCell) : undefined;
  // A living source creature occupies its square. Movement cannot walk through
  // it before the real combat owner resolves that exact encounter.
  function legalPlayerStep(current: Cell, direction: DungeonMoveDirection): Cell {
    const next = moveDungeonPlayer(plan, current, direction);
    if (gameplay?.onStartEncounter && plan.spawns.some(spawn => {
      const cell = dungeonSpawnCell(plan, spawn);
      return cell.x === next.x && cell.y === next.y
        && !clearedEncounterIds.includes(dungeonEncounterEventId(gameplay.identity, spawn.roomId, cell));
    })) return current;
    return next;
  }
  // Adjacent exits use the same floor/door rule as accepted movement; no unseen
  // treasure route or distant enemy is needed to navigate a dark room.
  const openDirections = (['north', 'east', 'south', 'west'] as DungeonMoveDirection[]).filter(direction => {
    const next = legalPlayerStep(playerCell, direction);
    return next.x !== playerCell.x || next.y !== playerCell.y;
  });
  const nearbyDoors = gameplay?.onOpenDoor ? plan.doors.filter(door => door.state === 'door'
    && Math.abs(door.cell.x - playerCell.x) + Math.abs(door.cell.y - playerCell.y) === 1) : [];
  // No distant reward waypoint: the actual cache must first be observed and reached.
  const nearbyCache=nearbyObjects.find(object=>object.cache&&!object.previouslySecured&&!object.cache.plundered)?.cache;
  const treasurePosition=nearbyCache?dungeonCellToScenePosition(plan,nearbyCache.cell):undefined;
  const treasureIsClaimable = canClaimDungeonTreasure(playerCell, treasureInteraction);
  const encounterIsClearable = canClearDungeonEncounter(playerCell, encounterInteraction);
  const objective = gameplay?.objective ?? null;
  const objectiveIsReached = Boolean(
    objective
    && playerCell.x === objective.cell.x
    && playerCell.y === objective.cell.y,
  );

  // Opening a leaf changes the projected plan. Keep the accepted party square
  // through that update; only a real entry/stair arrival applies a new position.
  // Design Preview still resets when its inspection plan changes.
  useEffect(() => {
    const previous = arrivalOwner.current;
    if (gameplay && previous?.identity === gameplay.identity.dungeonId
      && previous.cell === gameplay.initialPlayerCell) return;
    arrivalOwner.current = {identity: gameplay?.identity.dungeonId, cell: gameplay?.initialPlayerCell};
    setPlayerCell(gameplay?.initialPlayerCell ?? dungeonEntrancePlayerCell(plan));
    setLastClaimedTreasureId(null);
    setLastClearedEncounterId(null);
  }, [gameplay?.identity.dungeonId, gameplay?.initialPlayerCell, plan]);

  useEffect(() => { gameplay?.onPlayerCellChange?.(playerCell); }, [gameplay?.onPlayerCellChange, playerCell]);

  useEffect(() => {
    if (!gameplay) return;
    const remembered = new Set(discoveredCellKeys);
    const newlyRevealed = currentlyVisibleCellKeys.filter(
      (cellKey) => !remembered.has(cellKey),
    );

    // Initial entry and every accepted one-cell movement ink only newly visible plan cells. A
    // blocked move produces no new key and therefore no redundant persistence action.
    if (newlyRevealed.length > 0) gameplay.onDiscoverCells(newlyRevealed);
  }, [discoveredCellKeys, gameplay, currentlyVisibleCellKeys]);

  useEffect(() => {
    const probeWindow = window as SceneProbeWindow;
    const owner = readyOwnerRef.current;
    probeWindow.__dungeon3dReadyOwner = owner;
    probeWindow.__dungeon3dReady = false;
    return () => {
      if (probeWindow.__dungeon3dReadyOwner === owner) {
        probeWindow.__dungeon3dReady = false;
        delete probeWindow.__dungeon3dReadyOwner;
      }
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await rootRef.current?.requestFullscreen();
  }, []);

  const movePlayer = useCallback((direction: DungeonMoveDirection) => {
    if (!gameplay || gameplay.paused) return;
    if (encounterStartRef.current) return;
    setPlayerCell((current) => legalPlayerStep(current, direction));
  }, [gameplay, plan, clearedEncounterIds]);

  const advanceTowardTreasure = useCallback(() => {
    // The path includes the current square first. Advancing one square keeps movement visible and
    // player-controlled while avoiding a hidden teleport to the interaction.
    const next = treasurePath[1];
    if (next) setPlayerCell(next);
  }, [treasurePath]);

  const claimTreasure = useCallback(() => {
    if (!gameplay || !treasureInteraction || !treasureIsClaimable) return;
    gameplay.onClaimTreasure(treasureInteraction.eventId);
    setLastClaimedTreasureId(treasureInteraction.eventId);
  }, [gameplay, treasureInteraction, treasureIsClaimable]);

  const advanceTowardEncounter = useCallback(() => {
    // The encounter path also includes the current square first, so advancing one square keeps the
    // approach player-controlled and visible rather than teleporting onto the monster.
    const next = encounterPath[1];
    if (next) setPlayerCell(next);
  }, [encounterPath]);

  const startEncounter = useCallback(async () => {
    if (gameplay?.paused || !gameplay?.onStartEncounter || !encounterInteraction || encounterStartRef.current) return;
    encounterStartRef.current = true;
    setStartingEncounter(true); setEncounterError(null);
    try { await gameplay.onStartEncounter(encounterInteraction.eventId, playerCell); }
    catch (error) { setEncounterError(error instanceof Error ? error.message : String(error)); }
    finally { encounterStartRef.current = false; setStartingEncounter(false); }
  }, [encounterInteraction, gameplay, playerCell]);

  const clearEncounter = useCallback(() => {
    if (!gameplay || !encounterInteraction || !encounterIsClearable) return;
    gameplay.onClearEncounter(encounterInteraction.eventId);
    setLastClearedEncounterId(encounterInteraction.eventId);
  }, [encounterInteraction, encounterIsClearable, gameplay]);

  const completeObjective = useCallback(() => {
    if (!gameplay?.onCompleteObjective || !objective || !objectiveIsReached) return;
    gameplay.onCompleteObjective(objective.id);
  }, [gameplay, objective, objectiveIsReached]);

  useEffect(() => {
    if (!gameplay || gameplay.paused) return undefined;
    const onGameplayKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Returning focus from the parchment to a normal expedition button must
      // not disable walking. Dialogs, menus and text entry still own their keys.
      if (target?.matches('input, select, textarea') || target?.isContentEditable || target?.closest('[role="dialog"], [role="menu"]')) return;
      const keyDirections: Partial<Record<string, DungeonMoveDirection>> = {
        ArrowUp: 'north',
        w: 'north',
        ArrowRight: 'east',
        d: 'east',
        ArrowDown: 'south',
        s: 'south',
        ArrowLeft: 'west',
        a: 'west',
      };
      const direction = keyDirections[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (!direction) return;
      event.preventDefault();
      movePlayer(direction);
    };

    // Arrow keys and WASD share the same one-cell movement helper as the visible direction pad.
    window.addEventListener('keydown', onGameplayKey);
    return () => window.removeEventListener('keydown', onGameplayKey);
  }, [gameplay, movePlayer]);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(document.fullscreenElement === rootRef.current);
    const onKey = (event: KeyboardEvent) => {
      if (gameplay?.paused) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, select, textarea, button')) return;
      if (event.key.toLowerCase() === 'f') void toggleFullscreen();
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('keydown', onKey);
    };
  }, [toggleFullscreen, gameplay?.paused]);

  useEffect(() => {
    const probeWindow = window as SceneProbeWindow;
    probeWindow.__dungeon3dViewState = {
      preset,
      autoRotate,
      fullscreen,
      visibleProps: visibleProps.visibleCount,
      totalProps: visibleProps.totalCount,
    };
    return () => { delete probeWindow.__dungeon3dViewState; };
  }, [autoRotate, fullscreen, preset, visibleProps.totalCount, visibleProps.visibleCount]);

  return (
    <div
      ref={rootRef}
      className={gameplay ? "relative grid h-full min-h-[400px] w-full grid-cols-[minmax(0,1fr)_360px] overflow-hidden rounded-xl border border-gray-700 bg-black shadow-2xl" : "relative h-[clamp(360px,62vh,720px)] min-h-[360px] w-full max-w-[1440px] overflow-hidden rounded-xl border border-gray-700 bg-black shadow-2xl sm:h-[clamp(500px,calc(100vh-390px),720px)] sm:min-h-[500px] fullscreen:h-screen fullscreen:max-h-none"}
      data-testid="dungeon-3d-preview"
    >
      <Canvas
        frameloop={gameplay?.paused ? 'never' : 'always'}
        className="h-full w-full"
        // Desktop controls reserve a readable 360px column; they never cover the playable scene.
        style={gameplay ? {gridArea: '1 / 1', minWidth: 0} : undefined}
        dpr={[1, 2]}
        shadows
        // near/far were 0.1/600 — a 6000:1 ratio that spends most of a 24-bit
        // depth buffer on the first unit in front of the lens. At the tactical
        // camera that left ~1.5e-3 world units of depth resolution, and several
        // dungeon surfaces are authored inside that margin (history overlays sit
        // 5e-4 above the floor slabs). No z-fighting was VISIBLE in the audit
        // captures — those pairs are either sub-pixel or hidden behind a nearer
        // face — so this is a guard, not a repair. MapControls clamps
        // minDistance to 4, so near 0.5 cannot clip; far 450 still clears the
        // widest plan plus its 2.6x atmospheric ground plane. Net: ~6.7x more
        // depth resolution everywhere.
        camera={{ fov: 46, near: 0.5, far: 450, position: [30, 34, 30] }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.35 }}
      >
        {!gameplay?.paused && <PerfProbe id="dungeon3d" label="Dungeon 3D" />}
        <DungeonScene
          plan={plan}
          clearSightline={clearSightline}
          softLighting={softLighting}
          model={model}
          theme={plan.params.theme}
          overlays={overlays}
          preset={preset}
          autoRotate={autoRotate}
          frameNonce={cameraFrameNonce}
          visibleProps={visibleProps}
          readyOwner={readyOwnerRef.current}
          playerPosition={playerPosition}
          playerCharacter={gameplay?.playerCharacter}
          cellFeet={plan.cellFt}
          treasurePosition={treasurePosition}
          showPreviewObjective={!gameplay}
          creatureActors={creatureActors}
        />
        {playerPosition && gameplay?.carriedTorch && <group userData={{dungeonDynamic:true}} position={[playerPosition.x+0.55,0.85,playerPosition.z+0.2]}>
          {/* A carried flame follows accepted footing; fixed flames and source geometry remain unchanged. */}
          <mesh><cylinderGeometry args={[0.035,0.045,0.55,6]} /><meshStandardMaterial color="#734a25" /></mesh>
          <mesh position={[0,0.34,0]}><sphereGeometry args={[0.09,8,6]} /><meshBasicMaterial color="#ffc76b" /></mesh>
          <pointLight color="#ffb55e" intensity={2.8} distance={40/plan.cellFt} decay={2} />
        </group>}
        <PostProcessingStack />
        <FrameProfiler />
      </Canvas>

      <div className="pointer-events-none absolute left-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/85 via-black/45 to-transparent p-4" style={{right: gameplay ? 360 : 0}}>
        <div>
          {!gameplay && <><div className="text-[10px] font-black uppercase tracking-[0.26em] text-amber-300">3D Expedition</div>
          <div className="mt-1 font-serif text-xl font-bold text-white">{plan.name}</div></>}
          {!gameplay && <div className="mt-0.5 text-xs text-gray-300">
            {model.floors.length} floor cells · {model.walls.length} raised walls · {model.lights.length} accent lights
            {overlays.props && ` · ${visibleProps.visibleCount}/${visibleProps.totalCount} visible props`}
          </div>}
        </div>
        <div className="rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[10px] uppercase tracking-wider text-gray-300 backdrop-blur-sm">
          Drag to pan · wheel to zoom · right-drag to orbit
        </div>
      </div>

      {gameplay ? (
        <aside
          data-testid="dungeon-gameplay-controls"
          data-player-cell={`${playerCell.x},${playerCell.y}`}
          aria-label="Expedition navigation and encounters"
          className="relative col-start-2 row-start-1 z-30 h-full min-h-0 overflow-y-auto border-l border-sky-400/25 bg-gray-950 p-5 text-sm leading-relaxed text-gray-100"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">
                Dungeon movement
              </div>
              <div data-testid="dungeon-player-cell" className="mt-1 text-sm text-gray-300">
                Arrow keys or WASD · one step at a time
              </div>
            </div>
            <div
              data-testid="dungeon-claimed-treasure-count"
              className="rounded-full border border-emerald-400/35 bg-emerald-950/60 px-2 py-1 text-xs font-bold text-emerald-200"
            >
              {discoveredCellKeys.length} squares mapped
            </div>
          </div>

          <p className="mt-2 text-sm text-stone-300">Open ways: {openDirections.length ? openDirections.join(', ') : 'none'}</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <Button type="button" size="md" className="min-w-0 px-2" aria-label="Move north" disabled={!openDirections.includes('north')} onClick={() => movePlayer('north')}>↑</Button>
            <Button type="button" size="md" className="min-w-0 px-2" aria-label="Move west" disabled={!openDirections.includes('west')} onClick={() => movePlayer('west')}>←</Button>
            <Button type="button" size="md" className="min-w-0 px-2" aria-label="Move south" disabled={!openDirections.includes('south')} onClick={() => movePlayer('south')}>↓</Button>
            <Button type="button" size="md" className="min-w-0 px-2" aria-label="Move east" disabled={!openDirections.includes('east')} onClick={() => movePlayer('east')}>→</Button>
          </div>
          {gameplay.carriedTorch && <div role="status" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-amber-200">
            Burning torch · {Math.ceil(gameplay.carriedTorch.durationRemaining)} min fuel
            <Button type="button" size="sm" disabled={startingEncounter || gameplay.paused} onClick={gameplay.onExtinguishTorch}>Extinguish torch</Button>
          </div>}
          {nearbyObjects.length > 0 && <section aria-label="Nearby objects" className="mt-2 rounded-lg border border-amber-200/25 bg-stone-950/90 p-3 text-sm">
            <details>
            <summary className="cursor-pointer text-amber-100">Nearby objects · {nearbyObjects.map(object=>object.label).join(', ')}</summary>
            {nearbyObjects.map(object => <div key={object.id} className="mb-2 last:mb-0">
              <div className="font-semibold capitalize text-amber-100">{object.label}</div>
              {objectFindings[object.id] ? <p className="my-1 text-stone-200">{objectFindings[object.id] === 'collected' ? object.collectionSummary??'Collected · one gold piece.' : object.observation}</p> : null}
              {object.previouslySecured && !objectFindings[object.id] && <p className="my-1 text-stone-300">Previously secured. No new contents remain.</p>}
              {objectFindings[object.id] === 'examined' && object.warning && <p className="my-1 text-amber-200">{object.warning}</p>}
              {!objectFindings[object.id] && !object.previouslySecured && <Button type="button" size="sm" disabled={startingEncounter || gameplay.paused} onClick={() => gameplay.onObjectInteraction?.(object.id,'examine')}>Examine {object.label}</Button>}
              {object.prop.kind==='torch' && !gameplay.carriedTorch && (gameplay.carriedTorchChoices
                ? <CarriedTorchIgnition choices={gameplay.carriedTorchChoices.map(choice=>({...choice,
                    error:gameplay.getTorchUseError?.(choice.inventoryIndex,object.id)}))}
                    disabled={startingEncounter || gameplay.paused}
                    onIgnite={inventoryIndex=>gameplay.onObjectInteraction?.(object.id,'light_torch',inventoryIndex)}/>
                : (gameplay.carriedTorchIndex??-1)>=0 && <>
                    <Button type="button" size="sm" disabled={startingEncounter || gameplay.paused} onClick={()=>gameplay.onObjectInteraction?.(object.id,'light_torch',gameplay.carriedTorchIndex)}>Light a carried torch</Button>
                    <p className="mt-1 text-amber-200">Uses one carried torch and keeps its remaining fuel. 20 ft bright + 20 ft dim.</p>
                  </>)}
              {object.collectible && objectFindings[object.id] === 'examined' && <Button type="button" size="sm" disabled={startingEncounter || gameplay.paused} onClick={() => gameplay.onObjectInteraction?.(object.id,'collect')}>{object.cache?'Open and secure cache':'Recover loose coin'}</Button>}
            </div>)}
            </details>
          </section>}
          {nearbyDoors.length > 0 && <section aria-label="Nearby doors" className="mt-3 rounded-lg border border-amber-300/30 bg-stone-900 p-2">
            <p className="text-xs text-amber-100">A closed door bars the passage.</p>
            {nearbyDoors.map(door => {
              const direction = door.cell.x > playerCell.x ? 'east' : door.cell.x < playerCell.x ? 'west' : door.cell.y > playerCell.y ? 'south' : 'north';
              return <Button key={`${door.cell.x},${door.cell.y}`} type="button" size="sm" className="mt-2 mr-2" disabled={startingEncounter} onClick={() => { if (!encounterStartRef.current) gameplay.onOpenDoor?.(door.cell, playerCell); }}>Open door {direction}</Button>;
            })}
          </section>}
          {gameplay.onStartEncounter && encounterInteraction && (
            <section aria-label="Nearby creature" className="mt-3 rounded-lg border border-rose-400/40 bg-rose-950/80 p-3">
              <h3 className="font-bold capitalize text-rose-100">{encounterInteraction.monsterKey.replace(/_/g, ' ')}</h3>
              {encounterRisk && <p className="mt-1 font-semibold text-amber-200">{encounterRisk} encounter for your current party.</p>}
              <p className="mt-1 text-sm text-stone-200">A creature is visible. Engaging begins initiative from your current square; it does not grant an attack.</p>
              <Button type="button" variant="action" size="sm" className="mt-2 w-full" disabled={startingEncounter || gameplay.paused} onClick={startEncounter}>
                {startingEncounter ? 'Preparing encounter…' : 'Engage creature'}
              </Button>
            </section>
          )}
          {encounterError && <p role="alert" className="mt-2 text-sm text-rose-200">{encounterError}</p>}
          {gameplay.developerTools && <details className="mt-3 text-xs text-stone-400">
          <summary className="cursor-pointer">Developer navigation and progress tools</summary>
          {treasureInteraction ? (
            <div className="mt-2 rounded-lg border border-amber-400/25 bg-amber-950/35 p-2 text-[11px] text-amber-100">
              <div className="font-bold">Treasure room {treasureInteraction.roomId}</div>
              <div>{Math.max(0, treasurePath.length - 1)} movement steps away</div>
              <div className="mt-1 break-all font-mono text-[9px] text-amber-300/80">
                {treasureInteraction.eventId}
              </div>
            </div>
          ) : (
            <div className="mt-2 rounded-lg border border-white/10 bg-black/35 p-2 text-[11px] text-gray-300">
              No reachable unclaimed treasure room remains. Encounters and objectives have separate rules.
            </div>
          )}

          {/* Each visible direction uses the same one-cell collision rule as keyboard movement. */}
          <div className="mt-2 grid grid-cols-[36px_36px_36px_1fr] items-center gap-1">
            <span />
            <Button type="button" variant="ghost" size="sm" aria-label="Move north" data-testid="dungeon-move-north" onClick={() => movePlayer('north')} className="h-8 px-0 text-sky-100">↑</Button>
            <span />
            <Button type="button" variant="ghost" size="sm" data-testid="dungeon-advance-treasure" disabled={treasurePath.length <= 1} onClick={advanceTowardTreasure} className="row-span-2 h-full text-xs text-amber-100">
              Advance one cell
            </Button>
            <Button type="button" variant="ghost" size="sm" aria-label="Move west" data-testid="dungeon-move-west" onClick={() => movePlayer('west')} className="h-8 px-0 text-sky-100">←</Button>
            <Button type="button" variant="ghost" size="sm" aria-label="Move south" data-testid="dungeon-move-south" onClick={() => movePlayer('south')} className="h-8 px-0 text-sky-100">↓</Button>
            <Button type="button" variant="ghost" size="sm" aria-label="Move east" data-testid="dungeon-move-east" onClick={() => movePlayer('east')} className="h-8 px-0 text-sky-100">→</Button>
          </div>

          <Button
            type="button"
            variant="action"
            size="sm"
            data-testid="dungeon-claim-treasure"
            disabled={!treasureIsClaimable}
            onClick={claimTreasure}
            className="mt-2 w-full border border-amber-400 bg-amber-700 font-black text-amber-50 disabled:border-gray-700 disabled:bg-gray-900 disabled:text-gray-500"
          >
            {treasureIsClaimable ? 'Secure treasure cache' : 'Move into the treasure room'}
          </Button>

          {lastClaimedTreasureId ? (
            <div
              role="status"
              data-testid="dungeon-claimed-treasure-id"
              className="mt-2 break-all rounded-lg border border-emerald-400/35 bg-emerald-950/60 p-2 text-[10px] text-emerald-100"
            >
              Treasure claimed and saved: {lastClaimedTreasureId}
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-2">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-300">
              Encounters
            </div>
            <div
              data-testid="dungeon-cleared-encounter-count"
              className="rounded-full border border-rose-400/35 bg-rose-950/60 px-2 py-1 text-[10px] font-bold text-rose-200"
            >
              {clearedEncounterIds.length} cleared
            </div>
          </div>

          {encounterInteraction ? (
            <div className="mt-2 rounded-lg border border-rose-400/25 bg-rose-950/35 p-2 text-[11px] text-rose-100">
              <div className="font-bold">{encounterInteraction.monsterKey} · room {encounterInteraction.roomId}</div>
              <div>{Math.max(0, encounterPath.length - 1)} movement steps away</div>
              <div className="mt-1 break-all font-mono text-[9px] text-rose-300/80">
                {encounterInteraction.eventId}
              </div>
              <div className="mt-2 flex gap-1">
                <Button type="button" variant="ghost" size="sm" data-testid="dungeon-advance-encounter" disabled={encounterPath.length <= 1} onClick={advanceTowardEncounter} className="flex-1 text-xs text-rose-100">
                  Advance one cell
                </Button>
                <Button
                  type="button"
                  variant="action"
                  size="sm"
                  data-testid="dungeon-clear-encounter"
                  disabled={!encounterIsClearable}
                  onClick={clearEncounter}
                  className="flex-1 border border-rose-400 bg-rose-700 font-black text-rose-50 disabled:border-gray-700 disabled:bg-gray-900 disabled:text-gray-500"
                >
                  {encounterIsClearable ? 'Mark encounter cleared (test)' : 'Move onto it'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 rounded-lg border border-white/10 bg-black/35 p-2 text-[11px] text-gray-300">
              No reachable active encounter remains on this level.
            </div>
          )}

          {lastClearedEncounterId ? (
            <div
              role="status"
              data-testid="dungeon-cleared-encounter-id"
              className="mt-2 break-all rounded-lg border border-rose-400/35 bg-rose-950/60 p-2 text-[10px] text-rose-100"
            >
              Encounter cleared and saved: {lastClearedEncounterId}
            </div>
          ) : null}

          {objective ? (
            <Button
              type="button"
              variant="action"
              size="sm"
              data-testid="dungeon-complete-objective"
              disabled={!objectiveIsReached}
              onClick={completeObjective}
              className="mt-3 w-full border border-fuchsia-400 bg-fuchsia-800 font-black text-fuchsia-50 disabled:border-gray-700 disabled:bg-gray-900 disabled:text-gray-500"
            >
              {objectiveIsReached ? 'Mark objective complete (test)' : 'Reach the boss objective'}
            </Button>
          ) : null}
          </details>}
        </aside>
      ) : null}

      <div className={gameplay ? "absolute bottom-4 left-0 right-[360px] z-20 mx-auto flex w-fit items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-gray-950/90 p-1.5 shadow-xl" : "absolute bottom-4 left-1/2 z-20 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-gray-950/82 p-1.5 shadow-xl backdrop-blur-md"}>
        {((gameplay ? ['player', 'entrance'] : ['tactical', 'entrance', 'objective']) as DungeonCameraPreset[]).map((option) => (
          <Button
            key={option}
            type="button"
            variant="ghost"
            size="sm"
            data-testid={`dungeon-camera-${option}`}
            onClick={() => { setPreset(option); setCameraFrameNonce(value => value + 1); }}
            style={preset === option ? {background: '#f59e0b', color: '#111827'} : undefined}
            className={`h-9 rounded-lg px-3 text-sm font-bold capitalize transition ${preset === option ? 'bg-amber-500 text-gray-950' : 'text-gray-300 hover:bg-white/10'}`}
          >
            {option === 'player' ? 'Follow me' : option}
          </Button>
        ))}
        {gameplay && <>
          <Button type="button" variant="ghost" size="sm" aria-pressed={clearSightline}
            onClick={()=>setClearSightline(value=>!value)} title="Keep foreground walls from hiding your character"
            className={clearSightline?'text-sky-200':'text-gray-400'}>Keep party visible</Button>
          <Button type="button" variant="ghost" size="sm" aria-pressed={softLighting}
            onClick={()=>setSoftLighting(value=>!value)} title="Show soft light reflected from fixed dungeon fixtures"
            className={softLighting?'text-sky-200':'text-gray-400'}>Soft lighting</Button>
        </>}
        <span className="mx-0.5 h-5 w-px bg-white/15" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="dungeon-camera-orbit"
          onClick={() => setAutoRotate((value) => !value)}
          className={`h-8 rounded-lg px-3 text-xs font-bold transition ${autoRotate ? 'bg-sky-600 text-white' : 'text-gray-300 hover:bg-white/10'}`}
        >
          Orbit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="dungeon-fullscreen"
          onClick={() => void toggleFullscreen()}
          className="h-8 rounded-lg px-3 text-xs font-bold text-gray-300 transition hover:bg-white/10"
          title="Toggle fullscreen (F)"
        >
          {fullscreen ? 'Exit full' : 'Fullscreen'}
        </Button>
      </div>

      {!gameplay && <div
        className="pointer-events-none absolute bottom-4 right-4 z-10 hidden max-w-56 rounded-lg border border-white/10 bg-black/68 px-3 py-2 text-[10px] leading-relaxed text-gray-300 shadow-xl backdrop-blur-sm md:block"
        aria-label="Active dungeon scene legend"
      >
        <div className="mb-1 font-black uppercase tracking-[0.16em] text-gray-100">Scene key</div>
        <div><span className="text-cyan-300">●</span> entrance</div>
        <div><span className="text-rose-400">●</span> objective</div>
        {overlays.rooms && (
          <div className="mt-1 border-t border-white/10 pt-1">
            <div><span className="text-sky-300">●</span> entrance · <span className="text-orange-300">●</span> elite</div>
            <div><span className="text-yellow-300">●</span> treasure · <span className="text-violet-300">●</span> shrine</div>
            <div><span className="text-red-400">●</span> boss room</div>
          </div>
        )}
        {overlays.heatmap && <div className="mt-1"><span className="text-cyan-300">safe</span> → <span className="text-red-400">dangerous</span></div>}
        {overlays.critical && <div><span className="text-amber-300">■</span> critical-path floor</div>}
        {overlays.spawns && <div><span className="text-red-400">▲</span> {model.spawns.length} encounter positions</div>}
        {overlays.graph && <div><span className="text-slate-300">—</span> room graph</div>}
        {overlays.loops && <div><span className="text-cyan-300">—</span> loop connection</div>}
        {overlays.props && preset === 'tactical' && visibleProps.visibleCount < visibleProps.totalCount && (
          <div className="mt-1 border-t border-white/10 pt-1 text-gray-400">Close presets restore minor dressing.</div>
        )}
      </div>}
    </div>
  );
};

export default Dungeon3DPreview;

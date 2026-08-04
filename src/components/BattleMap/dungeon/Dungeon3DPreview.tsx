// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/08/2026, 01:52:29
 * Dependents: components/DesignPreview/steps/PreviewDungeon.tsx, components/World3D/DungeonExpeditionOverlay.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, MapControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, N8AO, ToneMapping } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { Button } from '../../ui/Button';
import type { Cell, DungeonPlan } from '../../../systems/worldforge/dungeon/types';
import type { DungeonIdentity } from '../../../systems/worldforge/dungeon/world/dungeonIdentity';
import {
  canClaimDungeonTreasure,
  canClearDungeonEncounter,
  dungeonCellToScenePosition,
  dungeonEntrancePlayerCell,
  dungeonPathToEncounterInteraction,
  dungeonPathToTreasureInteraction,
  findNextDungeonEncounterInteraction,
  findNextDungeonTreasureInteraction,
  moveDungeonPlayer,
  type DungeonMoveDirection,
} from '../../../systems/worldforge/dungeon/world/dungeonGameplay';
import { revealedDungeonCellKeys } from '../../../systems/worldforge/dungeon/world/dungeonMap';
import {
  buildDungeonSceneModel,
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

export type DungeonCameraPreset = 'tactical' | 'entrance' | 'objective';

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
  claimedTreasureIds: readonly string[];
  onClaimTreasure: (eventId: string) => void;
  /** Encounters already cleared on this level, as persisted by the canonical lifecycle ledger. */
  clearedEncounterIds: readonly string[];
  /** Defeating a generated encounter reports its stable id; the reducer owns durable progress. */
  onClearEncounter: (eventId: string) => void;
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
}> = ({
  instances,
  shape = 'box',
  emissive = false,
  baked = false,
  useInstanceColors = true,
  solidColor = '#ffffff',
  opacity = 1,
  castShadow = false,
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const instanceColors = useMemo(() => {
    // Attach the color buffer declaratively so it exists before Three compiles the first
    // material program. Creating it later with setColorAt left some browsers on a black
    // no-instance-color shader even after the matrix batch was otherwise ready.
    const values = new Float32Array(instances.length * 3);
    const color = new THREE.Color();
    instances.forEach((instance, index) => color.set(instance.color).toArray(values, index * 3));
    return values;
  }, [instances]);

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
      {emissive || baked ? (
        <meshBasicMaterial
          color={solidColor}
          vertexColors={useInstanceColors}
          transparent={opacity < 1}
          opacity={opacity}
          toneMapped={false}
        />
      ) : (
        <meshStandardMaterial
          color={solidColor}
          vertexColors={useInstanceColors}
          roughness={shape === 'box' ? 0.82 : shape === 'arch' ? 0.76 : 0.68}
          metalness={shape === 'octahedron' ? 0.08 : 0.02}
          transparent={opacity < 1}
          opacity={opacity}
        />
      )}
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

const SceneMarker: React.FC<{ marker: DungeonSceneMarker }> = ({ marker }) => (
  <group position={[marker.x, 0.08, marker.z]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.62, 0.08, 8, 32]} />
      <meshBasicMaterial color={marker.color} toneMapped={false} />
    </mesh>
    <mesh position={[0, 0.72, 0]}>
      <coneGeometry args={[0.24, 0.62, 8]} />
      <meshBasicMaterial color={marker.color} toneMapped={false} />
    </mesh>
    <Html position={[0, 1.25, 0]} center distanceFactor={16} occlude>
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
const DungeonPlayerMarker: React.FC<{ position: { x: number; z: number } }> = ({ position }) => (
  <group position={[position.x, 0.08, position.z]}>
    <mesh position={[0, 0.48, 0]} castShadow>
      <cylinderGeometry args={[0.22, 0.3, 0.86, 10]} />
      <meshStandardMaterial color="#38bdf8" emissive="#075985" emissiveIntensity={0.7} />
    </mesh>
    <mesh position={[0, 1.02, 0]} castShadow>
      <sphereGeometry args={[0.24, 12, 10]} />
      <meshStandardMaterial color="#e0f2fe" emissive="#0ea5e9" emissiveIntensity={0.35} />
    </mesh>
    <Html position={[0, 1.62, 0]} center distanceFactor={13} occlude>
      <span
        data-testid="dungeon-player-marker"
        className="whitespace-nowrap rounded-full border border-sky-300 bg-sky-950/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-sky-100 shadow-xl"
      >
        You
      </span>
    </Html>
  </group>
);

const DungeonTreasureMarker: React.FC<{ position: { x: number; z: number } }> = ({ position }) => (
  <group position={[position.x, 0.12, position.z]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.48, 0.09, 8, 28]} />
      <meshBasicMaterial color="#fbbf24" toneMapped={false} />
    </mesh>
    <Html position={[0, 1.25, 0]} center distanceFactor={15} occlude>
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
}> = ({ model, preset, autoRotate }) => {
  const controlsRef = useRef<React.ElementRef<typeof MapControls>>(null);
  const { camera } = useThree();

  useEffect(() => {
    const entrance = model.markers[0];
    const objective = model.markers[1];
    const tacticalFocus = {
      // Perspective enlarges the near (+x/+z) edge. A small aim bias spends the generous far
      // margin there and protects near-edge rooms from touching the bottom of the canvas.
      x: model.bounds.centerX + model.bounds.width * 0.1,
      z: model.bounds.centerZ + model.bounds.depth * 0.1,
    };
    const closeMarker = preset === 'entrance'
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
  }, [camera, model, preset]);

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
  model: DungeonSceneModel;
  overlays: Dungeon3DOverlays;
  preset: DungeonCameraPreset;
  autoRotate: boolean;
  visibleProps: VisibleDungeonProps;
  readyOwner: symbol;
  playerPosition?: { x: number; z: number };
  treasurePosition?: { x: number; z: number };
}> = ({
  model,
  overlays,
  preset,
  autoRotate,
  visibleProps,
  readyOwner,
  playerPosition,
  treasurePosition,
}) => {
  const readyFrames = useRef(0);
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
      <>
      <color attach="background" args={[model.palette.background]} />
      {/* Scale fog to the generated footprint. A fixed cave-like density hid an entire
          large dungeon from the tactical camera even though close rooms looked correct. A modest
          multiplier deepens the crypt gloom and swallows the atmospheric ground's outer rim. */}
      <fogExp2 attach="fog" args={[model.palette.fog, fogDensity * 1.18]} />
      {/* Moody-but-readable budget: a low cold ambient plus a soft cool hemisphere establish a
          legible base for the whole plan, a gentle warm key gives walls and props form, and the
          torch point lights are boosted so they pool warm light across the now-lit floor. The old
          values flattened everything to bright uniform tan and let the accent torches vanish. */}
      <ambientLight color={model.palette.ambient} intensity={1.0} />
      <hemisphereLight args={[model.palette.ambient, model.palette.background, 1.25]} />
      <directionalLight color={model.palette.sun} intensity={1.2} position={[24, 38, 16]} />
      {model.lights.map((light, index) => (
        <pointLight
          key={`${light.x}:${light.z}:${index}`}
          position={[light.x, light.y, light.z]}
          color={light.color}
          intensity={26}
          distance={12}
          decay={2}
          castShadow
          shadow-mapSize={[512, 512]}
          shadow-bias={-0.0006}
          shadow-near={0.1}
          shadow-far={20}
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
        <InstancedPieces instances={model.floors} useInstanceColors />
      )}
      <InstancedPieces instances={model.walls} useInstanceColors />
      <InstancedPieces instances={model.wallCaps} useInstanceColors />
      {/* Architecture remains visible when the optional prop overlay is hidden. These bounded
          batches are raised from real wall/door cells: rotated supports for crypts, curved rock
          masses for caverns, ice spires for frost, and one true half-ring per authored doorway. */}
      <ColorBatchedPieces instances={model.architectureBoxes} shape="box" castShadow />
      <ColorBatchedPieces instances={model.architectureCylinders} shape="cylinder" castShadow />
      <ColorBatchedPieces instances={model.architectureCones} shape="cone" castShadow />
      <ColorBatchedPieces instances={model.architectureSpheres} shape="sphere" castShadow />
      <ColorBatchedPieces instances={model.architectureOctahedrons} shape="octahedron" castShadow />
      <ColorBatchedPieces instances={model.arches} shape="arch" castShadow />
      <ColorBatchedPieces instances={model.liquids} baked opacity={0.72} />
      <InstancedPieces
        instances={model.doors.filter((door) => door.state === 'door')}
        useInstanceColors={false}
        solidColor="#7b5134"
        castShadow
      />
      <InstancedPieces
        instances={model.doors.filter((door) => door.state === 'bricked')}
        useInstanceColors={false}
        solidColor="#8a4739"
        castShadow
      />
      {overlays.secrets && (
        <InstancedPieces
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
          <ColorBatchedPieces instances={visibleProps.boxes} shape="box" castShadow />
          <ColorBatchedPieces instances={visibleProps.cylinders} shape="cylinder" castShadow />
          <ColorBatchedPieces instances={visibleProps.cones} shape="cone" castShadow />
          <ColorBatchedPieces instances={visibleProps.spheres} shape="sphere" castShadow />
          <ColorBatchedPieces instances={visibleProps.octahedrons} shape="octahedron" baked />
          <InstancedPieces instances={visibleProps.semanticFlames} shape="sphere" emissive useInstanceColors={false} solidColor={model.palette.flame} />
        </>
      )}
      {overlays.spawns && (
        <>
          {/* Floor halos make encounter locations readable at tactical range; cones preserve
              vertical position in close views. Both layers are instanced, not per-spawn meshes. */}
          <ColorBatchedPieces instances={model.spawnHalos} shape="cylinder" emissive opacity={0.58} />
          <ColorBatchedPieces instances={model.spawns} shape="cone" emissive opacity={0.96} />
        </>
      )}
      <SceneLines lines={model.lines} overlays={overlays} />
      {/* Entrance/objective waypoint markers are gameplay chrome, not environment. A capture
          scenario sets window.__dungeon3dMarkers = false to keep the frame a clean environment
          (A9 hygiene); default (undefined) keeps them on so product users still see waypoints. */}
      {(window as unknown as { __dungeon3dMarkers?: boolean }).__dungeon3dMarkers !== false
        && model.markers.map((marker) => <SceneMarker key={marker.label} marker={marker} />)}
      {treasurePosition ? <DungeonTreasureMarker position={treasurePosition} /> : null}
      {playerPosition ? <DungeonPlayerMarker position={playerPosition} /> : null}
      <DungeonCamera model={model} preset={preset} autoRotate={autoRotate} />
    </>
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
// NOTE (2026-08-03): aoRadius copied from the close combat camera (1.8) as the
// wiring default; it is a world-unit value and must be re-measured for the
// dungeon entrance/objective cameras by a vision-capable critic (do NOT assume
// the battle-map value transfers).
// ============================================================================
const PostProcessingStack: React.FC = () => (
  <EffectComposer>
    <N8AO
      halfRes
      quality="performance"
      aoRadius={1.8}
      distanceFalloff={3.5}
      intensity={2.2}
    />
    <Bloom
      mipmapBlur
      luminanceThreshold={0.45}
      luminanceSmoothing={0.25}
      intensity={0.9}
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
  const [preset, setPreset] = useState<DungeonCameraPreset>('tactical');
  const [autoRotate, setAutoRotate] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [playerCell, setPlayerCell] = useState<Cell>(() => (
    gameplay?.initialPlayerCell ?? dungeonEntrancePlayerCell(plan)
  ));
  const [lastClaimedTreasureId, setLastClaimedTreasureId] = useState<string | null>(null);
  const [lastClearedEncounterId, setLastClearedEncounterId] = useState<string | null>(null);
  const claimedTreasureIds = gameplay?.claimedTreasureIds ?? NO_CLAIMED_TREASURE;
  const clearedEncounterIds = gameplay?.clearedEncounterIds ?? NO_CLEARED_ENCOUNTERS;
  const discoveredCellKeys = gameplay?.discoveredCellKeys ?? NO_DISCOVERED_CELLS;
  const model = useMemo(() => buildDungeonSceneModel(plan, {
    showRoomTypes: overlays.rooms,
    showDifficulty: overlays.heatmap,
    showCritical: overlays.critical,
  }), [overlays.critical, overlays.heatmap, overlays.rooms, plan]);
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
  const encounterInteraction = useMemo(() => (
    gameplay
      ? findNextDungeonEncounterInteraction(
        plan,
        gameplay.identity,
        clearedEncounterIds,
        playerCell,
      )
      : null
  ), [clearedEncounterIds, gameplay, plan, playerCell]);
  const encounterPath = useMemo(() => (
    gameplay && encounterInteraction
      ? dungeonPathToEncounterInteraction(plan, playerCell, encounterInteraction)
      : []
  ), [encounterInteraction, gameplay, plan, playerCell]);
  const playerPosition = gameplay ? dungeonCellToScenePosition(plan, playerCell) : undefined;
  const treasurePosition = gameplay && treasureInteraction
    ? dungeonCellToScenePosition(plan, treasureInteraction.targetCell)
    : undefined;
  const treasureIsClaimable = canClaimDungeonTreasure(playerCell, treasureInteraction);
  const encounterIsClearable = canClearDungeonEncounter(playerCell, encounterInteraction);
  const objective = gameplay?.objective ?? null;
  const objectiveIsReached = Boolean(
    objective
    && playerCell.x === objective.cell.x
    && playerCell.y === objective.cell.y,
  );

  // A new level begins at the transition-selected floor. Ordinary ledger re-renders keep the
  // current cell; only a different level identity or regenerated plan applies a new arrival.
  useEffect(() => {
    setPlayerCell(gameplay?.initialPlayerCell ?? dungeonEntrancePlayerCell(plan));
    setLastClaimedTreasureId(null);
    setLastClearedEncounterId(null);
  }, [gameplay?.identity.dungeonId, gameplay?.initialPlayerCell, plan]);

  useEffect(() => {
    if (!gameplay) return;
    const remembered = new Set(discoveredCellKeys);
    const newlyRevealed = revealedDungeonCellKeys(plan, playerCell).filter(
      (cellKey) => !remembered.has(cellKey),
    );

    // Initial entry and every accepted one-cell movement ink only newly visible plan cells. A
    // blocked move produces no new key and therefore no redundant persistence action.
    if (newlyRevealed.length > 0) gameplay.onDiscoverCells(newlyRevealed);
  }, [discoveredCellKeys, gameplay, plan, playerCell]);

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
    if (!gameplay) return;
    setPlayerCell((current) => moveDungeonPlayer(plan, current, direction));
  }, [gameplay, plan]);

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
    if (!gameplay) return undefined;
    const onGameplayKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, select, textarea, button')) return;
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
  }, [toggleFullscreen]);

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
      className="relative h-[clamp(360px,62vh,720px)] min-h-[360px] w-full max-w-[1440px] overflow-hidden rounded-xl border border-gray-700 bg-black shadow-2xl sm:h-[clamp(500px,calc(100vh-390px),720px)] sm:min-h-[500px] fullscreen:h-screen fullscreen:max-h-none"
      data-testid="dungeon-3d-preview"
    >
      <Canvas
        className="h-full w-full"
        dpr={[1, 2]}
        shadows
        camera={{ fov: 46, near: 0.1, far: 600, position: [30, 34, 30] }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.35 }}
      >
        <DungeonScene
          model={model}
          overlays={overlays}
          preset={preset}
          autoRotate={autoRotate}
          visibleProps={visibleProps}
          readyOwner={readyOwnerRef.current}
          playerPosition={playerPosition}
          treasurePosition={treasurePosition}
        />
        <PostProcessingStack />
        <FrameProfiler />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/85 via-black/45 to-transparent p-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.26em] text-amber-300">3D Expedition</div>
          <div className="mt-1 font-serif text-xl font-bold text-white">{plan.name}</div>
          <div className="mt-0.5 text-xs text-gray-300">
            {model.floors.length} floor cells · {model.walls.length} raised walls · {model.lights.length} accent lights
            {overlays.props && ` · ${visibleProps.visibleCount}/${visibleProps.totalCount} visible props`}
          </div>
        </div>
        <div className="rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[10px] uppercase tracking-wider text-gray-300 backdrop-blur-sm">
          Drag to orbit · wheel to zoom · right-drag to pan
        </div>
      </div>

      {gameplay ? (
        <aside
          data-testid="dungeon-gameplay-controls"
          data-player-cell={`${playerCell.x},${playerCell.y}`}
          className="absolute bottom-16 left-4 z-30 rounded-xl border border-sky-400/35 bg-gray-950/92 p-3 text-gray-100 shadow-2xl backdrop-blur-md"
          style={{ width: 'min(330px, calc(100% - 2rem))' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">
                Dungeon movement
              </div>
              <div data-testid="dungeon-player-cell" className="mt-1 text-xs text-gray-300">
                Cell {playerCell.x}, {playerCell.y} · arrow keys or WASD
              </div>
            </div>
            <div
              data-testid="dungeon-claimed-treasure-count"
              className="rounded-full border border-emerald-400/35 bg-emerald-950/60 px-2 py-1 text-[10px] font-bold text-emerald-200"
            >
              {claimedTreasureIds.length} claimed
            </div>
          </div>

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
                  {encounterIsClearable ? 'Defeat encounter' : 'Move onto it'}
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
              {objectiveIsReached ? 'Defeat boss and complete dungeon' : 'Reach the boss objective'}
            </Button>
          ) : null}
        </aside>
      ) : null}

      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-gray-950/82 p-1.5 shadow-xl backdrop-blur-md">
        {(['tactical', 'entrance', 'objective'] as DungeonCameraPreset[]).map((option) => (
          <Button
            key={option}
            type="button"
            variant="ghost"
            size="sm"
            data-testid={`dungeon-camera-${option}`}
            onClick={() => setPreset(option)}
            className={`h-8 rounded-lg px-3 text-xs font-bold capitalize transition ${preset === option ? 'bg-amber-500 text-gray-950' : 'text-gray-300 hover:bg-white/10'}`}
          >
            {option}
          </Button>
        ))}
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

      <div
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
      </div>
    </div>
  );
};

export default Dungeon3DPreview;

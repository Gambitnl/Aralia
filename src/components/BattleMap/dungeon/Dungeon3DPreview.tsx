// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/07/2026, 13:54:30
 * Dependents: components/DesignPreview/steps/PreviewDungeon.tsx
 * Imports: 3 files
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
 * an atmospheric preview. No generation logic lives here, so the parchment and 3D modes can
 * never disagree about what dungeon was built or what happened to it.
 *
 * Called by: PreviewDungeon.tsx when the user selects the 3D Expedition view.
 * Depends on: React Three Fiber for the canvas and drei for accessible camera controls/labels.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, MapControls } from '@react-three/drei';
import * as THREE from 'three';
import { Button } from '../../ui/Button';
import type { DungeonPlan } from '../../../systems/worldforge/dungeon/types';
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

interface Dungeon3DPreviewProps {
  plan: DungeonPlan;
  overlays: Dungeon3DOverlays;
}

interface SceneProbeWindow extends Window {
  __dungeon3dReady?: boolean;
  __dungeon3dViewState?: {
    preset: DungeonCameraPreset;
    autoRotate: boolean;
    fullscreen: boolean;
    visibleProps: number;
    totalProps: number;
  };
}

// ============================================================================
// Instanced geometry
// ============================================================================
// Each visual category is one instanced mesh. This keeps a sixty-room dungeon practical while
// still allowing every cell and prop to carry its own transform and baked color variation.
// ============================================================================

type InstanceShape = 'box' | 'cylinder' | 'cone' | 'octahedron' | 'sphere';

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
          roughness={shape === 'box' ? 0.82 : 0.68}
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
}> = ({ model, overlays, preset, autoRotate, visibleProps }) => {
  const readyFrames = useRef(0);
  const fogDensity = 0.46 / Math.max(model.bounds.width, model.bounds.depth);

  // A seed, theme, or overlay rebuild invalidates the previous canvas proof. Reset both the
  // local frame counter and public probe together; the next three real render frames restore
  // readiness without a timer or a stale flag from the previous dungeon.
  useEffect(() => {
    readyFrames.current = 0;
    (window as SceneProbeWindow).__dungeon3dReady = false;
  }, [model]);

  // Publish a deterministic readiness flag after the renderer has produced multiple frames.
  // Browser verification can then distinguish a mounted canvas from a genuinely drawn scene.
  useFrame(() => {
    if (readyFrames.current < 3) readyFrames.current += 1;
    if (readyFrames.current === 3) (window as SceneProbeWindow).__dungeon3dReady = true;
  });

  return (
      <>
      <color attach="background" args={[model.palette.background]} />
      {/* Scale fog to the generated footprint. A fixed cave-like density hid an entire
          large dungeon from the tactical camera even though close rooms looked correct. */}
      <fogExp2 attach="fog" args={[model.palette.fog, fogDensity]} />
      <ambientLight color={model.palette.ambient} intensity={1.35} />
      <hemisphereLight args={[model.palette.sun, model.palette.background, 2.2]} />
      <directionalLight color={model.palette.sun} intensity={3.2} position={[24, 38, 16]} />
      {model.lights.map((light, index) => (
        <pointLight
          key={`${light.x}:${light.z}:${index}`}
          position={[light.x, light.y, light.z]}
          color={light.color}
          intensity={14}
          distance={8}
          decay={2}
        />
      ))}

      {/* A broad underlay catches silhouettes outside the carved footprint without pretending
          that void cells are playable floor. */}
      <mesh position={[model.bounds.centerX, -0.14, model.bounds.centerZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[model.bounds.width * 1.3, model.bounds.depth * 1.3]} />
        <meshStandardMaterial color={model.palette.background} roughness={1} />
      </mesh>

      {/* Floors and walls use their deterministic baked colors directly. Besides matching the
          intended WebGPU/TSL lighting strategy, this keeps whole-plan tactical views readable
          without thousands of real lights or a theme-dependent exposure hack. */}
      {overlays.rooms || overlays.heatmap || overlays.critical ? (
        <ColorBatchedPieces instances={model.floors} baked />
      ) : (
        <InstancedPieces instances={model.floors} baked useInstanceColors={false} solidColor={model.palette.floor} />
      )}
      <InstancedPieces instances={model.walls} useInstanceColors={false} solidColor={model.palette.wall} />
      <InstancedPieces instances={model.wallCaps} useInstanceColors={false} solidColor={model.palette.wallCap} />
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
      {model.markers.map((marker) => <SceneMarker key={marker.label} marker={marker} />)}
      <DungeonCamera model={model} preset={preset} autoRotate={autoRotate} />
    </>
  );
};

// ============================================================================
// Preview chrome and fullscreen behavior
// ============================================================================
// The wrapper owns only presentation controls. Generator controls stay in PreviewDungeon so a
// seed/theme/history change updates the parchment and 3D view together.
// ============================================================================

export const Dungeon3DPreview: React.FC<Dungeon3DPreviewProps> = ({ plan, overlays }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [preset, setPreset] = useState<DungeonCameraPreset>('tactical');
  const [autoRotate, setAutoRotate] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const model = useMemo(() => buildDungeonSceneModel(plan, {
    showRoomTypes: overlays.rooms,
    showDifficulty: overlays.heatmap,
    showCritical: overlays.critical,
  }), [overlays.critical, overlays.heatmap, overlays.rooms, plan]);
  const visibleProps = useMemo(() => selectVisibleDungeonProps(model, preset), [model, preset]);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await rootRef.current?.requestFullscreen();
  }, []);

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
      (window as SceneProbeWindow).__dungeon3dReady = false;
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
        camera={{ fov: 46, near: 0.1, far: 600, position: [30, 34, 30] }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
      >
        <DungeonScene
          model={model}
          overlays={overlays}
          preset={preset}
          autoRotate={autoRotate}
          visibleProps={visibleProps}
        />
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

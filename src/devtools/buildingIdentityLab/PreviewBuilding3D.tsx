/**
 * @file PreviewBuilding3D.tsx
 * @description Orbitable 3D realization of the EXACT BlueprintPlan the 2D
 * blueprint drawer shows — the standing eyeball tool for the roofscapes phase.
 *
 * All render decisions live in the PURE, unit-tested `buildingSceneModel`
 * (src/systems/world3d/buildingSceneModel.ts): floor peel (basement..selected,
 * open-topped; 'all' = closed), per-kind colors, lit window panes 17–23h when
 * occupied, hearth glow from `hearthLitHours`, and occupant dots per at-home
 * member. This component only maps that data onto meshes + lights, following
 * the Town3DScene R3F pattern. Units are PLAN FEET throughout (scale is
 * arbitrary in an isolated viewer); plan (x, y, z0) → three (x, z0, y).
 *
 * The viewer also gives those unchanged meshes a storybook presentation. It
 * uses rough physical surfaces, material-specific colors, dark architectural edges,
 * lays a faint procedural paper grain over the finished frame, and grounds the
 * model with one bounded shadow-casting sun plus a small contact-shadow pass.
 * These are render-only choices: they do not alter the blueprint, generated
 * geometry, named random draws, or any other deterministic building data.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/10/2026, 00:42:29
 * Dependents: components/DesignPreview/steps/PreviewBlueprint.tsx, devtools/buildingIdentityLab/BuildingIdentityLab.tsx
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * ARCHITECTURAL COMMENTARY:
 * CURRENT SURFACE PASS: physical wall/roof lighting and meter-consistent UVs
 * replace the former all-toon surface treatment described in the history below.
 * The starting camera faces the entry, skylight reveals shaded facades, and
 * construction colors distinguish plaster, timber, stone, tile, and thatch.
 * Floorplans, dimensions, orbit controls, and time-of-day schedules are preserved.
 *
 * WHAT CHANGED: Added automated bounds-based camera framing (calculateModelBounds and computeCameraConfig)
 * that incorporates all mesh boxes, solved roof heights, and motifs. Aimed the orbit target at the real
 * vertical center of the bounds. Set a lower 28-degree default camera angle for closed buildings
 * to render facades, foundations, trim, and motifs legibly. Added a straight-down vertical fill light to
 * resolve roof blackness. Configured same-color emissive lighting on the roof material that preserves
 * model.roof.color exactly while ensuring legibility in daylight and keeping the night darker.
 * WHY: The default camera was at 51 degrees (looking almost straight down, hiding the facade), aimed too
 * low based on hardcoded plan height, cropped roofs on 1440x900/1920x1080 screens, and rendered slate/clay
 * roofs as near-black voids.
 * WHAT WAS PRESERVED: The exact blueprint geometry, dressing-part generation, day/night transitions,
 * emissive window/hearth lighting, dot positions, and OrbitControls interactivity were preserved.
 * WHAT REMAINS DEFERRED: Broader production-world facade readability and future material surfaces remain
 * deferred to subsequent development phases.
 *
 * LIGHTING COMMENTARY:
 * WHAT CHANGED: The existing daytime/nighttime key light now casts a bounded soft shadow map, visible
 * building parts participate as casters and receivers, and a one-frame contact-shadow pass darkens only
 * the small patch where the isolated model meets its ground apron.
 * WHY: The lab previously lit every face but produced no ground silhouette or local occlusion, making the
 * generated mass appear detached from the site even when its geometry was correct.
 * WHAT WAS PRESERVED: The four-light day/night recipe, camera, controls, colors, geometry, toon bands,
 * ink edges, roof emissive lift, and paper grain are unchanged; production World3D lighting stays separate.
 * WHAT REMAINS DEFERRED: Production roof occlusion continues to belong to World3DLighting rather than this
 * isolated inspection canvas, and full-screen post-processing remains intentionally out of scope.
 */

import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, Edges, Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { toonGradient } from '@/systems/entities3d/three/toon';
import type { BlueprintPlan } from '@/systems/worldforge/interior/blueprintTypes';
import { blueprintSiteOrigin } from '@/systems/worldforge/interior/blueprintTypes';
import type { BuildingOccupancy } from '@/systems/worldforge/interior/occupancy';
import { townSurfaceTexture, houseSurfaceColor } from '@/components/World3D/townSurfaceTextures';
import { applyWallSurfaceUvs, applyRoofSurfaceUvs } from '@/components/World3D/buildingSurfaceUvs';
import {
  buildingSceneModel,
  DOT_RADIUS_FT,
  type PeelLevel,
  type BuildingSceneModel,
} from '@/systems/world3d/buildingSceneModel';
import {
  buildingAtmosphereAtHour,
  chimneySmokeSources,
  sampleChimneySmoke,
  SMOKE_PARTICLES_PER_CHIMNEY,
  type ChimneySmokeSource,
} from '@/systems/world3d/buildingAtmosphere';
import { PerfProbe } from '@/devtools/perf';
import { BuildingSceneDiagnostics } from './BuildingSceneDiagnostics';
import { buildingRenderBatches } from './buildingRenderBatches';

// ============================================================================
// Storybook Render Style
// ============================================================================
// These presentation values commit the isolated building viewer to one coherent
// ink-and-paper look. The three-pixel nearest-filtered ramp comes from Aralia's
// existing entity renderer, so buildings and characters share the same hard
// light-band language without introducing another shader system.
// ============================================================================

const NPR_OUTLINE_COLOR = '#2b211c';
const NPR_TOON_BANDS = 3;
const NPR_GRAIN_STRENGTH = 0.18;

// A single moderate shadow texture is enough for the selected building panel.
// Keeping the map bounded avoids paying production-world shadow costs in this lab.
const LAB_SUN_SHADOW_MAP_SIZE = 1024;
const LAB_CONTACT_SHADOW_RESOLUTION = 512;

const PAPER_GRAIN_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  backgroundImage: [
    'radial-gradient(circle at 25% 25%, rgba(255, 247, 222, 0.7) 0 0.55px, transparent 0.7px)',
    'radial-gradient(circle at 75% 65%, rgba(61, 43, 32, 0.55) 0 0.5px, transparent 0.68px)',
  ].join(', '),
  backgroundPosition: '0 0, 1px 2px',
  backgroundSize: '4px 4px, 5px 5px',
  mixBlendMode: 'soft-light',
  opacity: NPR_GRAIN_STRENGTH,
};

// ============================================================================
// Deterministic Chimney Motion
// ============================================================================
// The live canvas passes its elapsed seconds into the pure sampler. Screenshot
// tooling may set one explicit global second value before capture, making every
// proof particle repeat exactly without putting wall-clock state into the model.
// ============================================================================

const ATMOSPHERE_PROOF_SECONDS_KEY = '__buildingLabAtmosphereProofSeconds';
const ATMOSPHERE_SMOKE_RECEIPT_KEY = '__buildingLabSmoke';

interface SmokePlumesProps {
  sources: readonly ChimneySmokeSource[];
  color: string;
}

/** Draw the bounded pure smoke sample as soft, non-shadowing puffs. */
const SmokePlumes: React.FC<SmokePlumesProps> = ({ sources, color }) => {
  const meshes = useRef<Array<THREE.Mesh | null>>([]);
  const initial = useMemo(() => sampleChimneySmoke(sources, 0), [sources]);

  // Each frame supplies seconds to the pure sampler. A finite proof override
  // freezes the same sample for tests and captures; normal interaction keeps moving.
  useFrame(({ clock }) => {
    const requested = Number(
      (window as unknown as Record<string, unknown>)[ATMOSPHERE_PROOF_SECONDS_KEY],
    );
    const fixed = Number.isFinite(requested);
    const seconds = fixed ? requested : clock.getElapsedTime();
    const particles = sampleChimneySmoke(sources, seconds);

    particles.forEach((particle, index) => {
      const mesh = meshes.current[index];
      if (!mesh) return;
      mesh.position.set(particle.x, particle.zFt, particle.y);
      mesh.scale.setScalar(particle.scale);
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = particle.opacity;
    });

    // Keep a compact, rounded receipt beside the existing blueprint receipt so
    // proof can state exactly which explicit sample produced the visible plume.
    (window as unknown as Record<string, unknown>)[ATMOSPHERE_SMOKE_RECEIPT_KEY] = {
      fixed,
      sampleSeconds: Math.round(seconds * 1000) / 1000,
      chimneyCount: sources.length,
      particleCount: particles.length,
      firstParticle: particles[0]
        ? {
          x: Math.round(particles[0].x * 1000) / 1000,
          y: Math.round(particles[0].y * 1000) / 1000,
          zFt: Math.round(particles[0].zFt * 1000) / 1000,
          opacity: Math.round(particles[0].opacity * 1000) / 1000,
        }
        : null,
    };
  });

  return (
    <group name="building-atmosphere-smoke">
      {initial.map((particle, index) => (
        <mesh
          key={`${particle.chimneyIndex}:${particle.particleIndex}`}
          ref={(mesh: THREE.Mesh | null) => { meshes.current[index] = mesh; }}
          position={[particle.x, particle.zFt, particle.y]}
          scale={particle.scale}
        >
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={particle.opacity}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
};

/** Replace any prior plume receipt once the selected hour/building has no smoke. */
const EmptySmokeReceipt: React.FC = () => {
  useFrame(() => {
    const requestedSeconds = Number(
      (window as unknown as Record<string, unknown>)[ATMOSPHERE_PROOF_SECONDS_KEY],
    );
    (window as unknown as Record<string, unknown>)[ATMOSPHERE_SMOKE_RECEIPT_KEY] = {
      fixed: Number.isFinite(requestedSeconds),
      sampleSeconds: Number.isFinite(requestedSeconds) ? requestedSeconds : null,
      chimneyCount: 0,
      particleCount: 0,
      firstParticle: null,
    };
  });
  return null;
};

// ============================================================================
// Types & Interfaces
// ============================================================================

/** Bounding box coordinates in Three.js world space, where Y is the vertical axis. */
export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

// ============================================================================
// Pure Bounding Box and Framing Calculations
// ============================================================================

/**
 * Calculates the bounding box of all visible components in world space.
 *
 * It accounts for mesh boxes (walls, windows, trim, motifs, etc.), solved roof vertices,
 * and occupant dots, all translated to align with the orbit target origin.
 *
 * @param model The pure 3D building scene model data
 * @param origin The site origin coordinates used to recenter the plan
 */
export function calculateModelBounds(
  model: Pick<BuildingSceneModel, 'boxes' | 'roof' | 'dots'>,
  origin: { x: number; y: number }
): WorldBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  // Process all structural, motif, and history box boundaries
  if (model.boxes && model.boxes.length > 0) {
    for (const b of model.boxes) {
      const bxMin = b.x - b.w / 2 - origin.x;
      const bxMax = b.x + b.w / 2 - origin.x;
      const byMin = b.z0;
      const byMax = b.z0 + b.h;
      const bzMin = b.y - b.d / 2 - origin.y;
      const bzMax = b.y + b.d / 2 - origin.y;

      if (bxMin < minX) minX = bxMin;
      if (bxMax > maxX) maxX = bxMax;
      if (byMin < minY) minY = byMin;
      if (byMax > maxY) maxY = byMax;
      if (bzMin < minZ) minZ = bzMin;
      if (bzMax > maxZ) maxZ = bzMax;
    }
  }

  // Process sloped roof geometry positions if present (only when closed)
  if (model.roof && model.roof.positions && model.roof.positions.length > 0) {
    const pos = model.roof.positions;
    for (let i = 0; i < pos.length; i += 3) {
      const rx = pos[i] - origin.x;
      const ry = pos[i + 1]; // elevation/vertical height in Three.js space
      const rz = pos[i + 2] - origin.y;

      if (rx < minX) minX = rx;
      if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry;
      if (ry > maxY) maxY = ry;
      if (rz < minZ) minZ = rz;
      if (rz > maxZ) maxZ = rz;
    }
  }

  // Include occupant spheres if any are present inside the layout
  if (model.dots && model.dots.length > 0) {
    const dotRadius = DOT_RADIUS_FT;
    for (const d of model.dots) {
      const dxMin = d.x - dotRadius - origin.x;
      const dxMax = d.x + dotRadius - origin.x;
      const dyMin = d.zFt - dotRadius;
      const dyMax = d.zFt + dotRadius;
      const dzMin = d.y - dotRadius - origin.y;
      const dzMax = d.y + dotRadius - origin.y;

      if (dxMin < minX) minX = dxMin;
      if (dxMax > maxX) maxX = dxMax;
      if (dyMin < minY) minY = dyMin;
      if (dyMax > maxY) maxY = dyMax;
      if (dzMin < minZ) minZ = dzMin;
      if (dzMax > maxZ) maxZ = dzMax;
    }
  }

  // Fallback to a default bounding envelope if the model has no geometry
  if (!isFinite(minX)) {
    minX = -10;
    maxX = 10;
    minY = 0;
    maxY = 10;
    minZ = -10;
    maxZ = 10;
  }

  return { minX, maxX, minY, maxY, minZ, maxZ };
}

/**
 * Computes the optimal camera position and focus target to cleanly frame the model.
 *
 * It uses a perspective-fitting algorithm that projects the bounding box corners into
 * camera space, determining the exact distance required to fit the model horizontally
 * and vertically with a solid safety margin.
 *
 * @param bounds The calculated boundaries of the visible building geometry
 * @param upToLevel The current level slice being inspected
 * @param aspect The aspect ratio of the viewport (defaults to conservative 1.3)
 */
export function computeCameraConfig(
  bounds: WorldBounds,
  upToLevel: PeelLevel,
  aspect: number = 1.3
) {
  // Focus target is positioned at the exact spatial center of the bounds
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const target: [number, number, number] = [centerX, centerY, centerZ];

  // Set camera elevation angle in degrees:
  // - Closed building ('all'): lower 28-degree angle to make facade details readable
  // - Peeled floors: higher 50.7-degree angle to view room interiors from above
  const elevationDeg = upToLevel === 'all' ? 28 : 50.7;
  const E = (elevationDeg * Math.PI) / 180;

  // View direction unit vector from target to camera (on a 45-degree horizontal diagonal)
  const ux = Math.cos(E) * 0.70710678;
  const uy = Math.sin(E);
  const uz = Math.cos(E) * 0.70710678;

  // Camera local coordinate system axes
  const w_axis = [ux, uy, uz]; // camera backward axis
  const u_axis = [0.70710678, 0, -0.70710678]; // camera right axis
  const v_axis = [
    -Math.sin(E) * 0.70710678,
    Math.cos(E),
    -Math.sin(E) * 0.70710678,
  ]; // camera up axis

  // Standard vertical field of view for PerspectiveCamera is 45 degrees
  const fovV = (45 * Math.PI) / 180;
  const tanHalfFovV = Math.tan(fovV / 2);
  const tanHalfFovH = aspect * tanHalfFovV;

  // Calculate coordinates of all 8 bounding box corners
  const corners = [
    [bounds.minX, bounds.minY, bounds.minZ],
    [bounds.minX, bounds.minY, bounds.maxZ],
    [bounds.minX, bounds.maxY, bounds.minZ],
    [bounds.minX, bounds.maxY, bounds.maxZ],
    [bounds.maxX, bounds.minY, bounds.minZ],
    [bounds.maxX, bounds.minY, bounds.maxZ],
    [bounds.maxX, bounds.maxY, bounds.minZ],
    [bounds.maxX, bounds.maxY, bounds.maxZ],
  ];

  // Find the maximum distance required across all corners to avoid clipping
  let maxD = 0;
  for (const corner of corners) {
    const px = corner[0] - centerX;
    const py = corner[1] - centerY;
    const pz = corner[2] - centerZ;

    // Project corner coordinates into camera space
    const x_cam = px * u_axis[0] + py * u_axis[1] + pz * u_axis[2];
    const y_cam = px * v_axis[0] + py * v_axis[1] + pz * v_axis[2];
    const z_cam = px * w_axis[0] + py * w_axis[1] + pz * w_axis[2];

    // Compute distance required to fit corner vertically and horizontally
    const d_v = z_cam + Math.abs(y_cam) / tanHalfFovV;
    const d_h = z_cam + Math.abs(x_cam) / tanHalfFovH;

    const d = Math.max(d_v, d_h);
    if (d > maxD) {
      maxD = d;
    }
  }

  // Apply a 1.25x scaling safety margin to leave breathing room around all sides
  const safetyMargin = 1.25;
  const dist = Math.max(maxD * safetyMargin, 20);

  // Position camera at target + distance * direction_unit_vector
  const cameraPosition: [number, number, number] = [
    centerX + dist * ux,
    centerY + dist * uy,
    centerZ + dist * uz,
  ];

  return {
    target,
    cameraPosition,
    dist,
    elevationDeg,
  };
}

// ============================================================================
// Main Preview Component
// ============================================================================

export interface PreviewBuilding3DProps {
  plan: BlueprintPlan;
  /** Floor peel level slice ('all' = closed building). */
  upToLevel: PeelLevel;
  /** Hour slider value, 0-23 (controls light colors and window glow). */
  hour: number;
  /** Active occupancy detail, if toggled on. */
  occupancy?: BuildingOccupancy;
}

const PreviewBuilding3D: React.FC<PreviewBuilding3DProps> = ({
  plan, upToLevel, hour, occupancy,
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [hoveredPart, setHoveredPart] = useState<{ id: string; x: number; y: number } | null>(null);
  React.useEffect(() => { setSelectedPart(null); setHoveredPart(null); }, [plan, upToLevel]);
  // Generate the pure 3D building representation
  const model = useMemo(
    () => buildingSceneModel(plan, { upToLevel, hour, occupancy }),
    [plan, upToLevel, hour, occupancy],
  );

  // The lab and streamed town share the authored surface images. Material
  // receipts still choose the construction; diagonal placeholder hatches no
  // longer masquerade as timber beams on otherwise plain plaster walls.
  const wallTextureKey = model.materialTextures?.wall;
  const roofTextureKey = model.materialTextures?.roof;
  const wallTexture = wallTextureKey ? townSurfaceTexture('wall', wallTextureKey) : undefined;
  const roofTexture = roofTextureKey ? townSurfaceTexture('roof', roofTextureKey) : undefined;

  // Parse solved roof meshes into a Three.js buffer geometry if closed
  const roofGeometry = useMemo(() => {
    if (!model.roof) return undefined;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(model.roof.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(model.roof.normals, 3));
    // Solved roofs previously had no UVs, so a loaded covering map could never
    // appear. The pure model projects X/Z feet into stable repeating coordinates.
    g.setAttribute('uv', new THREE.BufferAttribute(model.roof.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(model.roof.indices, 1));
    return applyRoofSurfaceUvs(g, 0.3048);
  }, [model.roof]);
  React.useEffect(() => () => roofGeometry?.dispose(), [roofGeometry]);

  // Coplanar triangles form one inspectable roof surface, including its reverse
  // winding. Picking never changes the solved roof or its physical dimensions.
  const roofSections = useMemo(() => {
    if (!roofGeometry) return [];
    const positions = roofGeometry.getAttribute('position');
    const indices = roofGeometry.getIndex()!;
    const groups = new Map<string, number[]>();
    for (let i = 0; i < indices.count; i += 3) {
      const ids = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
      const [a, b, c] = ids.map(id => new THREE.Vector3().fromBufferAttribute(positions, id));
      const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      const first = [n.x, n.y, n.z].find(v => Math.abs(v) > 0.00001);
      if (!first) continue;
      if (first < 0) n.negate();
      const key = [n.x, n.y, n.z, n.dot(a)].map(v => Math.round(v * 10000)).join(':');
      const group = groups.get(key) ?? [];
      group.push(...ids);
      groups.set(key, group);
    }
    return [...groups.values()].map(indices => {
      const geometry = roofGeometry.clone();
      geometry.setIndex(indices);
      return geometry;
    });
  }, [roofGeometry]);
  React.useEffect(() => () => roofSections.forEach(g => g.dispose()), [roofSections]);

  const parts = useMemo(() => [
    ...model.boxes.map((b, i) => ({
      id: `box:${i}`,
      label: `${({ 'construction-material': 'Structural detail', motif: 'Architectural detail', 'facade-trim': 'Facade trim', jamb: 'Door jamb', sill: 'Window sill' } as Partial<Record<string, string>>)[b.kind] ?? b.kind.replaceAll('-', ' ')} ${i + 1}`,
      detail: `${b.w.toFixed(1)} × ${b.d.toFixed(1)} × ${b.h.toFixed(1)} ft (width × depth × height) · ${b.level < 0 ? 'Basement' : b.level === 0 ? 'Ground floor' : `Floor ${b.level}`}`,
    })),
    ...roofSections.map((_, i) => ({ id: `roof:${i}`, label: `Roof section ${i + 1}`, detail: roofTextureKey ? `Covering: ${roofTextureKey.replace(/^texture\/roof\//, '').replaceAll('/', ' · ').replaceAll('-', ' ')}` : 'Roof covering' })),
  ], [model.boxes, roofSections, roofTextureKey]);
  const selected = parts.find(p => p.id === selectedPart);
  const hovered = parts.find(p => p.id === hoveredPart?.id);
  const partEvents = (part: string | ((face: number) => string)) => ({
    onPointerMove: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      const id = typeof part === 'string' ? part : part(event.faceIndex ?? 0);
      const rect = viewerRef.current!.getBoundingClientRect();
      const x = Math.max(8, Math.min(event.clientX - rect.left + 14, rect.width - 220));
      const y = Math.max(8, Math.min(event.clientY - rect.top + 14, rect.height - 100));
      // Pointer travel moves the label directly; React only sees part changes.
      if (tooltipRef.current) { tooltipRef.current.style.left = `${x}px`; tooltipRef.current.style.top = `${y}px`; }
      setHoveredPart(current => current?.id === id ? current : { id, x, y });
    },
    onPointerOut: () => setHoveredPart(null),
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      const id = typeof part === 'string' ? part : part(event.faceIndex ?? 0);
      // Orbit drags end with a click too; only a stationary click selects.
      if (event.delta <= 4) setSelectedPart(id);
    },
  });

  const boxGeometries = useMemo(() => model.boxes.map(b => applyWallSurfaceUvs(
    new THREE.BoxGeometry(b.w, b.h, b.d),
    { x: b.x, y: b.z0 + b.h / 2, z: b.y }, 0.3048,
  )), [model.boxes]);
  React.useEffect(() => () => boxGeometries.forEach(g => g.dispose()), [boxGeometries]);
  const boxBatches = useMemo(() => buildingRenderBatches(model, boxGeometries, wallTextureKey), [model, boxGeometries, wallTextureKey]);
  React.useEffect(() => () => boxBatches.dispose(), [boxBatches]);
  const selectedBoxIndex = selectedPart?.startsWith('box:') ? Number(selectedPart.slice(4)) : -1;
  const selectedBox = model.boxes[selectedBoxIndex];

  // Determine site coordinates origin for translation
  const origin = useMemo(() => blueprintSiteOrigin(plan), [plan]);

  // Calculate bounding box and optimal camera/target framing parameters
  const bounds = useMemo(() => calculateModelBounds(model, origin), [model, origin]);

  const cameraConfig = useMemo(() => {
    const config = computeCameraConfig(bounds, upToLevel);
    const entry = plan.floors.find(f => f.level === 0)?.doors.find(d => d.isEntry);
    // The first view should explain the house: face its entrance rather than
    // the blank rear or the wall that normally belongs beside its neighbor.
    if (entry && upToLevel === 'all') {
      const axis = entry.axis === 'x' ? 2 : 0;
      const entryCoordinate = axis === 2 ? entry.y - origin.y : entry.x - origin.x;
      const sign = entryCoordinate < config.target[axis] ? -1 : 1;
      config.cameraPosition[axis] = config.target[axis]
        + sign * Math.abs(config.cameraPosition[axis] - config.target[axis]);
    }
    return config;
  }, [bounds, upToLevel, plan, origin.x, origin.y]);

  const target = cameraConfig.target;
  const camera = cameraConfig.cameraPosition;

  // Span matches the actual visible model's bounds dimensions
  const boundsWidth = bounds.maxX - bounds.minX;
  const boundsDepth = bounds.maxZ - bounds.minZ;
  const span = Math.max(boundsWidth, boundsDepth, 10);

  // Resolve every visible time-of-day decision from the single lab hour. Noon
  // retains the earlier exact values, while every other hour blends continuously.
  const belowGrade = upToLevel !== 'all' && upToLevel < 0;
  const atmosphere = useMemo(() => buildingAtmosphereAtHour(hour), [hour]);
  const night = atmosphere.mood === 'night';
  const sunPosition: [number, number, number] = [
    atmosphere.sunPositionScale[0] * span,
    atmosphere.sunPositionScale[1] * span,
    atmosphere.sunPositionScale[2] * span,
  ];

  // Only a real visible chimney above an actively glowing hearth may emit. This
  // keeps the visual motion tied to generated structure and the existing schedule.
  const hearthActive = model.boxes.some((box) => box.kind === 'hearth' && box.emissive);
  const smokeSources = useMemo(
    () => !belowGrade && hearthActive ? chimneySmokeSources(model.boxes) : [],
    [belowGrade, hearthActive, model.boxes],
  );

  // Fit the sun frustum to this building rather than the wider ground apron.
  // The margin includes tall roof ornaments without spreading 1,024 pixels over empty space.
  const sunShadowHalfSpan = span * 0.9;
  const sunShadowFar = span * 6;

  // Contact shading is baked once per selected building/floor shape. The key
  // remounts the bounded pass when lab selection changes while avoiding a continuous render cost.
  const contactShadowKey = [
    plan.buildingId,
    upToLevel,
    model.boxes.length,
    model.roof?.indices.length ?? 0,
    bounds.minX,
    bounds.maxX,
    bounds.minZ,
    bounds.maxZ,
  ].join(':');
  // Basement cuts retain their inspection lighting and opt out of exterior haze.
  // Above grade, the atmosphere helper owns the continuous contact-shadow weight.
  const contactShadowOpacity = atmosphere.contactShadowOpacity;
  const hazeNear = span * atmosphere.hazeNearScale;
  const hazeFar = span * atmosphere.hazeFarScale;

  // Expose inspection details for automated test assertions
  (window as unknown as Record<string, unknown>).__blueprint3d = {
    hour, upToLevel, occupied: occupancy !== undefined,
    boxes: model.boxes.length, dots: model.dots, windowsLit: model.windowsLit,
    roof: model.roof
      ? { tris: model.roof.indices.length / 3, color: model.roof.color }
      : null,
    styleFamily: plan.styleResolved?.familyId ?? null,
    hearths: model.boxes.filter((b) => b.kind === 'hearth')
      .map((b) => ({ x: b.x, y: b.y, level: b.level, lit: b.emissive !== undefined })),
    litWindowMeshes: model.boxes.filter((box) =>
      box.kind === 'window-pane' && box.emissive !== undefined).length,
    dressingParts: model.boxes.filter((b) =>
      ['construction-material', 'facade-trim', 'motif', 'weathering', 'permanent-history'].includes(b.kind)
    ).length,
    wallColor: plan.styleResolved?.wallColor ?? '#8a7663',
    // Resolved names, semantic keys, and object ids let browser proof show that
    // the selected building owns two shared textures rather than one per mesh.
    materialTextures: {
      wallMaterial: plan.styleResolved?.construction.wallMaterial ?? null,
      roofCovering: plan.styleResolved?.construction.roofCovering ?? null,
      wall: {
        key: wallTextureKey ?? null,
        loaded: wallTexture !== undefined,
        objectUuid: wallTexture?.uuid ?? null,
        meshUses: model.boxes.filter((box) => box.kind === 'wall').length,
      },
      roof: {
        key: roofTextureKey ?? null,
        loaded: roofTexture !== undefined,
        objectUuid: roofTexture?.uuid ?? null,
        meshUses: model.roof ? 1 : 0,
      },
    },
    // Extended camera and bounding box metadata for inspection assertions
    bounds: {
      minX: bounds.minX,
      maxX: bounds.maxX,
      minY: bounds.minY,
      maxY: bounds.maxY,
      minZ: bounds.minZ,
      maxZ: bounds.maxZ,
    },
    cameraTarget: target,
    cameraPosition: camera,
    cameraDistance: cameraConfig.dist,
    cameraElevation: cameraConfig.elevationDeg,
    // The style receipt lets visual automation confirm that the screenshot came
    // from the intended ink-and-paper renderer, rather than inferring it from pixels.
    nprStyle: {
      enabled: true,
      surfaceShading: 'physical',
      toonBands: NPR_TOON_BANDS,
      outlineColor: NPR_OUTLINE_COLOR,
      grainStrength: NPR_GRAIN_STRENGTH,
    },
    // This receipt lets visual proof distinguish real renderer configuration
    // from a darker material or hand-authored screenshot treatment.
    lighting: {
      sunCastsShadow: true,
      sunShadowMapSize: LAB_SUN_SHADOW_MAP_SIZE,
      sunShadowHalfSpan,
      contactShadow: {
        enabled: !belowGrade,
        resolution: LAB_CONTACT_SHADOW_RESOLUTION,
        opacity: contactShadowOpacity,
        scale: span * 2.4,
      },
    },
    // The full hour-driven recipe is copied into the proof receipt. Smoke uses
    // a separate per-frame receipt because its explicit seconds can change live.
    atmosphere: {
      ...atmosphere,
      sunPosition,
      hazeEnabled: !belowGrade,
      hazeNear: belowGrade ? null : hazeNear,
      hazeFar: belowGrade ? null : hazeFar,
      groundFogOpacity: belowGrade ? 0 : atmosphere.groundFogOpacity,
      hearthActive,
      chimneyCount: smokeSources.length,
      particleCount: smokeSources.length * SMOKE_PARTICLES_PER_CHIMNEY,
    },
  };

  return (
    <div
      ref={viewerRef}
      tabIndex={0}
      onKeyDown={event => { if (event.key === 'Escape') { setSelectedPart(null); setHoveredPart(null); } }}
      style={{ width: '100%', height: '100%', background: atmosphere.skyColor, position: 'relative', overflow: 'hidden' }}
      data-testid="building-3d-viewer"
    >
      <Canvas
        onPointerMissed={() => setSelectedPart(null)}
        shadows={{ type: THREE.PCFSoftShadowMap }}
        camera={{ fov: 45, near: 0.5, far: 4000, position: camera }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        {/* A cold hour or basement overwrites any plume receipt left by the
            previous frame, so automation never mistakes stale smoke for truth. */}
        <PerfProbe id="building3d" label="Building 3D" />
        <BuildingSceneDiagnostics revision={boxBatches} selection={selectedPart} />
        {smokeSources.length === 0 && <EmptySmokeReceipt />}

        {/* Background and distance fog share the same continuous hour recipe.
            Basement slices deliberately retain a clear inspection volume. */}
        <color attach="background" args={[atmosphere.skyColor]} />
        {!belowGrade && (
          <fog attach="fog" args={[atmosphere.hazeColor, hazeNear, hazeFar]} />
        )}

        <hemisphereLight
          args={[0xbcd6ff, 0x6b6048, atmosphere.hemisphereIntensity]}
        />
        {/* Broad skylight keeps the street-facing elevation readable in shade;
            the directional sun still supplies the architectural shadow shape. */}
        <ambientLight intensity={night ? 0.08 : 0.55} color="#dde7ef" />
        {/* The original shadow-casting sun now follows a bounded daily arc. Its
            exact noon position, color, intensity, and shadow camera are preserved. */}
        <directionalLight
          position={sunPosition}
          intensity={atmosphere.sunIntensity}
          color={atmosphere.sunColor}
          castShadow
          shadow-mapSize-width={LAB_SUN_SHADOW_MAP_SIZE}
          shadow-mapSize-height={LAB_SUN_SHADOW_MAP_SIZE}
          shadow-camera-near={0.5}
          shadow-camera-far={sunShadowFar}
          shadow-camera-left={-sunShadowHalfSpan}
          shadow-camera-right={sunShadowHalfSpan}
          shadow-camera-top={sunShadowHalfSpan}
          shadow-camera-bottom={-sunShadowHalfSpan}
          shadow-bias={-0.00035}
          shadow-normalBias={0.12}
        />
        <directionalLight
          position={[-span, span * 0.8, -span * 0.6]}
          intensity={atmosphere.sideFillIntensity}
          color={0xdde8ff}
        />

        {/* Bounded neutral fill light from straight above to lift roof details and shadows. */}
        <directionalLight
          position={[0, span * 2.5, 0]}
          intensity={atmosphere.overheadFillIntensity}
          color={0xffffff}
        />

        {/* Peeled ceiling/floor warm inspection light overlay */}
        {upToLevel !== 'all' && (
          <directionalLight
            position={[10, span * 2.5, 6]}
            intensity={belowGrade ? (night ? 1.3 : 1.0) : night ? 0.7 : 0.4}
            color={0xffe8c4}
          />
        )}

        {/* Extra side fill for basement cellar visibility */}
        {belowGrade && <ambientLight intensity={0.35} color={0xfff4e0} />}

        {/* Translate all plan mesh coordinates to center around target (0, 0, 0) */}
        <group position={[-origin.x, 0, -origin.y]}>
          {/* Ground apron (hidden during basement cuts) */}
          <mesh
            visible={!belowGrade}
            position={[origin.x, -0.15, origin.y]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[span * 3.5, span * 3.5]} />
            <meshToonMaterial
              color={atmosphere.groundColor}
              gradientMap={toonGradient()}
            />
          </mesh>

          {/* A shallow transparent sheet gives dawn and golden hour low mist.
              It writes no depth, stays clear at noon, and never enters basements. */}
          {!belowGrade && atmosphere.groundFogOpacity > 0.001 && (
            <mesh
              position={[origin.x, 0.08, origin.y]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <circleGeometry args={[span * 1.55, 64]} />
              <meshBasicMaterial
                color={atmosphere.hazeColor}
                transparent
                opacity={atmosphere.groundFogOpacity}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          )}

          {/* Physical surface lighting reveals material grain and bevel shadows.
              Edge lines sit on the original geometry, so they describe both the
              outer silhouette and sharp construction creases without changing size. */}
          {boxBatches.batches.map((batch, i) => (
            <mesh key={i} name={batch.wall ? 'Wall surfaces' : batch.intensity ? 'Lit building details' : 'Building details'} {...partEvents(face => `box:${batch.owners[face]}`)} geometry={batch.geometry} castShadow receiveShadow>
              <meshStandardMaterial vertexColors roughness={batch.roughness} map={batch.wall ? wallTexture ?? null : null} emissive={batch.emissive} emissiveIntensity={batch.intensity} />
            </mesh>
          ))}
          <lineSegments geometry={boxBatches.edges} raycast={() => null}><lineBasicMaterial color={NPR_OUTLINE_COLOR} /></lineSegments>
          {selectedBox && <mesh geometry={boxGeometries[selectedBoxIndex]} position={[selectedBox.x, selectedBox.z0 + selectedBox.h / 2, selectedBox.y]} raycast={() => null}>
            <meshBasicMaterial color="#ffcc55" transparent opacity={0.24} depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
            <Edges threshold={24} color="#ffdb72" raycast={() => null} />
          </mesh>}

          {/* Render the solved roof with rough physical shading and ink creases.
              Its exact generated color and bounded same-color emissive lift stay
              intact, preserving the earlier roof-legibility work. */}
          {model.roof && roofSections.map((geometry, i) => (
            <mesh key={i} {...partEvents(`roof:${i}`)} geometry={geometry} castShadow receiveShadow>
              <meshStandardMaterial
                color={houseSurfaceColor('roof', roofTextureKey ?? '', model.roof!.color)}
                roughness={0.94}
                map={roofTexture ?? null}
                emissive={houseSurfaceColor('roof', roofTextureKey ?? '', model.roof!.color)}
                emissiveMap={roofTexture ?? null}
                emissiveIntensity={selectedPart === `roof:${i}` ? 0.8 : atmosphere.roofEmissiveIntensity}
                side={THREE.DoubleSide}
              />
              <Edges threshold={24} color={selectedPart === `roof:${i}` ? '#ffdb72' : NPR_OUTLINE_COLOR} raycast={() => null} />
            </mesh>
          ))}

          {/* Render occupant sphere marks */}
          {model.dots.map((d) => (
            <mesh key={`dot-${d.memberIndex}`} position={[d.x, d.zFt, d.y]} castShadow>
              <sphereGeometry args={[DOT_RADIUS_FT, 16, 12]} />
              <meshToonMaterial
                color={d.color}
                gradientMap={toonGradient()}
                emissive={d.color}
                emissiveIntensity={0.75}
              />
            </mesh>
          ))}

          {/* Real visible chimney boxes are the sole smoke sources. The live
              puffs do not cast shadows or write depth and stay under a fixed cap. */}
          {smokeSources.length > 0 && (
            <SmokePlumes sources={smokeSources} color={atmosphere.hazeColor} />
          )}
        </group>

        {/* This small baked pass supplies the tight, soft occlusion that a sun map
            cannot resolve at pier and wall contacts. Basement cuts hide it with the apron. */}
        {!belowGrade && (
          <ContactShadows
            key={contactShadowKey}
            position={[0, -0.14, 0]}
            opacity={contactShadowOpacity}
            scale={span * 2.4}
            blur={1.4}
            far={bounds.maxY + 1}
            resolution={LAB_CONTACT_SHADOW_RESOLUTION}
            frames={1}
            color="#211b16"
          />
        )}

        {/* A six-foot reference stands on one tactical square. It is a scale
            guide, not an occupant or a claim that every character is six feet. */}
        {!belowGrade && (
          <group position={[bounds.maxX + 4, 0, bounds.maxZ - 3]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
              <planeGeometry args={[5, 5]} />
              <meshBasicMaterial color="#ddb75c" transparent opacity={0.4} side={THREE.DoubleSide} />
              <Edges color="#ffe3a0" />
            </mesh>
            <mesh position={[0, 5.5, 0]} castShadow>
              <sphereGeometry args={[0.5, 12, 8]} />
              <meshToonMaterial color="#e6c77d" gradientMap={toonGradient()} />
            </mesh>
            <mesh position={[0, 3.9, 0]} castShadow>
              <boxGeometry args={[1.5, 2.1, 0.7]} />
              <meshToonMaterial color="#52798d" gradientMap={toonGradient()} />
            </mesh>
            {[-0.45, 0.45].map((x) => (
              <mesh key={x} position={[x, 1.425, 0]} castShadow>
                <boxGeometry args={[0.55, 2.85, 0.65]} />
                <meshToonMaterial color="#354553" gradientMap={toonGradient()} />
              </mesh>
            ))}
            <Html center position={[0, 7.5, 0]} style={{ pointerEvents: 'none', whiteSpace: 'nowrap', color: '#fff3cf', background: '#202933dd', padding: '4px 7px', borderRadius: 4, fontSize: 11 }}>
              6 ft person · 5 × 5 ft square
            </Html>
          </group>
        )}
        <OrbitControls onStart={() => setHoveredPart(null)} target={target} minDistance={8} maxDistance={span * 6 + 100} />
      </Canvas>

      {/* A fixed, canvas-wide stipple breaks up perfectly clean digital color.
          It is deliberately subtle and ignores pointer input, so orbit controls
          and every generated mesh remain exactly as interactive as before. */}
      <div aria-hidden="true" style={PAPER_GRAIN_STYLE} />
      {hovered && hoveredPart && <div ref={tooltipRef} role="tooltip" style={{ position: 'absolute', left: hoveredPart.x, top: hoveredPart.y, pointerEvents: 'none', maxWidth: 210, padding: '7px 10px', borderRadius: 4, background: '#121c24f2', color: '#fff2cf', fontSize: 12, zIndex: 3, textTransform: 'capitalize' }}>{hovered.label}</div>}
      <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, padding: 8, background: '#121c24ed', color: '#e8eced', border: '1px solid #69716b', borderRadius: 4, fontSize: 11 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>Inspect part
          <select aria-label="Inspect building part" value={selectedPart ?? ''} onChange={event => setSelectedPart(event.target.value || null)} style={{ minWidth: 0, flex: 1, background: '#253239', color: '#fff2cf' }}>
            <option value="">Hover or click the building</option>
            {parts.map(part => <option key={part.id} value={part.id}>{part.label}</option>)}
          </select>
        </label>
        {selected && <div aria-live="polite" style={{ marginTop: 6 }}><strong style={{ textTransform: 'capitalize' }}>{selected.label}</strong><div>{selected.detail}</div><button type="button" onClick={() => setSelectedPart(null)} style={{ marginTop: 4 }}>Clear selection</button></div>}
      </div>
    </div>
  );
};

export default PreviewBuilding3D;

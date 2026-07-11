// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/07/2026, 13:10:04
 * Dependents: components/World3D/WebGPUProbe.tsx
 * Imports: 19 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file WebGPUProbeScene.tsx
 * @description PROBE-LOCAL copy of the streamed-world R3F scene, rendered through
 * three.js WebGPURenderer instead of the default WebGLRenderer. This exists to
 * prove the SAME full ground stack the game ships renders on WebGPU hardware.
 *
 * Why a copy (not a prop on World3DScene): the ONLY structural difference is the
 * renderer namespace. WebGPU R3F requires:
 *   1. THREE imported from `three/webgpu` (so WebGPURenderer + node materials exist),
 *   2. `extend(THREE)` so JSX intrinsics (<mesh>, <instancedMesh>, ...) resolve
 *      against the WebGPU namespace,
 *   3. an ASYNC `gl` factory that constructs + `await renderer.init()`s WebGPURenderer.
 * Doing that inside the live World3DScene would swap the renderer for the whole
 * game; keeping it here isolates the experiment (hot-file rule).
 *
 * ── FULL-STACK PARITY (2026-07-04) ──────────────────────────────────────────
 * Beyond terrain + building boxes, this probe now renders the live beautification
 * stack at the same pose:
 *   • procedural instanced TREES  (same treeMeshGenerator + partition as
 *     VegetationTrees.tsx; per-instance color via the instanceColor varying),
 *   • near-camera GRASS           (same buildGrassField as GrassLayer.tsx),
 *   • the full PROP set           (same placeAll routing as GroundProps.tsx —
 *     instanced boulders/logs/bushes/crates/barrels/sacks + composed town props),
 *   • per-chunk BUSHES, styled ROOFS, town WALLS / GATES / DECKS / ROADS.
 * All of it consumes the game's own data (chunk bundles + GroundWorld.props); only
 * the material path changed.
 *
 * PARITY FIX — why materials are hand-lit TSL node materials, not
 * `<meshStandardMaterial>` + scene `<directionalLight>`:
 *
 * On the WebGPU node path (three r0.170) `MeshStandardMaterial`'s lighting is
 * driven by a `LightsNode` built ONCE at first material-compile and never
 * re-detecting lights added afterwards (three.js #30044). With R3F v9's light
 * intrinsics (#2853, "not planned") the captured light set is effectively empty,
 * so every lit surface receives ZERO irradiance — `albedo × 0 = black`. That was
 * the original probe's near-black terrain. The fix (hardware-verified by Remy on
 * an RTX 2070S): bypass the scene-light pipeline — each material is an unlit
 * `MeshBasicNodeMaterial` whose `colorNode` bakes a hemisphere + directional
 * Lambert term against a constant sun. Deterministic, backend-independent, needs
 * no scene lights. Fog + tone mapping still wrap the unlit result.
 *
 * SHADOWS: real-time three.js shadow maps are NOT driven on the WebGPU node path
 * when lighting is baked into colorNode (there is no LightsNode consuming a shadow
 * map). Rather than fake it, the probe reports "Real-time shadows (node path)" as
 * an explicit on-screen MISSING line — see the sub-spec's status note.
 *
 * NO FALLBACK: if WebGPU is unavailable the renderer construction throws and the
 * probe fails loudly; the badge shows the real backend either way.
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, extend, useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import {
  vec3,
  dot,
  max as tslMax,
  normalWorld,
  vertexColor,
  positionWorld,
  dFdx,
  dFdy,
  cross,
  normalize as tslNormalize,
  varyingProperty,
} from 'three/tsl';
import FreeRoamCameraController from './FreeRoamCameraController';
import { useChunkStreaming } from './useChunkStreaming';
import type { ChunkCoord, ChunkLoader, LoadedChunk, VegetationScatter } from '@/systems/world3d/types';
import { chunkOriginWorld, worldToChunk } from '@/systems/world3d/coords';
import { rebaseChunkPositions } from '@/systems/world3d/chunkRebase';
import { worldToScene, type SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { WORLD3D_CONFIG } from '@/systems/world3d/config';
import { sunFromTime, DEFAULT_TIME_OF_DAY_H } from './World3DLighting';
import { buildRoofGeometry } from '@/systems/world3d/buildingModels';
import {
  generateTreeVariantSet,
  SPECIES_HEIGHT_M,
  type TreeGeometryData,
  type TreeSpecies,
} from '@/systems/worldforge/vegetation/treeMeshGenerator';
import { partitionTreeInstances } from '@/systems/worldforge/vegetation/treeInstancePartition';
import { buildGrassField } from '@/systems/worldforge/vegetation/grassField';
import {
  groundSurfaceY,
  type GroundWorld,
} from '@/systems/worldforge/bridge/groundChunkLoader';
import type { PropInstance } from '@/systems/worldforge/props/propSchema';
import { createRockGeometry } from '@/systems/worldforge/props/generators/rockGeometry';
import { createLogGeometry } from '@/systems/worldforge/props/generators/logGeometry';
import { createBushGeometry } from '@/systems/worldforge/props/generators/bushGeometry';
import { buildTownPropForms } from '@/systems/worldforge/props/generators/townPropForms';
import type { ProbeStatus } from './WebGPUProbe';

// Make the WebGPU THREE namespace the source for R3F JSX intrinsics. Without
// this, <meshStandardMaterial> etc. resolve against the default WebGL namespace
// and WebGPURenderer cannot draw them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
extend(THREE as any);

// ── Baked lighting constants ─────────────────────────────────────────────────
// Derived from the SAME sunFromTime model the live World3DLighting uses, at the
// probe's fixed time-of-day, so the baked sun direction/colors match WebGL.
const SUN = sunFromTime(DEFAULT_TIME_OF_DAY_H);
const SUN_DIRECTION: [number, number, number] = SUN.direction;
const SUN_TSL = tslNormalize(vec3(SUN_DIRECTION[0], SUN_DIRECTION[1], SUN_DIRECTION[2]));
const skyC = new THREE.Color(SUN.hemiSkyColor);
const groundC = new THREE.Color(SUN.hemiGroundColor);
const sunColC = new THREE.Color(SUN.sunColor);
const fogC = new THREE.Color(SUN.fogColor);
const SKY_COLOR = vec3(skyC.r, skyC.g, skyC.b);
const GROUND_COLOR = vec3(groundC.r, groundC.g, groundC.b);
const SUN_COLOR = vec3(sunColC.r, sunColC.g, sunColC.b);
const AMBIENT = 0.18;
const SUN_INTENSITY = 0.72 * SUN.sunIntensity; // scaled so albedo×irradiance lands near the WebGL look
const HEMI_INTENSITY = 0.5 * SUN.hemiIntensity;

// TSL node graphs are dynamically typed; these glue helpers pass nodes through
// method chaining where the exported types are too narrow to compose cleanly.
/* eslint-disable @typescript-eslint/no-explicit-any */
type TSLNode = any;

/** Hemisphere + directional Lambert irradiance for a given world normal node. */
function irradianceFor(normalNode: TSLNode): TSLNode {
  const ndl = tslMax(0.0, dot(normalNode, SUN_TSL));
  const sun = SUN_COLOR.mul(SUN_INTENSITY).mul(ndl);
  const hemiMix = normalNode.y.mul(0.5).add(0.5);
  const hemi = GROUND_COLOR.mix(SKY_COLOR, hemiMix).mul(HEMI_INTENSITY);
  return sun.add(hemi).add(vec3(AMBIENT));
}

/** Flat-shaded world normal from screen-space derivatives (matches flatShading). */
const FLAT_NORMAL = tslNormalize(cross(dFdx(positionWorld), dFdy(positionWorld)));

/** albedo × irradiance, smooth vertex normal or a flat facet normal. */
function litColorNode(albedo: TSLNode, flat: boolean): TSLNode {
  const n = flat ? FLAT_NORMAL : normalWorld;
  return albedo.mul(irradianceFor(n));
}

/** Per-instance color varying that NodeMaterial fills from InstancedMesh.instanceColor. */
const INSTANCE_COLOR = varyingProperty('vec3', 'vInstanceColor');
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Material factories (all unlit MeshBasicNodeMaterial, shading in colorNode) ─

function makeTerrainMaterial(): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial();
  m.colorNode = litColorNode(vertexColor(), false);
  return m;
}

function makeVertexColorMaterial(flat = false, doubleSide = false): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial();
  m.colorNode = litColorNode(vertexColor(), flat);
  if (doubleSide) m.side = THREE.DoubleSide;
  return m;
}

function makeLitSolidMaterial(hex: string, flat = false, doubleSide = false): THREE.MeshBasicNodeMaterial {
  const c = new THREE.Color(hex);
  const m = new THREE.MeshBasicNodeMaterial();
  m.colorNode = litColorNode(vec3(c.r, c.g, c.b), flat);
  if (doubleSide) m.side = THREE.DoubleSide;
  return m;
}

/** Instanced solid: base tint × optional per-instance color × irradiance.
 * ALWAYS smooth normalWorld: the screen-space FLAT_NORMAL collapses on instanced
 * geometry and renders black (see makeInstancedTreeMaterial). The owned prop
 * generators (rocks/logs/bushes) author real vertex normals, so smooth shading
 * is faithful. */
function makeInstancedSolidMaterial(hex: string, useInstanceColor: boolean): THREE.MeshBasicNodeMaterial {
  const c = new THREE.Color(hex);
  const m = new THREE.MeshBasicNodeMaterial();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let albedo: TSLNode = vec3(c.r, c.g, c.b);
  if (useInstanceColor) albedo = albedo.mul(INSTANCE_COLOR);
  m.colorNode = litColorNode(albedo, false);
  return m;
}

/** Instanced vertex-color (trees): geometry vertex color × instance color × irradiance.
 * Smooth normalWorld, NOT the screen-space FLAT_NORMAL: on instanced meshes the
 * per-fragment positionWorld derivatives collapse to a degenerate facet normal,
 * which zeroed N·sun and rendered the trees solid black (2026-07-04 capture). The
 * tree geometry carries real vertex normals, so smooth shading is both correct
 * and matches the live MeshStandardMaterial(flatShading) closely enough here. */
function makeInstancedTreeMaterial(): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial();
  // Tree albedo = geometry vertexColor (leaf green / bark brown), lit. We do NOT
  // multiply the per-instance scatter tint: those palette floats are dark
  // (~0.02–0.1) and doubling them into the already sub-1 leaf color crushed the
  // canopies to black. Geometry color alone matches how the terrain reads.
  m.colorNode = litColorNode(vertexColor(), false);
  return m;
}

/** Instanced tinted (grass): white base × instance color × irradiance, double-sided. */
function makeInstancedGrassMaterial(): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial();
  m.colorNode = litColorNode(INSTANCE_COLOR, false);
  m.side = THREE.DoubleSide;
  return m;
}

function makeWaterMaterial(): THREE.MeshBasicNodeMaterial {
  const base = new THREE.Color('#2f78b4');
  const glow = new THREE.Color('#123a5c');
  const m = new THREE.MeshBasicNodeMaterial();
  m.colorNode = vec3(base.r, base.g, base.b)
    .mul(irradianceFor(normalWorld))
    .add(vec3(glow.r, glow.g, glow.b).mul(0.35));
  m.transparent = true;
  m.opacity = 0.86;
  return m;
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

interface DisposableArr {
  positions: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  colors?: Float32Array;
}

function useDisposableGeometry(arr: DisposableArr) {
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

function chunkScenePos(cx: number, cy: number, origin: SceneOrigin): [number, number, number] {
  const o = chunkOriginWorld(cx, cy);
  const s = worldToScene(o.x, o.y, origin);
  return [s.x, 0, s.z];
}

// ── Shared cached geometries (module-stable) ─────────────────────────────────

let sharedTreeGeoms: Map<string, THREE.BufferGeometry> | null = null;
function treeGeometry(species: TreeSpecies, variant: number): THREE.BufferGeometry {
  if (!sharedTreeGeoms) {
    sharedTreeGeoms = new Map();
    const set = generateTreeVariantSet(1337); // same seed as VegetationTrees
    for (const [sp, variants] of Object.entries(set)) {
      (variants as TreeGeometryData[]).forEach((data, v) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
        // Keep the geometry color: it carries the leaf-green / bark-brown that
        // makes a tree read as a tree. This is the tree's albedo (like terrain
        // vertexColor). The per-instance scatter tint is dark palette data and is
        // deliberately NOT multiplied in — doubling two sub-1 colors crushed the
        // canopies to near-black (2026-07-04 capture: instanceColor ≈ 0.01,0.07,0.02).
        g.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
        g.setIndex(new THREE.BufferAttribute(data.indices, 1));
        sharedTreeGeoms!.set(`${sp}|${v}`, g);
      });
    }
  }
  return sharedTreeGeoms.get(`${species}|${variant}`)!;
}

let bladeGeom: THREE.BufferGeometry | null = null;
function grassBladeGeometry(): THREE.BufferGeometry {
  if (bladeGeom) return bladeGeom;
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const halfW = 0.5;
  const tipW = 0.12;
  for (const ang of [0, Math.PI / 2]) {
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const base = positions.length / 3;
    positions.push(-halfW * dx, 0, -halfW * dz, halfW * dx, 0, halfW * dz, tipW * dx, 1, tipW * dz, -tipW * dx, 1, -tipW * dz);
    const nx = -dz;
    const nz = dx;
    for (let i = 0; i < 4; i++) normals.push(nx, 0, nz);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  g.setIndex(indices);
  bladeGeom = g;
  return g;
}

// ── Terrain / water / seam meshes ────────────────────────────────────────────

const TerrainPiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin; anchor: ChunkCoord }> = ({ chunk, origin, anchor }) => {
  const terrain = chunk.bundle.terrain;
  const rebased = useMemo(
    () => ({ ...terrain, positions: rebaseChunkPositions(terrain.positions, chunk.cx - anchor.cx, chunk.cy - anchor.cy) }),
    [terrain, chunk.cx, chunk.cy, anchor],
  );
  const geometry = useDisposableGeometry(rebased);
  const scenePos = chunkScenePos(anchor.cx, anchor.cy, origin);
  const material = useMemo(() => makeTerrainMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh geometry={geometry} position={scenePos} material={material} />;
};

const WaterPiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => {
  const water = chunk.bundle.water;
  const geometry = useDisposableGeometry(
    water ?? { positions: new Float32Array(0), indices: new Uint32Array(0), normals: new Float32Array(0) },
  );
  const material = useMemo(() => makeWaterMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  if (!water) return null;
  return <mesh geometry={geometry} position={chunkScenePos(chunk.cx, chunk.cy, origin)} material={material} />;
};

const RoadPiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin }> = ({ chunk, origin }) => {
  const roads = chunk.bundle.roads;
  const geometry = useDisposableGeometry(
    roads ?? { positions: new Float32Array(0), indices: new Uint32Array(0), normals: new Float32Array(0) },
  );
  // Per-vertex street tiers (buildRoadMesh) render under one flat vertex-color
  // material — WebGPU parity with World3DScene's RoadPiece.
  const material = useMemo(() => makeVertexColorMaterial(true), []);
  useEffect(() => () => material.dispose(), [material]);
  if (!roads) return null;
  return <mesh geometry={geometry} position={chunkScenePos(chunk.cx, chunk.cy, origin)} material={material} />;
};

/** Vertex-colored town masonry (walls / gates / decks): same one shared material. */
const VertexColorPiece: React.FC<{
  arrays?: DisposableArr;
  origin: SceneOrigin;
  cx: number;
  cy: number;
  material: THREE.MeshBasicNodeMaterial;
}> = ({ arrays, origin, cx, cy, material }) => {
  const geometry = useDisposableGeometry(
    arrays ?? { positions: new Float32Array(0), indices: new Uint32Array(0), normals: new Float32Array(0) },
  );
  if (!arrays) return null;
  return <mesh geometry={geometry} position={chunkScenePos(cx, cy, origin)} material={material} />;
};

// ── Buildings + styled roofs ─────────────────────────────────────────────────

const roofGeomCache = new Map<string, THREE.BufferGeometry>();
function roofGeometry(form: 'gable' | 'hip' | 'steep' | 'flat', w: number, d: number, h: number): THREE.BufferGeometry {
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
}

const roofHeight = (w: number, d: number): number => Math.max(1.2, Math.min(3, Math.min(w, d) * 0.5));
const EAVE_M = 0.45;

type SolidMat = (hex: string, flat?: boolean) => THREE.MeshBasicNodeMaterial;

/** Footprint-true building with a STYLED roof (parity with SiteBuilding, minus roof auto-hide). */
const SiteBuilding: React.FC<{ site: LoadedChunk['bundle']['sites'][number]; mat: SolidMat }> = ({ site: s, mat }) => {
  const roofW = s.parts && s.wallWidthM ? s.wallWidthM + EAVE_M * 2 : (s.boxWidth ?? 0) * 1.08;
  const roofD = s.parts && s.wallDepthM ? s.wallDepthM + EAVE_M * 2 : (s.boxDepth ?? 0) * 1.08;
  const rHeight = roofHeight(roofW, roofD);
  const roofForm = s.roofForm ?? 'hip';
  const roofGeo = roofGeometry(roofForm, roofW, roofD, rHeight);
  return (
    <group position={[s.localX, s.surfaceY, s.localZ]} rotation={[0, s.rotationY ?? 0, 0]}>
      {s.parts ? (
        s.parts.map((p, i) => (
          <mesh
            key={`part-${i}`}
            position={[p.x, (p.baseY ?? 0) + p.h * 0.5, p.z * -(s.doorZSign ?? -1)]}
            material={mat(p.colorHex, true)}
          >
            <boxGeometry args={[p.w, p.h, p.d]} />
          </mesh>
        ))
      ) : (
        <mesh position={[0, (s.boxHeight ?? 0) * 0.5, 0]} material={mat(s.colorHex ?? '#b09a72', true)}>
          <boxGeometry args={[s.boxWidth, s.boxHeight, s.boxDepth]} />
        </mesh>
      )}
      {/* Styled roof geometry (buildRoofGeometry), base at y=0, at wall-top Y. */}
      <mesh position={[0, s.boxHeight ?? 0, 0]} geometry={roofGeo} material={mat(s.roofColorHex ?? '#7a4a32', true)} />
    </group>
  );
};

const SitePieces: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin; mat: SolidMat }> = ({ chunk, origin, mat }) => (
  <group position={chunkScenePos(chunk.cx, chunk.cy, origin)}>
    {chunk.bundle.sites.map((s) =>
      s.markerOnly ? null : s.boxWidth && s.boxDepth && s.boxHeight ? (
        <SiteBuilding key={`${chunk.cx}|${chunk.cy}|${s.id}`} site={s} mat={mat} />
      ) : (
        <mesh
          key={`${chunk.cx}|${chunk.cy}|${s.id}`}
          position={[s.localX, s.surfaceY + s.radius * 0.5, s.localZ]}
          material={mat(
            s.kind === 'town' ? '#caa46a' : s.kind === 'dungeon' ? '#555555' : s.kind === 'monster' ? '#d9534f' : '#888888',
            true,
          )}
        >
          <boxGeometry args={[s.radius, s.radius, s.radius]} />
        </mesh>
      ),
    )}
  </group>
);

// ── Vegetation: instanced trees + bushes ─────────────────────────────────────

const TreeBucketMesh: React.FC<{
  species: TreeSpecies;
  variant: number;
  indices: number[];
  scatter: VegetationScatter;
  material: THREE.MeshBasicNodeMaterial;
}> = ({ species, variant, indices, scatter, material }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = treeGeometry(species, variant);
  const count = indices.length;
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const rot = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const baseH = SPECIES_HEIGHT_M[species];
    for (let n = 0; n < count; n++) {
      const i = indices[n];
      const s = scatter.scales[i] * baseH;
      rot.setFromAxisAngle(axis, scatter.rotations[i]);
      pos.set(scatter.positions[i * 3], scatter.positions[i * 3 + 1], scatter.positions[i * 3 + 2]);
      scl.set(s, s, s);
      matrix.compose(pos, rot, scl);
      mesh.setMatrixAt(n, matrix);
    }
    // DELIBERATELY NO setColorAt: on the WebGPU node path the InstanceNode
    // multiplies instanceColor into the color pipeline UNCONDITIONALLY when the
    // buffer exists — and the per-tree scatter tint is dark palette data
    // (~0.02–0.07), which crushes the leaf-green geometry albedo to black.
    // Proven in isolation on a real WebGPU backend: same instanced box renders
    // [0,19,0] WITH a dark instanceColor vs [109,158,88] WITHOUT it (2026-07-04).
    // Leaving instanceColor null lets the geometry vertexColor light correctly.
    mesh.instanceMatrix.needsUpdate = true;
  }, [indices, scatter, count]);
  if (count === 0) return null;
  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} />;
};

const TreesPiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin; material: THREE.MeshBasicNodeMaterial }> = ({ chunk, origin, material }) => {
  const veg = chunk.bundle.vegetation;
  const buckets = useMemo(() => (veg ? partitionTreeInstances(veg) : []), [veg]);
  if (!veg) return null;
  return (
    <group position={chunkScenePos(chunk.cx, chunk.cy, origin)}>
      {buckets
        .filter((b) => b.instanceIndices.length > 0)
        .map((b) => (
          <TreeBucketMesh
            key={`${b.species}|${b.variant}`}
            species={b.species}
            variant={b.variant}
            indices={b.instanceIndices}
            scatter={veg}
            material={material}
          />
        ))}
    </group>
  );
};

// Bushes share one small geometry for the lifetime of the scene module. Creating
// it outside render preserves the old singleton behavior without a render-time mutation.
const BUSH_SPHERE = new THREE.SphereGeometry(1, 6, 4);
const BushPiece: React.FC<{ chunk: LoadedChunk; origin: SceneOrigin; material: THREE.MeshBasicNodeMaterial }> = ({ chunk, origin, material }) => {
  const bushes = chunk.bundle.bushes;
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = bushes ? bushes.positions.length / 3 : 0;
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh || !bushes) return;
    const matrix = new THREE.Matrix4();
    const rot = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const s = bushes.scales[i];
      rot.setFromAxisAngle(axis, bushes.rotations[i]);
      pos.set(bushes.positions[i * 3], bushes.positions[i * 3 + 1], bushes.positions[i * 3 + 2]);
      scl.set(s, s, s);
      matrix.compose(pos, rot, scl);
      mesh.setMatrixAt(i, matrix);
    }
    // NO setColorAt (see TreeBucketMesh): the bush sphere has no geometry color
    // and its per-instance scatter tint is dark; injecting instanceColor would
    // crush the solid leaf-green material to black on the node path. The solid
    // '#4f7a3a' material carries the green instead.
    mesh.instanceMatrix.needsUpdate = true;
  }, [bushes, count]);
  if (!bushes || count === 0) return null;
  return (
    <group position={chunkScenePos(chunk.cx, chunk.cy, origin)}>
      <instancedMesh ref={ref} args={[BUSH_SPHERE, material, count]} frustumCulled={false} />
    </group>
  );
};

// ── Near-camera grass ─────────────────────────────────────────────────────────

const GRASS_CHUNK_RADIUS = 1;
const GrassPiece: React.FC<{
  chunk: LoadedChunk;
  anchor: ChunkCoord;
  origin: SceneOrigin;
  material: THREE.MeshBasicNodeMaterial;
}> = ({ chunk, anchor, origin, material }) => {
  const near = Math.max(Math.abs(chunk.cx - anchor.cx), Math.abs(chunk.cy - anchor.cy)) <= GRASS_CHUNK_RADIUS;
  const terrain = chunk.bundle.terrain;
  const field = useMemo(() => {
    if (!near) return null;
    return buildGrassField(terrain, chunk.cx, chunk.cy, { chunkSize: WORLD3D_CONFIG.CHUNK_WORLD_SIZE });
  }, [near, terrain, chunk.cx, chunk.cy]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh || !field) return;
    const matrix = new THREE.Matrix4();
    const rot = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const color = new THREE.Color();
    for (let i = 0; i < field.count; i++) {
      const s = field.scales[i];
      rot.setFromAxisAngle(axis, field.rotations[i]);
      pos.set(field.positions[i * 3], field.positions[i * 3 + 1] - 0.03, field.positions[i * 3 + 2]);
      scl.set(s * 0.3, s * 0.6, s * 0.3);
      matrix.compose(pos, rot, scl);
      mesh.setMatrixAt(i, matrix);
      color.setRGB(field.tints[i * 3], field.tints[i * 3 + 1], field.tints[i * 3 + 2], THREE.SRGBColorSpace);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [field]);
  if (!field || field.count === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      key={field.cacheKey}
      args={[grassBladeGeometry(), material, field.count]}
      position={chunkScenePos(chunk.cx, chunk.cy, origin)}
      frustumCulled={false}
    />
  );
};

// ── Props (GroundWorld.props) — mirrors GroundProps.tsx routing ───────────────

const WOOD = '#8a6a48';
const WOOD_DARK = '#6e5238';
const WOOD_PALE = '#a58a63';
const STONE = '#8d8d86';
const ROCK = '#7d7a72';
const LEAF = '#4f7a3a';
const HAY = '#c9a94e';
const SACK = '#b3a07d';
const CANVAS = '#d8cfb6';
const CANVAS_RED = '#b0563f';

interface Placed {
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number;
  variant: number;
}

// Same defId → render-form routing GroundProps.tsx uses (kept in sync manually;
// this is a DELIBERATE reuse map, not a silent fallback). The 13 defs GRADUATED
// to owned seeded meshes (townPropForms: gravestone/tomb/stone-cross,
// lantern-post/tavern-sign/fingerpost, statue/milestone/wayside-shrine,
// anvil/grindstone, scarecrow, brazier) are ABSENT here — they keep their own
// id and render via the vertex-colored town forms below (mirrors GroundProps
// 2026-07-04).
const RENDER_VARIANT: Record<string, string> = {
  'boundary-wall': 'boulder',
  'stone-planter': 'boulder', 'stone-bench': 'boulder',
  cairn: 'boulder', 'standing-stone': 'boulder', 'rock-outcrop': 'boulder',
  'mossy-rock-cluster': 'boulder', 'broken-wall': 'boulder', 'rubble-pile': 'boulder', 'toppled-column': 'boulder',
  'dry-stone-wall': 'boulder', 'gravel-bar': 'boulder',
  'tree-stump': 'fallen-log', 'driftwood-pile': 'fallen-log', 'log-bridge': 'fallen-log', 'roof-beam-charred': 'fallen-log',
  'dead-snag': 'fallen-log', 'jetty-post': 'fallen-log', plough: 'fallen-log',
  'bramble-patch': 'bush', deadfall: 'bush', 'fern-clump': 'bush', 'gorse-shrub': 'bush', 'hedge-run': 'bush',
  'reed-bed': 'bush', topiary: 'bush', 'ivy-mass': 'bush', 'mushroom-ring': 'bush',
  'produce-basket': 'crate', 'notice-board': 'crate', 'net-drying-rack': 'crate', 'tool-rack': 'crate',
  'metal-bar-stack': 'crate', 'chicken-coop': 'crate', 'trestle-table': 'crate', 'wood-bench': 'crate',
  beehive: 'crate',
  'fish-barrel': 'barrel', 'slop-bucket': 'barrel', 'overturned-barrel': 'barrel', 'coiled-rope': 'barrel',
  'mooring-post': 'barrel', 'awning-pole': 'barrel',
  'coal-heap': 'sack', 'rubbish-heap': 'sack',
};
const renderFormFor = (defId: string): string => RENDER_VARIANT[defId] ?? defId;

function placeAll(props: PropInstance[], ground: GroundWorld, origin: SceneOrigin): Map<string, Placed[]> {
  const byDef = new Map<string, Placed[]>();
  for (const p of props) {
    const y = groundSurfaceY(ground, p.xM, p.zM);
    const form = renderFormFor(p.defId);
    let list = byDef.get(form);
    if (!list) byDef.set(form, (list = []));
    list.push({ x: p.xM - origin.x, y, z: p.zM - origin.z, rot: p.rotationRad, scale: p.variation.scale, variant: p.variation.variant });
  }
  return byDef;
}

/** Instanced prop form (boulders/logs/bushes/crates/barrels/sacks/hay). */
const InstancedForm: React.FC<{
  items: Placed[];
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicNodeMaterial;
  base: [number, number, number];
  yLift: number;
}> = ({ items, geometry, material, base, yLift }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const s = new THREE.Vector3();
    const pos = new THREE.Vector3();
    items.forEach((it, i) => {
      q.setFromAxisAngle(up, it.rot);
      s.set(base[0] * it.scale, base[1] * it.scale, base[2] * it.scale);
      pos.set(it.x, it.y + base[1] * it.scale * yLift, it.z);
      m.compose(pos, q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [items, base, yLift]);
  if (items.length === 0) return null;
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} frustumCulled={false} />;
};

const PropGroup: React.FC<{ ground: GroundWorld; origin: SceneOrigin; mat: SolidMat }> = ({ ground, origin, mat }) => {
  const byDef = useMemo(
    () => (ground.props?.length ? placeAll(ground.props, ground, origin) : null),
    [ground, origin],
  );
  const geoms = useMemo(
    () => ({
      box: new THREE.BoxGeometry(1, 1, 1),
      barrel: new THREE.CylinderGeometry(0.42, 0.36, 1, 10),
      sack: new THREE.SphereGeometry(0.5, 8, 6),
      hay: new THREE.SphereGeometry(0.5, 8, 6),
      bushes: [0, 1, 2].map((i) => createBushGeometry(i + 21) as unknown as THREE.BufferGeometry),
      boulders: [0, 1, 2, 3].map((i) => createRockGeometry(i + 7) as unknown as THREE.BufferGeometry),
      logs: [0, 1, 2].map((i) => createLogGeometry(i + 42) as unknown as THREE.BufferGeometry),
      // Owned town-prop forms (frozen-seed variant cache): unit-frame,
      // ground-origin geometries with baked vertex colors — same generator set
      // GroundProps renders (townPropForms, 2026-07-04).
      town: buildTownPropForms() as unknown as Record<string, { geometries: THREE.BufferGeometry[] }>,
    }),
    [],
  );
  const mats = useMemo(
    () => ({
      // Instanced forms → smooth-normal instanced-solid materials (flat facet
      // normal collapses to black on instanced geometry; the generators author
      // real vertex normals).
      wood: makeInstancedSolidMaterial(WOOD, false),
      woodDark: makeInstancedSolidMaterial(WOOD_DARK, false),
      sack: makeInstancedSolidMaterial(SACK, false),
      hay: makeInstancedSolidMaterial(HAY, false),
      leaf: makeInstancedSolidMaterial(LEAF, false),
      rock: makeInstancedSolidMaterial(ROCK, false),
      // Town forms carry their OWN baked vertex colors → lit vertexColor albedo,
      // smooth normals. InstancedForm never calls setColorAt, so instanceColor
      // stays null — required: the node-path InstanceNode would otherwise
      // multiply a dark instance tint in and crush the baked colors to black
      // (the instanceColor-crushes-vertex-color bug proven earlier today).
      townVertex: makeVertexColorMaterial(false),
    }),
    [],
  );
  if (!byDef) return null;
  const get = (id: string) => byDef.get(id) ?? [];
  const bouldersByVariant: Placed[][] = [[], [], [], []];
  for (const b of get('boulder')) bouldersByVariant[b.variant % 4].push(b);
  const bushesByVariant: Placed[][] = [[], [], []];
  for (const b of get('bush')) bushesByVariant[b.variant % 3].push(b);
  const logsByVariant: Placed[][] = [[], [], []];
  for (const l of get('fallen-log')) logsByVariant[l.variant % 3].push(l);

  return (
    <group name="probe-props">
      <InstancedForm items={get('crate')} geometry={geoms.box} material={mats.wood} base={[0.75, 0.75, 0.75]} yLift={0.5} />
      <InstancedForm items={get('barrel')} geometry={geoms.barrel} material={mats.woodDark} base={[1, 0.95, 1]} yLift={0.5} />
      <InstancedForm items={get('sack')} geometry={geoms.sack} material={mats.sack} base={[0.9, 0.55, 0.9]} yLift={0.45} />
      <InstancedForm items={get('haystack')} geometry={geoms.hay} material={mats.hay} base={[2.4, 1.9, 2.4]} yLift={0.42} />
      {bushesByVariant.map((items, i) => (
        <InstancedForm key={`bush-${i}`} items={items} geometry={geoms.bushes[i]} material={mats.leaf} base={[1.5, 1.1, 1.5]} yLift={0.45} />
      ))}
      {logsByVariant.map((items, i) => (
        <InstancedForm key={`log-${i}`} items={items} geometry={geoms.logs[i]} material={mats.woodDark} base={[1, 1, 1]} yLift={0} />
      ))}
      {bouldersByVariant.map((items, i) => (
        <InstancedForm key={`rock-${i}`} items={items} geometry={geoms.boulders[i]} material={mats.rock} base={[1.7, 1.3, 1.7]} yLift={0.3} />
      ))}
      {/* Owned town-prop forms: one instanced mesh per (def, variant); unit
          frame with ground contact at y=0 → identity base, yLift 0 (mirrors
          GroundProps). Vertex-colored via mats.townVertex. */}
      {Object.entries(geoms.town).flatMap(([defId, form]) => {
        const all = get(defId);
        if (all.length === 0) return [];
        const byVariant: Placed[][] = form.geometries.map(() => []);
        for (const it of all) byVariant[it.variant % form.geometries.length].push(it);
        return byVariant.map((items, i) => (
          <InstancedForm
            key={`${defId}-${i}`}
            items={items}
            geometry={form.geometries[i]}
            material={mats.townVertex}
            base={[1, 1, 1]}
            yLift={0}
          />
        ));
      })}
      {/* Composed low-count forms */}
      {get('market-stall').map((p, i) => <MarketStall key={i} p={p} mat={mat} />)}
      {get('woodpile').map((p, i) => <Woodpile key={i} p={p} mat={mat} />)}
      {get('fence-run').map((p, i) => <FenceRun key={i} p={p} mat={mat} />)}
      {get('well').map((p, i) => <Well key={i} p={p} mat={mat} />)}
      {get('water-trough').map((p, i) => <Trough key={i} p={p} mat={mat} />)}
      {get('cart').map((p, i) => <Cart key={i} p={p} mat={mat} />)}
      {get('crate-stack').map((p, i) => <CrateStack key={i} p={p} mat={mat} />)}
    </group>
  );
};

// Composed props (a few primitives each) — reuse the shared solid-material cache.
const MarketStall: React.FC<{ p: Placed; mat: SolidMat }> = ({ p, mat }) => {
  const awning = p.variant % 2 === 0 ? CANVAS : CANVAS_RED;
  return (
    <group position={[p.x, p.y, p.z]} rotation={[0, p.rot, 0]} scale={p.scale}>
      {([[-1.1, -0.7], [1.1, -0.7], [-1.1, 0.7], [1.1, 0.7]] as const).map(([px, pz], i) => (
        <mesh key={i} position={[px, 1.05, pz]} material={mat(WOOD_DARK, true)}>
          <cylinderGeometry args={[0.05, 0.06, 2.1, 6]} />
        </mesh>
      ))}
      <mesh position={[0, 0.85, 0]} material={mat(WOOD, true)}><boxGeometry args={[2.4, 0.1, 1.5]} /></mesh>
      <mesh position={[0, 2.25, 0.15]} rotation={[-0.35, 0, 0]} material={mat(awning, true)}><boxGeometry args={[2.6, 0.05, 1.9]} /></mesh>
    </group>
  );
};

const Woodpile: React.FC<{ p: Placed; mat: SolidMat }> = ({ p, mat }) => (
  <group position={[p.x, p.y, p.z]} rotation={[0, p.rot, 0]} scale={p.scale}>
    {([[-0.3, 0.15], [0, 0.15], [0.3, 0.15], [-0.15, 0.42], [0.15, 0.42], [0, 0.68]] as const).map(([ox, oy], i) => (
      <mesh key={i} position={[ox, oy, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat(i % 2 ? WOOD_DARK : WOOD, true)}>
        <cylinderGeometry args={[0.14, 0.14, 1.4, 7]} />
      </mesh>
    ))}
  </group>
);

const FenceRun: React.FC<{ p: Placed; mat: SolidMat }> = ({ p, mat }) => (
  <group position={[p.x, p.y, p.z]} rotation={[0, p.rot, 0]} scale={p.scale}>
    {[-3, -1, 1, 3].map((ox, i) => (
      <mesh key={i} position={[ox, 0.55, 0]} material={mat(WOOD_DARK, true)}><boxGeometry args={[0.12, 1.1, 0.12]} /></mesh>
    ))}
    <mesh position={[0, 0.85, 0]} material={mat(WOOD, true)}><boxGeometry args={[6.4, 0.08, 0.08]} /></mesh>
    <mesh position={[0, 0.45, 0]} material={mat(WOOD, true)}><boxGeometry args={[6.4, 0.08, 0.08]} /></mesh>
  </group>
);

const Well: React.FC<{ p: Placed; mat: SolidMat }> = ({ p, mat }) => (
  <group position={[p.x, p.y, p.z]} rotation={[0, p.rot, 0]} scale={p.scale}>
    <mesh position={[0, 0.45, 0]} material={mat(STONE, true)}><cylinderGeometry args={[0.8, 0.85, 0.9, 10]} /></mesh>
    <mesh position={[-0.75, 1.3, 0]} material={mat(WOOD_DARK, true)}><boxGeometry args={[0.1, 1.8, 0.1]} /></mesh>
    <mesh position={[0.75, 1.3, 0]} material={mat(WOOD_DARK, true)}><boxGeometry args={[0.1, 1.8, 0.1]} /></mesh>
    <mesh position={[0, 2.35, 0]} rotation={[0, 0, Math.PI / 4]} material={mat(WOOD, true)}><boxGeometry args={[1.5, 1.5, 1.6]} /></mesh>
  </group>
);

const Trough: React.FC<{ p: Placed; mat: SolidMat }> = ({ p, mat }) => (
  <group position={[p.x, p.y, p.z]} rotation={[0, p.rot, 0]} scale={p.scale}>
    <mesh position={[0, 0.06, 0]} material={mat(WOOD_DARK, true)}><boxGeometry args={[1.8, 0.12, 0.7]} /></mesh>
    <mesh position={[0, 0.3, -0.31]} material={mat(WOOD, true)}><boxGeometry args={[1.8, 0.5, 0.08]} /></mesh>
    <mesh position={[0, 0.3, 0.31]} material={mat(WOOD, true)}><boxGeometry args={[1.8, 0.5, 0.08]} /></mesh>
    <mesh position={[-0.86, 0.3, 0]} material={mat(WOOD, true)}><boxGeometry args={[0.08, 0.5, 0.7]} /></mesh>
    <mesh position={[0.86, 0.3, 0]} material={mat(WOOD, true)}><boxGeometry args={[0.08, 0.5, 0.7]} /></mesh>
    <mesh position={[0, 0.4, 0]} material={mat('#4a7d96', true)}><boxGeometry args={[1.62, 0.02, 0.52]} /></mesh>
  </group>
);

const Cart: React.FC<{ p: Placed; mat: SolidMat }> = ({ p, mat }) => (
  <group position={[p.x, p.y, p.z]} rotation={[0, p.rot, 0]} scale={p.scale}>
    <mesh position={[0, 0.62, 0]} material={mat(WOOD, true)}><boxGeometry args={[2.0, 0.12, 1.1]} /></mesh>
    <mesh position={[0, 0.85, -0.5]} material={mat(WOOD_PALE, true)}><boxGeometry args={[2.0, 0.35, 0.06]} /></mesh>
    <mesh position={[0, 0.85, 0.5]} material={mat(WOOD_PALE, true)}><boxGeometry args={[2.0, 0.35, 0.06]} /></mesh>
    <mesh position={[0, 0.45, -0.62]} rotation={[Math.PI / 2, 0, 0]} material={mat(WOOD_DARK, true)}><cylinderGeometry args={[0.45, 0.45, 0.08, 10]} /></mesh>
    <mesh position={[0, 0.45, 0.62]} rotation={[Math.PI / 2, 0, 0]} material={mat(WOOD_DARK, true)}><cylinderGeometry args={[0.45, 0.45, 0.08, 10]} /></mesh>
    <mesh position={[1.35, 0.75, 0]} rotation={[0, 0, -0.25]} material={mat(WOOD_DARK, true)}><boxGeometry args={[0.9, 0.07, 0.07]} /></mesh>
  </group>
);

const CrateStack: React.FC<{ p: Placed; mat: SolidMat }> = ({ p, mat }) => (
  <group position={[p.x, p.y, p.z]} rotation={[0, p.rot, 0]} scale={p.scale}>
    <mesh position={[-0.35, 0.35, 0]} material={mat(WOOD, true)}><boxGeometry args={[0.7, 0.7, 0.7]} /></mesh>
    <mesh position={[0.4, 0.3, 0.1]} rotation={[0, 0.3, 0]} material={mat(WOOD_PALE, true)}><boxGeometry args={[0.6, 0.6, 0.6]} /></mesh>
    <mesh position={[-0.1, 0.98, 0.05]} rotation={[0, -0.2, 0]} material={mat(WOOD_DARK, true)}><boxGeometry args={[0.62, 0.62, 0.62]} /></mesh>
  </group>
);

// ── Instrument: FPS + backend + MISSING reporter ─────────────────────────────

const ProbeInstrument: React.FC<{ onStatus: (s: ProbeStatus) => void; missing: string[]; backend: ProbeStatus['backend'] }> = ({ onStatus, missing, backend }) => {
  const frames = useRef(0);
  const last = useRef(performance.now());
  const fps = useRef(0);
  useFrame(() => {
    frames.current += 1;
    const now = performance.now();
    if (now - last.current >= 500) {
      fps.current = Math.round((frames.current * 1000) / (now - last.current));
      (window as unknown as { __webgpuProbeFps?: number }).__webgpuProbeFps = fps.current;
      frames.current = 0;
      last.current = now;
      onStatus({ backend, fps: fps.current, missing });
    }
  });
  return null;
};

// ── Scene ─────────────────────────────────────────────────────────────────────

interface Props {
  loader: ChunkLoader;
  ground: GroundWorld;
  start: readonly [number, number, number];
  startSurfaceY: number;
  onStatus: (s: ProbeStatus) => void;
  /** FAIL-FAST: called when the renderer inits but is NOT a WebGPU backend, or
   *  init throws. The host tears the scene down to the error pane (no fallback). */
  onFatal: (reason: string) => void;
}

const WebGPUProbeScene: React.FC<Props> = ({ loader, ground, start, startSurfaceY, onStatus, onFatal }) => {
  const { loaded, update } = useChunkStreaming(loader);
  const sceneOrigin: SceneOrigin = useMemo(() => ({ x: start[0], z: start[2] }), [start]);
  const anchorChunk: ChunkCoord = useMemo(() => worldToChunk(sceneOrigin.x, sceneOrigin.z), [sceneOrigin]);
  const backendRef = useRef<ProbeStatus['backend']>('unknown');
  const fatalRef = useRef(false);

  // Shared materials for the town masonry + trees/grass/bushes/buildings.
  const wallMat = useMemo(() => makeVertexColorMaterial(false, true), []);
  const treeMat = useMemo(() => makeInstancedTreeMaterial(), []);
  const grassMat = useMemo(() => makeInstancedGrassMaterial(), []);
  const solidCache = useMemo(() => new Map<string, THREE.MeshBasicNodeMaterial>(), []);
  const solidMat: SolidMat = useMemo(
    () => (hex: string, flat = false) => {
      const key = `${hex}|${flat ? 1 : 0}`;
      let m = solidCache.get(key);
      if (!m) solidCache.set(key, (m = makeLitSolidMaterial(hex, flat)));
      return m;
    },
    [solidCache],
  );

  // Bush spheres carry no geometry color and their per-instance scatter tint is
  // dark palette data (crushes to black when used as albedo). Render them a solid
  // lit leaf-green instead — matches the GroundProps bush look at walking scale.
  const bushSolidMat = useMemo(() => makeInstancedSolidMaterial('#4f7a3a', false), []);

  // Real-time shadows are not achievable with baked-colorNode lighting on the
  // node path (no LightsNode consumes a shadow map). Report it honestly.
  const missing = useMemo(() => ['Real-time shadows (node path, three 0.170)'], []);

  const camPosition = useMemo<[number, number, number]>(() => [60, startSurfaceY + 35, 60], [startSurfaceY]);

  useEffect(() => {
    update(start[0], start[2]);
  }, [update, start]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '520px', background: '#cdd9e6', borderRadius: '12px', overflow: 'hidden' }}>
      <Canvas
        camera={{ fov: 55, near: 1, far: 60000, position: camPosition }}
        onCreated={({ scene }) => {
          (window as unknown as { __wf3dScene?: unknown }).__wf3dScene = scene;
        }}
        gl={async (props) => {
          // FAIL-FAST, NO FALLBACK. The host already pre-checked navigator.gpu +
          // requestAdapter() before mounting this scene. Here we construct the
          // renderer and, after init, assert the backend really is WebGPU. three's
          // WebGPURenderer silently falls back to WebGL2 if the device can't come
          // up — that is forbidden: we detect a non-WebGPU backend (or an init
          // failure/timeout) and route the host to the error pane via onFatal.
          const renderer = new THREE.WebGPURenderer(props as ConstructorParameters<typeof THREE.WebGPURenderer>[0]);
          const w = window as unknown as { __webgpuProbeBackend?: string; __webgpuProbeReady?: boolean; __wf3dRenderer?: unknown };
          try {
            await Promise.race([
              renderer.init(),
              new Promise((_r, rej) => setTimeout(() => rej(new Error('WebGPU init timed out (>8s) — device never came up')), 8000)),
            ]);
          } catch (e) {
            fatalRef.current = true;
            w.__webgpuProbeBackend = 'init-failed';
            w.__webgpuProbeReady = true;
            // eslint-disable-next-line no-console
            console.error('[webgpuProbe] init failed:', e);
            onFatal(`WebGPU renderer init failed: ${(e as Error).message}`);
            throw e; // fail loudly
          }
          const backend = (renderer as unknown as { backend?: { isWebGPUBackend?: boolean } }).backend;
          const isWebGPU = !!backend?.isWebGPUBackend;
          w.__webgpuProbeReady = true;
          w.__wf3dRenderer = renderer;
          if (!isWebGPU) {
            // Renderer initialized but silently chose WebGL2 — treat as failure.
            fatalRef.current = true;
            backendRef.current = 'unknown';
            w.__webgpuProbeBackend = 'webgl(fallback-rejected)';
            // eslint-disable-next-line no-console
            console.error('[webgpuProbe] renderer backend is NOT WebGPU — rejecting (no fallback)');
            onFatal('WebGPURenderer initialized but reported a non-WebGPU backend (silent WebGL2 fallback) — rejected.');
            throw new Error('non-WebGPU backend rejected');
          }
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.05;
          backendRef.current = 'webgpu';
          w.__webgpuProbeBackend = 'webgpu';
          onStatus({ backend: 'webgpu', fps: 0, missing });
          // eslint-disable-next-line no-console
          console.info('[webgpuProbe] renderer backend = webgpu');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return renderer as any;
        }}
      >
        {/* Baked lighting: no scene lights (see PARITY FIX). Fog + tone mapping
            still apply; fog color matches the World3DLighting ground profile. */}
        <fog attach="fog" args={[fogC.getHex(), 450, 2000]} />
        <FreeRoamCameraController
          initialTarget={[0, startSurfaceY, 0]}
          sceneOrigin={sceneOrigin}
          onPositionChange={update}
          minDistance={2}
          maxDistance={1500}
        />
        <ProbeInstrument onStatus={onStatus} missing={missing} backend={backendRef.current} />
        {loaded.map((c) => (
          <React.Fragment key={`${c.cx}|${c.cy}`}>
            <TerrainPiece chunk={c} origin={sceneOrigin} anchor={anchorChunk} />
            <WaterPiece chunk={c} origin={sceneOrigin} />
            <RoadPiece chunk={c} origin={sceneOrigin} />
            <VertexColorPiece arrays={c.bundle.walls} origin={sceneOrigin} cx={c.cx} cy={c.cy} material={wallMat} />
            <VertexColorPiece arrays={c.bundle.gates} origin={sceneOrigin} cx={c.cx} cy={c.cy} material={wallMat} />
            <VertexColorPiece arrays={c.bundle.decks} origin={sceneOrigin} cx={c.cx} cy={c.cy} material={wallMat} />
            <SitePieces chunk={c} origin={sceneOrigin} mat={solidMat} />
            <TreesPiece chunk={c} origin={sceneOrigin} material={treeMat} />
            <BushPiece chunk={c} origin={sceneOrigin} material={bushSolidMat} />
            <GrassPiece chunk={c} anchor={anchorChunk} origin={sceneOrigin} material={grassMat} />
          </React.Fragment>
        ))}
        <PropGroup ground={ground} origin={sceneOrigin} mat={solidMat} />
      </Canvas>
    </div>
  );
};

export default WebGPUProbeScene;

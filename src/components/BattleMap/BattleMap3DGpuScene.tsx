/**
 * @file BattleMap3DGpuScene.tsx
 * @description EXPERIMENTAL WebGPU render path for the 3D tactical battle map
 * (beautification wave, WebGPU migration — spec
 * docs/superpowers/specs/2026-07-02-world-beautification-wave.md §8; sub-spec
 * docs/superpowers/specs/subspecs/beautification--prop-schema-placement-engine.md).
 *
 * Selected only when the WebGPU battle-map flag is on (`?gpu=1`, see
 * webgpuBattleMapFlag.ts). WebGL BattleMap3D remains the default.
 *
 * WHY A SIBLING SCENE (not a prop on BattleMap3D):
 * The live BattleMap3D tree is built on classic WebGL constructs that do NOT
 * survive the WebGPU node path:
 *   - every surface is `<meshStandardMaterial>` lit by scene `<directionalLight>`
 *     / `<hemisphereLight>` — which render BLACK on WebGPU because the node-path
 *     `LightsNode` never detects R3F-added lights (three #30044 / r3f #2853),
 *   - the terrain's procedural texturing is injected via `onBeforeCompile` GLSL
 *     (no node-path equivalent),
 *   - `@react-three/postprocessing` (Bloom/Vignette) and drei `<Sky>`/`<Html>`
 *     helpers are WebGL `EffectComposer`/shader based.
 * So — exactly as the validated probe did (WebGPUProbeScene.tsx) — this is a
 * trimmed, self-contained scene that renders the SAME shared `mapData` /
 * `characters` through the proven baked-TSL pattern: an unlit
 * `MeshBasicNodeMaterial` whose `colorNode` bakes a hemisphere + directional
 * Lambert term against a constant sun, needing no scene lights.
 *
 * GAME LOGIC IS UNTOUCHED: this file only renders. BattleMap3D owns the combat
 * hooks and passes resolved data (map, characters, valid moves, active path,
 * AoE set) in.
 *
 * ── PORTED RUNGS (wave spec §8, this slice) ──────────────────────────────────
 *   1. Procedural terrain texturing — the WebGL `onBeforeCompile` GLSL (per-type
 *      palettes, organic edge blend, slope-rock, wet banks, canopy dapple) is
 *      TRANSLATED to a TSL node graph (`gpu/terrainColorNode.ts`), NOT a flat
 *      per-tile palette. Baked-lighting multiply on top.
 *   2. Vegetation + props — instanced grass (GrassLayer placement) + ground
 *      scatter (GroundScatter placement) rendered as instanced baked-TSL meshes.
 *   3. Grid + movement/path/AoE overlay — TSL translation of GridOverlay's
 *      tile-state shader (`gpu/gridOverlayNodes.ts`), terrain-conforming,
 *      fade-lerped like the WebGL overlay.
 *   4. Character/enemy actors — REAL generated bodies. `EntityModel` (the same
 *      component the WebGL `CharacterActor` mounts) renders each combatant's
 *      procedural humanoid/creature, with team-color ground rings, an HP-driven
 *      ring fade, a death desaturation, and selection + active-turn rings.
 *      (Previously lit capsules: the deferral blamed the whole 1,491-line
 *      CharacterActor rig, but the body itself needed only two things — the
 *      raw-GLSL ink/blob materials rebuilt as nodes, and the LIT toon material
 *      rebuilt as a baked unlit one, since this scene has no lights. Both live
 *      in `systems/entities3d/three/gpu/`.)
 *   4b. Actor CHROME — nameplate, HP pip, defeat + temporary-HP markers,
 *      defense and condition chips, and the fresnel rim (agora-a2b8). The
 *      `<Html>` pieces are the SAME components the WebGL actor mounts
 *      (`characters/characterActor/actorChromeHtml`) — a drei `<Html>` is a
 *      DOM overlay, not a shader, so it crosses unchanged. Only the lit HP
 *      pip is rebuilt unlit (`gpu/GpuActorChrome`), and the rim is rebuilt
 *      as TSL in `three/gpu/toonNodes.ts`.
 *   5. Post-processing — three's node `PostProcessing` bloom + a TSL vignette
 *      (matches the WebGL EffectComposer look), driven manually with a
 *      `frameloop="never"` render loop.
 *
 * EXPLICIT MISSING (shown on-screen, honest — NO faking, NO silent fallback):
 *   - Real-time shadows: baked colorNode lighting has no `LightsNode` to consume
 *     a shadow map on the node path (three 0.170).
 *   - Condition TINT and desaturation on the body (`useFresnelRim`'s G10
 *     stage): live per-character uniforms driven by conditions, carried by a
 *     GLSL patch the material swap drops. Defeat is covered (the baked
 *     material's death-fade uniform), the condition hues are not. The rest of
 *     the chrome — nameplates, pip, badges, rim — is no longer missing; see
 *     rungs 4 and 4b.
 *   - GPU wind sway on grass (WebGL animates blades in the vertex shader; here
 *     the blades are static — the meadow reads, the sway does not).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 13:18:57
 * Dependents: components/BattleMap/BattleMap3D.tsx
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, extend, useFrame, useThree, type Catalogue, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import {
  vec3,
  dot,
  max as tslMax,
  min as tslMin,
  float,
  normalWorld,
  vertexColor,
  uniform,
  positionWorld,
  uv,
  smoothstep,
  normalize as tslNormalize,
} from 'three/tsl';
import type { WebGLRenderer } from 'three';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../types/combat';
import { CameraController } from './camera';
import { makeTerrainHeightSampler } from './terrain/TerrainMesh';
import {
  buildTerrainAlbedoNode,
  terrainFlatNormalNode,
} from './gpu/terrainColorNode';
import { buildGridColorNode, buildGridOpacityNode } from './gpu/gridOverlayNodes';
import { PerfProbe } from '../../devtools/perf';
import { EntityModel } from './characters/characterActor/EntityModel';
import type { AnimationState } from './characters/characterActor/models';
import { TEAM_COLORS } from './characters/characterActor/actorTheme';
import { actorHpColor } from './characters/characterActor/actorChromeHtml';
import { GpuActorChrome } from './gpu/GpuActorChrome';
import { getDistance } from '../../utils/combat/combatUtils';
import { heightM } from '@/systems/entities3d/types';
import { registerAllParts } from '@/systems/entities3d/parts';
import { generateEntityBlueprint } from '@/systems/entities3d/generateEntityBlueprint';
import { recipeFromCombatant } from '@/systems/entities3d/recipeFromCombatant';
import {
  setEntityConditionTint,
  setEntityDeathFade,
  swapEntityMaterialsForGpu,
} from '@/systems/entities3d/three/gpu/gpuMaterialSwap';
import { resolveDominantCondition } from '@/utils/visuals/conditionPalette';

// WebGPU R3F requires the JSX intrinsics (<mesh>, <group>, ...) to resolve
// against the `three/webgpu` namespace, or WebGPURenderer cannot draw them.
// `Catalogue` is R3F's own JSX-intrinsic registry type. The two-step cast is
// needed because the three/webgpu namespace is a module object rather than a
// Catalogue-shaped record; naming the target type keeps a wrong argument here
// a type error, which the previous untyped cast did not.
extend(THREE as unknown as Catalogue);

// Part registry for the generated-entity builder. The WebGL CharacterActor
// calls this at module scope too; it is idempotent, and this scene can mount
// without CharacterActor ever being imported.
registerAllParts();

const TILE_WORLD_SIZE = 1.0;
const SUBDIVISIONS_PER_TILE = 4;
/** Mirrors CharacterActor: 1 tile = 5 ft = 1 unit, plus its ~1.25x readability
 *  oversize, so a body is the same size on both render paths. */
const UNITS_PER_M = 1 / 1.524;
const MODEL_SCALE = UNITS_PER_M * 1.25;
/** Must match TerrainMesh's ELEVATION_SCALE so tokens sit on the surface. */

// ---------------------------------------------------------------------------
// Baked-TSL lighting (see WebGPUProbeScene PARITY FIX). Unlit materials whose
// colorNode carries the full Lambert shading, so they never touch the broken
// node-path scene-light pipeline.
// ---------------------------------------------------------------------------

// Warm key + cool-sky/warm-ground hemisphere — mirrors World3DLighting /
// BattleMap3D's warm-key + cool-fill split so the WebGPU path lights the same
// way the WebGL battle map does.
//
// MIRRORED: `BATTLE_MAP_BAKED_LIGHT` in
// systems/entities3d/three/gpu/toonNodes.ts bakes actor bodies against these
// same numbers (src/systems must not import src/components). Retune both or the
// actors read as lit from a different sun than the ground under them.
const SUN_DIRECTION: [number, number, number] = [12, 16, 12];
const SUN_TSL = tslNormalize(vec3(SUN_DIRECTION[0], SUN_DIRECTION[1], SUN_DIRECTION[2]));
const SKY_COLOR = vec3(0.737, 0.839, 1.0); // #bcd6ff hemisphere sky
const GROUND_COLOR = vec3(0.42, 0.376, 0.282); // #6b6048 hemisphere ground
const SUN_COLOR = vec3(1.0, 0.945, 0.855); // #fff1da directional
const AMBIENT = 0.2;
const SUN_INTENSITY = 1.2;
const HEMI_INTENSITY = 0.55;

/* TSL node graphs chain operators (`.mul`, `.add`, `.mix`, swizzles) that
 * @types/three 0.172 does not model: it ships no `ShaderNodeObject` and
 * declares builders like `pass()` as returning the bare node class, so the
 * published types cannot express a chained graph. This alias is therefore an
 * upstream typing gap, not a shortcut, and it matches the same alias in
 * gpu/terrainColorNode.ts, gpu/gridOverlayNodes.ts and WebGPUProbeScene.tsx.
 * Revisit when @types/three exports the node-object type. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type TSLNode = any;

function irradianceFor(normalNode: TSLNode): TSLNode {
  const ndl = tslMax(0.0, dot(normalNode, SUN_TSL));
  const sun = SUN_COLOR.mul(SUN_INTENSITY).mul(ndl);
  const hemiMix = normalNode.y.mul(0.5).add(0.5);
  const hemi = GROUND_COLOR.mix(SKY_COLOR, hemiMix).mul(HEMI_INTENSITY);
  return sun.add(hemi).add(vec3(AMBIENT));
}

function litVertexColorMaterial(): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial();
  m.colorNode = vertexColor().mul(irradianceFor(normalWorld));
  return m;
}

function litSolidMaterial(hex: string): THREE.MeshBasicNodeMaterial {
  const c = new THREE.Color(hex);
  const m = new THREE.MeshBasicNodeMaterial();
  m.colorNode = vec3(c.r, c.g, c.b).mul(irradianceFor(normalWorld));
  return m;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Rung 1: procedural terrain texturing (TSL port of the WebGL GLSL). A per-tile
// terrain-TYPE DataTexture drives the node graph in gpu/terrainColorNode.ts.
// ---------------------------------------------------------------------------

const TERRAIN_TYPE_INDEX: Record<string, number> = {
  grass: 0,
  rock: 1,
  difficult: 2,
  sand: 3,
  water: 4,
  wall: 5,
  floor: 6,
  mud: 2,
};

function createTerrainTypeTexture(mapData: BattleMapData, width: number, height: number): THREE.DataTexture {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const tile = mapData.tiles.get(`${x}-${y}`);
      const type = tile?.terrain ?? 'grass';
      data[idx] = TERRAIN_TYPE_INDEX[type] ?? 0;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

// Per-biome sky/fog tint (parity with BattleMap3D BIOME_LIGHTING fogColor).
const BIOME_FOG: Record<string, number> = {
  forest: 0x8fa07a,
  cave: 0x0a0a1a,
  dungeon: 0x1a1520,
  desert: 0xd8c8a0,
  swamp: 0x2a3020,
};

function buildTileGrid(mapData: BattleMapData, width: number, height: number): (BattleMapTile | null)[][] {
  const grid: (BattleMapTile | null)[][] = [];
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < width; x++) grid[y][x] = mapData.tiles.get(`${x}-${y}`) ?? null;
  }
  return grid;
}

// ---------------------------------------------------------------------------
// Terrain mesh (heightfield reused from the shared sampler; procedurally textured
// via the TSL node graph — matches the WebGL terrain look, not a flat palette).
// ---------------------------------------------------------------------------

const TerrainPiece: React.FC<{ mapData: BattleMapData; biome: string }> = ({ mapData, biome }) => {
  const { width, height } = mapData.dimensions;
  const seed = mapData.seed ?? 42;

  const geometry = useMemo(() => {
    const grid = buildTileGrid(mapData, width, height);
    const sampleY = makeTerrainHeightSampler(grid, width, height, seed);
    const segsX = width * SUBDIVISIONS_PER_TILE;
    const segsZ = height * SUBDIVISIONS_PER_TILE;
    const geo = new THREE.PlaneGeometry(width * TILE_WORLD_SIZE, height * TILE_WORLD_SIZE, segsX, segsZ);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const tileX = vx / TILE_WORLD_SIZE + width / 2;
      const tileZ = vz / TILE_WORLD_SIZE + height / 2;
      pos.setY(i, sampleY(tileX, tileZ));
      pos.setX(i, vx + (width / 2) * TILE_WORLD_SIZE);
      pos.setZ(i, vz + (height / 2) * TILE_WORLD_SIZE);
    }
    geo.computeVertexNormals();
    pos.needsUpdate = true;
    return geo;
  }, [mapData, width, height, seed]);

  const typeTex = useMemo(() => createTerrainTypeTexture(mapData, width, height), [mapData, width, height]);
  const dapple = biome === 'forest' ? 1.0 : biome === 'swamp' ? 0.45 : 0.0;

  const material = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial();
    const albedo = buildTerrainAlbedoNode({ typeTex, mapWidth: width, mapHeight: height, dapple });
    // Bake lighting on top of the procedural albedo, using the flat facet normal
    // (matches the WebGL terrain's world-normal driven shading closely enough).
    m.colorNode = albedo.mul(irradianceFor(terrainFlatNormalNode()));
    return m;
  }, [typeTex, width, height, dapple]);

  useEffect(() => () => { geometry.dispose(); typeTex.dispose(); material.dispose(); }, [geometry, typeTex, material]);
  return <mesh geometry={geometry} material={material} />;
};

// ---------------------------------------------------------------------------
// Rung 2a: instanced grass (placement mirrors GrassLayer.tsx). Static blades —
// GPU wind sway is a documented MISSING (the WebGL path animates in-shader).
// ---------------------------------------------------------------------------

const BLADES_PER_TILE = 28;
const BLADE_H_MIN = 0.08;
const BLADE_H_MAX = 0.25;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function bladeGeometry(): THREE.BufferGeometry {
  // Simple 2-segment tapered blade along +Y (0..1), scaled per instance.
  const positions = [-0.03, 0, 0, 0.03, 0, 0, -0.018, 0.5, 0, 0.018, 0.5, 0, 0, 1, 0];
  const indices = [0, 1, 2, 1, 3, 2, 2, 3, 4];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

const GrassPiece: React.FC<{ mapData: BattleMapData; groundY: (x: number, z: number) => number }> = ({ mapData, groundY }) => {
  const { width, height } = mapData.dimensions;
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => bladeGeometry(), []);
  const material = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial();
    // Vertical gradient base→tip green, lit; darker at the root (fake AO).
    const base = vec3(0.12, 0.22, 0.05);
    const tip = vec3(0.28, 0.5, 0.12);
    const grad = base.mix(tip, uv().y);
    const ao = float(0.4).mix(float(1.0), smoothstep(0.0, 0.3, uv().y));
    m.colorNode = grad.mul(ao).mul(irradianceFor(normalWorld));
    m.side = THREE.DoubleSide;
    return m;
  }, []);

  const { matrices, count } = useMemo(() => {
    const rand = seededRandom(mapData.seed ?? 42);
    const list: number[] = [];
    const dummy = new THREE.Object3D();
    let n = 0;
    for (const [, tile] of mapData.tiles) {
      if (tile.terrain !== 'grass' && tile.terrain !== 'difficult') continue;
      const { x, y } = tile.coordinates;
      for (let b = 0; b < BLADES_PER_TILE; b++) {
        const wx = x + rand();
        const wz = y + rand();
        const rotY = rand() * Math.PI * 2;
        const h = BLADE_H_MIN + rand() * (BLADE_H_MAX - BLADE_H_MIN);
        dummy.position.set(wx, groundY(wx, wz), wz);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(1, h, 1);
        dummy.updateMatrix();
        dummy.matrix.toArray(list, n * 16);
        n++;
      }
    }
    return { matrices: new Float32Array(list), count: n };
  }, [mapData, groundY]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      m.fromArray(matrices, i * 16);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices, count]);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  if (count === 0) return null;
  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} />;
};

// ---------------------------------------------------------------------------
// Rung 2b: ground scatter props (placement mirrors GroundScatter.tsx) — pebble
// clusters + twigs on open grass tiles, instanced with baked-TSL solids.
// ---------------------------------------------------------------------------

const ScatterPiece: React.FC<{ mapData: BattleMapData; groundY: (x: number, z: number) => number }> = ({ mapData, groundY }) => {
  const pebbleGeom = useMemo(() => {
    const g = new THREE.SphereGeometry(0.045, 6, 4);
    g.scale(1.2, 0.55, 1.0);
    return g;
  }, []);
  const pebbleMat = useMemo(() => litSolidMaterial('#6a6a60'), []);
  const twigGeom = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.006, 0.008, 0.12, 3);
    g.rotateZ(Math.PI / 2 - 0.2);
    return g;
  }, []);
  const twigMat = useMemo(() => litSolidMaterial('#5a4020'), []);

  const { pebbles, twigs } = useMemo(() => {
    const rand = seededRandom((mapData.seed ?? 42) + 33333);
    const pb: number[] = [];
    const tw: number[] = [];
    const dummy = new THREE.Object3D();
    let np = 0;
    let nt = 0;
    for (const [, tile] of mapData.tiles) {
      if ((tile.terrain !== 'grass' && tile.terrain !== 'difficult') || tile.decoration) continue;
      const { x, y } = tile.coordinates;
      const cnt = 3 + Math.floor(rand() * 4);
      for (let i = 0; i < cnt; i++) {
        const wx = x + 0.1 + rand() * 0.8;
        const wz = y + 0.1 + rand() * 0.8;
        const rotY = rand() * Math.PI * 2;
        const scale = 0.6 + rand() * 0.8;
        dummy.position.set(wx, groundY(wx, wz), wz);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        if (rand() > 0.4) {
          dummy.matrix.toArray(pb, np * 16);
          np++;
        } else {
          dummy.matrix.toArray(tw, nt * 16);
          nt++;
        }
      }
    }
    return { pebbles: { m: new Float32Array(pb), n: np }, twigs: { m: new Float32Array(tw), n: nt } };
  }, [mapData, groundY]);

  useEffect(() => () => { pebbleGeom.dispose(); twigGeom.dispose(); pebbleMat.dispose(); twigMat.dispose(); }, [pebbleGeom, twigGeom, pebbleMat, twigMat]);

  return (
    <group>
      {pebbles.n > 0 && <InstancedFromMatrices geometry={pebbleGeom} material={pebbleMat} matrices={pebbles.m} count={pebbles.n} />}
      {twigs.n > 0 && <InstancedFromMatrices geometry={twigGeom} material={twigMat} matrices={twigs.m} count={twigs.n} />}
    </group>
  );
};

const InstancedFromMatrices: React.FC<{
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: Float32Array;
  count: number;
}> = ({ geometry, material, matrices, count }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      m.fromArray(matrices, i * 16);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices, count]);
  if (count === 0) return null;
  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} />;
};

// ---------------------------------------------------------------------------
// Rung 3: grid + movement/path/AoE overlay (TSL port of GridOverlay's shader).
// A per-tile RGBA state DataTexture (R=validMove, G=activePath, B=blocked,
// A=aoe) drives the node graph; a uniform opacity lerps the fade transition.
// The overlay mesh conforms to the terrain surface (like the WebGL overlay).
// ---------------------------------------------------------------------------

const GridOverlayPiece: React.FC<{
  mapData: BattleMapData;
  validMoves: Set<string>;
  activePath: { id: string }[];
  aoeSet: Set<string>;
  actionMode: 'move' | 'ability' | null;
  groundY: (x: number, z: number) => number;
}> = ({ mapData, validMoves, activePath, aoeSet, actionMode, groundY }) => {
  const { width, height } = mapData.dimensions;

  const activePathSet = useMemo(() => new Set(activePath.map((p) => p.id)), [activePath]);

  const stateTex = useMemo(() => {
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const id = `${x}-${y}`;
        const tile = mapData.tiles.get(id);
        data[idx] = validMoves.has(id) ? 255 : 0;
        data[idx + 1] = activePathSet.has(id) ? 255 : 0;
        data[idx + 2] = tile?.blocksMovement ? 255 : 0;
        data[idx + 3] = aoeSet.has(id) ? 255 : 0;
      }
    }
    const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }, [mapData, validMoves, activePathSet, aoeSet, width, height]);

  const opacityUniform = useMemo(() => uniform(0), []);
  const targetOpacity = actionMode === 'move' ? 1.0 : actionMode === 'ability' ? 0.6 : aoeSet.size > 0 ? 0.6 : 0.0;

  const geometry = useMemo(() => {
    const SUBDIV = 2;
    const geo = new THREE.PlaneGeometry(width * TILE_WORLD_SIZE, height * TILE_WORLD_SIZE, width * SUBDIV, height * SUBDIV);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + (width / 2) * TILE_WORLD_SIZE;
      const z = pos.getZ(i) + (height / 2) * TILE_WORLD_SIZE;
      pos.setX(i, x);
      pos.setZ(i, z);
      pos.setY(i, groundY(x, z) + 0.02);
    }
    pos.needsUpdate = true;
    return geo;
  }, [width, height, groundY]);

  const material = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial();
    const params = { stateTex, mapWidth: width, mapHeight: height, lineWidth: 0.02, opacityUniform };
    m.colorNode = buildGridColorNode(params);
    m.opacityNode = buildGridOpacityNode(params);
    m.transparent = true;
    m.depthWrite = false;
    m.side = THREE.DoubleSide;
    return m;
  }, [stateTex, width, height, opacityUniform]);

  // Smooth fade in/out (matches GridOverlay's 200ms lerp).
  useFrame((_s, delta) => {
    const cur = opacityUniform.value as number;
    opacityUniform.value = THREE.MathUtils.lerp(cur, targetOpacity, 1 - Math.exp(-5 * delta));
    material.visible = (opacityUniform.value as number) > 0.01;
  });

  useEffect(() => () => { geometry.dispose(); stateTex.dispose(); material.dispose(); }, [geometry, stateTex, material]);
  return <mesh geometry={geometry} material={material} renderOrder={1} />;
};

// ---------------------------------------------------------------------------
// Rung 4: character/enemy actors — the REAL generated bodies.
//
// These used to be lit capsules, and the scene header blamed the whole
// 1,491-line CharacterActor rig. The body was never the hard part: the same
// <EntityModel> the WebGL actor mounts renders here unchanged, once its
// materials are adapted for the node path (see adaptEntityForWebGpu below).
// The rig's CHROME now crosses too (agora-a2b8): <GpuActorChrome> mounts the
// very same <Html> nameplate / defeat / temp-HP components the WebGL actor
// uses, plus the defense and condition chips, and rebuilds only the one lit
// piece (the HP pip) as an unlit node material.
//
// The token affordances survive the swap rather than being dropped:
//   team color -> a team-hued ground ring under every actor (a generated body
//                 carries its own palette, so the team read has to live in the
//                 chrome, exactly as the WebGL map does it),
//   HP fade    -> that ring's opacity tracks the HP fraction, and a downed
//                 combatant's body desaturates through the baked material's
//                 death uniform instead of turning into a grey capsule,
//   rings      -> unchanged.
// ---------------------------------------------------------------------------

function ringGeometry(inner: number, outer: number): THREE.RingGeometry {
  const g = new THREE.RingGeometry(inner, outer, 28);
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * Rebuild an assembled body's materials for the node path.
 *
 * Module-level so the identity is stable — EntityModel rebuilds the whole body
 * when this callback changes. Failures are reported, never papered over: a
 * material the swap cannot rebuild is left in place to fail loudly at draw
 * time, per the no-silent-fallback rule this scene is built on.
 */
function adaptEntityForWebGpu(root: THREE.Object3D): void {
  const result = swapEntityMaterialsForGpu(root);
  if (result.skipped.length > 0) {
    // eslint-disable-next-line no-console
    console.error('[bm3d-webgpu] entity material swap left materials unconverted:', result.skipped);
  }
}

/** Flat unlit material for the ground rings (they are chrome, not lit surfaces). */
function ringMaterial(hex: string, opacity: number): THREE.MeshBasicNodeMaterial {
  const c = new THREE.Color(hex);
  const m = new THREE.MeshBasicNodeMaterial();
  m.colorNode = vec3(c.r, c.g, c.b);
  m.transparent = true;
  m.opacity = opacity;
  m.side = THREE.DoubleSide;
  m.depthWrite = false;
  return m;
}

const HIT_REACT_SECONDS = 0.5;

const CharacterToken: React.FC<{
  character: CombatCharacter;
  allCharacters: CombatCharacter[];
  groundY: number;
  isActive: boolean;
  isSelected: boolean;
  activeCharacterId: string | null;
}> = ({ character, allCharacters, groundY, isActive, isSelected, activeCharacterId }) => {
  const alive = character.currentHP > 0;
  const team = character.team === 'player' ? 'player' : character.team === 'enemy' ? 'enemy' : 'neutral';
  const teamHex = team === 'player' ? '#4ea1ff' : team === 'enemy' ? '#e05a4a' : '#eab308';
  const ringHex = team === 'player' ? '#fbbf24' : team === 'enemy' ? '#ff2020' : '#fbbf24';

  // The generated body. Identity fields only — HP and position must not rebuild
  // a skeleton mid-encounter (same dependency list as the WebGL CharacterActor).
  const blueprint = useMemo(
    () => generateEntityBlueprint(recipeFromCombatant(character)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [character.id, character.name, character.class?.id, character.creatureTypes, character.stats?.size],
  );

  const teamMat = useMemo(() => ringMaterial(teamHex, 0.85), [teamHex]);
  const selMat = useMemo(() => ringMaterial(ringHex, 0.85), [ringHex]);
  const teamRing = useMemo(() => ringGeometry(0.3, 0.38), []);
  const selRing = useMemo(() => ringGeometry(0.36, 0.46), []);
  const activeRing = useMemo(() => ringGeometry(0.5, 0.62), []);
  useEffect(
    () => () => { teamMat.dispose(); selMat.dispose(); teamRing.dispose(); selRing.dispose(); activeRing.dispose(); },
    [teamMat, selMat, teamRing, selRing, activeRing],
  );

  // HP fade — the ring dims as the combatant is worn down and goes nearly out
  // at zero. Mutated in an effect, not in render, so a re-render never touches
  // a live material mid-frame.
  const maxHP = Math.max(1, character.maxHP ?? character.currentHP ?? 1);
  const hpFraction = Math.max(0, Math.min(1, character.currentHP / maxHP));
  useEffect(() => {
    teamMat.opacity = 0.2 + 0.65 * hpFraction;
  }, [teamMat, hpFraction]);

  // The assembled body root, captured by the material adapter so the death
  // fade can be driven on it later. EntityModel owns the group; this is the
  // only handle on it.
  // Condition body tint (GG-227). The dominant condition and its hue both come
  // from the shared palette, the same call the WebGL body makes, so the two
  // renderers cannot disagree about which condition wins or what color it is.
  // A defeated combatant is left untinted: the death fade already owns that
  // body, and a corpse glowing poison green reads as alive.
  const conditionNames = useMemo(() => {
    const names: string[] = [];
    for (const c of character.conditions ?? []) names.push(String(c.name));
    for (const e of character.statusEffects ?? []) names.push(String(e.name));
    return names;
  }, [character.conditions, character.statusEffects]);
  const dominantCondition = useMemo(
    () => (alive ? resolveDominantCondition(conditionNames) : null),
    [alive, conditionNames],
  );

  // The assembled body root, captured by the material adapter so the death
  // fade and the condition tint can be driven on it. EntityModel owns the
  // group; this is the only handle on it.
  const bodyRootRef = useRef<THREE.Object3D | null>(null);

  // WHY A REF AND NOT THE VALUES THEMSELVES: `adaptMaterials` must keep a
  // stable identity, because EntityModel re-assembles the body whenever the
  // callback changes. Reading the live cue values out of a ref lets the
  // adapter apply them without becoming a new function every render.
  const bodyCuesRef = useRef({ alive, dominant: dominantCondition });
  bodyCuesRef.current = { alive, dominant: dominantCondition };

  // MEASURED, not assumed (agora-f821.35): driving the cues from an effect
  // ALONE leaves the body untinted. The swap replaces every material with a
  // fresh one whose uniforms start at zero, and that happens after the effect
  // has already run for this character — with `blueprint` unchanged, nothing
  // re-runs it, so the tint was written to materials that no longer render.
  // A forced full-strength magenta proved it: the uniforms read back as driven
  // while the body stayed its own color. Applying the cues HERE, on the root
  // that was just swapped, is what makes them reach the screen.
  const adaptMaterials = useCallback((root: THREE.Object3D) => {
    bodyRootRef.current = root;
    adaptEntityForWebGpu(root);
    const { alive: isAlive, dominant } = bodyCuesRef.current;
    setEntityDeathFade(root, isAlive ? 0 : 1);
    setEntityConditionTint(root, dominant?.tintColor ?? null, dominant?.tintStrength ?? 0);
  }, []);

  // And these keep the cues current when the character changes WITHOUT the
  // body being rebuilt — taking damage, catching fire, dropping to 0 HP.
  useEffect(() => {
    if (bodyRootRef.current) setEntityDeathFade(bodyRootRef.current, alive ? 0 : 1);
  }, [alive, blueprint]);
  useEffect(() => {
    if (!bodyRootRef.current) return;
    setEntityConditionTint(
      bodyRootRef.current,
      dominantCondition?.tintColor ?? null,
      dominantCondition?.tintStrength ?? 0,
    );
  }, [alive, blueprint, dominantCondition]);

  // Combat-driven animation state. The scene is handed resolved data, not
  // combat events, so this reads what IS observable: a drop in HP is a hit, no
  // HP is a death, anything else is idle. Attack/cast states stay on the WebGL
  // actor, which sees the action events.
  const [animState, setAnimState] = useState<AnimationState>(alive ? 'idle' : 'death');
  const animTimeRef = useRef(0);
  const prevHPRef = useRef(character.currentHP);
  useEffect(() => {
    if (character.currentHP <= 0) {
      setAnimState('death');
      animTimeRef.current = 0;
    } else if (character.currentHP < prevHPRef.current) {
      setAnimState('hit_react');
      animTimeRef.current = 0;
    }
    prevHPRef.current = character.currentHP;
  }, [character.currentHP]);

  // Face the nearest living opponent, like the WebGL actor. R3F Z+ is forward.
  const facing = useMemo(() => {
    let nearest: CombatCharacter | null = null;
    let best = Infinity;
    for (const other of allCharacters) {
      if (other.id === character.id || other.team === character.team || other.currentHP <= 0) continue;
      const d = Math.hypot(other.position.x - character.position.x, other.position.y - character.position.y);
      if (d < best) { best = d; nearest = other; }
    }
    if (!nearest) return 0;
    return Math.atan2(nearest.position.x - character.position.x, nearest.position.y - character.position.y);
  }, [character.id, character.team, character.position.x, character.position.y, allCharacters]);

  // ---- chrome (agora-a2b8) --------------------------------------------
  // Every value below is derived exactly as CharacterActor derives it, so
  // the two paths cannot report different numbers for the same combatant.
  const [hovered, setHovered] = useState(false);
  const teamColors = TEAM_COLORS[team];
  /** Pips and nameplates ride above the generated body's real head. */
  const pipY = Math.max(1.85, heightM(blueprint.frame) * MODEL_SCALE + 0.45);
  const hpPercent = Math.max(0, character.currentHP / Math.max(1, character.maxHP));
  const hpColor = actorHpColor(hpPercent);
  // Range readout: only while hovering an enemy, and only against the active
  // player character — the same narrow rule the WebGL actor applies.
  const distanceToActive = useMemo(() => {
    if (!hovered || !activeCharacterId || activeCharacterId === character.id) return null;
    const active = allCharacters.find((c) => c.id === activeCharacterId);
    if (!active || active.team !== 'player' || character.team !== 'enemy') return null;
    return getDistance(character.position, active.position) * 5; // 5 ft per tile
  }, [hovered, activeCharacterId, allCharacters, character.id, character.team, character.position]);

  const groupRef = useRef<THREE.Group>(null);
  // Animation clock + the gentle idle sway the tokens had. PostFx drives the
  // render (useFrame priority 1), so every useFrame in this scene — including
  // EntityModel's own body update — ticks from the one R3F loop. No second RAF.
  useFrame((s, delta) => {
    animTimeRef.current += delta;
    if (animState === 'hit_react' && animTimeRef.current > HIT_REACT_SECONDS) {
      setAnimState('idle');
      animTimeRef.current = 0;
    }
    if (!groupRef.current) return;
    groupRef.current.rotation.y = facing + (alive ? Math.sin(s.clock.elapsedTime * 0.8 + character.position.x) * 0.05 : 0);
  });

  const x = character.position.x + 0.5;
  const z = character.position.y + 0.5;
  return (
    <group
      position={[x, groundY, z]}
      onPointerEnter={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
    >
      {/* Team ring — always on, so team and HP read at a glance now that the
          body carries its own palette instead of a team color. */}
      <mesh geometry={teamRing} material={teamMat} position={[0, 0.02, 0]} />
      {(isSelected || isActive) && (
        <mesh geometry={isActive ? activeRing : selRing} material={selMat} position={[0, 0.03, 0]} />
      )}
      <group ref={groupRef}>
        <group scale={MODEL_SCALE}>
          <EntityModel
            blueprint={blueprint}
            animState={alive ? animState : 'death'}
            animTimeRef={animTimeRef}
            adaptMaterials={adaptMaterials}
          />
        </group>
      </group>
      {/* Nameplate, HP pip, defeat + temp-HP markers, defense/condition chips. */}
      <GpuActorChrome
        character={character}
        teamColors={teamColors}
        pipY={pipY}
        isAlive={alive}
        isSelected={isSelected}
        isTurn={isActive}
        hovered={hovered}
        hpPercent={hpPercent}
        hpColor={hpColor}
        distanceToActive={distanceToActive}
      />
    </group>
  );
};

// ---------------------------------------------------------------------------
// Rung 5: post-processing (three node PostProcessing) — bloom + TSL vignette.
// three's WebGPU PostProcessing owns the render, so R3F runs frameloop="never"
// and we drive post.renderAsync() each frame. If post construction throws we
// report it as MISSING rather than faking it.
// ---------------------------------------------------------------------------

const PostFx: React.FC<{ onMissing: (label: string) => void }> = ({ onMissing }) => {
  const { gl, scene, camera } = useThree();
  const postRef = useRef<THREE.PostProcessing | null>(null);

  useEffect(() => {
    let cancelled = false;
    const renderer = gl as unknown as THREE.WebGPURenderer;
    if (!renderer || typeof (renderer as { setAnimationLoop?: unknown }).setAnimationLoop !== 'function') {
      onMissing('Post-processing bloom + vignette (renderer unsupported)');
      return;
    }
    // Load pass/bloom lazily so the display addon (which pulls a second three
    // instance) never touches module eval — keeps the fail-fast probe path clean.
    (async () => {
      try {
        const [{ pass }, { bloom }] = await Promise.all([
          import('three/tsl'),
          import('three/examples/jsm/tsl/display/BloomNode.js'),
        ]);
        if (cancelled) return;
        const post = new THREE.PostProcessing(renderer);
        // pass() → scene color; bloom on bright areas; then a soft vignette.
        // `pass` is declared (scene, camera) => PassNode; the node object it
        // returns carries the chained TSL operators, so it widens to TSLNode
        // without a cast and the two arguments are now checked.
        const scenePass: TSLNode = pass(scene, camera);
        const bloomPass = bloom(scenePass, 0.42, 0.4, 0.85);
        const d = uv().sub(0.5).length();
        const vignette = smoothstep(0.85, 0.35, d);
        post.outputNode = scenePass.add(bloomPass).mul(tslMin(1.0, vignette.add(0.35)));
        postRef.current = post;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[bm3d-webgpu] post-processing unavailable:', e);
        if (!cancelled) onMissing('Post-processing bloom + vignette (node pipeline threw)');
      }
    })();
    return () => {
      cancelled = true;
      postRef.current?.dispose?.();
      postRef.current = null;
    };
  }, [gl, scene, camera, onMissing]);

  useFrame(() => {
    const post = postRef.current;
    if (post) {
      // Post owns the render when present.
      // `renderAsync` is declared on THREE.PostProcessing, so no cast is
      // needed. The promise is deliberately not awaited (useFrame is sync),
      // preserving the previous fire-and-forget behavior.
      void post.renderAsync();
    } else {
      // WebGPURenderer and WebGLRenderer both declare render(scene, camera).
      gl.render(scene, camera);
    }
  }, 1);

  return null;
};

// ---------------------------------------------------------------------------
// On-screen WebGPU badge + backend reporter (unambiguous eyeball proof) + the
// honest MISSING list.
// ---------------------------------------------------------------------------

interface Props {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  activeCharacter: CombatCharacter | null;
  selectedCharacter: CombatCharacter | null;
  validMoves?: Set<string>;
  activePath?: { id: string }[];
  actionMode?: 'move' | 'ability' | null;
  aoeSet?: Set<string>;
  onCameraSelectCharacter?: (id: string) => void;
  /**
   * Called when the user clicks "Use WebGL instead" on the WebGPU-unavailable
   * error panel. The host (BattleMap3D) remounts the normal WebGL scene. The
   * system itself never auto-falls-back — this is an explicit USER action.
   */
  onUseWebGL?: () => void;
}

const BattleMap3DGpuScene: React.FC<Props> = ({
  mapData,
  characters,
  activeCharacter,
  selectedCharacter,
  validMoves,
  activePath,
  actionMode,
  aoeSet,
  onCameraSelectCharacter,
  onUseWebGL,
}) => {
  const { width, height } = mapData.dimensions;
  const biome = useMemo(() => {
    const m = mapData as BattleMapData & { biome?: string; theme?: string };
    return m.biome ?? m.theme ?? 'forest';
  }, [mapData]);

  const cameraTarget = useMemo(
    () => [(width / 2) * TILE_WORLD_SIZE, 0, (height / 2) * TILE_WORLD_SIZE] as const,
    [width, height],
  );
  const mapHalfDiag = useMemo(() => (Math.hypot(width, height) / 2) * TILE_WORLD_SIZE, [width, height]);

  const groundSampler = useMemo(() => {
    const grid = buildTileGrid(mapData, width, height);
    return makeTerrainHeightSampler(grid, width, height, mapData.seed ?? 42);
  }, [mapData, width, height]);

  // WebGPU is experimental, but it shares the WorldForge heightfield contract.
  // Keep its first frame above both the map anchor and the physical camera
  // location so toggling render backends cannot put the player underground.
  const initialCameraPosition = useMemo(() => {
    const [centerX, , centerZ] = cameraTarget;
    const spawnX = centerX + 8;
    const spawnZ = centerZ + 8;
    const anchorY = groundSampler(centerX, centerZ);
    const spawnGroundY = groundSampler(spawnX, spawnZ);
    return [spawnX, Math.max(anchorY, spawnGroundY) + 10, spawnZ] as const;
  }, [cameraTarget, groundSampler]);

  const fogHex = BIOME_FOG[biome] ?? BIOME_FOG.forest;

  // Honest on-screen MISSING list (parity gaps that are NOT faked). PostFx may
  // append a bloom/vignette line if the node pipeline is unavailable.
  const [postMissing, setPostMissing] = useState<string | null>(null);
  const missing = useMemo(
    () =>
      [
        'Real-time shadows (baked colorNode has no LightsNode → no shadow map, three 0.170)',
        'Condition DESATURATION on the body (the condition tint itself now renders; the greyscale stage of the WebGL patch does not cross yet)',
        'GPU wind sway on grass (blades are static)',
        postMissing,
      ].filter(Boolean) as string[],
    [postMissing],
  );

  // FAIL-FAST WebGPU probe (Remy's no-fallback rule): before mounting the GPU
  // scene at all, ask the platform for a real WebGPU adapter. If `navigator.gpu`
  // is absent or `requestAdapter()` yields nothing, we do NOT render anything —
  // no WebGL2-fallback scene, no silent degradation — just a clear error panel
  // telling the player how to get back to the real WebGL renderer (drop &gpu=1).
  // The badge below therefore exists ONLY in the genuine-WebGPU success case.
  const [probe, setProbe] = useState<{ state: 'probing' | 'ok' | 'error'; reason?: string }>({
    state: 'probing',
  });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown | null> } }).gpu;
      if (!gpu) {
        if (!cancelled) setProbe({ state: 'error', reason: 'navigator.gpu is not available in this browser' });
        return;
      }
      try {
        const adapter = await gpu.requestAdapter();
        if (cancelled) return;
        if (!adapter) {
          setProbe({ state: 'error', reason: 'no WebGPU adapter (requestAdapter() returned null)' });
        } else {
          setProbe({ state: 'ok' });
        }
      } catch (e) {
        if (!cancelled) {
          setProbe({ state: 'error', reason: `requestAdapter() failed: ${e instanceof Error ? e.message : String(e)}` });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (probe.state !== 'error') return;
    const w = window as unknown as { __bm3dGpuBackend?: string; __bm3dGpuReady?: boolean; __bm3dGpuError?: string };
    w.__bm3dGpuBackend = 'unavailable';
    w.__bm3dGpuReady = false;
    w.__bm3dGpuError = probe.reason;
    // eslint-disable-next-line no-console
    console.error(`[bm3d-webgpu] WebGPU unavailable: ${probe.reason}`);
  }, [probe]);

  if (probe.state === 'probing') {
    return (
      <div
        className="relative flex h-full min-h-[320px] w-full items-center justify-center overflow-hidden rounded-lg bg-slate-950 text-sm text-slate-400"
        style={{ flex: '1 1 0%' }}
        data-testid="battlemap-3d-webgpu-probing"
      >
        Probing WebGPU adapter…
      </div>
    );
  }

  if (probe.state === 'error') {
    return (
      <div
        className="relative flex h-full min-h-[320px] w-full items-center justify-center overflow-hidden rounded-lg bg-slate-950 p-6"
        style={{ flex: '1 1 0%' }}
        data-testid="battlemap-3d-webgpu-error"
      >
        <div
          role="alert"
          className="max-w-[34rem] rounded-lg border border-rose-400/60 bg-slate-900/90 px-5 py-4 text-sm leading-relaxed text-rose-100 shadow-[0_0_24px_rgba(244,63,94,0.25)]"
        >
          <div className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-rose-300">
            WebGPU unavailable
          </div>
          WebGPU unavailable: {probe.reason}. Remove <code className="font-mono text-rose-200">&amp;gpu=1</code>{' '}
          from the URL to use the WebGL renderer.
          {onUseWebGL && (
            <div className="mt-3">
              {/* Active error, not a dead end: ONE explicit click switches to the
                  normal WebGL renderer. The system never auto-falls-back. */}
              <button
                type="button"
                onClick={onUseWebGL}
                data-testid="webgpu-use-webgl-button"
                className="rounded border border-sky-300/70 bg-sky-900/60 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-sky-100 transition-colors hover:bg-sky-800/70"
              >
                Use WebGL instead
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative h-full min-h-[320px] w-full overflow-hidden rounded-lg bg-slate-950"
      style={{ flex: '1 1 0%' }}
      data-testid="battlemap-3d-webgpu"
    >
      {/* WebGPU badge — small corner tag so the eyeball is unambiguous which
          render path is live. Only reachable in the genuine-WebGPU success case:
          the adapter probe above fail-fasts, and the gl factory below throws if
          the renderer still comes up on a non-WebGPU backend. */}
      <div
        className="pointer-events-none absolute right-3 top-3 rounded-full border border-fuchsia-300/80 bg-slate-950/85 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-fuchsia-200 shadow-[0_0_18px_rgba(217,70,239,0.4)]"
        style={{ zIndex: 60 }}
        data-testid="webgpu-badge"
      >
        WebGPU
      </div>
      {/* Honest on-screen MISSING list (parity gaps not faked). Red so it reads
          as a truthful "not done", per the no-silent-gap rule. */}
      <div
        className="pointer-events-none absolute bottom-3 left-3 max-w-[24rem] rounded border border-amber-400/50 bg-slate-950/80 px-3 py-2 text-[10px] leading-snug text-amber-200"
        style={{ zIndex: 60 }}
        data-testid="webgpu-missing-list"
      >
        <div className="mb-0.5 font-black uppercase tracking-[0.12em] text-amber-300">WebGPU path — still missing</div>
        <ul className="list-disc pl-3">
          {missing.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
      <Canvas
        className="h-full w-full"
        frameloop="always"
        camera={{
          fov: 50,
          near: 0.1,
          far: Math.max(220, mapHalfDiag * 5.2),
          position: initialCameraPosition,
        }}
        gl={async (props) => {
          // NO FALLBACK: construct WebGPURenderer and await async init. The
          // adapter probe already passed; if the renderer STILL comes up on a
          // non-WebGPU backend, throw — we never render the fallback backend.
          const renderer = new THREE.WebGPURenderer(
            props as ConstructorParameters<typeof THREE.WebGPURenderer>[0],
          );
          await renderer.init();
          const backend = (renderer as unknown as { backend?: { isWebGPUBackend?: boolean } }).backend;
          if (!backend?.isWebGPUBackend) {
            renderer.dispose();
            const w = window as unknown as { __bm3dGpuBackend?: string; __bm3dGpuReady?: boolean };
            w.__bm3dGpuBackend = 'unavailable';
            w.__bm3dGpuReady = false;
            throw new Error(
              '[bm3d-webgpu] WebGPURenderer initialized on a non-WebGPU backend; refusing to render a fallback (remove &gpu=1 to use the WebGL renderer)',
            );
          }
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.2;
          const w = window as unknown as { __bm3dGpuBackend?: string; __bm3dGpuReady?: boolean };
          w.__bm3dGpuBackend = 'webgpu';
          w.__bm3dGpuReady = true;
          // eslint-disable-next-line no-console
          console.info('[bm3d-webgpu] renderer backend = webgpu');
          // R3F types the `gl` factory's return as WebGLRenderer; WebGPURenderer
          // is the sibling implementation R3F drives through the same surface,
          // so narrow to that named type instead of erasing it with `any`.
          return renderer as unknown as WebGLRenderer;
        }}
      >
        <PerfProbe id="battlemap-gpu" label="Battle Map (GPU)" />
        <fog attach="fog" args={[fogHex, mapHalfDiag * 1.4, mapHalfDiag * 4]} />
        <CameraController
          mapCenter={cameraTarget}
          groundYAt={groundSampler}
          activeCharacter={activeCharacter}
          selectedCharacter={selectedCharacter}
          characters={characters}
          cinematicEnabled={true}
          maxDistance={Math.max(35, mapHalfDiag * 1.6)}
          onCameraSelectCharacter={onCameraSelectCharacter}
        />
        <TerrainPiece mapData={mapData} biome={biome} />
        <GrassPiece mapData={mapData} groundY={groundSampler} />
        <ScatterPiece mapData={mapData} groundY={groundSampler} />
        <GridOverlayPiece
          mapData={mapData}
          validMoves={validMoves ?? new Set()}
          activePath={activePath ?? []}
          aoeSet={aoeSet ?? new Set()}
          actionMode={actionMode ?? null}
          groundY={groundSampler}
        />
        {characters.map((c) => (
          <CharacterToken
            key={c.id}
            character={c}
            allCharacters={characters}
            groundY={groundSampler(c.position.x + 0.5, c.position.y + 0.5)}
            isActive={activeCharacter?.id === c.id}
            isSelected={selectedCharacter?.id === c.id}
            activeCharacterId={activeCharacter?.id ?? null}
          />
        ))}
        <PostFx onMissing={setPostMissing} />
      </Canvas>
    </div>
  );
};

export default BattleMap3DGpuScene;

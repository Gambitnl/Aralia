// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 10:29:54
 * Dependents: components/BattleMap/terrain/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file GrassLayer.tsx
 * Instanced grass blades scattered across grass-type tiles with GPU wind animation.
 *
 * Uses InstancedMesh with a custom vertex shader for wind sway. Each grass blade
 * is a thin triangle strip; per-instance attributes control position, rotation,
 * scale, and color tint. Wind uses a combination of sin() primary wave and
 * smooth noise for organic secondary motion.
 *
 * Performance strategy (from research):
 * - InstancedMesh: single draw call for all blades
 * - Chunked into 16-tile groups for frustum culling
 * - Billboard rotation not needed (blades are 3D geometry viewed from above)
 * - ~60-80 blades per grass tile → ~36,000-48,000 total for a 30×20 map (~600 grass tiles)
 *
 * Research references:
 * - Instanced grass with GLSL wind: https://github.com/Nitash-Biswas/grass-shader-glsl
 * - Codrops fluffy grass: https://tympanus.net/codrops/2025/02/04/how-to-make-the-fluffiest-grass-with-three-js/
 * - Three.js forum instanced grass: https://discourse.threejs.org/t/simple-instanced-grass-example/26694
 * - al-ro grass instancing: https://al-ro.github.io/projects/grass/
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "Vegetation Layer" section
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BattleMapData, BattleMapTile } from '../../../types/combat';
import { makeTerrainHeightSampler } from './TerrainMesh';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SIZE = 1.0;
const BLADES_PER_TILE = 40;
const BLADE_WIDTH = 0.06;
const BLADE_HEIGHT_MIN = 0.08;
const BLADE_HEIGHT_MAX = 0.25;
const BLADE_SEGMENTS = 4; // Vertices along the blade height for bending

const WIND_SPEED = 1.2;
const WIND_STRENGTH = 0.12;

// Colors — base palette, tinted per-instance
const GRASS_BASE_COLOR = new THREE.Color(0.12, 0.22, 0.05); // Dark forest green base
const GRASS_TIP_COLOR = new THREE.Color(0.28, 0.50, 0.12); // Medium green tips — not yellow

// Height cluster parameters — creates meadow-like patches of tall/short grass
const CLUSTER_SCALE = 3.5; // World-space scale of height clusters
const CLUSTER_INFLUENCE = 0.6; // How much clusters affect height (0=none, 1=full)

// ---------------------------------------------------------------------------
// Blade geometry generator
// ---------------------------------------------------------------------------

/**
 * Create a single grass blade geometry (thin triangle strip tapering to a point).
 * The blade lies along Y axis (0 = ground, bladeHeight = tip).
 */
function createBladeGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();

  // Each segment has 2 vertices (left/right), final tip is 1 vertex
  const vertexCount = BLADE_SEGMENTS * 2 + 1;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  for (let seg = 0; seg < BLADE_SEGMENTS; seg++) {
    const t = seg / BLADE_SEGMENTS;
    const y = t; // Normalized height [0,1], actual height set per instance
    // Width narrows toward tip
    const halfWidth = (BLADE_WIDTH / 2) * (1.0 - t * 0.7);

    // Left vertex
    const li = seg * 2;
    positions[li * 3] = -halfWidth;
    positions[li * 3 + 1] = y;
    positions[li * 3 + 2] = 0;
    uvs[li * 2] = 0;
    uvs[li * 2 + 1] = t;

    // Right vertex
    const ri = seg * 2 + 1;
    positions[ri * 3] = halfWidth;
    positions[ri * 3 + 1] = y;
    positions[ri * 3 + 2] = 0;
    uvs[ri * 2] = 1;
    uvs[ri * 2 + 1] = t;
  }

  // Tip vertex
  const tipIdx = BLADE_SEGMENTS * 2;
  positions[tipIdx * 3] = 0;
  positions[tipIdx * 3 + 1] = 1.0; // Full height (normalized)
  positions[tipIdx * 3 + 2] = 0;
  uvs[tipIdx * 2] = 0.5;
  uvs[tipIdx * 2 + 1] = 1.0;

  // Triangle indices (triangle strip → triangles)
  const indices: number[] = [];
  for (let seg = 0; seg < BLADE_SEGMENTS - 1; seg++) {
    const bl = seg * 2;
    const br = seg * 2 + 1;
    const tl = (seg + 1) * 2;
    const tr = (seg + 1) * 2 + 1;
    indices.push(bl, br, tl);
    indices.push(br, tr, tl);
  }
  // Final segment connects to tip
  const lastL = (BLADE_SEGMENTS - 1) * 2;
  const lastR = (BLADE_SEGMENTS - 1) * 2 + 1;
  indices.push(lastL, lastR, tipIdx);

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

// ---------------------------------------------------------------------------
// Shader code
// ---------------------------------------------------------------------------

const grassVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWindSpeed;
  uniform float uWindStrength;

  attribute vec3 instanceTint;

  varying float vHeight;
  varying vec2 vUv;
  varying vec3 vTint;

  // Simple noise function for wind variation
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vUv = uv;
    vHeight = position.y; // Normalized [0, 1]
    vTint = instanceTint;

    // Get instance world position from instance matrix
    vec4 worldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float worldX = worldPos.x;
    float worldZ = worldPos.z;

    // Transform vertex by instance matrix first
    vec4 localPos = instanceMatrix * vec4(position, 1.0);

    // Wind displacement — only affects vertices above ground
    float heightFactor = position.y * position.y; // Quadratic: roots stay, tips sway most

    // Primary wind wave
    float primaryWind = sin(uTime * uWindSpeed + worldX * 0.5 + worldZ * 0.3) * uWindStrength;

    // Secondary noise-based wind for organic variation
    float noiseWind = noise(vec2(worldX * 0.3 + uTime * 0.2, worldZ * 0.3)) * uWindStrength * 0.5;

    // Apply displacement
    localPos.x += (primaryWind + noiseWind) * heightFactor;
    localPos.z += (primaryWind * 0.3 + noiseWind * 0.7) * heightFactor;

    gl_Position = projectionMatrix * viewMatrix * localPos;
  }
`;

const grassFragmentShader = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform vec3 uTipColor;

  varying float vHeight;
  varying vec2 vUv;
  varying vec3 vTint;

  void main() {
    // Vertical gradient from base to tip color, modulated by per-instance tint
    vec3 base = uBaseColor * vTint;
    vec3 tip = uTipColor * vTint;
    vec3 color = mix(base, tip, vHeight);

    // Fake ambient occlusion: darker at base
    float ao = mix(0.4, 1.0, smoothstep(0.0, 0.3, vHeight));
    color *= ao;

    // Simple front/back face shading
    float facing = gl_FrontFacing ? 1.0 : 0.7;
    color *= facing;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GrassLayerProps {
  mapData: BattleMapData;
}

// ---------------------------------------------------------------------------
// Seeded random for deterministic placement
// ---------------------------------------------------------------------------

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const GrassLayer: React.FC<GrassLayerProps> = ({ mapData }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { width, height } = mapData.dimensions;

  // Collect tiles that can't have grass (rocks, walls, water) for bare-spot detection
  const nonGrassTileSet = useMemo(() => {
    const set = new Set<string>();
    for (const [, tile] of mapData.tiles) {
      if (tile.terrain === 'rock' || tile.terrain === 'wall' || tile.terrain === 'water') {
        set.add(`${tile.coordinates.x},${tile.coordinates.y}`);
      }
    }
    return set;
  }, [mapData]);

  // Collect all grass-type tiles
  const grassTiles = useMemo(() => {
    const tiles: { x: number; y: number; elevation: number }[] = [];
    for (const [, tile] of mapData.tiles) {
      if (tile.terrain === 'grass' || tile.terrain === 'difficult') {
        tiles.push({
          x: tile.coordinates.x,
          y: tile.coordinates.y,
          elevation: tile.elevation,
        });
      }
    }
    return tiles;
  }, [mapData]);

  // Total blade count
  const instanceCount = grassTiles.length * BLADES_PER_TILE;

  // Saved opening scenes physically alter vegetation. The base grass pass must
  // therefore leave readable clearings around flattened ground, trampled runs,
  // the activity site, combat churn, and resolved bodies. This is not a visual
  // test exception: each zone comes directly from the encounter receipt.
  const openingSceneGrassSuppression = useMemo(() => {
    const context = mapData.encounterContext;
    if (context?.kind !== 'opening-standoff') return () => 0;

    const pointZones: Array<{ x: number; z: number; radius: number; strength: number }> = [];
    const lineZones: Array<{
      ax: number;
      az: number;
      bx: number;
      bz: number;
      radius: number;
      strength: number;
    }> = [];

    for (const imprint of context.terrainImprints ?? []) {
      if (imprint.kind === 'trampled-run' || imprint.kind === 'drag-furrow') {
        lineZones.push({
          ax: imprint.position.x + 0.5,
          az: imprint.position.y + 0.5,
          bx: imprint.endPosition.x + 0.5,
          bz: imprint.endPosition.y + 0.5,
          radius: imprint.kind === 'drag-furrow' ? 0.24 : Math.max(0.42, imprint.extentCells.width * 0.45),
          strength: imprint.kind === 'drag-furrow' ? 0.72 : 0.82,
        });
      } else {
        pointZones.push({
          x: imprint.position.x + 0.5,
          z: imprint.position.y + 0.5,
          radius: Math.max(0.72, Math.min(1.35, imprint.extentCells.length * 0.5)),
          strength: imprint.kind === 'flattened-ground' ? 0.94 : 0.58,
        });
      }
    }

    if (context.activitySite) {
      pointZones.push({
        x: context.activitySite.position.x + 0.5,
        z: context.activitySite.position.y + 0.5,
        radius: 1.05,
        strength: 0.96,
      });
    }
    if (context.sceneResolution) {
      const disturbance = context.sceneResolution.combatDisturbance;
      pointZones.push({
        x: disturbance.position.x + 0.5,
        z: disturbance.position.y + 0.5,
        radius: Math.max(0.9, disturbance.extentCells.length * 0.42),
        strength: disturbance.severity === 'heavy' ? 0.9 : 0.72,
      });
      const physicalIds = new Set(
        context.sceneResolution.entityOutcomes
          .filter((outcome) => outcome.status === 'downed' || outcome.status === 'holding-ground')
          .map((outcome) => outcome.sourceEntityId),
      );
      for (const entity of context.sourceEntities) {
        if (!physicalIds.has(entity.entityId)) continue;
        pointZones.push({
          x: entity.position.x + 0.5,
          z: entity.position.y + 0.5,
          radius: 0.72,
          strength: 0.97,
        });
      }
    }

    const segmentDistance = (
      x: number,
      z: number,
      zone: (typeof lineZones)[number],
    ): number => {
      const dx = zone.bx - zone.ax;
      const dz = zone.bz - zone.az;
      const lengthSquared = dx * dx + dz * dz;
      const t = lengthSquared > 0
        ? Math.max(0, Math.min(1, ((x - zone.ax) * dx + (z - zone.az) * dz) / lengthSquared))
        : 0;
      return Math.hypot(x - (zone.ax + dx * t), z - (zone.az + dz * t));
    };

    return (x: number, z: number): number => {
      let suppression = 0;
      for (const zone of pointZones) {
        const normalized = Math.hypot(x - zone.x, z - zone.z) / zone.radius;
        if (normalized < 1) suppression = Math.max(suppression, zone.strength * (1 - normalized * 0.45));
      }
      for (const zone of lineZones) {
        const normalized = segmentDistance(x, z, zone) / zone.radius;
        if (normalized < 1) suppression = Math.max(suppression, zone.strength * (1 - normalized * 0.5));
      }
      return suppression;
    };
  }, [mapData]);

  // Same surface formula as the rendered mesh — blades root IN the ground by
  // construction. Flat per-tile `elevation * 0.3` left blades hovering or
  // buried beside elevation steps (task-71/79 grounding pattern; required
  // once the gap-#28 bluff layer introduced 2-3-step faces).
  const groundSampler = useMemo(() => {
    const { width, height } = mapData.dimensions;
    const grid: (BattleMapTile | null)[][] = [];
    for (let y = 0; y < height; y++) {
      grid[y] = [];
      for (let x = 0; x < width; x++) {
        grid[y][x] = mapData.tiles.get(`${x}-${y}`) ?? null;
      }
    }
    return makeTerrainHeightSampler(grid, width, height, mapData.seed ?? 42);
  }, [mapData]);

  // Blade geometry (shared by all instances)
  const bladeGeo = useMemo(() => createBladeGeometry(), []);

  // Simple spatial noise for height clusters (CPU-side)
  const clusterNoise = (wx: number, wz: number): number => {
    const px = wx / CLUSTER_SCALE;
    const pz = wz / CLUSTER_SCALE;
    // Simple value noise
    const ix = Math.floor(px);
    const iz = Math.floor(pz);
    const fx = px - ix;
    const fz = pz - iz;
    const sfx = fx * fx * (3 - 2 * fx);
    const sfz = fz * fz * (3 - 2 * fz);
    const h = (a: number, b: number) => {
      let s = a * 127.1 + b * 311.7;
      s = Math.sin(s) * 43758.5453;
      return s - Math.floor(s);
    };
    const a = h(ix, iz);
    const b = h(ix + 1, iz);
    const c = h(ix, iz + 1);
    const d = h(ix + 1, iz + 1);
    return (a * (1 - sfx) + b * sfx) * (1 - sfz) + (c * (1 - sfx) + d * sfx) * sfz;
  };

  // Check if a tile is adjacent to a non-grass tile (for bare spots)
  const isNearRock = (tx: number, ty: number): boolean => {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (nonGrassTileSet.has(`${tx + dx},${ty + dy}`)) return true;
      }
    }
    return false;
  };

  // Build instance matrices + per-instance tint colors
  const { matrices, tints } = useMemo(() => {
    const rand = seededRandom(mapData.seed ?? 42);
    const mats = new Float32Array(instanceCount * 16);
    const tintArr = new Float32Array(instanceCount * 3);
    const dummy = new THREE.Object3D();

    let idx = 0;
    for (const tile of grassTiles) {
      const nearRock = isNearRock(tile.x, tile.y);
      // Fewer blades near rocks (bare spots)
      const effectiveBlades = nearRock
        ? Math.floor(BLADES_PER_TILE * 0.4)
        : BLADES_PER_TILE;

      for (let b = 0; b < BLADES_PER_TILE; b++) {
        // Random position within tile
        const offsetX = rand() * TILE_SIZE;
        const offsetZ = rand() * TILE_SIZE;
        const worldX = tile.x * TILE_SIZE + offsetX;
        const worldZ = tile.y * TILE_SIZE + offsetZ;
        const worldY = groundSampler(worldX, worldZ);

        // Skip extra blades in bare spots (still consume rand() calls for determinism)
        const rotY = rand() * Math.PI * 2;
        const randHeight = rand();
        const tintR = rand();
        const sceneSuppression = openingSceneGrassSuppression(worldX, worldZ);
        const scenePattern = clusterNoise(worldX * 2.13 + 431, worldZ * 2.13 + 197);

        if (b >= effectiveBlades || scenePattern < sceneSuppression) {
          // Place blade at scale 0 (invisible) to keep instance count consistent
          dummy.position.set(worldX, worldY, worldZ);
          dummy.rotation.set(0, rotY, 0);
          dummy.scale.set(0, 0, 0);
          dummy.updateMatrix();
          dummy.matrix.toArray(mats, idx * 16);
          tintArr[idx * 3] = 1;
          tintArr[idx * 3 + 1] = 1;
          tintArr[idx * 3 + 2] = 1;
          idx++;
          continue;
        }

        // Height clustering — patches of tall vs short grass
        const cluster = clusterNoise(worldX, worldZ);
        const heightRange = BLADE_HEIGHT_MAX - BLADE_HEIGHT_MIN;
        const clusterHeight = BLADE_HEIGHT_MIN + (cluster * CLUSTER_INFLUENCE + randHeight * (1 - CLUSTER_INFLUENCE)) * heightRange;

        // Near-rock blades are shorter
        const bladeHeight = nearRock ? clusterHeight * 0.5 : clusterHeight;

        dummy.position.set(worldX, worldY, worldZ);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(1, bladeHeight, 1);
        dummy.updateMatrix();
        dummy.matrix.toArray(mats, idx * 16);

        // Per-instance color tint — varies from warm to cool green
        // Creates visible color patches across the meadow
        const tintCluster = clusterNoise(worldX * 1.7 + 100, worldZ * 1.7 + 100);
        const warmCool = tintCluster * 0.5 + tintR * 0.5; // 0 = warm, 1 = cool
        // Warm: more yellow-green (1.1, 1.0, 0.8), Cool: more blue-green (0.8, 1.0, 1.1)
        tintArr[idx * 3]     = 0.85 + warmCool * 0.3;  // R: 0.85-1.15
        tintArr[idx * 3 + 1] = 0.9 + (1 - Math.abs(warmCool - 0.5)) * 0.2; // G: 0.9-1.1
        tintArr[idx * 3 + 2] = 0.75 + (1 - warmCool) * 0.3; // B: 0.75-1.05

        idx++;
      }
    }

    return { matrices: mats, tints: tintArr };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grassTiles, instanceCount, mapData.seed, groundSampler, openingSceneGrassSuppression]);

  // Shader material
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: grassVertexShader,
      fragmentShader: grassFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWindSpeed: { value: WIND_SPEED },
        uWindStrength: { value: WIND_STRENGTH },
        uBaseColor: { value: GRASS_BASE_COLOR },
        uTipColor: { value: GRASS_TIP_COLOR },
      },
      side: THREE.DoubleSide,
      transparent: false,
    });
  }, []);

  // Animate wind
  useFrame((state) => {
    if (shaderMaterial) {
      shaderMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  // Apply instance matrices + tint attribute — useEffect (not useMemo) so meshRef.current is assigned
  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const dummy = new THREE.Matrix4();

    for (let i = 0; i < instanceCount; i++) {
      dummy.fromArray(matrices, i * 16);
      mesh.setMatrixAt(i, dummy);
    }
    mesh.instanceMatrix.needsUpdate = true;

    // Set per-instance tint color as an instanced buffer attribute
    const tintAttr = new THREE.InstancedBufferAttribute(tints, 3);
    mesh.geometry.setAttribute('instanceTint', tintAttr);
  }, [matrices, tints, instanceCount]);

  if (instanceCount === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[bladeGeo, shaderMaterial, instanceCount]}
      frustumCulled={false}
    />
  );
};

export default GrassLayer;

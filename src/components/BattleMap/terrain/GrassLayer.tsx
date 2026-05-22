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
import { BattleMapData } from '../../../types/combat';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SIZE = 1.0;
const BLADES_PER_TILE = 40;
const BLADE_WIDTH = 0.06;
const BLADE_HEIGHT_MIN = 0.18;
const BLADE_HEIGHT_MAX = 0.40;
const BLADE_SEGMENTS = 4; // Vertices along the blade height for bending

const WIND_SPEED = 1.2;
const WIND_STRENGTH = 0.12;

// Colors
const GRASS_BASE_COLOR = new THREE.Color(0.12, 0.22, 0.05); // Dark forest green base
const GRASS_TIP_COLOR = new THREE.Color(0.28, 0.50, 0.12); // Medium green tips — not yellow

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

  varying float vHeight;
  varying vec2 vUv;

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

  void main() {
    // Vertical gradient from base to tip color
    vec3 color = mix(uBaseColor, uTipColor, vHeight);

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

  // Blade geometry (shared by all instances)
  const bladeGeo = useMemo(() => createBladeGeometry(), []);

  // Build instance matrices
  const { matrices } = useMemo(() => {
    const rand = seededRandom(mapData.seed ?? 42);
    const mats = new Float32Array(instanceCount * 16);
    const dummy = new THREE.Object3D();

    let idx = 0;
    for (const tile of grassTiles) {
      for (let b = 0; b < BLADES_PER_TILE; b++) {
        // Random position within tile
        const offsetX = rand() * TILE_SIZE;
        const offsetZ = rand() * TILE_SIZE;
        const worldX = tile.x * TILE_SIZE + offsetX;
        const worldZ = tile.y * TILE_SIZE + offsetZ;
        const worldY = tile.elevation * 0.3; // Match terrain ELEVATION_SCALE

        // Random rotation around Y
        const rotY = rand() * Math.PI * 2;

        // Random height
        const bladeHeight = BLADE_HEIGHT_MIN + rand() * (BLADE_HEIGHT_MAX - BLADE_HEIGHT_MIN);

        dummy.position.set(worldX, worldY, worldZ);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(1, bladeHeight, 1);
        dummy.updateMatrix();

        dummy.matrix.toArray(mats, idx * 16);
        idx++;
      }
    }

    return { matrices: mats };
  }, [grassTiles, instanceCount, mapData.seed]);

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

  // Apply instance matrices — useEffect (not useMemo) so meshRef.current is assigned
  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const dummy = new THREE.Matrix4();

    for (let i = 0; i < instanceCount; i++) {
      dummy.fromArray(matrices, i * 16);
      mesh.setMatrixAt(i, dummy);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices, instanceCount]);

  if (instanceCount === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[bladeGeo, shaderMaterial, instanceCount]}
      frustumCulled={true}
    />
  );
};

export default GrassLayer;

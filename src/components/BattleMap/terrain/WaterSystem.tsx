/**
 * @file WaterSystem.tsx
 * Animated water plane using MeshStandardMaterial + onBeforeCompile.
 *
 * Why onBeforeCompile instead of raw ShaderMaterial:
 * - PBR lighting, fog, and tone-mapping come for free from MeshStandardMaterial
 * - We only need to inject: uTime uniform, wave displacement, caustic color,
 *   and animated normal perturbation
 * - Much easier to make water look like it belongs in the scene
 *
 * Key visual fixes over previous version:
 * - Removed fract()-based depth proxy that created visible tile-grid lines
 * - Replaced with world-position FBM noise → seamless color variation
 * - Better biome color palettes (more vibrant, less dark/murky)
 * - Animated normal perturbation for ripple reflections
 * - Caustic brightening using dual scrolling FBM layers
 * - Crest brightness via wave displacement feedback
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "Water System"
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BattleMapData } from '../../../types/combat';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SIZE = 1.0;
const ELEVATION_SCALE = 0.3;
/** Subdivisions per tile — 6 gives smooth waves; 8 is overkill for small tiles */
const WATER_SUBDIVISIONS = 6;
/** How far above terrain elevation the water surface sits */
const WATER_SURFACE_OFFSET = 0.04;

// ---------------------------------------------------------------------------
// Per-biome water color palettes
// ---------------------------------------------------------------------------

interface WaterColors {
  shallow: THREE.Color;
  deep: THREE.Color;
  /** Used to tint caustic highlights */
  causticTint: THREE.Color;
}

function getBiomeWaterColors(biome: string): WaterColors {
  switch (biome) {
    case 'swamp':
      return {
        shallow:     new THREE.Color(0.12, 0.22, 0.09),
        deep:        new THREE.Color(0.06, 0.10, 0.04),
        causticTint: new THREE.Color(0.50, 0.65, 0.20),
      };
    case 'cave':
      return {
        shallow:     new THREE.Color(0.06, 0.22, 0.38),
        deep:        new THREE.Color(0.02, 0.08, 0.22),
        causticTint: new THREE.Color(0.30, 0.60, 1.00),
      };
    case 'desert':
      return {
        shallow:     new THREE.Color(0.18, 0.50, 0.60),
        deep:        new THREE.Color(0.06, 0.24, 0.42),
        causticTint: new THREE.Color(0.70, 0.90, 1.00),
      };
    default: // forest, dungeon, unknown
      return {
        shallow:     new THREE.Color(0.10, 0.42, 0.58),
        deep:        new THREE.Color(0.04, 0.16, 0.32),
        causticTint: new THREE.Color(0.40, 0.80, 1.00),
      };
  }
}

// ---------------------------------------------------------------------------
// GLSL snippets — injected into MeshStandardMaterial's compiled shader
// ---------------------------------------------------------------------------

/**
 * Vertex preamble — uniform + varyings needed for wave animation.
 * Injected after `#include <common>` in the vertex shader.
 */
const WATER_VERTEX_PREAMBLE = /* glsl */ `
  uniform float uWaterTime;
  varying vec3  vWaterWorldPos;
  varying float vWaterWaveDisp;
`;

/**
 * Vertex displacement — multi-frequency waves and world-pos passing.
 * Injected after `#include <begin_vertex>` (where `transformed` is live).
 */
const WATER_VERTEX_DISPLACEMENT = /* glsl */ `
  // World position before displacement — used for stable UV sampling
  vec4 _preWorld = modelMatrix * vec4(transformed, 1.0);

  // Three overlapping sine waves at different angles / frequencies
  float _wA = sin(_preWorld.x * 1.9  + uWaterTime * 0.72) * 0.013;
  float _wB = sin(_preWorld.z * 2.4  + uWaterTime * 0.55 + 1.57) * 0.009;
  float _wC = sin((_preWorld.x * 0.7 + _preWorld.z * 1.5) * 2.9 + uWaterTime * 1.05) * 0.006;
  transformed.y += _wA + _wB + _wC;
  vWaterWaveDisp = _wA + _wB + _wC;

  // Re-derive world pos after displacement so fragment samples displaced surface
  vWaterWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;

/**
 * Fragment preamble — uniform + varyings + noise helpers.
 * Injected after `#include <common>` in the fragment shader.
 */
const WATER_FRAGMENT_PREAMBLE = /* glsl */ `
  uniform float uWaterTime;
  uniform vec3  uWaterShallow;
  uniform vec3  uWaterDeep;
  uniform vec3  uWaterCaustic;
  varying vec3  vWaterWorldPos;
  varying float vWaterWaveDisp;

  float wHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float wNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(wHash(i), wHash(i + vec2(1.0, 0.0)), f.x),
      mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float wFbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * wNoise(p);
      p  = p * 2.1 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }
`;

/**
 * Fragment color override — replaces `#include <color_fragment>`.
 * Uses world-position FBM (no tile repeats) for the depth gradient.
 * Adds caustic brightening via dual-scroll FBM layers.
 */
const WATER_FRAGMENT_COLOR = /* glsl */ `
  vec2 _wxz = vWaterWorldPos.xz;

  // Scrolling noise for base color blend — world-space, no tile seams
  float _cNoise = wFbm(_wxz * 0.35 + vec2(uWaterTime * 0.040,  uWaterTime * 0.028))
                * 0.55
                + wFbm(_wxz * 0.50 - vec2(uWaterTime * 0.025,  uWaterTime * 0.042))
                * 0.45;
  vec3 _wCol = mix(uWaterShallow, uWaterDeep, clamp(_cNoise * 0.9 + 0.05, 0.0, 1.0));

  // Caustic overlay — two FBM layers scrolling in opposite directions
  float _cauA = wFbm(_wxz * 4.8 + vec2( uWaterTime * 0.18,  uWaterTime * 0.13));
  float _cauB = wFbm(_wxz * 4.8 - vec2( uWaterTime * 0.13,  uWaterTime * 0.18));
  float _cau  = pow((_cauA + _cauB) * 0.5, 2.4) * 0.40;
  _wCol += uWaterCaustic * _cau;

  // Wave crest brightening — peaks catch light
  _wCol += vec3(max(vWaterWaveDisp, 0.0) * 5.0);

  diffuseColor.rgb = _wCol;
`;

/**
 * Fragment normal perturbation — animated ripple normals from noise gradient.
 * Injected after `#include <normal_fragment_maps>` where `normal` is live.
 */
const WATER_NORMAL_PERTURBATION = /* glsl */ `
  vec2  _nxz  = vWaterWorldPos.xz;
  float _eps  = 0.07;
  float _nC   = wFbm(_nxz * 2.2 + vec2(uWaterTime * 0.10,  uWaterTime * 0.07));
  float _nXp  = wFbm((_nxz + vec2(_eps, 0.0)) * 2.2 + vec2(uWaterTime * 0.10, uWaterTime * 0.07));
  float _nZp  = wFbm((_nxz + vec2(0.0, _eps)) * 2.2 + vec2(uWaterTime * 0.10, uWaterTime * 0.07));
  vec3 _nPert = normalize(vec3(-(_nXp - _nC) / _eps * 0.45, 1.0, -(_nZp - _nC) / _eps * 0.45));
  // Blend 50/50: keeps geometric normal contribution so lighting reads correctly
  normal = normalize(mix(normal, normalize(mat3(viewMatrix) * _nPert), 0.50));
`;

// ---------------------------------------------------------------------------
// Material factory
// ---------------------------------------------------------------------------

interface WaterShaderUniforms {
  uWaterTime:    { value: number };
  uWaterShallow: { value: THREE.Color };
  uWaterDeep:    { value: THREE.Color };
  uWaterCaustic: { value: THREE.Color };
}

function createWaterMaterial(colors: WaterColors): {
  material: THREE.MeshStandardMaterial;
  uniforms: WaterShaderUniforms;
} {
  const uniforms: WaterShaderUniforms = {
    uWaterTime:    { value: 0 },
    uWaterShallow: { value: colors.shallow },
    uWaterDeep:    { value: colors.deep },
    uWaterCaustic: { value: colors.causticTint },
  };

  const mat = new THREE.MeshStandardMaterial({
    color:       colors.shallow,   // base — overridden by shader
    roughness:   0.08,             // water is highly reflective
    metalness:   0.0,
    transparent: true,
    opacity:     0.88,
    depthWrite:  false,            // required for correct transparency sort
    side:        THREE.FrontSide,
  });

  mat.onBeforeCompile = (shader) => {
    // Inject our uniforms into the compiled shader
    Object.assign(shader.uniforms, uniforms);

    // ----- Vertex shader -----
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>\n${WATER_VERTEX_PREAMBLE}`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n${WATER_VERTEX_DISPLACEMENT}`,
    );

    // ----- Fragment shader -----
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>\n${WATER_FRAGMENT_PREAMBLE}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      WATER_FRAGMENT_COLOR,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>\n${WATER_NORMAL_PERTURBATION}`,
    );
  };

  // Cache key prevents shader reuse across different biomes
  mat.customProgramCacheKey = () =>
    `water-v3-${colors.shallow.getHex()}-${colors.deep.getHex()}`;

  return { material: mat, uniforms };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WaterSystemProps {
  mapData: BattleMapData;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const WaterSystem: React.FC<WaterSystemProps> = ({ mapData }) => {
  const uniformsRef = useRef<WaterShaderUniforms | null>(null);

  const biome = (mapData as BattleMapData & { biome?: string }).biome
    ?? mapData.theme
    ?? 'forest';

  // Collect all water tiles
  const waterTiles = useMemo(() => {
    const tiles: { x: number; y: number; elevation: number }[] = [];
    for (const [, tile] of mapData.tiles) {
      if (tile.terrain === 'water') {
        tiles.push({
          x: tile.coordinates.x,
          y: tile.coordinates.y,
          elevation: tile.elevation,
        });
      }
    }
    return tiles;
  }, [mapData]);

  // Build merged water geometry — one mesh covering all water tiles
  const geometry = useMemo(() => {
    if (waterTiles.length === 0) return null;

    const allPositions: number[] = [];
    const allUVs: number[] = [];
    const allIndices: number[] = [];
    let vertexOffset = 0;

    for (const tile of waterTiles) {
      const subX = WATER_SUBDIVISIONS;
      const subZ = WATER_SUBDIVISIONS;
      const y = tile.elevation * ELEVATION_SCALE + WATER_SURFACE_OFFSET;

      for (let iz = 0; iz <= subZ; iz++) {
        for (let ix = 0; ix <= subX; ix++) {
          const x = tile.x * TILE_SIZE + (ix / subX) * TILE_SIZE;
          const z = tile.y * TILE_SIZE + (iz / subZ) * TILE_SIZE;
          allPositions.push(x, y, z);
          // UVs in world scale so noise frequencies are consistent across tiles
          allUVs.push(x, z);
        }
      }

      for (let iz = 0; iz < subZ; iz++) {
        for (let ix = 0; ix < subX; ix++) {
          const a = vertexOffset + iz * (subX + 1) + ix;
          const b = a + 1;
          const c = a + (subX + 1);
          const d = c + 1;
          allIndices.push(a, c, b);
          allIndices.push(b, c, d);
        }
      }

      vertexOffset += (subX + 1) * (subZ + 1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(allUVs,       2));
    geo.setIndex(allIndices);
    geo.computeVertexNormals();
    return geo;
  }, [waterTiles]);

  // Material + uniform handle — recreated only when biome changes
  const { material, uniforms } = useMemo(() => {
    const colors = getBiomeWaterColors(biome);
    return createWaterMaterial(colors);
  }, [biome]);

  // Store uniforms ref for useFrame access (avoids closure stale-capture)
  uniformsRef.current = uniforms;

  // Dispose GPU resources when geometry / material changes or component unmounts
  useEffect(() => () => { geometry?.dispose(); }, [geometry]);
  useEffect(() => () => { material.dispose(); }, [material]);

  // Animate — update uWaterTime every frame
  useFrame((state) => {
    if (uniformsRef.current) {
      uniformsRef.current.uWaterTime.value = state.clock.elapsedTime;
    }
  });

  if (!geometry || waterTiles.length === 0) return null;

  return (
    <mesh
      geometry={geometry}
      material={material}
      renderOrder={2}
    />
  );
};

export default WaterSystem;

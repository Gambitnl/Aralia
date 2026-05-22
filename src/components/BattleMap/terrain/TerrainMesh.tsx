/**
 * @file TerrainMesh.tsx
 * Continuous heightfield terrain mesh with procedural PBR-like texturing.
 *
 * Uses a single subdivided PlaneGeometry whose vertex Y positions are set from
 * tile elevation values via bicubic interpolation. Surface detail comes from
 * GLSL procedural noise injected into MeshStandardMaterial via onBeforeCompile,
 * giving us free lighting, shadows, fog, and tone mapping.
 *
 * Terrain types (grass, rock, dirt, sand, etc.) are encoded in a DataTexture
 * and the fragment shader selects per-type color + noise patterns. Edge blending
 * softens transitions between adjacent terrain types.
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "Terrain System" section
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { BattleMapData, BattleMapTile } from '../../../types/combat';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How many geometry subdivisions per tile (4x = smooth enough for BG3 feel) */
const SUBDIVISIONS_PER_TILE = 4;

/** Vertical scale factor: elevation 1 → this many world units height */
const ELEVATION_SCALE = 0.3;

/** Small noise amplitude to add organic micro-detail to terrain surface */
const MICRO_NOISE_AMPLITUDE = 0.04;

/** World unit size of each tile */
const TILE_SIZE = 1.0;

// ---------------------------------------------------------------------------
// Helpers — interpolation & noise (CPU side, for geometry generation)
// ---------------------------------------------------------------------------

function cubicInterpolate(v0: number, v1: number, v2: number, v3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * v1) +
    (-v0 + v2) * t +
    (2 * v0 - 5 * v1 + 4 * v2 - v3) * t2 +
    (-v0 + 3 * v1 - 3 * v2 + v3) * t3
  );
}

function bicubicSample(
  getElevation: (tx: number, ty: number) => number,
  fx: number,
  fy: number,
  width: number,
  height: number,
): number {
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const dx = fx - ix;
  const dy = fy - iy;

  const cols: number[] = [];
  for (let j = -1; j <= 2; j++) {
    const row: number[] = [];
    for (let i = -1; i <= 2; i++) {
      const sx = Math.max(0, Math.min(width - 1, ix + i));
      const sy = Math.max(0, Math.min(height - 1, iy + j));
      row.push(getElevation(sx, sy));
    }
    cols.push(cubicInterpolate(row[0], row[1], row[2], row[3], dx));
  }

  return cubicInterpolate(cols[0], cols[1], cols[2], cols[3], dy);
}

function pseudoNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 73.13) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const n00 = pseudoNoise(ix, iy, seed);
  const n10 = pseudoNoise(ix + 1, iy, seed);
  const n01 = pseudoNoise(ix, iy + 1, seed);
  const n11 = pseudoNoise(ix + 1, iy + 1, seed);

  const nx0 = n00 + sx * (n10 - n00);
  const nx1 = n01 + sx * (n11 - n01);

  return nx0 + sy * (nx1 - nx0);
}

// ---------------------------------------------------------------------------
// Terrain type encoding for the GPU data texture
// ---------------------------------------------------------------------------

const TERRAIN_TYPE_INDEX: Record<string, number> = {
  grass: 0,
  rock: 1,
  difficult: 2,
  sand: 3,
  water: 4,
  wall: 5,
  floor: 6,
  mud: 2, // same visual as difficult
};

/**
 * Creates a DataTexture encoding the terrain type per tile.
 * R channel = type index (0–7), used by the fragment shader.
 */
function createTerrainTypeTexture(
  mapData: BattleMapData,
  width: number,
  height: number,
): THREE.DataTexture {
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const tile = mapData.tiles.get(`${x}-${y}`);
      const terrainType = tile?.terrain ?? 'grass';
      data[idx] = TERRAIN_TYPE_INDEX[terrainType] ?? 0;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// GLSL procedural terrain texturing — injected via onBeforeCompile
// ---------------------------------------------------------------------------

const TERRAIN_GLSL_PREAMBLE = /* glsl */ `
  varying vec3 vTerrainWorldPos;
  uniform sampler2D uTerrainTypeMap;
  uniform float uMapWidth;
  uniform float uMapHeight;

  // ---- Hash / noise functions (Dave Hoskins style) ----
  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm4(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  float voronoi(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float md = 1.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 nb = vec2(float(x), float(y));
        float h = hash21(i + nb);
        vec2 pt = vec2(fract(h * 17.31), fract(h * 43.47));
        md = min(md, length(nb + pt - f));
      }
    }
    return md;
  }

  // ---- Per-terrain-type color functions ----

  vec3 getGrassColor(vec2 wXZ) {
    float n1 = fbm4(wXZ * 4.0);
    float n2 = fbm4(wXZ * 5.6 + vec2(5.7, 3.2));
    float detail = n1 * 0.3 + n2 * 0.15;
    vec3 c = mix(vec3(0.10, 0.20, 0.05), vec3(0.25, 0.42, 0.16), detail + 0.55);
    // Dirt patches
    float dp = smoothstep(0.42, 0.58, fbm4(wXZ * 1.5 + vec2(42.0, 17.0)));
    c = mix(c, vec3(0.30, 0.24, 0.14), dp * 0.35);
    // Fine grain
    c += vnoise(wXZ * 16.0) * 0.08 - 0.04;
    return c;
  }

  vec3 getRockColor(vec2 wXZ) {
    float n = fbm4(wXZ * 3.6);
    float crack = voronoi(wXZ * 4.5);
    vec3 c = mix(vec3(0.25, 0.24, 0.22), vec3(0.50, 0.48, 0.44),
                 n * 0.4 + crack * 0.35 + 0.35);
    c *= 0.7 + 0.3 * smoothstep(0.0, 0.08, crack);
    c += vec3(0.03, -0.01, -0.02) * fbm4(wXZ * 1.5 + vec2(11.0, 7.0));
    return c;
  }

  vec3 getDirtColor(vec2 wXZ) {
    float n = fbm4(wXZ * 3.15 + vec2(17.0, 23.0));
    vec3 c = mix(vec3(0.20, 0.14, 0.07), vec3(0.42, 0.34, 0.22), n + 0.45);
    c += vec3(0.05, 0.04, 0.02) * step(0.7, vnoise(wXZ * 12.0));
    c += vnoise(wXZ * 20.0) * 0.06 - 0.03;
    return c;
  }

  vec3 getSandColor(vec2 wXZ) {
    float n = fbm4(wXZ * 1.5 + vec2(33.0, 41.0));
    float ripple = sin(wXZ.x * 12.0 + wXZ.y * 4.0 + n * 3.0) * 0.5 + 0.5;
    vec3 c = mix(vec3(0.70, 0.60, 0.38), vec3(0.85, 0.75, 0.52),
                 n * 0.3 + ripple * 0.2 + 0.4);
    c += vec3(0.05) * step(0.92, vnoise(wXZ * 30.0));
    return c;
  }

  vec3 getWaterBedColor(vec2 wXZ) {
    float n = fbm4(wXZ * 3.0 + vec2(7.0, 13.0));
    return mix(vec3(0.08, 0.18, 0.25), vec3(0.12, 0.28, 0.35), n);
  }

  vec3 getWallColor(vec2 wXZ) {
    float n = fbm4(wXZ * 2.5 + vec2(71.0, 59.0));
    float crack = voronoi(wXZ * 2.0);
    return mix(vec3(0.18, 0.17, 0.16), vec3(0.38, 0.36, 0.34),
               n * 0.35 + crack * 0.3 + 0.35);
  }

  vec3 getFloorColor(vec2 wXZ) {
    float n = fbm4(wXZ * 3.0 + vec2(51.0, 37.0));
    float tileLine = step(0.03, fract(wXZ.x)) * step(0.03, fract(wXZ.y));
    vec3 c = mix(vec3(0.32, 0.28, 0.24), vec3(0.48, 0.44, 0.38), n * 0.4 + 0.45);
    c *= 0.85 + 0.15 * tileLine;
    return c;
  }

  vec3 getTerrainColor(float idx, vec2 wXZ) {
    int t = int(idx + 0.5);
    if (t == 0) return getGrassColor(wXZ);
    if (t == 1) return getRockColor(wXZ);
    if (t == 2) return getDirtColor(wXZ);
    if (t == 3) return getSandColor(wXZ);
    if (t == 4) return getWaterBedColor(wXZ);
    if (t == 5) return getWallColor(wXZ);
    if (t == 6) return getFloorColor(wXZ);
    return getGrassColor(wXZ);
  }
`;

const TERRAIN_COLOR_FRAGMENT = /* glsl */ `
  // ---- Procedural terrain texturing ----
  vec2 _tileUV = vec2(
    (floor(vTerrainWorldPos.x) + 0.5) / uMapWidth,
    (floor(vTerrainWorldPos.z) + 0.5) / uMapHeight
  );
  float _terrainIdx = texture2D(uTerrainTypeMap, _tileUV).r * 255.0;
  vec3 _terrainColor = getTerrainColor(_terrainIdx, vTerrainWorldPos.xz);

  // Edge blending: soften transitions between different terrain types
  vec2 _tileFrac = fract(vTerrainWorldPos.xz);
  float _edgeW = 0.18;
  float _ex = min(_tileFrac.x, 1.0 - _tileFrac.x);
  float _ez = min(_tileFrac.y, 1.0 - _tileFrac.y);
  float _edgeDist = min(_ex, _ez);

  if (_edgeDist < _edgeW) {
    float _blend = 1.0 - smoothstep(0.0, _edgeW, _edgeDist);
    vec2 _nOff = vec2(0.0);
    if (_ex < _ez) {
      _nOff.x = _tileFrac.x < 0.5 ? -1.0 : 1.0;
    } else {
      _nOff.y = _tileFrac.y < 0.5 ? -1.0 : 1.0;
    }
    vec2 _nUV = vec2(
      (floor(vTerrainWorldPos.x + _nOff.x) + 0.5) / uMapWidth,
      (floor(vTerrainWorldPos.z + _nOff.y) + 0.5) / uMapHeight
    );
    if (_nUV.x >= 0.0 && _nUV.x <= 1.0 && _nUV.y >= 0.0 && _nUV.y <= 1.0) {
      float _nIdx = texture2D(uTerrainTypeMap, _nUV).r * 255.0;
      if (abs(_nIdx - _terrainIdx) > 0.5) {
        vec3 _nColor = getTerrainColor(_nIdx, vTerrainWorldPos.xz);
        _terrainColor = mix(_terrainColor, _nColor, _blend * 0.5);
      }
    }
  }

  diffuseColor.rgb = _terrainColor;
`;

const TERRAIN_NORMAL_FRAGMENT = /* glsl */ `
  // ---- Procedural normal perturbation for terrain bumps ----
  float _bs = 0.2;
  vec2 _bu1 = vTerrainWorldPos.xz * 4.0;
  vec2 _bu2 = vTerrainWorldPos.xz * 12.0;
  float _bh  = vnoise(_bu1) * 0.6 + vnoise(_bu2) * 0.4;
  float _bhx = vnoise(_bu1 + vec2(0.05, 0.0)) * 0.6 + vnoise(_bu2 + vec2(0.05, 0.0)) * 0.4;
  float _bhz = vnoise(_bu1 + vec2(0.0, 0.05)) * 0.6 + vnoise(_bu2 + vec2(0.0, 0.05)) * 0.4;
  vec3 _wb = normalize(vec3(-(_bh - _bhx) / 0.05 * _bs, 1.0, -(_bh - _bhz) / 0.05 * _bs));
  vec3 _vb = normalize(mat3(viewMatrix) * _wb);
  normal = normalize(mix(normal, _vb, 0.3));
`;

// ---------------------------------------------------------------------------
// Custom terrain material factory
// ---------------------------------------------------------------------------

function createTerrainMaterial(
  terrainTypeTex: THREE.DataTexture,
  mapWidth: number,
  mapHeight: number,
  seed: number,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.88,
    metalness: 0.02,
    side: THREE.FrontSide,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTerrainTypeMap = { value: terrainTypeTex };
    shader.uniforms.uMapWidth = { value: mapWidth };
    shader.uniforms.uMapHeight = { value: mapHeight };

    // --- Vertex shader: pass world position ---
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vTerrainWorldPos;',
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    );

    // --- Fragment shader: inject noise functions + uniforms ---
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>\n${TERRAIN_GLSL_PREAMBLE}`,
    );

    // Replace vertex-color fragment with procedural terrain color
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      TERRAIN_COLOR_FRAGMENT,
    );

    // Add normal perturbation after normal mapping
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>\n${TERRAIN_NORMAL_FRAGMENT}`,
    );
  };

  mat.customProgramCacheKey = () => `terrain-pbr-v2-${mapWidth}-${mapHeight}-${seed}`;
  return mat;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TerrainMeshProps {
  mapData: BattleMapData;
  validMoves: Set<string>;
  activePath: { id: string }[];
  actionMode: 'move' | 'ability' | null;
  onTileClick: (tile: BattleMapTile) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TerrainMesh: React.FC<TerrainMeshProps> = ({
  mapData,
  validMoves,
  activePath,
  actionMode,
  onTileClick,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { width, height } = mapData.dimensions;

  // Build tile lookup for fast access
  const tileGrid = useMemo(() => {
    const grid: (BattleMapTile | null)[][] = [];
    for (let y = 0; y < height; y++) {
      grid[y] = [];
      for (let x = 0; x < width; x++) {
        grid[y][x] = mapData.tiles.get(`${x}-${y}`) ?? null;
      }
    }
    return grid;
  }, [mapData, width, height]);

  // Generate the heightfield geometry (no vertex colors — shader handles color)
  const geometry = useMemo(() => {
    const segsX = width * SUBDIVISIONS_PER_TILE;
    const segsZ = height * SUBDIVISIONS_PER_TILE;

    const geo = new THREE.PlaneGeometry(
      width * TILE_SIZE,
      height * TILE_SIZE,
      segsX,
      segsZ,
    );

    geo.rotateX(-Math.PI / 2);
    const positions = geo.attributes.position as THREE.BufferAttribute;
    const vertexCount = positions.count;

    const getElevation = (tx: number, ty: number): number => {
      const cx = Math.max(0, Math.min(width - 1, tx));
      const cy = Math.max(0, Math.min(height - 1, ty));
      return tileGrid[cy]?.[cx]?.elevation ?? 0;
    };

    const seed = mapData.seed ?? 42;

    for (let i = 0; i < vertexCount; i++) {
      const vx = positions.getX(i);
      const vz = positions.getZ(i);

      const tileX = (vx / TILE_SIZE) + width / 2;
      const tileZ = (vz / TILE_SIZE) + height / 2;

      const smoothElevation = bicubicSample(getElevation, tileX, tileZ, width, height);
      const noise = smoothNoise(tileX * 3.7, tileZ * 3.7, seed) * 2 - 1;
      const microDetail = noise * MICRO_NOISE_AMPLITUDE;

      positions.setY(i, smoothElevation * ELEVATION_SCALE + microDetail);
      positions.setX(i, vx + (width / 2) * TILE_SIZE);
      positions.setZ(i, vz + (height / 2) * TILE_SIZE);
    }

    geo.computeVertexNormals();
    positions.needsUpdate = true;
    return geo;
  }, [tileGrid, width, height, mapData.seed]);

  // Terrain type data texture (per-tile, for the GPU)
  const terrainTypeTex = useMemo(
    () => createTerrainTypeTexture(mapData, width, height),
    [mapData, width, height],
  );

  // Custom material with procedural GLSL texturing
  const material = useMemo(
    () => createTerrainMaterial(terrainTypeTex, width, height, mapData.seed ?? 42),
    [terrainTypeTex, width, height, mapData.seed],
  );

  // Dispose GPU resources on change/unmount
  useEffect(() => () => { terrainTypeTex.dispose(); }, [terrainTypeTex]);
  useEffect(() => () => { material.dispose(); }, [material]);

  // Active path set for quick lookup
  const activePathSet = useMemo(() => {
    const set = new Set<string>();
    activePath.forEach(p => set.add(p.id));
    return set;
  }, [activePath]);

  // Handle click → determine which tile was hit
  const handleClick = useMemo(() => {
    return (event: THREE.Intersection) => {
      if (!event.point) return;
      const px = event.point.x;
      const pz = event.point.z;
      const tileX = Math.floor(px / TILE_SIZE);
      const tileZ = Math.floor(pz / TILE_SIZE);
      const tileId = `${tileX}-${tileZ}`;
      const tile = mapData.tiles.get(tileId);
      if (tile) onTileClick(tile);
    };
  }, [mapData, onTileClick]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      receiveShadow
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (e.intersections[0]) {
          handleClick(e.intersections[0]);
        }
      }}
    />
  );
};

export default TerrainMesh;

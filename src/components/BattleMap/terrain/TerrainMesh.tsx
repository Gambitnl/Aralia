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
  //
  // Each function uses a 3-scale hierarchy so terrain reads as landscape,
  // not math noise:
  //   macro  (freq 0.15–0.35): 3–7 tile patches — regional color zones
  //   mid    (freq 0.6–1.5):   0.7–1.7 tile blending — sub-biome variation
  //   micro  (freq 5–10):      surface grain — very subtle, ±0.04 at most
  //
  // wXZ = vTerrainWorldPos.xz where 1 unit = 1 tile.

  vec3 getGrassColor(vec2 wXZ) {
    // Macro: lush vs meadow vs dry-grass zones spanning several tiles
    float macro = fbm4(wXZ * 0.20 + vec2(1.7, 3.1));
    // Mid: local density/shade variation
    float mid   = fbm4(wXZ * 0.85 + vec2(8.3, 2.4));
    // Fine surface grain
    float grain = vnoise(wXZ * 8.0);

    vec3 lush  = vec3(0.09, 0.30, 0.07);  // deep forest floor green
    vec3 field = vec3(0.20, 0.40, 0.13);  // open meadow green
    vec3 faded = vec3(0.28, 0.38, 0.16);  // dry / sun-bleached

    vec3 c = mix(lush, field, smoothstep(0.25, 0.65, macro));
    c      = mix(c, faded,   smoothstep(0.58, 0.82, macro) * 0.65);

    // Mid-scale brightening in open patches
    c += vec3(0.0, 0.03, 0.0) * smoothstep(0.48, 0.72, mid);

    // Dirt bare patches at medium-large scale (not sub-tile)
    float dp = fbm4(wXZ * 0.42 + vec2(42.7, 17.3));
    c = mix(c, vec3(0.28, 0.22, 0.12), smoothstep(0.60, 0.76, dp) * 0.42);

    // Subtle grain
    c += (grain - 0.5) * 0.05;
    return clamp(c, 0.0, 1.0);
  }

  vec3 getRockColor(vec2 wXZ) {
    // Macro: mineral zone variation (light granite vs dark basalt vs ochre)
    float macro  = fbm4(wXZ * 0.18 + vec2(51.0, 17.3));
    float mid    = fbm4(wXZ * 0.80 + vec2(7.0, 33.0));
    // Visible crack structure at 1-tile and 0.3-tile scale
    float crack  = voronoi(wXZ * 1.1);
    float fine   = voronoi(wXZ * 3.2);

    vec3 light = vec3(0.58, 0.55, 0.50);
    vec3 dark  = vec3(0.24, 0.22, 0.20);
    vec3 ochre = vec3(0.48, 0.38, 0.26);  // iron-oxide mineral stain

    vec3 c = mix(dark, light, macro * 0.45 + 0.38);

    // Crack darkening — large cracks clearly visible at viewing distance
    c *= 0.55 + 0.45 * smoothstep(0.0, 0.18, crack);
    // Fine surface cracks
    c *= 0.88 + 0.12 * smoothstep(0.0, 0.08, fine);

    // Ochre mineral staining in macro patches
    float stain = smoothstep(0.62, 0.80, fbm4(wXZ * 0.28 + vec2(71.0, 59.0)));
    c = mix(c, ochre, stain * 0.35);

    c += (mid - 0.5) * 0.06;
    return clamp(c, 0.0, 1.0);
  }

  vec3 getDirtColor(vec2 wXZ) {
    // Macro: wet dark soil vs dry pale earth zones
    float macro = fbm4(wXZ * 0.22 + vec2(17.0, 23.0));
    float mid   = fbm4(wXZ * 0.80 + vec2(43.0, 11.0));
    float grain = vnoise(wXZ * 9.0);

    vec3 wet  = vec3(0.16, 0.10, 0.05);  // dark wet soil
    vec3 dryr = vec3(0.40, 0.30, 0.18);  // dry earth
    vec3 clay = vec3(0.50, 0.38, 0.24);  // pale clay

    vec3 c = mix(wet, dryr, smoothstep(0.28, 0.72, macro));

    // Clay patches — mid-scale, not sub-tile
    float clayPatch = smoothstep(0.58, 0.74, fbm4(wXZ * 0.38 + vec2(29.0, 53.0)));
    c = mix(c, clay, clayPatch * 0.38);

    // Pebble highlights — sparse bright specks at medium frequency
    float pebble = step(0.86, vnoise(wXZ * 6.0));
    c = mix(c, vec3(0.55, 0.50, 0.42), pebble * 0.55);

    c += (grain - 0.5) * 0.04;
    return clamp(c, 0.0, 1.0);
  }

  vec3 getSandColor(vec2 wXZ) {
    // Dune shape — elongated macro noise along X to simulate wind direction
    float dune = fbm4(wXZ * vec2(0.14, 0.28) + vec2(33.0, 41.0));
    float mid  = fbm4(wXZ * 0.55 + vec2(11.0, 7.0));
    // Ripple: sine wave perpendicular to dune axis
    float ripple = sin(wXZ.x * 6.0 + wXZ.y * 2.5 + dune * 4.5) * 0.5 + 0.5;

    vec3 pale   = vec3(0.90, 0.82, 0.62);  // pale dune crest
    vec3 medium = vec3(0.72, 0.60, 0.40);  // mid tone
    vec3 shadow = vec3(0.54, 0.43, 0.27);  // shadow between dunes

    vec3 c = mix(shadow, pale, smoothstep(0.28, 0.72, dune));
    // Ripple brightening — visible but subtle
    c += vec3(0.05, 0.04, 0.02) * ripple * 0.6;

    // Occasional rusty-red iron patches
    float red = smoothstep(0.64, 0.80, fbm4(wXZ * 0.22 + vec2(91.0, 37.0)));
    c = mix(c, vec3(0.72, 0.48, 0.26), red * 0.28);

    c += (mid - 0.5) * 0.04;
    return clamp(c, 0.0, 1.0);
  }

  vec3 getWaterBedColor(vec2 wXZ) {
    // Soft silt with pebble texture — mostly obscured by water above
    float macro  = fbm4(wXZ * 0.45 + vec2(7.0, 13.0));
    float pebble = voronoi(wXZ * 1.8);
    vec3 silt = mix(vec3(0.08, 0.18, 0.26), vec3(0.14, 0.28, 0.36),
                    macro * 0.5 + 0.35);
    silt *= 0.78 + 0.22 * smoothstep(0.0, 0.14, pebble);
    return clamp(silt, 0.0, 1.0);
  }

  vec3 getWallColor(vec2 wXZ) {
    // Large stone blocks at ~0.8 tile scale with visible mortar lines
    float block  = voronoi(wXZ * 0.75);  // block cell boundaries
    float fine   = voronoi(wXZ * 2.8);   // surface cracks within blocks
    float macro  = fbm4(wXZ * 0.22 + vec2(71.0, 59.0));

    vec3 stone = mix(vec3(0.22, 0.20, 0.18), vec3(0.44, 0.40, 0.36),
                     macro * 0.45 + 0.40);

    // Mortar lines: dark at block boundaries
    stone *= 0.40 + 0.60 * smoothstep(0.0, 0.14, block);
    // Fine crack darkening
    stone *= 0.88 + 0.12 * smoothstep(0.0, 0.08, fine);

    // Moss/damp staining concentrated at low block edges
    float mossEdge = smoothstep(0.10, 0.22, 1.0 - block);
    stone = mix(stone, vec3(0.18, 0.26, 0.16), mossEdge * 0.38);

    return clamp(stone, 0.0, 1.0);
  }

  vec3 getFloorColor(vec2 wXZ) {
    // Dungeon/indoor flagstone: 1-tile slab pattern with wear variation
    float macro   = fbm4(wXZ * 0.25 + vec2(51.0, 37.0));
    float mid     = fbm4(wXZ * 0.90 + vec2(13.0, 71.0));
    // Grout lines between tiles
    float grout = smoothstep(0.04, 0.09, fract(wXZ.x))
                * smoothstep(0.04, 0.09, fract(wXZ.y));

    vec3 slab = mix(vec3(0.30, 0.26, 0.22), vec3(0.50, 0.46, 0.40),
                    macro * 0.45 + 0.40);
    // Grout lines slightly darker
    slab *= 0.75 + 0.25 * grout;

    // Wear/scuff patches vary by mid noise
    float wear = smoothstep(0.55, 0.72, 1.0 - mid);
    slab = mix(slab, slab * 0.70, wear * 0.35);

    return clamp(slab, 0.0, 1.0);
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
// Terrain skirt — vertical panels hanging from perimeter edges to hide void
// ---------------------------------------------------------------------------

/**
 * Builds a quad-strip geometry that seals the underside of the terrain.
 *
 * The main terrain mesh is a subdivided plane with per-vertex elevation. When
 * you orbit the camera you can see the hollow underside where the mesh rises
 * from sea level. This skirt hangs vertical panels from the four perimeter
 * edges down to `SKIRT_BOTTOM_Y`, covering the gap.
 *
 * Elevation sampling uses the same bicubicSample + smoothNoise formula as the
 * main geometry so the top edge of each skirt panel exactly matches the
 * corresponding terrain vertex.
 */

const SKIRT_BOTTOM_Y = -1.0;

function buildSkirtGeometry(
  tileGrid: (BattleMapTile | null)[][],
  width: number,
  height: number,
  seed: number,
): THREE.BufferGeometry {
  const getElevation = (tx: number, ty: number): number => {
    const cx = Math.max(0, Math.min(width - 1, tx));
    const cy = Math.max(0, Math.min(height - 1, ty));
    return tileGrid[cy]?.[cx]?.elevation ?? 0;
  };

  /** Matches the exact Y formula used in the main geometry useMemo. */
  const getVertexY = (tileX: number, tileZ: number): number => {
    const smoothElev = bicubicSample(getElevation, tileX, tileZ, width, height);
    const noise = smoothNoise(tileX * 3.7, tileZ * 3.7, seed) * 2 - 1;
    return smoothElev * ELEVATION_SCALE + noise * MICRO_NOISE_AMPLITUDE;
  };

  const segsX = width * SUBDIVISIONS_PER_TILE;
  const segsZ = height * SUBDIVISIONS_PER_TILE;

  const positions: number[] = [];
  const indices: number[] = [];

  /** Add a quad strip from an ordered list of top-edge points. Each pair of
   *  adjacent points forms a quad down to SKIRT_BOTTOM_Y. */
  function addStrip(pts: Array<[number, number, number]>) {
    const base = positions.length / 3;
    for (const [x, y, z] of pts) {
      positions.push(x, y, z);               // top vertex
      positions.push(x, SKIRT_BOTTOM_Y, z);  // bottom vertex
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const tl = base + i * 2;
      const bl = base + i * 2 + 1;
      const tr = base + (i + 1) * 2;
      const br = base + (i + 1) * 2 + 1;
      // DoubleSide material — winding order not critical, but keep consistent
      indices.push(tl, bl, tr);
      indices.push(bl, br, tr);
    }
  }

  // North edge — z = 0, x from west to east
  const northPts: Array<[number, number, number]> = [];
  for (let i = 0; i <= segsX; i++) {
    const tileX = i / SUBDIVISIONS_PER_TILE;
    northPts.push([tileX * TILE_SIZE, getVertexY(tileX, 0), 0]);
  }
  addStrip(northPts);

  // South edge — z = height, x from west to east
  const southPts: Array<[number, number, number]> = [];
  for (let i = 0; i <= segsX; i++) {
    const tileX = i / SUBDIVISIONS_PER_TILE;
    southPts.push([tileX * TILE_SIZE, getVertexY(tileX, height), height * TILE_SIZE]);
  }
  addStrip(southPts);

  // West edge — x = 0, z from north to south
  const westPts: Array<[number, number, number]> = [];
  for (let j = 0; j <= segsZ; j++) {
    const tileZ = j / SUBDIVISIONS_PER_TILE;
    westPts.push([0, getVertexY(0, tileZ), tileZ * TILE_SIZE]);
  }
  addStrip(westPts);

  // East edge — x = width, z from north to south
  const eastPts: Array<[number, number, number]> = [];
  for (let j = 0; j <= segsZ; j++) {
    const tileZ = j / SUBDIVISIONS_PER_TILE;
    eastPts.push([width * TILE_SIZE, getVertexY(width, tileZ), tileZ * TILE_SIZE]);
  }
  addStrip(eastPts);

  // Bottom cap — thin horizontal plane at SKIRT_BOTTOM_Y sealing the base
  const capBase = positions.length / 3;
  positions.push(0,                  SKIRT_BOTTOM_Y, 0);
  positions.push(width * TILE_SIZE,  SKIRT_BOTTOM_Y, 0);
  positions.push(0,                  SKIRT_BOTTOM_Y, height * TILE_SIZE);
  positions.push(width * TILE_SIZE,  SKIRT_BOTTOM_Y, height * TILE_SIZE);
  indices.push(capBase, capBase + 2, capBase + 1);
  indices.push(capBase + 2, capBase + 3, capBase + 1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
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

  // Skirt geometry — vertical panels sealing terrain perimeter edges
  const skirtGeometry = useMemo(
    () => buildSkirtGeometry(tileGrid, width, height, mapData.seed ?? 42),
    [tileGrid, width, height, mapData.seed],
  );

  // Skirt material — solid earth/stone, DoubleSide to avoid winding issues
  const skirtMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: 0x2a1e12,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
    [],
  );

  // Dispose GPU resources on change/unmount
  useEffect(() => () => { terrainTypeTex.dispose(); }, [terrainTypeTex]);
  useEffect(() => () => { material.dispose(); }, [material]);
  useEffect(() => () => { skirtGeometry.dispose(); }, [skirtGeometry]);
  useEffect(() => () => { skirtMaterial.dispose(); }, [skirtMaterial]);

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
    <>
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
      {/* Skirt — seals the underside visible when orbiting around map edges */}
      <mesh geometry={skirtGeometry} material={skirtMaterial} receiveShadow />
    </>
  );
};

export default TerrainMesh;

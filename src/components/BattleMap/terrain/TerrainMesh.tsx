// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 16/07/2026, 11:54:41
 * Dependents: components/BattleMap/BattleMap3DGpuScene.tsx, components/BattleMap/terrain/DecorationProps.tsx, components/BattleMap/terrain/EzTreeLayer.tsx, components/BattleMap/terrain/GrassLayer.tsx, components/BattleMap/terrain/GridOverlay.tsx, components/BattleMap/terrain/GroundScatter.tsx, components/BattleMap/terrain/WaterSystem.tsx, components/BattleMap/terrain/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import React, { useEffect, useMemo, useRef } from "react";
import { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { BattleMapData, BattleMapTile } from "../../../types/combat";
import { BATTLE_MAP_ELEVATION_METERS_PER_UNIT } from "../../../config/mapConfig";
import { resolveTerrainTileCoordinates } from "./terrainTileMapping";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How many geometry subdivisions per tile (4x = smooth enough for BG3 feel) */
const SUBDIVISIONS_PER_TILE = 4;

// Non-playable visual run-out beyond the playable rect (world tiles per side).
// The terrain continues here (edge-clamped types + heights) and rolls down to
// the apron under the fog — replaces the old vertical perimeter skirt.
const FRINGE_TILES = 12;
// Must match the ground-apron plane Y in BattleMap3D (-0.15).
const FRINGE_APRON_Y = -0.15;

/** Small noise amplitude to add organic micro-detail to terrain surface */
const MICRO_NOISE_AMPLITUDE = 0.04;

/** World unit size of each tile */
const TILE_SIZE = 1.0;

/**
 * How deep water basins are carved below their tile's nominal elevation, in
 * elevation units. The water surface stays at the tile's nominal elevation
 * (see WaterSystem), so this depth is what transparency, the depth gradient,
 * and the shoreline foam band reveal. Bicubic interpolation turns the carve
 * into naturally sloping banks across the shore tiles.
 */
export const WATER_BASIN_DEPTH = 1.4;

// ---------------------------------------------------------------------------
// Helpers — interpolation & noise (CPU side, for geometry generation)
// ---------------------------------------------------------------------------

function cubicInterpolate(
  v0: number,
  v1: number,
  v2: number,
  v3: number,
  t: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * v1 +
      (-v0 + v2) * t +
      (2 * v0 - 5 * v1 + 4 * v2 - v3) * t2 +
      (-v0 + 3 * v1 - 3 * v2 + v3) * t3)
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

/**
 * Shared terrain height sampler: tile coordinates → world Y.
 *
 * Single source of truth for the surface formula (bicubic elevation +
 * micro-noise) used by the main heightfield, the perimeter skirt, and
 * WaterSystem's per-vertex depth bake. Water tiles are carved down by
 * WATER_BASIN_DEPTH so pools have real beds below their surface plane.
 */
export function makeTerrainHeightSampler(
  tileGrid: (BattleMapTile | null)[][],
  width: number,
  height: number,
  seed: number,
): (tileX: number, tileZ: number) => number {
  const getElevation = (tx: number, ty: number): number => {
    const cx = Math.max(0, Math.min(width - 1, tx));
    const cy = Math.max(0, Math.min(height - 1, ty));
    const tile = tileGrid[cy]?.[cx];
    const elev = tile?.elevation ?? 0;
    return tile?.terrain === "water" ? elev - WATER_BASIN_DEPTH : elev;
  };
  return (tileX: number, tileZ: number): number => {
    const smoothElev = bicubicSample(getElevation, tileX, tileZ, width, height);
    const noise = smoothNoise(tileX * 3.7, tileZ * 3.7, seed) * 2 - 1;
    // Recover the same real vertical metres that the 2D elevation readout
    // presents in feet; a shared constant keeps both renderers in agreement.
    return (
      smoothElev * BATTLE_MAP_ELEVATION_METERS_PER_UNIT +
      noise * MICRO_NOISE_AMPLITUDE
    );
  };
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
      const terrainType = tile?.terrain ?? "grass";
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
  varying vec3 vTerrainNormal;
  uniform sampler2D uTerrainTypeMap;
  uniform float uMapWidth;
  uniform float uMapHeight;
  uniform float uDapple;

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
    // Seed the output with grass so the compiler sees every path as initialized.
    vec3 color = getGrassColor(wXZ);
    if (t == 1) {
      color = getRockColor(wXZ);
    } else if (t == 2) {
      color = getDirtColor(wXZ);
    } else if (t == 3) {
      color = getSandColor(wXZ);
    } else if (t == 4) {
      color = getWaterBedColor(wXZ);
    } else if (t == 5) {
      color = getWallColor(wXZ);
    } else if (t == 6) {
      color = getFloorColor(wXZ);
    }
    return color;
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

  // Edge blending: organic borders between terrain types (GOAL #23). The
  // original straight, evenly-soft strip along tile edges read as a grid seam;
  // FBM-jittered edge distance makes the boundary wander into ragged fingers,
  // and the deeper mix reads as a real material border instead of a gradient.
  vec2 _tileFrac = fract(vTerrainWorldPos.xz);
  float _edgeW = 0.16;
  float _ex = min(_tileFrac.x, 1.0 - _tileFrac.x);
  float _ez = min(_tileFrac.y, 1.0 - _tileFrac.y);
  float _edgeDist = min(_ex, _ez);
  float _eNoise = fbm4(vTerrainWorldPos.xz * 2.7 + vec2(7.3, 13.7));
  _edgeDist = clamp(_edgeDist + (_eNoise - 0.5) * 0.24, 0.0, 1.0);

  if (_edgeDist < _edgeW) {
    float _blend = 1.0 - smoothstep(0.02, _edgeW, _edgeDist);
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
        _terrainColor = mix(_terrainColor, _nColor, _blend * 0.85);
      }
    }
  }

  // ---- Slope-exposed rock: steep ground breaks into rock faces (GOAL #28) ----
  // Geometric world normal drives a rock blend on grass/dirt/sand so hillsides
  // and carved banks read as terrain relief instead of tinted flat ground.
  // Gentle hills (<~20°) stay untouched; erosion streaking breaks up the band.
  {
    int _sType = int(_terrainIdx + 0.5);
    if (_sType == 0 || _sType == 2 || _sType == 3) {
      float _slope = 1.0 - clamp(vTerrainNormal.y, 0.0, 1.0);
      // Onset ~24° / full ~40°: calibrated to the generator's bluff faces
      // (gap #28 — the original 0.12/0.30 band asked for near-cliffs the
      // generator never produces, so rock faces stayed invisible).
      float _rocky = smoothstep(0.09, 0.24, _slope);
      if (_rocky > 0.001) {
        vec3 _rockC = getRockColor(vTerrainWorldPos.xz) * 0.92;
        float _streak = fbm4(vTerrainWorldPos.xz * vec2(0.9, 2.6) + vec2(31.0, 5.0));
        _rocky *= 0.55 + 0.45 * smoothstep(0.35, 0.65, _streak);
        _terrainColor = mix(_terrainColor, _rockC, clamp(_rocky, 0.0, 1.0) * 0.85);
      }
    }
  }

  // ---- Wet bank: damp, darkened earth in a band along waterlines (GOAL #43) ----
  // Land fragments near a water tile darken toward wet earth; pairs with the
  // water sheet's shoreline foam (WaterSystem) so shores read wet on both sides.
  if (int(_terrainIdx + 0.5) != 4) {
    float _wetDist = 9.0;
    for (int _wy = -1; _wy <= 1; _wy++) {
      for (int _wx = -1; _wx <= 1; _wx++) {
        if (_wx == 0 && _wy == 0) continue;
        vec2 _wTile = floor(vTerrainWorldPos.xz) + vec2(float(_wx), float(_wy));
        vec2 _wUV = (_wTile + 0.5) / vec2(uMapWidth, uMapHeight);
        if (_wUV.x < 0.0 || _wUV.x > 1.0 || _wUV.y < 0.0 || _wUV.y > 1.0) continue;
        float _wIdx = texture2D(uTerrainTypeMap, _wUV).r * 255.0;
        if (int(_wIdx + 0.5) == 4) {
          vec2 _wNear = clamp(vTerrainWorldPos.xz, _wTile, _wTile + 1.0);
          _wetDist = min(_wetDist, distance(vTerrainWorldPos.xz, _wNear));
        }
      }
    }
    float _wet = 1.0 - smoothstep(0.04, 0.42, _wetDist);
    _terrainColor = mix(_terrainColor, _terrainColor * vec3(0.52, 0.50, 0.52), _wet * 0.65);
  }

  // ---- Canopy dapple: pooled warm light + soft shade for forested biomes ----
  // (GOAL #55) Large soft FBM blobs sell "light filtering through trees" at
  // tactical zoom without real projected shadows. uDapple is 0 outside
  // forest/swamp, making this a no-op for open/underground biomes.
  if (uDapple > 0.001) {
    float _dap = fbm4(vTerrainWorldPos.xz * 0.55 + vec2(17.0, 83.0));
    float _pool = smoothstep(0.48, 0.72, _dap);
    _terrainColor = _terrainColor * (1.0 - 0.20 * uDapple)
                  + _terrainColor * vec3(1.0, 0.96, 0.80) * (0.50 * uDapple) * _pool;
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
  dapple: number,
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
    shader.uniforms.uDapple = { value: dapple };

    // --- Vertex shader: pass world position + world normal (for slope) ---
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      "#include <common>\nvarying vec3 vTerrainWorldPos;\nvarying vec3 vTerrainNormal;",
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTerrainNormal = normalize(mat3(modelMatrix) * objectNormal);",
    );

    // --- Fragment shader: inject noise functions + uniforms ---
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>\n${TERRAIN_GLSL_PREAMBLE}`,
    );

    // Replace vertex-color fragment with procedural terrain color
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      TERRAIN_COLOR_FRAGMENT,
    );

    // Add normal perturbation after normal mapping
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>\n${TERRAIN_NORMAL_FRAGMENT}`,
    );
  };

  mat.customProgramCacheKey = () =>
    `terrain-pbr-v7-${mapWidth}-${mapHeight}-${seed}-${dapple}`;
  return mat;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TerrainMeshProps {
  mapData: BattleMapData;
  validMoves: Set<string>;
  activePath: { id: string }[];
  actionMode: "move" | "ability" | null;
  onTileClick: (tile: BattleMapTile) => void;
  /**
   * Tile-hover callback (AoE template preview while targeting). Pass it ONLY
   * while it's needed: an onPointerMove handler makes R3F raycast this whole
   * heightfield on every mouse move, so the host gates it on targetingMode.
   */
  onTileHover?: (tile: BattleMapTile) => void;
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
  onTileHover,
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

  // Generate the heightfield geometry (no vertex colors — shader handles color).
  // The plane extends FRINGE_TILES beyond the playable rect on every side: the
  // bicubic sampler edge-clamps, so the battlefield's border terrain continues
  // outward and rolls down into the apron under the fog instead of ending at a
  // vertical mesa cliff (the old perimeter skirt). Remy 2026-07-01: "remove the
  // outer boundaries" — the map should read as part of a landscape, not a slab.
  const geometry = useMemo(() => {
    const fringeW = width + FRINGE_TILES * 2;
    const fringeH = height + FRINGE_TILES * 2;
    const segsX = fringeW * SUBDIVISIONS_PER_TILE;
    const segsZ = fringeH * SUBDIVISIONS_PER_TILE;

    const geo = new THREE.PlaneGeometry(
      fringeW * TILE_SIZE,
      fringeH * TILE_SIZE,
      segsX,
      segsZ,
    );

    geo.rotateX(-Math.PI / 2);
    const positions = geo.attributes.position as THREE.BufferAttribute;
    const vertexCount = positions.count;

    const seed = mapData.seed ?? 42;
    const getVertexY = makeTerrainHeightSampler(tileGrid, width, height, seed);

    for (let i = 0; i < vertexCount; i++) {
      const vx = positions.getX(i);
      const vz = positions.getZ(i);

      const tileX = vx / TILE_SIZE + width / 2;
      const tileZ = vz / TILE_SIZE + height / 2;

      let vy = getVertexY(tileX, tileZ);

      // Beyond the playable rect: continue the clamped edge height, then ease
      // it down to the apron across the fringe, with low rolling noise so the
      // run-out reads as continuing landscape rather than a flat shelf.
      const dOutX = Math.max(0, -tileX, tileX - width);
      const dOutZ = Math.max(0, -tileZ, tileZ - height);
      const dOut = Math.hypot(dOutX, dOutZ);
      if (dOut > 0) {
        const t = Math.min(1, dOut / FRINGE_TILES);
        const s = t * t * (3 - 2 * t);
        const roll =
          (smoothNoise(tileX * 0.3 + 17.7, tileZ * 0.3 + 41.3, seed) * 2 - 1) *
          1.1 *
          Math.sin(Math.PI * s);
        vy = vy * (1 - s) + FRINGE_APRON_Y * s + roll * s;
      }

      positions.setY(i, vy);
      positions.setX(i, vx + (width / 2) * TILE_SIZE);
      positions.setZ(i, vz + (height / 2) * TILE_SIZE);
    }

    geo.computeVertexNormals();
    positions.needsUpdate = true;
    return geo;
  }, [tileGrid, width, height, mapData.seed]);

  const terrainHeightSampler = useMemo(
    () => makeTerrainHeightSampler(tileGrid, width, height, mapData.seed ?? 42),
    [tileGrid, width, height, mapData.seed],
  );

  // Terrain type data texture (per-tile, for the GPU)
  const terrainTypeTex = useMemo(
    () => createTerrainTypeTexture(mapData, width, height),
    [mapData, width, height],
  );

  // Biome drives the dapple strength
  const biome = useMemo(() => {
    const m = mapData as BattleMapData & { biome?: string; theme?: string };
    return m.biome ?? m.theme ?? "forest";
  }, [mapData]);

  // Canopy dapple only where trees plausibly overhang the ground
  const dapple = biome === "forest" ? 1.0 : biome === "swamp" ? 0.45 : 0.0;

  // Custom material with procedural GLSL texturing
  const material = useMemo(
    () =>
      createTerrainMaterial(
        terrainTypeTex,
        width,
        height,
        mapData.seed ?? 42,
        dapple,
      ),
    [terrainTypeTex, width, height, mapData.seed, dapple],
  );

  // Dispose GPU resources on change/unmount
  useEffect(
    () => () => {
      terrainTypeTex.dispose();
    },
    [terrainTypeTex],
  );
  useEffect(
    () => () => {
      material.dispose();
    },
    [material],
  );

  // Active path set for quick lookup
  const activePathSet = useMemo(() => {
    const set = new Set<string>();
    activePath.forEach((p) => set.add(p.id));
    return set;
  }, [activePath]);

  // Handle click → determine which tile was hit
  const handleClick = useMemo(() => {
    return (event: THREE.Intersection) => {
      if (!event.point) return;
      // The mesh can produce tiny floating-point drift at map edges when the
      // ray lands on a steeply displaced surface. Clamping the derived tile
      // coordinate keeps valid edge clicks from falling out of bounds.
      const tileCoords = resolveTerrainTileCoordinates(
        {
          x: event.point.x / TILE_SIZE,
          y: event.point.y,
          z: event.point.z / TILE_SIZE,
        },
        { width, height },
        { sampleHeight: terrainHeightSampler },
      );
      if (!tileCoords) return;
      const tileId = `${tileCoords.x}-${tileCoords.y}`;
      const tile = mapData.tiles.get(tileId);
      if (tile) onTileClick(tile);
    };
  }, [height, mapData, onTileClick, terrainHeightSampler, width]);

  // Hover → tile under the pointer, deduped so the callback fires once per
  // tile crossing instead of on every pointermove event. Same height-aware
  // coordinate resolution as clicks.
  const lastHoverTileId = useRef<string | null>(null);
  const handlePointerMove = useMemo(() => {
    if (!onTileHover) return undefined;
    return (e: ThreeEvent<PointerEvent>) => {
      const point = e.intersections[0]?.point;
      if (!point) return;
      const tileCoords = resolveTerrainTileCoordinates(
        { x: point.x / TILE_SIZE, y: point.y, z: point.z / TILE_SIZE },
        { width, height },
        { sampleHeight: terrainHeightSampler },
      );
      if (!tileCoords) return;
      const tileId = `${tileCoords.x}-${tileCoords.y}`;
      if (lastHoverTileId.current === tileId) return;
      lastHoverTileId.current = tileId;
      const tile = mapData.tiles.get(tileId);
      if (tile) onTileHover(tile);
    };
  }, [height, mapData, onTileHover, terrainHeightSampler, width]);

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
        onPointerMove={handlePointerMove}
      />
    </>
  );
};

export default TerrainMesh;

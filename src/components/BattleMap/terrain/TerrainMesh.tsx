/**
 * @file TerrainMesh.tsx
 * Continuous heightfield terrain mesh generated from BattleMapTile data.
 *
 * Replaces the Phase 0 box-per-tile approach with a single subdivided PlaneGeometry
 * whose vertex Y positions are set from tile elevation values, smoothed with bicubic
 * interpolation across tile boundaries for an organic look.
 *
 * Research references:
 * - Heightmap vertex displacement: https://dev.to/sanderdebr/let-s-build-3d-procedural-landscape-with-react-and-three-js-47a0
 * - Bicubic interpolation for smooth terrain: https://en.wikipedia.org/wiki/Bicubic_interpolation
 * - R3F BufferGeometry: https://r3f.docs.pmnd.rs/api/objects
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "Terrain System" section
 */
import React, { useMemo, useRef } from 'react';
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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Cubic interpolation between 4 values at parameter t ∈ [0,1].
 * Uses Catmull-Rom spline weights for C1 continuity.
 */
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

/**
 * Bicubic interpolation on a 2D grid of elevation values.
 * Returns the smoothly interpolated elevation at fractional tile coordinates (fx, fy).
 */
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

  // Sample 4x4 neighborhood (clamped at boundaries)
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

/**
 * Simple seeded pseudo-random for deterministic micro-noise.
 * Uses a simple hash function to generate noise at integer coordinates.
 */
function pseudoNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 73.13) * 43758.5453;
  return n - Math.floor(n);  // fractional part → [0, 1)
}

/**
 * Smooth noise via bilinear interpolation of pseudoNoise at integer grid points.
 */
function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  // Smoothstep for smoother interpolation
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
// Terrain color mapping (procedural — until PBR textures in splat shader)
// ---------------------------------------------------------------------------

const TERRAIN_VERTEX_COLORS: Record<string, [number, number, number]> = {
  grass:     [0.23, 0.35, 0.16],
  rock:      [0.42, 0.42, 0.42],
  water:     [0.10, 0.29, 0.42],
  difficult: [0.35, 0.29, 0.13],
  wall:      [0.29, 0.29, 0.29],
  floor:     [0.42, 0.38, 0.31],
  sand:      [0.78, 0.66, 0.38],
  mud:       [0.29, 0.23, 0.13],
};

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

  // Generate the heightfield geometry
  const geometry = useMemo(() => {
    const segsX = width * SUBDIVISIONS_PER_TILE;
    const segsZ = height * SUBDIVISIONS_PER_TILE;

    const geo = new THREE.PlaneGeometry(
      width * TILE_SIZE,
      height * TILE_SIZE,
      segsX,
      segsZ,
    );

    // PlaneGeometry is XY-oriented; rotate to XZ (ground plane)
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position as THREE.BufferAttribute;
    const vertexCount = positions.count;

    // Add vertex colors for terrain type visualization
    const colors = new Float32Array(vertexCount * 3);

    // Elevation lookup helper (clamped)
    const getElevation = (tx: number, ty: number): number => {
      const cx = Math.max(0, Math.min(width - 1, tx));
      const cy = Math.max(0, Math.min(height - 1, ty));
      return tileGrid[cy]?.[cx]?.elevation ?? 0;
    };

    const seed = mapData.seed ?? 42;

    for (let i = 0; i < vertexCount; i++) {
      // Get vertex world position (PlaneGeometry centers at origin after creation)
      let vx = positions.getX(i);
      const vz = positions.getZ(i);

      // Convert from geometry-local to tile coordinates
      // PlaneGeometry goes from -width/2 to +width/2, we want 0 to width
      const tileX = (vx / TILE_SIZE) + width / 2;
      const tileZ = (vz / TILE_SIZE) + height / 2;

      // Bicubic interpolation of elevation
      const smoothElevation = bicubicSample(
        getElevation,
        tileX,
        tileZ,
        width,
        height,
      );

      // Add micro-noise for organic feel
      const noise = smoothNoise(tileX * 3.7, tileZ * 3.7, seed) * 2 - 1;
      const microDetail = noise * MICRO_NOISE_AMPLITUDE;

      // Set Y (up) to elevation
      positions.setY(i, smoothElevation * ELEVATION_SCALE + microDetail);

      // Shift X and Z so tile (0,0) is at world origin
      positions.setX(i, vx + (width / 2) * TILE_SIZE);
      positions.setZ(i, vz + (height / 2) * TILE_SIZE);

      // Vertex color from nearest tile terrain type
      const nearestTileX = Math.max(0, Math.min(width - 1, Math.floor(tileX)));
      const nearestTileZ = Math.max(0, Math.min(height - 1, Math.floor(tileZ)));
      const tile = tileGrid[nearestTileZ]?.[nearestTileX];
      const terrainType = tile?.terrain ?? 'grass';
      const baseColor = TERRAIN_VERTEX_COLORS[terrainType] ?? TERRAIN_VERTEX_COLORS.grass;

      // Add slight color variation based on noise for natural look
      const colorNoise = smoothNoise(tileX * 2.1, tileZ * 2.1, seed + 100) * 0.1 - 0.05;
      colors[i * 3] = Math.max(0, Math.min(1, baseColor[0] + colorNoise));
      colors[i * 3 + 1] = Math.max(0, Math.min(1, baseColor[1] + colorNoise * 0.7));
      colors[i * 3 + 2] = Math.max(0, Math.min(1, baseColor[2] + colorNoise * 0.5));
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    // Mark for update
    positions.needsUpdate = true;

    return geo;
  }, [tileGrid, width, height, mapData.seed]);

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
      receiveShadow
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (e.intersections[0]) {
          handleClick(e.intersections[0]);
        }
      }}
    >
      <meshStandardMaterial
        vertexColors
        roughness={0.85}
        metalness={0.05}
        side={THREE.FrontSide}
      />
    </mesh>
  );
};

export default TerrainMesh;

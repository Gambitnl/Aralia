/**
 * @file terrainHeightSampler.ts — the combat map's ground surface formula, and
 * nothing else.
 *
 * This lived inside `TerrainMesh.tsx` and every consumer imported it from
 * there. That was fine while the only consumers were React components. It stops
 * being fine the moment a WEB WORKER needs the same surface: importing it from
 * `TerrainMesh.tsx` drags React, `@react-three/fiber` and the whole terrain
 * shader into a worker that wants one bicubic interpolation.
 *
 * So the formula moved here, verbatim, and `TerrainMesh.tsx` re-exports it.
 * Nothing that imported it before has to change, and the arena volume's worker
 * can import the ground truth without importing the renderer.
 *
 * This is the SINGLE source of the surface: the heightfield's own geometry, the
 * water system's depth bake, every scatter layer, and the voxel arena fill all
 * ask this function where the ground is. Two of them disagreeing by a
 * centimetre is a floating token or a buried tuft, and it has happened.
 */
import { BattleMapTile } from '../../../types/combat';
import { BATTLE_MAP_ELEVATION_METERS_PER_UNIT } from '../../../config/mapConfig';

/** Small noise amplitude to add organic micro-detail to terrain surface */
export const MICRO_NOISE_AMPLITUDE = 0.04;

/**
 * How deep water basins are carved below their tile's nominal elevation, in
 * elevation units. The water surface stays at the tile's nominal elevation
 * (see WaterSystem), so this depth is what transparency, the depth gradient,
 * and the shoreline foam band reveal. Bicubic interpolation turns the carve
 * into naturally sloping banks across the shore tiles.
 */
export const WATER_BASIN_DEPTH = 1.4;

export function cubicInterpolate(
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

export function bicubicSample(
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

export function pseudoNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 73.13) * 43758.5453;
  return n - Math.floor(n);
}

export function smoothNoise(x: number, y: number, seed: number): number {
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
 * micro-noise) used by the main heightfield, the perimeter skirt, the voxel
 * arena fill, and WaterSystem's per-vertex depth bake. Water tiles are carved
 * down by WATER_BASIN_DEPTH so pools have real beds below their surface plane.
 */
export function makeTerrainHeightSampler(
  tileGrid: (BattleMapTile | null)[][],
  width: number,
  height: number,
  seed: number,
): (tileX: number, tileZ: number) => number {
  // Raw per-tile carve: full basin for open water, near-none for a ford bed
  // (a ford IS a raised bed — the shallow sheet above it drives WaterSystem's
  // bright color and foam for free).
  const rawCarve = (tx: number, ty: number): number => {
    const tile = tileGrid[ty]?.[tx];
    if (tile?.terrain !== 'water') return 0;
    return tile.crossing?.kind === 'ford'
      ? WATER_BASIN_DEPTH * 0.18
      : WATER_BASIN_DEPTH;
  };
  const getElevation = (tx: number, ty: number): number => {
    const cx = Math.max(0, Math.min(width - 1, tx));
    const cy = Math.max(0, Math.min(height - 1, ty));
    const tile = tileGrid[cy]?.[cx];
    const elev = tile?.elevation ?? 0;
    if (tile?.terrain !== 'water') return elev;
    // Smooth the carve over the 3×3 water neighborhood: the binary
    // ford-vs-deep depth quantized to square tiles put a sawtooth terrace
    // along any diagonal bar edge. Averaging turns it into a bank slope.
    let sum = 0;
    let n = 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const nx = cx + ox;
        const ny = cy + oy;
        if (tileGrid[ny]?.[nx]?.terrain !== 'water') continue;
        sum += rawCarve(nx, ny);
        n++;
      }
    }
    return elev - (n > 0 ? sum / n : WATER_BASIN_DEPTH);
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

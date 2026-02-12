// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 11/02/2026, 17:12:54
 * Dependents: mapService.ts
 * Imports: 3 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Biome, Location, MapData, MapTile } from '../types';
import { STARTING_LOCATION_ID } from '../constants';
import { SeededRandom } from '@/utils/random';

type TemplateTool = 'Hill' | 'Pit' | 'Range' | 'Trough' | 'Strait' | 'Mask' | 'Invert' | 'Add' | 'Multiply' | 'Smooth';
type Grid = { rows: number; cols: number; points: Array<[number, number]>; neighbors: number[][] };
type BiomePool = { passable: Biome[]; byFamily: Record<string, Biome[]>; ocean?: Biome };
type AzgaarTemplate = { id: string; probability: number; template: string };

// Directly sourced from Azgaar templates (selected high-impact set for world-scale generation).
const AZGAAR_TEMPLATES: AzgaarTemplate[] = [
  {
    id: 'continents',
    probability: 16,
    template: `Hill 1 80-85 60-80 40-60
Hill 1 80-85 20-30 40-60
Hill 6-7 15-30 25-75 15-85
Multiply 0.6 land 0 0
Hill 8-10 5-10 15-85 20-80
Range 1-2 30-60 5-15 25-75
Range 1-2 30-60 80-95 25-75
Range 0-3 30-60 80-90 20-80
Strait 2 vertical 0 0
Strait 1 vertical 0 0
Smooth 3 0 0 0
Trough 3-4 15-20 15-85 20-80
Trough 3-4 5-10 45-55 45-55
Pit 3-4 10-20 15-85 20-80
Mask 4 0 0 0`,
  },
  {
    id: 'archipelago',
    probability: 18,
    template: `Add 11 all 0 0
Range 2-3 40-60 20-80 20-80
Hill 5 15-20 10-90 30-70
Hill 2 10-15 10-30 20-80
Hill 2 10-15 60-90 20-80
Smooth 3 0 0 0
Trough 10 20-30 5-95 5-95
Strait 2 vertical 0 0
Strait 2 horizontal 0 0`,
  },
  {
    id: 'oldWorld',
    probability: 8,
    template: `Range 3 70 15-85 20-80
Hill 2-3 50-70 15-45 20-80
Hill 2-3 50-70 65-85 20-80
Hill 4-6 20-25 15-85 20-80
Multiply 0.5 land 0 0
Smooth 2 0 0 0
Range 3-4 20-50 15-35 20-45
Range 2-4 20-50 65-85 45-80
Strait 3-7 vertical 0 0
Trough 6-8 20-50 15-85 45-65
Pit 5-6 20-30 10-90 10-90`,
  },
  {
    id: 'pangea',
    probability: 5,
    template: `Hill 1-2 25-40 15-50 0-10
Hill 1-2 5-40 50-85 0-10
Hill 1-2 25-40 50-85 90-100
Hill 1-2 5-40 15-50 90-100
Hill 8-12 20-40 20-80 48-52
Smooth 2 0 0 0
Multiply 0.7 land 0 0
Trough 3-4 25-35 5-95 10-20
Trough 3-4 25-35 5-95 80-90
Range 5-6 30-40 10-90 35-65`,
  },
];

// Directly sourced from Azgaar biome matrix.
const AZGAAR_BIOME_MATRIX: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 10],
  [3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 9, 9, 9, 9, 10, 10, 10],
  [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 9, 9, 9, 9, 9, 10, 10, 10],
  [5, 6, 6, 6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 10, 10, 10],
  [7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 10, 10],
];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lim = (v: number) => clamp(v, 0, 100);

function hash01(seed: number, x: number, y: number): number {
  let h = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1442695041, 1597334677) ^ (seed | 0);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise2D(seed: number, x: number, y: number, scale: number): number {
  const s = Math.max(1, scale);
  const sx = x / s;
  const sy = y / s;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const tx = smoothstep(sx - x0);
  const ty = smoothstep(sy - y0);
  const n00 = hash01(seed, x0, y0);
  const n10 = hash01(seed, x0 + 1, y0);
  const n01 = hash01(seed, x0, y0 + 1);
  const n11 = hash01(seed, x0 + 1, y0 + 1);
  const nx0 = n00 + (n10 - n00) * tx;
  const nx1 = n01 + (n11 - n01) * tx;
  return nx0 + (nx1 - nx0) * ty;
}

function fbm(seed: number, x: number, y: number, baseScale: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2D(seed + i * 101, x * freq, y * freq, baseScale) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return norm > 0 ? sum / norm : 0;
}

function buildGrid(rows: number, cols: number): Grid {
  const points: Array<[number, number]> = [];
  const neighbors: number[][] = Array.from({ length: rows * cols }, () => []);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      points.push([x + 0.5, y + 0.5]);
      const i = y * cols + x;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          neighbors[i].push(ny * cols + nx);
        }
      }
    }
  }
  return { rows, cols, points, neighbors };
}

function findCell(x: number, y: number, grid: Grid): number {
  const col = clamp(Math.floor(x), 0, grid.cols - 1);
  const row = clamp(Math.floor(y), 0, grid.rows - 1);
  return row * grid.cols + col;
}

function chance(rng: SeededRandom, p: number): boolean {
  if (p <= 0) return false;
  if (p >= 1) return true;
  return rng.next() < p;
}

function getNumberInRange(text: string, rng: SeededRandom): number {
  if (!text) return 0;
  if (!Number.isNaN(Number(text))) {
    const n = Number(text);
    const base = n >= 0 ? Math.floor(n) : Math.ceil(n);
    const frac = Math.abs(n - base);
    return base + (chance(rng, frac) ? (n >= 0 ? 1 : -1) : 0);
  }
  const sign = text.startsWith('-') ? -1 : 1;
  const raw = sign === -1 ? text.slice(1) : text;
  const [minRaw, maxRaw] = raw.split('-');
  if (!maxRaw) return 0;
  const min = Math.round(Number.parseFloat(minRaw) * sign);
  const max = Math.round(Number.parseFloat(maxRaw));
  if (Number.isNaN(min) || Number.isNaN(max)) return 0;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(rng.next() * (hi - lo + 1));
}

function traceGreedyPath(start: number, end: number, used: Uint8Array, grid: Grid, rng: SeededRandom, jitter = 0.85): number[] {
  const path = [start];
  used[start] = 1;
  let current = start;
  let guard = 0;
  while (current !== end && guard < grid.rows * grid.cols * 4) {
    guard++;
    let best = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const n of grid.neighbors[current]) {
      if (used[n]) continue;
      const [tx, ty] = grid.points[end];
      const [nx, ny] = grid.points[n];
      let d = (tx - nx) ** 2 + (ty - ny) ** 2;
      if (rng.next() > jitter) d /= 2;
      if (d < bestDist) {
        bestDist = d;
        best = n;
      }
    }
    if (best < 0) break;
    current = best;
    used[current] = 1;
    path.push(current);
  }
  return path;
}

function getPointInRange(range: string, length: number, rng: SeededRandom): number {
  const [minRaw, maxRaw] = range.split('-');
  const min = (Number.parseInt(minRaw, 10) || 0) / 100;
  const max = (Number.parseInt(maxRaw ?? minRaw, 10) || Number.parseInt(minRaw, 10) || 0) / 100;
  return clamp(min * length + rng.next() * Math.max(0, (max - min) * length), 0, length - 1);
}

function runTemplateHeightmap(rows: number, cols: number, seed: number): { heights: number[]; templateId: string } {
  const grid = buildGrid(rows, cols);
  const pickRng = new SeededRandom(seed ^ 0x5bd1e995);
  const totalWeight = AZGAAR_TEMPLATES.reduce((s, t) => s + t.probability, 0);
  let roll = pickRng.next() * totalWeight;
  let picked = AZGAAR_TEMPLATES[0];
  for (const t of AZGAAR_TEMPLATES) {
    roll -= t.probability;
    if (roll <= 0) {
      picked = t;
      break;
    }
  }

  const rng = new SeededRandom(seed ^ 0x9e3779b9);
  const heights = Array.from({ length: rows * cols }, () => 0);
  const blobPower = 0.98;
  const linePower = 0.81;

  const modify = (range: string, add: number, mult: number) => {
    const min = range === 'land' ? 20 : range === 'all' ? 0 : Number.parseFloat(range.split('-')[0] ?? '0');
    const max = range === 'land' || range === 'all' ? 100 : Number.parseFloat(range.split('-')[1] ?? '100');
    const isLand = min === 20;
    for (let i = 0; i < heights.length; i++) {
      let h = heights[i];
      if (h < min || h > max) continue;
      if (add) h = isLand ? Math.max(h + add, 20) : h + add;
      if (mult !== 1) h = isLand ? (h - 20) * mult + 20 : h * mult;
      heights[i] = lim(h);
    }
  };

  const smooth = (fr: number) => {
    const factor = Number.isFinite(fr) && fr > 0 ? fr : 2;
    const next = heights.slice();
    for (let i = 0; i < heights.length; i++) {
      const around = [heights[i], ...grid.neighbors[i].map((n) => heights[n])];
      const avg = around.reduce((a, b) => a + b, 0) / around.length;
      next[i] = lim((heights[i] * (factor - 1) + avg) / factor);
    }
    for (let i = 0; i < heights.length; i++) heights[i] = next[i];
  };

  const mask = (power: number) => {
    const fr = power ? Math.abs(power) : 1;
    for (let i = 0; i < heights.length; i++) {
      const [x, y] = grid.points[i];
      const nx = (2 * x) / grid.cols - 1;
      const ny = (2 * y) / grid.rows - 1;
      let dist = (1 - nx ** 2) * (1 - ny ** 2);
      if (power < 0) dist = 1 - dist;
      const masked = heights[i] * dist;
      heights[i] = lim((heights[i] * (fr - 1) + masked) / fr);
    }
  };

  const raiseOrLower = (isHill: boolean, countText: string, heightText: string, rangeX: string, rangeY: string) => {
    const runs = getNumberInRange(countText, rng);
    for (let r = 0; r < runs; r++) {
      const change = Array.from({ length: heights.length }, () => 0);
      const h = lim(getNumberInRange(heightText, rng));
      const x = getPointInRange(rangeX, grid.cols, rng);
      const y = getPointInRange(rangeY, grid.rows, rng);
      const start = findCell(x, y, grid);
      change[start] = h;
      const queue = [start];
      while (queue.length) {
        const q = queue.shift() as number;
        for (const n of grid.neighbors[q]) {
          if (change[n]) continue;
          change[n] = Math.pow(change[q], blobPower) * (rng.next() * 0.2 + 0.9);
          if (change[n] > 1) queue.push(n);
        }
      }
      for (let i = 0; i < heights.length; i++) {
        heights[i] = lim(heights[i] + (isHill ? change[i] : -change[i]));
      }
    }
  };

  const carveLine = (isRange: boolean, countText: string, heightText: string, rangeX: string, rangeY: string) => {
    const runs = getNumberInRange(countText, rng);
    for (let r = 0; r < runs; r++) {
      let h = lim(getNumberInRange(heightText, rng));
      const used = new Uint8Array(heights.length);
      const sx = getPointInRange(rangeX, grid.cols, rng);
      const sy = getPointInRange(rangeY, grid.rows, rng);
      const ex = rng.next() * grid.cols * 0.8 + grid.cols * 0.1;
      const ey = rng.next() * grid.rows * 0.7 + grid.rows * 0.15;
      const path = traceGreedyPath(findCell(sx, sy, grid), findCell(ex, ey, grid), used, grid, rng, isRange ? 0.85 : 0.8);
      let queue = path.slice();
      while (queue.length) {
        const frontier = queue.slice();
        queue = [];
        for (const c of frontier) {
          heights[c] = lim(heights[c] + (isRange ? 1 : -1) * h * (rng.next() * 0.3 + 0.85));
        }
        h = Math.pow(h, linePower) - 1;
        if (h < 2) break;
        for (const c of frontier) {
          for (const n of grid.neighbors[c]) {
            if (used[n]) continue;
            used[n] = 1;
            queue.push(n);
          }
        }
      }
    }
  };

  for (const step of picked.template.split('\n').map((s) => s.trim()).filter(Boolean)) {
    const [tool, a2 = '0', a3 = '0', a4 = '0', a5 = '0'] = step.split(/\s+/);
    const t = tool as TemplateTool;
    if (t === 'Hill') raiseOrLower(true, a2, a3, a4, a5);
    else if (t === 'Pit') raiseOrLower(false, a2, a3, a4, a5);
    else if (t === 'Range') carveLine(true, a2, a3, a4, a5);
    else if (t === 'Trough') carveLine(false, a2, a3, a4, a5);
    else if (t === 'Add') modify(a3, Number(a2), 1);
    else if (t === 'Multiply') modify(a3, 0, Number(a2));
    else if (t === 'Smooth') smooth(Number(a2));
    else if (t === 'Mask') mask(Number(a2));
    else if (t === 'Strait') carveLine(false, a2, '25', '45-55', '10-90');
    else if (t === 'Invert' && chance(rng, Number(a2))) heights.reverse();
  }

  return {
    heights: heights.map((h) => lim(h)),
    templateId: picked.id,
  };
}

function classifyAzgaarBiome(height: number, temp: number, moisture: number, hasRiver: boolean): number {
  if (height < 20) return 0;
  if (temp < -5) return 11;
  if (temp >= 25 && !hasRiver && moisture < 8) return 1;
  if (temp > -2 && ((moisture > 40 && height < 25) || (moisture > 24 && height > 24 && height < 60))) return 12;
  const mb = clamp((moisture / 5) | 0, 0, 4);
  const tb = clamp(20 - temp, 0, 25);
  return AZGAAR_BIOME_MATRIX[mb][tb];
}

function mapAzgaarBiomeToFamily(id: number): string {
  if (id === 0) return 'ocean';
  if (id === 1 || id === 2) return 'desert';
  if (id === 3 || id === 4) return 'plains';
  if (id === 5 || id === 7) return 'jungle';
  if (id === 6 || id === 8 || id === 9) return 'forest';
  if (id === 10 || id === 11) return 'tundra';
  if (id === 12) return 'wetland';
  return 'plains';
}

function buildBiomePool(biomes: Record<string, Biome>): BiomePool {
  const passable = Object.values(biomes).filter((b) => b.passable && b.family !== 'special');
  if (passable.length === 0) throw new Error('Azgaar-source generation failed: no passable world biomes are available.');
  const byFamily: Record<string, Biome[]> = {};
  for (const biome of passable) {
    const family = biome.family || 'plains';
    if (!byFamily[family]) byFamily[family] = [];
    byFamily[family].push(biome);
  }
  return { passable, byFamily, ocean: biomes.ocean };
}

function pickBiomeFromPool(pool: Biome[], seed: number, x: number, y: number): Biome {
  const total = pool.reduce((s, b) => s + (b.spawnWeight ?? 1), 0);
  const roll = hash01(seed + 617, x, y) * Math.max(total, 1);
  let acc = 0;
  for (const biome of pool) {
    acc += biome.spawnWeight ?? 1;
    if (roll <= acc) return biome;
  }
  return pool[pool.length - 1];
}

function applyLocationAnchors(tiles: MapTile[][], locations: Record<string, Location>, rows: number, cols: number): void {
  for (const location of Object.values(locations)) {
    const { x, y } = location.mapCoordinates;
    if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
    tiles[y][x].locationId = location.id;
    tiles[y][x].biomeId = location.biomeId;
  }
}

function applyStartingDiscovery(tiles: MapTile[][], locations: Record<string, Location>): void {
  const start = locations[STARTING_LOCATION_ID];
  if (!start) return;
  const sx = start.mapCoordinates.x;
  const sy = start.mapCoordinates.y;
  if (!tiles[sy]?.[sx]) return;
  tiles[sy][sx].isPlayerCurrent = true;
  tiles[sy][sx].discovered = true;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = sx + dx;
      const ny = sy + dy;
      if (!tiles[ny]?.[nx]) continue;
      tiles[ny][nx].discovered = true;
    }
  }
}

export function generateAzgaarDerivedMap(
  rows: number,
  cols: number,
  locations: Record<string, Location>,
  biomes: Record<string, Biome>,
  worldSeed: number,
): MapData {
  const pools = buildBiomePool(biomes);
  const { heights, templateId } = runTemplateHeightmap(rows, cols, worldSeed);
  const rivers = Array.from({ length: rows * cols }, (_, i) => heights[i] > 45 && hash01(worldSeed + 509, i % cols, Math.floor(i / cols)) > 0.82);
  const tiles: MapTile[][] = [];
  const macroScale = Math.max(rows, cols) * 0.8;
  const detailScale = Math.max(rows, cols) * 0.45;
  const temperatures: number[] = Array.from({ length: rows * cols }, () => 0);
  const moistureValues: number[] = Array.from({ length: rows * cols }, () => 0);

  for (let y = 0; y < rows; y++) {
    tiles[y] = [];
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const h = heights[i];
      const latitude = Math.abs((y / Math.max(1, rows - 1)) * 2 - 1);
      const tempNoise = (fbm(worldSeed + 173, x, y, macroScale, 3) - 0.5) * 8;
      const temp = Math.round(32 - latitude * 40 - Math.max(0, h - 20) / 80 * 18 + tempNoise);
      const moistureNoise = fbm(worldSeed + 277, x, y, detailScale, 4) * 22;
      const coastalBoost = Math.max(0, 18 - Math.abs(h - 20) * 0.9);
      const moisture = clamp(Math.round(moistureNoise + coastalBoost + (rivers[i] ? 12 : 0) - Math.max(0, temp - 24) * 0.8), 0, 45);
      temperatures[i] = temp;
      moistureValues[i] = moisture;
      const azBiome = classifyAzgaarBiome(h, temp, moisture, rivers[i]);
      const family = mapAzgaarBiomeToFamily(azBiome);
      const biomeId =
        family === 'ocean' && pools.ocean
          ? pools.ocean.id
          : pickBiomeFromPool(pools.byFamily[family] ?? pools.passable, worldSeed, x, y).id;

      tiles[y][x] = { x, y, biomeId, discovered: false, isPlayerCurrent: false };
    }
  }

  applyLocationAnchors(tiles, locations, rows, cols);
  applyStartingDiscovery(tiles, locations);

  return {
    gridSize: { rows, cols },
    tiles,
    azgaarWorld: {
      version: 1,
      templateId,
      heights,
      temperatures,
      moisture: moistureValues,
      rivers,
    },
  };
}

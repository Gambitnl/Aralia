/**
 * @file src/services/wfcService.ts
 * Minimal Wave Function Collapse helper for deterministic submap prototyping.
 * The implementation is intentionally small: it walks the grid row-by-row,
 * respecting neighbor compatibility and using a seeded PRNG to pick tiles.
 * This trades full entropy propagation for speed, which is acceptable for small 25x25 submaps.
 */

import { WFC_RULESETS, WfcRuleset, WfcTileDefinition } from '../config/wfcRulesets';

export type WfcGrid = string[][];

interface GenerateWfcGridParams {
  rows: number;
  cols: number;
  rulesetId?: string;
  seed: number;
  biomeContext?: string;
}

function createSeededRng(seed: number): () => number {
  // Mulberry32 for predictable but fast random values; avoids pulling in large deps.
  let t = seed + 0x6d2b79f5;
  return () => {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRuleset(rulesetId?: string): WfcRuleset {
  const fallback = WFC_RULESETS.temperate;
  if (!rulesetId) return fallback;
  return WFC_RULESETS[rulesetId] || fallback;
}

function buildTileLookup(tiles: WfcTileDefinition[]): Map<string, WfcTileDefinition> {
  // Avoid repeatedly scanning the ruleset array while also preventing undefined neighbor lookups at runtime.
  return tiles.reduce((map, tile) => {
    map.set(tile.id, tile);
    return map;
  }, new Map<string, WfcTileDefinition>());
}

function filterTilesByBiome(tiles: WfcTileDefinition[], biomeContext?: string): WfcTileDefinition[] {
  if (!biomeContext) return tiles;
  const biomeMatches = tiles.filter((tile) => tile.biomeHint === biomeContext);

  if (biomeMatches.length === 0) return tiles;

  const hasVariety = new Set(biomeMatches.map((tile) => tile.id)).size > 1;
  if (hasVariety) return biomeMatches;

  // If the biome-specific slice collapses to a single tile (e.g., swamp => only water),
  // blend back in neutral terrain so the grid stays traversable for gameplay checks.
  const neutralTiles = tiles.filter((tile) => !tile.biomeHint || tile.biomeHint === 'plains');
  return [...biomeMatches, ...neutralTiles];
}

function selectTile(
  candidates: WfcTileDefinition[],
  rng: () => number,
): WfcTileDefinition {
  const totalWeight = candidates.reduce((sum, tile) => sum + tile.weight, 0);
  let roll = rng() * totalWeight;
  for (const tile of candidates) {
    roll -= tile.weight;
    if (roll <= 0) return tile;
  }
  return candidates[candidates.length - 1];
}

export function generateWfcGrid({ rows, cols, rulesetId, seed, biomeContext }: GenerateWfcGridParams): WfcGrid {
  const ruleset = pickRuleset(rulesetId);
  const rng = createSeededRng(seed);
  const tileLookup = buildTileLookup(ruleset.tiles);
  const grid: WfcGrid = Array.from({ length: rows }, () => Array(cols).fill(''));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const neighborAbove = y > 0 ? grid[y - 1][x] : null;
      const neighborLeft = x > 0 ? grid[y][x - 1] : null;

      // Start with all tiles (filtered by biome), then enforce neighbor constraints.
      let candidates = filterTilesByBiome(ruleset.tiles, biomeContext);

      if (neighborAbove) {
        const aboveDef = tileLookup.get(neighborAbove);
        candidates = candidates.filter((tile) => aboveDef?.neighbors?.down?.includes(tile.id));
      }
      if (neighborLeft) {
        const leftDef = tileLookup.get(neighborLeft);
        candidates = candidates.filter((tile) => leftDef?.neighbors?.right?.includes(tile.id));
      }

      if (candidates.length === 0) {
        // If constraints dead-end, fall back to the default tile to avoid gaps.
        grid[y][x] = ruleset.fallbackTileId;
        continue;
      }

      const chosenTile = selectTile(candidates, rng);
      grid[y][x] = chosenTile.id;
    }
  }

  return grid;
}

/**
 * @file sites.ts
 * @description Score-and-spacing placement of towns (high score/flatland near water)
 * and dungeons/ruins (wilderness pockets far from civilizations).
 *
 * Why this is built this way:
 * Towns are placed near coastlines or rivers on flat terrain to mimic natural human settlement patterns.
 * Ruins and dungeons are placed in rugged, isolated, or wilderness areas.
 * Spacing rules ensure that settlements and points of interest are not clustered unrealistically.
 *
 * Known limitations/deferred issues:
 * - Minimum spacing checks are currently O(N^2) where N is the number of placed sites. Since N is typically small (< 50),
 *   this is highly performant. If N grows, we may want to switch to a quadtree or spatial grid.
 * - Footprints are simple stamped octagonal approximations.
 */

import type { River, Site, Polygon } from './types';
import { SeededRandom } from '@/utils/random';

export interface SiteTargets {
  townTarget: number;
  dungeonTarget: number;
  ruinTarget: number;
}

const SEA_LEVEL = 20;
const MIN_TOWN_SPACING = 3;
const MIN_DUNGEON_SPACING = 4;
const MIN_RUIN_SPACING = 3;

interface ScoredCell {
  i: number;
  x: number;
  y: number;
  score: number;
}

/**
 * Places sites (towns, dungeons, ruins) deterministically using height/river datasets
 * and scoring profiles, respecting density requirements.
 */
export function placeSites(
  heights: number[],
  cols: number,
  rows: number,
  rivers: River[],
  rng: SeededRandom,
  targets: SiteTargets,
): Site[] {
  // Create a fast lookup mask for river locations in grid-space
  const riverMask = new Uint8Array(cols * rows);
  for (const r of rivers) {
    for (const p of r.points) {
      const x = Math.floor(p.x);
      const y = Math.floor(p.y);
      if (x >= 0 && y >= 0 && x < cols && y < rows) {
        riverMask[y * cols + x] = 1;
      }
    }
  }

  const townScores: ScoredCell[] = [];
  const wildScores: ScoredCell[] = [];

  const isLand = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < cols && y < rows && heights[y * cols + x] >= SEA_LEVEL;

  // 1. Score all cells on the land mass
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!isLand(x, y)) continue;

      // Flatness: inverse of maximum height delta in 3x3 neighborhood
      let maxDelta = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!isLand(x + dx, y + dy)) continue;
          maxDelta = Math.max(maxDelta, Math.abs(heights[(y + dy) * cols + (x + dx)] - heights[i]));
        }
      }
      const flatness = 1 / (1 + maxDelta * 0.3);

      // River Proximity: check 5x5 neighborhood around cell
      let riverProx = 0;
      for (let dy = -2; dy <= 2 && !riverProx; dy++) {
        for (let dx = -2; dx <= 2 && !riverProx; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && riverMask[ny * cols + nx]) {
            riverProx = 1;
          }
        }
      }

      // Coast Proximity: check 5x5 neighborhood for water cells
      let coastProx = 0;
      for (let dy = -2; dy <= 2 && !coastProx; dy++) {
        for (let dx = -2; dx <= 2 && !coastProx; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && heights[ny * cols + nx] < SEA_LEVEL) {
            coastProx = 1;
          }
        }
      }

      // Calculate town suitability and wilderness suitability
      const townScore = flatness * (1 + riverProx * 2 + coastProx * 1.5);
      const wildScore = (1 - flatness * 0.5) * (heights[i] / 100) * (1 - riverProx) * (1 - coastProx);

      townScores.push({ i, x, y, score: townScore });
      wildScores.push({ i, x, y, score: wildScore });
    }
  }

  // Sort candidates by score descending
  townScores.sort((a, b) => b.score - a.score);
  wildScores.sort((a, b) => b.score - a.score);

  const placed: Site[] = [];

  // Check if a potential coordinate violates minimum distance to any already-placed site
  const tooClose = (px: number, py: number, minSpacing: number) =>
    placed.some((s) => {
      const dx = s.position.x - px;
      const dy = s.position.y - py;
      return Math.sqrt(dx * dx + dy * dy) < minSpacing;
    });

  // Helper to generate a regular octagonal boundary polygon centered at (x, y) with a given radius
  const stampFootprint = (x: number, y: number, radius: number): Polygon => {
    const poly: Polygon = [];
    const segments = 8;
    for (let k = 0; k < segments; k++) {
      const a = (k / segments) * Math.PI * 2;
      poly.push({ x: x + Math.cos(a) * radius, y: y + Math.sin(a) * radius });
    }
    return poly;
  };

  let siteId = 0;

  // 2. Place Towns
  for (const c of townScores) {
    if (placed.filter((s) => s.kind === 'town').length >= targets.townTarget) break;
    if (tooClose(c.x + 0.5, c.y + 0.5, MIN_TOWN_SPACING)) continue;
    const pop = Math.round(500 + rng.next() * 4500);
    placed.push({
      id: `t${siteId++}`,
      kind: 'town',
      position: { x: c.x + 0.5, y: c.y + 0.5 },
      footprint: stampFootprint(c.x + 0.5, c.y + 0.5, 0.6 + (pop / 5000) * 0.8),
      population: pop,
      walled: pop > 2500,
      townSeed: (rng.next() * 1e9) | 0,
    });
  }

  // 3. Place Dungeons
  for (const c of wildScores) {
    if (placed.filter((s) => s.kind === 'dungeon').length >= targets.dungeonTarget) break;
    if (tooClose(c.x + 0.5, c.y + 0.5, MIN_DUNGEON_SPACING)) continue;
    placed.push({
      id: `d${siteId++}`,
      kind: 'dungeon',
      position: { x: c.x + 0.5, y: c.y + 0.5 },
      footprint: stampFootprint(c.x + 0.5, c.y + 0.5, 0.4),
    });
  }

  // 4. Place Ruins
  for (const c of wildScores) {
    if (placed.filter((s) => s.kind === 'ruin').length >= targets.ruinTarget) break;
    if (tooClose(c.x + 0.5, c.y + 0.5, MIN_RUIN_SPACING)) continue;
    placed.push({
      id: `u${siteId++}`,
      kind: 'ruin',
      position: { x: c.x + 0.5, y: c.y + 0.5 },
      footprint: stampFootprint(c.x + 0.5, c.y + 0.5, 0.3),
    });
  }

  return placed;
}

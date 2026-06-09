import { describe, expect, it } from 'vitest';
import { BATTLE_MAP_DIMENSIONS } from '../../config/mapConfig';
import { BattleMapGenerator } from '../battleMapGenerator';

function countWalkableComponents(mapData: ReturnType<BattleMapGenerator['generate']>): number {
  // The generator's promise is about pathability, so the test mirrors the
  // game's own 8-way walkable adjacency instead of inventing a different rule.
  const walkable = new Set<string>();
  mapData.tiles.forEach(tile => {
    if (!tile.blocksMovement) {
      walkable.add(tile.id);
    }
  });

  const visited = new Set<string>();
  let components = 0;

  for (const startId of walkable) {
    if (visited.has(startId)) {
      continue;
    }

    components += 1;
    const stack = [startId];
    visited.add(startId);

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      const [x, y] = currentId.split('-').map(Number);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) {
            continue;
          }

          const neighborId = `${x + dx}-${y + dy}`;
          if (walkable.has(neighborId) && !visited.has(neighborId)) {
            visited.add(neighborId);
            stack.push(neighborId);
          }
        }
      }
    }
  }

  return components;
}

describe('battleMapGenerator connectivity repair', () => {
  it.each([
    ['cave', 2],
    ['dungeon', 2],
  ] as const)('keeps %s maps fully connected for the known disconnected seed %d', (biome, seed) => {
    // Seed 2 was reproducibly split into multiple walkable components before
    // the repair. Keeping the seed fixed makes the regression durable.
    const generator = new BattleMapGenerator(BATTLE_MAP_DIMENSIONS.width, BATTLE_MAP_DIMENSIONS.height);
    const mapData = generator.generate(biome, seed);

    expect(countWalkableComponents(mapData)).toBe(1);
  });
});

/**
 * @file battleMapGenerator.ts
 * Service for procedurally generating battle maps.
 */
import { BattleMapData, BattleMapTile, BattleMapTerrain, BattleMapDecoration, BattleMapBiome, TargetableMapObject } from '../types/combat';
import { PerlinNoise } from '../utils/random';
import { SeededRandom } from '@/utils/random';

type GeneratedBattleMapDecoration = Exclude<BattleMapDecoration, null>;

// ============================================================================
// Generated Obstacle Object Facts
// ============================================================================
// This section translates obstacles created by this generator into explicit
// spell-targetable map objects. The generator is the safe owner for these facts:
// it knows when an obstacle is created, so later spell systems do not need to
// guess object targetability from visual decoration data alone.
// ============================================================================

const GENERATED_OBSTACLE_SIZES: Record<GeneratedBattleMapDecoration, string> = {
  tree: 'Large',
  boulder: 'Medium',
  stalagmite: 'Medium',
  pillar: 'Large',
  cactus: 'Medium',
  mangrove: 'Large',
  fallen_log: 'Medium',
  stump: 'Small',
  bush: 'Small'
};

const formatDecorationName = (decoration: GeneratedBattleMapDecoration): string =>
  decoration.replace('_', ' ');

export class BattleMapGenerator {
  private width: number;
  private height: number;
  private tiles: Map<string, BattleMapTile> = new Map();
  private targetableObjects: TargetableMapObject[] = [];
  private random!: SeededRandom;
  private elevationNoise!: PerlinNoise;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public generate(biome: BattleMapBiome, seed: number): BattleMapData {
    this.tiles.clear();
    this.targetableObjects = [];
    this.random = new SeededRandom(seed);
    this.elevationNoise = new PerlinNoise(this.random.next());

    this.generateBaseTerrain(biome);
    this.placeObstacles(biome);

    // Every biome that generates walls needs the walkability guarantee.
    if (biome === 'cave' || biome === 'dungeon' || biome === 'ruins') {
        this.ensureConnectivity();
    }
    
    return {
      dimensions: { width: this.width, height: this.height },
      tiles: this.tiles,
      targetableObjects: [...this.targetableObjects],
      theme: biome,
      seed: seed
    };
  }
  
  private generateBaseTerrain(biome: BattleMapBiome) {
    const noise = new PerlinNoise(this.random.next());

    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            const noiseValue = noise.get(x / 10, y / 10);
            const tile = this.createBaseTile(x, y, biome, noiseValue);
            this.tiles.set(`${x}-${y}`, tile);
        }
    }
  }

  private createBaseTile(x: number, y: number, biome: BattleMapBiome, noiseValue: number): BattleMapTile {
    let terrain: BattleMapTerrain = 'grass';
    // Elevation: smaller scale (x/8) for visible terrain undulation, higher multiplier
    const rawElev = this.elevationNoise.get(x / 8, y / 8);
    let rawHeight = rawElev * 2.5 + 1.0; // Rolling base, range ~0-3 centered around 1

    // Bluff layer (gap #28): the rolling base alone almost never exceeds the
    // ~20° slope the terrain shader needs for rock faces, so high ground never
    // reads. A second, offset noise field pushed through a hard ramp raises
    // flat-topped plateaus with 2-3-step faces in open biomes. Perlin sampling
    // is pure (no RNG consumed), so every other seeded stream — terrain types,
    // decorations, obstacle placement — stays byte-identical for a given seed.
    // Cave/dungeon keep gentle floors (enclosed mood); swamp stays low and flat
    // by nature (its drama is water + mist).
    if (biome === 'forest' || biome === 'desert' || biome === 'snow' || biome === 'volcanic') {
      const bluffNoise = this.elevationNoise.get(x / 9 + 37.2, y / 9 + 91.7);
      const t = Math.max(0, Math.min(1, (bluffNoise - 0.26) / 0.14));
      rawHeight += t * t * (3 - 2 * t) * 4.0; // smoothstep ramp → +0..4 steps
    }
    const elevation = Math.max(0, Math.min(7, Math.round(rawHeight)));

    switch(biome) {
        case 'cave':
        case 'dungeon':
            terrain = noiseValue > 0.1 ? 'wall' : 'floor';
            break;
        case 'desert':
            terrain = 'sand';
            if (noiseValue > 0.4) terrain = 'rock';
            break;
        case 'swamp':
            terrain = 'mud';
            if (noiseValue > 0.2) terrain = 'water';
            else if (noiseValue < -0.3) terrain = 'difficult'; // thick mud/roots
            break;
        case 'snow':
            // Snowfield with deep drifts; the coldest hollows hold frozen ponds.
            if (noiseValue > 0.45) terrain = 'difficult'; // deep drifts
            else if (noiseValue < -0.55) terrain = 'water'; // frozen pond
            else terrain = 'grass'; // snowfield
            break;
        case 'jungle':
            // Denser underbrush than forest, with warm pools in the hollows.
            if (noiseValue > 0.25) terrain = 'difficult'; // dense growth
            else if (noiseValue < -0.55) terrain = 'water';
            else terrain = 'grass';
            break;
        case 'coast': {
            // The sea claims the east edge: bias the water threshold by x so
            // the shoreline is a ragged band, not scattered ponds.
            const seaBias = (x / this.width - 0.62) * 1.8;
            if (noiseValue + seaBias > 0.25) terrain = 'water';
            else if (noiseValue > 0.5) terrain = 'grass'; // dune grass
            else terrain = 'sand';
            break;
        }
        case 'ruins':
            // Broken walls over old paving, half-reclaimed by growth.
            if (noiseValue > 0.55) terrain = 'wall';
            else if (noiseValue > 0.2) terrain = 'grass'; // overgrowth
            else if (noiseValue < -0.5) terrain = 'difficult'; // rubble
            else terrain = 'floor';
            break;
        case 'volcanic':
            // Basalt field cut by lava. Lava reuses the water terrain: same
            // rules (impassable, no LoS block) — the paint says what it is.
            terrain = 'rock';
            if (noiseValue < -0.45) terrain = 'water'; // lava
            else if (noiseValue > 0.5) terrain = 'difficult'; // ash and scree
            break;
        case 'forest':
        default:
            if (noiseValue > 0.4) terrain = 'difficult'; // underbrush
            else if (noiseValue < -0.5) terrain = 'water';
            else terrain = 'grass';
            break;
    }


    return {
      id: `${x}-${y}`,
      coordinates: { x, y },
      terrain,
      elevation,
      movementCost: terrain === 'difficult' ? 10 : 5,
      blocksLoS: terrain === 'wall',
      blocksMovement: terrain === 'wall' || terrain === 'water',
      decoration: null,
      effects: []
    };
  }

  private placeObstacles(biome: BattleMapBiome) {
    const obstacleConfig: Record<BattleMapBiome, { types: string[]; density: number }> = {
      forest: { types: ['tree', 'tree', 'boulder', 'bush', 'stump', 'fallen_log'], density: 0.15 },
      cave: { types: ['stalagmite', 'boulder', 'boulder'], density: 0.1 },
      dungeon: { types: ['pillar', 'pillar', 'boulder'], density: 0.07 },
      desert: { types: ['cactus', 'boulder', 'boulder'], density: 0.08 },
      swamp: { types: ['mangrove', 'boulder', 'bush', 'stump'], density: 0.15 },
      snow: { types: ['tree', 'tree', 'boulder', 'stump'], density: 0.12 },
      jungle: { types: ['tree', 'tree', 'tree', 'bush', 'bush', 'fallen_log'], density: 0.22 },
      coast: { types: ['boulder', 'fallen_log', 'bush'], density: 0.06 },
      ruins: { types: ['pillar', 'pillar', 'boulder', 'bush'], density: 0.1 },
      volcanic: { types: ['boulder', 'boulder', 'stalagmite'], density: 0.09 },
    };
    
    const config = obstacleConfig[biome];
    const validTilesForObstacles: BattleMapTile[] = [];
    this.tiles.forEach(tile => {
        if (!tile.blocksMovement) {
            validTilesForObstacles.push(tile);
        }
    });

    // Density field (GOAL #39): the old pass sprinkled obstacles uniformly, so
    // forests read as an even stipple — no clearings, no thickets. A smooth
    // low-frequency value-noise field now scales the per-tile placement chance:
    // troughs get almost nothing (clearings), peaks get ~2.5× the base density
    // (thickets). The remap keeps the field's mean near 1 so the total obstacle
    // budget stays close to the old uniform count.
    const fieldSeed = this.random.next() * 1000;
    const hash2 = (x: number, y: number): number => {
      const n = Math.sin(x * 127.1 + y * 311.7 + fieldSeed * 74.7) * 43758.5453;
      return n - Math.floor(n);
    };
    const valueNoise = (x: number, y: number): number => {
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const fx = x - x0, fy = y - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = hash2(x0, y0), b = hash2(x0 + 1, y0);
      const c = hash2(x0, y0 + 1), d = hash2(x0 + 1, y0 + 1);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
    const densityMult = (tx: number, ty: number): number => {
      // ~9-tile wavelength body + a half-scale octave so thicket edges are
      // ragged, not blobby.
      const t = 0.65 * valueNoise(tx / 9, ty / 9)
              + 0.35 * valueNoise(tx / 4.5 + 13.7, ty / 4.5 + 7.3);
      if (t < 0.35) return (t / 0.35) * 0.2;                 // clearings
      if (t < 0.60) return 0.2 + ((t - 0.35) / 0.25) * 1.0;  // normal cover
      return 1.2 + ((t - 0.60) / 0.40) * 1.6;                // thickets
    };

    for (const tile of validTilesForObstacles) {
        const mult = densityMult(tile.coordinates.x, tile.coordinates.y);
        const chance = Math.min(0.5, config.density * mult);
        if (this.random.next() < chance) {
            const obstacleType = config.types[Math.floor(this.random.next() * config.types.length)];
            this.addObstacle(tile, obstacleType as BattleMapDecoration);
        }
    }
  }

  private addObstacle(tile: BattleMapTile, type: BattleMapDecoration) {
    tile.decoration = type;
    if (type === 'tree' || type === 'pillar' || type === 'mangrove' || type === 'cactus') {
        tile.blocksLoS = true;
        tile.elevation += 2; // Make obstacles taller for LoS purposes
        tile.blocksMovement = true;
    } else if (type === 'boulder') {
        tile.elevation += 1;
        tile.blocksMovement = true;
    } else if (type === 'bush') {
        // Bushes provide half-cover but don't fully block
        tile.providesCover = true;
        tile.blocksMovement = false;
    } else if (type === 'stump' || type === 'fallen_log') {
        // Low obstacles — difficult terrain but passable
        tile.providesCover = true;
        tile.blocksMovement = false;
    } else {
        tile.blocksMovement = true;
    }

    // Generated obstacles are fixed battlefield features, not loose inventory
    // items. Publishing them here gives object-aware spells real map objects to
    // target while preserving Catapult-style exclusions for fixed objects.
    if (type) {
      this.registerGeneratedObstacleTarget(tile, type);
    }
  }

  private registerGeneratedObstacleTarget(tile: BattleMapTile, decoration: GeneratedBattleMapDecoration) {
    const objectName = formatDecorationName(decoration);

    this.targetableObjects.push({
      id: `generated-obstacle-${tile.id}-${decoration}`,
      name: `Generated ${objectName}`,
      position: tile.coordinates,
      size: GENERATED_OBSTACLE_SIZES[decoration],
      isWornOrCarried: false,
      isMagical: false,
      isFixedToSurface: true
    });
  }

  private removeGeneratedObstacleTarget(tile: BattleMapTile) {
    // Cave and dungeon connectivity carving can erase an obstacle after it was
    // placed. Keep the explicit object registry synchronized so spell targeting
    // never sees a stale object on a tile that was turned back into open floor.
    this.targetableObjects = this.targetableObjects.filter(targetObject =>
      targetObject.position.x !== tile.coordinates.x ||
      targetObject.position.y !== tile.coordinates.y
    );
  }
  
  private ensureConnectivity() {
    // Cave and dungeon maps are the only biomes that need a hard connectivity
    // guarantee. We keep the check local to those modes so the other biomes can
    // preserve their noisier terrain and obstacle patterns.
    const walkableComponents = this.getWalkableComponents();
    if (walkableComponents.length <= 1) {
      return;
    }

    // Use the largest connected walkable area as the anchor and carve each
    // isolated component back into it. This keeps the fix bounded: we only
    // punch a minimal corridor when the generator has actually split the map.
    const anchorComponent = walkableComponents.reduce((largest, component) => (
      component.length > largest.length ? component : largest
    ));

    for (const component of walkableComponents) {
      if (component === anchorComponent) {
        continue;
      }

      const { startTile, endTile } = this.findClosestTiles(component, anchorComponent);
      this.carvePassage(startTile, endTile);
    }
  }

  // Flood-fill the map into connected walkable regions so we can prove whether
  // generation left any isolated rooms behind.
  private getWalkableComponents(): BattleMapTile[][] {
    const walkableIds = new Set<string>();
    this.tiles.forEach(tile => {
      if (!tile.blocksMovement) {
        walkableIds.add(tile.id);
      }
    });

    const visited = new Set<string>();
    const components: BattleMapTile[][] = [];

    for (const tileId of walkableIds) {
      if (visited.has(tileId)) {
        continue;
      }

      const component: BattleMapTile[] = [];
      const stack = [tileId];
      visited.add(tileId);

      while (stack.length > 0) {
        const currentId = stack.pop()!;
        const currentTile = this.tiles.get(currentId);
        if (!currentTile) {
          continue;
        }

        component.push(currentTile);

        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) {
              continue;
            }

            const neighborId = `${currentTile.coordinates.x + dx}-${currentTile.coordinates.y + dy}`;
            if (walkableIds.has(neighborId) && !visited.has(neighborId)) {
              visited.add(neighborId);
              stack.push(neighborId);
            }
          }
        }
      }

      components.push(component);
    }

    return components;
  }

  // The shortest corridor is a straight Bresenham line. That keeps the repair
  // deterministic and avoids building a second maze-carving system just for
  // edge cases where the generator split a room from the main cave.
  private carvePassage(startTile: BattleMapTile, endTile: BattleMapTile) {
    let x0 = startTile.coordinates.x;
    let y0 = startTile.coordinates.y;
    const x1 = endTile.coordinates.x;
    const y1 = endTile.coordinates.y;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      const tile = this.tiles.get(`${x0}-${y0}`);
      if (tile) {
        this.carveTile(tile);
      }

      if (x0 === x1 && y0 === y1) {
        break;
      }

      const twiceErr = 2 * err;
      if (twiceErr > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (twiceErr < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  // Reset carved tiles to ordinary floor so they are actually traversable by
  // movement, targeting, and pathfinding consumers.
  private carveTile(tile: BattleMapTile) {
    this.removeGeneratedObstacleTarget(tile);
    tile.terrain = 'floor';
    tile.movementCost = 5;
    tile.blocksLoS = false;
    tile.blocksMovement = false;
    tile.decoration = null;
    tile.providesCover = false;
  }

  private findClosestTiles(a: BattleMapTile[], b: BattleMapTile[]): { startTile: BattleMapTile; endTile: BattleMapTile } {
    let bestStart = a[0];
    let bestEnd = b[0];
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const startTile of a) {
      for (const endTile of b) {
        const distance = Math.max(
          Math.abs(startTile.coordinates.x - endTile.coordinates.x),
          Math.abs(startTile.coordinates.y - endTile.coordinates.y)
        );

        if (distance < bestDistance) {
          bestDistance = distance;
          bestStart = startTile;
          bestEnd = endTile;
        }
      }
    }

    return { startTile: bestStart, endTile: bestEnd };
  }
}

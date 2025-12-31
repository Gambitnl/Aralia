/**
 * @file battleMapGenerator.ts
 * Service for procedurally generating battle maps.
 */
import { BattleMapData, BattleMapTile, BattleMapTerrain, BattleMapDecoration } from '../types/combat';
import { PerlinNoise } from '../utils/perlinNoise';
import { SeededRandom } from '../utils/seededRandom';

export class BattleMapGenerator {
  private width: number;
  private height: number;
  private tiles: Map<string, BattleMapTile> = new Map();
  private random!: SeededRandom;
  private elevationNoise!: PerlinNoise;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public generate(biome: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp', seed: number): BattleMapData {
    this.tiles.clear();
    this.random = new SeededRandom(seed);
    this.elevationNoise = new PerlinNoise(this.random.next());
    
    this.generateBaseTerrain(biome);
    this.placeObstacles(biome);
    
    if (biome === 'cave' || biome === 'dungeon') {
        this.ensureConnectivity();
    }
    
    return {
      dimensions: { width: this.width, height: this.height },
      tiles: this.tiles,
      theme: biome,
      seed: seed
    };
  }
  
  private generateBaseTerrain(biome: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp') {
    const noise = new PerlinNoise(this.random.next());

    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            const noiseValue = noise.get(x / 10, y / 10);
            const tile = this.createBaseTile(x, y, biome, noiseValue);
            this.tiles.set(`${x}-${y}`, tile);
        }
    }
  }

  private createBaseTile(x: number, y: number, biome: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp', noiseValue: number): BattleMapTile {
    let terrain: BattleMapTerrain = 'grass';
    const elevation = Math.max(0, Math.floor(this.elevationNoise.get(x / 15, y / 15) * 3));

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

  private placeObstacles(biome: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp') {
    const obstacleConfig = {
      forest: { types: ['tree', 'boulder'], density: 0.12 },
      cave: { types: ['stalagmite', 'boulder'], density: 0.1 },
      dungeon: { types: ['pillar'], density: 0.07 },
      desert: { types: ['cactus', 'boulder'], density: 0.08 },
      swamp: { types: ['mangrove', 'boulder'], density: 0.15 },
    };
    
    const config = obstacleConfig[biome];
    const validTilesForObstacles: BattleMapTile[] = [];
    this.tiles.forEach(tile => {
        if (!tile.blocksMovement) {
            validTilesForObstacles.push(tile);
        }
    });
    
    for (let i = validTilesForObstacles.length - 1; i > 0; i--) {
        const j = Math.floor(this.random.next() * (i + 1));
        [validTilesForObstacles[i], validTilesForObstacles[j]] = [validTilesForObstacles[j], validTilesForObstacles[i]];
    }

    const numObstacles = Math.floor(validTilesForObstacles.length * config.density);

    for (let i = 0; i < numObstacles && i < validTilesForObstacles.length; i++) {
        const tile = validTilesForObstacles[i];
        const obstacleType = config.types[Math.floor(this.random.next() * config.types.length)];
        // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
        // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
        // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
        this.addObstacle(tile, obstacleType as unknown);
    }
  }

  private addObstacle(tile: BattleMapTile, type: BattleMapDecoration) {
    tile.decoration = type;
    if (type === 'tree' || type === 'pillar' || type === 'mangrove' || type === 'cactus') {
        tile.blocksLoS = true;
        tile.elevation += 2; // Make obstacles taller for LoS purposes
    } else if (type === 'boulder') {
        tile.elevation += 1;
    }
    tile.blocksMovement = true;
  }
  
  private ensureConnectivity() {
    // This is a complex part. A simple flood fill can check for connectivity.
    // If disconnected, a simple path-carving algorithm could connect areas.
    // For this demo, we'll assume the initial generation is mostly connected.
  }
}
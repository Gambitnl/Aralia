/**
 * @file hooks/useBattleMapGeneration.ts
 * Utility logic to manage the generation of the battle map data.
 * Previously a hook, now a stateless utility function.
 */
import { BattleMapData, BattleMapTile, CombatCharacter, CharacterPosition } from '../types/combat';
import { BATTLE_MAP_DIMENSIONS } from '../config/mapConfig';
import { BattleMapGenerator } from '../services/battleMapGenerator';
import { SeededRandom } from '@/utils/random';

type SpawnConfig = 'left-right' | 'top-bottom' | 'corners-tl-br' | 'corners-tr-bl';

const getSpawnTiles = (mapData: BattleMapData, config: SpawnConfig, rng: SeededRandom): { playerTiles: BattleMapTile[], enemyTiles: BattleMapTile[] } => {
    const playerSpawnTiles: BattleMapTile[] = [];
    const enemySpawnTiles: BattleMapTile[] = [];
    const { width, height } = mapData.dimensions;
    // Wide corners ensure enough walkable tiles even in dense biomes
    const cornerSize = Math.floor(Math.min(width, height) * 0.35); // ~35% of shorter dimension

    const addTilesFromRect = (tiles: BattleMapTile[], x1: number, y1: number, x2: number, y2: number) => {
        for (let y = y1; y < y2; y++) {
            for (let x = x1; x < x2; x++) {
                const tile = mapData.tiles.get(`${x}-${y}`);
                if (tile && !tile.blocksMovement) tiles.push(tile);
            }
        }
    };

    switch(config) {
        case 'top-bottom': {
            const stripH = Math.floor(height * 0.25); // top/bottom 25% each
            addTilesFromRect(playerSpawnTiles, 0, 0, width, stripH);
            addTilesFromRect(enemySpawnTiles, 0, height - stripH, width, height);
            break;
        }
        case 'corners-tl-br':
            addTilesFromRect(playerSpawnTiles, 0, 0, cornerSize, cornerSize);
            addTilesFromRect(enemySpawnTiles, width - cornerSize, height - cornerSize, width, height);
            break;
        case 'corners-tr-bl':
            addTilesFromRect(playerSpawnTiles, width - cornerSize, 0, width, cornerSize);
            addTilesFromRect(enemySpawnTiles, 0, height - cornerSize, cornerSize, height);
            break;
        case 'left-right':
        default: {
            const stripW = Math.floor(width * 0.25); // left/right 25% each
            addTilesFromRect(playerSpawnTiles, 0, 0, stripW, height);
            addTilesFromRect(enemySpawnTiles, width - stripW, 0, width, height);
            break;
        }
    }

    // Shuffle results
    const shuffle = (array: BattleMapTile[]) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(rng.next() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    };

    // Spread characters within their zone: skip tiles adjacent to already-claimed tiles
    // so characters get at least 1-tile separation by default.
    const spreadTiles = (tiles: BattleMapTile[], count: number): BattleMapTile[] => {
        const shuffled = shuffle([...tiles]);
        const occupied = new Set<string>();
        const result: BattleMapTile[] = [];
        const fallback: BattleMapTile[] = [];

        for (const tile of shuffled) {
            const { x, y } = tile.coordinates;
            const key = `${x}-${y}`;
            const hasNeighbor = (
                occupied.has(`${x - 1}-${y}`) || occupied.has(`${x + 1}-${y}`) ||
                occupied.has(`${x}-${y - 1}`) || occupied.has(`${x}-${y + 1}`)
            );
            if (!hasNeighbor) {
                occupied.add(key);
                result.push(tile);
            } else {
                fallback.push(tile);
            }
        }
        // Fill remaining slots from fallback if spread tiles don't cover all characters
        for (const tile of fallback) {
            if (result.length >= count) break;
            result.push(tile);
        }
        return result;
    };

    return { playerTiles: spreadTiles(playerSpawnTiles, 20), enemyTiles: spreadTiles(enemySpawnTiles, 20) };
}

export const generateBattleSetup = (
    biome: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp',
    seed: number,
    initialCharacters: CombatCharacter[]
): { mapData: BattleMapData, positionedCharacters: CombatCharacter[] } => {
    const generator = new BattleMapGenerator(BATTLE_MAP_DIMENSIONS.width, BATTLE_MAP_DIMENSIONS.height);
    const mapData = generator.generate(biome, seed);
    const rng = new SeededRandom(seed);

    const newPositions = new Map<string, CharacterPosition>();

    // Choose a random spawn configuration
    const spawnConfigs: SpawnConfig[] = ['left-right', 'top-bottom', 'corners-tl-br', 'corners-tr-bl'];
    const randomConfig = spawnConfigs[Math.floor(rng.next() * spawnConfigs.length)];

    // Get spawn tiles based on the random configuration
    const { playerTiles, enemyTiles } = getSpawnTiles(mapData, randomConfig, rng);

    let playerSpawnIndex = 0;
    let enemySpawnIndex = 0;

    // TODO: If spawn tiles run out, re-roll config or fall back to nearest walkable tiles so characters never start with undefined positions on dense maps.
    const positionedCharacters = initialCharacters.map(char => {
        let spawnTile;
        if(char.team === 'player' && playerSpawnIndex < playerTiles.length) {
            spawnTile = playerTiles[playerSpawnIndex++];
        } else if (char.team === 'enemy' && enemySpawnIndex < enemyTiles.length) {
            spawnTile = enemyTiles[enemySpawnIndex++];
        }

        if(spawnTile) {
            newPositions.set(char.id, { characterId: char.id, coordinates: spawnTile.coordinates });
            return {...char, position: spawnTile.coordinates};
        }
        return char;
    });

    return { mapData, positionedCharacters };
};

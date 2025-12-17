/**
 * @file hooks/useBattleMapGeneration.ts
 * Utility logic to manage the generation of the battle map data.
 * Previously a hook, now a stateless utility function.
 */
import { BattleMapData, BattleMapTile, CombatCharacter, CharacterPosition } from '../types/combat';
import { BATTLE_MAP_DIMENSIONS } from '../config/mapConfig';
import { BattleMapGenerator } from '../services/battleMapGenerator';
import { SeededRandom } from '../utils/seededRandom';

type SpawnConfig = 'left-right' | 'top-bottom' | 'corners-tl-br' | 'corners-tr-bl';

const getSpawnTiles = (mapData: BattleMapData, config: SpawnConfig, rng: SeededRandom): { playerTiles: BattleMapTile[], enemyTiles: BattleMapTile[] } => {
    const playerSpawnTiles: BattleMapTile[] = [];
    const enemySpawnTiles: BattleMapTile[] = [];
    const { width, height } = mapData.dimensions;
    const cornerSize = 8; // How large the corner spawn areas are

    const addTilesFromRect = (tiles: BattleMapTile[], x1: number, y1: number, x2: number, y2: number) => {
        for (let y = y1; y < y2; y++) {
            for (let x = x1; x < x2; x++) {
                const tile = mapData.tiles.get(`${x}-${y}`);
                if (tile && !tile.blocksMovement) tiles.push(tile);
            }
        }
    };

    switch(config) {
        case 'top-bottom':
            addTilesFromRect(playerSpawnTiles, 0, 0, width, 5); // Top 5 rows
            addTilesFromRect(enemySpawnTiles, 0, height - 5, width, height); // Bottom 5 rows
            break;
        case 'corners-tl-br':
            addTilesFromRect(playerSpawnTiles, 0, 0, cornerSize, cornerSize); // Top-left
            addTilesFromRect(enemySpawnTiles, width - cornerSize, height - cornerSize, width, height); // Bottom-right
            break;
        case 'corners-tr-bl':
            addTilesFromRect(playerSpawnTiles, width - cornerSize, 0, width, cornerSize); // Top-right
            addTilesFromRect(enemySpawnTiles, 0, height - cornerSize, 0 + cornerSize, height); // Bottom-left
            break;
        case 'left-right':
        default:
            addTilesFromRect(playerSpawnTiles, 0, 0, 5, height); // Left 5 columns
            addTilesFromRect(enemySpawnTiles, width - 5, 0, width, height); // Right 5 columns
            break;
    }

    // Shuffle results
    const shuffle = (array: BattleMapTile[]) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(rng.next() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    return { playerTiles: shuffle([...playerSpawnTiles]), enemyTiles: shuffle([...enemySpawnTiles]) };
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

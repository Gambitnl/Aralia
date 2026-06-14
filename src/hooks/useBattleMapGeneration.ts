/**
 * @file hooks/useBattleMapGeneration.ts
 * Utility logic for battle-map setup generation.
 * The filename is still hook-shaped for caller stability, but this module is
 * a plain stateless helper. Keep callers pointed here until a coordinated
 * rename can update every use site together.
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

    // Tactical spawn score (battle-map G6 / GOAL #64): spawns should use the
    // terrain — high ground and cover-adjacent tiles beat open ground. Scored
    // candidates are stable-sorted best-first AFTER the seeded shuffle, so the
    // shuffle remains the tiebreak among equal scores and same-seed runs stay
    // deterministic. Wedged pockets (nearly enclosed tiles) are penalized so
    // "near cover" never degrades into "stuck in a hole".
    const tacticalScore = (tile: BattleMapTile): number => {
        const { x, y } = tile.coordinates;
        let coverNeighbors = 0;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const n = mapData.tiles.get(`${x + dx}-${y + dy}`);
                if (n && (n.blocksMovement || n.blocksLoS || n.providesCover)) coverNeighbors++;
            }
        }
        const coverScore =
            coverNeighbors === 0 ? 0 :          // open ground
            coverNeighbors <= 2 ? 3 :           // flanking a rock/tree — ideal
            coverNeighbors <= 4 ? 1 :           // cramped but covered
            -2;                                 // wedged pocket — avoid
        return tile.elevation * 2 + coverScore + (tile.providesCover ? 1 : 0);
    };

    // Spread characters within their zone: claim a tile only if no already-claimed
    // tile is within MIN_SEP (Chebyshev). MIN_SEP=2 gives a visible formation
    // (≥2-tile gaps) instead of a clump; fallback fills if the zone is too tight.
    const MIN_SEP = 2;
    const spreadTiles = (tiles: BattleMapTile[], count: number): BattleMapTile[] => {
        // Seeded shuffle first (tiebreak), then stable sort by tactical score so
        // the spread pass claims the best terrain positions first.
        const shuffled = shuffle([...tiles]).sort((a, b) => tacticalScore(b) - tacticalScore(a));
        const occupied = new Set<string>();
        const result: BattleMapTile[] = [];
        const fallback: BattleMapTile[] = [];

        for (const tile of shuffled) {
            const { x, y } = tile.coordinates;
            const key = `${x}-${y}`;
            let hasNeighbor = false;
            for (let dx = -MIN_SEP; dx <= MIN_SEP && !hasNeighbor; dx++) {
                for (let dy = -MIN_SEP; dy <= MIN_SEP; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    if (occupied.has(`${x + dx}-${y + dy}`)) { hasNeighbor = true; break; }
                }
            }
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

// ============================================================================
// Walkable Tile Search for Preset Maps
// ============================================================================
// Finds the closest tile to a target coordinate that is walkable and not yet
// claimed by another character. Used to position teams near their relative
// starting spots on pre-extracted ground maps.
// ============================================================================
function findNearestWalkableTile(
    mapData: BattleMapData,
    targetX: number,
    targetY: number,
    occupied: Set<string>
): BattleMapTile | null {
    let bestTile: BattleMapTile | null = null;
    let bestDist = Infinity;

    for (const tile of mapData.tiles.values()) {
        const key = `${tile.coordinates.x}-${tile.coordinates.y}`;
        if (tile.blocksMovement || occupied.has(key)) {
            continue;
        }
        const dist = Math.hypot(tile.coordinates.x - targetX, tile.coordinates.y - targetY);
        if (dist < bestDist) {
            bestDist = dist;
            bestTile = tile;
        }
    }
    return bestTile;
}

export const generateBattleSetup = (
    biome: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp',
    seed: number,
    initialCharacters: CombatCharacter[],
    presetMapData?: BattleMapData
): { mapData: BattleMapData, positionedCharacters: CombatCharacter[] } => {
    // Use the preset map directly if provided (from ground-mode handoff);
    // otherwise, generate a new procedural map using the biome and seed.
    const mapData = presetMapData || new BattleMapGenerator(BATTLE_MAP_DIMENSIONS.width, BATTLE_MAP_DIMENSIONS.height).generate(biome, seed);
    const rng = new SeededRandom(seed);

    const newPositions = new Map<string, CharacterPosition>();
    const occupied = new Set<string>();

    // For procedural maps, choose a random spawn configuration and get spawn zones
    const spawnConfigs: SpawnConfig[] = ['left-right', 'top-bottom', 'corners-tl-br', 'corners-tr-bl'];
    const randomConfig = spawnConfigs[Math.floor(rng.next() * spawnConfigs.length)];
    const { playerTiles, enemyTiles } = getSpawnTiles(mapData, randomConfig, rng);

    let playerSpawnIndex = 0;
    let enemySpawnIndex = 0;

    const positionedCharacters = initialCharacters.map(char => {
        let spawnTile: BattleMapTile | null = null;

        if (presetMapData) {
            // For ground mode handoffs, place players near the center (20, 15)
            // and enemies near (24, 18) (approx. 5 meters northeast) to reflect
            // their walking positions.
            const targetX = char.team === 'player' ? 20 : 24;
            const targetY = char.team === 'player' ? 15 : 18;
            spawnTile = findNearestWalkableTile(mapData, targetX, targetY, occupied);
        } else {
            // Standard procedural mapping uses zone-based spawn configurations
            if (char.team === 'player' && playerSpawnIndex < playerTiles.length) {
                spawnTile = playerTiles[playerSpawnIndex++];
            } else if (char.team === 'enemy' && enemySpawnIndex < enemyTiles.length) {
                spawnTile = enemyTiles[enemySpawnIndex++];
            }
        }

        if (spawnTile) {
            const key = `${spawnTile.coordinates.x}-${spawnTile.coordinates.y}`;
            occupied.add(key);
            newPositions.set(char.id, { characterId: char.id, coordinates: spawnTile.coordinates });
            return { ...char, position: spawnTile.coordinates };
        }
        return char;
    });

    return { mapData, positionedCharacters };
};

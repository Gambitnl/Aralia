/**
 * @file src/utils/submapUtils.ts
 * This file contains utility functions for procedural submap generation,
 * ensuring that both UI components and game logic can access the same
 * deterministic data.
 */
import { SeededFeatureConfig, PathDetails } from '../types';
import { LOCATIONS, STARTING_LOCATION_ID, BIOMES } from '../constants';
import { biomeVisualsConfig, defaultBiomeVisuals } from '../config/submapVisualsConfig';
import { CellularAutomataGenerator } from '../services/cellularAutomataService';
import { simpleHash as generalHash } from './hashUtils';

// --- Hashing ---
/**
 * Lightweight deterministic hash used throughout submap generation. Exported so
 * other procedural generators (like the village layout system) can build
 * seeded RNG helpers without re-implementing the hash algorithm.
 */
export const simpleHash = (worldSeed: number, worldX: number, worldY: number, biomeSeedText: string, submapX: number, submapY: number, seedSuffix: string): number => {
    const str = `${worldSeed},${worldX},${worldY},${submapX},${submapY},${biomeSeedText},${seedSuffix}`;
    return generalHash(str);
};

/**
 * Creates a deterministic PRNG that mirrors how submaps seed their randomness.
 * The generator feeds incrementing indices into the shared hash to avoid
 * synchronisation between different systems while still remaining perfectly
 * repeatable for a given world coordinate + seed tuple.
 */
export const createSeededRandom = (worldSeed: number, parentWorldMapCoords: { x: number; y: number }, biomeSeedText: string, seedLabel: string): (() => number) => {
    let counter = 0;
    return () => {
        const hash = simpleHash(worldSeed, parentWorldMapCoords.x, parentWorldMapCoords.y, biomeSeedText, counter, counter, seedLabel);
        counter += 1;
        // Convert integer hash into [0,1) float using modulus of large prime
        return (hash % 100000) / 100000;
    };
};


// --- Feature Placement ---

/**
 * Deterministically places features (trees, rocks, ruins) on the submap based on the seed.
 *
 * WHY:
 * We use a "seeded random" approach where every feature's position and size is derived
 * from the world seed and coordinates. This ensures that if a player leaves and returns
 * to the same tile, the submap looks exactly the same without needing to store it in a database.
 *
 * HOW:
 * 1. Iterates through the config for the biome (e.g. "Forest" has "Trees").
 * 2. Uses a hash function to decide how many of that feature to place.
 * 3. Uses the hash to determine X, Y, and Size for each instance.
 * 4. Checks for collisions with the Main Path (so trees don't block the road).
 *
 * @param parentWorldMapCoords - The coordinates of the parent World Map tile (the "macro" location).
 * @param currentWorldBiomeId - The biome ID (e.g., 'forest', 'desert') to determine which features to spawn.
 * @param submapDimensions - The size of the submap grid (rows/cols).
 * @param seededFeaturesConfig - The biome-specific configuration defining what features can spawn.
 * @param hashFn - The deterministic hash function seeded for this specific submap.
 * @param mainPathCoords - A set of "x,y" strings representing tiles occupied by the main road/path.
 * @returns An array of placed feature instances with their positions and sizes.
 */
const getActiveSeededFeatures = (
    parentWorldMapCoords: { x: number, y: number },
    currentWorldBiomeId: string,
    submapDimensions: { rows: number, cols: number },
    seededFeaturesConfig: SeededFeatureConfig[] | undefined,
    hashFn: (submapX: number, submapY: number, seedSuffix: string) => number,
    mainPathCoords: Set<string> // Pass path coords for collision detection
): Array<{ x: number; y: number; config: SeededFeatureConfig; actualSize: number }> => {
    const features: Array<{ x: number; y: number; config: SeededFeatureConfig; actualSize: number }> = [];
    if (!seededFeaturesConfig) return features;

    seededFeaturesConfig.forEach((featureConfig, index) => {
        const featureTypeSeed = hashFn(index, 0, `feature_type_${featureConfig.id}`);
        const numToPlace = featureTypeSeed % (featureConfig.numSeedsRange[1] - featureConfig.numSeedsRange[0] + 1) + featureConfig.numSeedsRange[0];

        for (let i = 0; i < numToPlace; i++) {
            const instanceSeedModifier = `instance_${i}`;
            const seedXHash = hashFn(index, i, `seedX_${featureConfig.id}_${instanceSeedModifier}`);
            const seedYHash = hashFn(index, i, `seedY_${featureConfig.id}_${instanceSeedModifier}`);
            const seedSizeHash = hashFn(index, i, `seedSize_${featureConfig.id}_${instanceSeedModifier}`);

            const x = seedXHash % submapDimensions.cols;
            const y = seedYHash % submapDimensions.rows;
            const actualSize = seedSizeHash % (featureConfig.sizeRange[1] - featureConfig.sizeRange[0] + 1) + featureConfig.sizeRange[0];

            // COLLISION CHECK: Ensure seeded features do not overlap with the main path
            let overlapsPath = false;
            if (mainPathCoords.size > 0) {
                const minX = Math.max(0, x - actualSize);
                const maxX = Math.min(submapDimensions.cols - 1, x + actualSize);
                const minY = Math.max(0, y - actualSize);
                const maxY = Math.min(submapDimensions.rows - 1, y + actualSize);

                for (let checkY = minY; checkY <= maxY; checkY++) {
                    for (let checkX = minX; checkX <= maxX; checkX++) {
                        let isWithinFeature = false;
                        const dx = Math.abs(checkX - x);
                        const dy = Math.abs(checkY - y);

                        if (featureConfig.shapeType === 'rectangular') {
                            isWithinFeature = dx <= actualSize && dy <= actualSize;
                        } else { // Circular
                            const distance = Math.sqrt(Math.pow(checkX - x, 2) + Math.pow(checkY - y, 2));
                            isWithinFeature = distance <= actualSize;
                        }

                        if (isWithinFeature) {
                            if (mainPathCoords.has(`${checkX},${checkY}`)) {
                                overlapsPath = true;
                                break;
                            }
                        }
                    }
                    if (overlapsPath) break;
                }
            }

            if (!overlapsPath) {
                features.push({
                    x,
                    y,
                    config: featureConfig,
                    actualSize,
                });
            }
        }
    });
    return features;
};

// --- Path Generation ---

/**
 * Generates the "Main Path" or road that cuts through the submap.
 *
 * WHY:
 * To make navigation easier and the world feel inhabited, we procedurally generate
 * paths that connect across submap boundaries.
 *
 * HOW:
 * - Path Existence: Determined by a probability chance (hash % 100 < chance).
 * - Orientation: Randomly Vertical or Horizontal based on seed.
 * - Wobble: The path doesn't go straight; it "wobbles" left/right or up/down
 *   using Perlin-like noise (via the hash function) to look organic.
 * - Starting Location Override: If this is the "Starting Location" (e.g., first town),
 *   we force a path to exist and ensure it connects to the center.
 *
 * @param parentWorldMapCoords - The macro coordinates.
 * @param currentWorldBiomeId - The biome ID (affects path probability, e.g., low in swamps).
 * @param submapDimensions - Size of the grid.
 * @param hashFn - The deterministic hash function.
 * @returns An object containing `mainPathCoords` (the path itself) and `pathAdjacencyCoords` (tiles next to the path).
 */
const getPathDetails = (
    parentWorldMapCoords: { x: number, y: number },
    currentWorldBiomeId: string,
    submapDimensions: { rows: number, cols: number },
    hashFn: (submapX: number, submapY: number, seedSuffix: string) => number
): PathDetails => {
    const mainPathCoords = new Set<string>();
    const pathAdjacencyCoords = new Set<string>();
    const { rows, cols } = submapDimensions;

    let pathChance = 70;
    if (currentWorldBiomeId === 'swamp') pathChance = 30;
    if (currentWorldBiomeId === 'ocean') pathChance = 0;

    const startingLocationData = LOCATIONS[STARTING_LOCATION_ID];
    const isStartingLocationSubmap =
        startingLocationData &&
        currentWorldBiomeId === startingLocationData.biomeId &&
        parentWorldMapCoords.x === startingLocationData.mapCoordinates.x &&
        parentWorldMapCoords.y === startingLocationData.mapCoordinates.y;

    if (isStartingLocationSubmap) {
        pathChance = 100;
    }

    if (hashFn(0, 0, 'mainPathExists_v4') % 100 < pathChance) {
        const isVertical = hashFn(1, 1, 'mainPathVertical_v4') % 2 === 0;
        let currentX, currentY;
        let pathPoints: { x: number, y: number }[] = [];

        if (isVertical) {
            currentX = Math.floor(cols / 2) + (hashFn(2, 2, 'mainPathStartCol_v4') % Math.floor(cols / 3) - Math.floor(cols / 6));
            currentX = Math.max(1, Math.min(cols - 2, currentX));

            for (let y = 0; y < rows; y++) {
                pathPoints.push({ x: currentX, y: y });
                if (y < rows - 1) {
                    const wobble = hashFn(currentX, y, 'wobble_v_v4') % 3 - 1;
                    currentX = Math.max(1, Math.min(cols - 2, currentX + wobble));
                }
            }
        } else {
            currentY = Math.floor(rows / 2) + (hashFn(3, 3, 'mainPathStartRow_v4') % Math.floor(rows / 3) - Math.floor(rows / 6));
            currentY = Math.max(1, Math.min(rows - 2, currentY));

            for (let x = 0; x < cols; x++) {
                pathPoints.push({ x: x, y: currentY });
                if (x < cols - 1) {
                    const wobble = hashFn(x, currentY, 'wobble_h_v4') % 3 - 1;
                    currentY = Math.max(1, Math.min(rows - 2, currentY + wobble));
                }
            }
        }

        // Ensure path connects to the center for the starting location
        if (isStartingLocationSubmap) {
            const centerX = Math.floor(cols / 2);
            const centerY = Math.floor(rows / 2);
            let offsetX = 0;
            let offsetY = 0;

            if (isVertical) {
                const centerPoint = pathPoints.find(p => p.y === centerY);
                if (centerPoint) {
                    offsetX = centerX - centerPoint.x;
                }
            } else {
                const centerPoint = pathPoints.find(p => p.x === centerX);
                if (centerPoint) {
                    offsetY = centerY - centerPoint.y;
                }
            }

            if (offsetX !== 0 || offsetY !== 0) {
                pathPoints = pathPoints.map(p => ({
                    x: Math.max(0, Math.min(cols - 1, p.x + offsetX)),
                    y: Math.max(0, Math.min(rows - 1, p.y + offsetY))
                }));
            }
        }

        pathPoints.forEach(p => mainPathCoords.add(`${p.x},${p.y}`));

        if (isStartingLocationSubmap && mainPathCoords.size === 0) {
            const fixedStartX = Math.floor(submapDimensions.cols / 2);
            const fixedStartY = Math.floor(submapDimensions.rows / 2);
            mainPathCoords.add(`${fixedStartX},${fixedStartY}`);
        }
    }

    mainPathCoords.forEach(coordStr => {
        const [xStr, yStr] = coordStr.split(',');
        const x = parseInt(xStr);
        const y = parseInt(yStr);
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const adjX = x + dx;
                const adjY = y + dy;
                if (adjX >= 0 && adjX < cols && adjY >= 0 && adjY < rows) {
                    const adjCoordStr = `${adjX},${adjY}`;
                    if (!mainPathCoords.has(adjCoordStr)) {
                        pathAdjacencyCoords.add(adjCoordStr);
                    }
                }
            }
        }
    });

    return { mainPathCoords, pathAdjacencyCoords };
};


// --- Main Exported Function ---

interface SubmapTileInfo {
    effectiveTerrainType: string;
    isImpassable: boolean;
}

/**
 * Calculates the deterministic terrain type and properties of a single submap tile.
 *
 * WHY:
 * This is the "God Function" for the submap system. It is used by:
 * 1. The Renderer (to know which sprite to draw: grass, road, water).
 * 2. The Physics/Movement system (to know if a tile is walkable).
 * 3. The Interaction system (to know if you are standing on a 'village_area').
 *
 * It must be stateless and purely functional so it returns the exact same result
 * for the same seed/coordinates every time, allowing us to "generate" the map
 * on the fly without storing millions of tiles in the DB.
 *
 * @param worldSeed - The global seed for the entire game world.
 * @param parentWorldMapCoords - The X/Y of the world map tile we are inside.
 * @param currentWorldBiomeId - The biome of the world map tile.
 * @param submapDimensions - The size of the local grid.
 * @param targetSubmapCoords - The specific X/Y of the tile we are querying.
 * @returns Object containing the terrain type (string) and collision flag (boolean).
 */
export function getSubmapTileInfo(
    worldSeed: number,
    parentWorldMapCoords: { x: number, y: number },
    currentWorldBiomeId: string,
    submapDimensions: { rows: number, cols: number },
    targetSubmapCoords: { x: number, y: number }
): SubmapTileInfo {

    const worldBiome = BIOMES[currentWorldBiomeId];
    const biomeSeedText = worldBiome ? worldBiome.id + worldBiome.name : 'default_seed';
    const visualsConfig = (worldBiome && biomeVisualsConfig[worldBiome.id]) || defaultBiomeVisuals;

    const hashFn = (submapX: number, submapY: number, seedSuffix: string) => 
        simpleHash(worldSeed, parentWorldMapCoords.x, parentWorldMapCoords.y, biomeSeedText, submapX, submapY, seedSuffix);

    const { x: colIndex, y: rowIndex } = targetSubmapCoords;

    // --- Cellular Automata Logic ---
    if (currentWorldBiomeId === 'cave' || currentWorldBiomeId === 'dungeon') {
        const seed = hashFn(0, 0, 'ca_gen_seed');
        const generator = new CellularAutomataGenerator(submapDimensions.cols, submapDimensions.rows, seed);
        const fillProb = currentWorldBiomeId === 'dungeon' ? 0.40 : 0.45;
        const steps = currentWorldBiomeId === 'dungeon' ? 3 : 5;
        
        // Note: Generating the full map here every time might be slightly inefficient but CA is fast.
        // Optimization: This result could be cached in a WeakMap if needed.
        const grid = generator.generateMap(fillProb, steps);
        const tileType = grid[rowIndex]?.[colIndex] || 'wall';
        
        return {
            effectiveTerrainType: tileType,
            isImpassable: tileType === 'wall'
        };
    }

    // --- Standard Generation Logic ---
    const pathDetails = getPathDetails(parentWorldMapCoords, currentWorldBiomeId, submapDimensions, hashFn);
    // Passed pathDetails.mainPathCoords to seeded feature generation to prevent overlap
    const activeSeededFeatures = getActiveSeededFeatures(parentWorldMapCoords, currentWorldBiomeId, submapDimensions, visualsConfig.seededFeatures, hashFn, pathDetails.mainPathCoords);

    let effectiveTerrainType = 'default';
    let zIndex = 0;
    let isImpassable = false;

    const currentTileCoordString = `${colIndex},${rowIndex}`;

    if (pathDetails.mainPathCoords.has(currentTileCoordString)) {
        effectiveTerrainType = 'path';
        zIndex = 1;
    } else if (pathDetails.pathAdjacencyCoords.has(currentTileCoordString)) {
        effectiveTerrainType = 'path_adj';
        zIndex = 0.5;
    }

    for (const seeded of activeSeededFeatures) {
        let isWithinFeature = false;
        const dx = Math.abs(colIndex - seeded.x);
        const dy = Math.abs(rowIndex - seeded.y);

        if (seeded.config.shapeType === 'rectangular') {
            isWithinFeature = dx <= seeded.actualSize && dy <= seeded.actualSize;
        } else { // Default to circular
            const distance = Math.sqrt(Math.pow(colIndex - seeded.x, 2) + Math.pow(rowIndex - seeded.y, 2));
            isWithinFeature = distance <= seeded.actualSize;
        }
        
        if (isWithinFeature) {
            const featureZ = seeded.config.zOffset || 0.1;
            if (featureZ > zIndex) {
                zIndex = featureZ;
                effectiveTerrainType = seeded.config.generatesEffectiveTerrainType || seeded.config.id;
            }
        }
    }
    
    // Mark certain terrain types as impassable
    if (effectiveTerrainType === 'water' || effectiveTerrainType === 'village_area') {
        isImpassable = true;
    }

    return { effectiveTerrainType, isImpassable };
}

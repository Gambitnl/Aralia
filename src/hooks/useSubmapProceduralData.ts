/**
 * @file useSubmapProceduralData.ts
 * Custom hook to manage procedural data generation for SubmapPane.
 * This includes tile hashing, seeded feature placement, and path details.
 * Now supports Cellular Automata generation for caves and dungeons.
 */
import { useMemo, useCallback } from 'react';
import { LOCATIONS, STARTING_LOCATION_ID, BIOMES } from '../constants';
import { CellularAutomataGenerator, CaTileType } from '../services/cellularAutomataService';
import { generateWfcGrid, WfcGrid } from '../services/wfcService';
import type { SeededFeatureConfig, PathDetails } from '../types';

export type { SeededFeatureConfig, PathDetails };

interface UseSubmapProceduralDataProps {
  submapDimensions: { rows: number; cols: number };
  currentWorldBiomeId: string;
  parentWorldMapCoords: { x: number; y: number };
  seededFeaturesConfig?: SeededFeatureConfig[];
  worldSeed: number;
  adjacentBiomeIds?: string[];
}

interface UseSubmapProceduralDataOutput {
  simpleHash: (submapX: number, submapY: number, seedSuffix: string) => number;
  activeSeededFeatures: Array<{ x: number; y: number; config: SeededFeatureConfig; actualSize: number }>;
  pathDetails: PathDetails;
  caGrid?: CaTileType[][];
  wfcGrid?: WfcGrid;
  biomeBlendContext: {
    primaryBiomeId: string;
    secondaryBiomeId: string | null;
    blendFactor: number;
  };
}

export function useSubmapProceduralData({
  submapDimensions,
  currentWorldBiomeId,
  parentWorldMapCoords,
  seededFeaturesConfig,
  worldSeed,
  adjacentBiomeIds,
}: UseSubmapProceduralDataProps): UseSubmapProceduralDataOutput {
  const worldBiome = BIOMES[currentWorldBiomeId];
  const biomeSeedText = worldBiome ? worldBiome.id + worldBiome.name : 'default_seed';

  const simpleHash = useCallback((submapX: number, submapY: number, seedSuffix: string): number => {
    let h = 0;
    const str = `${worldSeed},${parentWorldMapCoords.x},${parentWorldMapCoords.y},${submapX},${submapY},${biomeSeedText},${seedSuffix}`;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }, [worldSeed, biomeSeedText, parentWorldMapCoords]);

  const biomeBlendContext = useMemo(() => {
    // Blend data is used by renderers to soften harsh biome edges. Secondary biome chosen from adjacency list if present.
    const secondaryBiomeId = adjacentBiomeIds?.find((id) => id && id !== currentWorldBiomeId) || null;
    // Blend factor is biased toward the primary biome but nudged when a neighbor exists.
    const blendFactor = secondaryBiomeId ? 0.15 : 0.05;
    return {
      primaryBiomeId: currentWorldBiomeId,
      secondaryBiomeId,
      blendFactor,
    };
  }, [adjacentBiomeIds, currentWorldBiomeId]);

  // 0. Cellular Automata Generation (for specific biomes)
  const caGrid = useMemo(() => {
    if (currentWorldBiomeId === 'cave' || currentWorldBiomeId === 'dungeon') {
        // Generate a deterministic seed for this specific submap
        const seed = simpleHash(0, 0, 'ca_gen_seed');
        const generator = new CellularAutomataGenerator(submapDimensions.cols, submapDimensions.rows, seed);
        
        // Tweak parameters based on biome
        const fillProbability = currentWorldBiomeId === 'dungeon' ? 0.40 : 0.45;
        const steps = currentWorldBiomeId === 'dungeon' ? 3 : 5; // Caves are smoother
        
        return generator.generateMap(fillProbability, steps);
    }
    return undefined;
  }, [currentWorldBiomeId, submapDimensions, simpleHash]);

  const wfcGrid = useMemo(() => {
    // WFC is used for above-ground biomes to prototype naturalistic clustering without the perf hit of full CA.
    if (caGrid) return undefined; // CA already handles cavernous spaces.
    const supportedBiomes = ['plains', 'forest', 'mountain', 'swamp'];
    if (!supportedBiomes.includes(currentWorldBiomeId)) return undefined;
    const seed = simpleHash(parentWorldMapCoords.x, parentWorldMapCoords.y, 'wfc_seed_v1');
    const rulesetId = currentWorldBiomeId === 'mountain' ? 'cavern' : 'temperate';
    return generateWfcGrid({
      rows: submapDimensions.rows,
      cols: submapDimensions.cols,
      rulesetId,
      seed,
      biomeContext: currentWorldBiomeId,
    });
  }, [caGrid, currentWorldBiomeId, parentWorldMapCoords, simpleHash, submapDimensions]);


  // 1. Calculate Path Details (Skipped for CA-driven biomes; WFC can still overlay paths)
  const pathDetails = useMemo(() => {
    const mainPathCoords = new Set<string>();
    const pathAdjacencyCoords = new Set<string>();

    // If we are using CA (cave/dungeon), skip standard paths; WFC maps can still benefit from a road overlay.
    if (caGrid) return { mainPathCoords, pathAdjacencyCoords };

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

    if (simpleHash(0, 0, 'mainPathExists_v4') % 100 < pathChance) {
        const isVertical = simpleHash(1, 1, 'mainPathVertical_v4') % 2 === 0;
        let currentX, currentY;
        let pathPoints: {x: number, y: number}[] = [];

        if (isVertical) {
            currentX = Math.floor(cols / 2) + (simpleHash(2, 2, 'mainPathStartCol_v4') % Math.floor(cols / 3) - Math.floor(cols / 6));
            currentX = Math.max(1, Math.min(cols - 2, currentX)); 

            for (let y = 0; y < rows; y++) {
                pathPoints.push({x: currentX, y: y});
                if (y < rows - 1) {
                    const wobble = simpleHash(currentX, y, 'wobble_v_v4') % 3 - 1;
                    currentX = Math.max(1, Math.min(cols - 2, currentX + wobble));
                }
            }
        } else { 
            currentY = Math.floor(rows / 2) + (simpleHash(3, 3, 'mainPathStartRow_v4') % Math.floor(rows / 3) - Math.floor(rows / 6));
            currentY = Math.max(1, Math.min(rows - 2, currentY));

            for (let x = 0; x < cols; x++) {
                pathPoints.push({x: x, y: currentY});
                if (x < cols - 1) {
                    const wobble = simpleHash(x, currentY, 'wobble_h_v4') % 3 - 1;
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
    
    // If paths were skipped but a WFC map is active, add a simple central path so roads don't vanish entirely.
    if (mainPathCoords.size === 0 && wfcGrid) {
        const isVerticalFallback = simpleHash(7, 7, 'wfc_path_fallback_v1') % 2 === 0;
        if (isVerticalFallback) {
            const midX = Math.floor(cols / 2);
            for (let y = 0; y < rows; y++) {
                mainPathCoords.add(`${midX},${y}`);
            }
        } else {
            const midY = Math.floor(rows / 2);
            for (let x = 0; x < cols; x++) {
                mainPathCoords.add(`${x},${midY}`);
            }
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
  }, [submapDimensions, simpleHash, currentWorldBiomeId, parentWorldMapCoords, caGrid, wfcGrid]);

  // 2. Calculate Active Seeded Features (Skipped for CA biomes)
  const activeSeededFeatures = useMemo(() => {
    const features: Array<{ x: number; y: number; config: SeededFeatureConfig; actualSize: number }> = [];
    if (!seededFeaturesConfig || caGrid) return features; // Skip if CA grid is active

    seededFeaturesConfig.forEach((featureConfig, index) => {
      const featureTypeSeed = simpleHash(index, 0, `feature_type_${featureConfig.id}`);
      const numToPlace = featureTypeSeed % (featureConfig.numSeedsRange[1] - featureConfig.numSeedsRange[0] + 1) + featureConfig.numSeedsRange[0];

      for (let i = 0; i < numToPlace; i++) {
        const instanceSeedModifier = `instance_${i}`;
        const seedXHash = simpleHash(index, i, `seedX_${featureConfig.id}_${instanceSeedModifier}`);
        const seedYHash = simpleHash(index, i, `seedY_${featureConfig.id}_${instanceSeedModifier}`);
        const seedSizeHash = simpleHash(index, i, `seedSize_${featureConfig.id}_${instanceSeedModifier}`);

        const x = seedXHash % submapDimensions.cols;
        const y = seedYHash % submapDimensions.rows;
        const actualSize = seedSizeHash % (featureConfig.sizeRange[1] - featureConfig.sizeRange[0] + 1) + featureConfig.sizeRange[0];

        // COLLISION CHECK: Ensure seeded features do not overlap with the main path
        let overlapsPath = false;
        if (pathDetails.mainPathCoords.size > 0) {
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
                        if (pathDetails.mainPathCoords.has(`${checkX},${checkY}`)) {
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
  }, [seededFeaturesConfig, submapDimensions, simpleHash, pathDetails, caGrid, currentWorldBiomeId, parentWorldMapCoords]);

  return { simpleHash, activeSeededFeatures, pathDetails, caGrid, wfcGrid, biomeBlendContext };
}

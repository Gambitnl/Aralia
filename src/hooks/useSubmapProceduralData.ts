// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 11/02/2026, 16:30:44
 * Dependents: Minimap.tsx, SubmapPane.tsx, submapVisuals.ts
 * Imports: 5 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import { generateContinuousSubmapPathDetails } from '../utils/spatial/submapPathContinuity';

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
  const biomeFamily = worldBiome?.family || currentWorldBiomeId;

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
    const supportedFamilies = new Set(['plains', 'forest', 'wetland', 'jungle', 'mountain', 'tundra', 'desert', 'coastal', 'blight', 'volcanic', 'highland']);
    if (!supportedFamilies.has(biomeFamily)) return undefined;
    const seed = simpleHash(parentWorldMapCoords.x, parentWorldMapCoords.y, 'wfc_seed_v1');
    const rulesetId = biomeFamily === 'mountain' ? 'cavern' : 'temperate';
    return generateWfcGrid({
      rows: submapDimensions.rows,
      cols: submapDimensions.cols,
      rulesetId,
      seed,
      biomeContext: biomeFamily,
    });
  }, [caGrid, biomeFamily, parentWorldMapCoords, simpleHash, submapDimensions]);


  // 1. Calculate Path Details (Skipped for CA-driven biomes; WFC can still overlay paths)
  const pathDetails = useMemo(() => {
    // If we are using CA (cave/dungeon), skip standard paths; WFC maps can still benefit from a road overlay.
    if (caGrid) {
      return {
        mainPathCoords: new Set<string>(),
        pathAdjacencyCoords: new Set<string>(),
        riverCoords: new Set<string>(),
        riverBankCoords: new Set<string>(),
        cliffCoords: new Set<string>(),
        cliffAdjacencyCoords: new Set<string>(),
      };
    }

    const { rows, cols } = submapDimensions;

    let edgeChance = 62;
    if (biomeFamily === 'wetland') edgeChance = 34;
    if (biomeFamily === 'mountain') edgeChance = 52;
    if (biomeFamily === 'desert') edgeChance = 48;
    if (currentWorldBiomeId === 'ocean') edgeChance = 0;
    
    const startingLocationData = LOCATIONS[STARTING_LOCATION_ID];
    const isStartingLocationSubmap = 
        startingLocationData &&
        currentWorldBiomeId === startingLocationData.biomeId &&
        parentWorldMapCoords.x === startingLocationData.mapCoordinates.x &&
        parentWorldMapCoords.y === startingLocationData.mapCoordinates.y;

    if (isStartingLocationSubmap) edgeChance = 100;

    const generated = generateContinuousSubmapPathDetails({
      worldSeed,
      tileCoords: parentWorldMapCoords,
      submapDimensions,
      edgeChancePercent: edgeChance,
      forceCenterConnection: isStartingLocationSubmap,
      networkId: 'road',
    });
    const mainPathCoords = new Set<string>(generated.mainPathCoords);
    let pathAdjacencyCoords = new Set<string>(generated.pathAdjacencyCoords);

    let riverEdgeChance = 18;
    if (biomeFamily === 'wetland') riverEdgeChance = 80;
    if (biomeFamily === 'coastal') riverEdgeChance = 72;
    if (biomeFamily === 'mountain') riverEdgeChance = 46;
    if (biomeFamily === 'jungle') riverEdgeChance = 40;
    if (biomeFamily === 'plains') riverEdgeChance = 24;
    if (biomeFamily === 'desert') riverEdgeChance = 8;
    if (biomeFamily === 'tundra') riverEdgeChance = 14;
    if (biomeFamily === 'volcanic') riverEdgeChance = 6;
    if (currentWorldBiomeId === 'ocean') riverEdgeChance = 0;

    const riverNetwork = generateContinuousSubmapPathDetails({
      worldSeed: worldSeed + 911,
      tileCoords: parentWorldMapCoords,
      submapDimensions,
      edgeChancePercent: riverEdgeChance,
      networkId: 'river',
    });
    const riverCoords = new Set<string>(riverNetwork.mainPathCoords);
    const riverBankCoords = new Set<string>(riverNetwork.pathAdjacencyCoords);

    let cliffEdgeChance = 0;
    if (biomeFamily === 'mountain') cliffEdgeChance = 24;
    if (biomeFamily === 'highland') cliffEdgeChance = 14;
    if (biomeFamily === 'volcanic') cliffEdgeChance = 18;
    if (biomeFamily === 'tundra') cliffEdgeChance = 8;
    if (biomeFamily === 'blight') cliffEdgeChance = 6;
    if (currentWorldBiomeId === 'ocean') cliffEdgeChance = 0;
    if (isStartingLocationSubmap) cliffEdgeChance = 0;

    const cliffNetwork = generateContinuousSubmapPathDetails({
      worldSeed: worldSeed + 1777,
      tileCoords: parentWorldMapCoords,
      submapDimensions,
      edgeChancePercent: cliffEdgeChance,
      networkId: 'cliff',
    });
    const cliffCoords = new Set<string>(cliffNetwork.mainPathCoords);
    const cliffAdjacencyCoords = new Set<string>(cliffNetwork.pathAdjacencyCoords);
    
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
        pathAdjacencyCoords = new Set<string>();
        mainPathCoords.forEach(coordStr => {
            const [xStr, yStr] = coordStr.split(',');
            const x = Number.parseInt(xStr, 10);
            const y = Number.parseInt(yStr, 10);
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
    }

    return {
      mainPathCoords,
      pathAdjacencyCoords,
      riverCoords,
      riverBankCoords,
      cliffCoords,
      cliffAdjacencyCoords,
    };
  }, [submapDimensions, simpleHash, currentWorldBiomeId, parentWorldMapCoords, caGrid, wfcGrid, worldSeed, biomeFamily]);

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
  // TODO(lint-intent): If seeded features should react to parent biome shifts, thread that through the config or hash.
  }, [seededFeaturesConfig, submapDimensions, simpleHash, pathDetails, caGrid]);

  return { simpleHash, activeSeededFeatures, pathDetails, caGrid, wfcGrid, biomeBlendContext };
}

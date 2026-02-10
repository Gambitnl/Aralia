/**
 * @file useQuickTravel.ts
 * Bundles the pathfinding grid + quick travel path calculation so SubmapPane stays readable.
 * Dependencies: tile visuals (for terrain type), player state, time modifiers, and shared pathfinder utils.
 */
import { useMemo } from 'react';
import { BattleMapData, BattleMapTile } from '../../types/combat';
import { PlayerCharacter } from '../../types';
import { getTimeModifiers } from '../../utils/core';
import { findPath } from '../../utils/pathfinding';

export interface SubmapPathNode {
  id: string;
  coordinates: { x: number; y: number };
  movementCost: number;
  blocksMovement: boolean;
  terrain?: unknown;
  elevation?: unknown;
  blocksLoS?: unknown;
  decoration?: unknown;
  effects?: unknown;
}

type TileVisualResolver = (rowIndex: number, colIndex: number) => { effectiveTerrainType: string };
type TileVisualMapGetter = (x: number, y: number) => { effectiveTerrainType: string } | undefined;

interface PathfindingGridOptions {
  submapDimensions: { rows: number; cols: number };
  getTileVisuals?: TileVisualResolver;
  getTileVisualsFromMap?: TileVisualMapGetter;
  playerCharacter: PlayerCharacter;
  gameTime: Date;
}

export const usePathfindingGrid = ({
  submapDimensions,
  getTileVisuals,
  getTileVisualsFromMap,
  playerCharacter,
  gameTime,
}: PathfindingGridOptions): Map<string, SubmapPathNode> => {
  // TODO: Destructure `submapDimensions` into `rows`/`cols` before including it in dependencies;
  // recreating the object upstream currently forces the entire pathfinding grid to rebuild even
  // when the numeric values are unchanged.
  return useMemo(() => {
    const grid = new Map<string, SubmapPathNode>();
    for (let r = 0; r < submapDimensions.rows; r++) {
      for (let c = 0; c < submapDimensions.cols; c++) {
        // Use either the direct function or the map getter
        const visuals = getTileVisualsFromMap 
          ? getTileVisualsFromMap(c, r) 
          : getTileVisuals?.(r, c);
        
        if (!visuals) continue;
        
        const { effectiveTerrainType } = visuals;
        let movementCost = 30; // default foot travel minutes
        let blocksMovement = false;

        if (playerCharacter.transportMode === 'foot') {
          if (effectiveTerrainType === 'path') {
            movementCost = 15;
          } else if (effectiveTerrainType === 'wall') {
            movementCost = Infinity;
            blocksMovement = true;
          } else {
            movementCost = 30;
          }
        }

        if (effectiveTerrainType === 'water' || effectiveTerrainType === 'village_area') {
          blocksMovement = true;
          movementCost = Infinity;
        }

        const modifiers = getTimeModifiers(gameTime);
        if (movementCost !== Infinity) {
          movementCost *= modifiers.travelCostMultiplier;
        }

        grid.set(`${c}-${r}`, {
          id: `${c}-${r}`,
          coordinates: { x: c, y: r },
          movementCost,
          blocksMovement,
        });
      }
    }
    return grid;
  }, [
    gameTime, 
    getTileVisuals, 
    getTileVisualsFromMap,
    playerCharacter.transportMode, 
    submapDimensions.rows,
    submapDimensions.cols
  ]);
};

interface QuickTravelDataOptions {
  isQuickTravelMode: boolean;
  hoveredTile: { x: number; y: number } | null;
  playerSubmapCoords: { x: number; y: number } | null;
  pathfindingGrid: Map<string, SubmapPathNode>;
  submapDimensions: { rows: number; cols: number };
  currentWorldBiomeId: string;
  simpleHash: (x: number, y: number, seed: string) => number;
}

export interface QuickTravelData {
  path: Set<string>;
  orderedPath: Array<{ x: number; y: number }>;
  time: number;
  isBlocked: boolean;
}

export const useQuickTravelData = ({
  isQuickTravelMode,
  hoveredTile,
  playerSubmapCoords,
  pathfindingGrid,
  submapDimensions,
  currentWorldBiomeId,
  simpleHash,
}: QuickTravelDataOptions): QuickTravelData => {
  return useMemo<QuickTravelData>(() => {
    if (!isQuickTravelMode || !hoveredTile || !playerSubmapCoords) {
      return { path: new Set<string>(), orderedPath: [], time: 0, isBlocked: false };
    }
    const startNode = pathfindingGrid.get(`${playerSubmapCoords.x}-${playerSubmapCoords.y}`);
    const endNode = pathfindingGrid.get(`${hoveredTile.x}-${hoveredTile.y}`);

    if (!startNode || !endNode || endNode.blocksMovement) {
      return { path: new Set<string>(), orderedPath: [], time: 0, isBlocked: !!endNode?.blocksMovement };
    }

    const themeForPathfinder = ((): BattleMapData['theme'] => {
      const validThemes: BattleMapData['theme'][] = ['forest', 'cave', 'dungeon', 'desert', 'swamp'];
      if ((validThemes as string[]).includes(currentWorldBiomeId)) {
        return currentWorldBiomeId as BattleMapData['theme'];
      }
      if (currentWorldBiomeId === 'plains' || currentWorldBiomeId === 'hills') return 'forest';
      if (currentWorldBiomeId === 'mountain') return 'cave';
      return 'forest';
    })();

    const mapForPathfinder: BattleMapData = {
      dimensions: { width: submapDimensions.cols, height: submapDimensions.rows },
      tiles: pathfindingGrid as unknown as Map<string, BattleMapTile>,
      theme: themeForPathfinder,
      seed: simpleHash(0, 0, 'pathfinder_seed'),
    };

    const pathNodes = findPath(startNode as unknown as BattleMapTile, endNode as unknown as BattleMapTile, mapForPathfinder);

    if (pathNodes.length === 0 && startNode !== endNode) {
      return { path: new Set<string>(), orderedPath: [], time: 0, isBlocked: true };
    }

    const pathCoords = new Set(pathNodes.map((p) => p.id));
    const orderedPath = pathNodes.map((p) => p.coordinates);
    // TODO: Guard start/end equality before subtracting `startNode.movementCost` so we don't report
    // negative travel times when the pathfinder returns an empty result.
    const travelTime = pathNodes.reduce((acc, node) => acc + node.movementCost, 0) - (startNode.movementCost || 0);

    return { path: pathCoords, orderedPath, time: travelTime, isBlocked: false };
  }, [
    currentWorldBiomeId,
    hoveredTile,
    isQuickTravelMode,
    pathfindingGrid,
    playerSubmapCoords,
    simpleHash,
    submapDimensions.cols,
    submapDimensions.rows,
  ]);
};

export default useQuickTravelData;

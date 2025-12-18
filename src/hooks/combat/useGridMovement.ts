/**
 * @file src/hooks/combat/useGridMovement.ts
 * Custom hook to manage the state and logic of grid-based movement.
 * Extracts pathfinding logic from the UI interaction layer.
 */
import { useState, useCallback } from 'react';
import { BattleMapData, BattleMapTile, CombatCharacter, CharacterPosition, AbilityCost } from '../../types/combat';
import { findPath } from '../../utils/pathfinding';

interface UseGridMovementProps {
  mapData: BattleMapData | null;
  characterPositions: Map<string, CharacterPosition>;
}

interface UseGridMovementReturn {
  validMoves: Set<string>;
  activePath: BattleMapTile[];
  calculateValidMoves: (character: CombatCharacter) => void;
  calculatePath: (character: CombatCharacter, targetTile: BattleMapTile) => void;
  clearMovementState: () => void;
}

export function useGridMovement({ mapData, characterPositions }: UseGridMovementProps): UseGridMovementReturn {
  const [validMoves, setValidMoves] = useState<Set<string>>(new Set());
  const [activePath, setActivePath] = useState<BattleMapTile[]>([]);

  const calculateValidMoves = useCallback((character: CombatCharacter) => {
    if (!mapData) return;
    const startPos = characterPositions.get(character.id)?.coordinates;
    if (!startPos) return;
    const startNode = mapData.tiles.get(`${startPos.x}-${startPos.y}`);
    if (!startNode) return;

    // TODO: Optimize this with a more efficient search or memoization if map size increases.
    // Ideally this logic should reside in src/utils/movementUtils.ts or similar pure function,
    // but keeping it here for now to respect the "extract state" scope.

    const reachableTiles = new Set<string>();
    const queue: { tile: BattleMapTile; cost: number }[] = [{ tile: startNode, cost: 0 }];
    const visited = new Set<string>([startNode.id]);

    // Calculate remaining movement
    const movementRemaining = character.actionEconomy.movement.total - character.actionEconomy.movement.used;

    while (queue.length > 0) {
      const { tile, cost } = queue.shift()!;
      reachableTiles.add(tile.id);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;

          const newX = tile.coordinates.x + dx;
          const newY = tile.coordinates.y + dy;
          const neighborId = `${newX}-${newY}`;
          const neighbor = mapData.tiles.get(neighborId);

          // Check for valid move:
          // 1. Neighbor exists
          // 2. Not blocked (wall/obstacle)
          // 3. Not occupied by another character (unless we allow moving through allies - current logic assumes strict block)
          // Note: characterPositions check is needed if we want to block movement through units.
          // The original code in useBattleMap didn't check characterPositions for blocking, only static map blocks.
          // We will stick to the original behavior unless we want to enhance it.
          // Update: We SHOULD block movement through other characters unless they are allies (optional rule).
          // For now, let's keep it simple and match original behavior: only check static blocks + movement cost.

          if (neighbor && !neighbor.blocksMovement && !visited.has(neighborId)) {
            const newCost = cost + neighbor.movementCost;
            if (newCost <= movementRemaining) {
              visited.add(neighborId);
              queue.push({ tile: neighbor, cost: newCost });
            }
          }
        }
      }
    }
    setValidMoves(reachableTiles);
  }, [mapData, characterPositions]);

  const calculatePath = useCallback((character: CombatCharacter, targetTile: BattleMapTile) => {
    if (!mapData || !validMoves.has(targetTile.id)) {
        setActivePath([]);
        return;
    }
    const startPos = characterPositions.get(character.id)?.coordinates;
    const startTile = startPos ? mapData.tiles.get(`${startPos.x}-${startPos.y}`) : null;

    if (startTile) {
      const path = findPath(startTile, targetTile, mapData);
      setActivePath(path);
    }
  }, [mapData, characterPositions, validMoves]);

  const clearMovementState = useCallback(() => {
    setValidMoves(new Set());
    setActivePath([]);
  }, []);

  return {
    validMoves,
    activePath,
    calculateValidMoves,
    calculatePath,
    clearMovementState
  };
}

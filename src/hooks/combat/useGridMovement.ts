/**
 * @file src/hooks/combat/useGridMovement.ts
 * Custom hook to manage the state and logic of grid-based movement.
 * Extracts pathfinding logic from the UI interaction layer.
 */
import { useState, useCallback, useMemo } from 'react';
import { BattleMapData, BattleMapTile, CombatCharacter, CharacterPosition } from '../../types/combat';
import { findPath } from '../../utils/pathfinding';
import { calculateMovementCost } from '../../utils/movementUtils';

interface UseGridMovementProps {
  mapData: BattleMapData | null;
  characterPositions: Map<string, CharacterPosition>;
  selectedCharacter: CombatCharacter | null;
}

interface UseGridMovementReturn {
  validMoves: Set<string>;
  activePath: BattleMapTile[];
  calculatePath: (character: CombatCharacter, targetTile: BattleMapTile) => void;
  clearMovementState: () => void;
}

export function useGridMovement({ mapData, characterPositions, selectedCharacter }: UseGridMovementProps): UseGridMovementReturn {
  const [activePath, setActivePath] = useState<BattleMapTile[]>([]);

  // Derived state: Valid moves for the selected character.
  // We use useMemo to avoid recalculating on every render, but ensure it updates when
  // the map, character position, or selected character changes.
  const validMoves = useMemo(() => {
    if (!selectedCharacter || !mapData) {
      return new Set<string>();
    }

    const startPos = characterPositions.get(selectedCharacter.id)?.coordinates;
    if (!startPos) return new Set<string>();

    const startNode = mapData.tiles.get(`${startPos.x}-${startPos.y}`);
    if (!startNode) return new Set<string>();

    const reachableTiles = new Set<string>();

    // BFS state needs to track diagonal count to properly enforce 5-10-5
    const queue: { tile: BattleMapTile; cost: number; diagonalCount: number }[] = [{ tile: startNode, cost: 0, diagonalCount: 0 }];

    // Visited map keys: "x-y-parity"
    const visited = new Map<string, number>();
    visited.set(`${startNode.id}-0`, 0);

    // Calculate remaining movement
    const movement = selectedCharacter.actionEconomy?.movement;
    const movementRemaining = movement ? (movement.total - movement.used) : 0;

    while (queue.length > 0) {
      const { tile, cost, diagonalCount } = queue.shift()!;
      reachableTiles.add(tile.id);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;

          const newX = tile.coordinates.x + dx;
          const newY = tile.coordinates.y + dy;
          const neighborId = `${newX}-${newY}`;
          const neighbor = mapData.tiles.get(neighborId);

          if (neighbor && !neighbor.blocksMovement) {
            // Calculate step cost using 5-10-5 rule
            const { cost: baseStepCost, isDiagonal } = calculateMovementCost(dx, dy, diagonalCount);
            const terrainMultiplier = neighbor.movementCost || 1;
            const stepCost = baseStepCost * terrainMultiplier;

            const newCost = cost + stepCost;
            const newDiagonalCount = isDiagonal ? diagonalCount + 1 : diagonalCount;
            const newParity = newDiagonalCount % 2;
            const visitedKey = `${neighborId}-${newParity}`;

            if (newCost <= movementRemaining) {
              // Only process if we found a cheaper way to this state (tile + parity)
              const previousCost = visited.get(visitedKey);
              if (previousCost === undefined || newCost < previousCost) {
                visited.set(visitedKey, newCost);
                queue.push({ tile: neighbor, cost: newCost, diagonalCount: newDiagonalCount });
              }
            }
          }
        }
      }
    }
    return reachableTiles;
  }, [selectedCharacter, mapData, characterPositions]);

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
    setActivePath([]);
    // validMoves is derived, so we cannot manually clear it unless we deselect the character
    // or the character's movement is used up.
    // In the context of useBattleMap, clearMovementState is called after a move.
    // The move action will update the character's position and used movement,
    // which will trigger useMemo to recalculate validMoves (likely to a smaller set or new area).
  }, []);

  return {
    validMoves,
    activePath,
    calculatePath,
    clearMovementState
  };
}

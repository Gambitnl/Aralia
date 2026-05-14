// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/05/2026, 14:08:58
 * Dependents: hooks/useBattleMap.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// ============================================================================
// Grid Movement Hook
// ============================================================================
// This hook figures out which tiles a selected character can reach on the
// battle map, given their remaining movement speed. It also computes the
// actual path the character would walk when the player clicks a destination.
//
// The core algorithm is a Breadth-First Search (BFS) that fans out from the
// character's current tile, spending movement budget on each step using D&D's
// 5-10-5 diagonal movement rule (first diagonal costs 5 ft, second costs
// 10 ft, alternating). The BFS stops expanding once movement is exhausted.
//
// 2024 PHB Prone/Crawling Integration:
// When a character has the Prone condition, all movement while prone costs
// double ("crawling" in D&D terms). This hook checks for Prone on both the
// BFS reachability calculation and the A* pathfinding call, so the highlighted
// tiles and computed paths both reflect the correct reduced movement range.
//
// Called by: useBattleMap.ts (the main battle map controller hook)
// Depends on: pathfinding.ts (A* path computation), movementUtils.ts (cost math)
// ============================================================================

import { useState, useCallback, useMemo } from 'react';
import { BattleMapData, BattleMapTile, CombatCharacter, CharacterPosition } from '../../types/combat';
import { findPath } from '../../utils/pathfinding';
import { getCharacterSizeMultiplier } from '../../utils/combatUtils';
// calculateMovementCost: base cost of a single step (5 or 10 ft depending on diagonal parity)
// getTileMovementMultiplier: normalizes tile terrain cost to a multiplier (1 = normal, 2 = difficult)
// calculateStepMovementCost: combines the above two (kept imported for potential future use)
import { calculateMovementCost, getTileMovementMultiplier, calculateStepMovementCost } from '../../utils/movementUtils';

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

  // ------------------------------------------------------------------
  // BFS Reachability — which tiles can this character reach?
  // ------------------------------------------------------------------
  // We fan out from the character's current tile, spending movement budget
  // on each step. Tiles within budget get added to the "valid moves" set
  // and are highlighted on the battle map.
  // ------------------------------------------------------------------
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

    // Figure out how many feet of movement the character has left this turn.
    const movement = selectedCharacter.actionEconomy?.movement;
    const movementRemaining = movement ? (movement.total - movement.used) : 0;

    const isProne = selectedCharacter.conditions?.some(c => c.name === 'Prone' || c.name === 'prone') || false;
    
    // Multi-tile movement: Large creatures occupy 2x2, Huge 3x3, etc.
    const multiplier = getCharacterSizeMultiplier(selectedCharacter.stats.size);

    while (queue.length > 0) {
      const { tile, cost, diagonalCount } = queue.shift()!;
      reachableTiles.add(tile.id);

      // Try all 8 neighboring tiles (cardinal + diagonal directions)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;

          const newX = tile.coordinates.x + dx;
          const newY = tile.coordinates.y + dy;
          
          // Check if all tiles in the multiplier square are passable
          let canPass = true;
          let maxTerrainMultiplier = 1;
          
          for (let sx = 0; sx < multiplier; sx++) {
            for (let sy = 0; sy < multiplier; sy++) {
              const checkId = `${newX + sx}-${newY + sy}`;
              const checkTile = mapData.tiles.get(checkId);
              
              if (!checkTile || checkTile.blocksMovement) {
                canPass = false;
                break;
              }
              
              // If any part of the creature is in difficult terrain, the whole movement is hampered
              const terrainMult = getTileMovementMultiplier(checkTile.movementCost);
              if (terrainMult > maxTerrainMultiplier) {
                maxTerrainMultiplier = terrainMult;
              }
            }
            if (!canPass) break;
          }

          if (canPass) {
            const { cost: baseCost, isDiagonal } = calculateMovementCost(dx, dy, diagonalCount);
            const crawlCost = isProne ? 1 : 0;
            const stepCost = baseCost * (maxTerrainMultiplier + crawlCost);

            const newCost = cost + stepCost;
            const newDiagonalCount = isDiagonal ? diagonalCount + 1 : diagonalCount;
            const newParity = newDiagonalCount % 2;
            const neighborId = `${newX}-${newY}`;
            const visitedKey = `${neighborId}-${newParity}`;

            if (newCost <= movementRemaining) {
              const previousCost = visited.get(visitedKey);
              if (previousCost === undefined || newCost < previousCost) {
                visited.set(visitedKey, newCost);
                const neighborTile = mapData.tiles.get(neighborId)!;
                queue.push({ tile: neighborTile, cost: newCost, diagonalCount: newDiagonalCount });
              }
            }
          }
        }
      }
    }
    return reachableTiles;
  }, [selectedCharacter, mapData, characterPositions]);

  // ------------------------------------------------------------------
  // Path Calculation (A* with Prone crawling cost)
  // ------------------------------------------------------------------
  // When the player hovers over a reachable tile, this function computes
  // the actual path the character would walk using A* pathfinding.
  // If the character is Prone, we pass { isCrawling: true } to the
  // pathfinder so it applies the doubled movement cost to every step.
  // This ensures the drawn path line matches the real cost.
  // ------------------------------------------------------------------
  const calculatePath = useCallback((character: CombatCharacter, targetTile: BattleMapTile) => {
    if (!mapData || !validMoves.has(targetTile.id)) {
        setActivePath([]);
        return;
    }
    const startPos = characterPositions.get(character.id)?.coordinates;
    const startTile = startPos ? mapData.tiles.get(`${startPos.x}-${startPos.y}`) : null;

    if (startTile) {
      // Check Prone status for the character whose path we're computing.
      // This is a separate check from the BFS above because calculatePath
      // receives a character parameter that might differ from selectedCharacter.
      const isProne = character.conditions?.some(c => c.name === 'Prone' || c.name === 'prone') || false;
      // Pass crawling state to the A* pathfinder in physicsUtils, which adds
      // +1 foot per foot to every step's cost when isCrawling is true.
      const multiplier = getCharacterSizeMultiplier(character.stats.size);
      const path = findPath(startTile, targetTile, mapData, { isCrawling: isProne }, multiplier);
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

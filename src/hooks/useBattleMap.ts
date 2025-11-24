/**
 * @file useBattleMap.ts
 * Custom hook to manage the state and logic of a procedural battle map.
 * Refactored to accept mapData from props instead of generating it internally.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { BattleMapData, BattleMapTile, CombatCharacter, CharacterPosition, AbilityCost } from '../types/combat';
import { findPath } from '../utils/pathfinding';

interface UseBattleMapReturn {
    characterPositions: Map<string, CharacterPosition>;
    selectedCharacterId: string | null;
    validMoves: Set<string>;
    activePath: BattleMapTile[];
    actionMode: 'move' | 'ability' | null;
    attackableTargets: Set<string>;
    setActionMode: React.Dispatch<React.SetStateAction<'move' | 'ability' | null>>;
    handleTileClick: (tile: BattleMapTile) => void;
    handleCharacterClick: (character: CombatCharacter) => void;
}

export function useBattleMap(
    mapData: BattleMapData | null,
    characters: CombatCharacter[],
    turnManager: any, // TurnManager Hook
    abilitySystem: any,
): UseBattleMapReturn {
  const [characterPositions, setCharacterPositions] = useState<Map<string, CharacterPosition>>(new Map());
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<Set<string>>(new Set());
  const [activePath, setActivePath] = useState<BattleMapTile[]>([]);
  const [actionMode, setActionMode] = useState<'move' | 'ability' | null>(null);
  const [attackableTargets, setAttackableTargets] = useState<Set<string>>(new Set());

  // Sync character positions when the characters prop changes
  useEffect(() => {
    const newPositions = new Map<string, CharacterPosition>();
    characters.forEach(char => {
        newPositions.set(char.id, { characterId: char.id, coordinates: char.position });
    });
    setCharacterPositions(newPositions);
  }, [characters]);


  const calculateValidMoves = useCallback((character: CombatCharacter) => {
    if (!mapData) return new Set<string>();
    const startPos = characterPositions.get(character.id)?.coordinates;
    if (!startPos) return new Set<string>();
    const startNode = mapData.tiles.get(`${startPos.x}-${startPos.y}`);
    if (!startNode) return new Set<string>();

    const reachableTiles = new Set<string>();
    const queue: { tile: BattleMapTile; cost: number }[] = [{ tile: startNode, cost: 0 }];
    const visited = new Set<string>([startNode.id]);
    
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
    return reachableTiles;
  }, [mapData, characterPositions]);
  
  const selectCharacter = useCallback((character: CombatCharacter) => {
    if (character.team !== 'player') return; // Prevent selecting enemy characters
    if (turnManager.turnState.currentCharacterId !== character.id) return;
    
    setSelectedCharacterId(character.id);
    setActionMode('move');

    const moves = calculateValidMoves(character);
    setValidMoves(moves);
    setActivePath([]);
  }, [turnManager.turnState.currentCharacterId, calculateValidMoves]);
  
  const handleCharacterClick = useCallback((character: CombatCharacter) => {
    if (abilitySystem.targetingMode) {
      if(abilitySystem.isValidTarget(abilitySystem.selectedAbility, turnManager.getCurrentCharacter(), character.position)) {
        abilitySystem.selectTarget(character.position, turnManager.getCurrentCharacter());
      }
    } else {
        selectCharacter(character);
    }
  }, [abilitySystem, selectCharacter, turnManager]);

  const handleTileClick = useCallback((tile: BattleMapTile) => {
    if (!selectedCharacterId || !mapData) return;
    
    const character = characters.find(c => c.id === selectedCharacterId);
    if (!character) return;

    if (actionMode === 'ability' && abilitySystem.targetingMode) {
        if(abilitySystem.isValidTarget(abilitySystem.selectedAbility, character, tile.coordinates)) {
           abilitySystem.selectTarget(tile.coordinates, character);
        } else {
           abilitySystem.cancelTargeting();
        }
    } else if (actionMode === 'move' && validMoves.has(tile.id)) {
      const startPos = characterPositions.get(selectedCharacterId)?.coordinates;
      const startTile = startPos ? mapData.tiles.get(`${startPos.x}-${startPos.y}`) : null;
      
      if (startTile) {
        const path = findPath(startTile, tile, mapData);
        setActivePath(path);

        const moveCost = path.reduce((acc, t) => acc + t.movementCost, 0) - startTile.movementCost;
        const moveActionCost: AbilityCost = { type: 'movement-only', movementCost: moveCost };
        
        if (turnManager.executeAction({
            id: Math.random().toString(),
            characterId: selectedCharacterId,
            type: 'move',
            cost: moveActionCost,
            targetPosition: tile.coordinates,
            timestamp: Date.now()
        })) {
             setValidMoves(new Set());
             setActivePath([]);
        }
      }
    }
  }, [selectedCharacterId, mapData, characters, actionMode, validMoves, abilitySystem, turnManager, characterPositions]);

  return {
    characterPositions,
    selectedCharacterId,
    validMoves,
    activePath,
    actionMode,
    attackableTargets,
    setActionMode,
    handleTileClick,
    handleCharacterClick,
  };
}

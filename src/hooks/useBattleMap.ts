/**
 * @file useBattleMap.ts
 * Custom hook to manage the state and logic of a procedural battle map.
 * Refactored to use useGridMovement for pathfinding state.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { BattleMapData, BattleMapTile, CombatCharacter, CharacterPosition, AbilityCost } from '../types/combat';
import { useTurnManager } from './combat/useTurnManager';
import { useAbilitySystem } from './useAbilitySystem';
import { useGridMovement } from './combat/useGridMovement';
import { findPath } from '../utils/pathfinding';

interface UseBattleMapReturn {
    characterPositions: Map<string, CharacterPosition>;
    selectedCharacterId: string | null;
    validMoves: Set<string>;
    activePath: BattleMapTile[];
    actionMode: 'move' | 'ability' | null;
    setActionMode: React.Dispatch<React.SetStateAction<'move' | 'ability' | null>>;
    handleTileClick: (tile: BattleMapTile) => void;
    handleCharacterClick: (character: CombatCharacter) => void;
}

export function useBattleMap(
    mapData: BattleMapData | null,
    characters: CombatCharacter[],
    turnManager: ReturnType<typeof useTurnManager>,
    abilitySystem: ReturnType<typeof useAbilitySystem>,
): UseBattleMapReturn {
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<'move' | 'ability' | null>(null);

  // Derived state: Map of character IDs to their positions
  const characterPositions = useMemo(() => {
    const newPositions = new Map<string, CharacterPosition>();
    characters.forEach(char => {
      newPositions.set(char.id, { characterId: char.id, coordinates: char.position });
    });
    return newPositions;
  }, [characters]);

  // Derived state: Selected Character Object
  const selectedCharacter = useMemo(() =>
    characters.find(c => c.id === selectedCharacterId) || null
  , [characters, selectedCharacterId]);

  const {
      validMoves,
      activePath,
      calculatePath,
      clearMovementState
  } = useGridMovement({ mapData, characterPositions, selectedCharacter });
  
  const selectCharacter = useCallback((character: CombatCharacter) => {
    if (character.team !== 'player') return; // Prevent selecting enemy characters
    if (turnManager.turnState.currentCharacterId !== character.id) return;
    
    setSelectedCharacterId(character.id);
    setActionMode('move');

    // calculateValidMoves is now handled automatically by useGridMovement via useEffect
  }, [turnManager.turnState.currentCharacterId]);
  
  const handleCharacterClick = useCallback((character: CombatCharacter) => {
    if (abilitySystem.targetingMode) {
      const currentActor = turnManager.getCurrentCharacter();
      const selectedAbility = abilitySystem.selectedAbility;

      if (currentActor && selectedAbility && abilitySystem.isValidTarget(selectedAbility, currentActor, character.position)) {
        abilitySystem.selectTarget(character.position, currentActor);
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
        if (abilitySystem.selectedAbility && abilitySystem.isValidTarget(abilitySystem.selectedAbility, character, tile.coordinates)) {
           abilitySystem.selectTarget(tile.coordinates, character);
        } else {
           abilitySystem.cancelTargeting();
        }
    } else if (actionMode === 'move' && validMoves.has(tile.id)) {
      const startPos = characterPositions.get(selectedCharacterId)?.coordinates;
      const startTile = startPos ? mapData.tiles.get(`${startPos.x}-${startPos.y}`) : null;
      
      if (startTile) {
        const path = findPath(startTile, tile, mapData);
        // We call calculatePath to update the visual state in the hook,
        // but we use the local 'path' var for immediate execution logic.
        calculatePath(character, tile);

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
             clearMovementState();
        }
      }
    }
  }, [selectedCharacterId, mapData, characters, actionMode, validMoves, abilitySystem, turnManager, characterPositions, calculatePath, clearMovementState]);

  return {
    characterPositions,
    selectedCharacterId,
    validMoves,
    activePath,
    actionMode,
    setActionMode,
    handleTileClick,
    handleCharacterClick,
  };
}

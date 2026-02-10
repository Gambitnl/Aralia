/**
 * @file useBattleMap.ts
 * Custom hook to manage the state and logic of a procedural battle map.
 * Refactored to use useGridMovement for pathfinding state.
 * 
 * CURRENT FUNCTIONALITY:
 * - Manages character positioning and selection state
 * - Handles turn-based action modes (move/ability)
 * - Integrates with grid movement system for pathfinding
 * - Coordinates with ability system for targeting
 * - Provides tile and character click handlers
 * 
 * PERFORMANCE OPPORTUNITIES:
 * - CharacterPositions Map recreation on every character array change
 * - No spatial indexing for fast position lookups
 * - Missing camera/view state integration for viewport calculations
 * - Pathfinding recalculated frequently without caching
 * - No batched state updates for multiple simultaneous changes
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
  const currentCharacterId = turnManager.turnState.currentCharacterId;
  const currentCharacter = useMemo(
    () => characters.find(c => c.id === currentCharacterId) || null,
    [characters, currentCharacterId]
  );
  const resolvedSelectedCharacterId =
    selectedCharacterId && selectedCharacterId === currentCharacterId
      ? selectedCharacterId
      : currentCharacter?.team === 'player'
        ? currentCharacterId ?? null
        : null;
  const resolvedActionMode =
    selectedCharacterId && selectedCharacterId === currentCharacterId
      ? actionMode
      : currentCharacter?.team === 'player'
        ? 'move'
        : null;
  // TODO(lint-intent): If turn-based selection should persist across turns, store selections keyed by turn id.

  // Derived state: Map of character IDs to their positions
  // IMPROVEMENT OPPORTUNITY: This recreates the entire Map on every character change
  // Could use incremental updates or spatial hash for faster lookups
  const characterPositions = useMemo(() => {
    const newPositions = new Map<string, CharacterPosition>();
    characters.forEach(char => {
      newPositions.set(char.id, { characterId: char.id, coordinates: char.position });
    });
    return newPositions;
  }, [characters]);

  // Derived state: Selected Character Object
  // IMPROVEMENT OPPORTUNITY: Could cache this with proper dependency tracking
  // to avoid recreation when unrelated characters change
  const selectedCharacter = useMemo(() =>
    characters.find(c => c.id === resolvedSelectedCharacterId) || null
    , [characters, resolvedSelectedCharacterId]);

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
    if (!resolvedSelectedCharacterId || !mapData) return;

    const character = characters.find(c => c.id === resolvedSelectedCharacterId);
    if (!character) return;

    if (resolvedActionMode === 'ability' && abilitySystem.targetingMode) {
      if (abilitySystem.selectedAbility && abilitySystem.isValidTarget(abilitySystem.selectedAbility, character, tile.coordinates)) {
        abilitySystem.selectTarget(tile.coordinates, character);
      } else {
        abilitySystem.cancelTargeting();
      }
    } else if (resolvedActionMode === 'move' && validMoves.has(tile.id)) {
      const startPos = characterPositions.get(resolvedSelectedCharacterId)?.coordinates;
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
          characterId: resolvedSelectedCharacterId,
          type: 'move',
          cost: moveActionCost,
          targetPosition: tile.coordinates,
          timestamp: Date.now()
        })) {
          clearMovementState();
        }
      }
    }
  }, [resolvedSelectedCharacterId, mapData, characters, resolvedActionMode, validMoves, abilitySystem, turnManager, characterPositions, calculatePath, clearMovementState]);

  return {
    characterPositions,
    selectedCharacterId: resolvedSelectedCharacterId,
    validMoves,
    activePath,
    actionMode: resolvedActionMode,
    setActionMode,
    handleTileClick,
    handleCharacterClick,
  };
}

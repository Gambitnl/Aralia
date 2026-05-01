// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/05/2026, 14:09:08
 * Dependents: components/BattleMap/BattleMap.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import { calculatePathMovementCost } from '../utils/movementUtils';

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
    abilitySystem.targetingMode
      ? 'ability'
      : selectedCharacterId && selectedCharacterId === currentCharacterId
        ? actionMode
        : currentCharacter?.team === 'player'
          ? actionMode ?? 'move'
          : null;
  // WHAT CHANGED: Active ability targeting now wins over the fallback "move"
  // mode. This preserves the existing auto-selection of the current player,
  // but stops the map from treating a target click as movement while an
  // ability is waiting for a target.
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

      // Let the ability system own final validation and feedback. Invalid
      // clicks now produce a combat-log reason instead of disappearing here.
      if (currentActor && selectedAbility) {
        const didSelectTarget = abilitySystem.selectTarget(character.position, currentActor);
        if (didSelectTarget) {
          setActionMode('move');
        }
      }
      return;
    } else {
      selectCharacter(character);
    }
  }, [abilitySystem, selectCharacter, turnManager]);

  const handleTileClick = useCallback((tile: BattleMapTile) => {
    if (!mapData) return;

    // Ability targeting handles both creature clicks and ground/area clicks.
    // Keeping this before movement preserves area spells and prevents an
    // invalid target click from silently canceling targeting.
    if (abilitySystem.targetingMode) {
      const currentActor = turnManager.getCurrentCharacter();
      if (currentActor && abilitySystem.selectedAbility) {
        const didSelectTarget = abilitySystem.selectTarget(tile.coordinates, currentActor);
        if (didSelectTarget) {
          setActionMode('move');
        }
      }
      return;
    }

    if (!resolvedSelectedCharacterId) return;

    const character = characters.find(c => c.id === resolvedSelectedCharacterId);
    if (!character) return;

    if (resolvedActionMode === 'move' && validMoves.has(tile.id)) {
      const startPos = characterPositions.get(resolvedSelectedCharacterId)?.coordinates;
      const startTile = startPos ? mapData.tiles.get(`${startPos.x}-${startPos.y}`) : null;

      if (startTile) {
        const path = findPath(startTile, tile, mapData);
        // We call calculatePath to update the visual state in the hook,
        // but we use the local 'path' var for immediate execution logic.
        calculatePath(character, tile);

        // Charge movement with the same feet-based path cost used by the range
        // preview. Summing raw tile movementCost was unsafe because maps mix
        // two conventions: 5/10 feet-per-tile and 1/2 terrain multipliers.
        const moveCost = calculatePathMovementCost(path);
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

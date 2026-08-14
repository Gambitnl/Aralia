// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 08:34:21
 * Dependents: hooks/combat/useTurnManager.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file hooks/combat/useTurnOrder.ts
 * Manages the sequential turn order logic, including initiative sorting,
 * round tracking, and turn transitions.
 *
 * Separated from useTurnManager to decouple "scheduling" from "game engine logic".
 */
import { useState, useCallback } from 'react';
import { CombatCharacter, TurnState, CombatAction } from '../../types/combat';
import { buildInitiativeOrder } from '../../utils/combat/initiativeUtils';
import {
  advanceCombatGroupTurn,
  buildCombatTurnGroups,
  createActiveCombatTurnGroup,
  type GroupTurnTransition,
  removeCombatTurnMember,
} from '../../utils/combat/groupTurnUtils';

interface UseTurnOrderProps {
  characters: CombatCharacter[];
  initialTurnState?: TurnState;
}

interface TurnOrderResult {
  turnState: TurnState;
  /**
   * Sorts characters by initiative and starts the first turn.
   */
  initializeTurnOrder: (charactersWithInitiative: CombatCharacter[]) => void;
  /**
   * Advances to the next character in the turn order.
   * Skips dead characters (HP <= 0).
   * Returns metadata about the transition (isNewRound, nextCharacterId).
   */
  advanceTurn: () => GroupTurnTransition;
  /**
   * Adds a character to the existing turn order dynamically.
   */
  joinTurnOrder: (
    characterId: string,
    afterCharacterId?: string,
    options?: { initiative?: number; groupWithAnchor?: boolean },
  ) => void;
  /**
   * Removes a character from the initiative order when a spell-created actor
   * leaves combat outside the normal death flow.
   */
  removeFromTurnOrder: (characterId: string) => GroupTurnTransition;
  /**
   * Checks if it is currently the given character's turn.
   */
  isCharacterTurn: (characterId: string) => boolean;
  /**
   * Manually sets the current character (debug/testing).
   */
  setCurrentCharacter: (characterId: string) => void;

  /**
   * Records an action taken by the current character for history tracking.
   */
  recordAction: (action: CombatAction) => void;

  /**
   * Reset the turn order state (e.g. for new combat)
   */
  resetTurnOrder: () => void;
}

export const useTurnOrder = ({ characters }: UseTurnOrderProps): TurnOrderResult => {
  const [turnState, setTurnState] = useState<TurnState>({
    currentTurn: 1,
    turnOrder: [],
    currentCharacterId: null,
    turnGroups: [],
    activeGroup: null,
    phase: 'planning',
    actionsThisTurn: []
  });

  const initializeTurnOrder = useCallback((charactersWithInitiative: CombatCharacter[]) => {
    // Use the shared production sorter so equal totals, shared-initiative
    // followers, replays, and the visible tracker all receive one exact order.
    const orderedCharacters = buildInitiativeOrder(charactersWithInitiative);
    const sortedOrder = orderedCharacters.map(char => char.id);
    const turnGroups = buildCombatTurnGroups(orderedCharacters);
    const firstGroup = turnGroups[0];
    const firstCharacterId = firstGroup?.memberIds[0] ?? null;

    setTurnState({
      currentTurn: 1,
      turnOrder: sortedOrder,
      currentCharacterId: firstCharacterId,
      turnGroups,
      activeGroup: firstGroup && firstCharacterId
        ? createActiveCombatTurnGroup(firstGroup, firstCharacterId)
        : null,
      phase: 'action',
      actionsThisTurn: []
    });
  }, []);

  const joinTurnOrder = useCallback((
    characterId: string,
    afterCharacterId?: string,
    options: { initiative?: number; groupWithAnchor?: boolean } = {},
  ) => {
    setTurnState(prev => {
      const newOrder = [...prev.turnOrder];
      const existingGroups = prev.turnGroups?.length
        ? prev.turnGroups.map(group => ({ ...group, memberIds: [...group.memberIds] }))
        : prev.turnOrder.map(existingId => ({
            id: `initiative-group:${existingId}`,
            initiative: characters.find(character => character.id === existingId)?.initiative ?? 0,
            memberIds: [existingId],
          }));
      let nextGroups = existingGroups;

      if (!newOrder.includes(characterId)) {
        const anchorIndex = afterCharacterId ? newOrder.indexOf(afterCharacterId) : -1;

        // A shared-policy join extends the owner's existing group and lands
        // after its current members. Other anchored joins keep their own
        // singleton initiative slot so an immediate summon does not silently
        // acquire shared resources or effect timing.
        if (anchorIndex >= 0 && options.groupWithAnchor) {
          const anchorGroupIndex = existingGroups.findIndex(group => (
            group.memberIds.includes(afterCharacterId!)
          ));
          const anchorGroup = existingGroups[anchorGroupIndex];
          const lastGroupMemberId = anchorGroup?.memberIds.at(-1) ?? afterCharacterId!;
          const lastGroupMemberIndex = newOrder.indexOf(lastGroupMemberId);
          newOrder.splice(lastGroupMemberIndex + 1, 0, characterId);
          if (anchorGroup) {
            nextGroups = existingGroups.map((group, index) => index === anchorGroupIndex
              ? { ...group, memberIds: [...group.memberIds, characterId] }
              : group);
          }
        } else if (anchorIndex >= 0) {
          newOrder.splice(anchorIndex + 1, 0, characterId);
          const anchorGroupIndex = existingGroups.findIndex(group => (
            group.memberIds.includes(afterCharacterId!)
          ));
          nextGroups = [...existingGroups];
          nextGroups.splice(anchorGroupIndex + 1, 0, {
            id: `initiative-group:${characterId}`,
            initiative: options.initiative ?? 0,
            memberIds: [characterId],
          });
        } else if (options.initiative !== undefined) {
          const currentIndex = prev.currentCharacterId ? newOrder.indexOf(prev.currentCharacterId) : -1;
          const firstFutureIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
          const insertIndexOffset = newOrder.slice(firstFutureIndex).findIndex(existingId => {
            const existingCharacter = characters.find(character => character.id === existingId);
            return existingCharacter !== undefined && existingCharacter.initiative < options.initiative!;
          });

          if (insertIndexOffset >= 0) {
            const insertIndex = firstFutureIndex + insertIndexOffset;
            newOrder.splice(insertIndex, 0, characterId);
          } else {
            newOrder.push(characterId);
          }
          // Rebuild singleton group placement from the updated flat order.
          // Rolled joins are never merged with another actor's group.
          const flatGroupIndex = newOrder.indexOf(characterId);
          const nextCharacterAfterJoin = newOrder[flatGroupIndex + 1];
          const beforeGroupIndex = nextCharacterAfterJoin
            ? existingGroups.findIndex(group => group.memberIds.includes(nextCharacterAfterJoin))
            : existingGroups.length;
          nextGroups = [...existingGroups];
          nextGroups.splice(Math.max(0, beforeGroupIndex), 0, {
            id: `initiative-group:${characterId}`,
            initiative: options.initiative,
            memberIds: [characterId],
          });
        } else {
          newOrder.push(characterId);
          nextGroups = [
            ...existingGroups,
            {
              id: `initiative-group:${characterId}`,
              initiative: options.initiative ?? 0,
              memberIds: [characterId],
            },
          ];
        }
      }
      return {
        ...prev,
        turnOrder: newOrder,
        turnGroups: nextGroups,
        activeGroup: prev.activeGroup
          ? {
              ...prev.activeGroup,
              memberIds: nextGroups.find(group => group.id === prev.activeGroup!.groupId)?.memberIds
                ?? prev.activeGroup.memberIds,
            }
          : prev.activeGroup,
      };
    });
  }, [characters]);

  const removeFromTurnOrder = useCallback((characterId: string) => {
    // Calculate from the current rendered scheduler state so the caller gets a
    // synchronous transition receipt and can start the replacement member once.
    const result = removeCombatTurnMember(turnState, characterId, characters);
    setTurnState(result.state);
    return result.transition;
  }, [characters, turnState]);

  const advanceTurn = useCallback(() => {
    // The pure scheduler owns member completion, group completion, dead/missing
    // skips, and round wrapping. Applying its returned state atomically keeps
    // the visible active member aligned with the transition receipt.
    const result = advanceCombatGroupTurn(turnState, characters);
    setTurnState(result.state);
    return result.transition;
  }, [characters, turnState]);

  const isCharacterTurn = useCallback((characterId: string) => {
    return turnState.currentCharacterId === characterId;
  }, [turnState.currentCharacterId]);

  const setCurrentCharacter = useCallback((characterId: string) => {
      setTurnState(prev => {
        const group = prev.turnGroups?.find(candidate => candidate.memberIds.includes(characterId));
        return {
          ...prev,
          currentCharacterId: characterId,
          activeGroup: group
            ? createActiveCombatTurnGroup(group, characterId)
            : prev.activeGroup,
        };
      });
  }, []);

  const recordAction = useCallback((action: CombatAction) => {
      setTurnState(prev => ({
          ...prev,
          actionsThisTurn: [...prev.actionsThisTurn, action]
      }));
  }, []);

  const resetTurnOrder = useCallback(() => {
      setTurnState({
        currentTurn: 1,
        turnOrder: [],
        currentCharacterId: null,
        turnGroups: [],
        activeGroup: null,
        phase: 'planning',
        actionsThisTurn: []
      });
  }, []);

  return {
    turnState,
    initializeTurnOrder,
    advanceTurn,
    joinTurnOrder,
    removeFromTurnOrder,
    isCharacterTurn,
    setCurrentCharacter,
    recordAction,
    resetTurnOrder
  };
};

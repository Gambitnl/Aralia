// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/07/2026, 11:54:58
 * Dependents: hooks/combat/useTurnManager.ts
 * Imports: 1 files
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
  advanceTurn: () => { isNewRound: boolean; nextCharacterId: string | null; previousCharacterId: string | null };
  /**
   * Adds a character to the existing turn order dynamically.
   */
  joinTurnOrder: (characterId: string, afterCharacterId?: string, options?: { initiative?: number }) => void;
  /**
   * Removes a character from the initiative order when a spell-created actor
   * leaves combat outside the normal death flow.
   */
  removeFromTurnOrder: (characterId: string) => void;
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
    phase: 'planning',
    actionsThisTurn: []
  });

  const initializeTurnOrder = useCallback((charactersWithInitiative: CombatCharacter[]) => {
    // Sort by initiative (descending)
    // Note: Ties should ideally be broken by Dex score, but simple ID/random for now is fine
    const sortedOrder = [...charactersWithInitiative]
      .sort((a, b) => b.initiative - a.initiative)
      .map(char => char.id);

    setTurnState({
      currentTurn: 1,
      turnOrder: sortedOrder,
      currentCharacterId: sortedOrder[0] || null,
      phase: 'action',
      actionsThisTurn: []
    });
  }, []);

  const joinTurnOrder = useCallback((characterId: string, afterCharacterId?: string, options: { initiative?: number } = {}) => {
    setTurnState(prev => {
      const newOrder = [...prev.turnOrder];
      if (!newOrder.includes(characterId)) {
        const anchorIndex = afterCharacterId ? newOrder.indexOf(afterCharacterId) : -1;

        // Shared-initiative summons need to land directly after the caster
        // that created them. Rolled-initiative summons, such as Conjure
        // Animals, use their rolled value to enter the existing initiative
        // order. Normal late joiners keep the older append-only behavior so
        // existing combat participation does not change.
        if (anchorIndex >= 0) {
          newOrder.splice(anchorIndex + 1, 0, characterId);
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
        } else {
          newOrder.push(characterId);
        }
      }
      return {
        ...prev,
        turnOrder: newOrder
      };
    });
  }, []);

  const removeFromTurnOrder = useCallback((characterId: string) => {
    setTurnState(prev => {
      const nextOrder = prev.turnOrder.filter(existingId => existingId !== characterId);
      const removedCurrentActor = prev.currentCharacterId === characterId;

      // Spell-created actors can vanish at round boundaries. If the removed
      // actor was somehow still marked current, move the pointer to the next
      // available initiative id so the turn loop never points at a missing
      // combatant.
      return {
        ...prev,
        turnOrder: nextOrder,
        currentCharacterId: removedCurrentActor ? (nextOrder[0] ?? null) : prev.currentCharacterId
      };
    });
  }, []);

  const advanceTurn = useCallback(() => {
    // TODO #289(FEATURES): Capture/replay turn-order transitions after initiative changes to diagnose combat log anomalies (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
    // Calculate next state based on CURRENT turnState
    // We access turnState directly from the closure (which is fresh on every render)
    const prev = turnState;
    const previousId = prev.currentCharacterId;

    if (!previousId && prev.turnOrder.length === 0) {
        return { isNewRound: false, nextCharacterId: null, previousCharacterId: null };
    }

    const currentIndex = prev.turnOrder.indexOf(previousId || '');
    let nextIndex = (currentIndex + 1) % prev.turnOrder.length;

    // Find next living character
    let attempts = 0;
    let foundNext = false;

    while (attempts < prev.turnOrder.length) {
      const charId = prev.turnOrder[nextIndex];
      const char = characters.find(c => c.id === charId);

      if (char) {
        // Player characters at 0 HP are "downed" and must take their turns to roll death saves
        // until they either stabilize (3 successes) or die (3 failures).
        const isDeadPlayer = char.team === 'player' && (char.deathSaves?.failures || 0) >= 3;
        const isDownedPlayer = char.team === 'player' && char.currentHP === 0 && !isDeadPlayer;

        if (char.currentHP > 0 || isDownedPlayer) {
          foundNext = true;
          break;
        }
      }
      nextIndex = (nextIndex + 1) % prev.turnOrder.length;
      attempts++;
    }

    if (!foundNext) {
        return { isNewRound: false, nextCharacterId: null, previousCharacterId: previousId };
    }

    const isNewRound = nextIndex <= currentIndex && attempts < prev.turnOrder.length;
    const nextCharacterId = prev.turnOrder[nextIndex];

    const result = {
        isNewRound,
        nextCharacterId,
        previousCharacterId: previousId
    };

    // Update state with calculated values
    setTurnState(current => ({
      ...current,
      currentTurn: isNewRound ? current.currentTurn + 1 : current.currentTurn,
      currentCharacterId: nextCharacterId,
      actionsThisTurn: [] // Reset actions for the new turn
    }));

    return result;
  }, [characters, turnState]);

  const isCharacterTurn = useCallback((characterId: string) => {
    return turnState.currentCharacterId === characterId;
  }, [turnState.currentCharacterId]);

  const setCurrentCharacter = useCallback((characterId: string) => {
      setTurnState(prev => ({ ...prev, currentCharacterId: characterId }));
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

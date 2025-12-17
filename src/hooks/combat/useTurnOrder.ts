/**
 * @file hooks/combat/useTurnOrder.ts
 * Manages the sequential turn order logic, including initiative sorting,
 * round tracking, and turn transitions.
 *
 * Separated from useTurnManager to decouple "scheduling" from "game engine logic".
 */
import { useState, useCallback, useMemo } from 'react';
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
  joinTurnOrder: (characterId: string) => void;
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

  const joinTurnOrder = useCallback((characterId: string) => {
    setTurnState(prev => {
      const newOrder = [...prev.turnOrder];
      if (!newOrder.includes(characterId)) {
        newOrder.push(characterId);
      }
      return {
        ...prev,
        turnOrder: newOrder
      };
    });
  }, []);

  const advanceTurn = useCallback(() => {
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

      if (char && char.currentHP > 0) {
          foundNext = true;
          break;
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
    isCharacterTurn,
    setCurrentCharacter,
    recordAction,
    resetTurnOrder
  };
};

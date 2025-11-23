/**
 * @file hooks/combat/useTurnManager.ts
 * Manages the turn-based combat state using the new action economy system.
 */
import { useState, useCallback, useEffect } from 'react';
import { CombatCharacter, TurnState, CombatAction, CombatLogEntry, AbilityCost } from '../../types/combat';
import { generateId, getActionMessage } from '../../utils/combatUtils';
import { useActionEconomy } from './useActionEconomy';

interface UseTurnManagerProps {
  characters: CombatCharacter[];
  onCharacterUpdate: (character: CombatCharacter) => void;
  onLogEntry: (entry: CombatLogEntry) => void;
}

export const useTurnManager = ({ 
  characters, 
  onCharacterUpdate, 
  onLogEntry 
}: UseTurnManagerProps) => {
  const [turnState, setTurnState] = useState<TurnState>({
    currentTurn: 1,
    turnOrder: [],
    currentCharacterId: null,
    phase: 'planning',
    actionsThisTurn: []
  });

  const { canAfford, consumeAction, resetEconomy } = useActionEconomy();

  const rollInitiative = (character: CombatCharacter): number => {
    const dexModifier = Math.floor((character.stats.dexterity - 10) / 2);
    const roll = Math.floor(Math.random() * 20) + 1;
    return roll + dexModifier + character.stats.baseInitiative;
  };

  const startTurnFor = (character: CombatCharacter) => {
    let updatedChar = resetEconomy(character);
    updatedChar = {
        ...updatedChar,
        statusEffects: character.statusEffects.map(effect => ({...effect, duration: effect.duration - 1})).filter(effect => effect.duration > 0),
        abilities: character.abilities.map(ability => ({
            ...ability,
            currentCooldown: Math.max(0, (ability.currentCooldown || 0) - 1)
        }))
    };
    onCharacterUpdate(updatedChar);
  };
  
  const initializeCombat = useCallback((initialCharacters: CombatCharacter[]) => {
    const charactersWithInitiative = initialCharacters.map(char => ({
      ...char,
      initiative: rollInitiative(char)
    }));

    const turnOrder = charactersWithInitiative
      .sort((a, b) => b.initiative - a.initiative)
      .map(char => char.id);

    // Reset economy for all characters at the start of combat
    charactersWithInitiative.forEach(char => {
        onCharacterUpdate(resetEconomy(char));
    });

    setTurnState({
      currentTurn: 1,
      turnOrder,
      currentCharacterId: turnOrder[0] || null,
      phase: 'action',
      actionsThisTurn: []
    });

    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'turn_start',
      message: `Combat begins! Turn order: ${turnOrder.map(id => 
        initialCharacters.find(c => c.id === id)?.name
      ).join(' → ')}`,
      data: { turnOrder, initiatives: charactersWithInitiative.map(c => ({ id: c.id, initiative: c.initiative })) }
    });
    
    if (turnOrder.length > 0) {
        const firstCharId = turnOrder[0];
        const firstChar = initialCharacters.find(c => c.id === firstCharId);
        if(firstChar) {
            startTurnFor(firstChar); 
            onLogEntry({
              id: generateId(),
              timestamp: Date.now(),
              type: 'turn_start',
              message: `${firstChar.name}'s turn.`,
              characterId: firstChar.id
            });
        }
    }
  }, [onCharacterUpdate, onLogEntry, resetEconomy]);

  const executeAction = useCallback((action: CombatAction): boolean => {
    const character = characters.find(c => c.id === action.characterId);
    if (!character || !canAfford(character, action.cost)) {
      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'action',
        message: `${character?.name || 'Character'} cannot perform this action (not enough resources or action already used).`,
        characterId: character?.id
      });
      return false;
    }
    
    let updatedCharacter = consumeAction(character, action.cost);
    
    if(action.type === 'move' && action.targetPosition) {
        updatedCharacter = {...updatedCharacter, position: action.targetPosition};
    }

    onCharacterUpdate(updatedCharacter);
    setTurnState(prev => ({ ...prev, actionsThisTurn: [...prev.actionsThisTurn, action] }));
    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'action',
      message: getActionMessage(action, character),
      characterId: character.id,
      data: action
    });
    return true;
  }, [characters, onCharacterUpdate, onLogEntry, canAfford, consumeAction]);
  
  const processEndOfTurnEffects = (character: CombatCharacter) => {
    let updatedCharacter = { ...character };
    
    updatedCharacter.statusEffects.forEach(effect => {
      switch (effect.effect.type) {
        case 'damage_per_turn':
          updatedCharacter.currentHP = Math.max(0, 
            updatedCharacter.currentHP - (effect.effect.value || 0)
          );
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'damage',
            message: `${character.name} takes ${effect.effect.value} damage from ${effect.name}`,
            characterId: character.id,
            data: { damage: effect.effect.value, source: effect.name }
          });
          break;
        case 'heal_per_turn':
          updatedCharacter.currentHP = Math.min(updatedCharacter.maxHP,
            updatedCharacter.currentHP + (effect.effect.value || 0)
          );
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'heal',
            message: `${character.name} heals ${effect.effect.value} HP from ${effect.name}`,
            characterId: character.id,
            data: { heal: effect.effect.value, source: effect.name }
          });
          break;
      }
    });
    onCharacterUpdate(updatedCharacter);
  };

  const endTurn = useCallback(() => {
    const currentCharacter = characters.find(c => c.id === turnState.currentCharacterId);
    if (!currentCharacter) return;

    processEndOfTurnEffects(currentCharacter);

    const currentIndex = turnState.turnOrder.indexOf(turnState.currentCharacterId!);
    let nextIndex = (currentIndex + 1) % turnState.turnOrder.length;
    
    const isNewRound = nextIndex === 0;
    const nextCharacterId = turnState.turnOrder[nextIndex];
    
    if (isNewRound) {
      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'turn_start',
        message: `Round ${turnState.currentTurn + 1} begins!`,
        data: { round: turnState.currentTurn + 1 }
      });
    }

    setTurnState(prev => ({
      ...prev,
      currentTurn: isNewRound ? prev.currentTurn + 1 : prev.currentTurn,
      currentCharacterId: nextCharacterId,
      actionsThisTurn: []
    }));
    
  }, [turnState, characters, onCharacterUpdate, onLogEntry]);

  const getCurrentCharacter = useCallback(() => {
    return characters.find(c => c.id === turnState.currentCharacterId);
  }, [characters, turnState.currentCharacterId]);
  
  useEffect(() => {
    const character = getCurrentCharacter();
    if (!character) return;
    
    startTurnFor(character);
    onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'turn_start',
        message: `${character.name}'s turn.`,
        characterId: character.id
    });
    
    if (character.team === 'enemy') {
        const timer = setTimeout(() => {
             onLogEntry({
                id: generateId(),
                timestamp: Date.now(),
                type: 'action',
                message: `${character.name} shuffles menacingly and ends its turn.`,
                characterId: character.id,
            });
            endTurn();
        }, 1500);
        return () => clearTimeout(timer);
    }
    
  }, [turnState.currentCharacterId]);


  const isCharacterTurn = useCallback((characterId: string) => {
    return turnState.currentCharacterId === characterId;
  }, [turnState.currentCharacterId]);

  return {
    turnState,
    initializeCombat,
    executeAction,
    endTurn,
    getCurrentCharacter,
    isCharacterTurn,
    canAffordAction: canAfford
  };
};
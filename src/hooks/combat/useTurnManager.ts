/**
 * @file hooks/combat/useTurnManager.ts
 * Manages the turn-based combat state using the new action economy system.
 * Now integrates AI decision making and Damage Numbers with stale state fix.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { CombatCharacter, TurnState, CombatAction, CombatLogEntry, BattleMapData, DamageNumber } from '../../types/combat';
import { createDamageNumber, generateId, getActionMessage } from '../../utils/combatUtils';
import { useActionEconomy } from './useActionEconomy';
import { evaluateCombatTurn } from '../../utils/combat/combatAI';

interface UseTurnManagerProps {
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  onCharacterUpdate: (character: CombatCharacter) => void;
  onLogEntry: (entry: CombatLogEntry) => void;
  autoCharacters?: Set<string>;
}

export const useTurnManager = ({ 
  characters, 
  mapData,
  onCharacterUpdate, 
  onLogEntry,
  autoCharacters = new Set()
}: UseTurnManagerProps) => {
  const [turnState, setTurnState] = useState<TurnState>({
    currentTurn: 1,
    turnOrder: [],
    currentCharacterId: null,
    phase: 'planning',
    actionsThisTurn: []
  });

  // Track damage numbers
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);

  // AI State to manage turn steps without stale closures
  const [aiState, setAiState] = useState<'idle' | 'thinking' | 'acting' | 'done'>('idle');
  const [aiActionsPerformed, setAiActionsPerformed] = useState(0);

  const { canAfford, consumeAction, resetEconomy } = useActionEconomy();

  const addDamageNumber = useCallback((value: number, position: {x: number, y: number}, type: 'damage' | 'heal' | 'miss') => {
      // Build a normalized payload so overlays animate consistently no matter the source.
      const newDn: DamageNumber = createDamageNumber(value, position, type);
      setDamageNumbers(prev => [...prev, newDn]);

      // Auto-remove after duration to avoid a stale overlay queue lingering across turns.
      setTimeout(() => {
          setDamageNumbers(prev => prev.filter(dn => dn.id !== newDn.id));
      }, newDn.duration);
  }, []);

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
    
  }, [onCharacterUpdate, onLogEntry, resetEconomy]);

  const executeAction = useCallback((action: CombatAction): boolean => {
    // If it's an end_turn action, we handle it separately
    if (action.type === 'end_turn') {
        endTurn();
        return true;
    }

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
            const dmg = effect.effect.value || 0;
          updatedCharacter.currentHP = Math.max(0, updatedCharacter.currentHP - dmg);
          addDamageNumber(dmg, updatedCharacter.position, 'damage');
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'damage',
            message: `${character.name} takes ${dmg} damage from ${effect.name}`,
            characterId: character.id,
            data: { damage: dmg, source: effect.name }
          });
          break;
        case 'heal_per_turn':
            const heal = effect.effect.value || 0;
          updatedCharacter.currentHP = Math.min(updatedCharacter.maxHP, updatedCharacter.currentHP + heal);
          addDamageNumber(heal, updatedCharacter.position, 'heal');
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'heal',
            message: `${character.name} heals ${heal} HP from ${effect.name}`,
            characterId: character.id,
            data: { heal: heal, source: effect.name }
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
    
    // Skip dead characters
    let attempts = 0;
    while (attempts < turnState.turnOrder.length) {
        const charId = turnState.turnOrder[nextIndex];
        const char = characters.find(c => c.id === charId);
        if (char && char.currentHP > 0) {
            break;
        }
        nextIndex = (nextIndex + 1) % turnState.turnOrder.length;
        attempts++;
    }

    const isNewRound = nextIndex <= currentIndex && attempts < turnState.turnOrder.length;
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
    setAiState('idle'); // Reset AI
    setAiActionsPerformed(0);
    
  }, [turnState, characters, onCharacterUpdate, onLogEntry, addDamageNumber]);

  const getCurrentCharacter = useCallback(() => {
    return characters.find(c => c.id === turnState.currentCharacterId);
  }, [characters, turnState.currentCharacterId]);
  
  // Turn Start Handling
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
    
    if (character.team === 'enemy' || autoCharacters.has(character.id)) {
        // Init AI turn
        // Small delay to allow visuals to catch up
        setTimeout(() => setAiState('thinking'), 1000);
    }
  }, [turnState.currentCharacterId]);

  // AI Logic - Reacting to 'thinking' state or state updates
  useEffect(() => {
      if (aiState !== 'thinking') return;

      const character = getCurrentCharacter();
      if (!character) {
          setAiState('idle');
          return;
      }

      // Safety break
      if (aiActionsPerformed >= 3 || !mapData) {
           setAiState('done');
           endTurn();
           return;
      }

      const decideAction = async () => {
          setAiState('acting'); // Lock

          // Evaluate based on CURRENT characters state (passed via props, so this effect re-runs when props change if we add it to dep array, or we trust closures?)
          // To fix stale state, we MUST ensure this effect runs with fresh `characters`.
          // If we add `characters` to dep array, this runs on every update.
          // `aiState` is 'thinking'.
          // When we execute action, `characters` updates. Component renders.
          // This effect runs again. We need to decide if we keep going.

          const action = evaluateCombatTurn(character, characters, mapData);

          if (action.type === 'end_turn') {
              setAiState('done');
              endTurn();
          } else {
              const success = executeAction(action);
              if (success) {
                  setAiActionsPerformed(prev => prev + 1);
                  // Wait for animation then go back to thinking
                  setTimeout(() => setAiState('thinking'), 1500);
              } else {
                  // Failed to execute (e.g. costs), just end
                  setAiState('done');
                  endTurn();
              }
          }
      };

      decideAction();

  }, [aiState, characters, mapData, turnState.currentCharacterId, aiActionsPerformed]); // Including characters here ensures we see fresh state


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
    canAffordAction: canAfford,
    addDamageNumber,
    damageNumbers
  };
};

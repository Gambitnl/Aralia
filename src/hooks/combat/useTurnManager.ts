/**
 * @file hooks/combat/useTurnManager.ts
 * Manages the turn-based combat state using the new action economy system.
 * Now integrates AI decision making and Damage Numbers with stale state fix.
 */
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { CombatCharacter, TurnState, CombatAction, CombatLogEntry, BattleMapData, DamageNumber, Animation } from '../../types/combat';
import { AI_THINKING_DELAY_MS } from '../../config/combatConfig';
import { createDamageNumber, generateId, getActionMessage } from '../../utils/combatUtils';
import { resetEconomy } from '../../utils/combat/actionEconomyUtils';
import { useActionEconomy } from './useActionEconomy';
import { evaluateCombatTurn } from '../../utils/combat/combatAI';

interface UseTurnManagerProps {
  difficulty: keyof typeof AI_THINKING_DELAY_MS;
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
  autoCharacters
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
  const [animations, setAnimations] = useState<Animation[]>([]);

  // AI State to manage turn steps without stale closures
  const [aiState, setAiState] = useState<'idle' | 'thinking' | 'acting' | 'done'>('idle');
  const [aiActionsPerformed, setAiActionsPerformed] = useState(0);

  // Stabilize optional auto-controlled character set so downstream deps do not churn
  // when callers omit the argument (otherwise a new Set would be created each render).
  // We use a ref-backed default to survive strict-mode re-renders without generating
  // fresh identities, while still respecting caller-provided sets.
  const defaultAutoControlledRef = useRef<Set<string>>();
  const managedAutoCharacters = useMemo(() => {
    if (autoCharacters) return autoCharacters;
    if (!defaultAutoControlledRef.current) {
      defaultAutoControlledRef.current = new Set<string>();
    }
    return defaultAutoControlledRef.current;
  }, [autoCharacters]);

  const { canAfford, consumeAction } = useActionEconomy();

  const addDamageNumber = useCallback((value: number, position: {x: number, y: number}, type: 'damage' | 'heal' | 'miss') => {
      // Build a normalized payload so overlays animate consistently no matter the source.
      const newDn: DamageNumber = createDamageNumber(value, position, type);
      setDamageNumbers(prev => [...prev, newDn]);

      // Auto-remove after duration to avoid a stale overlay queue lingering across turns.
      setTimeout(() => {
          setDamageNumbers(prev => prev.filter(dn => dn.id !== newDn.id));
      }, newDn.duration);
  }, []);

  const rollInitiative = useCallback((character: CombatCharacter): number => {
    // Memoized to avoid re-allocating a tiny helper every render; keeps downstream
    // callbacks stable and prevents needless hook churn.
    const dexModifier = Math.floor((character.stats.dexterity - 10) / 2);
    const roll = Math.floor(Math.random() * 20) + 1;
    return roll + dexModifier + character.stats.baseInitiative;
  }, []);

  const queueAnimation = useCallback((animation: Animation) => {
    setAnimations(prev => [...prev, animation]);
    setTimeout(() => {
      setAnimations(prev => prev.filter(anim => anim.id !== animation.id));
    }, animation.duration);
  }, []);

  const startTurnFor = useCallback((character: CombatCharacter) => {
    // Memoized so effects that depend on it do not re-wire every render, which keeps
    // turn start side effects from being re-subscribed unnecessarily.
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
  }, [onCharacterUpdate, resetEconomy]);
  
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

    // Reset the turn-start guard so a fresh combat cannot accidentally inherit the
    // last actor/round key from a prior encounter, which would block the first
    // character from getting their economy reset.
    lastTurnStartKey.current = null;

  }, [onCharacterUpdate, onLogEntry, resetEconomy, rollInitiative]);

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

    if (action.type === 'ability') {
      const targetPositions = action.targetCharacterIds
        ?.map(id => characters.find(c => c.id === id)?.position)
        .filter(Boolean) as { x: number; y: number }[];

      queueAnimation({
        id: generateId(),
        type: 'spell_effect',
        characterId: action.characterId,
        startPosition: character.position,
        endPosition: action.targetPosition,
        duration: 650,
        startTime: Date.now(),
        data: { targetPositions: targetPositions?.length ? targetPositions : action.targetPosition ? [action.targetPosition] : [] },
      });
    }
    return true;
  }, [characters, onCharacterUpdate, onLogEntry, canAfford, consumeAction, queueAnimation]);
  
  const processEndOfTurnEffects = useCallback((character: CombatCharacter) => {
    // Memoized to keep heavy end-of-turn effect handling stable between renders,
    // which reduces diff noise for consumers and prevents redundant timeout setups.
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
  }, [addDamageNumber, onCharacterUpdate, onLogEntry]);

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

  }, [turnState, characters, processEndOfTurnEffects, onLogEntry]);

  const currentCharacter = useMemo(() => {
    // Memoized lookup prevents repeated scans of the roster and provides a stable
    // reference for effects that react to the active actor.
    return characters.find(c => c.id === turnState.currentCharacterId);
  }, [characters, turnState.currentCharacterId]);

  const getCurrentCharacter = useCallback(() => currentCharacter, [currentCharacter]);
  
  // Track when a turn has already been initialized so we do not re-run
  // startTurnFor mid-turn when the characters array changes (e.g. HP/cooldowns
  // updating after actions). Without this guard, dependency updates from
  // getCurrentCharacter/characters would repeatedly reset the action economy,
  // accidentally granting extra actions while expiring statuses early.
  const lastTurnStartKey = useRef<string | null>(null);

  // Turn Start Handling
  useEffect(() => {
    const activeId = turnState.currentCharacterId;
    if (!activeId) return;

    const turnStartKey = `${turnState.currentTurn}:${activeId}`;
    if (lastTurnStartKey.current === turnStartKey) {
      // This guard is crucial. It prevents re-running turn initialization when a parent
      // component re-renders (e.g., due to a character HP update). Re-running startTurnFor
      // would incorrectly reset action economy and prematurely tick down status effects.
      // We are adding this log to help debug rare cases where initiative reordering might
      // cause this guard to misfire.
      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'system_debug',
        message: `Turn start guard triggered for ${activeId} on turn ${turnState.currentTurn}.`,
        data: { lastKey: lastTurnStartKey.current, currentKey: turnStartKey },
      });
      return;
    }

    const character = characters.find(c => c.id === activeId);
    if (!character) return;

    lastTurnStartKey.current = turnStartKey;
    startTurnFor(character);
    onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'turn_start',
        message: `${character.name}'s turn.`,
        characterId: character.id
    });

    if (character.team === 'enemy' || managedAutoCharacters.has(character.id)) {
        // Init AI turn
        // Small delay to allow visuals to catch up
        setTimeout(() => setAiState('thinking'), AI_THINKING_DELAY_MS[difficulty]);
    }
  }, [turnState.currentCharacterId, turnState.currentTurn, characters, startTurnFor, onLogEntry, managedAutoCharacters, difficulty]);

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
                  setTimeout(() => setAiState('thinking'), AI_THINKING_DELAY_MS[difficulty]);
              } else {
                  // Failed to execute (e.g. costs), just end
                  setAiState('done');
                  endTurn();
              }
          }
      };

      decideAction();

  }, [aiState, characters, mapData, getCurrentCharacter, aiActionsPerformed, endTurn, executeAction, difficulty]); // Including characters here ensures we see fresh state


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
    damageNumbers,
    animations
  };
};

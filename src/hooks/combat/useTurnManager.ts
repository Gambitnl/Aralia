/**
 * @file hooks/combat/useTurnManager.ts
 * Manages the turn-based combat state using the new action economy system.
 * Now integrates AI decision making, Damage Numbers, and Spell Effect Triggers.
 */
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { CombatCharacter, TurnState, CombatAction, CombatLogEntry, BattleMapData, DamageNumber, Animation, ReactiveTrigger } from '../../types/combat';
import { AI_THINKING_DELAY_MS } from '../../config/combatConfig';
import { createDamageNumber, generateId, getActionMessage, rollDice } from '../../utils/combatUtils';
import { resetEconomy } from '../../utils/combat/actionEconomyUtils';
import { useActionEconomy } from './useActionEconomy';
import { useCombatAI } from './useCombatAI';
import {
  ActiveSpellZone,
  MovementTriggerDebuff,
  processAreaEntryTriggers,
  processAreaExitTriggers,
  processAreaEndTurnTriggers,
  processMovementTriggers,
  resetZoneTurnTracking
} from '../../systems/spells/effects';
import { combatEvents } from '../../systems/events/CombatEvents';

interface UseTurnManagerProps {
  difficulty?: keyof typeof AI_THINKING_DELAY_MS;
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
  autoCharacters,
  difficulty = 'normal'
}: UseTurnManagerProps) => {
  // --- Core turn tracking (whose turn, which phase, order, and what they've done) ---
  const [turnState, setTurnState] = useState<TurnState>({
    currentTurn: 1,
    turnOrder: [],
    currentCharacterId: null,
    phase: 'planning',
    actionsThisTurn: []
  });

  // Damage/heal popups and lightweight FX to show the player what just happened.
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);
  const [animations, setAnimations] = useState<Animation[]>([]);

  // Spell trigger tracking: zones (Create Bonfire, etc.) and debuffs (Booming Blade, etc.)
  const [spellZones, setSpellZones] = useState<ActiveSpellZone[]>([]);
  const [movementDebuffs, setMovementDebuffs] = useState<MovementTriggerDebuff[]>([]);
  const [reactiveTriggers, setReactiveTriggers] = useState<ReactiveTrigger[]>([]);

  // Stabilize optional auto-controlled character set
  const defaultAutoControlledRef = useRef<Set<string> | undefined>(undefined);
  const managedAutoCharacters = useMemo(() => {
    if (autoCharacters) return autoCharacters;
    if (!defaultAutoControlledRef.current) {
      defaultAutoControlledRef.current = new Set<string>();
    }
    return defaultAutoControlledRef.current;
  }, [autoCharacters]);

  const { canAfford, consumeAction } = useActionEconomy();

  const lastTurnStartKey = useRef<string | null>(null);

  const addDamageNumber = useCallback((value: number, position: { x: number, y: number }, type: 'damage' | 'heal' | 'miss') => {
    const newDn: DamageNumber = createDamageNumber(value, position, type);
    setDamageNumbers(prev => [...prev, newDn]);
    setTimeout(() => {
      setDamageNumbers(prev => prev.filter(dn => dn.id !== newDn.id));
    }, newDn.duration);
  }, []);

  const rollInitiative = useCallback((character: CombatCharacter): number => {
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
    let updatedChar = resetEconomy(character);
    updatedChar = {
      ...updatedChar,
      statusEffects: character.statusEffects.map(effect => ({ ...effect, duration: effect.duration - 1 })).filter(effect => effect.duration > 0),
      abilities: character.abilities.map(ability => ({
        ...ability,
        currentCooldown: Math.max(0, (ability.currentCooldown || 0) - 1)
      })),
      concentratingOn: character.concentratingOn ? {
        ...character.concentratingOn,
        sustainedThisTurn: false
      } : undefined,
      riders: character.riders?.map(r => ({ ...r, usedThisTurn: false }))
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

    lastTurnStartKey.current = null;
  }, [onCharacterUpdate, onLogEntry, resetEconomy, rollInitiative]);

  const processEndOfTurnEffects = useCallback((character: CombatCharacter) => {
    let updatedCharacter = { ...character };

    // Resolve any lingering zone effects
    const zoneResults = processAreaEndTurnTriggers(spellZones, updatedCharacter, turnState.currentTurn);
    for (const result of zoneResults) {
      for (const effect of result.effects) {
        if (effect.type === 'damage' && effect.dice) {
          const damage = rollDice(effect.dice);
          updatedCharacter = { ...updatedCharacter, currentHP: Math.max(0, updatedCharacter.currentHP - damage) };
          addDamageNumber(damage, updatedCharacter.position, 'damage');
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'damage',
            message: `${character.name} takes ${damage} ${effect.damageType || ''} damage for ending turn in a hazard!`,
            characterId: character.id,
            data: { damage, damageType: effect.damageType, trigger: 'on_end_turn_in_area' }
          });
        }
      }
    }

    // Iterate statuses
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

    // Check Concentration Sustain
    if (updatedCharacter.concentratingOn?.sustainCost && !updatedCharacter.concentratingOn.sustainedThisTurn) {
      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'status',
        message: `${character.name} lost concentration on ${updatedCharacter.concentratingOn.spellName} (failed to sustain).`,
        characterId: character.id
      });
      updatedCharacter.concentratingOn = undefined;
    }

    onCharacterUpdate(updatedCharacter);
  }, [addDamageNumber, onCharacterUpdate, onLogEntry, spellZones, turnState.currentTurn]);

  const endTurn = useCallback(() => {
    const currentCharacter = characters.find(c => c.id === turnState.currentCharacterId);
    if (!currentCharacter) return;

    processEndOfTurnEffects(currentCharacter);

    const currentIndex = turnState.turnOrder.indexOf(turnState.currentCharacterId!);
    let nextIndex = (currentIndex + 1) % turnState.turnOrder.length;

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
      resetZoneTurnTracking(spellZones);
      setSpellZones(prev => prev.filter(z => !z.expiresAtRound || z.expiresAtRound > turnState.currentTurn + 1));
      setMovementDebuffs(prev => prev.filter(d => d.expiresAtRound > turnState.currentTurn + 1 && !d.hasTriggered));
      setReactiveTriggers(prev => prev.filter(t => !t.expiresAtRound || t.expiresAtRound > turnState.currentTurn + 1));

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

  }, [turnState, characters, processEndOfTurnEffects, onLogEntry, spellZones]);


  const executeAction = useCallback((action: CombatAction): boolean => {
    if (action.type === 'end_turn') {
      endTurn();
      return true;
    }

    const startCharacter = characters.find(c => c.id === action.characterId);
    if (!startCharacter) return false;

    if (!canAfford(startCharacter, action.cost)) {
      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'action',
        message: `${startCharacter.name} cannot perform this action (not enough resources or action already used).`,
        characterId: startCharacter.id
      });
      return false;
    }

    consumeAction(startCharacter, action.cost);
    let updatedCharacter = { ...startCharacter };

    if (action.type === 'sustain') {
      if (updatedCharacter.concentratingOn) {
        updatedCharacter.concentratingOn.sustainedThisTurn = true;

        combatEvents.emit({
          type: 'unit_sustain',
          casterId: updatedCharacter.id,
          spellId: updatedCharacter.concentratingOn.spellId,
          actionType: action.cost.type as any
        });

        onLogEntry({
          id: generateId(),
          timestamp: Date.now(),
          type: 'action',
          message: `${updatedCharacter.name} sustains ${updatedCharacter.concentratingOn.spellName}`,
          characterId: updatedCharacter.id,
          data: { actionType: action.cost.type }
        });

        const sustainTriggers = reactiveTriggers.filter(t =>
          t.casterId === updatedCharacter.id &&
          t.sourceEffect.trigger.type === 'on_caster_action'
        );

        for (const trigger of sustainTriggers) {
          const effect = trigger.sourceEffect;
          if (effect.type === 'DAMAGE' && effect.damage) {
            if (trigger.targetId) {
              const target = characters.find(c => c.id === trigger.targetId);
              if (target) {
                const damage = rollDice(effect.damage.dice);
                onLogEntry({
                  id: generateId(),
                  timestamp: Date.now(),
                  type: 'damage',
                  message: `${target.name} takes ${damage} damage from sustained spell!`,
                  characterId: target.id,
                  data: { damage, trigger: 'on_caster_action' }
                });
                const updatedTarget = { ...target, currentHP: Math.max(0, target.currentHP - damage) };
                onCharacterUpdate(updatedTarget);
                addDamageNumber(damage, target.position, 'damage');
              }
            }
          }
        }
      }
    }

    if (action.type === 'move' && action.targetPosition) {
      const previousPosition = updatedCharacter.position;
      updatedCharacter = { ...updatedCharacter, position: action.targetPosition };

      combatEvents.emit({
        type: 'unit_move',
        unitId: startCharacter.id,
        from: previousPosition,
        to: action.targetPosition,
        cost: (action.cost && 'movement' in action.cost) ? (action.cost as any).movement : 0,
        isForced: false
      });

      const moveTriggerResults = processMovementTriggers(movementDebuffs, updatedCharacter, turnState.currentTurn);

      for (const result of moveTriggerResults) {
        if (result.triggered) {
          setMovementDebuffs(prev => prev.map(d => d.id === result.sourceId ? { ...d, hasTriggered: true } : d));
          for (const effect of result.effects) {
            if (effect.type === 'damage' && effect.dice) {
              const damage = rollDice(effect.dice);
              updatedCharacter = { ...updatedCharacter, currentHP: Math.max(0, updatedCharacter.currentHP - damage) };
              addDamageNumber(damage, action.targetPosition, 'damage');
              onLogEntry({
                id: generateId(),
                timestamp: Date.now(),
                type: 'damage',
                message: `${updatedCharacter.name} takes ${damage} ${effect.damageType || ''} damage from moving!`,
                characterId: updatedCharacter.id,
                data: { damage, damageType: effect.damageType, trigger: 'on_target_move' }
              });
            }
          }
        }
      }

      const areaEntryResults = processAreaEntryTriggers(
        spellZones, updatedCharacter, action.targetPosition, previousPosition, turnState.currentTurn
      );
      for (const result of areaEntryResults) {
        for (const effect of result.effects) {
          if (effect.type === 'damage' && effect.dice) {
            const damage = rollDice(effect.dice);
            updatedCharacter = { ...updatedCharacter, currentHP: Math.max(0, updatedCharacter.currentHP - damage) };
            addDamageNumber(damage, action.targetPosition, 'damage');
            onLogEntry({
              id: generateId(),
              timestamp: Date.now(),
              type: 'damage',
              message: `${updatedCharacter.name} takes ${damage} ${effect.damageType || ''} damage from entering a spell zone!`,
              characterId: updatedCharacter.id,
              data: { damage, damageType: effect.damageType, trigger: 'on_enter_area' }
            });
          }
        }
      }

      const areaExitResults = processAreaExitTriggers(
        spellZones, updatedCharacter, action.targetPosition, previousPosition
      );
      for (const result of areaExitResults) {
        for (const effect of result.effects) {
          if (effect.type === 'damage' && effect.dice) {
            const damage = rollDice(effect.dice);
            updatedCharacter = { ...updatedCharacter, currentHP: Math.max(0, updatedCharacter.currentHP - damage) };
            addDamageNumber(damage, action.targetPosition, 'damage');
            onLogEntry({
              id: generateId(),
              timestamp: Date.now(),
              type: 'damage',
              message: `${updatedCharacter.name} takes ${damage} ${effect.damageType || ''} damage from leaving a spell zone!`,
              characterId: updatedCharacter.id,
              data: { damage, damageType: effect.damageType, trigger: 'on_exit_area' }
            });
          }
        }
      }
    }

    onCharacterUpdate(updatedCharacter);
    setTurnState(prev => ({ ...prev, actionsThisTurn: [...prev.actionsThisTurn, action] }));
    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'action',
      message: getActionMessage(action, updatedCharacter),
      characterId: updatedCharacter.id,
      data: action
    });

    if (action.type === 'ability' && action.abilityId) {
      const ability = characters.find(c => c.id === action.characterId)?.abilities.find(a => a.id === action.abilityId);

      combatEvents.emit({
        type: 'unit_cast',
        casterId: updatedCharacter.id,
        spellId: action.abilityId,
        targets: action.targetCharacterIds || []
      });

      if (ability && (ability.type === 'attack' || (ability.spell?.attackType && ability.spell.attackType !== 'none'))) {
        action.targetCharacterIds?.forEach(targetId => {
          combatEvents.emit({
            type: 'unit_attack',
            attackerId: updatedCharacter.id,
            targetId: targetId,
            isHit: true,
            isCrit: false
          });

          const triggers = reactiveTriggers.filter(t =>
            t.targetId === targetId &&
            t.sourceEffect.trigger.type === 'on_target_attack'
          );

          for (const trigger of triggers) {
            const effect = trigger.sourceEffect;
            if (effect.type === 'DAMAGE' && effect.damage) {
              const damage = rollDice(effect.damage.dice);
              onLogEntry({
                id: generateId(),
                timestamp: Date.now(),
                type: 'damage',
                message: `${updatedCharacter.name} takes ${damage} damage from reactive effect (on_target_attack)!`,
                characterId: updatedCharacter.id,
                data: { damage, trigger: 'on_target_attack' }
              });
              updatedCharacter.currentHP = Math.max(0, updatedCharacter.currentHP - damage);
              addDamageNumber(damage, updatedCharacter.position, 'damage');
            }

            const targetPositions = action.targetCharacterIds
              ?.map(id => characters.find(c => c.id === id)?.position)
              .filter(Boolean) as { x: number; y: number }[];

            queueAnimation({
              id: generateId(),
              type: 'spell_effect',
              characterId: action.characterId,
              startPosition: updatedCharacter.position,
              endPosition: action.targetPosition,
              duration: 650,
              startTime: Date.now(),
              data: { targetPositions: targetPositions?.length ? targetPositions : action.targetPosition ? [action.targetPosition] : [] },
            });
          }
        });
      }
    }

    return true;
  }, [characters, onCharacterUpdate, onLogEntry, canAfford, consumeAction, queueAnimation, addDamageNumber, movementDebuffs, spellZones, turnState.currentTurn, endTurn, reactiveTriggers]);

  const currentCharacter = useMemo(() => {
    return characters.find(c => c.id === turnState.currentCharacterId);
  }, [characters, turnState.currentCharacterId]);

  const getCurrentCharacter = useCallback(() => currentCharacter, [currentCharacter]);

  useEffect(() => {
    const activeId = turnState.currentCharacterId;
    if (!activeId) return;

    const turnStartKey = `${turnState.currentTurn}:${activeId}`;
    if (lastTurnStartKey.current === turnStartKey) {
      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'action',
        message: `[DEBUG] Turn start guard triggered for ${activeId} on turn ${turnState.currentTurn}.`,
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

  }, [turnState.currentCharacterId, turnState.currentTurn, characters, startTurnFor, onLogEntry]);

  useCombatAI({
    difficulty,
    characters,
    mapData,
    currentCharacterId: turnState.currentCharacterId,
    executeAction,
    endTurn,
    autoCharacters: managedAutoCharacters
  });

  const isCharacterTurn = useCallback((characterId: string) => {
    return turnState.currentCharacterId === characterId;
  }, [turnState.currentCharacterId]);

  const addSpellZone = useCallback((zone: ActiveSpellZone) => {
    setSpellZones(prev => [...prev, zone]);
  }, []);

  const addMovementDebuff = useCallback((debuff: MovementTriggerDebuff) => {
    setMovementDebuffs(prev => [...prev, debuff]);
  }, []);

  const addReactiveTrigger = useCallback((trigger: ReactiveTrigger) => {
    setReactiveTriggers(prev => [...prev, trigger]);
  }, []);

  const removeSpellZone = useCallback((zoneId: string) => {
    setSpellZones(prev => prev.filter(z => z.id !== zoneId));
  }, []);

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
    animations,
    addSpellZone,
    addMovementDebuff,
    removeSpellZone,
    addReactiveTrigger,
    setReactiveTriggers,
    spellZones,
    movementDebuffs,
    reactiveTriggers
  };
};

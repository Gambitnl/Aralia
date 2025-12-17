/**
 * @file hooks/combat/useTurnManager.ts
 * Manages the turn-based combat state using the new action economy system.
 * Now integrates AI decision making, Damage Numbers, and Spell Effect Triggers.
 * REFACTORED:
 * - Turn Order logic extracted to `useTurnOrder`.
 * - Combat Engine logic extracted to `useCombatEngine`.
 * - Remains the "Combat Coordinator" handling AI and orchestrating actions.
 */
import { useCallback, useMemo } from 'react';
import { CombatCharacter, CombatAction, CombatLogEntry, BattleMapData } from '../../types/combat';
import { AI_THINKING_DELAY_MS } from '../../config/combatConfig';
import { generateId, getActionMessage, rollDice } from '../../utils/combatUtils';
import { resetEconomy } from '../../utils/combat/actionEconomyUtils';
import { calculateSpellDC, rollSavingThrow } from '../../utils/savingThrowUtils';
import { useActionEconomy } from './useActionEconomy';
import { useCombatAI } from './useCombatAI';
import { useCombatVisuals } from './useCombatVisuals';
import { useTurnOrder } from './useTurnOrder';
import { useCombatEngine } from './engine/useCombatEngine'; // New dependency
import {
  processMovementTriggers,
} from '../../systems/spells/effects';
import { AreaEffectTracker } from '../../systems/spells/effects/AreaEffectTracker';
import { combatEvents } from '../../systems/events/CombatEvents';

interface UseTurnManagerProps {
  difficulty?: keyof typeof AI_THINKING_DELAY_MS;
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  onCharacterUpdate: (character: CombatCharacter) => void;
  onLogEntry: (entry: CombatLogEntry) => void;
  autoCharacters?: Set<string>;
  onMapUpdate?: (mapData: BattleMapData) => void;
}

export const useTurnManager = ({
  characters,
  mapData,
  onCharacterUpdate,
  onLogEntry,
  autoCharacters,
  onMapUpdate,
  difficulty = 'normal'
}: UseTurnManagerProps) => {

  // --- Decomposed Sub-Systems ---
  const {
    turnState,
    initializeTurnOrder,
    advanceTurn: advanceTurnOrder,
    joinTurnOrder,
    isCharacterTurn: checkIsCharacterTurn,
    setCurrentCharacter,
    recordAction
  } = useTurnOrder({ characters });

  const { damageNumbers, animations, addDamageNumber, queueAnimation } = useCombatVisuals();
  const { canAfford, consumeAction } = useActionEconomy();

  const {
    spellZones,
    movementDebuffs,
    reactiveTriggers,
    addSpellZone,
    removeSpellZone,
    addMovementDebuff,
    addReactiveTrigger,
    setReactiveTriggers,
    setMovementDebuffs,
    handleDamage,
    processRepeatSaves,
    processTileEffects,
    processEndOfTurnEffects,
    updateRoundBasedEffects
  } = useCombatEngine({
    characters,
    mapData,
    onCharacterUpdate,
    onLogEntry,
    onMapUpdate,
    addDamageNumber
  });

  // Stabilize optional auto-controlled character set
  const defaultAutoCharacters = useMemo(() => new Set<string>(), []);
  const managedAutoCharacters = autoCharacters ?? defaultAutoCharacters;

  // --- Initialization & Setup ---
  const rollInitiative = useCallback((character: CombatCharacter): number => {
    const dexModifier = Math.floor((character.stats.dexterity - 10) / 2);
    const roll = Math.floor(Math.random() * 20) + 1;
    return roll + dexModifier + character.stats.baseInitiative;
  }, []);

  const startTurnFor = useCallback((character: CombatCharacter) => {
    let updatedChar = resetEconomy(character);
    // TODO: Also tick down conditions/activeEffects here and clean up expired AC/resistance/tempHP effects so defensive math stays accurate.
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

    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'turn_start',
      message: `${character.name}'s turn.`,
      characterId: character.id
    });
  }, [onCharacterUpdate, resetEconomy, onLogEntry]);

  const initializeCombat = useCallback((initialCharacters: CombatCharacter[]) => {
    // 1. Roll initiatives
    const charactersWithInitiative = initialCharacters.map(char => ({
      ...char,
      initiative: rollInitiative(char)
    }));

    // 2. Delegate sorting to TurnOrder hook
    initializeTurnOrder(charactersWithInitiative);

    // 3. Reset economy for everyone
    charactersWithInitiative.forEach(char => {
      onCharacterUpdate(resetEconomy(char));
    });

    // 4. Start turn for the first character
    const sorted = [...charactersWithInitiative].sort((a, b) => b.initiative - a.initiative);
    const firstChar = sorted[0];

    if (firstChar) {
      startTurnFor(firstChar);
    }

    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'turn_start',
      message: `Combat begins! Turn order: ${sorted.map(c => c.name).join(' → ')}`,
      data: { turnOrder: sorted.map(c => c.id), initiatives: sorted.map(c => ({ id: c.id, initiative: c.initiative })) }
    });
  }, [onCharacterUpdate, onLogEntry, resetEconomy, rollInitiative, startTurnFor, initializeTurnOrder]);

  const joinCombat = useCallback((character: CombatCharacter, options: { initiative?: number } = {}) => {
    const initiative = options.initiative ?? rollInitiative(character);
    const charWithInit = { ...character, initiative };

    const readyChar = resetEconomy(charWithInit);
    onCharacterUpdate(readyChar);

    joinTurnOrder(readyChar.id);

    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'turn_start',
      message: `${readyChar.name} joins the combat! (Init: ${initiative})`,
      characterId: readyChar.id,
      data: { initiative }
    });

  }, [onCharacterUpdate, onLogEntry, resetEconomy, rollInitiative, joinTurnOrder]);


  // --- End of Turn Logic ---
  const endTurn = useCallback(() => {
    const currentCharacter = characters.find(c => c.id === turnState.currentCharacterId);
    if (!currentCharacter) return;

    // 1. Apply end-of-turn effects to the current character (Delegated to Engine)
    processEndOfTurnEffects(currentCharacter, turnState.currentTurn);

    // 2. Advance the turn order
    const { isNewRound, nextCharacterId } = advanceTurnOrder();

    // 3. Handle New Round Events
    if (isNewRound) {
      updateRoundBasedEffects(turnState.currentTurn);

      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'turn_start',
        message: `Round ${turnState.currentTurn + 1} begins!`,
        data: { round: turnState.currentTurn + 1 }
      });
    }

    // 4. Start turn for the next character
    if (nextCharacterId) {
      const nextCharacter = characters.find(c => c.id === nextCharacterId);
      if (nextCharacter) {
        startTurnFor(nextCharacter);
      }
    }

  }, [turnState, characters, processEndOfTurnEffects, onLogEntry, startTurnFor, advanceTurnOrder, updateRoundBasedEffects]);


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

    // TODO: consumeAction result is ignored; ensure resource deductions persist (use returned state or persisted mutation).
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

        // Trigger sustain effects (e.g., Witch Bolt damage)
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
                const updatedTarget = handleDamage(target, damage, 'sustained spell', effect.damage.type);
                onCharacterUpdate(updatedTarget);
              }
            }
          }
        }
      }
    }

    if (action.type === 'break_free' && action.targetEffectId) {
      updatedCharacter = processRepeatSaves(updatedCharacter, 'on_action', action.targetEffectId);
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

      updatedCharacter = processTileEffects(updatedCharacter, action.targetPosition);

      const moveTriggerResults = processMovementTriggers(movementDebuffs, updatedCharacter, turnState.currentTurn);

      for (const result of moveTriggerResults) {
        if (result.triggered) {
          setMovementDebuffs(prev => prev.map(d => d.id === result.sourceId ? { ...d, hasTriggered: true } : d));
          for (const effect of result.effects) {
            if (effect.type === 'damage' && effect.dice) {
              const damage = rollDice(effect.dice);
              updatedCharacter = handleDamage(updatedCharacter, damage, 'moving', effect.damageType);
            }
          }
        }
      }

      const tracker = new AreaEffectTracker(spellZones);
      const areaTriggerResults = tracker.handleMovement(
        updatedCharacter,
        action.targetPosition,
        previousPosition,
        turnState.currentTurn
      );

      for (const result of areaTriggerResults) {
        for (const effect of result.effects) {
          switch (effect.type) {
            case 'damage':
              if (effect.dice) {
                let damage = rollDice(effect.dice);
                let saveMessage = '';

                if (effect.requiresSave && effect.saveType) {
                  const caster = updatedCharacter.team === 'player' ? updatedCharacter : updatedCharacter;

                  const dc = calculateSpellDC(caster);
                  const saveResult = rollSavingThrow(updatedCharacter, effect.saveType, dc);

                  onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${updatedCharacter.name} ${saveResult.success ? 'succeeds' : 'fails'} ${effect.saveType} save (${saveResult.total} vs DC ${dc})`,
                    characterId: updatedCharacter.id
                  });

                  if (saveResult.success) {
                    damage = Math.floor(damage / 2);
                    saveMessage = ' (save)';
                  }
                }

                updatedCharacter = handleDamage(updatedCharacter, damage, `zone effect${saveMessage}`, effect.damageType);
              }
              break;

            case 'heal':
              if (effect.dice) {
                const healing = rollDice(effect.dice);
                const newHP = Math.min(updatedCharacter.maxHP, updatedCharacter.currentHP + healing);
                const actualHealing = newHP - updatedCharacter.currentHP;
                updatedCharacter = { ...updatedCharacter, currentHP: newHP };
                addDamageNumber(actualHealing, action.targetPosition, 'heal');
                onLogEntry({
                  id: generateId(),
                  timestamp: Date.now(),
                  type: 'heal',
                  message: `${updatedCharacter.name} heals ${actualHealing} HP from zone effect!`,
                  characterId: updatedCharacter.id,
                  data: { healing: actualHealing, trigger: result.triggerType || 'on_enter_area' }
                });
              }
              break;

            case 'status_condition':
              if (effect.statusName) {
                let appliedCondition = false;
                let saveMessage = '';

                if (effect.requiresSave && effect.saveType) {
                  const caster = updatedCharacter.team === 'player' ? updatedCharacter : updatedCharacter;

                  const dc = calculateSpellDC(caster);
                  const saveResult = rollSavingThrow(updatedCharacter, effect.saveType, dc);

                  onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${updatedCharacter.name} ${saveResult.success ? 'succeeds' : 'fails'} ${effect.saveType} save (${saveResult.total} vs DC ${dc})`,
                    characterId: updatedCharacter.id
                  });

                  if (!saveResult.success) {
                    appliedCondition = true;
                  } else {
                    saveMessage = ' (resisted)';
                  }
                } else {
                  appliedCondition = true;
                }

                if (appliedCondition) {
                  const durationRounds = 1;
                  const statusEffect = {
                    id: generateId(),
                    name: effect.statusName,
                    type: 'debuff' as const,
                    duration: durationRounds,
                    effect: { type: 'condition' as const },
                    icon: '💀'
                  };

                  const activeCondition = {
                    name: effect.statusName,
                    duration: { type: 'rounds' as const, value: durationRounds },
                    appliedTurn: turnState.currentTurn,
                    source: 'zone_effect'
                  };

                  updatedCharacter = {
                    ...updatedCharacter,
                    statusEffects: [...(updatedCharacter.statusEffects || []), statusEffect],
                    conditions: [...(updatedCharacter.conditions || []), activeCondition]
                  };

                  onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${updatedCharacter.name} is now ${effect.statusName} from zone effect!`,
                    characterId: updatedCharacter.id,
                    data: { statusId: statusEffect.id, condition: activeCondition, trigger: result.triggerType || 'on_enter_area' }
                  });
                } else {
                  onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${updatedCharacter.name} resists ${effect.statusName}${saveMessage}`,
                    characterId: updatedCharacter.id,
                    data: { trigger: result.triggerType || 'on_enter_area' }
                  });
                }
              }
              break;
          }
        }
      }
    }

    onCharacterUpdate(updatedCharacter);

    // Record action in turn history
    recordAction(action);

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
  }, [characters, onCharacterUpdate, onLogEntry, canAfford, consumeAction, queueAnimation, addDamageNumber, movementDebuffs, spellZones, turnState.currentTurn, endTurn, reactiveTriggers, handleDamage, processRepeatSaves, processTileEffects, recordAction, setMovementDebuffs]);

  const currentCharacter = useMemo(() => {
    return characters.find(c => c.id === turnState.currentCharacterId);
  }, [characters, turnState.currentCharacterId]);

  const getCurrentCharacter = useCallback(() => currentCharacter, [currentCharacter]);

  useCombatAI({
    difficulty,
    characters,
    mapData,
    currentCharacterId: turnState.currentCharacterId,
    executeAction,
    endTurn,
    autoCharacters: managedAutoCharacters
  });

  return {
    turnState,
    initializeCombat,
    joinCombat,
    executeAction,
    endTurn,
    getCurrentCharacter,
    isCharacterTurn: checkIsCharacterTurn,
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

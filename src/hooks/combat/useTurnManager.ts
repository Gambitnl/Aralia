/**
 * @file hooks/combat/useTurnManager.ts
 * Manages the turn-based combat state using the new action economy system.
 * Now integrates AI decision making, Damage Numbers, and Spell Effect Triggers.
 */
import { useState, useCallback, useMemo } from 'react';
import { CombatCharacter, TurnState, CombatAction, CombatLogEntry, BattleMapData, ReactiveTrigger, ActiveCondition, StatusEffect } from '../../types/combat';
import { AI_THINKING_DELAY_MS } from '../../config/combatConfig';
import { generateId, getActionMessage, rollDice } from '../../utils/combatUtils';
import { resetEconomy } from '../../utils/combat/actionEconomyUtils';
import { calculateSpellDC, rollSavingThrow } from '../../utils/savingThrowUtils';
import { SavePenaltySystem } from '../../systems/combat/SavePenaltySystem';
import { useActionEconomy } from './useActionEconomy';
import { useCombatAI } from './useCombatAI';
import { useCombatVisuals } from './useCombatVisuals';
import {
  ActiveSpellZone,
  MovementTriggerDebuff,
  processMovementTriggers,
  resetZoneTurnTracking
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
  // --- Core turn tracking (whose turn, which phase, order, and what they've done) ---
  const [turnState, setTurnState] = useState<TurnState>({
    currentTurn: 1,
    turnOrder: [],
    currentCharacterId: null,
    phase: 'planning',
    actionsThisTurn: []
  });

  // Use the new visual feedback hook
  const { damageNumbers, animations, addDamageNumber, queueAnimation } = useCombatVisuals();

  // Spell trigger tracking: zones (Create Bonfire, etc.) and debuffs (Booming Blade, etc.)
  const [spellZones, setSpellZones] = useState<ActiveSpellZone[]>([]);
  const [movementDebuffs, setMovementDebuffs] = useState<MovementTriggerDebuff[]>([]);
  const [reactiveTriggers, setReactiveTriggers] = useState<ReactiveTrigger[]>([]);

  // Stabilize optional auto-controlled character set so downstream deps don't churn; memoized empty set
  // avoids ref access during render while surviving strict-mode double renders.
  const defaultAutoCharacters = useMemo(() => new Set<string>(), []);
  const managedAutoCharacters = autoCharacters ?? defaultAutoCharacters;

  const { canAfford, consumeAction } = useActionEconomy();

  const processRepeatSaves = useCallback((character: CombatCharacter, timing: 'turn_end' | 'turn_start' | 'on_damage' | 'on_action', actionEffectId?: string): CombatCharacter => {
    let updatedCharacter = { ...character };
    let savedEffectIds: string[] = [];
    const savePenaltySystem = new SavePenaltySystem();

    updatedCharacter.statusEffects.forEach(effect => {
      const repeat = effect.repeatSave;
      if (!repeat) return;
      if (timing === 'on_action' && effect.id !== actionEffectId) return;
      if (repeat.timing !== timing) return;

      const dc = repeat.dc || 10;

      let hasAdvantage = false;
      let hasDisadvantage = false;

      if (repeat.modifiers?.advantageOnDamage && character.damagedThisTurn) {
        hasAdvantage = true;
      }
      if (repeat.modifiers?.sizeAdvantage && character.stats.size && repeat.modifiers.sizeAdvantage.includes(character.stats.size)) {
        hasAdvantage = true;
      }
      if (repeat.modifiers?.sizeDisadvantage && character.stats.size && repeat.modifiers.sizeDisadvantage.includes(character.stats.size)) {
        hasDisadvantage = true;
      }

      const saveType = repeat.saveType as any;
      const savePenalties = savePenaltySystem.getActivePenalties(character);
      const roll = rollSavingThrow(character, saveType, dc, savePenalties);

      let finalSuccess = roll.success;
      if (hasAdvantage) {
        const roll2 = rollSavingThrow(character, saveType, dc, savePenalties);
        finalSuccess = roll.success || roll2.success;
      } else if (hasDisadvantage) {
        const roll2 = rollSavingThrow(character, saveType, dc, savePenalties);
        finalSuccess = roll.success && roll2.success;
      }

      if (roll.modifiersApplied && roll.modifiersApplied.length > 0) {
        const penaltyDetails = roll.modifiersApplied.map(m => `${m.value} from ${m.source}`).join(', ');
        onLogEntry({
          id: generateId(),
          timestamp: Date.now(),
          type: 'status',
          message: `${character.name}'s save is modified: ${penaltyDetails}`,
          characterId: character.id
        });
      }

      if (finalSuccess) {
        onLogEntry({
          id: generateId(),
          timestamp: Date.now(),
          type: 'status',
          message: `${character.name} succeeds on repeat save against ${effect.name}!`,
          characterId: character.id
        });
        if (repeat.successEnds) {
          savedEffectIds.push(effect.id);
        }
      } else {
        onLogEntry({
          id: generateId(),
          timestamp: Date.now(),
          type: 'status',
          message: `${character.name} fails repeat save against ${effect.name}.`,
          characterId: character.id
        });
      }
    });

    if (savedEffectIds.length > 0) {
      updatedCharacter.statusEffects = updatedCharacter.statusEffects.filter(e => !savedEffectIds.includes(e.id));
    }

    if (updatedCharacter.savePenaltyRiders && updatedCharacter.savePenaltyRiders.length > 0) {
      updatedCharacter = {
        ...updatedCharacter,
        savePenaltyRiders: updatedCharacter.savePenaltyRiders.filter(r => r.applies !== 'next_save')
      };
    }

    return updatedCharacter;
  }, [onLogEntry]);

  const handleDamage = useCallback((character: CombatCharacter, amount: number, source: string, damageType?: string): CombatCharacter => {
    let updatedCharacter = { ...character };
    updatedCharacter.currentHP = Math.max(0, updatedCharacter.currentHP - amount);
    updatedCharacter.damagedThisTurn = true;

    addDamageNumber(amount, updatedCharacter.position, 'damage');

    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'damage',
      message: `${character.name} takes ${amount} ${damageType || ''} damage from ${source}`,
      characterId: character.id,
      data: { damage: amount, damageType, source }
    });

    updatedCharacter = processRepeatSaves(updatedCharacter, 'on_damage');

    return updatedCharacter;
  }, [addDamageNumber, onLogEntry, processRepeatSaves]);

  const processTileEffects = useCallback((character: CombatCharacter, tilePos: { x: number, y: number }): CombatCharacter => {
    if (!mapData) return character;

    const tileKey = `${tilePos.x}-${tilePos.y}`;
    const tile = mapData.tiles.get(tileKey);
    if (!tile || !tile.environmentalEffect) return character;

    let updatedChar = { ...character };
    const env = tile.environmentalEffect;

    if (env.effect.effect.type === 'damage_per_turn') {
        const damage = env.effect.effect.value || 0;
        if (damage > 0) {
            updatedChar = handleDamage(updatedChar, damage, env.effect.name, env.type === 'fire' ? 'fire' : 'physical');
        } else {
             onLogEntry({
                id: generateId(),
                timestamp: Date.now(),
                type: 'status',
                message: `${character.name} enters ${env.effect.name}.`,
                characterId: character.id
            });
        }
    } else if (env.effect.effect.type === 'condition') {
        const hasCondition = updatedChar.statusEffects.some(s => s.name === env.effect.name);
        if (!hasCondition) {
            updatedChar.statusEffects = [...updatedChar.statusEffects, {
                ...env.effect,
                id: generateId(),
                duration: 1
            }];
             onLogEntry({
                id: generateId(),
                timestamp: Date.now(),
                type: 'status',
                message: `${character.name} is affected by ${env.effect.name}.`,
                characterId: character.id
            });
        }
    }

    return updatedChar;
  }, [mapData, handleDamage, onLogEntry]);

  const rollInitiative = useCallback((character: CombatCharacter): number => {
    const dexModifier = Math.floor((character.stats.dexterity - 10) / 2);
    const roll = Math.floor(Math.random() * 20) + 1;
    return roll + dexModifier + character.stats.baseInitiative;
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

    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'turn_start',
      message: `${character.name}'s turn.`,
      characterId: character.id
    });
  }, [onCharacterUpdate, resetEconomy, onLogEntry]);

  const initializeCombat = useCallback((initialCharacters: CombatCharacter[]) => {
    const charactersWithInitiative = initialCharacters.map(char => ({
      ...char,
      initiative: rollInitiative(char)
    }));

    const turnOrder = charactersWithInitiative
      .sort((a, b) => b.initiative - a.initiative)
      .map(char => char.id);

    // Reset economy for everyone
    charactersWithInitiative.forEach(char => {
      onCharacterUpdate(resetEconomy(char));
    });

    // Start turn for the first character immediately
    const firstCharId = turnOrder[0];
    if (firstCharId) {
      const firstChar = charactersWithInitiative.find(c => c.id === firstCharId);
      if (firstChar) {
        startTurnFor(firstChar);
      }
    }

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
  }, [onCharacterUpdate, onLogEntry, resetEconomy, rollInitiative, startTurnFor]);

  const joinCombat = useCallback((character: CombatCharacter, options: { initiative?: number } = {}) => {
    const initiative = options.initiative ?? rollInitiative(character);
    const charWithInit = { ...character, initiative };

    const readyChar = resetEconomy(charWithInit);
    onCharacterUpdate(readyChar);

    setTurnState(prev => {
      const newOrder = [...prev.turnOrder];
      if (!newOrder.includes(readyChar.id)) {
        newOrder.push(readyChar.id);
      }
      return {
        ...prev,
        turnOrder: newOrder
      };
    });

    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'turn_start',
      message: `${readyChar.name} joins the combat! (Init: ${initiative})`,
      characterId: readyChar.id,
      data: { initiative }
    });

  }, [onCharacterUpdate, onLogEntry, resetEconomy, rollInitiative]);

  const processEndOfTurnEffects = useCallback((character: CombatCharacter) => {
    let updatedCharacter = { ...character };

    updatedCharacter = processTileEffects(updatedCharacter, updatedCharacter.position);

    const tracker = new AreaEffectTracker(spellZones);
    const zoneResults = tracker.processEndTurn(updatedCharacter, turnState.currentTurn);
    for (const result of zoneResults) {
      for (const effect of result.effects) {
        if (effect.type === 'damage' && effect.dice) {
          // TODO: Apply the same save/saveEffect handling used for movement-triggered hazards before end-of-turn damage is applied.
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

    updatedCharacter.statusEffects.forEach(effect => {
      switch (effect.effect.type) {
        case 'damage_per_turn':
          const dmg = effect.effect.value || 0;
          updatedCharacter = handleDamage(updatedCharacter, dmg, effect.name, 'necrotic');
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

    updatedCharacter = processRepeatSaves(updatedCharacter, 'turn_end');

    updatedCharacter.damagedThisTurn = false;

    onCharacterUpdate(updatedCharacter);
  }, [addDamageNumber, onCharacterUpdate, onLogEntry, spellZones, turnState.currentTurn, handleDamage, processRepeatSaves]);

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

    // TODO: startTurnFor also runs in the turn-start effect; avoid double-resetting economy/status when advancing turns.
    // Trigger start turn logic for the next character
    const nextCharacter = characters.find(c => c.id === nextCharacterId);
    if (nextCharacter) {
      // NOTE: We use startTurnFor to handle resource reset and duration ticks.
      // This explicitly replaces the old useEffect behavior.
      startTurnFor(nextCharacter);
    }

    if (isNewRound) {
      resetZoneTurnTracking(spellZones);
      setSpellZones(prev => prev.filter(z => !z.expiresAtRound || z.expiresAtRound > turnState.currentTurn + 1));
      setMovementDebuffs(prev => prev.filter(d => d.expiresAtRound > turnState.currentTurn + 1 && !d.hasTriggered));
      setReactiveTriggers(prev => prev.filter(t => !t.expiresAtRound || t.expiresAtRound > turnState.currentTurn + 1));

      if (mapData && onMapUpdate) {
        let mapModified = false;
        const newTiles = new Map(mapData.tiles);

        for (const [key, tile] of newTiles) {
            if (tile.environmentalEffect) {
                const newDuration = tile.environmentalEffect.duration - 1;

                if (newDuration <= 0) {
                    const newTile = { ...tile };
                    newTile.environmentalEffect = undefined;
                    if (tile.environmentalEffect.type === 'difficult_terrain') {
                        if (newTile.terrain === 'difficult') {
                            newTile.movementCost = 2;
                        } else {
                            newTile.movementCost = 1;
                        }
                    }
                    newTiles.set(key, newTile);
                    mapModified = true;
                } else {
                    const newTile = { ...tile };
                    newTile.environmentalEffect = {
                        ...tile.environmentalEffect,
                        duration: newDuration
                    };
                    newTiles.set(key, newTile);
                    mapModified = true;
                }
            }
        }

        if (mapModified) {
            onMapUpdate({
                ...mapData,
                tiles: newTiles
            });
             onLogEntry({
                id: generateId(),
                timestamp: Date.now(),
                type: 'status',
                message: `Environmental effects updated for Round ${turnState.currentTurn + 1}.`,
            });
        }
      }

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

  }, [turnState, characters, processEndOfTurnEffects, onLogEntry, spellZones, mapData, onMapUpdate, startTurnFor]);


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
                  // TODO: Use the originating caster/spell DC (from the zone or effect) instead of the moving unit as the caster when rolling zone saves.
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
                    // TODO: Respect effect.condition.saveEffect (none/half/negates) instead of always halving on success.
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
  }, [characters, onCharacterUpdate, onLogEntry, canAfford, consumeAction, queueAnimation, addDamageNumber, movementDebuffs, spellZones, turnState.currentTurn, endTurn, reactiveTriggers, handleDamage, processRepeatSaves]);

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
    joinCombat,
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

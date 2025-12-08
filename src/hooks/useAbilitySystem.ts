/**
 * @file hooks/useAbilitySystem.ts
 * Manages ability selection, targeting, and execution logic for combat.
 * REFACTORED:
 * - UI/Selection state now delegated to `useTargeting`.
 * - Geometric logic delegated to `targetingUtils`.
 * - Remains the "Orchestrator" connecting UI events to Action execution.
 */
import { useCallback } from 'react';
import {
  CombatCharacter,
  Ability,
  Position,
  CombatAction,
  BattleMapData,
  CombatState,
  CombatLogEntry
} from '../types/combat';
import { Spell } from '../types/spells'; // Import Spell type
import { SpellCommandFactory, CommandExecutor } from '../commands'; // Import Command System
import { BreakConcentrationCommand } from '../commands/effects/ConcentrationCommands'; // Import Break Concentration
import { getDistance, calculateDamage, generateId, rollDice } from '../utils/combatUtils';
import { hasLineOfSight } from '../utils/lineOfSight';
import { calculateAffectedTiles } from '../utils/aoeCalculations';
import { useTargeting } from './combat/useTargeting'; // New Hook
import { resolveAoEParams } from '../utils/targetingUtils';
import { AttackRiderSystem, AttackContext } from '../systems/combat/AttackRiderSystem';
import { isDamageEffect, isStatusConditionEffect, isMovementEffect, isUtilityEffect } from '../types/spells'; // New Utils

interface UseAbilitySystemProps {
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  onExecuteAction: (action: CombatAction) => boolean;
  onCharacterUpdate: (character: CombatCharacter) => void;
  onAbilityEffect?: (value: number, position: Position, type: 'damage' | 'heal' | 'miss') => void;
  onLogEntry?: (entry: CombatLogEntry) => void;
  onRequestInput?: (spell: Spell, onConfirm: (input: string) => void) => void;
  reactiveTriggers?: any[]; // TODO: Import ReactiveTrigger
  onReactiveTriggerUpdate?: (triggers: any[]) => void;
}

export const useAbilitySystem = ({
  characters,
  mapData,
  onExecuteAction,
  onCharacterUpdate,
  onAbilityEffect,
  onLogEntry,
  onRequestInput,
  reactiveTriggers,
  onReactiveTriggerUpdate
}: UseAbilitySystemProps) => {

  // Delegate Selection/Targeting State to specialized hook
  const {
    selectedAbility,
    targetingMode,
    aoePreview,
    startTargeting: baseStartTargeting,
    cancelTargeting,
    previewAoE
  } = useTargeting({ mapData, characters });

  // --- Command Pattern Execution Logic ---
  const executeSpell = useCallback(async (
    spell: Spell,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    castAtLevel: number,
    playerInput?: string
  ) => {
    // 0. Check for AI Input Requirements
    if (spell.arbitrationType === 'ai_dm' && spell.aiContext?.playerInputRequired && !playerInput) {
      if (onRequestInput) {
        onRequestInput(spell, (input) => {
          // Re-trigger execution with the collected input
          executeSpell(spell, caster, targets, castAtLevel, input);
        });
        return; // Halt execution until input is provided
      } else {
        console.warn("Spell requires input but no onRequestInput handler provided.");
      }
    }

    // 1. Construct temporary CombatState
    const currentState: CombatState = {
      isActive: true,
      characters: characters,
      turnState: {} as any, // Mock, commands usually don't read this
      selectedCharacterId: null,
      selectedAbilityId: null,
      actionMode: 'select',
      validTargets: [],
      validMoves: [],
      combatLog: [], // Start empty to capture new entries
      reactiveTriggers: reactiveTriggers || [] // Pass current triggers
    };

    const mockGameState: any = {
      // Add necessary GameState fields if factory needs them
    };

    // Asynchronously generate the chain of effect commands
    const commands = await SpellCommandFactory.createCommands(
      spell,
      caster,
      targets,
      castAtLevel,
      mockGameState,
      playerInput
    );

    // 3. Execute
    const result = CommandExecutor.execute(commands, currentState);

    if (result.success) {
      // 4. Propagate State Changes
      result.finalState.characters.forEach(finalChar => {
        const isTarget = targets.some(t => t.id === finalChar.id);
        const isCaster = caster.id === finalChar.id;

        if (isTarget || isCaster) {
          onCharacterUpdate(finalChar);
        }
      });

      // 5. Propagate Log Entries
      if (onLogEntry) {
        result.finalState.combatLog.forEach(entry => onLogEntry(entry));
      }

      // 6. Propagate Reactive Triggers
      if (onReactiveTriggerUpdate && result.finalState.reactiveTriggers !== currentState.reactiveTriggers) {
        onReactiveTriggerUpdate(result.finalState.reactiveTriggers);
      }

    } else {
      console.error("Spell execution failed:", result.error);
    }
  }, [characters, onCharacterUpdate, onLogEntry, onRequestInput, reactiveTriggers, onReactiveTriggerUpdate]);


  // Helper: Find character at exact grid position
  const getCharacterAtPosition = useCallback((position: Position): CombatCharacter | null => {
    return characters.find(char =>
      char.position.x === position.x && char.position.y === position.y
    ) || null;
  }, [characters]);


  /**
   * Validates if a target position is legal for the given ability.
   */
  const isValidTarget = useCallback((
    ability: Ability,
    caster: CombatCharacter,
    targetPosition: Position
  ): boolean => {
    if (!mapData) return false;

    // 1. Tile Existence Check
    const startTile = mapData.tiles.get(`${caster.position.x}-${caster.position.y}`);
    const endTile = mapData.tiles.get(`${targetPosition.x}-${targetPosition.y}`);
    if (!startTile || !endTile) return false;

    // 2. Range Check
    const distance = getDistance(caster.position, targetPosition);
    if (distance > ability.range) return false;

    // 3. Line of Sight Check
    if (ability.type === 'attack' || ability.type === 'spell') {
      if (!hasLineOfSight(startTile, endTile, mapData)) {
        return false;
      }
    }

    const targetCharacter = getCharacterAtPosition(targetPosition);

    // 4. Logic by Targeting Type
    switch (ability.targeting) {
      case 'single_enemy':
        return !!targetCharacter && targetCharacter.team !== caster.team;
      case 'single_ally':
        return !!targetCharacter && targetCharacter.team === caster.team && targetCharacter.id !== caster.id;
      case 'single_any':
        return !!targetCharacter;
      case 'self':
        return targetPosition.x === caster.position.x && targetPosition.y === caster.position.y;
      case 'area':
        return true;
      default:
        return false;
    }
  }, [mapData, getCharacterAtPosition]);


  /**
   * Generates a list of all valid target positions on the map.
   */
  const getValidTargets = useCallback((
    ability: Ability,
    caster: CombatCharacter
  ): Position[] => {
    if (!mapData) return [];
    const validPositions: Position[] = [];

    for (let x = 0; x < mapData.dimensions.width; x++) {
      for (let y = 0; y < mapData.dimensions.height; y++) {
        const position = { x, y };
        if (isValidTarget(ability, caster, position)) {
          validPositions.push(position);
        }
      }
    }
    return validPositions;
  }, [mapData, isValidTarget]);


  /**
   * Legacy effect application (Direct Mutation).
   * Used for non-spell abilities until fully migrated to Command Pattern.
   */
  const applyAbilityEffects = useCallback((
    ability: Ability,
    caster: CombatCharacter,
    target: CombatCharacter
  ) => {
    // Clone once so we can safely layer mutations.
    let modifiedTarget = { ...target, statusEffects: [...target.statusEffects] };

    ability.effects.forEach(effect => {
      switch (effect.type) {
        case 'damage': {
          const damage = calculateDamage(effect.value || 0, caster, target);
          modifiedTarget.currentHP = Math.max(0, modifiedTarget.currentHP - damage);
          if (onAbilityEffect) onAbilityEffect(damage, target.position, 'damage');
          break;
        }
        case 'heal': {
          const healAmount = effect.value || 0;
          modifiedTarget.currentHP = Math.min(modifiedTarget.maxHP, modifiedTarget.currentHP + healAmount);
          if (onAbilityEffect) onAbilityEffect(healAmount, target.position, 'heal');
          break;
        }
        case 'status': {
          const statusEffect = effect.statusEffect;
          if (statusEffect) {
            const effectDuration = effect.duration ?? statusEffect.duration ?? 1;
            modifiedTarget.statusEffects.push({
              ...statusEffect,
              duration: effectDuration,
              id: statusEffect.id || generateId(),
            });
          }
          break;
        }
      }
    });


    // --- Rider System Integration ---
    if (ability.type === 'attack') {
      const riderSystem = new AttackRiderSystem();

      const tempState: CombatState = {
        isActive: true,
        characters: characters,
        turnState: {} as any,
        selectedCharacterId: null,
        selectedAbilityId: null,
        actionMode: 'select',
        validTargets: [],
        validMoves: [],
        combatLog: [],
        reactiveTriggers: []
      };

      const weaponType = ability.range <= 2 ? 'melee' : 'ranged';

      const context: AttackContext = {
        attackerId: caster.id,
        targetId: target.id,
        attackType: 'weapon',
        weaponType: weaponType,
        isHit: true
      };

      const matchingRiders = riderSystem.getMatchingRiders(tempState, context);

      if (matchingRiders.length > 0) {
        matchingRiders.forEach(rider => {
          // Apply Rider Effect
          if (isDamageEffect(rider.effect)) {
            const rolledDamage = rollDice(rider.effect.damage.dice || '0');
            const damage = calculateDamage(rolledDamage, caster, target);

            modifiedTarget.currentHP = Math.max(0, modifiedTarget.currentHP - damage);

            if (onAbilityEffect) onAbilityEffect(damage, target.position, 'damage');
            if (onLogEntry) {
              onLogEntry({
                id: generateId(),
                timestamp: Date.now(),
                type: 'damage',
                message: `${caster.name}'s ${rider.sourceName} deals ${damage} additional ${rider.effect.damage.type} damage.`,
                characterId: caster.id,
                targetIds: [target.id],
                data: { value: damage, type: rider.effect.damage.type }
              });
            }
          } else if (isStatusConditionEffect(rider.effect)) {
            const statusData = rider.effect.statusCondition;

            if (statusData) {
              let duration = 1;
              const effectDuration = statusData.duration;
              if (effectDuration.type === 'minutes') duration = (effectDuration.value || 1) * 10;
              if (effectDuration.type === 'rounds') duration = effectDuration.value || 1;

              modifiedTarget.statusEffects.push({
                id: generateId(),
                name: statusData.name,
                type: 'debuff',
                duration: duration,
                effect: { type: 'condition', value: 0 }
              });

              if (onLogEntry) {
                onLogEntry({
                  id: generateId(),
                  timestamp: Date.now(),
                  type: 'status',
                  message: `${target.name} is affected by ${statusData.name}`,
                  characterId: target.id,
                  targetIds: [target.id]
                });
              }

              // Handle Consumption
              const stateAfterConsumption = riderSystem.consumeRiders(tempState, caster.id, matchingRiders);
              const updatedCaster = stateAfterConsumption.characters.find(c => c.id === caster.id);

              if (updatedCaster) {
                onCharacterUpdate(updatedCaster);
              }
            }
          }
        });
      }
    }

    onCharacterUpdate(modifiedTarget);
  }, [onCharacterUpdate, onAbilityEffect, characters, onLogEntry]);


  /**
   * Main entry point to execute an ability (Legacy/Hybrid).
   * Bridges simple abilities to Action System and Spells to Command System.
   */
  const executeAbility = useCallback((
    ability: Ability,
    caster: CombatCharacter,
    targetPosition: Position,
    targetCharacterIds: string[]
  ) => {

    // --- Path A: Spell System (Command Pattern) ---
    if (ability.spell) {
      const targets = targetCharacterIds
        .map(id => characters.find(c => c.id === id))
        .filter((c): c is CombatCharacter => !!c);

      executeSpell(ability.spell, caster, targets, ability.spell.level);
      cancelTargeting();
      return;
    }

    // --- Path B: Legacy Ability System (Action Object) ---
    const action: CombatAction = {
      id: generateId(),
      characterId: caster.id,
      type: 'ability',
      abilityId: ability.id,
      targetPosition,
      targetCharacterIds,
      cost: ability.cost,
      timestamp: Date.now()
    };

    // Verify economy costs (Action Points)
    const success = onExecuteAction(action);

    if (success) {
      // Apply effects immediately (Synchronous)
      targetCharacterIds.forEach(targetId => {
        const target = characters.find(c => c.id === targetId);
        if (target) {
          applyAbilityEffects(ability, caster, target);
        }
      });

      // Handle Cooldowns
      if (ability.cooldown) {
        const updatedCaster = {
          ...caster,
          abilities: caster.abilities.map(a =>
            a.id === ability.id ? { ...a, currentCooldown: ability.cooldown } : a
          )
        };
        onCharacterUpdate(updatedCaster);
      }
    }

    cancelTargeting();
  }, [onExecuteAction, characters, applyAbilityEffects, onCharacterUpdate, cancelTargeting, executeSpell]);


  /**
   * Initiates the targeting flow.
   * If 'self' targeting, executes immediately.
   */
  const startTargeting = useCallback((ability: Ability, caster: CombatCharacter) => {
    baseStartTargeting(ability);

    // Auto-cast for Self abilities
    if (ability.targeting === 'self') {
      executeAbility(ability, caster, caster.position, [caster.id]);
      return;
    }
  }, [executeAbility, baseStartTargeting]);


  /**
   * Confirms selection of a target tile.
   * Resolves AoE targets if applicable, then executes.
   */
  const selectTarget = useCallback((targetPosition: Position, caster: CombatCharacter) => {
    if (!selectedAbility) return;

    let targetCharacterIds: string[] = [];

    if (selectedAbility.areaOfEffect) {
      // Use Utils to resolve full affected area
      const params = resolveAoEParams(selectedAbility.areaOfEffect, targetPosition, caster);
      if (params) {
        const affectedTiles = calculateAffectedTiles(params);

        targetCharacterIds = characters
          .filter(char => affectedTiles.some(tile =>
            tile.x === char.position.x && tile.y === char.position.y
          ))
          .map(char => char.id);
      }
    } else {
      // Single Target
      const targetCharacter = getCharacterAtPosition(targetPosition);
      if (targetCharacter) {
        targetCharacterIds = [targetCharacter.id];
      }
    }

    executeAbility(selectedAbility, caster, targetPosition, targetCharacterIds);
  }, [selectedAbility, characters, getCharacterAtPosition, executeAbility]);


  /**
   * Allows a character to voluntarily stop concentrating on a spell.
   * Uses Command Pattern to ensure proper cleanup/logging.
   */
  const dropConcentration = useCallback((character: CombatCharacter) => {
    if (!character.concentratingOn) return;

    const currentState: CombatState = {
      isActive: true,
      characters: characters,
      turnState: {} as any,
      selectedCharacterId: null,
      selectedAbilityId: null,
      actionMode: 'select',
      validTargets: [],
      validMoves: [],
      combatLog: [],
      reactiveTriggers: reactiveTriggers || []
    };

    // Create Command manually (no Factory needed for simple drop)
    const command = new BreakConcentrationCommand({
      spellId: character.concentratingOn.spellId,
      spellName: character.concentratingOn.spellName,
      caster: character,
      targets: [],
      castAtLevel: character.concentratingOn.spellLevel,
      gameState: {} as any,
    });

    const result = CommandExecutor.execute([command], currentState);

    if (result.success) {
      result.finalState.characters.forEach(finalChar => {
        if (finalChar.id === character.id) {
          onCharacterUpdate(finalChar);
        }
      });
      if (onLogEntry) {
        result.finalState.combatLog.forEach(entry => onLogEntry(entry));
      }
    }
  }, [characters, onCharacterUpdate, onLogEntry]);


  // Expose API
  return {
    selectedAbility,
    targetingMode,
    aoePreview,
    getValidTargets,
    startTargeting,
    selectTarget,
    cancelTargeting,
    previewAoE,
    isValidTarget,
    executeSpell,
    dropConcentration,
  };
};

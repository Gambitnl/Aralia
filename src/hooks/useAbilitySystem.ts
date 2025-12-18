/**
 * @file hooks/useAbilitySystem.ts
 * Manages ability selection, targeting, and execution logic for combat.
 * REFACTORED:
 * - UI/Selection state now delegated to `useTargeting`.
 * - Geometric logic delegated to `targetingUtils`.
 * - Remains the "Orchestrator" connecting UI events to Action execution.
 */
import { useCallback, useState } from 'react';
import {
  CombatCharacter,
  Ability,
  Position,
  CombatAction,
  BattleMapData,
  CombatState,
  CombatLogEntry,
  ReactiveTrigger
} from '../types/combat';
import {
  Spell,
  isDamageEffect,
  isStatusConditionEffect,
  isMovementEffect,
  isUtilityEffect,
  isDefensiveEffect
} from '../types/spells';
import { SpellCommandFactory, CommandExecutor } from '../commands'; // Import Command System
import { BreakConcentrationCommand } from '../commands/effects/ConcentrationCommands'; // Import Break Concentration
import { getDistance, calculateDamage, generateId, rollDice, rollDamage } from '../utils/combatUtils';
import { hasLineOfSight } from '../utils/lineOfSight';
import { calculateAffectedTiles } from '../utils/aoeCalculations';
import { useTargeting } from './combat/useTargeting'; // New Hook
import { resolveAoEParams } from '../utils/targetingUtils';
import { AttackRiderSystem, AttackContext } from '../systems/combat/AttackRiderSystem';

interface UseAbilitySystemProps {
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  onExecuteAction: (action: CombatAction) => boolean;
  onCharacterUpdate: (character: CombatCharacter) => void;
  onAbilityEffect?: (value: number, position: Position, type: 'damage' | 'heal' | 'miss') => void;
  onLogEntry?: (entry: CombatLogEntry) => void;
  onRequestInput?: (spell: Spell, onConfirm: (input: string) => void) => void;
  reactiveTriggers?: ReactiveTrigger[];
  onReactiveTriggerUpdate?: (triggers: ReactiveTrigger[]) => void;
  onMapUpdate?: (mapData: BattleMapData) => void;
}

export interface PendingReaction {
  attackerId: string;
  targetId: string;
  triggerType: 'on_hit' | 'on_cast' | 'on_move';
  reactionSpells: Spell[]; // Spells available to cast
  onResolve: (usedSpellId: string | null) => void;
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
  onReactiveTriggerUpdate,
  onMapUpdate
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

  const [pendingReaction, setPendingReaction] = useState<PendingReaction | null>(null);

  // --- Command Pattern Execution Logic ---
  // TODO(Ritualist): Integrate RitualManager here to handle ritual casting (10+ min duration) instead of immediate execution.
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
      reactiveTriggers: reactiveTriggers || [], // Pass current triggers
      activeLightSources: []
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

      // 7. Propagate Map Changes
      if (onMapUpdate && result.finalState.mapData) {
        // Simple check if mapData was modified. In TerrainCommand, we clone mapData if we modify it.
        // If the reference changed, we update.
        if (result.finalState.mapData !== mapData) {
          onMapUpdate(result.finalState.mapData);
        }
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
    // TODO: cache valid targets per ability + map snapshot; full grid scan each click is expensive on large maps.
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
    target: CombatCharacter,
    isCritical: boolean = false
  ) => {
    // Clone once so we can safely layer mutations.
    let modifiedTarget = { ...target, statusEffects: [...target.statusEffects] };

    ability.effects.forEach(effect => {
      switch (effect.type) {
        case 'damage': {
          let rolledValue = effect.value || 0;

          if (effect.dice) {
            rolledValue = rollDamage(effect.dice, isCritical);
          } else if (rolledValue === 0 && ability.weapon) {
             // Fallback if dice string missing but weapon present (legacy support)
             // Though creating ability should have populated dice now.
          }

          const damage = calculateDamage(rolledValue, caster, target);
          modifiedTarget.currentHP = Math.max(0, modifiedTarget.currentHP - damage);
          if (onAbilityEffect) onAbilityEffect(damage, target.position, 'damage');
          break;
        }
        case 'heal': {
          let healAmount = effect.value || 0;
          if (effect.dice) {
             healAmount = rollDamage(effect.dice, false);
          }

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
      // TODO: reuse/memoize AttackRiderSystem per combat; constructing per hit recomputes rider rules unnecessarily.
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
        reactiveTriggers: [],
        activeLightSources: []
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





  // Refactored async wrapper for executeAbility to support internal await
  const executeAbilityInternal = useCallback(async (
    ability: Ability,
    caster: CombatCharacter,
    targetPosition: Position,
    targetCharacterIds: string[]
  ) => {

    // --- Path A: Spell System (Command Pattern) ---
    if (ability.spell) {
      // Validate Spell Integrity
      if (!ability.spell.id || ability.spell.level === undefined || !ability.spell.effects) {
        console.error("Invalid spell data: Missing required fields (id, level, or effects)", ability.spell);
        cancelTargeting();
        return;
      }

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
      // Loop through targets sequentially to allow for individual reactions
      for (const targetId of targetCharacterIds) {
        const target = characters.find(c => c.id === targetId);
        if (!target) continue;

        if (ability.type === 'attack') {
          // Task 09: Attack Roll Implementation

          // Check for Disadvantage from target's active effects (e.g., Protection from Evil and Good)
          const hasDisadvantage = target.activeEffects?.some(e =>
            e.type === 'disadvantage_on_attacks' &&
            SpellCommandFactory.matchesFilter(caster, e.attackerFilter)
          );

          let d20 = rollDice('1d20');
          if (hasDisadvantage) {
            const d20_second = rollDice('1d20');
            d20 = Math.min(d20, d20_second);
            if (onLogEntry) {
              onLogEntry({
                id: generateId(),
                timestamp: Date.now(),
                type: 'status',
                message: `Attack has Disadvantage! (Rolled ${d20})`,
                characterId: caster.id,
                targetIds: [targetId]
              });
            }
          }

          const strMod = Math.floor((caster.stats.strength - 10) / 2);
          const dexMod = Math.floor((caster.stats.dexterity - 10) / 2);

          const isRanged = ability.range > 1 || ability.weapon?.properties?.includes('range');
          const abilityMod = isRanged ? dexMod : strMod;

          let proficiencyBonus = 0;
          if (ability.weapon) {
            const pb = Math.ceil((caster.level || 1) / 4) + 1;
            proficiencyBonus = ability.isProficient ? pb : 0;
            const initialAttackRoll = d20 + abilityMod + proficiencyBonus;
            const initialAC = target.armorClass || 10;
            const initialIsHit = initialAttackRoll >= initialAC;

            if (onLogEntry) {
              onLogEntry({
                id: generateId(),
                timestamp: Date.now(),
                type: 'action',
                message: `${caster.name} attacks ${target.name} (Roll: ${d20} + ${abilityMod} + ${proficiencyBonus} = ${initialAttackRoll})`,
                characterId: caster.id,
                targetIds: [targetId]
              });
            }

            let finalAC = initialAC;
            let finalIsHit = initialIsHit;

            // --- REACTION CHECK ---
            if (initialIsHit) {
              // Check for available reactions (e.g., Shield)
              const hasReactionResource = (target.actionEconomy?.reaction?.remaining ?? 0) > 0;

              // Scan `target.abilities` for spells with reactionTrigger
              const reactionSpells = target.abilities
                .map(a => a.spell)
                .filter(s => {
                  if (!s || s.castingTime.unit !== 'reaction') return false;
                  // Check if any defensive effect has a reaction trigger of type 'when_hit'
                  return s.effects.some(e => isDefensiveEffect(e) && e.reactionTrigger?.event === 'when_hit');
                }) as Spell[];

              if (hasReactionResource && reactionSpells.length > 0) {
                // Pause for User Input
                const usedSpellId = await new Promise<string | null>(resolve => {
                  setPendingReaction({
                    attackerId: caster.id,
                    targetId: target.id,
                    triggerType: 'on_hit',
                    reactionSpells,
                    onResolve: resolve
                  });
                });

                setPendingReaction(null);

                if (usedSpellId) {
                  const spell = reactionSpells.find(s => s.id === usedSpellId);
                  if (spell) {
                    await executeSpell(spell, target, [target], spell.level); // Cast Shield on self

                    // For calculation, assume Shield adds +5 (read from defensive effect)
                    const defensiveEffect = spell.effects.find(isDefensiveEffect);
                    const acBonus = defensiveEffect?.acBonus || 5; // Default to 5 if undefined

                    finalAC += acBonus;
                    finalIsHit = initialAttackRoll >= finalAC;

                    if (onLogEntry) {
                      onLogEntry({
                        id: generateId(),
                        timestamp: Date.now(),
                        type: 'action',
                        message: `${target.name} casts ${spell.name}! AC increases to ${finalAC}. Attack ${finalIsHit ? 'still HITS' : 'now MISSES'}!`,
                        characterId: target.id,
                        data: { spellId: spell.id, reaction: true }
                      });
                    }
                  }
                }
              }
            }
            // --- END REACTION CHECK ---

            if (!finalIsHit) {
              if (onLogEntry) {
                onLogEntry({
                  id: generateId(),
                  timestamp: Date.now(),
                  type: 'action',
                  message: `Attack MISSES ${target.name} (AC ${finalAC}).`,
                  characterId: caster.id,
                  targetIds: [targetId]
                });
              }
              if (onAbilityEffect) onAbilityEffect(0, target.position, 'miss');
              continue; // Next target
            } else {
              // Determine Critical Hit based on d20 roll (Natural 20)
              // TODO: Handle Expanded Crit Range (Champion Fighter, Hexblade)
              const isCritical = d20 === 20;

              if (onLogEntry) {
                onLogEntry({
                  id: generateId(),
                  timestamp: Date.now(),
                  type: 'damage', // Log as damage event or just hit confirmation
                  message: isCritical ? `Critical Hit! (${d20})` : `Attack HITS ${target.name}!`,
                  characterId: caster.id,
                  targetIds: [targetId]
                });
              }

              // Apply effects with critical status
              applyAbilityEffects(ability, caster, target, isCritical);
              continue; // Handled
            }
          }
        }

        applyAbilityEffects(ability, caster, target, false);
      } // end target loop

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
  }, [onExecuteAction, characters, applyAbilityEffects, onCharacterUpdate, cancelTargeting, executeSpell, onLogEntry, onAbilityEffect]);

  const executeAbility = useCallback((...args: Parameters<typeof executeAbilityInternal>) => {
    return executeAbilityInternal(...args);
  }, [executeAbilityInternal]);


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
    // TODO: include reactiveTriggers in deps or refresh inside to avoid stale trigger cleanup when dropping concentration.
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
      reactiveTriggers: reactiveTriggers || [],
      activeLightSources: []
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
    executeAbility,

    dropConcentration,
    pendingReaction,
  };
};

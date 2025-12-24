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
  ReactiveTrigger,
  GameState
} from '../types';
import {
  Spell,
  isDamageEffect,
  isStatusConditionEffect,
  isDefensiveEffect
} from '../types/spells';
import { SpellCommandFactory, AbilityCommandFactory, CommandExecutor } from '../commands'; // Import Command System
import { BreakConcentrationCommand } from '../commands/effects/ConcentrationCommands'; // Import Break Concentration
import { getDistance, calculateDamage, generateId, rollDamage } from '../utils/combatUtils';
import { hasLineOfSight } from '../utils/lineOfSight';
import { calculateAffectedTiles } from '../utils/aoeCalculations';
import { useTargeting } from './combat/useTargeting'; // New Hook
import { resolveAoEParams } from '../utils/targetingUtils';
// TODO: CLEANUP: Check if AttackRiderSystem is still needed. It appears unused after the refactor to Command Pattern.
import { AttackRiderSystem, AttackContext } from '../systems/combat/AttackRiderSystem';
import { Plane } from '../types/planes';

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
  currentPlane?: Plane; // NEW: Added plane context
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
  onMapUpdate,
  currentPlane
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
  // Also integrate RitualManager.validateRequirements() to check for ritual constraints (Time, Location) before starting.
  const executeSpell = useCallback(
    async function executeSpellImpl(
      spell: Spell,
      caster: CombatCharacter,
      targets: CombatCharacter[],
      castAtLevel: number,
      playerInput?: string
    ) {
      // 0. Check for AI Input Requirements
      if (spell.arbitrationType === 'ai_dm' && spell.aiContext?.playerInputRequired && !playerInput) {
        if (onRequestInput) {
          onRequestInput(spell, (input) => {
            // Re-trigger execution with the collected input
            executeSpellImpl(spell, caster, targets, castAtLevel, input);
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
        turnState: {
          currentTurn: 0,
          turnOrder: [],
          currentCharacterId: null,
          phase: 'planning',
          actionsThisTurn: []
        },
        selectedCharacterId: null,
        selectedAbilityId: null,
        actionMode: 'select',
        validTargets: [],
        validMoves: [],
        combatLog: [], // Start empty to capture new entries
        reactiveTriggers: reactiveTriggers || [], // Pass current triggers
        activeLightSources: [],
        currentPlane: currentPlane
      };

      const mockGameState = {} as unknown as GameState;
      // TODO: CRITICAL: Replace the empty '{}' assertion for GameState with a real context value or a safer default object (e.g., useGameState() hook). Passing an empty object will cause crashes if spells access flags like 'isDaytime' or 'weather'.
      // Passing an empty object (`{} as GameState`) is a time-bomb; if any Command strictly accesses `gameState.flags` or `gameState.weather`,
      // it will crash the app. At minimum, provide safe defaults.
      // TODO: SAFETY: We are passing an empty object as GameState.
      // If any SpellCommands rely on global flags (e.g. 'isDaytime', 'difficulty'), this will crash or behave unexpectedly.
      // Consider passing a minimal valid GameState or fetching the real one from a context.

      try {
        // Asynchronously generate the chain of effect commands
        const commands = await SpellCommandFactory.createCommands(
          spell,
          caster,
          targets,
          castAtLevel,
          mockGameState,
          playerInput,
          currentPlane
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
          if (onLogEntry) {
            onLogEntry({
              id: generateId(),
              timestamp: Date.now(),
              type: 'action',
              message: `The weave falters... (${result.error})`,
              characterId: caster.id
            });
          }
        }
      } catch (error) {
        console.error("SpellCommandFactory error:", error);
        if (onLogEntry) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message: `The spell fizzles before it can be cast. (${errorMessage})`,
            characterId: caster.id
          });
        }
      }
    },
    [characters, onCharacterUpdate, onLogEntry, onRequestInput, reactiveTriggers, onReactiveTriggerUpdate, currentPlane, mapData, onMapUpdate]
  );


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
    // TODO: Refactor: Move `isValidTarget` and `getValidTargets` to `src/utils/targetingUtils.ts` or `src/hooks/combat/useTargeting.ts`.
    // The file header states targeting logic is delegated, but these core validation functions remain here,
    // violating the separation of concerns between "Orchestration" vs "Geometric Calculation".
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
    // TODO: OPTIMIZATION: Memoize 'getValidTargets' or optimize the spatial scan. Currently, this performs (MapWidth * MapHeight) line-of-sight checks on every render where the ability palette is open, which can cause significant frame drops on larger maps (50x50+).
    // TODO: PERFORMANCE: This brute-force scan (Width * Height) runs Line-of-Sight checks on every tile.
    // On large maps (e.g., 50x50), this is 2500 raycasts per render/click.
    // Optimization:
    // 1. Only scan tiles within `ability.range` (bounding box).
    // 2. Use a flood-fill algorithm for movement/range instead of checking every coordinate.
    // TODO: Performance: Implement `useMemo` or a ref-based cache for valid targets.
    // Currently, this scans (MapWidth * MapHeight) tiles on every render/tick where it's called.
    // Cache key should be: `[ability.id, caster.position, mapData.revisionId]`.
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


  // Legacy applyAbilityEffects removed - Logic moved to WeaponAttackCommand in AbilityCommandFactory





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

    // --- Path B: Ability System (Command Pattern) ---

    // Construct State
    const currentState: CombatState = {
      isActive: true,
      characters: characters,
      turnState: {
        currentTurn: 0,
        turnOrder: [],
        currentCharacterId: null,
        phase: 'planning',
        actionsThisTurn: []
      },
      selectedCharacterId: null,
      selectedAbilityId: null,
      actionMode: 'select',
      validTargets: [],
      validMoves: [],
      combatLog: [],
      reactiveTriggers: reactiveTriggers || [],
      activeLightSources: [],
      currentPlane
    };

    const mockGameState = {} as unknown as GameState;

    // Use Factory
    const targets = targetCharacterIds
      .map(id => characters.find(c => c.id === id))
      .filter((c): c is CombatCharacter => !!c);

    const commands = AbilityCommandFactory.createCommands(ability, caster, targets, mockGameState);

    // Verify economy costs (Action Points)
    // We still check this first before executing commands
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

    if (!onExecuteAction(action)) {
      cancelTargeting();
      return;
    }

    // Execute
    const result = CommandExecutor.execute(commands, currentState);

    if (result.success) {
      // Propagate State Changes
      result.finalState.characters.forEach(finalChar => {
        onCharacterUpdate(finalChar);
      });

      // Propagate Logs
      if (onLogEntry) {
        result.finalState.combatLog.forEach(entry => onLogEntry(entry));
      }

      // Handle Cooldowns (Manually for now, could be a command)
      if (ability.cooldown) {
        const updatedCaster = result.finalState.characters.find(c => c.id === caster.id) || caster;
        const newCaster = {
          ...updatedCaster,
          abilities: updatedCaster.abilities.map(a =>
            a.id === ability.id ? { ...a, currentCooldown: ability.cooldown } : a
          )
        };
        onCharacterUpdate(newCaster);
      }
    } else {
      console.error("Ability execution failed:", result.error);
    }

    cancelTargeting();
  }, [onExecuteAction, characters, onCharacterUpdate, cancelTargeting, executeSpell, onLogEntry, onAbilityEffect, currentPlane]);

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
    // TODO: BUG RISK: `reactiveTriggers` is not in the dependency array. 
    // If `reactiveTriggers` updates (e.g. a new reaction is added), this closure will be stale,
    // and `currentState.reactiveTriggers` will be empty/old, potentially causing bugs in command execution.
    if (!character.concentratingOn) return;

    const currentState: CombatState = {
      isActive: true,
      characters: characters,
      turnState: {
        currentTurn: 0,
        turnOrder: [],
        currentCharacterId: null,
        phase: 'planning',
        actionsThisTurn: []
      },
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
      gameState: {} as unknown as GameState, // Mock
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
  }, [characters, onCharacterUpdate, onLogEntry, reactiveTriggers]);


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

export type AbilitySystem = ReturnType<typeof useAbilitySystem>;

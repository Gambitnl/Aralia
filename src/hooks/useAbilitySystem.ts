/**
 * @file hooks/useAbilitySystem.ts
 * Manages ability selection, targeting, and execution logic for combat.
 * REFACTORED:
 * - UI/Selection state now delegated to `useTargeting`.
 * - Geometric logic delegated to `targetingUtils`.
 * - Remains the "Orchestrator" connecting UI events to Action execution.
 * - [Steward] Memoized return object. Event handlers stabilized via Refs.
 *   Getters (isValidTarget) remain reactive to props for render correctness.
 */
import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { CombatCharacter, Position, CombatAction, BattleMapData, CombatState, CombatLogEntry, ReactiveTrigger, Ability } from '../types/combat';
import { GameState } from '../types';
import { Spell } from '../types/spells';
import { SpellCommandFactory, AbilityCommandFactory, CommandExecutor } from '../commands'; // Import Command System
import { BreakConcentrationCommand } from '../commands/effects/ConcentrationCommands'; // Import Break Concentration
// TODO(lint-intent): 'getDistance' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { getDistance as _getDistance, generateId } from '../utils/combatUtils';
// TODO(lint-intent): 'hasLineOfSight' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { hasLineOfSight as _hasLineOfSight } from '../utils/lineOfSight';
import { calculateAffectedTiles } from '../utils/aoeCalculations';
import { useTargeting } from './combat/useTargeting'; // New Hook
import { resolveAoEParams } from '../utils/targetingUtils';
import { Plane } from '../types/planes';
import { useTargetValidator } from './combat/useTargetValidator';

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
  onAbilityEffect: _onAbilityEffect,
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
  } = useTargeting({ mapData: mapData ?? null, characters });

  // Delegate Validation Logic to specialized hook
  const {
    isValidTarget,
    getValidTargets,
    // TODO(lint-intent): 'getCharacterAtPosition' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    getCharacterAtPosition: _getCharacterAtPosition
  } = useTargetValidator({ characters, mapData });
  // TODO(lint-intent): 'setPendingReaction' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  const [pendingReaction, _setPendingReaction] = useState<PendingReaction | null>(null);

  // --- Refs for Stability (Actions Only) ---
  // We use Refs to access the latest props inside event handlers (actions)
  // to prevent them from causing re-renders.
  const charactersRef = useRef(characters);
  const mapDataRef = useRef(mapData);
  const reactiveTriggersRef = useRef(reactiveTriggers);
  const currentPlaneRef = useRef(currentPlane);

  // Sync refs with props
  useEffect(() => {
    charactersRef.current = characters;
    mapDataRef.current = mapData;
    reactiveTriggersRef.current = reactiveTriggers;
    currentPlaneRef.current = currentPlane;
  }, [characters, mapData, reactiveTriggers, currentPlane]);

  // --- Command Pattern Execution Logic (Actions - Stable) ---
  const executeSpell = useCallback(
    async function executeSpellImpl(
      spell: Spell,
      caster: CombatCharacter,
      targets: CombatCharacter[],
      castAtLevel: number,
      playerInput?: string
    ) {
      // Access latest data from refs
      const currentCharacters = charactersRef.current;
      const currentTriggers = reactiveTriggersRef.current;
      const currentMapData = mapDataRef.current;
      const activePlane = currentPlaneRef.current;

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
        characters: currentCharacters,
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
        reactiveTriggers: currentTriggers || [], // Pass current triggers
        activeLightSources: [],
        currentPlane: activePlane,
        mapData: currentMapData ?? undefined // Add mapData to context if needed by commands
      };

      const mockGameState = {} as unknown as GameState;

      try {
        // Asynchronously generate the chain of effect commands
        const commands = await SpellCommandFactory.createCommands(
          spell,
          caster,
          targets,
          castAtLevel,
          mockGameState,
          playerInput,
          activePlane
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
            if (result.finalState.mapData !== mapDataRef.current) {
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
    [onCharacterUpdate, onLogEntry, onRequestInput, onReactiveTriggerUpdate, onMapUpdate]
  );


  // Legacy applyAbilityEffects removed - Logic moved to WeaponAttackCommand in AbilityCommandFactory

  // Refactored async wrapper for executeAbility to support internal await
  // ACTION: Uses refs for stability
  const executeAbilityInternal = useCallback(async (
    ability: Ability,
    caster: CombatCharacter,
    targetPosition: Position,
    targetCharacterIds: string[]
  ) => {
    // Access latest data from refs
    const currentCharacters = charactersRef.current;
    const currentTriggers = reactiveTriggersRef.current;
    const activePlane = currentPlaneRef.current;

    // --- Path A: Spell System (Command Pattern) ---
    if (ability.spell) {
      // Validate Spell Integrity
      if (!ability.spell.id || ability.spell.level === undefined || !ability.spell.effects) {
        console.error("Invalid spell data: Missing required fields (id, level, or effects)", ability.spell);
        cancelTargeting();
        return;
      }

      const targets = targetCharacterIds
        .map(id => currentCharacters.find(c => c.id === id))
        .filter((c): c is CombatCharacter => !!c);

      executeSpell(ability.spell, caster, targets, ability.spell.level);
      cancelTargeting();
      return;
    }

    // --- Path B: Ability System (Command Pattern) ---

    // Construct State
    const currentState: CombatState = {
      isActive: true,
      characters: currentCharacters,
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
      reactiveTriggers: currentTriggers || [],
      activeLightSources: [],
      currentPlane: activePlane,
      mapData: mapDataRef.current ?? undefined
    };

    const mockGameState = {} as unknown as GameState;

    // Use Factory
    const targets = targetCharacterIds
      .map(id => currentCharacters.find(c => c.id === id))
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
  // TODO(lint-intent): Wire the ability-effect callback into the execution path if VFX hooks are needed.
  }, [onExecuteAction, onCharacterUpdate, cancelTargeting, executeSpell, onLogEntry]); // Refs are stable, omitted

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
   * ACTION: Stabilized via Refs.
   */
  const selectTarget = useCallback((targetPosition: Position, caster: CombatCharacter) => {
    // Note: selectedAbility is from hook state (props/reactive), not ref.
    // This is fine as selectTarget is re-created if selectedAbility changes (which is rare during targeting).
    if (!selectedAbility) return;

    let targetCharacterIds: string[] = [];

    if (selectedAbility.areaOfEffect) {
      // Use Utils to resolve full affected area
      const params = resolveAoEParams(selectedAbility.areaOfEffect, targetPosition, caster);
      if (params) {
        const affectedTiles = calculateAffectedTiles(params);

        targetCharacterIds = charactersRef.current
          .filter(char => affectedTiles.some(tile =>
            tile.x === char.position.x && tile.y === char.position.y
          ))
          .map(char => char.id);
      }
    } else {
      // Single Target
      // Use ref-based search for action phase
      const targetCharacter = charactersRef.current.find(char =>
        char.position.x === targetPosition.x && char.position.y === targetPosition.y
      );
      if (targetCharacter) {
        targetCharacterIds = [targetCharacter.id];
      }
    }

    executeAbility(selectedAbility, caster, targetPosition, targetCharacterIds);
  }, [selectedAbility, executeAbility]);


  /**
   * Allows a character to voluntarily stop concentrating on a spell.
   * ACTION: Stabilized via Refs.
   */
  const dropConcentration = useCallback((character: CombatCharacter) => {
    if (!character.concentratingOn) return;

    const currentCharacters = charactersRef.current;
    const currentTriggers = reactiveTriggersRef.current;

    const currentState: CombatState = {
      isActive: true,
      characters: currentCharacters,
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
      reactiveTriggers: currentTriggers || [],
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
  }, [onCharacterUpdate, onLogEntry]);


  // Expose API
  // Memoize the return object.
  // Dependencies:
  // - Reactive state (targetingMode, selectedAbility, etc.)
  // - Reactive getters (isValidTarget, getValidTargets) - change with Map/Chars
  // - Stable actions (executeSpell, etc.) - rarely change
  return useMemo(() => ({
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
  }), [
    selectedAbility,
    targetingMode,
    aoePreview,
    getValidTargets, // Reactive (Changes with map/chars)
    startTargeting, // Stable
    selectTarget, // Semi-stable (depends on selectedAbility)
    cancelTargeting, // Stable
    previewAoE, // Stable
    isValidTarget, // Reactive (Changes with map/chars)
    executeSpell, // Stable
    executeAbility, // Stable
    dropConcentration, // Stable
    pendingReaction // Reactive
  ]);
};

export type AbilitySystem = ReturnType<typeof useAbilitySystem>;

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 31/05/2026, 23:28:55
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMap3D.tsx, components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx, hooks/useBattleMap.ts
 * Imports: 15 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import type { AreaOfEffect, Spell, SpellEffect } from '../types/spells';
import { resolveScalableNumber } from '../types/spells';
import { SpellCommandFactory, AbilityCommandFactory, CommandExecutor } from '../commands'; // Import Command System
import { BreakConcentrationCommand } from '../commands/effects/ConcentrationCommands'; // Import Break Concentration
import { getDistance, generateId } from '../utils/combatUtils';
import { calculateSpellDC } from '../utils/savingThrowUtils';
// TODO(lint-intent): 'hasLineOfSight' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { hasLineOfSight as _hasLineOfSight } from '../utils/lineOfSight';
import { calculateAffectedTiles, type AoEParams } from '../utils/combat/aoeCalculations';
import { useTargeting } from './combat/useTargeting'; // New Hook
import { resolveAoEParams } from '../utils/spatial/targetingUtils';
import { Plane } from '../types/planes';
import { useTargetValidator } from './combat/useTargetValidator';
import { consumeActionCost } from '../utils/combat/actionEconomyUtils';
import {
  createMovementDebuff,
  createScheduledSpellEffect,
  createSpellZoneFromAoEParams,
  type ActiveSpellZone,
  type MovementTriggerDebuff,
  type ScheduledSpellEffect
} from '../systems/spells/effects/triggerHandler';

interface UseAbilitySystemProps {
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  onExecuteAction: (action: CombatAction) => boolean;
  onCharacterUpdate: (character: CombatCharacter) => void;
  onAbilityEffect?: (value: number, position: Position, type: 'damage' | 'heal' | 'miss') => void;
  onLogEntry?: (entry: CombatLogEntry) => void;
  onNotification?: (message: string, type: 'info' | 'error' | 'warning' | 'success') => void;
  onRequestInput?: (spell: Spell, onConfirm: (input: string) => void) => void;
  reactiveTriggers?: ReactiveTrigger[];
  onReactiveTriggerUpdate?: (triggers: ReactiveTrigger[]) => void;
  onMapUpdate?: (mapData: BattleMapData) => void;
  /** Registers persistent spell zones created by structured area-trigger effects. */
  onAddSpellZone?: (zone: ActiveSpellZone) => void;
  /** Registers target-bound scheduled spell effects that resolve on future turns. */
  onAddScheduledSpellEffect?: (effect: ScheduledSpellEffect) => void;
  /** Registers target movement debuffs such as Booming Blade-style delayed triggers. */
  onAddMovementDebuff?: (debuff: MovementTriggerDebuff) => void;
  currentPlane?: Plane; // NEW: Added plane context
}

export interface PendingReaction {
  attackerId: string;
  targetId: string;
  triggerType: 'on_hit' | 'on_cast' | 'on_move';
  reactionSpells: Spell[]; // Spells available to cast
  onResolve: (usedSpellId: string | null) => void;
}

// ============================================================================
// Ability Action Resource Preservation
// ============================================================================
// The turn manager spends actions, bonus actions, reactions, movement, and spell
// slots before command effects resolve. These helpers keep that spent-resource
// state attached to the caster when command results are replayed back into React
// state, so an attack or spell cannot restore an older pre-action snapshot.
// ============================================================================

const buildAbilityCombatAction = (
  ability: Ability,
  caster: CombatCharacter,
  targetPosition: Position,
  targetCharacterIds: string[]
): CombatAction => ({
  id: generateId(),
  characterId: caster.id,
  type: 'ability',
  abilityId: ability.id,
  targetPosition,
  targetCharacterIds,
  cost: ability.cost,
  timestamp: Date.now()
});

const AREA_ZONE_TRIGGER_TYPES = new Set([
  'on_enter_area',
  'on_exit_area',
  'on_end_turn_in_area',
  'on_move_in_area'
]);

const hasPersistentAreaTrigger = (effect: SpellEffect): boolean => {
  const triggerType = (effect as { trigger?: { type?: string } }).trigger?.type;
  return typeof triggerType === 'string' && AREA_ZONE_TRIGGER_TYPES.has(triggerType);
};

const SCHEDULED_EFFECT_TRIGGER_TYPES = new Set(['turn_start', 'turn_end']);

const hasScheduledEffectTrigger = (effect: SpellEffect): boolean => {
  const triggerType = (effect as { trigger?: { type?: string } }).trigger?.type;
  return typeof triggerType === 'string' && SCHEDULED_EFFECT_TRIGGER_TYPES.has(triggerType);
};

const hasTargetMovementTrigger = (effect: SpellEffect): boolean => {
  const triggerType = (effect as { trigger?: { type?: string } }).trigger?.type;
  return triggerType === 'on_target_move';
};

const getDurationRounds = (spell: Spell): number | undefined => {
  const duration = spell.duration;
  if (!duration.value || duration.type === 'instantaneous') return undefined;

  switch (duration.unit) {
    case 'round':
      return duration.value;
    case 'minute':
      return duration.value * 10;
    case 'hour':
      return duration.value * 600;
    case 'day':
      return duration.value * 14400;
    default:
      return undefined;
  }
};

const getZoneAreaFromAoEParams = (
  areaOfEffect: AreaOfEffect,
  aoeParams: AoEParams
): { shape: string; size: number } => ({
  shape: areaOfEffect.shape,
  // Use the resolved AoE size so persistent zone containment follows the same
  // unit convention as targeting previews and immediate affected-tile lookup.
  size: aoeParams.size
});

const applyResourceSnapshotToCaster = (
  finalCaster: CombatCharacter,
  resourceSnapshot: CombatCharacter
): CombatCharacter => ({
  ...finalCaster,
  actionEconomy: resourceSnapshot.actionEconomy,
  spellSlots: resourceSnapshot.spellSlots
});

const replaceCasterForCommandState = (
  characters: CombatCharacter[],
  casterWithPaidCost: CombatCharacter
): CombatCharacter[] => {
  return characters.map(character => character.id === casterWithPaidCost.id ? casterWithPaidCost : character);
};

// Multi-target spells already encode how many creatures they can affect.
// The combat selector keeps that structure intact by turning the clicked
// target into a full, ordered target list instead of collapsing back to one.
const resolveMultiTargetIds = (
  ability: Ability,
  caster: CombatCharacter,
  clickedTarget: CombatCharacter,
  characters: CombatCharacter[],
  getValidTargets: (ability: Ability, caster: CombatCharacter) => Position[]
): string[] => {
  const spellTargeting = (ability.spell as Spell | undefined)?.targeting;

  if (spellTargeting?.type !== 'multi') {
    return [clickedTarget.id];
  }

  const maxTargets = Math.max(1, resolveScalableNumber(spellTargeting.maxTargets, caster.level));
  const validTargetKeys = new Set(
    getValidTargets(ability, caster).map(position => `${position.x}-${position.y}`)
  );

  const orderedTargets = characters
    .filter(character => validTargetKeys.has(`${character.position.x}-${character.position.y}`))
    .sort((left, right) => {
      const leftDistance = getDistance(caster.position, left.position);
      const rightDistance = getDistance(caster.position, right.position);
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }
      return left.id.localeCompare(right.id);
    });

  const clickedFirst = [
    clickedTarget,
    ...orderedTargets.filter(character => character.id !== clickedTarget.id)
  ];

  return clickedFirst.slice(0, maxTargets).map(character => character.id);
};

export const useAbilitySystem = ({
  characters,
  mapData,
  onExecuteAction,
  onCharacterUpdate,
  onAbilityEffect: _onAbilityEffect,
  onLogEntry,
  onNotification,
  onRequestInput,
  reactiveTriggers,
  onReactiveTriggerUpdate,
  onMapUpdate,
  onAddSpellZone,
  onAddScheduledSpellEffect,
  onAddMovementDebuff,
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
    getTargetValidation,
    getValidTargets,
    getCharacterAtPosition
  } = useTargetValidator({ characters, mapData });
  const [pendingReaction, setPendingReaction] = useState<PendingReaction | null>(null);

  const requestReaction = useCallback((attackerId: string, targetId: string, triggerType: 'on_hit' | 'on_cast' | 'on_move' | 'on_take_damage', reactionSpells: Spell[]): Promise<string | null> => {
    return new Promise(resolve => {
      setPendingReaction({
        attackerId,
        targetId,
        triggerType: triggerType as any,
        reactionSpells,
        onResolve: (choice) => {
          setPendingReaction(null);
          resolve(choice);
        }
      });
    });
  }, []);

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
      playerInput?: string,
      resourceSnapshot?: CombatCharacter,
      zoneRegistration?: { areaOfEffect: AreaOfEffect; aoeParams: AoEParams }
    ) {
      // RALPH: Stability Pattern.
      // We access `charactersRef.current` instead of `characters` from props to avoid re-creating this function on every render.
      // This prevents the UI from "flickering" or losing focus during rapid updates.
      // Access latest data from refs
      const currentCharacters = charactersRef.current;
      const currentTriggers = reactiveTriggersRef.current;
      const currentMapData = mapDataRef.current;
      const activePlane = currentPlaneRef.current;
      const commandCharacters = resourceSnapshot
        ? replaceCasterForCommandState(currentCharacters, resourceSnapshot)
        : currentCharacters;

      // 0. Check for AI Input Requirements
      if (spell.arbitrationType === 'ai_dm' && spell.aiContext?.playerInputRequired && !playerInput) {
        if (onRequestInput) {
          onRequestInput(spell, (input) => {
            // Re-trigger execution with the collected input
            executeSpellImpl(spell, caster, targets, castAtLevel, input, resourceSnapshot);
          });
          return; // Halt execution until input is provided
        } else {
          console.warn("Spell requires input but no onRequestInput handler provided.");
        }
      }

      // 1. Construct temporary CombatState
      const currentState: CombatState = {
        isActive: true,
        characters: commandCharacters,
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
          activePlane,
          requestReaction
        );

        // 3. Execute
        const result = await CommandExecutor.execute(commands, currentState);

        if (result.success) {
          // 4. Propagate State Changes
          result.finalState.characters.forEach(finalChar => {
            const isTarget = targets.some(t => t.id === finalChar.id);
            const isCaster = caster.id === finalChar.id;

            if (isTarget || isCaster) {
              onCharacterUpdate(isCaster && resourceSnapshot
                ? applyResourceSnapshotToCaster(finalChar, resourceSnapshot)
                : finalChar);
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

          // Persistent area triggers need an ActiveSpellZone so movement and
          // end-turn processors can observe the spell after the initial command
          // execution finishes. This bridge intentionally reuses the AoE params
          // already resolved for targeting so origin and direction do not drift.
          // Capture the caster's save DC at cast time so delayed zone/scheduled
          // effects do not silently change if the caster's stats change later.
          const castSaveDC = calculateSpellDC(caster);

          if (onAddSpellZone && zoneRegistration && spell.effects.some(hasPersistentAreaTrigger)) {
            onAddSpellZone(createSpellZoneFromAoEParams(
              spell.id,
              caster.id,
              zoneRegistration.aoeParams,
              getZoneAreaFromAoEParams(zoneRegistration.areaOfEffect, zoneRegistration.aoeParams),
              spell.effects,
              currentState.turnState.currentTurn,
              getDurationRounds(spell),
              castSaveDC
            ));
          }

          if (onAddScheduledSpellEffect && spell.effects.some(hasScheduledEffectTrigger)) {
            (['turn_start', 'turn_end'] as const).forEach(timing => {
              const scheduledEffects = spell.effects.filter(effect => effect.trigger?.type === timing);
              if (scheduledEffects.length === 0) return;

              targets.forEach(target => {
                onAddScheduledSpellEffect(createScheduledSpellEffect(
                  spell.id,
                  caster.id,
                  target.id,
                  timing,
                  scheduledEffects,
                  currentState.turnState.currentTurn,
                  getDurationRounds(spell),
                  castSaveDC
                ));
              });
            });
          }

          if (onAddMovementDebuff && spell.effects.some(hasTargetMovementTrigger)) {
            targets.forEach(target => {
              // Target-move triggers need their own runtime debuff record so the
              // movement executor can notice the later move and apply the stored
              // spell payload. Capture save DC here for parity with zones and
              // scheduled turn effects.
              onAddMovementDebuff(createMovementDebuff(
                spell.id,
                caster.id,
                target.id,
                spell.effects,
                currentState.turnState.currentTurn,
                getDurationRounds(spell) ?? 1,
                castSaveDC
              ));
            });
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
        if (onNotification) onNotification(`The spell fizzles before it can be cast. (${error instanceof Error ? error.message : 'Unknown error'})`, 'error');
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
    [onCharacterUpdate, onLogEntry, onNotification, onRequestInput, onReactiveTriggerUpdate, onMapUpdate, onAddSpellZone, onAddScheduledSpellEffect, onAddMovementDebuff]
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
    const liveCaster = currentCharacters.find(character => character.id === caster.id) ?? caster;

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

      const action = buildAbilityCombatAction(ability, liveCaster, targetPosition, targetCharacterIds);

      if (!onExecuteAction(action)) {
        cancelTargeting();
        return;
      }

      const casterAfterCost = consumeActionCost(liveCaster, ability.cost);

      const zoneAoEParams = ability.areaOfEffect
        ? resolveAoEParams(ability.areaOfEffect, targetPosition, liveCaster)
        : null;
      const zoneRegistration = ability.areaOfEffect && zoneAoEParams
        ? { areaOfEffect: ability.areaOfEffect, aoeParams: zoneAoEParams }
        : undefined;

      executeSpell(
        ability.spell,
        casterAfterCost,
        targets,
        ability.spell.level,
        undefined,
        casterAfterCost,
        zoneRegistration
      );
      cancelTargeting();
      return;
    }

    // --- Path B: Ability System (Command Pattern) ---

    // Verify economy costs before command effects run. The turn manager remains
    // the authoritative executor, while the local resource snapshot protects
    // command results from restoring a stale caster.
    const action = buildAbilityCombatAction(ability, liveCaster, targetPosition, targetCharacterIds);

    if (!onExecuteAction(action)) {
      cancelTargeting();
      return;
    }

    const casterAfterCost = consumeActionCost(liveCaster, ability.cost);
    const commandCharacters = replaceCasterForCommandState(currentCharacters, casterAfterCost);

    // Construct State
    const currentState: CombatState = {
      isActive: true,
      characters: commandCharacters,
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

    const commands = AbilityCommandFactory.createCommands(ability, casterAfterCost, targets, mockGameState);

    // Execute
    const result = CommandExecutor.execute(commands, currentState);

    if (result.success) {
      // Propagate State Changes
      if (commands.length > 0) {
        result.finalState.characters.forEach(finalChar => {
          const isTarget = targetCharacterIds.includes(finalChar.id);
          const isCaster = liveCaster.id === finalChar.id;

          // Only command-touched participants are replayed. This preserves the
          // action executor's Dash/Disengage mutations when an ability has no
          // command-side effect to apply.
          if (isTarget || isCaster) {
            onCharacterUpdate(isCaster
              ? applyResourceSnapshotToCaster(finalChar, casterAfterCost)
              : finalChar);
          }
        });
      }

      // Propagate Logs
      if (onLogEntry) {
        result.finalState.combatLog.forEach(entry => onLogEntry(entry));
      }

      // Handle Cooldowns (Manually for now, could be a command)
      if (ability.cooldown) {
        const updatedCaster = result.finalState.characters.find(c => c.id === caster.id) || caster;
        const newCaster = {
          ...applyResourceSnapshotToCaster(updatedCaster, casterAfterCost),
          abilities: updatedCaster.abilities.map(a =>
            a.id === ability.id ? { ...a, currentCooldown: ability.cooldown } : a
          )
        };
        onCharacterUpdate(newCaster);
      } else if (ability.recharge?.threshold) {
        const updatedCaster = result.finalState.characters.find(c => c.id === caster.id) || caster;
        const newCaster = {
          ...applyResourceSnapshotToCaster(updatedCaster, casterAfterCost),
          abilities: updatedCaster.abilities.map(a =>
            a.id === ability.id ? { ...a, isRecharging: true } : a
          )
        };
        onCharacterUpdate(newCaster);
      }

      // Decrement limited-use abilities (e.g. 1/Day, 3/Day from 5eTools N/Day annotations).
      // usesRemaining bottoms out at 0; the ability stays on the character so the name
      // is still visible in the inspect panel even when depleted.
      if (ability.maxUses !== undefined) {
        const updatedCaster = result.finalState.characters.find(c => c.id === caster.id) || caster;
        const newCaster = {
          ...applyResourceSnapshotToCaster(updatedCaster, casterAfterCost),
          abilities: updatedCaster.abilities.map(a =>
            a.id === ability.id
              ? { ...a, usesRemaining: Math.max(0, (a.usesRemaining ?? a.maxUses ?? 1) - 1) }
              : a
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
    if (!selectedAbility) return false;

    // WHAT CHANGED: Target selection now asks the validator for the reason a
    // target failed, not just the old true/false answer.
    // WHY: Manual combat should not silently ignore a clicked enemy. The action
    // still does not execute, and targeting remains active so the player can
    // pick a legal target without reselecting the ability.
    const validation = getTargetValidation(selectedAbility, caster, targetPosition);
    if (!validation.isValid) {
      if (onNotification) onNotification(validation.reason ?? `${caster.name} cannot use ${selectedAbility.name} there.`, 'error');
      if (onLogEntry) {
        onLogEntry({
          id: generateId(),
          timestamp: Date.now(),
          type: 'action',
          message: validation.reason ?? `${caster.name} cannot use ${selectedAbility.name} there.`,
          characterId: caster.id,
          data: { abilityName: selectedAbility.name }
        });
      }
      return false;
    }

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
      // Creature target.
      // Single-target spells still use this path; multi-target spells expand the
      // clicked creature into the full legal list before the action is queued.
      const targetCharacter = getCharacterAtPosition(targetPosition);
      if (targetCharacter) {
        targetCharacterIds = resolveMultiTargetIds(
          selectedAbility,
          caster,
          targetCharacter,
          charactersRef.current,
          getValidTargets
        );
      }
    }

    executeAbility(selectedAbility, caster, targetPosition, targetCharacterIds);
    return true;
  }, [selectedAbility, executeAbility, getTargetValidation, getCharacterAtPosition, getValidTargets, onLogEntry]);


  /**
   * Allows a character to voluntarily stop concentrating on a spell.
   * ACTION: Stabilized via Refs.
   */
  const dropConcentration = useCallback(async (character: CombatCharacter) => {
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

    const result = await CommandExecutor.execute([command], currentState);

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
    getTargetValidation,
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
    getTargetValidation, // Reactive (Changes with map/chars)
    executeSpell, // Stable
    executeAbility, // Stable
    dropConcentration, // Stable
    pendingReaction // Reactive
  ]);
};

export type AbilitySystem = ReturnType<typeof useAbilitySystem>;

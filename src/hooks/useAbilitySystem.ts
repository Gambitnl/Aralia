// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 26/06/2026, 20:31:26
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMap3D.tsx, components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx, hooks/useBattleMap.ts
 * Imports: 24 files
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
import { CombatCharacter, Position, CombatAction, BattleMapData, CombatState, CombatLogEntry, ReactiveTrigger, Ability, LightSource, PocketedSummon, SpellDeliveryVisual, SelectedSpellTarget } from '../types/combat';

import { SpellMovementVisualInput } from './movementUtils';
export type { SpellMovementVisualInput };
import { GameState } from '../types';
import type { Item } from '../types/items';
import type { Spell, SpellEffect, MovementEffect, TerrainEffect, UtilityEffect } from '../types/spells';
import { resolveScalableNumber } from '../types/spells';
import { SpellCommandFactory, AbilityCommandFactory, CommandExecutor } from '../commands'; // Import Command System
import { BreakConcentrationCommand } from '../commands/effects/ConcentrationCommands'; // Import Break Concentration
import { getDistance, generateId } from '../utils/combatUtils';
import { calculateSpellDC, rollSavingThrow } from '../utils/savingThrowUtils';
// TODO(lint-intent): 'hasLineOfSight' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { hasLineOfSight as _hasLineOfSight } from '../utils/lineOfSight';
import { calculateAffectedTiles, type AoEParams } from '../utils/combat/aoeCalculations';
import { useTargeting } from './combat/useTargeting'; // New Hook
import { resolveAoEParams } from '../utils/spatial/targetingUtils';
import { findPath } from '../utils/spatial/pathfinding';
import { Plane } from '../types/planes';
import { findFamiliarTouchDelivery, useTargetValidator } from './combat/useTargetValidator';
import { consumeActionCost } from '../utils/combat/actionEconomyUtils';
import {
  createMovementDebuff,
  createScheduledSpellEffect,
  createSpellZoneFromAoEParams,
  createTerrainSpellZoneFromAoEParams,
  type ActiveSpellZone,
  type MovementTriggerDebuff,
  type ScheduledSpellEffect
} from '../systems/spells/effects/triggerHandler';

import {
  hasPersistentAreaTrigger,
  isTerrainEffect,
  hasScheduledEffectTrigger,
  hasTargetMovementTrigger,
  isMovementEffect,
  getDurationRounds
} from './spellEffectUtils';

import {
  getMovementVisualType,
  resolveImmediateAfterForcedMovementRepeatSaves,
  buildResolvedMovementVisualPath
} from './movementUtils';

import {
  hasTeleportMovementEffect,
  addTeleportDestinationToSpell,
  addTeleportDestinationsToSpell,
  requiresUnassignedTeleportDestination
} from './teleportUtils';

import {
  PerTargetChoicesByTargetId,
  addPerTargetChoicesToSpell,
  getPerTargetChoicesFromSpell,
  requestPerTargetChoices
} from './perTargetChoiceUtils';

import {
  buildAbilityCombatAction,
  getZoneAreaFromAoEParams,
  applyResourceSnapshotToCaster,
  replaceCasterForCommandState,
  buildCommandGameState,
  resolveMultiTargetIds
} from './actionUtils';
import { combatEvents } from '../systems/events/CombatEvents';
import { TargetResolver } from '../systems/spells/targeting/TargetResolver';
import { buildSelectedSpellTargetsForPosition } from '../systems/spells/targeting/selectedSpellTargets';

/**
 * Pull the selectable command words out of structured utility effects.
 *
 * Command-style spells keep the legal words inside the effect payload instead
 * of using `modeChoice`. The hook needs this small adapter so it can reuse the
 * existing player-input modal before command execution reaches UtilityCommand.
 */
const getSpellControlOptions = (spell: Spell): NonNullable<UtilityEffect['controlOptions']> => {
  return spell.effects.flatMap(effect => {
    // Only utility effects can carry command-control options. Other effect
    // families are ignored so damage, status, and movement spells keep their
    // current execution path.
    if (effect.type !== 'UTILITY') {
      return [];
    }

    return (effect as UtilityEffect).controlOptions ?? [];
  });
};

interface UseAbilitySystemProps {
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  onExecuteAction: (action: CombatAction) => boolean | Promise<boolean>;
  onCharacterUpdate: (character: CombatCharacter) => void;
  /** Replaces the visible combat roster when command results add or remove actors. */
  onCharactersReplace?: (characters: CombatCharacter[]) => void;
  onAbilityEffect?: (value: number, position: Position, type: 'damage' | 'heal' | 'miss') => void;
  onLogEntry?: (entry: CombatLogEntry) => void;
  onNotification?: (message: string, type: 'info' | 'error' | 'warning' | 'success') => void;
  onRequestInput?: (spell: Spell, onConfirm: (input: string) => void) => void;
  reactiveTriggers?: ReactiveTrigger[];
  onReactiveTriggerUpdate?: (triggers: ReactiveTrigger[]) => void;
  /** Current live light-source state so command execution starts from the map's real lights. */
  activeLightSources?: LightSource[];
  /** Publishes command-created or command-removed lights back to the live encounter. */
  onActiveLightSourcesUpdate?: (lightSources: LightSource[]) => void;
  /** Current off-map summons that remain bound, such as a dismissed familiar. */
  pocketedSummons?: PocketedSummon[];
  /** Publishes familiar pocket-state changes created by command execution. */
  onPocketedSummonsUpdate?: (pocketedSummons: PocketedSummon[]) => void;
  onMapUpdate?: (mapData: BattleMapData) => void;
  /** Registers persistent spell zones created by structured area-trigger effects. */
  onAddSpellZone?: (zone: ActiveSpellZone) => void;
  /** Live spell-zone state so command damage can respect active area defenses. */
  spellZones?: ActiveSpellZone[];
  /** Publishes command-mutated spell zones, such as Wall of Light shrinking after a beam. */
  onSpellZonesUpdate?: (zones: ActiveSpellZone[]) => void;
  /** Publishes spell-created inventory items, such as Goodberries, to shared inventory owners. */
  onSpellCreatedInventoryItems?: (items: Item[]) => void;
  /** Registers target-bound scheduled spell effects that resolve on future turns. */
  onAddScheduledSpellEffect?: (effect: ScheduledSpellEffect) => void;
  /** Registers target movement debuffs such as Booming Blade-style delayed triggers. */
  onAddMovementDebuff?: (debuff: MovementTriggerDebuff) => void;
  /** Registers resolved forced-movement and teleport cues for combat-map renderers. */
  onAddSpellMovementVisual?: (visual: SpellMovementVisualInput) => void;
  /** Registers a familiar-origin cue when a touch spell is delivered through a familiar. */
  onAddSpellDeliveryVisual?: (visual: Omit<SpellDeliveryVisual, 'id' | 'createdAt'>) => void;
  currentPlane?: Plane; // NEW: Added plane context
}

export interface PendingReaction {
  attackerId: string;
  targetId: string;
  triggerType: 'on_hit' | 'on_cast' | 'on_move' | 'on_take_damage' | 'opportunity_attack';
  reactionSpells?: Array<Spell | Ability>; // Spells available to cast, or ability-wrapped spells used by War Caster.
  reactionWeapons?: Ability[]; // Weapons/attacks available to swing
  onResolve: (choiceId: string | null) => void;
}

interface PendingTeleportDestinationAssignment {
  ability: Ability;
  casterId: string;
  targetIds: string[];
  initialTargetPosition: Position;
  activeTargetIndex: number;
  destinationsByTargetId: Record<string, Position>;
}

export const useAbilitySystem = ({
  characters,
  mapData,
  onExecuteAction,
  onCharacterUpdate,
  onCharactersReplace,
  onAbilityEffect: _onAbilityEffect,
  onLogEntry,
  onNotification,
  onRequestInput,
  reactiveTriggers,
  onReactiveTriggerUpdate,
  activeLightSources,
  onActiveLightSourcesUpdate,
  pocketedSummons,
  onPocketedSummonsUpdate,
  onMapUpdate,
  onAddSpellZone,
  spellZones,
  onSpellZonesUpdate,
  onSpellCreatedInventoryItems,
  onAddScheduledSpellEffect,
  onAddMovementDebuff,
  onAddSpellMovementVisual,
  onAddSpellDeliveryVisual,
  currentPlane
}: UseAbilitySystemProps) => {

  // Delegate Selection/Targeting State to specialized hook
  const {
    selectedAbility,
    targetingMode,
    aoePreview,
    teleportDestinationPreview,
    startTargeting: baseStartTargeting,
    cancelTargeting: baseCancelTargeting,
    previewAoE,
    previewTeleportDestinations,
    isTeleportDestination
  } = useTargeting({ mapData: mapData ?? null, characters });

  // Delegate Validation Logic to specialized hook
  const {
    isValidTarget,
    getTargetValidation,
    getValidTargets: getBaseValidTargets,
    getCharacterAtPosition
  } = useTargetValidator({ characters, mapData });
  const [pendingReaction, setPendingReaction] = useState<PendingReaction | null>(null);
  const [pendingTeleportAssignment, setPendingTeleportAssignment] = useState<PendingTeleportDestinationAssignment | null>(null);

  const cancelTargeting = useCallback(() => {
    setPendingTeleportAssignment(null);
    baseCancelTargeting();
  }, [baseCancelTargeting]);

  const requestReaction = useCallback((
    attackerId: string,
    targetId: string,
    triggerType: 'on_hit' | 'on_cast' | 'on_move' | 'on_take_damage' | 'opportunity_attack',
    reactionSpells: Array<Spell | Ability> = [],
    reactionWeapons: Ability[] = []
  ): Promise<string | null> => {
    return new Promise(resolve => {
      setPendingReaction({
        attackerId,
        targetId,
        triggerType,
        reactionSpells,
        reactionWeapons,
        onResolve: (choice) => {
          setPendingReaction(null);
          resolve(choice);
        }
      });
    });
  }, []);

  const getValidTargets = useCallback((ability: Ability, caster: CombatCharacter): Position[] => {
    const baseTargets = getBaseValidTargets(ability, caster);

    if (!ability.spell?.targeting.validTargets.includes('objects')) {
      return baseTargets;
    }

    const currentCharacters = charactersRef.current;
    const currentMapData = mapDataRef.current;
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
      reactiveTriggers: reactiveTriggersRef.current || [],
      activeLightSources: activeLightSources || [],
      mapData: currentMapData ?? undefined
    };
    const seenTargetKeys = new Set(baseTargets.map(position => `${position.x}-${position.y}`));
    const objectTargets = (currentMapData?.targetableObjects ?? [])
      .filter(targetObject => TargetResolver.isValidObjectTarget(
        ability.spell!.targeting,
        caster,
        targetObject,
        currentState
      ))
      .map(targetObject => targetObject.position)
      .filter(position => {
        const key = `${position.x}-${position.y}`;
        if (seenTargetKeys.has(key)) {
          return false;
        }
        seenTargetKeys.add(key);
        return true;
      });

    return [...baseTargets, ...objectTargets];
  }, [getBaseValidTargets, activeLightSources]);

  // --- Refs for Stability (Actions Only) ---
  // We use Refs to access the latest props inside event handlers (actions)
  // to prevent them from causing re-renders.
  const charactersRef = useRef(characters);
  const mapDataRef = useRef(mapData);
  const reactiveTriggersRef = useRef(reactiveTriggers);
  const currentPlaneRef = useRef(currentPlane);
  const pocketedSummonsRef = useRef(pocketedSummons);

  // Sync refs with props
  useEffect(() => {
    charactersRef.current = characters;
    mapDataRef.current = mapData;
    reactiveTriggersRef.current = reactiveTriggers;
    currentPlaneRef.current = currentPlane;
    pocketedSummonsRef.current = pocketedSummons;
  }, [characters, mapData, reactiveTriggers, currentPlane, pocketedSummons]);

  // --- Command Pattern Execution Logic (Actions - Stable) ---
  const executeSpell = useCallback(
    async function executeSpellImpl(
      spell: Spell,
      caster: CombatCharacter,
      targets: CombatCharacter[],
      castAtLevel: number,
      playerInput?: string,
      resourceSnapshot?: CombatCharacter,
      zoneRegistration?: { areaOfEffect: { shape: string }; aoeParams: AoEParams },
      selectedSpellTargets?: SelectedSpellTarget[]
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
      if (spell.modeChoice && !playerInput) {
        if (onRequestInput) {
          onRequestInput(spell, (input) => {
            // Mode-choice spells need the selected option label before command
            // creation, because SpellCommandFactory uses that label to keep
            // only the chosen effect branch. Re-enter the same execution path
            // after the UI supplies the choice.
            executeSpellImpl(spell, caster, targets, castAtLevel, input, resourceSnapshot, zoneRegistration, selectedSpellTargets);
          });
          return;
        }

        const message = `${spell.name} needs a mode choice before it can be cast.`;
        console.warn(message);
        if (onNotification) onNotification(message, 'error');
        if (onLogEntry) {
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message,
            characterId: caster.id,
            targetIds: targets.map(target => target.id),
            data: { spellId: spell.id, pendingGap: 'SSO-MODECHOICE-UI-INPUT-001' }
          });
        }
        return;
      }

      const controlOptions = getSpellControlOptions(spell);
      if (controlOptions.length > 1 && !playerInput) {
        if (onRequestInput) {
          onRequestInput(spell, (input) => {
            // Command-control spells store their menu inside the utility
            // effect, but the selected word should travel through the same
            // playerInput bridge that mode-choice spells already use.
            executeSpellImpl(spell, caster, targets, castAtLevel, input, resourceSnapshot, zoneRegistration, selectedSpellTargets);
          });
          return;
        }

        const message = `${spell.name} needs a command option before it can be cast.`;
        console.warn(message);
        if (onNotification) onNotification(message, 'error');
        if (onLogEntry) {
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message,
            characterId: caster.id,
            targetIds: targets.map(target => target.id),
            data: { spellId: spell.id, pendingGap: 'SSO-CONTROL-OPTION-SELECTION-001' }
          });
        }
        return;
      }

      if (spell.arbitrationType === 'ai_dm' && spell.aiContext?.playerInputRequired && !playerInput) {
        if (onRequestInput) {
          onRequestInput(spell, (input) => {
            // Free-form spell prompts can happen after the player has already
            // clicked a map tile or object. Preserve that selected-target
            // payload when execution resumes so command creation still knows
            // what the text choice was meant to affect.
            executeSpellImpl(spell, caster, targets, castAtLevel, input, resourceSnapshot, zoneRegistration, selectedSpellTargets);
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
        spellZones: spellZones ?? [],
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
        activeLightSources: activeLightSources || [],
        currentPlane: activePlane,
        mapData: currentMapData ?? undefined // Add mapData to context if needed by commands
      };

      const commandGameState = buildCommandGameState(commandCharacters, currentMapData, activePlane);
      const targetResolution = TargetResolver.resolveTargetCandidates(
        spell.targeting,
        targets,
        // Allocation uses the same cast level that command creation receives,
        // so upcast pool dice and downstream effect commands stay aligned.
        { castLevel: castAtLevel }
      );
      const executionTargets = targetResolution.selectedTargets;

      if (targetResolution.allocationApplied && onLogEntry) {
        targetResolution.logs.forEach(message => {
          // Pool allocation is a real targeting outcome, not just debugging
          // text. Logging each step makes Sleep/Color Spray-style selection
          // visible to the player before the effect commands apply damage,
          // conditions, or other payloads to the reduced target list.
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message: `${spell.name}: ${message}`,
            characterId: caster.id,
            targetIds: executionTargets.map(target => target.id),
            data: { spellId: spell.id, allocationApplied: true }
          });
        });
      }

      try {
        // Asynchronously generate the chain of effect commands
        const commands = await SpellCommandFactory.createCommands(
          spell,
          caster,
          executionTargets,
          castAtLevel,
          commandGameState,
          playerInput,
          activePlane,
          requestReaction,
          selectedSpellTargets
        );

        // 3. Execute
        const result = await CommandExecutor.execute(commands, currentState);

        if (result.success) {
          const movementEffects = spell.effects.filter(isMovementEffect);
          const finalState = resolveImmediateAfterForcedMovementRepeatSaves(result.finalState, executionTargets, movementEffects);

          // 4. Propagate State Changes
          finalState.characters.forEach(finalChar => {
            const isTarget = executionTargets.some(t => t.id === finalChar.id);
            const isCaster = caster.id === finalChar.id;

            if (isTarget || isCaster) {
              onCharacterUpdate(isCaster && resourceSnapshot
                ? applyResourceSnapshotToCaster(finalChar, resourceSnapshot)
                : finalChar);
            }
          });

          // 5. Propagate Log Entries
          if (onLogEntry) {
            finalState.combatLog.forEach(entry => onLogEntry(entry));
          }

          // 6. Propagate Reactive Triggers
          if (onReactiveTriggerUpdate && finalState.reactiveTriggers !== currentState.reactiveTriggers) {
            onReactiveTriggerUpdate(finalState.reactiveTriggers);
          }

          // Light spells mutate CombatState.activeLightSources inside command
          // execution. Feed that array back to the turn manager so visibility,
          // 2D map visuals, and 3D VFX all observe the same light state.
          if (onActiveLightSourcesUpdate && finalState.activeLightSources !== currentState.activeLightSources) {
            onActiveLightSourcesUpdate(finalState.activeLightSources || []);
          }

          // Spell commands can mutate existing persistent zones, not only add
          // new ones. Publish the updated zone list so shrinking walls and
          // removed zero-length zones survive beyond this temporary command
          // state.
          if (onSpellZonesUpdate && finalState.spellZones !== currentState.spellZones) {
            onSpellZonesUpdate((finalState.spellZones || []) as ActiveSpellZone[]);
          }

          if (onSpellCreatedInventoryItems && finalState.spellCreatedInventoryItems?.length) {
            onSpellCreatedInventoryItems(finalState.spellCreatedInventoryItems);
          }

          // 7. Propagate Map Changes
          if (onMapUpdate && finalState.mapData) {
            if (finalState.mapData !== mapDataRef.current) {
              onMapUpdate(finalState.mapData);
            }
          }

          if (onAddSpellMovementVisual && movementEffects.length > 0) {
            const movementVisualType = getMovementVisualType(movementEffects);
            executionTargets.forEach(target => {
              const finalTarget = finalState.characters.find(candidate => candidate.id === target.id);
              if (!finalTarget) return;
              if (target.position.x === finalTarget.position.x && target.position.y === finalTarget.position.y) return;

              // Immediate movement spells resolve through the command factory.
              // Compare the command result against the original target position
              // so the map cue shows what actually happened after validation,
              // blocking, and teleport fallback instead of predicting from data.
              onAddSpellMovementVisual({
                spellId: spell.id,
                targetId: target.id,
                type: movementVisualType,
                from: target.position,
                to: finalTarget.position,
                path: buildResolvedMovementVisualPath(currentMapData, target.position, finalTarget.position, movementVisualType)
              });
            });
          }

          // Persistent area triggers need an ActiveSpellZone so movement and
          // end-turn processors can observe the spell after the initial command
          // execution finishes. This bridge intentionally reuses the AoE params
          // already resolved for targeting so origin and direction do not drift.
          // Capture the caster's save DC at cast time so delayed zone/scheduled
          // effects do not silently change if the caster's stats change later.
          const castSaveDC = calculateSpellDC(caster);

          const hasPersistentAreaDefense = spell.effects.some(effect =>
            effect.type === 'DEFENSIVE' && (effect.defenseType === 'resistance' || effect.defenseType === 'immunity')
          );

          if (onAddSpellZone && zoneRegistration && (spell.effects.some(hasPersistentAreaTrigger) || hasPersistentAreaDefense)) {
            onAddSpellZone(createSpellZoneFromAoEParams(
              spell.id,
              caster.id,
              zoneRegistration.aoeParams,
              getZoneAreaFromAoEParams(zoneRegistration.areaOfEffect, zoneRegistration.aoeParams),
              spell.effects,
              currentState.turnState.currentTurn,
              getDurationRounds(spell),
              castSaveDC,
              spell.targeting.validTargets
            ));
          }

          if (onAddSpellZone && !mapDataRef.current && zoneRegistration && spell.effects.some(isTerrainEffect)) {
            // Map-present terrain spells mutate map tiles through TerrainCommand.
            // Mapless combat has no tile grid, so preserve the affected terrain
            // area as a durable spell zone that future movement, hazard, or
            // summary UI can inspect after the combat log scrolls away.
            onAddSpellZone(createTerrainSpellZoneFromAoEParams(
              spell.id,
              caster.id,
              zoneRegistration.aoeParams,
              getZoneAreaFromAoEParams(zoneRegistration.areaOfEffect, zoneRegistration.aoeParams),
              spell.effects.filter(isTerrainEffect),
              0,
              getDurationRounds(spell)
            ));
          }

          if (onAddScheduledSpellEffect && spell.effects.some(hasScheduledEffectTrigger)) {
            (['turn_start', 'turn_end'] as const).forEach(timing => {
              const scheduledEffects = spell.effects.filter(effect => effect.trigger?.type === timing);
              if (scheduledEffects.length === 0) return;

              executionTargets.forEach(target => {
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
            executionTargets.forEach(target => {
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
    [onCharacterUpdate, onLogEntry, onNotification, onRequestInput, onReactiveTriggerUpdate, onActiveLightSourcesUpdate, onMapUpdate, onAddSpellZone, onSpellZonesUpdate, onSpellCreatedInventoryItems, onAddScheduledSpellEffect, onAddMovementDebuff, onAddSpellMovementVisual, activeLightSources, spellZones]
  );



  // Legacy applyAbilityEffects removed - Logic moved to WeaponAttackCommand in AbilityCommandFactory

  // Refactored async wrapper for executeAbility to support internal await
  // ACTION: Uses refs for stability
  const executeAbilityInternal = useCallback(async (
    ability: Ability,
    caster: CombatCharacter,
    targetPosition: Position,
    targetCharacterIds: string[],
    playerInput?: string,
    selectedSpellTargets?: SelectedSpellTarget[]
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

      const perTargetChoice = ability.spell.targeting.perTargetChoice;
      const existingPerTargetChoices = getPerTargetChoicesFromSpell(ability.spell);
      if (perTargetChoice?.required && !playerInput && !existingPerTargetChoices) {
        if (targetCharacterIds.length === 1 && onRequestInput) {
          onRequestInput(ability.spell, (input) => {
            // A one-target cast can reuse the existing spell-input bridge: the
            // selected option belongs to that one target and is passed into
            // command creation as playerInput. Multi-target casts use the
            // sequential assignment flow below instead.
            executeAbilityInternal(ability, caster, targetPosition, targetCharacterIds, input, selectedSpellTargets);
          });
          return;
        }

        if (targetCharacterIds.length > 1 && onRequestInput) {
          requestPerTargetChoices(ability.spell, targets, onRequestInput, (choicesByTargetId) => {
            // Higher-slot casts need one option per selected target. Clone the
            // ability's spell for this cast with the completed assignment map,
            // then re-enter execution so the action is not spent until every
            // target has a recorded choice.
            executeAbilityInternal({
              ...ability,
              spell: addPerTargetChoicesToSpell(ability.spell, choicesByTargetId)
            } as Ability, caster, targetPosition, targetCharacterIds, undefined, selectedSpellTargets);
          });
          return;
        }

        const message = targetCharacterIds.length > 1
          ? `${ability.name} needs one choice per selected target before it can resolve.`
          : `${ability.name} needs a target choice before it can resolve.`;
        if (onNotification) onNotification(message, 'error');
        if (onLogEntry) {
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message,
            characterId: liveCaster.id,
            targetIds: targetCharacterIds,
            data: { abilityName: ability.name, pendingGap: 'SSO-PER-TARGET-CHOICE-EXECUTION-001' }
          });
        }
        cancelTargeting();
        return;
      }

      if (requiresUnassignedTeleportDestination(ability)) {
        // Direct execution calls still need protection. The map-click flow now
        // fills destinationsByTargetId first, but tests, AI callers, or future
        // panels may call executeAbility directly before destination assignment.
        const message = `${ability.name} needs destination choices for its teleport targets before it can resolve.`;
        if (onNotification) onNotification(message, 'error');
        if (onLogEntry) {
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message,
            characterId: liveCaster.id,
            targetIds: targetCharacterIds,
            data: { abilityName: ability.name, pendingGap: 'SSO-TELEPORT-DESTINATION-SELECTION-001' }
          });
        }
        cancelTargeting();
        return;
      }

      const action = buildAbilityCombatAction(ability, liveCaster, targetPosition, targetCharacterIds, selectedSpellTargets);

      if (!await onExecuteAction(action)) {
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

      const perTargetChoicesForExecution = existingPerTargetChoices
        ?? (perTargetChoice?.required && playerInput && targetCharacterIds.length === 1
          ? { [targetCharacterIds[0]]: playerInput }
          : undefined);
      const spellWithPerTargetChoices = perTargetChoicesForExecution
        ? addPerTargetChoicesToSpell(ability.spell, perTargetChoicesForExecution)
        : ability.spell;

      // Self-teleports use the clicked map tile as a destination, while the
      // caster remains the affected creature. Clone the spell payload at the
      // cast boundary so MovementCommand receives the same destination the
      // preview made selectable without mutating shared spell data.
      const spellForExecution = ability.targeting === 'self' && hasTeleportMovementEffect(ability)
        ? addTeleportDestinationToSpell(spellWithPerTargetChoices, targetPosition)
        : spellWithPerTargetChoices;

      const touchDelivery = targetCharacterIds.length === 1
        ? findFamiliarTouchDelivery(
            ability,
            liveCaster,
            currentCharacters.find(character => character.id === targetCharacterIds[0]) ?? null,
            currentCharacters
          )
        : null;

      if (touchDelivery) {
        // Find Familiar delivery uses the familiar's reaction. Spend it at the
        // same boundary as the caster's spell cost so the action economy cannot
        // deliver multiple touch spells through one familiar turn. The spell
        // still resolves as the caster's spell; this only updates the familiar
        // actor that provided the delivery origin.
        const updatedFamiliar = consumeActionCost(touchDelivery.familiar, { type: 'reaction' });
        charactersRef.current = charactersRef.current.map(character =>
          character.id === updatedFamiliar.id ? updatedFamiliar : character
        );
        onCharacterUpdate(updatedFamiliar);
        onAddSpellDeliveryVisual?.({
          spellId: spellForExecution.id,
          spellName: spellForExecution.name,
          casterId: liveCaster.id,
          familiarId: updatedFamiliar.id,
          targetId: targetCharacterIds[0],
          from: updatedFamiliar.position,
          to: targetPosition,
          label: 'FAMILIAR TOUCH'
        });
      }

      executeSpell(
        spellForExecution,
        casterAfterCost,
        targets,
        spellForExecution.level,
        playerInput,
        casterAfterCost,
        zoneRegistration,
        selectedSpellTargets
      );
      cancelTargeting();
      return;
    }

    // --- Path B: Ability System (Command Pattern) ---

    // Verify economy costs before command effects run. The turn manager remains
    // the authoritative executor, while the local resource snapshot protects
    // command results from restoring a stale caster.
    const action: CombatAction = {
      ...buildAbilityCombatAction(ability, liveCaster, targetPosition, targetCharacterIds, selectedSpellTargets),
      suppressAbilityEvents: true
    };

    if (!await onExecuteAction(action)) {
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
      activeLightSources: activeLightSources || [],
      pocketedSummons: pocketedSummonsRef.current || [],
      currentPlane: activePlane,
      mapData: mapDataRef.current ?? undefined
    };

    const commandGameState = buildCommandGameState(commandCharacters, mapDataRef.current, activePlane);

    // Use Factory
    const targets = targetCharacterIds
      .map(id => currentCharacters.find(c => c.id === id))
      .filter((c): c is CombatCharacter => !!c);

    const commands = AbilityCommandFactory.createCommands(ability, casterAfterCost, targets, commandGameState);

    // Snapshot the event trace immediately before command execution. Weapon
    // attack commands emit structured hit/miss events during execution; after
    // commands finish, those events can be projected into attackResults for
    // the reactive-only action replay below.
    const attackEventSequenceStart = combatEvents.createReplaySnapshot().nextSequence;

    // Execute
    const result = await CommandExecutor.execute(commands, currentState);

    if (result.success) {
      const attackResults = combatEvents.getAttackResultsSince(attackEventSequenceStart, {
        attackerId: liveCaster.id,
        targetIds: targetCharacterIds
      });

      if (attackResults.length > 0) {
        await onExecuteAction({
          ...action,
          id: `${action.id}-reactive-results`,
          cost: { type: 'free' },
          reactiveEventsOnly: true,
          suppressAbilityEvents: false,
          attackResults
        });
      }

      const finalCharacters = result.finalState.characters.map(finalChar =>
        finalChar.id === liveCaster.id
          ? applyResourceSnapshotToCaster(finalChar, casterAfterCost)
          : finalChar
      );
      const commandCharacterIds = new Set(commandCharacters.map(character => character.id));
      const finalCharacterIds = new Set(result.finalState.characters.map(character => character.id));
      const rosterChanged = commandCharacters.length !== result.finalState.characters.length ||
        commandCharacters.some(character => !finalCharacterIds.has(character.id)) ||
        result.finalState.characters.some(character => !commandCharacterIds.has(character.id));

      // Some commands change the encounter roster itself instead of only
      // changing caster/target fields. Familiar pocketing removes or restores a
      // summon actor, so publish the full roster when actor IDs change.
      if (rosterChanged && onCharactersReplace) {
        onCharactersReplace(finalCharacters);
      }

      // Pocketed summons are off-map state, not character fields. Publish that
      // side channel explicitly so dismiss/recall commands can survive beyond
      // the temporary command-state object used by this hook.
      if (onPocketedSummonsUpdate && result.finalState.pocketedSummons !== currentState.pocketedSummons) {
        onPocketedSummonsUpdate(result.finalState.pocketedSummons || []);
      }

      // Granted actions, including Wall of Light's later beam button, execute
      // through the ability-command path. Feed spell-zone mutations back to the
      // live encounter here so the next beam sees the shortened wall.
      if (onSpellZonesUpdate && result.finalState.spellZones !== currentState.spellZones) {
        onSpellZonesUpdate((result.finalState.spellZones || []) as ActiveSpellZone[]);
      }

      if (onSpellCreatedInventoryItems && result.finalState.spellCreatedInventoryItems?.length) {
        onSpellCreatedInventoryItems(result.finalState.spellCreatedInventoryItems);
      }

      // Propagate State Changes
      if (commands.length > 0 && !rosterChanged) {
        finalCharacters.forEach(finalChar => {
          const isTarget = targetCharacterIds.includes(finalChar.id);
          const isCaster = liveCaster.id === finalChar.id;

          // Only command-touched participants are replayed. This preserves the
          // action executor's Dash/Disengage mutations when an ability has no
          // command-side effect to apply.
          if (isTarget || isCaster) {
            onCharacterUpdate(finalChar);
          }
        });
      }

      // Propagate Logs
      if (onLogEntry) {
        result.finalState.combatLog.forEach(entry => onLogEntry(entry));
      }

      // Ability-backed utility commands can also create light sources. Publish
      // the final command-state light array just like the spell-backed path.
      if (onActiveLightSourcesUpdate && result.finalState.activeLightSources !== currentState.activeLightSources) {
        onActiveLightSourcesUpdate(result.finalState.activeLightSources || []);
      }

      if (attackResults.length > 0) {
        // Shield-style spells are reactions to being hit, but the command-backed
        // weapon attack path no longer had a bridge from structured hit events
        // into the reaction prompt. This pass restores that player-facing hook
        // for defensive reaction spells while leaving true pre-damage attack
        // cancellation as a later command-level timing improvement.
        const hitResults = attackResults.filter(attackResult => attackResult.isHit);

        for (const attackResult of hitResults) {
          const hitTarget = finalCharacters.find(character => character.id === attackResult.targetId);

          if (!hitTarget || hitTarget.actionEconomy?.reaction?.used || hitTarget.actionEconomy?.reaction?.remaining === 0) {
            continue;
          }

          // Only offer spells whose JSON says they are reaction-cast defensive
          // answers to a hit. This keeps the prompt focused on Shield-like
          // effects instead of exposing every reaction spell through this path.
          const hitReactionSpells = (hitTarget.abilities || [])
            .map(abilityOption => abilityOption.spell)
            .filter((spellOption): spellOption is Spell =>
              Boolean(spellOption) &&
              String(spellOption.castingTime?.unit ?? '').toLowerCase().includes('reaction') &&
              spellOption.effects.some(effect =>
                effect.type === 'DEFENSIVE' &&
                effect.reactionTrigger?.event === 'when_hit'
              )
            );

          if (hitReactionSpells.length === 0) {
            continue;
          }

          const selectedReactionId = await requestReaction(
            liveCaster.id,
            hitTarget.id,
            'on_hit',
            hitReactionSpells
          );
          const selectedReactionSpell = hitReactionSpells.find(spellOption => spellOption.id === selectedReactionId);

          if (selectedReactionSpell) {
            await executeSpell(
              selectedReactionSpell,
              hitTarget,
              [hitTarget],
              Math.max(selectedReactionSpell.level, 1)
            );
          }
        }
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
  }, [onExecuteAction, onCharacterUpdate, onCharactersReplace, onPocketedSummonsUpdate, cancelTargeting, executeSpell, requestReaction, onLogEntry, onNotification, onActiveLightSourcesUpdate, onSpellZonesUpdate, onSpellCreatedInventoryItems, onAddSpellDeliveryVisual, activeLightSources]); // Refs are stable, omitted

  const executeAbility = useCallback((...args: Parameters<typeof executeAbilityInternal>) => {
    return executeAbilityInternal(...args);
  }, [executeAbilityInternal]);


  /**
   * Initiates the targeting flow.
   * If 'self' targeting, executes immediately unless the self spell still
   * needs a destination choice, such as Misty Step.
   */
  const startTargeting = useCallback((ability: Ability, caster: CombatCharacter) => {
    baseStartTargeting(ability);

    if (ability.targeting === 'self' && ability.spell && hasTeleportMovementEffect(ability)) {
      previewTeleportDestinations(ability, caster, caster);
      return;
    }

    // Auto-cast for Self abilities
    if (ability.targeting === 'self') {
      executeAbility(ability, caster, caster.position, [caster.id]);
      return;
    }
  }, [executeAbility, baseStartTargeting, previewTeleportDestinations]);


  /**
   * Confirms selection of a target tile.
   * ACTION: Stabilized via Refs.
   */
  const selectTarget = useCallback((targetPosition: Position, caster: CombatCharacter) => {
    // Note: selectedAbility is from hook state (props/reactive), not ref.
    // This is fine as selectTarget is re-created if selectedAbility changes (which is rare during targeting).
    if (!selectedAbility) return false;

    if (pendingTeleportAssignment) {
      const activeTargetId = pendingTeleportAssignment.targetIds[pendingTeleportAssignment.activeTargetIndex];
      const activeTarget = charactersRef.current.find(character => character.id === activeTargetId);
      if (!activeTarget) {
        cancelTargeting();
        return false;
      }

      if (!isTeleportDestination(targetPosition)) {
        const message = `${selectedAbility.name} needs a visible, unoccupied destination for ${activeTarget.name} within range.`;
        if (onNotification) onNotification(message, 'error');
        if (onLogEntry) {
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message,
            characterId: caster.id,
            targetIds: pendingTeleportAssignment.targetIds,
            data: { abilityName: selectedAbility.name, activeTargetId, attemptedDestination: targetPosition }
          });
        }
        return false;
      }

      const destinationsByTargetId = {
        ...pendingTeleportAssignment.destinationsByTargetId,
        [activeTargetId]: targetPosition
      };
      const nextTargetIndex = pendingTeleportAssignment.activeTargetIndex + 1;
      const nextTargetId = pendingTeleportAssignment.targetIds[nextTargetIndex];
      const nextTarget = nextTargetId
        ? charactersRef.current.find(character => character.id === nextTargetId)
        : null;

      if (nextTarget) {
        setPendingTeleportAssignment({
          ...pendingTeleportAssignment,
          activeTargetIndex: nextTargetIndex,
          destinationsByTargetId
        });
        previewTeleportDestinations(pendingTeleportAssignment.ability, caster, nextTarget);
        if (onNotification) {
          onNotification(`Choose a teleport destination for ${nextTarget.name}.`, 'info');
        }
        return false;
      }

      // Once every moved target has a destination, clone the rich spell payload
      // with the assignment map and execute the normal spell path. This keeps
      // the map-click UI simple while giving MovementCommand exact per-target
      // landing spaces instead of fallback guesses.
      const assignedAbility = {
        ...pendingTeleportAssignment.ability,
        spell: pendingTeleportAssignment.ability.spell
          ? addTeleportDestinationsToSpell(pendingTeleportAssignment.ability.spell, destinationsByTargetId)
          : undefined
      } as Ability;

      setPendingTeleportAssignment(null);
      executeAbility(
        assignedAbility,
        caster,
        pendingTeleportAssignment.initialTargetPosition,
        pendingTeleportAssignment.targetIds
      );
      return true;
    }

    // Self-teleports target the caster but ask the player for a destination
    // tile. This branch lets the destination preview become an executable
    // choice without pretending the destination tile itself is the spell target.
    if (
      selectedAbility.targeting === 'self' &&
      selectedAbility.spell &&
      hasTeleportMovementEffect(selectedAbility)
    ) {
      if (isTeleportDestination(targetPosition)) {
        executeAbility(selectedAbility, caster, targetPosition, [caster.id]);
        return true;
      }

      // Self-teleport spells are in destination-pick mode, not ordinary
      // self-target mode. If a future map surface sends an invalid tile click
      // through this path, explain that the destination is illegal instead of
      // falling through to the generic "can only target yourself" message.
      const message = `${selectedAbility.name} needs a visible, unoccupied destination within range.`;
      if (onNotification) onNotification(message, 'error');
      if (onLogEntry) {
        onLogEntry({
          id: generateId(),
          timestamp: Date.now(),
          type: 'action',
          message,
          characterId: caster.id,
          data: { abilityName: selectedAbility.name, attemptedDestination: targetPosition }
        });
      }
      return false;
    }

    // WHAT CHANGED: Target selection now asks the validator for the reason a
    // target failed, not just the old true/false answer.
    // WHY: Manual combat should not silently ignore a clicked enemy. The action
    // still does not execute, and targeting remains active so the player can
    // pick a legal target without reselecting the ability.
    const selectedSpellTargets = buildSelectedSpellTargetsForPosition({
      position: targetPosition,
      characters: charactersRef.current,
      mapData: mapDataRef.current,
      pointPurpose: 'ground_target'
    });
    const selectedObjectTarget = selectedSpellTargets.find((target): target is Extract<SelectedSpellTarget, { kind: 'object' }> =>
      target.kind === 'object'
    );
    const objectTargetIsValid = !!selectedObjectTarget?.object && !!selectedAbility.spell && TargetResolver.isValidObjectTarget(
      selectedAbility.spell.targeting,
      caster,
      selectedObjectTarget.object,
      {
        isActive: true,
        characters: charactersRef.current,
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
        reactiveTriggers: reactiveTriggersRef.current || [],
        activeLightSources: activeLightSources || [],
        mapData: mapDataRef.current ?? undefined
      }
    );

    const validation = objectTargetIsValid
      ? { isValid: true }
      : getTargetValidation(selectedAbility, caster, targetPosition);
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

    if (requiresUnassignedTeleportDestination(selectedAbility)) {
      const firstTargetId = targetCharacterIds[0];
      const firstTarget = firstTargetId
        ? charactersRef.current.find(character => character.id === firstTargetId)
        : null;

      if (!firstTarget) {
        const message = `${selectedAbility.name} needs at least one teleport target before destinations can be chosen.`;
        if (onNotification) onNotification(message, 'error');
        if (onLogEntry) {
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message,
            characterId: caster.id,
            data: { abilityName: selectedAbility.name }
          });
        }
        return false;
      }

      // Multi-target teleports are target selection followed by destination
      // assignment. Keep targeting mode alive, preview legal destinations for
      // the first moved creature, and wait for one destination click per target
      // before spending the action or creating commands.
      setPendingTeleportAssignment({
        ability: selectedAbility,
        casterId: caster.id,
        targetIds: targetCharacterIds,
        initialTargetPosition: targetPosition,
        activeTargetIndex: 0,
        destinationsByTargetId: {}
      });
      previewTeleportDestinations(selectedAbility, caster, firstTarget);
      if (onNotification) {
        onNotification(`Choose a teleport destination for ${firstTarget.name}.`, 'info');
      }
      return false;
    }

    executeAbility(selectedAbility, caster, targetPosition, targetCharacterIds, undefined, selectedSpellTargets);
    return true;
  }, [selectedAbility, pendingTeleportAssignment, executeAbility, getTargetValidation, getCharacterAtPosition, getValidTargets, isTeleportDestination, previewTeleportDestinations, cancelTargeting, onLogEntry, onNotification]);


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
      activeLightSources: activeLightSources || []
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
      // Dropping concentration can remove light sources linked to that spell.
      // Publish the resulting light array so the map glow disappears with the
      // underlying concentration state.
      if (onActiveLightSourcesUpdate && result.finalState.activeLightSources !== currentState.activeLightSources) {
        onActiveLightSourcesUpdate(result.finalState.activeLightSources || []);
      }
    }
  }, [onCharacterUpdate, onLogEntry, onActiveLightSourcesUpdate, activeLightSources]);


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
    teleportDestinationPreview,
    pendingTeleportAssignment,
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
    requestReaction,
  }), [
    selectedAbility,
    targetingMode,
    aoePreview,
    teleportDestinationPreview,
    pendingTeleportAssignment,
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
    pendingReaction, // Reactive
    requestReaction // Stable
  ]);
};

export type AbilitySystem = ReturnType<typeof useAbilitySystem>;

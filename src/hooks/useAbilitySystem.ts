/**
 * @file src/hooks/useAbilitySystem.ts
 * Primary composite hook that orchestrates ability targeting, reaction handling, concentration, and combat execution.
 *
 * In combat encounters, a player or creature needs a unified interface to select abilities,
 * preview targeting areas on the battle map, validate legal targets, react to incoming attacks,
 * concentrate on ongoing magic, and execute actions. This composite hook brings together
 * dedicated sub-hooks (useTargeting, useTargetValidator, useActionEconomy, useReactionSystem,
 * useConcentration, and useAbilityExecution) into a single, memoized interface for the combat UI.
 *
 * Called by: CombatView.tsx, BattleMap.tsx, useBattleMap.ts, combat scenario previews
 * Depends on: src/hooks/ability/*, src/hooks/combat/*
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/09/2026, 14:28:33
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMap3D.tsx, components/BattleMap/BattleMapDemo.tsx, components/BattleMap/hooks/useBattleMapPointer.ts, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarioFramework.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/classes/ClassBattlefieldDemo.tsx, components/DesignPreview/steps/scenarioControls/counterspellNestedReactionsScenarioControls.ts, hooks/useBattleMap.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import type {
  ActiveAnimatedObject,
  ActiveExtradimensionalSpace,
  ActiveFireEffect,
  ActiveSpellEmanation,
  ActiveSpellForce,
  ActiveSpellGuardian,
  ActiveSpellHelper,
  ActiveSpellStructure,
  ActiveTruePolymorphTransformation,
  CombatCharacter,
  Position,
  CombatAction,
  BattleMapData,
  CombatLogEntry,
  ReactiveTrigger,
  Ability,
  LightSource,
  PocketedSummon,
  SpellDeliveryVisual,
  SelectedSpellTarget,
  SpellObjectImpact,
  SpellObjectRepair,
  SpellObjectAccessChange
} from '../types/combat';

import type { Item } from '../types/items';
import type { Spell } from '../types/spells';

import { SpellMovementVisualInput } from './movementUtils';
export type { SpellMovementVisualInput };

import { useTargeting } from './combat/useTargeting';
import type { Plane } from '../types/planes';
import { useTargetValidator } from './combat/useTargetValidator';
import type { ActiveSpellZone, MovementTriggerDebuff, ScheduledSpellEffect } from '../systems/spells/effects/triggerHandler';

// Sub-domain ability hooks
import { useActionEconomy } from './ability/useActionEconomy';
import {
  useReactionSystem,
  materializeAfterHitReactionSpell,
  normalizeAfterHitWeaponType,
  hasSpellInterruptionLineOfSight,
  hasSpellInterruptionVisibility,
  getSpellInterruptionDistanceFeet,
  isWithinSpellInterruptionRange,
  type PendingReaction
} from './ability/useReactionSystem';
import { useConcentration } from './ability/useConcentration';
import {
  beginAbilityTargeting,
  confirmTargetSelection,
  resolveExtendedValidTargets,
  type PendingTeleportDestinationAssignment as TargetSelectionPendingTeleportDestinationAssignment
} from './ability/targetSelection';
import {
  useAbilityExecution,
  resolveAreaTargetSelection,
  type AbilityExecutionRandomSources,
  type AreaTargetResolutionInput,
  type AreaTargetResolutionResult
} from './ability/useAbilityExecution';

// Re-export sub-hook utility functions and types for complete backward compatibility
export {
  materializeAfterHitReactionSpell,
  normalizeAfterHitWeaponType,
  hasSpellInterruptionLineOfSight,
  hasSpellInterruptionVisibility,
  getSpellInterruptionDistanceFeet,
  isWithinSpellInterruptionRange,
  resolveAreaTargetSelection
};

export type {
  AbilityExecutionRandomSources,
  PendingReaction,
  AreaTargetResolutionInput,
  AreaTargetResolutionResult
};

// ============================================================================
// Types
// ============================================================================

export interface UseAbilitySystemProps {
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
  /** Live non-creature spell helpers, such as Mage Hand or Unseen Servant-style records. */
  activeSpellHelpers?: ActiveSpellHelper[];
  onActiveSpellHelpersUpdate?: (helpers: ActiveSpellHelper[]) => void;
  /** Live spell forces, such as Spiritual Weapon or Bigby's Hand. */
  activeSpellForces?: ActiveSpellForce[];
  onActiveSpellForcesUpdate?: (forces: ActiveSpellForce[]) => void;
  /** Live guardian constructs, such as Guardian of Faith. */
  activeSpellGuardians?: ActiveSpellGuardian[];
  onActiveSpellGuardiansUpdate?: (guardians: ActiveSpellGuardian[]) => void;
  /** Live animated object records from Animate Objects or Tiny Servant. */
  activeAnimatedObjects?: ActiveAnimatedObject[];
  onActiveAnimatedObjectsUpdate?: (objects: ActiveAnimatedObject[]) => void;
  /** Live spell-created structures that have a map footprint. */
  activeSpellStructures?: ActiveSpellStructure[];
  onActiveSpellStructuresUpdate?: (structures: ActiveSpellStructure[]) => void;
  /** Live extradimensional entrances, such as Magnificent Mansion doors. */
  activeExtradimensionalSpaces?: ActiveExtradimensionalSpace[];
  onActiveExtradimensionalSpacesUpdate?: (spaces: ActiveExtradimensionalSpace[]) => void;
  /** Live caster-following emanation records. */
  activeSpellEmanations?: ActiveSpellEmanation[];
  onActiveSpellEmanationsUpdate?: (emanations: ActiveSpellEmanation[]) => void;
  /** Live object-result records that feed non-creature map markers. */
  spellObjectImpacts?: SpellObjectImpact[];
  onSpellObjectImpactsUpdate?: (impacts: SpellObjectImpact[]) => void;
  spellObjectRepairs?: SpellObjectRepair[];
  onSpellObjectRepairsUpdate?: (repairs: SpellObjectRepair[]) => void;
  spellObjectAccessChanges?: SpellObjectAccessChange[];
  onSpellObjectAccessChangesUpdate?: (accessChanges: SpellObjectAccessChange[]) => void;
  activeFireEffects?: ActiveFireEffect[];
  onActiveFireEffectsUpdate?: (effects: ActiveFireEffect[]) => void;
  /** Live transformation records that need object/form markers after True Polymorph resolves. */
  activeTruePolymorphTransformations?: ActiveTruePolymorphTransformation[];
  onActiveTruePolymorphTransformationsUpdate?: (transformations: ActiveTruePolymorphTransformation[]) => void;
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
  currentPlane?: Plane;
}

// PendingTeleportDestinationAssignment now lives with the targeting logic that owns it.
type PendingTeleportDestinationAssignment = TargetSelectionPendingTeleportDestinationAssignment;

// ============================================================================
// Main Composite Hook: useAbilitySystem
// ============================================================================

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
  activeSpellHelpers,
  onActiveSpellHelpersUpdate,
  activeSpellForces,
  onActiveSpellForcesUpdate,
  activeSpellGuardians,
  onActiveSpellGuardiansUpdate,
  activeAnimatedObjects,
  onActiveAnimatedObjectsUpdate,
  activeSpellStructures,
  onActiveSpellStructuresUpdate,
  activeExtradimensionalSpaces,
  onActiveExtradimensionalSpacesUpdate,
  activeSpellEmanations,
  onActiveSpellEmanationsUpdate,
  spellObjectImpacts,
  onSpellObjectImpactsUpdate,
  spellObjectRepairs,
  onSpellObjectRepairsUpdate,
  spellObjectAccessChanges,
  onSpellObjectAccessChangesUpdate,
  activeFireEffects,
  onActiveFireEffectsUpdate,
  activeTruePolymorphTransformations,
  onActiveTruePolymorphTransformationsUpdate,
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

  // ============================================================================
  // Stability Refs for State Isolation
  // ============================================================================
  // Event handlers and action dispatchers access current props through refs
  // to avoid re-binding callbacks and causing unnecessary UI re-renders.
  // ============================================================================
  const charactersRef = useRef(characters);
  const mapDataRef = useRef(mapData);
  const reactiveTriggersRef = useRef(reactiveTriggers);
  const currentPlaneRef = useRef(currentPlane);
  const pocketedSummonsRef = useRef(pocketedSummons);
  const activeSpellHelpersRef = useRef(activeSpellHelpers);
  const activeSpellForcesRef = useRef(activeSpellForces);
  const activeSpellGuardiansRef = useRef(activeSpellGuardians);
  const activeAnimatedObjectsRef = useRef(activeAnimatedObjects);
  const activeSpellStructuresRef = useRef(activeSpellStructures);
  const activeExtradimensionalSpacesRef = useRef(activeExtradimensionalSpaces);
  const activeSpellEmanationsRef = useRef(activeSpellEmanations);
  const spellObjectImpactsRef = useRef(spellObjectImpacts);
  const spellObjectRepairsRef = useRef(spellObjectRepairs);
  const spellObjectAccessChangesRef = useRef(spellObjectAccessChanges);
  const activeFireEffectsRef = useRef(activeFireEffects);
  const activeTruePolymorphTransformationsRef = useRef(activeTruePolymorphTransformations);

  useEffect(() => {
    charactersRef.current = characters;
    mapDataRef.current = mapData;
    reactiveTriggersRef.current = reactiveTriggers;
    currentPlaneRef.current = currentPlane;
    pocketedSummonsRef.current = pocketedSummons;
    activeSpellHelpersRef.current = activeSpellHelpers;
    activeSpellForcesRef.current = activeSpellForces;
    activeSpellGuardiansRef.current = activeSpellGuardians;
    activeAnimatedObjectsRef.current = activeAnimatedObjects;
    activeSpellStructuresRef.current = activeSpellStructures;
    activeExtradimensionalSpacesRef.current = activeExtradimensionalSpaces;
    activeSpellEmanationsRef.current = activeSpellEmanations;
    spellObjectImpactsRef.current = spellObjectImpacts;
    spellObjectRepairsRef.current = spellObjectRepairs;
    spellObjectAccessChangesRef.current = spellObjectAccessChanges;
    activeFireEffectsRef.current = activeFireEffects;
    activeTruePolymorphTransformationsRef.current = activeTruePolymorphTransformations;
  }, [
    characters,
    mapData,
    reactiveTriggers,
    currentPlane,
    pocketedSummons,
    activeSpellHelpers,
    activeSpellForces,
    activeSpellGuardians,
    activeAnimatedObjects,
    activeSpellStructures,
    activeExtradimensionalSpaces,
    activeSpellEmanations,
    spellObjectImpacts,
    spellObjectRepairs,
    spellObjectAccessChanges,
    activeFireEffects,
    activeTruePolymorphTransformations
  ]);

  // ============================================================================
  // Sub-Hook Compositions
  // ============================================================================

  // 1. Selection & Targeting State
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

  // 2. Target Validation
  const {
    isValidTarget,
    getTargetValidation,
    getValidTargets: getBaseValidTargets,
    getCharacterAtPosition
  } = useTargetValidator({ characters, mapData });

  // 3. Action Economy Tracking
  const _actionEconomy = useActionEconomy();

  // 4. Reaction System
  const {
    pendingReaction,
    processedPostDamageReactionEventIdsRef,
    requestReaction,
    replayPostDamageReactionEvents
  } = useReactionSystem({
    charactersRef,
    mapDataRef,
    onCharacterUpdate,
    onLogEntry
  });

  // Local targeting state
  const [pendingTeleportAssignment, setPendingTeleportAssignment] = useState<PendingTeleportDestinationAssignment | null>(null);
  const [targetValidationReason, setTargetValidationReason] = useState<string | null>(null);

  const cancelTargeting = useCallback(() => {
    setPendingTeleportAssignment(null);
    setTargetValidationReason(null);
    baseCancelTargeting();
  }, [baseCancelTargeting]);

  // 5. Ability & Spell Execution Engine
  const {
    executeSpell,
    executeAbility,
    executeAbilityInternal,
    resetProcessedAbilityExecutionEvents
  } = useAbilityExecution({
    charactersRef,
    mapDataRef,
    reactiveTriggersRef,
    currentPlaneRef,
    pocketedSummonsRef,
    activeSpellHelpersRef,
    activeSpellForcesRef,
    activeSpellGuardiansRef,
    activeAnimatedObjectsRef,
    activeSpellStructuresRef,
    activeExtradimensionalSpacesRef,
    activeSpellEmanationsRef,
    spellObjectImpactsRef,
    spellObjectRepairsRef,
    spellObjectAccessChangesRef,
    activeFireEffectsRef,
    activeTruePolymorphTransformationsRef,
    activeLightSources,
    spellZones,
    onExecuteAction,
    onCharacterUpdate,
    onCharactersReplace,
    onLogEntry,
    onNotification,
    onRequestInput,
    onReactiveTriggerUpdate,
    onActiveLightSourcesUpdate,
    onPocketedSummonsUpdate,
    onActiveSpellHelpersUpdate,
    onActiveSpellForcesUpdate,
    onActiveSpellGuardiansUpdate,
    onActiveAnimatedObjectsUpdate,
    onActiveSpellStructuresUpdate,
    onActiveExtradimensionalSpacesUpdate,
    onActiveSpellEmanationsUpdate,
    onSpellObjectImpactsUpdate,
    onSpellObjectRepairsUpdate,
    onSpellObjectAccessChangesUpdate,
    onActiveFireEffectsUpdate,
    onActiveTruePolymorphTransformationsUpdate,
    onMapUpdate,
    onAddSpellZone,
    onSpellZonesUpdate,
    onSpellCreatedInventoryItems,
    onAddScheduledSpellEffect,
    onAddMovementDebuff,
    onAddSpellMovementVisual,
    onAddSpellDeliveryVisual,
    requestReaction,
    processedPostDamageReactionEventIdsRef,
    cancelTargeting
  });

  // 6. Concentration Management
  const { dropConcentration } = useConcentration({
    charactersRef,
    reactiveTriggersRef,
    mapDataRef,
    activeLightSources,
    spellZones,
    activeSpellHelpersRef,
    activeSpellForcesRef,
    activeSpellGuardiansRef,
    activeAnimatedObjectsRef,
    activeSpellStructuresRef,
    activeExtradimensionalSpacesRef,
    activeSpellEmanationsRef,
    spellObjectImpactsRef,
    spellObjectRepairsRef,
    spellObjectAccessChangesRef,
    activeFireEffectsRef,
    activeTruePolymorphTransformationsRef,
    onCharacterUpdate,
    onLogEntry,
    onActiveLightSourcesUpdate,
    onActiveSpellHelpersUpdate,
    onActiveSpellForcesUpdate,
    onActiveSpellGuardiansUpdate,
    onActiveAnimatedObjectsUpdate,
    onActiveSpellStructuresUpdate,
    onActiveExtradimensionalSpacesUpdate,
    onActiveSpellEmanationsUpdate,
    onSpellObjectImpactsUpdate,
    onSpellObjectRepairsUpdate,
    onSpellObjectAccessChangesUpdate,
    onActiveFireEffectsUpdate,
    onActiveTruePolymorphTransformationsUpdate,
    onSpellZonesUpdate,
    onMapUpdate
  });

  // ============================================================================
  // Extended Valid Targets (Creatures + Registered Map Objects)
  // ============================================================================
  // The bodies of these three callbacks live in ./ability/targetSelection.ts (MOD-3.4).
  // The useCallback wrappers and their dependency arrays stay here so this hook's
  // hook-call order and memoization behavior are unchanged.
  const getValidTargets = useCallback((ability: Ability, caster: CombatCharacter): Position[] => {
    return resolveExtendedValidTargets(
      { getBaseValidTargets, charactersRef, mapDataRef, reactiveTriggersRef, activeLightSources },
      ability,
      caster
    );
  }, [getBaseValidTargets, activeLightSources]);

  // ============================================================================
  // Targeting Entry & Selection Handlers
  // ============================================================================

  /**
   * Initiates targeting flow for an ability.
   * Auto-casts self abilities unless they need a destination (like Misty Step)
   * or a creature attack augment (like True Strike).
   */
  const startTargeting = useCallback((ability: Ability, caster: CombatCharacter) => {
    beginAbilityTargeting(
      { setTargetValidationReason, baseStartTargeting, previewTeleportDestinations, executeAbility },
      ability,
      caster
    );
  }, [executeAbility, baseStartTargeting, previewTeleportDestinations]);

  /**
   * Confirms selection of a target tile on the battle map.
   */
  const selectTarget = useCallback((targetPosition: Position, caster: CombatCharacter, selectedSpellTargetsOverride?: SelectedSpellTarget[]) => {
    return confirmTargetSelection(
      {
        selectedAbility,
        pendingTeleportAssignment,
        setPendingTeleportAssignment,
        setTargetValidationReason,
        charactersRef,
        mapDataRef,
        reactiveTriggersRef,
        activeLightSources,
        cancelTargeting,
        isTeleportDestination,
        previewTeleportDestinations,
        executeAbility,
        getTargetValidation,
        getCharacterAtPosition,
        getValidTargets,
        onNotification,
        onLogEntry
      },
      targetPosition,
      caster,
      selectedSpellTargetsOverride
    );
  }, [
    selectedAbility,
    pendingTeleportAssignment,
    executeAbility,
    getTargetValidation,
    getCharacterAtPosition,
    getValidTargets,
    isTeleportDestination,
    previewTeleportDestinations,
    cancelTargeting,
    onLogEntry,
    onNotification
  ]);

  // ============================================================================
  // Memoized Return Object
  // ============================================================================
  return useMemo(() => ({
    selectedAbility,
    targetingMode,
    aoePreview,
    teleportDestinationPreview,
    pendingTeleportAssignment,
    targetValidationReason,
    getValidTargets,
    startTargeting,
    selectTarget,
    cancelTargeting,
    previewAoE,
    isValidTarget,
    getTargetValidation,
    executeSpell,
    executeAbility,
    resetProcessedAbilityExecutionEvents,
    dropConcentration,
    pendingReaction,
    requestReaction,
    replayPostDamageReactionEvents,
  }), [
    selectedAbility,
    targetingMode,
    aoePreview,
    teleportDestinationPreview,
    pendingTeleportAssignment,
    targetValidationReason,
    getValidTargets,
    startTargeting,
    selectTarget,
    cancelTargeting,
    previewAoE,
    isValidTarget,
    getTargetValidation,
    executeSpell,
    executeAbility,
    resetProcessedAbilityExecutionEvents,
    dropConcentration,
    pendingReaction,
    requestReaction,
    replayPostDamageReactionEvents
  ]);
};

export type AbilitySystem = ReturnType<typeof useAbilitySystem>;

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 13:55:58
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 23 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/hooks/ability/useAbilityExecution.ts
 * Dispatches combat abilities and spells through the command system, validating targets and consuming costs.
 *
 * This hook is the central execution engine for actions taken in combat. When a player
 * or AI entity clicks an ability (such as casting Fireball, swinging a sword, or using
 * Second Wind), this module validates that the targets are legal, prompts for any required
 * choices (like mode selection or free-form DM input), checks for reactions like Counterspell,
 * spends the action and spell slot costs, builds command objects, and executes them through
 * the CommandExecutor. It then broadcasts the resulting state changes (damage, healing,
 * light sources, spell zones, summoned helpers, and animations) to the rest of the game.
 *
 * Called by: useAbilitySystem.ts
 * Depends on: Command system, targeting validators, reaction system, action economy
 */

import { useCallback, useRef } from 'react';
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
  CombatState,
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
} from '../../types/combat';
import type { Item } from '../../types/items';
import type { Spell, SpellEffect, UtilityEffect } from '../../types/spells';
import { isExecutableControlOption } from '../../types/spells';
import { SpellCommandFactory, AbilityCommandFactory, CommandExecutor } from '../../commands';
import { generateId } from '../../utils/combat';
import { calculateSpellDC, rollSavingThrow } from '../../utils/character';
import { calculateAffectedTiles, type AoEParams } from '../../utils/combat/aoeCalculations';
import { resolveAoEParams } from '../../utils/spatial/targetingUtils';
import type { Plane } from '../../types/planes';
import { findTouchDeliveryActor, getBloodCircleRejection, getTouchDeliveryActionCost } from '../combat/useTargetValidator';
import { canAffordActionCost, consumeActionCost } from '../../utils/combat/actionEconomyUtils';
import {
  createMovementDebuff,
  createScheduledSpellEffect,
  createSpellZoneFromAoEParams,
  createTerrainSpellZoneFromAoEParams,
  type ActiveSpellZone,
  type MovementTriggerDebuff,
  type ScheduledSpellEffect
} from '../../systems/spells/effects/triggerHandler';
import {
  hasPersistentAreaTrigger,
  isTerrainEffect,
  hasScheduledEffectTrigger,
  hasTargetMovementTrigger,
  isMovementEffect,
  getDurationRounds,
  getRecurringMechanics
} from '../spellEffectUtils';
import {
  SpellMovementVisualInput,
  getMovementVisualType,
  resolveImmediateAfterForcedMovementRepeatSaves,
  buildResolvedMovementVisualPath
} from '../movementUtils';
import {
  hasTeleportMovementEffect,
  addTeleportDestinationToSpell,
  requiresUnassignedTeleportDestination
} from '../teleportUtils';
import {
  addPerTargetChoicesToSpell,
  getPerTargetChoicesFromSpell,
  requestPerTargetChoices
} from '../perTargetChoiceUtils';
import {
  buildAbilityCombatAction,
  getZoneAreaFromAoEParams,
  applyResourceSnapshotToCaster,
  replaceCasterForCommandState,
  buildCommandGameState
} from '../actionUtils';
import { combatEvents } from '../../systems/events/CombatEvents';
import { TargetResolver } from '../../systems/spells/targeting/TargetResolver';
import { validateSpellTargetSelection } from '../../systems/spells/targeting/SpellTargetSelectionValidator';
import { resolvePostDamageReactionQueue } from '../../systems/combat/reactions/postDamageReactionQueue';
import {
  getCastingTriggerActionCost,
  restoreInterruptedSpellSlot,
  applyAbilityUsageState
} from './useActionEconomy';
import {
  materializeAfterHitReactionSpell,
  normalizeAfterHitWeaponType,
  hasSpellInterruptionVisibility,
  isWithinSpellInterruptionRange
} from './useReactionSystem';

// ============================================================================
// Types
// ============================================================================

/**
 * Optional deterministic random number generators for testing and scenario previews.
 */
export interface AbilityExecutionRandomSources {
  attackRollRng?: () => number;
  damageRng?: () => number;
  saveRng?: () => number;
  /** Stable identity for an ability event to ensure idempotent execution. */
  executionEventId?: string;
  /** Explicit decision for retained prompts. */
  executionDecision?: 'accept' | 'decline';
}

export interface AreaTargetResolutionInput {
  spell: Spell;
  caster: CombatCharacter;
  targetPosition: Position;
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  selectedSpellTargets?: SelectedSpellTarget[];
}

export interface AreaTargetResolutionResult {
  targetCharacterIds: string[];
  selectedSpellTargets: SelectedSpellTarget[];
}

export interface UseAbilityExecutionProps {
  charactersRef: React.MutableRefObject<CombatCharacter[]>;
  mapDataRef: React.MutableRefObject<BattleMapData | null>;
  reactiveTriggersRef: React.MutableRefObject<ReactiveTrigger[] | undefined>;
  currentPlaneRef: React.MutableRefObject<Plane | undefined>;
  pocketedSummonsRef: React.MutableRefObject<PocketedSummon[] | undefined>;
  activeSpellHelpersRef: React.MutableRefObject<ActiveSpellHelper[] | undefined>;
  activeSpellForcesRef: React.MutableRefObject<ActiveSpellForce[] | undefined>;
  activeSpellGuardiansRef: React.MutableRefObject<ActiveSpellGuardian[] | undefined>;
  activeAnimatedObjectsRef: React.MutableRefObject<ActiveAnimatedObject[] | undefined>;
  activeSpellStructuresRef: React.MutableRefObject<ActiveSpellStructure[] | undefined>;
  activeExtradimensionalSpacesRef: React.MutableRefObject<ActiveExtradimensionalSpace[] | undefined>;
  activeSpellEmanationsRef: React.MutableRefObject<ActiveSpellEmanation[] | undefined>;
  spellObjectImpactsRef: React.MutableRefObject<SpellObjectImpact[] | undefined>;
  spellObjectRepairsRef: React.MutableRefObject<SpellObjectRepair[] | undefined>;
  spellObjectAccessChangesRef: React.MutableRefObject<SpellObjectAccessChange[] | undefined>;
  activeFireEffectsRef: React.MutableRefObject<ActiveFireEffect[] | undefined>;
  activeTruePolymorphTransformationsRef: React.MutableRefObject<ActiveTruePolymorphTransformation[] | undefined>;
  activeLightSources?: LightSource[];
  spellZones?: ActiveSpellZone[];
  onExecuteAction: (action: CombatAction) => boolean | Promise<boolean>;
  onCharacterUpdate: (character: CombatCharacter) => void;
  onCharactersReplace?: (characters: CombatCharacter[]) => void;
  onLogEntry?: (entry: CombatLogEntry) => void;
  onNotification?: (message: string, type: 'info' | 'error' | 'warning' | 'success') => void;
  onRequestInput?: (spell: Spell, onConfirm: (input: string) => void) => void;
  onReactiveTriggerUpdate?: (triggers: ReactiveTrigger[]) => void;
  onActiveLightSourcesUpdate?: (lightSources: LightSource[]) => void;
  onPocketedSummonsUpdate?: (pocketedSummons: PocketedSummon[]) => void;
  onActiveSpellHelpersUpdate?: (helpers: ActiveSpellHelper[]) => void;
  onActiveSpellForcesUpdate?: (forces: ActiveSpellForce[]) => void;
  onActiveSpellGuardiansUpdate?: (guardians: ActiveSpellGuardian[]) => void;
  onActiveAnimatedObjectsUpdate?: (objects: ActiveAnimatedObject[]) => void;
  onActiveSpellStructuresUpdate?: (structures: ActiveSpellStructure[]) => void;
  onActiveExtradimensionalSpacesUpdate?: (spaces: ActiveExtradimensionalSpace[]) => void;
  onActiveSpellEmanationsUpdate?: (emanations: ActiveSpellEmanation[]) => void;
  onSpellObjectImpactsUpdate?: (impacts: SpellObjectImpact[]) => void;
  onSpellObjectRepairsUpdate?: (repairs: SpellObjectRepair[]) => void;
  onSpellObjectAccessChangesUpdate?: (accessChanges: SpellObjectAccessChange[]) => void;
  onActiveFireEffectsUpdate?: (effects: ActiveFireEffect[]) => void;
  onActiveTruePolymorphTransformationsUpdate?: (transformations: ActiveTruePolymorphTransformation[]) => void;
  onMapUpdate?: (mapData: BattleMapData) => void;
  onAddSpellZone?: (zone: ActiveSpellZone) => void;
  onSpellZonesUpdate?: (zones: ActiveSpellZone[]) => void;
  onSpellCreatedInventoryItems?: (items: Item[]) => void;
  onAddScheduledSpellEffect?: (effect: ScheduledSpellEffect) => void;
  onAddMovementDebuff?: (debuff: MovementTriggerDebuff) => void;
  onAddSpellMovementVisual?: (visual: SpellMovementVisualInput) => void;
  onAddSpellDeliveryVisual?: (visual: Omit<SpellDeliveryVisual, 'id' | 'createdAt'>) => void;
  requestReaction: (
    attackerId: string,
    targetId: string,
    triggerType: 'on_hit' | 'on_cast' | 'on_move' | 'on_take_damage' | 'opportunity_attack',
    reactionSpells?: Array<Spell | Ability>,
    reactionWeapons?: Ability[]
  ) => Promise<string | null>;
  processedPostDamageReactionEventIdsRef: React.MutableRefObject<Set<string>>;
  cancelTargeting: () => void;
}

// ============================================================================
// Helper Functions: Spell Control & Area Calculations
// ============================================================================

/**
 * Extracts selectable command words from utility spells (such as Command or Suggestion).
 */
export const getSpellControlOptions = (spell: Spell): NonNullable<UtilityEffect['controlOptions']> => {
  return spell.effects.flatMap(effect => {
    if (effect.type !== 'UTILITY') {
      return [];
    }
    return ((effect as UtilityEffect).controlOptions ?? []).filter(isExecutableControlOption);
  });
};

/**
 * Computes the persistent area of effect shape and dimensions for a persistent spell zone.
 */
export const getPersistentSpellZoneArea = (
  spell: Spell,
  areaOfEffect: { shape: string },
  aoeParams: AoEParams
): { shape: string; size: number } => {
  const targetingArea = getZoneAreaFromAoEParams(areaOfEffect, aoeParams);
  if (targetingArea.size > 0) {
    return targetingArea;
  }

  // Point-targeted summons can have a secondary threat radius in spatialDetails.
  const hasProximityMechanic = spell.effects.some(effect =>
    getRecurringMechanics(effect).some(mechanic => mechanic.timing === 'on_entity_proximity')
  );
  const proximityForm = spell.targeting.spatialDetails?.forms?.find(form =>
    form.shape.toLowerCase() === 'emanation' &&
    form.sizeUnit === 'feet' &&
    typeof form.size === 'number' &&
    form.size > 0
  );

  return hasProximityMechanic && proximityForm?.size
    ? { shape: 'sphere', size: proximityForm.size }
    : targetingArea;
};

/**
 * Resolves any spellcasting restriction saving throws (such as from Silence or Dissonant Whispers)
 * before casting begins. If the save fails, the spell is wasted.
 */
export const resolveSpellcastingRestrictions = (
  caster: CombatCharacter,
  characters: CombatCharacter[],
  spell: Spell,
  onLogEntry?: (entry: CombatLogEntry) => void,
  onNotification?: (message: string, type: 'info' | 'error' | 'warning' | 'success') => void
): boolean => {
  const liveCaster = characters.find(character => character.id === caster.id) ?? caster;
  const restrictions = (liveCaster.statusEffects || [])
    .map(effect => effect.spellcastingRestriction)
    .filter((restriction): restriction is NonNullable<CombatCharacter['statusEffects'][number]['spellcastingRestriction']> => Boolean(restriction));

  for (const restriction of restrictions) {
    const sourceCaster = restriction.dc === undefined
      ? characters.find(character => character.id === liveCaster.statusEffects?.find(effect => effect.spellcastingRestriction === restriction)?.sourceCasterId)
      : undefined;
    const saveDC = restriction.dc ?? (sourceCaster ? calculateSpellDC(sourceCaster) : 10);
    const saveResult = rollSavingThrow(liveCaster, restriction.saveType as any, saveDC);

    onLogEntry?.({
      id: generateId(),
      timestamp: Date.now(),
      type: 'status',
      message: `${liveCaster.name} ${saveResult.success ? 'succeeds' : 'fails'} the ${restriction.saveType} save required by ${spell.name} (${saveResult.total} vs DC ${saveDC}).`,
      characterId: liveCaster.id,
      targetIds: [liveCaster.id],
      data: {
        spellId: spell.id,
        preCastRestriction: true,
        saveSucceeded: saveResult.success,
        failureOutcome: restriction.failureOutcome
      } as any
    });

    if (!saveResult.success) {
      const message = `${spell.name} is wasted because ${liveCaster.name} failed the required ${restriction.saveType} save.`;
      onNotification?.(message, 'warning');
      onLogEntry?.({
        id: generateId(),
        timestamp: Date.now(),
        type: 'action',
        message,
        characterId: liveCaster.id,
        targetIds: [liveCaster.id],
        data: { spellId: spell.id, preCastRestriction: true, castingFailed: true } as any
      });
      return false;
    }
  }

  return true;
};

const isCreatureSelectedSpellTarget = (
  selectedTarget: SelectedSpellTarget
): selectedTarget is Extract<SelectedSpellTarget, { kind: 'creature' }> => selectedTarget.kind === 'creature';

const buildVisibilityCheckState = (
  characters: CombatCharacter[],
  mapData: BattleMapData | null
): CombatState => ({
  isActive: true,
  characters,
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
  reactiveTriggers: [],
  activeLightSources: [],
  mapData: mapData ?? undefined
});

const canSelectAreaCreature = (
  spell: Spell,
  caster: CombatCharacter,
  target: CombatCharacter,
  characters: CombatCharacter[],
  mapData: BattleMapData | null
): boolean => {
  const requiresVisibleSelection = spell.targeting.areaTargetSelection?.requiresLineOfSight ?? spell.targeting.lineOfSight;
  if (!requiresVisibleSelection) {
    return true;
  }

  const visibilityTargeting: Spell['targeting'] = {
    ...spell.targeting,
    range: Math.max((spell.targeting as any).range ?? 0, 9999)
  } as any;

  return TargetResolver.getTargetRejectionReason(
    visibilityTargeting,
    caster,
    target,
    buildVisibilityCheckState(characters, mapData)
  ) === null;
};

/**
 * Resolves which creatures within an area of effect are legally targeted by an area spell.
 */
export const resolveAreaTargetSelection = ({
  spell,
  caster,
  targetPosition,
  characters,
  mapData,
  selectedSpellTargets
}: AreaTargetResolutionInput): AreaTargetResolutionResult => {
  const areaOfEffect = (spell.targeting as any).areaOfEffect;
  const params = areaOfEffect ? resolveAoEParams(areaOfEffect, targetPosition, caster, spell.name) : null;

  if (!params) {
    return {
      targetCharacterIds: [],
      selectedSpellTargets: []
    };
  }

  const affectedTiles = calculateAffectedTiles(params);
  const affectedCharacters = characters.filter(character =>
    affectedTiles.some(tile => tile.x === character.position.x && tile.y === character.position.y)
  );

  const explicitCreatureTargets = (selectedSpellTargets ?? []).filter(isCreatureSelectedSpellTarget);
  const explicitCreatureIds = new Set(explicitCreatureTargets.map(target => target.id));
  const hasExplicitCasterChoice = spell.targeting.areaTargetSelection?.mode === 'caster_choice' &&
    explicitCreatureTargets.some(target => target.id !== caster.id);

  const visibleCandidates = affectedCharacters.filter(character => {
    // Sword Burst is self-centered and should not hit the caster.
    if (
      spell.range.type === 'self' &&
      !spell.targeting.areaTargetSelection &&
      character.id === caster.id
    ) {
      return false;
    }

    return canSelectAreaCreature(spell, caster, character, characters, mapData);
  });

  const finalCharacters = hasExplicitCasterChoice
    ? visibleCandidates.filter(character => explicitCreatureIds.has(character.id))
    : visibleCandidates;

  const resolvedSelectedSpellTargets = hasExplicitCasterChoice
    ? explicitCreatureTargets.filter(target => finalCharacters.some(character => character.id === target.id))
    : finalCharacters.map(character => ({ kind: 'creature', id: character.id } as SelectedSpellTarget));

  return {
    targetCharacterIds: finalCharacters.map(character => character.id),
    selectedSpellTargets: resolvedSelectedSpellTargets
  };
};

// ============================================================================
// React Sub-Hook: useAbilityExecution
// ============================================================================

export const useAbilityExecution = ({
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
}: UseAbilityExecutionProps) => {
  // Stable tracking of processed ability execution IDs to prevent double execution.
  const processedAbilityExecutionEventIdsRef = useRef<Set<string>>(new Set<string>());

  const resetProcessedAbilityExecutionEvents = useCallback(() => {
    processedAbilityExecutionEventIdsRef.current.clear();
  }, []);

  // --- Spell Execution ---
  const executeSpell = useCallback(
    async function executeSpellImpl(
      spell: Spell,
      caster: CombatCharacter,
      targets: CombatCharacter[],
      castAtLevel: number,
      playerInput?: string,
      resourceSnapshot?: CombatCharacter,
      zoneRegistration?: { areaOfEffect: { shape: string }; aoeParams: AoEParams },
      selectedSpellTargets?: SelectedSpellTarget[],
      interruptionDepth = 0
    ): Promise<boolean> {
      const currentCharacters = charactersRef.current;
      const currentTriggers = reactiveTriggersRef.current;
      const currentMapData = mapDataRef.current;
      const activePlane = currentPlaneRef.current;
      const commandCharacters = resourceSnapshot
        ? replaceCasterForCommandState(currentCharacters, resourceSnapshot)
        : currentCharacters;

      // 0. Check for Input Requirements (Mode choice, control options, AI DM input)
      if (spell.modeChoice && !playerInput) {
        if (onRequestInput) {
          onRequestInput(spell, (input) => {
            executeSpellImpl(spell, caster, targets, castAtLevel, input, resourceSnapshot, zoneRegistration, selectedSpellTargets, interruptionDepth);
          });
          return true;
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
        return false;
      }

      const controlOptions = getSpellControlOptions(spell);
      if (controlOptions.length > 1 && !playerInput) {
        if (onRequestInput) {
          onRequestInput(spell, (input) => {
            executeSpellImpl(spell, caster, targets, castAtLevel, input, resourceSnapshot, zoneRegistration, selectedSpellTargets, interruptionDepth);
          });
          return true;
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
        return false;
      }

      if (spell.arbitrationType === 'ai_dm' && spell.aiContext?.playerInputRequired && !playerInput) {
        if (onRequestInput) {
          onRequestInput(spell, (input) => {
            executeSpellImpl(spell, caster, targets, castAtLevel, input, resourceSnapshot, zoneRegistration, selectedSpellTargets, interruptionDepth);
          });
          return true;
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
        combatLog: [],
        reactiveTriggers: currentTriggers || [],
        activeLightSources: activeLightSources || [],
        activeSpellHelpers: activeSpellHelpersRef.current || [],
        activeSpellForces: activeSpellForcesRef.current || [],
        activeSpellGuardians: activeSpellGuardiansRef.current || [],
        activeAnimatedObjects: activeAnimatedObjectsRef.current || [],
        activeSpellStructures: activeSpellStructuresRef.current || [],
        activeExtradimensionalSpaces: activeExtradimensionalSpacesRef.current || [],
        activeSpellEmanations: activeSpellEmanationsRef.current || [],
        spellObjectImpacts: spellObjectImpactsRef.current || [],
        spellObjectRepairs: spellObjectRepairsRef.current || [],
        spellObjectAccessChanges: spellObjectAccessChangesRef.current || [],
        activeFireEffects: activeFireEffectsRef.current || [],
        activeTruePolymorphTransformations: activeTruePolymorphTransformationsRef.current || [],
        currentPlane: activePlane,
        mapData: currentMapData ?? undefined
      };

      // Resolve pre-cast restrictions (e.g. Silence)
      if (!resolveSpellcastingRestrictions(caster, commandCharacters, spell, onLogEntry, onNotification)) {
        return false;
      }

      // Spell-interruption reactions (Counterspell)
      if (interruptionDepth < 2) {
        for (const possibleReactor of commandCharacters) {
          const isSameCreature = possibleReactor.id === caster.id;
          if (isSameCreature) continue;

          const interruptionSpells = (possibleReactor.abilities || [])
            .map(abilityOption => abilityOption.spell)
            .filter((spellOption): spellOption is Spell => {
              const trigger = spellOption?.castingTrigger;
              const maxRange = spellOption?.interruptionState?.rangeFeet ?? trigger?.maxRangeFeet ?? spellOption?.range?.distance ?? 0;
              const visibilityRequired = spellOption?.interruptionState?.visibilityRequired ?? true;
              const interruptionCost = spellOption ? getCastingTriggerActionCost(spellOption) : null;

              return Boolean(spellOption) &&
                trigger?.type === 'when_visible_creature_casts_spell' &&
                trigger.requiredCost === spellOption.castingTime?.unit &&
                isWithinSpellInterruptionRange(possibleReactor, caster, maxRange) &&
                (!visibilityRequired || hasSpellInterruptionVisibility(possibleReactor, caster, currentMapData)) &&
                Boolean(interruptionCost) &&
                canAffordActionCost(possibleReactor, interruptionCost!);
            });

          if (interruptionSpells.length === 0) continue;

          const selectedReactionId = await requestReaction(
            caster.id,
            possibleReactor.id,
            'on_cast',
            interruptionSpells
          );
          const selectedInterruptionSpell = interruptionSpells.find(spellOption => spellOption.id === selectedReactionId);
          if (!selectedInterruptionSpell) continue;

          const interruptionState = selectedInterruptionSpell.interruptionState;
          const saveDC = calculateSpellDC(possibleReactor);
          const saveResult = rollSavingThrow(caster, interruptionState?.saveType ?? 'Constitution', saveDC);
          const interruptionCost = getCastingTriggerActionCost(selectedInterruptionSpell);
          const reactorAfterCost = consumeActionCost(possibleReactor, interruptionCost);
          charactersRef.current = charactersRef.current.map(character =>
            character.id === reactorAfterCost.id ? reactorAfterCost : character
          );
          onCharacterUpdate(reactorAfterCost);

          const interruptionSpellResolved = await executeSpell(
            selectedInterruptionSpell,
            reactorAfterCost,
            [caster],
            Math.max(selectedInterruptionSpell.level, 1),
            undefined,
            reactorAfterCost,
            undefined,
            undefined,
            interruptionDepth + 1
          );

          if (interruptionSpellResolved === false) continue;

          if (onLogEntry) {
            onLogEntry({
              id: generateId(),
              timestamp: Date.now(),
              type: 'action',
              message: `${possibleReactor.name} tries to interrupt ${caster.name}'s ${spell.name}; ${caster.name} ${saveResult.success ? 'keeps the spell' : 'loses the spell'} with a ${interruptionState?.saveType ?? 'Constitution'} save (${saveResult.total} vs DC ${saveDC}).`,
              characterId: possibleReactor.id,
              targetIds: [caster.id],
              data: {
                spellId: selectedInterruptionSpell.id,
                interruptedSpellId: spell.id,
                saveSucceeded: saveResult.success
              }
            });
          }

          if (!saveResult.success && (interruptionState?.failureOutcome ?? 'spell_has_no_effect') === 'spell_has_no_effect') {
            const shouldPreserveInterruptedSlot = interruptionState?.preservesInterruptedSlot ??
              interruptionState?.slotPolicy === 'interrupted_spell_slot_is_not_expended';

            if (shouldPreserveInterruptedSlot) {
              const casterWithSlotRestored = restoreInterruptedSpellSlot(caster, spell, castAtLevel);
              charactersRef.current = charactersRef.current.map(character =>
                character.id === casterWithSlotRestored.id ? casterWithSlotRestored : character
              );
              onCharacterUpdate(casterWithSlotRestored);
            }

            if (onNotification) {
              onNotification(`${spell.name} was interrupted by ${selectedInterruptionSpell.name}.`, 'warning');
            }
            return false;
          }
        }
      }

      const commandGameState = buildCommandGameState(commandCharacters, currentMapData, activePlane);
      const targetResolution = TargetResolver.resolveTargetCandidates(
        spell.targeting,
        targets,
        { castLevel: castAtLevel }
      );
      const executionTargets = targetResolution.selectedTargets;

      if (targetResolution.allocationApplied && onLogEntry) {
        targetResolution.logs.forEach(message => {
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

        const result = await CommandExecutor.execute(commands, currentState);

        if (result.success) {
          const movementEffects = spell.effects.filter(isMovementEffect);
          const movementResolvedState = resolveImmediateAfterForcedMovementRepeatSaves(result.finalState, executionTargets, movementEffects);
          const resourceResolvedState = {
            ...movementResolvedState,
            characters: movementResolvedState.characters.map(finalChar => (
              finalChar.id === caster.id && resourceSnapshot
                ? applyResourceSnapshotToCaster(finalChar, resourceSnapshot)
                : finalChar
            )),
          };
          const postDamageReactions = await resolvePostDamageReactionQueue({
            characters: resourceResolvedState.characters,
            combatLog: resourceResolvedState.combatLog,
            mapData: currentMapData,
            processedEventIds: processedPostDamageReactionEventIdsRef.current,
            requestReaction,
          });
          const finalState = {
            ...resourceResolvedState,
            characters: postDamageReactions.characters,
            combatLog: [...resourceResolvedState.combatLog, ...postDamageReactions.logEntries],
          };

          // Propagate State Changes
          finalState.characters.forEach(finalChar => {
            const isTarget = executionTargets.some(t => t.id === finalChar.id);
            const isCaster = caster.id === finalChar.id;
            if (isTarget || isCaster) {
              onCharacterUpdate(finalChar);
            }
          });

          if (onLogEntry) {
            finalState.combatLog.forEach(entry => onLogEntry(entry));
          }

          if (onReactiveTriggerUpdate && finalState.reactiveTriggers !== currentState.reactiveTriggers) {
            onReactiveTriggerUpdate(finalState.reactiveTriggers);
          }

          if (onActiveLightSourcesUpdate && finalState.activeLightSources !== currentState.activeLightSources) {
            onActiveLightSourcesUpdate(finalState.activeLightSources || []);
          }

          if (onSpellZonesUpdate && finalState.spellZones !== currentState.spellZones) {
            onSpellZonesUpdate((finalState.spellZones || []) as ActiveSpellZone[]);
          }

          if (onActiveSpellHelpersUpdate && finalState.activeSpellHelpers !== currentState.activeSpellHelpers) {
            onActiveSpellHelpersUpdate(finalState.activeSpellHelpers || []);
          }
          if (onActiveSpellForcesUpdate && finalState.activeSpellForces !== currentState.activeSpellForces) {
            onActiveSpellForcesUpdate(finalState.activeSpellForces || []);
          }
          if (onActiveSpellGuardiansUpdate && finalState.activeSpellGuardians !== currentState.activeSpellGuardians) {
            onActiveSpellGuardiansUpdate(finalState.activeSpellGuardians || []);
          }
          if (onActiveAnimatedObjectsUpdate && finalState.activeAnimatedObjects !== currentState.activeAnimatedObjects) {
            onActiveAnimatedObjectsUpdate(finalState.activeAnimatedObjects || []);
          }
          if (onActiveSpellStructuresUpdate && finalState.activeSpellStructures !== currentState.activeSpellStructures) {
            onActiveSpellStructuresUpdate(finalState.activeSpellStructures || []);
          }
          if (onActiveExtradimensionalSpacesUpdate && finalState.activeExtradimensionalSpaces !== currentState.activeExtradimensionalSpaces) {
            onActiveExtradimensionalSpacesUpdate(finalState.activeExtradimensionalSpaces || []);
          }
          if (onActiveSpellEmanationsUpdate && finalState.activeSpellEmanations !== currentState.activeSpellEmanations) {
            onActiveSpellEmanationsUpdate(finalState.activeSpellEmanations || []);
          }
          if (onSpellObjectImpactsUpdate && finalState.spellObjectImpacts !== currentState.spellObjectImpacts) {
            onSpellObjectImpactsUpdate(finalState.spellObjectImpacts || []);
          }
          if (onSpellObjectRepairsUpdate && finalState.spellObjectRepairs !== currentState.spellObjectRepairs) {
            onSpellObjectRepairsUpdate(finalState.spellObjectRepairs || []);
          }
          if (onSpellObjectAccessChangesUpdate && finalState.spellObjectAccessChanges !== currentState.spellObjectAccessChanges) {
            onSpellObjectAccessChangesUpdate(finalState.spellObjectAccessChanges || []);
          }
          if (onActiveFireEffectsUpdate && finalState.activeFireEffects !== currentState.activeFireEffects) {
            onActiveFireEffectsUpdate(finalState.activeFireEffects || []);
          }
          if (onActiveTruePolymorphTransformationsUpdate && finalState.activeTruePolymorphTransformations !== currentState.activeTruePolymorphTransformations) {
            onActiveTruePolymorphTransformationsUpdate(finalState.activeTruePolymorphTransformations || []);
          }

          if (onSpellCreatedInventoryItems && finalState.spellCreatedInventoryItems?.length) {
            onSpellCreatedInventoryItems(finalState.spellCreatedInventoryItems);
          }

          if (onMapUpdate && finalState.mapData && finalState.mapData !== mapDataRef.current) {
            onMapUpdate(finalState.mapData);
          }

          if (onAddSpellMovementVisual && movementEffects.length > 0) {
            const movementVisualType = getMovementVisualType(movementEffects);
            executionTargets.forEach(target => {
              const finalTarget = finalState.characters.find(candidate => candidate.id === target.id);
              if (!finalTarget) return;
              if (target.position.x === finalTarget.position.x && target.position.y === finalTarget.position.y) return;

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

          const castSaveDC = calculateSpellDC(caster);
          const hasPersistentAreaDefense = spell.effects.some(effect =>
            effect.type === 'DEFENSIVE' && (effect.defenseType === 'resistance' || effect.defenseType === 'immunity')
          );

          if (onAddSpellZone && zoneRegistration && (spell.effects.some(hasPersistentAreaTrigger) || hasPersistentAreaDefense)) {
            onAddSpellZone(createSpellZoneFromAoEParams(
              spell.id,
              caster.id,
              zoneRegistration.aoeParams,
              getPersistentSpellZoneArea(spell, zoneRegistration.areaOfEffect, zoneRegistration.aoeParams),
              spell.effects,
              currentState.turnState.currentTurn,
              getDurationRounds(spell),
              castSaveDC,
              spell.targeting.validTargets,
              caster.facing
            ));
          }

          if (onAddSpellZone && !mapDataRef.current && zoneRegistration && spell.effects.some(isTerrainEffect)) {
            onAddSpellZone(createTerrainSpellZoneFromAoEParams(
              spell.id,
              caster.id,
              zoneRegistration.aoeParams,
              getZoneAreaFromAoEParams(zoneRegistration.areaOfEffect, zoneRegistration.aoeParams),
              spell.effects.filter(isTerrainEffect),
              0,
              getDurationRounds(spell),
              caster.facing
            ));
          }

          const hasRecurringTurnTiming = spell.effects.some(effect =>
            getRecurringMechanics(effect).some(mechanic =>
              mechanic.timing === 'turn_start' || mechanic.timing === 'turn_end'
            )
          );

          if (onAddScheduledSpellEffect && (spell.effects.some(hasScheduledEffectTrigger) || hasRecurringTurnTiming)) {
            (['turn_start', 'turn_end'] as const).forEach(timing => {
              const scheduledEffects = spell.effects.flatMap(effect => {
                const direct = effect.trigger?.type === timing
                  ? [{ effect, recurringMechanic: undefined }]
                  : [];
                const recurring = getRecurringMechanics(effect)
                  .filter(mechanic => mechanic.timing === timing)
                  .filter(() => !(zoneRegistration && timing === 'turn_end'))
                  .map(recurringMechanic => ({ effect, recurringMechanic }));
                return [...direct, ...recurring];
              });
              if (scheduledEffects.length === 0) return;

              executionTargets.forEach(target => {
                scheduledEffects.forEach(({ effect, recurringMechanic }) => {
                  onAddScheduledSpellEffect(createScheduledSpellEffect(
                    spell.id,
                    caster.id,
                    target.id,
                    timing,
                    [effect],
                    currentState.turnState.currentTurn,
                    getDurationRounds(spell),
                    castSaveDC,
                    recurringMechanic
                  ));
                });
              });
            });
          }

          const commandProducedMovementDebuffs = finalState.movementDebuffs ?? [];
          if (onAddMovementDebuff && commandProducedMovementDebuffs.length) {
            commandProducedMovementDebuffs.forEach(debuff => onAddMovementDebuff(debuff as MovementTriggerDebuff));
          }

          if (onAddMovementDebuff && spell.effects.some(hasTargetMovementTrigger)) {
            executionTargets.forEach(target => {
              const alreadyPublishedByCommand = commandProducedMovementDebuffs.some(debuff =>
                debuff.spellId === spell.id &&
                debuff.casterId === caster.id &&
                debuff.targetId === target.id
              );
              if (alreadyPublishedByCommand) return;

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
      return true;
    },
    [
      charactersRef,
      reactiveTriggersRef,
      mapDataRef,
      currentPlaneRef,
      activeLightSources,
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
      spellZones,
      onCharacterUpdate,
      onLogEntry,
      onNotification,
      onRequestInput,
      onReactiveTriggerUpdate,
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
      onMapUpdate,
      onAddSpellZone,
      onSpellZonesUpdate,
      onSpellCreatedInventoryItems,
      onAddScheduledSpellEffect,
      onAddMovementDebuff,
      onAddSpellMovementVisual,
      requestReaction,
      processedPostDamageReactionEventIdsRef
    ]
  );

  // --- Ability & Spell General Execution ---
  const executeAbilityInternal = useCallback(async (
    ability: Ability,
    caster: CombatCharacter,
    targetPosition: Position,
    targetCharacterIds: string[],
    playerInput?: string,
    selectedSpellTargets?: SelectedSpellTarget[],
    randomSources?: AbilityExecutionRandomSources,
  ) => {
    const currentCharacters = charactersRef.current;
    const currentTriggers = reactiveTriggersRef.current;
    const activePlane = currentPlaneRef.current;
    const liveCaster = currentCharacters.find(character => character.id === caster.id) ?? caster;

    const claimExecutionEvent = (): boolean => {
      const eventId = randomSources?.executionEventId;
      if (!eventId) return true;

      if (processedAbilityExecutionEventIdsRef.current.has(eventId)) {
        onLogEntry?.({
          id: `${eventId}:ability-execution-no-op`,
          timestamp: Date.now(),
          type: 'status',
          message: `Duplicate ability event ${eventId}: no action, spell slot, effect, or damage was applied.`,
          characterId: liveCaster.id,
          data: { outcome: 'duplicate_event', notes: `ability-event:${eventId}` },
        });
        return false;
      }

      processedAbilityExecutionEventIdsRef.current.add(eventId);

      if (randomSources?.executionDecision === 'decline') {
        onLogEntry?.({
          id: `${eventId}:ability-execution-declined`,
          timestamp: Date.now(),
          type: 'status',
          message: `Declined ability event ${eventId}: no action, spell slot, effect, or damage was applied.`,
          characterId: liveCaster.id,
          data: { outcome: 'declined_event', notes: `ability-event:${eventId}` },
        });
        return false;
      }

      return true;
    };

    // --- Path A: Spell System (Command Pattern) ---
    if (ability.spell) {
      if (!ability.spell.id || ability.spell.level === undefined || !ability.spell.effects) {
        console.error("Invalid spell data: Missing required fields (id, level, or effects)", ability.spell);
        cancelTargeting();
        return;
      }

      const isAreaDamageAbility = Boolean(ability.areaOfEffect) && (
        ability.type === 'attack' ||
        ability.effects.some(effect => effect.type === 'damage')
      );
      if (isAreaDamageAbility) {
        const blockedTargetIds = targetCharacterIds.filter(targetId => {
          const target = currentCharacters.find(character => character.id === targetId) ?? null;
          return Boolean(getBloodCircleRejection(liveCaster, target));
        });
        if (blockedTargetIds.length > 0) {
          const blockedTargetSet = new Set(blockedTargetIds);
          const allowedTargetIds = targetCharacterIds.filter(targetId => !blockedTargetSet.has(targetId));
          if (allowedTargetIds.length === 0) {
            const message = `${liveCaster.name} cannot harm creatures inside its protective blood circle.`;
            onNotification?.(message, 'warning');
            onLogEntry?.({
              id: generateId(),
              timestamp: Date.now(),
              type: 'action',
              message,
              characterId: liveCaster.id,
              targetIds: blockedTargetIds,
              data: { rejectedReason: 'blood_circle_area_target_blocked', spellId: ability.spell.id }
            });
            cancelTargeting();
            return;
          }
          targetCharacterIds = allowedTargetIds;
          selectedSpellTargets = selectedSpellTargets?.filter(target =>
            target.kind !== 'creature' || !blockedTargetSet.has(target.id)
          );
        }
      }

      const targets = targetCharacterIds
        .map(id => currentCharacters.find(c => c.id === id))
        .filter((c): c is CombatCharacter => !!c);

      const completeSelectedTargets = selectedSpellTargets?.some(target => target.kind !== 'creature')
        ? selectedSpellTargets
        : targetCharacterIds.map(id => ({ kind: 'creature' as const, id }));
      const targetSelectionRejection = validateSpellTargetSelection({
        spell: ability.spell,
        caster: liveCaster,
        characters: currentCharacters,
        mapData: mapDataRef.current,
        selectedTargets: completeSelectedTargets,
        castLevel: ability.spell.level,
      });
      if (targetSelectionRejection) {
        onNotification?.(targetSelectionRejection.message, 'warning');
        onLogEntry?.({
          id: generateId(),
          timestamp: Date.now(),
          type: 'action',
          message: targetSelectionRejection.message,
          characterId: liveCaster.id,
          targetIds: targetCharacterIds,
          data: {
            spellId: ability.spell.id,
            rejectedReason: targetSelectionRejection.code,
            payment: 'not_started',
          },
        });
        cancelTargeting();
        return;
      }

      const bloodCircleRejection = getBloodCircleRejection(liveCaster, targets[0] ?? null);
      if (bloodCircleRejection) {
        onNotification?.(bloodCircleRejection, 'warning');
        onLogEntry?.({
          id: generateId(),
          timestamp: Date.now(),
          type: 'action',
          message: bloodCircleRejection,
          characterId: liveCaster.id,
          targetIds: targetCharacterIds,
          data: { rejectedReason: 'blood_circle_target_blocked', spellId: ability.spell.id }
        });
        cancelTargeting();
        return;
      }

      const perTargetChoice = ability.spell.targeting.perTargetChoice;
      const existingPerTargetChoices = getPerTargetChoicesFromSpell(ability.spell);
      if (perTargetChoice?.required && !playerInput && !existingPerTargetChoices) {
        if (targetCharacterIds.length === 1 && onRequestInput) {
          onRequestInput(ability.spell, (input) => {
            executeAbilityInternal(
              ability,
              caster,
              targetPosition,
              targetCharacterIds,
              input,
              selectedSpellTargets,
              randomSources,
            );
          });
          return;
        }

        if (targetCharacterIds.length > 1 && onRequestInput) {
          requestPerTargetChoices(ability.spell, targets, onRequestInput, (choicesByTargetId) => {
            executeAbilityInternal({
              ...ability,
              spell: addPerTargetChoicesToSpell(ability.spell, choicesByTargetId)
            } as Ability, caster, targetPosition, targetCharacterIds, undefined, selectedSpellTargets, randomSources);
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

      if (!claimExecutionEvent()) {
        cancelTargeting();
        return;
      }

      // The spell path suppresses its own attack events for the same reason the
      // ability path below does: the hit or miss is not known until the spell
      // commands run. Without this the executor would announce an attack before
      // any d20 existed, and an Armor of Agathys-style retaliation would answer
      // that announcement instead of the real roll.
      const action: CombatAction = {
        ...buildAbilityCombatAction(ability, liveCaster, targetPosition, targetCharacterIds, selectedSpellTargets),
        suppressAbilityEvents: true
      };

      if (!await onExecuteAction(action)) {
        cancelTargeting();
        return;
      }

      // The executor accepted this cast by starting a ceremony, not by resolving
      // it. The ritual runtime now owns the spell and will finish it over the
      // coming turns; casting it here as well is the double-resolve that
      // agora-f821.38 removed.
      if (action.ritualStarted) {
        cancelTargeting();
        return;
      }

      const casterAfterCost = consumeActionCost(liveCaster, ability.cost);

      const zoneAoEParams = ability.areaOfEffect
        ? resolveAoEParams(ability.areaOfEffect, targetPosition, liveCaster, ability.name)
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

      const spellForExecution = ability.targeting === 'self' && hasTeleportMovementEffect(ability)
        ? addTeleportDestinationToSpell(spellWithPerTargetChoices, targetPosition)
        : spellWithPerTargetChoices;

      const touchDelivery = targetCharacterIds.length === 1
        ? findTouchDeliveryActor(
            ability,
            liveCaster,
            currentCharacters.find(character => character.id === targetCharacterIds[0]) ?? null,
            currentCharacters
          )
        : null;

      if (touchDelivery) {
        const touchDeliveryCost = touchDelivery.deliveryActor.summonMetadata?.actionPermissions?.touchDeliveryCost ?? 'reaction';
        const touchDeliveryActionCost = getTouchDeliveryActionCost(touchDeliveryCost);
        const updatedDeliveryActor = touchDeliveryActionCost
          ? consumeActionCost(touchDelivery.deliveryActor, touchDeliveryActionCost)
          : touchDelivery.deliveryActor;

        if (updatedDeliveryActor !== touchDelivery.deliveryActor) {
          charactersRef.current = charactersRef.current.map(character =>
            character.id === updatedDeliveryActor.id ? updatedDeliveryActor : character
          );
          onCharacterUpdate(updatedDeliveryActor);
        }
        onAddSpellDeliveryVisual?.({
          spellId: spellForExecution.id,
          spellName: spellForExecution.name,
          casterId: liveCaster.id,
          deliveryActorId: updatedDeliveryActor.id,
          familiarId: updatedDeliveryActor.id,
          targetId: targetCharacterIds[0],
          from: updatedDeliveryActor.position,
          to: targetPosition,
          label: 'TOUCH DELIVERY'
        });
      }

      // Bracket the cast with the event bus sequence so the replay below carries
      // only the attack rolls this cast produced.
      const spellAttackSequenceStart = combatEvents.createReplaySnapshot().nextSequence;
      await executeSpell(
        spellForExecution,
        casterAfterCost,
        targets,
        spellForExecution.level,
        playerInput,
        casterAfterCost,
        zoneRegistration,
        selectedSpellTargets
      );

      const spellAttackResults = combatEvents.getAttackResultsSince(spellAttackSequenceStart, {
        attackerId: liveCaster.id,
        targetIds: targetCharacterIds
      });

      if (spellAttackResults.length > 0) {
        // Replay the same action envelope, now carrying the rolls the commands
        // made. This pass spends nothing and moves nobody; it only lets the
        // on-target-attack resolvers read a real hit or miss.
        await onExecuteAction({
          ...action,
          id: `${action.id}-reactive-results`,
          cost: { type: 'free' },
          reactiveEventsOnly: true,
          suppressAbilityEvents: false,
          attackResults: spellAttackResults
        });
      }

      cancelTargeting();
      return;
    }

    // --- Path B: Ability System (Command Pattern) ---
    if (!claimExecutionEvent()) {
      cancelTargeting();
      return;
    }

    const action: CombatAction = {
      ...buildAbilityCombatAction(ability, liveCaster, targetPosition, targetCharacterIds, selectedSpellTargets),
      suppressAbilityEvents: true
    };

    if (!await onExecuteAction(action)) {
      cancelTargeting();
      return;
    }

    // The executor accepted this cast by starting a ceremony, not by resolving
    // it. The ritual runtime now owns the spell and will finish it over the
    // coming turns; casting it here as well is the double-resolve that
    // agora-f821.38 removed.
    if (action.ritualStarted) {
      cancelTargeting();
      return;
    }

    const casterAfterCost = consumeActionCost(liveCaster, ability.cost);
    const commandCharacters = replaceCasterForCommandState(currentCharacters, casterAfterCost);

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
      activeSpellHelpers: activeSpellHelpersRef.current || [],
      activeSpellForces: activeSpellForcesRef.current || [],
      activeSpellGuardians: activeSpellGuardiansRef.current || [],
      activeAnimatedObjects: activeAnimatedObjectsRef.current || [],
      activeSpellStructures: activeSpellStructuresRef.current || [],
      activeExtradimensionalSpaces: activeExtradimensionalSpacesRef.current || [],
      activeSpellEmanations: activeSpellEmanationsRef.current || [],
      spellObjectImpacts: spellObjectImpactsRef.current || [],
      spellObjectRepairs: spellObjectRepairsRef.current || [],
      spellObjectAccessChanges: spellObjectAccessChangesRef.current || [],
      activeFireEffects: activeFireEffectsRef.current || [],
      activeTruePolymorphTransformations: activeTruePolymorphTransformationsRef.current || [],
      currentPlane: activePlane,
      mapData: mapDataRef.current ?? undefined
    };

    const commandGameState = buildCommandGameState(commandCharacters, mapDataRef.current, activePlane);
    const targets = targetCharacterIds
      .map(id => currentCharacters.find(c => c.id === id))
      .filter((c): c is CombatCharacter => !!c);

    const commands = AbilityCommandFactory.createCommands(
      ability,
      casterAfterCost,
      targets,
      commandGameState,
      selectedSpellTargets,
      requestReaction,
      randomSources,
    );

    const attackEventSequenceStart = combatEvents.createReplaySnapshot().nextSequence;
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

      const commandFinalCharacters = result.finalState.characters.map(finalChar =>
        finalChar.id === liveCaster.id
          ? applyResourceSnapshotToCaster(finalChar, casterAfterCost)
          : finalChar
      );
      const postDamageReactions = await resolvePostDamageReactionQueue({
        characters: commandFinalCharacters,
        combatLog: result.finalState.combatLog,
        mapData: mapDataRef.current,
        processedEventIds: processedPostDamageReactionEventIdsRef.current,
        requestReaction,
        damageRng: randomSources?.damageRng,
        saveRng: randomSources?.saveRng,
      });
      const finalCharacters = postDamageReactions.characters;
      const finalCombatLog = [
        ...result.finalState.combatLog,
        ...postDamageReactions.logEntries,
      ];
      const commandCharacterIds = new Set(commandCharacters.map(character => character.id));
      const finalCharacterIds = new Set(result.finalState.characters.map(character => character.id));
      const rosterChanged = commandCharacters.length !== result.finalState.characters.length ||
        commandCharacters.some(character => !finalCharacterIds.has(character.id)) ||
        result.finalState.characters.some(character => !commandCharacterIds.has(character.id));

      if (rosterChanged && onCharactersReplace) {
        onCharactersReplace(finalCharacters);
      }

      if (onPocketedSummonsUpdate && result.finalState.pocketedSummons !== currentState.pocketedSummons) {
        onPocketedSummonsUpdate(result.finalState.pocketedSummons || []);
      }

      if (onSpellZonesUpdate && result.finalState.spellZones !== currentState.spellZones) {
        onSpellZonesUpdate((result.finalState.spellZones || []) as ActiveSpellZone[]);
      }

      if (onActiveSpellHelpersUpdate && result.finalState.activeSpellHelpers !== currentState.activeSpellHelpers) {
        onActiveSpellHelpersUpdate(result.finalState.activeSpellHelpers || []);
      }
      if (onActiveSpellForcesUpdate && result.finalState.activeSpellForces !== currentState.activeSpellForces) {
        onActiveSpellForcesUpdate(result.finalState.activeSpellForces || []);
      }
      if (onActiveSpellGuardiansUpdate && result.finalState.activeSpellGuardians !== currentState.activeSpellGuardians) {
        onActiveSpellGuardiansUpdate(result.finalState.activeSpellGuardians || []);
      }
      if (onActiveAnimatedObjectsUpdate && result.finalState.activeAnimatedObjects !== currentState.activeAnimatedObjects) {
        onActiveAnimatedObjectsUpdate(result.finalState.activeAnimatedObjects || []);
      }
      if (onActiveSpellStructuresUpdate && result.finalState.activeSpellStructures !== currentState.activeSpellStructures) {
        onActiveSpellStructuresUpdate(result.finalState.activeSpellStructures || []);
      }
      if (onActiveExtradimensionalSpacesUpdate && result.finalState.activeExtradimensionalSpaces !== currentState.activeExtradimensionalSpaces) {
        onActiveExtradimensionalSpacesUpdate(result.finalState.activeExtradimensionalSpaces || []);
      }
      if (onActiveSpellEmanationsUpdate && result.finalState.activeSpellEmanations !== currentState.activeSpellEmanations) {
        onActiveSpellEmanationsUpdate(result.finalState.activeSpellEmanations || []);
      }
      if (onSpellObjectImpactsUpdate && result.finalState.spellObjectImpacts !== currentState.spellObjectImpacts) {
        onSpellObjectImpactsUpdate(result.finalState.spellObjectImpacts || []);
      }
      if (onSpellObjectRepairsUpdate && result.finalState.spellObjectRepairs !== currentState.spellObjectRepairs) {
        onSpellObjectRepairsUpdate(result.finalState.spellObjectRepairs || []);
      }
      if (onSpellObjectAccessChangesUpdate && result.finalState.spellObjectAccessChanges !== currentState.spellObjectAccessChanges) {
        onSpellObjectAccessChangesUpdate(result.finalState.spellObjectAccessChanges || []);
      }
      if (onActiveFireEffectsUpdate && result.finalState.activeFireEffects !== currentState.activeFireEffects) {
        onActiveFireEffectsUpdate(result.finalState.activeFireEffects || []);
      }
      if (onActiveTruePolymorphTransformationsUpdate && result.finalState.activeTruePolymorphTransformations !== currentState.activeTruePolymorphTransformations) {
        onActiveTruePolymorphTransformationsUpdate(result.finalState.activeTruePolymorphTransformations || []);
      }

      if (onSpellCreatedInventoryItems && result.finalState.spellCreatedInventoryItems?.length) {
        onSpellCreatedInventoryItems(result.finalState.spellCreatedInventoryItems);
      }

      if (commands.length > 0 && !rosterChanged) {
        finalCharacters.forEach(finalChar => {
          const isTarget = targetCharacterIds.includes(finalChar.id);
          const isCaster = liveCaster.id === finalChar.id;
          if (isTarget || isCaster) {
            onCharacterUpdate(finalChar);
          }
        });
      }

      if (onLogEntry) {
        finalCombatLog.forEach(entry => onLogEntry(entry));
      }

      if (onActiveLightSourcesUpdate && result.finalState.activeLightSources !== currentState.activeLightSources) {
        onActiveLightSourcesUpdate(result.finalState.activeLightSources || []);
      }

      if (attackResults.length > 0) {
        const hitResults = attackResults.filter(attackResult => attackResult.isHit);

        for (const attackResult of hitResults) {
          const hitTarget = finalCharacters.find(character => character.id === attackResult.targetId);
          const currentAttacker = charactersRef.current.find(character => character.id === liveCaster.id) ||
            finalCharacters.find(character => character.id === liveCaster.id) ||
            casterAfterCost;

          if (!hitTarget) continue;

          const afterHitReactionSpells = (currentAttacker.abilities || [])
            .map(abilityOption => abilityOption.spell)
            .filter((spellOption): spellOption is Spell => {
              const trigger = spellOption?.castingTrigger;
              const attackFilter = trigger?.attackFilter;
              const expectedAttackType = attackFilter?.attackType ?? 'any';
              const expectedWeaponType = normalizeAfterHitWeaponType(attackFilter?.weaponType) ?? 'any';
              const actualAttackType = attackResult.attackType ?? 'weapon';
              const actualWeaponType = attackResult.weaponType ?? 'any';
              const unarmedStrikeAllowed = attackFilter?.includesUnarmedStrike === true;
              const isUnarmedStrike = actualAttackType === 'unarmed' || actualWeaponType === 'unarmed';
              const attackTypeMatches = expectedAttackType === 'any' ||
                expectedAttackType === actualAttackType ||
                (unarmedStrikeAllowed && isUnarmedStrike);
              const weaponTypeMatches = expectedWeaponType === 'any' ||
                expectedWeaponType === actualWeaponType ||
                (unarmedStrikeAllowed && isUnarmedStrike && expectedWeaponType === 'melee');
              const triggerCost = spellOption ? getCastingTriggerActionCost(spellOption) : null;

              return Boolean(spellOption) &&
                trigger?.type === 'after_attack_hit' &&
                trigger.targetBinding === 'triggering_attack_target' &&
                trigger.requiredCost === spellOption.castingTime?.unit &&
                attackTypeMatches &&
                weaponTypeMatches &&
                Boolean(triggerCost) &&
                canAffordActionCost(currentAttacker, triggerCost!);
            });

          if (afterHitReactionSpells.length === 0) continue;

          const selectedAfterHitReactionId = await requestReaction(
            liveCaster.id,
            hitTarget.id,
            'on_hit',
            afterHitReactionSpells
          );
          const selectedAfterHitReactionSpell = afterHitReactionSpells.find(spellOption => spellOption.id === selectedAfterHitReactionId);
          if (!selectedAfterHitReactionSpell) continue;

          const triggerCost = getCastingTriggerActionCost(selectedAfterHitReactionSpell);
          const attackerAfterReactionCost = consumeActionCost(currentAttacker, triggerCost);
          charactersRef.current = charactersRef.current.map(character =>
            character.id === attackerAfterReactionCost.id ? attackerAfterReactionCost : character
          );
          onCharacterUpdate(attackerAfterReactionCost);

          await executeSpell(
            materializeAfterHitReactionSpell(selectedAfterHitReactionSpell),
            attackerAfterReactionCost,
            [hitTarget],
            Math.max(selectedAfterHitReactionSpell.level, 1),
            undefined,
            attackerAfterReactionCost
          );
        }

        for (const attackResult of hitResults) {
          const hitTarget = finalCharacters.find(character => character.id === attackResult.targetId);
          if (!hitTarget || hitTarget.actionEconomy?.reaction?.used || hitTarget.actionEconomy?.reaction?.remaining === 0) {
            continue;
          }

          const hitReactionSpells = (hitTarget.abilities || [])
            .map(abilityOption => abilityOption.spell)
            .filter((spellOption): spellOption is Spell =>
              Boolean(spellOption) &&
              String(spellOption.castingTime?.unit ?? '').toLowerCase().includes('reaction') &&
              spellOption.effects.some((effect: any) =>
                effect.type === 'DEFENSIVE' &&
                effect.reactionTrigger?.event === 'when_hit'
              )
            );

          if (hitReactionSpells.length === 0) continue;

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

      // Handle Cooldowns, Recharge, and Limited Uses
      const updatedCaster = finalCharacters.find(c => c.id === caster.id) || caster;
      const casterWithUsageUpdated = applyAbilityUsageState(updatedCaster, ability, casterAfterCost);
      if (casterWithUsageUpdated !== updatedCaster) {
        onCharacterUpdate(casterWithUsageUpdated);
      }
    } else {
      console.error("Ability execution failed:", result.error);
    }

    cancelTargeting();
  }, [
    charactersRef,
    reactiveTriggersRef,
    currentPlaneRef,
    mapDataRef,
    activeLightSources,
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
    onExecuteAction,
    onCharacterUpdate,
    onCharactersReplace,
    onPocketedSummonsUpdate,
    cancelTargeting,
    executeSpell,
    requestReaction,
    onLogEntry,
    onNotification,
    onRequestInput,
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
    onSpellCreatedInventoryItems,
    onAddSpellDeliveryVisual,
    processedPostDamageReactionEventIdsRef
  ]);

  const executeAbility = useCallback((...args: Parameters<typeof executeAbilityInternal>) => {
    return executeAbilityInternal(...args);
  }, [executeAbilityInternal]);

  return {
    executeSpell,
    executeAbility,
    executeAbilityInternal,
    processedAbilityExecutionEventIdsRef,
    resetProcessedAbilityExecutionEvents
  };
};

export type UseAbilityExecutionReturn = ReturnType<typeof useAbilityExecution>;

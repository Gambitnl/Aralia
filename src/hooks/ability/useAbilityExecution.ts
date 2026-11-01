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
 * Pure area selection and pre-cast restriction decisions live in systems/combat.
 * The effectful spell flow owns spell prompts, reactions and publication; this
 * hook retains React refs, callback identities and the general ability path.
 * Depends on: Command system, targeting validators, reaction system, action economy
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 22:14:42
 * Dependents: hooks/ability/targetSelection.ts, hooks/useAbilitySystem.ts
 * Imports: 21 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { runSpellExecutionFlow } from "./execution/spellExecutionFlow";
import type { UseAbilityExecutionProps, AbilityExecutionRandomSources, SpellExecutionArgs } from "./abilityExecutionTypes";
export type { UseAbilityExecutionProps, AbilityExecutionRandomSources } from "./abilityExecutionTypes";
import { useCallback, useRef } from 'react';
import type { CombatCharacter, Position, CombatAction, CombatState, Ability, SelectedSpellTarget } from '../../types/combat';

import type { Spell, SpellEffect } from '../../types/spells';

export { getPersistentSpellZoneArea } from '../../systems/combat/abilityEffectPlanning';

export { getSpellControlOptions, resolveAreaTargetSelection } from '../../systems/combat/abilityTargetResolution';
export type { AreaTargetResolutionInput, AreaTargetResolutionResult } from '../../systems/combat/abilityTargetResolution';

import { AbilityCommandFactory, CommandExecutor } from '../../commands';
import { generateId } from '../../utils/combat';

import { resolveAoEParams } from '../../utils/spatial/targetingUtils';

import { findTouchDeliveryActor, getBloodCircleRejection, getTouchDeliveryActionCost } from '../combat/useTargetValidator';
import { canAffordActionCost, consumeActionCost } from '../../utils/combat/actionEconomyUtils';
import { type ActiveSpellZone } from '../../systems/spells/effects/triggerHandler';

import { hasTeleportMovementEffect, addTeleportDestinationToSpell, requiresUnassignedTeleportDestination } from '../teleportUtils';
import { addPerTargetChoicesToSpell, getPerTargetChoicesFromSpell, requestPerTargetChoices } from '../perTargetChoiceUtils';
import { buildAbilityCombatAction, applyResourceSnapshotToCaster, replaceCasterForCommandState, buildCommandGameState } from '../actionUtils';
import { combatEvents } from '../../systems/events/CombatEvents';

import { validateSpellTargetSelection } from '../../systems/spells/targeting/SpellTargetSelectionValidator';
import { resolvePostDamageReactionQueue } from '../../systems/combat/reactions/postDamageReactionQueue';
import { getCastingTriggerActionCost, applyAbilityUsageState } from './useActionEconomy';
import { materializeAfterHitReactionSpell, normalizeAfterHitWeaponType } from './useReactionSystem';

// ============================================================================
// Helper Functions: Spell Control & Area Calculations
// ============================================================================

/**
 * Resolves any spellcasting restriction saving throws (such as from Silence or Dissonant Whispers)
 * before casting begins. If the save fails, the spell is wasted.
 */
export { resolveSpellcastingRestrictions } from "./execution/spellcastingRestrictionAdapter";

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
    function executeSpellImpl(...args: SpellExecutionArgs): Promise<boolean> {
      return runSpellExecutionFlow({ charactersRef, mapDataRef, reactiveTriggersRef, currentPlaneRef, activeSpellHelpersRef, activeSpellForcesRef, activeSpellGuardiansRef, activeAnimatedObjectsRef, activeSpellStructuresRef, activeExtradimensionalSpacesRef, activeSpellEmanationsRef, spellObjectImpactsRef, spellObjectRepairsRef, spellObjectAccessChangesRef, activeFireEffectsRef, activeTruePolymorphTransformationsRef, activeLightSources, spellZones, onCharacterUpdate, onLogEntry, onNotification, onRequestInput, onReactiveTriggerUpdate, onActiveLightSourcesUpdate, onActiveSpellHelpersUpdate, onActiveSpellForcesUpdate, onActiveSpellGuardiansUpdate, onActiveAnimatedObjectsUpdate, onActiveSpellStructuresUpdate, onActiveExtradimensionalSpacesUpdate, onActiveSpellEmanationsUpdate, onSpellObjectImpactsUpdate, onSpellObjectRepairsUpdate, onSpellObjectAccessChangesUpdate, onActiveFireEffectsUpdate, onActiveTruePolymorphTransformationsUpdate, onMapUpdate, onAddSpellZone, onSpellZonesUpdate, onSpellCreatedInventoryItems, onAddScheduledSpellEffect, onAddMovementDebuff, onAddSpellMovementVisual, requestReaction, processedPostDamageReactionEventIdsRef, executeSpell }, executeSpellImpl, ...args);
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
      // Upcast target limits and command scaling use the selected slot while
      // preserving the canonical spell's base level for future casts.
      const selectedCastLevel = Math.max(ability.spell.level, ability.cost.spellSlotLevel ?? ability.spell.level);
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
        castLevel: selectedCastLevel,
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
        selectedCastLevel,
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

    let committedCaster: CombatCharacter | undefined;
    if (!await onExecuteAction(action, character => { committedCaster = character; })) {
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

    // Dash, Disengage and Stand Up already changed the actor in the executor.
    // Continue from that committed result instead of erasing it with the old caster.
    // Legacy isolated hosts can still provide the original one-argument callback.
    const casterAfterCost = committedCaster ?? consumeActionCost(liveCaster, ability.cost);
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
      // The weapon/ability path has the same live-roster boundary as spells.
      charactersRef.current = commandFinalCharacters;
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
      charactersRef.current = finalCharacters;
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

        // When-hit defenses resolve in the command before damage; after-hit
        // attacker spells above retain their own distinct trigger and payment.
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

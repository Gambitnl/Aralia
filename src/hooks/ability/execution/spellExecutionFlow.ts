/**
 * Effectful spell execution adapter. This owns prompting, reaction recursion,
 * command execution and publication in their original order; it is not a pure
 * rule module. Deterministic targeting and registration plans stay in systems.
 * Context carries ref objects, so each live read remains at its original point.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 22:14:42
 * Dependents: hooks/ability/useAbilityExecution.ts
 * Imports: 19 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CombatCharacter, CombatState, SelectedSpellTarget } from "../../../types/combat";
import type { Spell } from "../../../types/spells";
import { planPersistentSpellZone, planTerrainSpellZone, hasRecurringSpellTurnTiming, planScheduledSpellEffects, planUnpublishedMovementDebuffs } from "../../../systems/combat/abilityEffectPlanning";
import { getSpellControlOptions } from "../../../systems/combat/abilityTargetResolution";
import { SpellCommandFactory, CommandExecutor } from "../../../commands";
import { generateId } from "../../../utils/combat";
import { calculateSpellDC, rollSavingThrow } from "../../../utils/character";
import { type AoEParams } from "../../../utils/combat/aoeCalculations";
import { canAffordActionCost, consumeActionCost } from "../../../utils/combat/actionEconomyUtils";
import { createMovementDebuff, createScheduledSpellEffect, createSpellZoneFromAoEParams, createTerrainSpellZoneFromAoEParams, type ActiveSpellZone, type MovementTriggerDebuff } from "../../../systems/spells/effects/triggerHandler";
import { hasScheduledEffectTrigger, hasTargetMovementTrigger, isMovementEffect } from "../../spellEffectUtils";
import { getMovementVisualType, resolveImmediateAfterForcedMovementRepeatSaves, buildResolvedMovementVisualPath } from "../../movementUtils";
import { applyResourceSnapshotToCaster, replaceCasterForCommandState, buildCommandGameState } from "../../actionUtils";
import { TargetResolver } from "../../../systems/spells/targeting/TargetResolver";
import { resolvePostDamageReactionQueue } from "../../../systems/combat/reactions/postDamageReactionQueue";
import { getCastingTriggerActionCost, restoreInterruptedSpellSlot } from "../useActionEconomy";
import { hasSpellInterruptionVisibility, isWithinSpellInterruptionRange } from "../useReactionSystem";
import type { UseAbilityExecutionProps, SpellExecutor } from "../abilityExecutionTypes";
import { resolveSpellcastingRestrictions } from "./spellcastingRestrictionAdapter";
export type SpellExecutionContext = Pick<UseAbilityExecutionProps, "charactersRef" | "mapDataRef" | "reactiveTriggersRef" | "currentPlaneRef" | "activeSpellHelpersRef" | "activeSpellForcesRef" | "activeSpellGuardiansRef" | "activeAnimatedObjectsRef" | "activeSpellStructuresRef" | "activeExtradimensionalSpacesRef" | "activeSpellEmanationsRef" | "spellObjectImpactsRef" | "spellObjectRepairsRef" | "spellObjectAccessChangesRef" | "activeFireEffectsRef" | "activeTruePolymorphTransformationsRef" | "activeLightSources" | "spellZones" | "onCharacterUpdate" | "onLogEntry" | "onNotification" | "onRequestInput" | "onReactiveTriggerUpdate" | "onActiveLightSourcesUpdate" | "onActiveSpellHelpersUpdate" | "onActiveSpellForcesUpdate" | "onActiveSpellGuardiansUpdate" | "onActiveAnimatedObjectsUpdate" | "onActiveSpellStructuresUpdate" | "onActiveExtradimensionalSpacesUpdate" | "onActiveSpellEmanationsUpdate" | "onSpellObjectImpactsUpdate" | "onSpellObjectRepairsUpdate" | "onSpellObjectAccessChangesUpdate" | "onActiveFireEffectsUpdate" | "onActiveTruePolymorphTransformationsUpdate" | "onMapUpdate" | "onAddSpellZone" | "onSpellZonesUpdate" | "onSpellCreatedInventoryItems" | "onAddScheduledSpellEffect" | "onAddMovementDebuff" | "onAddSpellMovementVisual" | "requestReaction" | "processedPostDamageReactionEventIdsRef"> & { executeSpell: SpellExecutor };
export async function runSpellExecutionFlow(ctx: SpellExecutionContext, executeSpellImpl: SpellExecutor, spell: Spell, caster: CombatCharacter, targets: CombatCharacter[], castAtLevel: number, playerInput?: string, resourceSnapshot?: CombatCharacter, zoneRegistration?: { areaOfEffect: { shape: string }; aoeParams: AoEParams }, selectedSpellTargets?: SelectedSpellTarget[], interruptionDepth = 0): Promise<boolean> {
  const { charactersRef, mapDataRef, reactiveTriggersRef, currentPlaneRef, activeSpellHelpersRef, activeSpellForcesRef, activeSpellGuardiansRef, activeAnimatedObjectsRef, activeSpellStructuresRef, activeExtradimensionalSpacesRef, activeSpellEmanationsRef, spellObjectImpactsRef, spellObjectRepairsRef, spellObjectAccessChangesRef, activeFireEffectsRef, activeTruePolymorphTransformationsRef, activeLightSources, spellZones, onCharacterUpdate, onLogEntry, onNotification, onRequestInput, onReactiveTriggerUpdate, onActiveLightSourcesUpdate, onActiveSpellHelpersUpdate, onActiveSpellForcesUpdate, onActiveSpellGuardiansUpdate, onActiveAnimatedObjectsUpdate, onActiveSpellStructuresUpdate, onActiveExtradimensionalSpacesUpdate, onActiveSpellEmanationsUpdate, onSpellObjectImpactsUpdate, onSpellObjectRepairsUpdate, onSpellObjectAccessChangesUpdate, onActiveFireEffectsUpdate, onActiveTruePolymorphTransformationsUpdate, onMapUpdate, onAddSpellZone, onSpellZonesUpdate, onSpellCreatedInventoryItems, onAddScheduledSpellEffect, onAddMovementDebuff, onAddSpellMovementVisual, requestReaction, processedPostDamageReactionEventIdsRef, executeSpell } = ctx;
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
          // Reaction requests read this live roster before React flushes state.
          // Carry damage forward so replay cannot restore an older HP snapshot.
          charactersRef.current = resourceResolvedState.characters;
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
          charactersRef.current = finalState.characters;

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
          if (onAddSpellZone && zoneRegistration) {
            const persistent = planPersistentSpellZone(spell, caster, zoneRegistration, currentState.turnState.currentTurn, castSaveDC);
            if (persistent) onAddSpellZone(createSpellZoneFromAoEParams(...persistent));
          }
          // Recheck the live map after the first zone callback, as before.
          if (onAddSpellZone && !mapDataRef.current && zoneRegistration) {
            const terrain = planTerrainSpellZone(spell, caster, zoneRegistration);
            if (terrain) onAddSpellZone(createTerrainSpellZoneFromAoEParams(...terrain));
          }
          const hasRecurringTurnTiming = hasRecurringSpellTurnTiming(spell);
          if (onAddScheduledSpellEffect && (spell.effects.some(hasScheduledEffectTrigger) || hasRecurringTurnTiming)) {
            for (const args of planScheduledSpellEffects(spell, caster, executionTargets, () => currentState.turnState.currentTurn, castSaveDC, zoneRegistration)) {
              onAddScheduledSpellEffect(createScheduledSpellEffect(...args));
            }
          }

          const commandProducedMovementDebuffs = finalState.movementDebuffs ?? [];
          if (onAddMovementDebuff && commandProducedMovementDebuffs.length) {
            commandProducedMovementDebuffs.forEach(debuff => onAddMovementDebuff(debuff as MovementTriggerDebuff));
          }

          if (onAddMovementDebuff && spell.effects.some(hasTargetMovementTrigger)) {
            for (const args of planUnpublishedMovementDebuffs(spell, caster, executionTargets, commandProducedMovementDebuffs as MovementTriggerDebuff[], () => currentState.turnState.currentTurn, castSaveDC)) {
              onAddMovementDebuff(createMovementDebuff(...args));
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
    }

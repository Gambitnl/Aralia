/**
 * @file hooks/combat/actionExecutor/moveExecutionFlow.ts
 * EFFECTFUL hook-layer flow. Runs one committed move: facing, the unit_move event, tile effects, Opportunity Attacks, movement-debuff triggers and spell-zone entry effects.
 *
 * C2 (agora-9ed9.2): moved verbatim out of useActionExecutor so the hook keeps
 * state ownership and wiring while this file holds the orchestration. It is NOT
 * a pure system: it calls the callbacks it is given, rolls dice, writes logs and
 * publishes combat events, in the original order. The hook wraps it in a
 * useCallback with the original dependency list, so every value it reads from
 * the context is captured at the same moment the old closure captured it.
 *
 * Called by: hooks/combat/useActionExecutor.ts
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 22:14:43
 * Dependents: hooks/combat/useActionExecutor.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { CombatCharacter, CombatAction } from "../../../types/combat";
import type { ConditionName, SavingThrowAbility } from "../../../types/spells";
import { rollDice } from "../../../systems/dice/rollers";
import { generateId } from "../../../utils/combat";
import { calculateSpellDC, rollSavingThrow } from "../../../utils/character";
import { processMovementTriggers, recenterConjureAnimalsZonesForPackMove } from "../../../systems/spells/effects";
import { combatEvents } from "../../../systems/events/CombatEvents";
import { applyRuntimeStatusCondition } from "../../../utils/combat/statusConditionUtils";
import { facingFromPositions } from "../../../utils/spatial/geometry";
import { getStatusDiscriminator } from "../../../types/combatMessages";
import type { MoveExecutionFlowContext } from './flowContextTypes';

export async function runMoveExecutionFlow(
  ctx: MoveExecutionFlowContext,
  character: CombatCharacter,
  action: CombatAction,
  resolvedMovementCharacter?: CombatCharacter,
): Promise<CombatCharacter> {
  const { addDamageNumber, areaEffectTrackerRef, characters, handleDamage, handleOpportunityAttacks, movementDebuffs, onLogEntry, processTileEffects, setMovementDebuffs, setSpellZones, spellZones, turnState } = ctx;
  if (action.type !== 'move' || !action.targetPosition) return character;

  const previousPosition = character.position;
  // Aerial movement reaches this handler only after the complete 3D route and
  // mode-specific budget have resolved atomically. Ground movement keeps the
  // historical endpoint projection used by every existing caller.
  // Resource payment and aerial validation return a new character without
  // committing the horizontal destination. Apply that destination here so
  // the final update cannot preserve the origin simply because a paid state
  // was supplied. Opportunity Attack damage is still resolved before this
  // completed mover state is published to React.
  // Keep the facing current on every move. Directional spells that carry no
  // target point, such as a cone zone cast from the caster square, read this
  // facing at zone creation. The last step of the path is the true facing,
  // thus a path that turns before it stops does not point at the start square.
  const lastStepStart = action.movementPath && action.movementPath.length >= 2
    ? action.movementPath[action.movementPath.length - 2]
    : previousPosition;
  const movedFacing = facingFromPositions(lastStepStart, action.targetPosition);

  let updatedCharacter: CombatCharacter = {
    ...(resolvedMovementCharacter ?? character),
    position: { ...action.targetPosition },
    facing: movedFacing ?? (resolvedMovementCharacter ?? character).facing,
  };

  // A published movement fact with no subscriber today. It is kept as the
  // movement feed other surfaces can read, but it is NOT complete: command-side
  // forced movement, pull and teleport do not emit it, so nothing may treat it
  // as the whole record of who moved (WF gap filed with agora-f821.45).
  combatEvents.emit({
    type: 'unit_move',
    unitId: character.id,
    from: previousPosition,
    to: action.targetPosition,
    cost: action.cost.movementCost || 0,
    isForced: false
  });

  updatedCharacter = processTileEffects(updatedCharacter, action.targetPosition);
  updatedCharacter = await handleOpportunityAttacks(
    updatedCharacter,
    previousPosition,
    action.targetPosition,
    action.movementMode,
    action.opportunityAttackDecisions,
    action.surprisedCharacterIds,
  );

  // Movement-debuff triggers (e.g., Entangle)
  const moveTriggerResults = processMovementTriggers(movementDebuffs, updatedCharacter, turnState.currentTurn, {
    previousPosition,
    movementType: 'willing'
  });
  for (const result of moveTriggerResults) {
    if (result.triggered) {
      setMovementDebuffs(prev => prev.map(d => d.id === result.sourceId ? { ...d, hasTriggered: true } : d));
      for (const effect of result.effects) {
        if (effect.type === 'damage' && effect.dice) {
          const damage = rollDice(effect.dice);
          updatedCharacter = handleDamage(updatedCharacter, damage, 'moving', effect.damageType, turnState.currentTurn);
        }
      }
    }
  }

  // A Conjure Animals pack owns the center of its proximity zone. Recenter
  // the live state before evaluating movement so a pack move can trigger the
  // authored radius at its new destination in the same action.
  const movementSpellZones = recenterConjureAnimalsZonesForPackMove(spellZones, updatedCharacter);
  if (movementSpellZones !== spellZones) {
    setSpellZones?.(currentZones => recenterConjureAnimalsZonesForPackMove(currentZones, updatedCharacter));
  }

  // Spell-zone area effects on movement
  areaEffectTrackerRef.current.setZones(movementSpellZones);
  const tracker = areaEffectTrackerRef.current;
  // Movement paths are optional so non-map callers can keep their endpoint
  // behavior, but map-driven movement can now preserve each walked tile for
  // Spike Growth-style effects that count travel through a zone.
  const areaTriggerResults = tracker.handleMovement(
    updatedCharacter, action.targetPosition, previousPosition, turnState.currentTurn, action.movementPath
  );

  for (const result of areaTriggerResults) {
    for (const effect of result.effects) {
      switch (effect.type) {
        case 'damage':
          if (effect.dice) {
            let damage = rollDice(effect.dice);
            let saveMessage = '';
            if (effect.requiresSave && effect.saveType) {
              // Area effects can trigger after the original cast. Prefer the
              // caster preserved on the processed trigger effect so saves use
              // the spell's source DC instead of the target's own spell DC.
              const sourceCaster = effect.sourceContext?.casterId
                ? characters.find(candidate => candidate.id === effect.sourceContext?.casterId)
                : undefined;
              const dc = effect.sourceContext?.saveDC ?? calculateSpellDC(sourceCaster || updatedCharacter);
              const saveResult = rollSavingThrow(updatedCharacter, effect.saveType as SavingThrowAbility, dc);
              onLogEntry({
                id: generateId(), timestamp: Date.now(), type: 'status',
                message: `${updatedCharacter.name} ${saveResult.success ? 'succeeds' : 'fails'} ${effect.saveType} save (${saveResult.total} vs DC ${dc})`,
                characterId: updatedCharacter.id
              });
              if (saveResult.success) { damage = Math.floor(damage / 2); saveMessage = ' (save)'; }
            }
            updatedCharacter = handleDamage(updatedCharacter, damage, `zone effect${saveMessage}`, effect.damageType, turnState.currentTurn);
          }
          break;

        case 'heal':
          if (effect.dice) {
            const healing = rollDice(effect.dice);
            const newHP = Math.min(updatedCharacter.maxHP, updatedCharacter.currentHP + healing);
            const actualHealing = newHP - updatedCharacter.currentHP;
            updatedCharacter = { ...updatedCharacter, currentHP: newHP };
            addDamageNumber(actualHealing, action.targetPosition, 'heal');
            onLogEntry({
              id: generateId(), timestamp: Date.now(), type: 'heal',
              message: `${updatedCharacter.name} heals ${actualHealing} HP from zone effect!`,
              characterId: updatedCharacter.id,
              data: { healing: actualHealing, trigger: result.triggerType || 'on_enter_area' }
            });
          }
          break;

        case 'status_condition':
          if (effect.statusName) {
            let appliedCondition = false;
            let saveMessage = '';

            if (effect.requiresSave && effect.saveType) {
              // Keep area-trigger status saves tied to the original caster
              // when the zone/debuff source context is available. This makes
              // delayed zone conditions behave like immediate spell commands.
              const sourceCaster = effect.sourceContext?.casterId
                ? characters.find(candidate => candidate.id === effect.sourceContext?.casterId)
                : undefined;
              const dc = effect.sourceContext?.saveDC ?? calculateSpellDC(sourceCaster || updatedCharacter);
              const saveResult = rollSavingThrow(updatedCharacter, effect.saveType as SavingThrowAbility, dc);
              onLogEntry({
                id: generateId(), timestamp: Date.now(), type: 'status',
                message: `${updatedCharacter.name} ${saveResult.success ? 'succeeds' : 'fails'} ${effect.saveType} save (${saveResult.total} vs DC ${dc})`,
                characterId: updatedCharacter.id
              });
              if (!saveResult.success) {
                appliedCondition = true;
              } else {
                // Area-triggered conditions often resolve after the player has
                // moved into or through a zone. Show successful resistance on
                // the map immediately so the visible board matches the log.
                addDamageNumber(0, updatedCharacter.position, 'resist');
                saveMessage = ' (resisted)';
              }
            } else {
              appliedCondition = true;
            }

            if (appliedCondition && updatedCharacter.conditionImmunities?.includes(effect.statusName as ConditionName)) {
              appliedCondition = false;
              // Immunity prevents the condition just like a successful save,
              // but it communicates a different rule. Use the explicit shared
              // IMMUNE label so the map does not make immunity look like a miss.
              addDamageNumber(0, updatedCharacter.position, 'immune');
              onLogEntry({
                id: generateId(), timestamp: Date.now(), type: 'status',
                message: `${updatedCharacter.name} is immune to ${effect.statusName}`,
                characterId: updatedCharacter.id,
                data: { trigger: result.triggerType || 'on_enter_area' }
              });
            }

            if (appliedCondition) {
              const durationRounds = 1;
              const statusEffect = {
                id: generateId(), name: effect.statusName, type: 'debuff' as const,
                duration: durationRounds, effect: { type: 'condition' as const }, icon: '💀'
              };
              const activeCondition = {
                name: effect.statusName,
                duration: { type: 'rounds' as const, value: durationRounds },
                appliedTurn: turnState.currentTurn,
                source: 'zone_effect'
              };
              const applied = applyRuntimeStatusCondition(updatedCharacter, statusEffect, activeCondition);
              updatedCharacter = applied.character;
              onLogEntry({
                id: generateId(), timestamp: Date.now(), type: 'status',
                message: `${updatedCharacter.name} is now ${effect.statusName} from zone effect!`,
                characterId: updatedCharacter.id,
                eventClass: getStatusDiscriminator(statusEffect.type)?.eventClass,
                data: { statusId: applied.appliedStatus.id, condition: applied.appliedCondition, trigger: result.triggerType || 'on_enter_area' }
              });
            } else {
              onLogEntry({
                id: generateId(), timestamp: Date.now(), type: 'status',
                message: `${updatedCharacter.name} resists ${effect.statusName}${saveMessage}`,
                characterId: updatedCharacter.id,
                data: { trigger: result.triggerType || 'on_enter_area' }
              });
            }
          }
          break;
      }
    }
  }

  return updatedCharacter;
}

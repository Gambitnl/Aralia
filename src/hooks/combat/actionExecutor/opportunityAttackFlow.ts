/**
 * @file hooks/combat/actionExecutor/opportunityAttackFlow.ts
 * EFFECTFUL hook-layer flow. Resolves every Opportunity Attack a voluntary move provokes: reaction prompt or supplied decision, the reaction spend, the attack command, logs, damage numbers, reactive effects and the Sentinel stop.
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
 * Dependents: hooks/combat/actionExecutor/flowContextTypes.ts, hooks/combat/useActionExecutor.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { CombatCharacter, CombatAction, CombatState } from "../../../types/combat";
import { generateId } from "../../../utils/combat";
import { AbilityCommandFactory, CommandExecutor } from "../../../commands";
import { buildCommandGameState } from "../../actionUtils";
import { combatEvents } from "../../../systems/events/CombatEvents";
import { OpportunityAttackSystem } from "../../../systems/combat/reactions/OpportunityAttackSystem";
import { hasSentinelFeat, applySentinelStop, selectOpportunityAttackOptions, opportunityAttackRollSources, spendOpportunityAttackReaction, buildOpportunityAttackReactiveAction } from "../../../systems/combat/opportunityAttackPlanning";
import type { OpportunityAttackFlowContext } from './flowContextTypes';

export async function runOpportunityAttackFlow(
  ctx: OpportunityAttackFlowContext,
  movedCharacter: CombatCharacter,
  previousPosition: { x: number; y: number },
  targetPosition: { x: number; y: number },
  movementMode: CombatAction['movementMode'] | undefined,
  decisions: CombatAction['opportunityAttackDecisions'],
  surprisedCharacterIds: CombatAction['surprisedCharacterIds'],
): Promise<CombatCharacter> {
  const { addDamageNumber, buildRiderState, characters, executeReactionSpell, mapData, onCharacterUpdate, onLogEntry, requestReaction, resolveOnTargetAttackReactiveEffects, turnState } = ctx;
  let updatedCharacter = movedCharacter;
  const oaSystem = new OpportunityAttackSystem();

  // Pass the movement mode through when the movement action knows it. This is
  // what lets a shared summon trait such as Summon Beast Air's Flyby mean
  // "while flying" instead of "any movement by this form."
  const oaResults = oaSystem.checkOpportunityAttacks(
    updatedCharacter,
    previousPosition,
    targetPosition,
    characters,
    mapData,
    {
      movementMode,
      movementKind: 'voluntary',
      turnOrder: turnState.turnOrder,
    },
  );

  for (const result of oaResults) {
    if (!result.canAttack) continue;
    const attacker = characters.find(c => c.id === result.attackerId);
    if (!attacker) continue;
    const { reactionWeapons, warCasterSpells } = selectOpportunityAttackOptions(attacker, !!executeReactionSpell);


    let chosenWeaponId: string | null = null;
    const suppliedDecision = decisions?.[attacker.id];
    if (suppliedDecision) {
      // Deterministic controllers preserve the same explicit choice the
      // player prompt would return. Decline is represented by no selected
      // ability and therefore cannot spend the observer's Reaction.
      chosenWeaponId = suppliedDecision.decision === 'accept'
        ? suppliedDecision.abilityId ?? reactionWeapons[0]?.id ?? warCasterSpells[0]?.id ?? null
        : null;
    } else if (attacker.team === 'player' && requestReaction) {
      // Ask the player to choose between a weapon strike and any War Caster
      // spell that can legally replace the opportunity attack.
      chosenWeaponId = await requestReaction(
        attacker.id,
        updatedCharacter.id,
        'opportunity_attack',
        warCasterSpells,
        reactionWeapons
      );

    } else {
      // Enemies and auto-run characters automatically strike with their first valid melee attack.
      chosenWeaponId = reactionWeapons[0]?.id || null;
    }

    // Every controller reaches the same decline receipt. This keeps AI,
    // player prompt, replay fixture, and future network decisions aligned.
    if (!chosenWeaponId) {
      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'action',
        message: `${attacker.name} declines the Opportunity Attack reaction.`,
        characterId: attacker.id,
        targetIds: [updatedCharacter.id]
      });
      continue;
    }

    const chosenSpell = warCasterSpells.find(a => a.id === chosenWeaponId);
    if (chosenSpell) {
      await executeReactionSpell?.(attacker, updatedCharacter, chosenSpell);
      continue;
    }

    const weaponAbility = reactionWeapons.find(a => a.id === chosenWeaponId) || reactionWeapons[0];
    if (!weaponAbility) continue;

    // The reaction is spent whatever the swing does. It is applied to the
    // roster the command runs against, a few lines below, so the command sees
    // an attacker who has already paid, and it is published from the command's
    // own result rather than twice from here.

    // ----------------------------------------------------------------
    // One attack-roll implementation
    // ----------------------------------------------------------------
    // The reaction prompt, the decline receipt, the reaction spend and the
    // Sentinel stop above and below are movement-reaction concerns and stay
    // here. The swing itself is an ordinary weapon attack, so it is built as
    // a WeaponAttackCommand and run through CommandExecutor. That is what
    // gives an opportunity attack cover, the G14 high-ground rule, attack
    // riders such as Hunter's Mark, the caster's critical threshold, the
    // defensive Shield reaction, Sneak Attack, Colossus Slayer and
    // Assassinate — every one of which the old inline roll skipped.
    // ----------------------------------------------------------------

    // Replay and scenario controllers pin the dice as die sources, so the
    // command keeps owning the roll (rules: opportunityAttackRollSources).
    const { attackRollRng, damageRng } = opportunityAttackRollSources(suppliedDecision, weaponAbility);

    const attackerAfterReaction: CombatCharacter = spendOpportunityAttackReaction(attacker);

    // The roster handed to the command carries every change this movement has
    // already produced: the mover's accumulated damage from an earlier
    // responder, and this responder's spent reaction.
    const commandCharacters = characters.map(character => {
      if (character.id === updatedCharacter.id) return updatedCharacter;
      if (character.id === attacker.id) return attackerAfterReaction;
      return character;
    });
    const commandState: CombatState = {
      ...buildRiderState(commandCharacters),
      mapData: mapData ?? undefined,
    };
    const moverBeforeAttack = updatedCharacter;

    const commands = AbilityCommandFactory.createCommands(
      weaponAbility,
      attackerAfterReaction,
      [updatedCharacter],
      buildCommandGameState(commandCharacters, mapData),
      undefined,
      undefined,
      { attackRollRng, damageRng },
      { surprisedTargetIds: surprisedCharacterIds },
    );

    // Bracket the run so the resolved hit or miss can be read back off the
    // event bus instead of being inferred from the log or the roster.
    const attackSequenceStart = combatEvents.createReplaySnapshot().nextSequence;
    const commandResult = await CommandExecutor.execute(commands, commandState);

    if (!commandResult.success) {
      // No second roll and no fallback. The attack did not resolve, and the
      // reaction the responder already spent is reported as spent.
      onCharacterUpdate(attackerAfterReaction);
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${attacker.name}'s Opportunity Attack against ${updatedCharacter.name} could not resolve: ${commandResult.error?.message ?? 'unknown command failure'}`,
        characterId: attacker.id, targetIds: [updatedCharacter.id],
        data: { rejectedReason: 'opportunity_attack_command_failed' },
      });
      continue;
    }

    // Publish every combatant this responder's swing changed, measured
    // against the roster the hook still holds. That is what carries both the
    // spent reaction and the damage out to React.
    commandResult.finalState.characters.forEach(character => {
      if (character !== characters.find(candidate => candidate.id === character.id)) {
        onCharacterUpdate(character);
      }
    });
    updatedCharacter = commandResult.finalState.characters
      .find(character => character.id === updatedCharacter.id) ?? updatedCharacter;
    // `commandState` starts with an empty log, and commands push onto that
    // same array, so everything in the final log belongs to this one swing.
    commandResult.finalState.combatLog.forEach(entry => onLogEntry(entry));

    const [opportunityAttackResult] = combatEvents.getAttackResultsSince(attackSequenceStart, {
      attackerId: attacker.id,
      targetIds: [moverBeforeAttack.id],
    });

    if (!opportunityAttackResult) {
      // WeaponAttackCommand publishes one attack result per target. Its
      // absence means the swing never reached the roll, which is a bug to
      // report rather than a miss to invent.
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${attacker.name}'s Opportunity Attack against ${updatedCharacter.name} produced no attack roll.`,
        characterId: attacker.id, targetIds: [updatedCharacter.id],
        data: { rejectedReason: 'opportunity_attack_no_roll' },
      });
      continue;
    }

    // The command narrates an ordinary attack roll, so without this receipt
    // the log would never say the attack was an Opportunity Attack, nor which
    // weapon the responder reached for. It carries the roll the command made,
    // so combat-message adapters read hit/miss from here rather than parsing
    // the roll line.
    onLogEntry({
      id: generateId(), timestamp: Date.now(), type: 'action',
      message: `${attacker.name} ${opportunityAttackResult.isHit ? 'hits' : 'misses'} ${updatedCharacter.name} with an Opportunity Attack using ${weaponAbility.name}.`,
      characterId: attacker.id, targetIds: [updatedCharacter.id],
      data: {
        abilityName: weaponAbility.name,
        isHit: opportunityAttackResult.isHit,
        isCrit: opportunityAttackResult.isCritical,
      },
    });

    if (opportunityAttackResult.isHit) {
      const damageDealt = Math.max(
        0,
        (moverBeforeAttack.currentHP - updatedCharacter.currentHP)
        + ((moverBeforeAttack.tempHP ?? 0) - (updatedCharacter.tempHP ?? 0))
      );
      if (damageDealt > 0) {
        addDamageNumber(damageDealt, updatedCharacter.position, 'damage');
      }

      resolveOnTargetAttackReactiveEffects(buildOpportunityAttackReactiveAction(
        attacker, weaponAbility, updatedCharacter, opportunityAttackResult,
        { id: `${generateId()}-opportunity-attack-reactive`, timestamp: Date.now() },
      ), attacker, updatedCharacter.id, opportunityAttackResult);

      if (hasSentinelFeat(attacker)) {
        const sentinelStoppedCharacter = applySentinelStop(updatedCharacter);
        if (sentinelStoppedCharacter !== updatedCharacter) {
          updatedCharacter = sentinelStoppedCharacter;
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'status',
            message: `${attacker.name}'s Sentinel feat stops ${updatedCharacter.name} in place!`,
            characterId: attacker.id,
            targetIds: [updatedCharacter.id]
          });
        }
      }
    } else {
      resolveOnTargetAttackReactiveEffects(buildOpportunityAttackReactiveAction(
        attacker, weaponAbility, updatedCharacter, opportunityAttackResult,
        { id: `${generateId()}-opportunity-attack-reactive`, timestamp: Date.now() },
      ), attacker, updatedCharacter.id, opportunityAttackResult);
      addDamageNumber(0, updatedCharacter.position, 'miss');
    }
  }

  return updatedCharacter;
}

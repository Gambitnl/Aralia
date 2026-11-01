/**
 * @file hooks/combat/useActionExecutor.ts
 * Encapsulates the logic for executing combat actions.
 * Decouples the "How" of action execution from the "When" of turn management.
 * Pure turn and movement decisions live in systems/combat; this hook retains
 * delivery claims, prompts, publication callbacks and combat-event timing.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 22:14:43
 * Dependents: components/DesignPreview/steps/classes/subclasses/barbarian/WildHeartDemo.tsx, hooks/combat/actionExecutor/flowContextTypes.ts, hooks/combat/useTurnManager.ts
 * Imports: 22 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { CombatCharacter, CombatAction, CombatLogEntry, BattleMapData, TurnState, DamageNumber, Animation, AbilityCost, ReactiveTrigger, Ability, CombatState } from "../../types/combat";
import { Spell } from "../../types/spells";
import { rollDice } from "../../systems/dice/rollers";
import { generateId, getActionMessage, isRaging, FRENZY_ABILITY_ID, CUNNING_ACTION_ABILITY_PREFIX, PRIMAL_COMPANION_COMMAND_ABILITY_ID } from "../../utils/combat";
import { resetPrimalBeastCommands, resolveBeastCommand } from "../../utils/combat/beastMasterUtils";
import { resolveCunningAction } from "../../utils/combat/thiefUtils";
import { resolveBeastsStrikeAttack, resolveGiantKillerStrike, resolveHordeBreakerStrike, selectHordeBreakerSecondaryTarget } from "../../systems/combat/riderExtraStrikes";
import type { ExtraStrikeOutcome } from "../../systems/combat/riderExtraStrikes";
import { getHunterPreyChoice, hasHuntersPrey, hasUsedHunterPreyThisTurn } from "../../utils/combat/hunterUtils";
import { ActiveSpellZone, MovementTriggerDebuff } from "../../systems/spells/effects";
import { AreaEffectTracker } from "../../systems/spells/effects/AreaEffectTracker";
import { combatEvents } from "../../systems/events/CombatEvents";
import { groundImpactOfAbility, type ImpactAbilityLike } from "../../systems/combat/groundImpact";
import { type AerialMovementResolution } from "../../utils/combat/aerialMovementUtils";
import { resolveAerialLandingImpact } from "../../systems/combat/fallingGroundImpactResolution";
import { useOptionalGameState } from "../../state/GameContext";
import { startRitual, parseSpecialCastingTimeSeconds } from "../../systems/rituals/RitualManager";
import type { RitualState } from "../../types/rituals";
import { useCombatValidation } from "./useCombatValidation";
import { ImmediateAbilityEffectResult, resolveImmediateAbilityTurnEffects } from "../../systems/combat/actionTurnResolution";
import { prepareActionMovement, planTenserDiskFollow } from "../../systems/combat/actionMovementPlanning";
import { runOpportunityAttackFlow } from "./actionExecutor/opportunityAttackFlow";
import { runMoveExecutionFlow } from "./actionExecutor/moveExecutionFlow";

export interface UseActionExecutorProps {
  characters: CombatCharacter[];
  turnState: TurnState;
  mapData: BattleMapData | null;
  onCharacterUpdate: (character: CombatCharacter) => void;
  onCharacterRemove?: (characterId: string) => void;
  onLogEntry: (entry: CombatLogEntry) => void;
  endTurn: () => void | Promise<void>;

  // Economy
  canAfford: (c: CombatCharacter, cost: AbilityCost) => boolean;
  consumeAction: (c: CombatCharacter, cost: AbilityCost) => CombatCharacter;
  recordAction: (action: CombatAction) => void;

  // Visuals
  addDamageNumber: (val: number, pos: { x: number, y: number }, type: DamageNumber['type']) => void;
  queueAnimation: (anim: Animation) => void;

  // Engine Mechanics
  handleDamage: (c: CombatCharacter, amt: number, src: string, type?: string, currentTurnNumber?: number) => CombatCharacter;
  processRepeatSaves: (c: CombatCharacter, timing: 'turn_end' | 'turn_start' | 'on_damage' | 'on_action', effectId?: string) => CombatCharacter;
  processTileEffects: (c: CombatCharacter, pos: { x: number, y: number }) => CombatCharacter;

  // Engine State
  spellZones: ActiveSpellZone[];
  setSpellZones?: Dispatch<SetStateAction<ActiveSpellZone[]>>;
  movementDebuffs: MovementTriggerDebuff[];
  reactiveTriggers: ReactiveTrigger[];
  setMovementDebuffs: React.Dispatch<React.SetStateAction<MovementTriggerDebuff[]>>;

  // Reaction Selection Helper
  requestReaction?: (
    attackerId: string,
    targetId: string,
    triggerType: 'on_hit' | 'on_cast' | 'on_move' | 'on_take_damage' | 'opportunity_attack',
    reactionSpells?: Array<Spell | Ability>,
    reactionWeapons?: Ability[]
  ) => Promise<string | null>;
  executeReactionSpell?: (
    attacker: CombatCharacter,
    target: CombatCharacter,
    spellAbility: Ability
  ) => Promise<void> | void;
}
// Keep the existing three-argument public helper. Receipt sources are evaluated
// at the same rule branches as before, while the resolver can be deterministic.
export const applyImmediateAbilityTurnEffects = (
  character: CombatCharacter, ability: Ability, currentTurn: number
): ImmediateAbilityEffectResult => resolveImmediateAbilityTurnEffects(character, ability, currentTurn, {
  generateId, now: () => Date.now(),
});


// ============================================================================
// Ritual / long-cast classification
// ============================================================================
// A spell whose header asks for minutes or hours is a ceremony, not a swing of
// the arm. The combat executor cannot resolve it inside one turn, so it hands
// the spell to the ritual runtime instead of applying its effects immediately.
//
// A one-action cast stays a one-action cast, cantrips included. The app has no
// "cast this as a ritual" switch on a combat action yet, so a ritual-capable
// spell that still reads "1 action" keeps its ordinary instant cast; only the
// stated casting time promotes a cast into a ceremony.
// ============================================================================
function getCeremonySpell(ability: Ability | undefined): Spell | null {
  const spell = ability?.spell as Spell | undefined;
  if (!spell?.castingTime) return null;

  const unit = spell.castingTime.unit;
  if (unit === 'minute' || unit === 'hour') return spell;

  // "Special" keeps its real timing in prose on ritualData. Only a spell that
  // actually states a parseable duration there is a ceremony; one that states
  // none is left on its existing path rather than guessed at.
  if (unit === 'special' && parseSpecialCastingTimeSeconds(spell.ritualData?.castingTimeSpecial) !== null) {
    return spell;
  }

  return null;
}

export const useActionExecutor = ({
  characters,
  turnState,
  mapData,
  onCharacterUpdate,
  onCharacterRemove,
  onLogEntry,
  endTurn,
  canAfford,
  consumeAction,
  recordAction,
  addDamageNumber,
  queueAnimation,
  handleDamage,
  processRepeatSaves,
  processTileEffects,
  spellZones,
  setSpellZones,
  movementDebuffs,
  reactiveTriggers,
  setMovementDebuffs,
  requestReaction,
  executeReactionSpell
}: UseActionExecutorProps) => {

  // Ritual starts live in global game state (GameState.activeRitual), not in the
  // combat roster, so the executor reaches for the app dispatch. useOptionalGameState
  // is used because this hook also runs in previews and tests with no provider;
  // a missing dispatch is never silently ignored — the ritual gate below refuses
  // the cast and says so in the combat log.
  const dispatch = useOptionalGameState()?.dispatch;

  // Singleton AreaEffectTracker — created once per hook mount, zones updated each use.
  // Avoids allocating a new object on every movement action (previously `new AreaEffectTracker(spellZones)`).
  const areaEffectTrackerRef = useRef<AreaEffectTracker>(new AreaEffectTracker([]));

  // Movement action ids are stable event identities for the entire transaction.
  // Claiming before validation or an asynchronous reaction prompt makes replay
  // a complete no-op: it cannot pay movement again, prompt again, move again,
  // or publish duplicate attack and movement receipts.
  const processedMovementActionIdsRef = useRef<Set<string>>(new Set());

  // Ability prerequisite gate. This is the production wiring for
  // useCombatValidation: every ability action committed through this executor
  // passes its conditions, disarm state, cooldown, use limits, reach, and
  // authored prerequisites before a single resource is spent.
  const { checkAbilityUsable } = useCombatValidation(characters, mapData);

  // ============================================================================
  // Subclass Rider Bridge
  // ============================================================================
  // The Hunter, Beast Master, Thief and Assassin riders in
  // `utils/combat/{hunter,beastMaster,thief,assassin}Utils` are written against
  // `CombatState` and return a new one. This hook holds a character array, so
  // the two helpers below are the entire adapter: one builds the state a rider
  // reads, the other publishes back exactly the combatants a rider changed.
  // Not one subclass rule lives in this file.
  // ============================================================================
  const buildRiderState = useCallback((roster: CombatCharacter[]): CombatState => ({
    isActive: true,
    characters: roster,
    turnState,
    selectedCharacterId: null,
    selectedAbilityId: null,
    actionMode: 'select',
    validTargets: [],
    validMoves: [],
    combatLog: [],
    reactiveTriggers,
    activeLightSources: [],
  }), [turnState, reactiveTriggers]);

  /**
   * Publishes every combatant a rider replaced. Riders rebuild the roster with
   * `map`, so an untouched combatant is reference-equal and is not republished.
   */
  const publishRiderChanges = useCallback((
    before: CombatCharacter[],
    after: CombatCharacter[],
  ): void => {
    after.forEach((character, index) => {
      if (character !== before[index]) onCharacterUpdate(character);
    });
  }, [onCharacterUpdate]);

  // ============================================================================
  // Shared Reactive Trigger Processing
  // ============================================================================
  // Exactly two live sites read `reactiveTriggers`: the on-target-attack
  // retaliation resolver below and the sustain block inside `executeAction`.
  // The movement path no longer reads this array at all — it reads
  // `movementDebuffs` — so these two are the whole surface. Both now share one
  // selector and one damage applicator, so a change to trigger matching or to
  // reactive damage delivery lands on both sites instead of one.
  //
  // The two sites differ only in presentation: the attack site writes a combat
  // log line, a floating damage number, and a spell animation; the sustain site
  // is silent because the sustain action already logged itself. Those
  // differences stay at the call site as optional arguments rather than as a
  // second copy of the roll-and-apply code.
  // ============================================================================

  /**
   * Selects live reactive triggers of one trigger type, scoped to the owner who
   * fires them. `targetId` matches triggers protecting one character;
   * `casterId` matches triggers a caster owns. Omitting a field leaves it
   * unconstrained.
   */
  const selectReactiveTriggers = useCallback((selector: {
    triggerType: ReactiveTrigger['sourceEffect']['trigger']['type'];
    targetId?: string;
    casterId?: string;
  }): ReactiveTrigger[] => reactiveTriggers.filter(trigger =>
    trigger.sourceEffect.trigger.type === selector.triggerType
    && (selector.targetId === undefined || trigger.targetId === selector.targetId)
    && (selector.casterId === undefined || trigger.casterId === selector.casterId)
  ), [reactiveTriggers]);

  /**
   * Rolls and delivers one reactive trigger's damage. Returns the rolled amount,
   * or null when the trigger carries no damage effect so the caller can tell a
   * silent non-damage trigger from a zero roll.
   */
  const applyReactiveTriggerDamage = useCallback((options: {
    trigger: ReactiveTrigger;
    recipient: CombatCharacter;
    damageSource: string;
    /** Built after the roll so the log line can name the exact amount. */
    buildLogEntry?: (damage: number) => CombatLogEntry;
    /** Supplied when the site shows a floating number over the recipient. */
    damageNumberPosition?: { x: number; y: number };
  }): number | null => {
    const effect = options.trigger.sourceEffect;
    if (effect.type !== 'DAMAGE' || !effect.damage) return null;

    const damage = rollDice(effect.damage.dice);
    if (options.buildLogEntry) {
      onLogEntry(options.buildLogEntry(damage));
    }
    onCharacterUpdate(handleDamage(
      options.recipient,
      damage,
      options.damageSource,
      effect.damage.type,
      turnState.currentTurn
    ));
    if (options.damageNumberPosition) {
      addDamageNumber(damage, options.damageNumberPosition, 'damage');
    }
    return damage;
  }, [handleDamage, onCharacterUpdate, onLogEntry, addDamageNumber, turnState.currentTurn]);

  // ============================================================================
  // On-Target-Attack Reactive Resolver
  // ============================================================================
  // Reactive spells such as Armor of Agathys need one hit/miss-aware path that
  // both normal attacks and opportunity attacks can call. Keeping this helper
  // inside the hook preserves access to the current character roster and state
  // callbacks while avoiding combat-log parsing or duplicated trigger filters.
  // ============================================================================
  const resolveOnTargetAttackReactiveEffects = useCallback((
    action: CombatAction,
    attackingCharacter: CombatCharacter,
    targetId: string,
    resolvedAttackResult: NonNullable<CombatAction['attackResults']>[number] | undefined
  ): void => {
    const triggers = selectReactiveTriggers({ triggerType: 'on_target_attack', targetId });

    // The attack roll lives in the command layer. An Armor of Agathys-style
    // retaliation therefore needs the roll the command actually made, never an
    // inference from the shape of the action, so an action that arrives without
    // a resolved result for this target proves nothing and retaliates for
    // nothing.
    const attackResult = resolvedAttackResult
      ?? action.attackResults?.find(result => result.targetId === targetId);
    if (!attackResult?.isHit) return;

    for (const trigger of triggers) {
      const effect = trigger.sourceEffect;
      const effectTrigger = effect.trigger;
      const attackFilter = 'attackFilter' in effectTrigger ? effectTrigger.attackFilter : undefined;

      // Armor of Agathys stores its "melee attack only" rule in the trigger's
      // attack filter, and the resolved result describes the roll that actually
      // happened.
      if (attackFilter?.weaponType && attackResult.weaponType !== attackFilter.weaponType) continue;

      // Spell data can also limit a reactive rider to weapon or spell attacks.
      if (attackFilter?.attackType && attackResult.attackType !== attackFilter.attackType) continue;

      // Source-owned temporary HP gates keep Armor of Agathys-style triggers
      // from surviving after their own temp-HP pool is gone or replaced.
      const endsWhenOwnTempHpIsGone = effect.conditionalEndings?.some(ending =>
        ending.trigger === 'temporary_hit_points_depleted'
      ) === true;
      if (endsWhenOwnTempHpIsGone) {
        const protectedTarget = characters.find(c => c.id === targetId);
        const sourceMatchesCurrentTempHp = trigger.sourceSpellId !== undefined &&
          protectedTarget?.temporaryHitPointSource?.spellId === trigger.sourceSpellId;
        if (!protectedTarget?.tempHP || protectedTarget.tempHP <= 0 || !sourceMatchesCurrentTempHp) continue;
      }

      applyReactiveTriggerDamage({
        trigger,
        recipient: attackingCharacter,
        damageSource: 'reactive effect',
        buildLogEntry: (damage) => ({
          id: generateId(), timestamp: Date.now(), type: 'damage',
          message: `${attackingCharacter.name} takes ${damage} damage from reactive effect (on_target_attack)!`,
          characterId: attackingCharacter.id,
          data: { damage, trigger: 'on_target_attack' }
        }),
        damageNumberPosition: attackingCharacter.position,
      });

      const targetPositions = action.targetCharacterIds
        ?.map(id => characters.find(c => c.id === id)?.position)
        .filter(Boolean) as { x: number; y: number }[];

      queueAnimation({
        id: generateId(),
        type: 'spell_effect',
        characterId: action.characterId,
        startPosition: attackingCharacter.position,
        endPosition: action.targetPosition,
        duration: 650,
        startTime: Date.now(),
        data: { targetPositions: targetPositions?.length ? targetPositions : action.targetPosition ? [action.targetPosition] : [] },
      });
    }
  }, [characters, selectReactiveTriggers, applyReactiveTriggerDamage, queueAnimation]);

  // ============================================================================
  // Opportunity Attack Resolution
  // ============================================================================
  // Isolated here so OA logic is readable on its own and not buried in the
  // movement executor. Returns the mover's character after absorbing any damage.
  // Weapon choice already exists here; War Caster now reuses the same prompt
  // for single-target action-cast spells and hands spell resolution back to
  // the spell executor so this hook stays focused on OA movement fallout.
  // ============================================================================
  const handleOpportunityAttacks = useCallback((
    movedCharacter: CombatCharacter,
    previousPosition: { x: number; y: number },
    targetPosition: { x: number; y: number },
    movementMode: CombatAction['movementMode'] | undefined,
    decisions: CombatAction['opportunityAttackDecisions'],
    surprisedCharacterIds: CombatAction['surprisedCharacterIds'],
  ): Promise<CombatCharacter> => runOpportunityAttackFlow({ addDamageNumber, buildRiderState, characters, executeReactionSpell, mapData, onCharacterUpdate, onLogEntry, requestReaction, resolveOnTargetAttackReactiveEffects, turnState }, movedCharacter, previousPosition, targetPosition, movementMode, decisions, surprisedCharacterIds), [characters, mapData, onLogEntry, onCharacterUpdate, addDamageNumber, requestReaction, executeReactionSpell, resolveOnTargetAttackReactiveEffects, buildRiderState]);

  // ============================================================================
  // Movement Execution
  // ============================================================================
  // Handles the full sequence for a single tile step: position commit, tile
  // effects, opportunity attacks, movement-debuff triggers, and spell-zone entry.
  // NOTE: D&D 5e OAs occur *before* the creature leaves the reach, but in this
  // synchronous engine we resolve damage retroactively after the move commits.
  // Sentinel now zeroes the mover's remaining movement after a hit so the
  // turn state and the next reset both see the stop.
  // ============================================================================
  const handleMoveExecution = useCallback((
    character: CombatCharacter,
    action: CombatAction,
    resolvedMovementCharacter?: CombatCharacter,
  ): Promise<CombatCharacter> => runMoveExecutionFlow({ addDamageNumber, areaEffectTrackerRef, characters, handleDamage, handleOpportunityAttacks, movementDebuffs, onLogEntry, processTileEffects, setMovementDebuffs, setSpellZones, spellZones, turnState }, character, action, resolvedMovementCharacter), [
    handleOpportunityAttacks, processTileEffects,
    movementDebuffs, setMovementDebuffs,
    spellZones, turnState,
    handleDamage, onLogEntry, addDamageNumber
  ]);

  const processTenserFloatingDiskFollow = useCallback((
    caster: CombatCharacter,
    casterDestination: { x: number; y: number }
  ): void => {
    const disks = characters.filter(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === 'tensers-floating-disk' &&
      character.summonMetadata?.casterId === caster.id
    );

    for (const disk of disks) {
      const plan = planTenserDiskFollow(disk, caster, casterDestination, mapData);
      if (plan.kind === 'remove') {
        onCharacterRemove?.(plan.id);
        onLogEntry({ id: generateId(), timestamp: Date.now(), ...plan.log });
      } else if (plan.kind === 'update') {
        onCharacterUpdate(plan.character);
      }
    }
  }, [characters, mapData, onCharacterRemove, onCharacterUpdate, onLogEntry]);

  // ============================================================================
  // Ability Event Emission (post-update side effects)
  // ============================================================================
  // Emits combat events and resolves reactive triggers (e.g., on_target_attack)
  // that fire after an ability is used. Kept separate from the resource-spending
  // path so reactive logic doesn't inflate the main coordinator.
  // ============================================================================
  /* THE GROUND IMPACT. An explosion-class effect that lands on the 3D map
   * digs a real crater in the voxel arena, and in the world's one ground when
   * the fight stands in the world (useSpellGroundEdits, GG-533): the ability
   * is in hand here, so the classification is made once and travels as a
   * plain fact.
   *
   * It rides the existing spell_effect animation rather than a new channel,
   * because an animation is exactly what this is — a thing that happened at a
   * place at a time, which the renderer consumes and then forgets. The 2D map
   * ignores it (it has no ground to dig), and a cast with no target position
   * has no impact point and produces nothing.
   *
   * GG-533 (2026-10-29): this lived inside handleAbilityEvents, which a spell
   * cast reaches only on its attack-roll replay. A saving-throw blast such as
   * Fireball has no attack rolls and so no replay, and never cratered. A
   * crater does not depend on a hit or a miss, so it is queued on the first
   * pass of every cast (see executeAction) and the replay skips it. */
  const queueGroundImpact = useCallback((
    action: CombatAction,
    updatedCharacter: CombatCharacter
  ): void => {
    if (action.type !== 'ability' || !action.abilityId || !action.targetPosition) return;
    const ability = characters.find(c => c.id === action.characterId)?.abilities.find(a => a.id === action.abilityId);
    const impact = groundImpactOfAbility(ability as ImpactAbilityLike | undefined);
    if (!impact) return;
    queueAnimation({
      id: generateId(),
      type: 'spell_effect',
      characterId: action.characterId,
      startPosition: updatedCharacter.position,
      endPosition: action.targetPosition,
      duration: 650,
      startTime: Date.now(),
      data: {
        spellId: action.abilityId,
        areaOfEffect: ability?.areaOfEffect,
        groundImpact: impact,
        targetPositions: [action.targetPosition],
      },
    });
  }, [characters, queueAnimation]);

  const handleAbilityEvents = useCallback((
    action: CombatAction,
    updatedCharacter: CombatCharacter
  ): void => {
    if (action.type !== 'ability' || !action.abilityId) return;

    const ability = characters.find(c => c.id === action.characterId)?.abilities.find(a => a.id === action.abilityId);

    combatEvents.emit({
      type: 'unit_cast',
      casterId: updatedCharacter.id,
      spellId: action.abilityId,
      targets: action.targetCharacterIds || []
    });

    // The ground impact (a blast's crater) is queued by queueGroundImpact,
    // on the first pass of every cast; the attack-roll replay skips it.
    if (!action.reactiveEventsOnly) queueGroundImpact(action, updatedCharacter);

    if (ability && (ability.type === 'attack' || (ability.spell?.attackType && ability.spell.attackType !== 'none'))) {
      action.targetCharacterIds?.forEach(targetId => {
        // The only hit/miss fact is the one the command layer rolled. Both the
        // spell path and the ability path now set `suppressAbilityEvents` on the
        // first pass and replay a `reactiveEventsOnly` action carrying the real
        // `attackResults`, so this resolver never has to synthesize a roll.
        // A producer that reaches here with no attack result publishes an event
        // whose hit/miss is undefined rather than a fabricated one; the
        // hit-only reactive gate below then declines to fire.
        const resolvedAttackResult = action.attackResults?.find(result => result.targetId === targetId);

        combatEvents.emit({
          type: 'unit_attack',
          attackerId: updatedCharacter.id,
          targetId,
          isHit: resolvedAttackResult?.isHit,
          isCrit: resolvedAttackResult?.isCritical,
          attackType: resolvedAttackResult?.attackType
            ?? (ability.type === 'attack' ? 'weapon' : 'spell'),
          weaponType: resolvedAttackResult?.weaponType
            ?? ((ability.range || 0) <= 5 ? 'melee' : 'ranged')
        });

        // Hand the exact resolved result into the reactive resolver. Without
        // this, command-backed or synthesized misses can still fall back to
        // old ability-shape inference and make Armor of Agathys retaliate as
        // though every attack-like action had hit.
        resolveOnTargetAttackReactiveEffects(action, updatedCharacter, targetId, resolvedAttackResult);
      });
    }
  }, [characters, resolveOnTargetAttackReactiveEffects, queueGroundImpact]);

  // ============================================================================
  // Rider Extra Strikes (agora-db71.24)
  // ============================================================================
  // Three riders grant a second real attack roll. They are resolved here, on the
  // `reactiveEventsOnly` replay, because that envelope is the first moment the
  // executor holds the command-produced hit/miss facts for the attack that
  // triggered them. Not one rider rule lives in this file: the rider modules
  // validate and spend, and `riderExtraStrikes` builds the swing as a real
  // WeaponAttackCommand. Nothing here invents a hit, a miss, or damage.
  // ============================================================================

  /**
   * Publishes one resolved extra strike: the roster it changed, its own combat
   * log, a receipt naming the rider, and the floating damage number. Returns
   * nothing, because the extra strike cannot fail the action that triggered it.
   */
  const publishExtraStrike = useCallback((options: {
    outcome: ExtraStrikeOutcome;
    riderName: string;
    attacker: CombatCharacter;
    targetId: string;
    rosterBefore: CombatCharacter[];
    rejectedReason: string;
  }): void => {
    const { outcome, riderName, attacker, targetId, rosterBefore, rejectedReason } = options;
    // A rider that spent its ledger or reaction before the swing failed still
    // publishes that spend, so the cost is never silently refunded.
    publishRiderChanges(rosterBefore, outcome.state.characters);

    if (!outcome.resolved) {
      if (!outcome.failure && !('riderFailure' in outcome)) return;
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${attacker.name}'s ${riderName} did not resolve.`,
        characterId: attacker.id, targetIds: [targetId],
        data: {
          rejectedReason: `${rejectedReason}:${outcome.failure ?? 'rider_declined'}`,
          ...(outcome.error ? { commandError: outcome.error } : {}),
        },
      });
      return;
    }

    outcome.logEntries.forEach(entry => onLogEntry(entry));

    const targetBefore = rosterBefore.find(character => character.id === targetId);
    const targetAfter = outcome.state.characters.find(character => character.id === targetId);
    const attackResult = outcome.attackResult;

    onLogEntry({
      id: generateId(), timestamp: Date.now(), type: 'action',
      message: `${attacker.name} ${attackResult?.isHit ? 'hits' : 'misses'} ${targetAfter?.name ?? targetBefore?.name ?? 'the target'} with ${riderName}.`,
      characterId: attacker.id, targetIds: [targetId],
      data: {
        abilityName: outcome.ability?.name,
        isHit: attackResult?.isHit,
        isCrit: attackResult?.isCritical,
      },
    });

    if (!targetBefore || !targetAfter) return;
    const damageDealt = Math.max(
      0,
      (targetBefore.currentHP - targetAfter.currentHP)
      + ((targetBefore.tempHP ?? 0) - (targetAfter.tempHP ?? 0))
    );
    if (attackResult?.isHit && damageDealt > 0) {
      addDamageNumber(damageDealt, targetAfter.position, 'damage');
    } else if (!attackResult?.isHit) {
      addDamageNumber(0, targetAfter.position, 'miss');
    }
  }, [publishRiderChanges, onLogEntry, addDamageNumber]);

  /**
   * Horde Breaker: once on the Hunter's turn, the Attack action carries a second
   * swing at another creature within 5 feet of the original target.
   *
   * The turn-owner gate is the rule, not a convenience: Horde Breaker rides the
   * Hunter's own Attack action, so the same replay envelope produced by an
   * opportunity attack on somebody else's turn must not trigger it.
   */
  const resolveHordeBreakerRider = useCallback(async (
    action: CombatAction,
    actor: CombatCharacter,
  ): Promise<void> => {
    if (turnState.currentCharacterId !== actor.id) return;
    if (!hasHuntersPrey(actor)) return;
    if (getHunterPreyChoice(actor) !== 'horde_breaker') return;
    if (hasUsedHunterPreyThisTurn(actor)) return;

    const originalTargetId = action.targetCharacterIds?.[0];
    if (!originalTargetId) return;

    const rosterBefore = characters;
    const riderState = buildRiderState(rosterBefore);
    const secondary = selectHordeBreakerSecondaryTarget(riderState, {
      rangerId: actor.id,
      originalTargetId,
    });
    // No second creature beside the original target is the ordinary case, not a
    // failure, so it is silent and the ledger stays unspent.
    if (!secondary) return;

    const outcome = await resolveHordeBreakerStrike(
      { ...riderState, mapData: mapData ?? undefined },
      {
        rangerId: actor.id,
        originalTargetId,
        secondaryTargetId: secondary.id,
        abilityId: action.abilityId,
        surprisedTargetIds: action.surprisedCharacterIds,
      },
    );

    publishExtraStrike({
      outcome,
      riderName: 'Horde Breaker',
      attacker: actor,
      targetId: secondary.id,
      rosterBefore,
      rejectedReason: 'horde_breaker',
    });
  }, [characters, turnState, mapData, buildRiderState, publishExtraStrike]);

  /**
   * Giant Killer: when a Large or larger creature misses the Hunter, the Hunter
   * spends a reaction to strike back. The miss is read off the resolved attack
   * results of the swing that just happened, never inferred.
   */
  const resolveGiantKillerRider = useCallback(async (
    action: CombatAction,
    attacker: CombatCharacter,
  ): Promise<void> => {
    const misses = (action.attackResults ?? []).filter(result => !result.isHit);
    for (const miss of misses) {
      const rosterBefore = characters;
      const defender = rosterBefore.find(character => character.id === miss.targetId);
      if (!defender) continue;
      if (!hasHuntersPrey(defender)) continue;
      if (getHunterPreyChoice(defender) !== 'giant_killer') continue;

      const outcome = await resolveGiantKillerStrike(
        { ...buildRiderState(rosterBefore), mapData: mapData ?? undefined },
        {
          rangerId: defender.id,
          targetId: attacker.id,
          targetMissedRangerThisTurn: true,
          surprisedTargetIds: action.surprisedCharacterIds,
        },
      );
      // Size, reach and reaction availability are the rider's call. A decline on
      // any of them is an ordinary non-event and stays silent.
      if (!outcome.resolved && outcome.riderFailure) continue;

      publishExtraStrike({
        outcome,
        riderName: 'Giant Killer',
        attacker: defender,
        targetId: attacker.id,
        rosterBefore,
        rejectedReason: 'giant_killer',
      });
    }
  }, [characters, mapData, buildRiderState, publishExtraStrike]);


  // ============================================================================
  // Main Action Coordinator
  // ============================================================================
  // Validates, spends resources, applies immediate effects, then delegates to
  // the appropriate handler. Each handler is independently testable and carries
  // its own focused dependency set.
  // ============================================================================
  const executeAction = useCallback(async (action: CombatAction, onCharacterCommitted?: (character: CombatCharacter) => void): Promise<boolean> => {
    if (action.type === 'end_turn') {
      // Primal Companion commands are one per the ranger's turn. Clearing the
      // tally as the ranger's turn closes is what makes the beast answer once
      // per turn instead of once per combat; nothing else clears it.
      const beforeReset = characters;
      const afterReset = resetPrimalBeastCommands(buildRiderState(beforeReset), action.characterId);
      publishRiderChanges(beforeReset, afterReset.characters);

      await endTurn();
      return true;
    }

    const startCharacter = characters.find(c => c.id === action.characterId);
    if (!startCharacter) return false;
    let resolvedAction = action;
    let aerialMovement: AerialMovementResolution | null = null;

    // Post-command reactive replays use the same action envelope after attack
    // commands have emitted hit/miss facts. They should not spend resources,
    // move the actor, or record a second normal action; they only let reactive
    // effects read the resolved attackResults payload.
    if (action.reactiveEventsOnly) {
      handleAbilityEvents(action, startCharacter);
      // This replay is also where the executor first holds real hit/miss facts
      // for the attack that just resolved, which is exactly what the two Hunter
      // riders trigger on: Horde Breaker on the Hunter's own Attack action, and
      // Giant Killer on a Large+ attacker's miss.
      await resolveHordeBreakerRider(action, startCharacter);
      await resolveGiantKillerRider(action, startCharacter);
      return true;
    }

    // Turn-owned actions must be rejected before resource checks or any
    // mechanics execute. Reactions, legendary actions, and lair actions have
    // their own out-of-turn timing; the free reactive replay returned above is
    // also intentionally exempt. This closes the shared production boundary,
    // so direct ability callers cannot make an inactive actor attack.
    const ownsCurrentTurn = turnState.currentCharacterId === startCharacter.id;
    const isOutOfTurnCost = ['reaction', 'legendary', 'lair'].includes(action.cost.type);
    if (!ownsCurrentTurn && !isOutOfTurnCost) {
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${startCharacter.name} cannot perform this action because it is not their turn.`,
        characterId: startCharacter.id,
        data: { rejectedReason: 'not_turn_owner' },
      });
      return false;
    }

    // A long cast is a ceremony, not an instant effect. It is intercepted here,
    // before any resource is spent or any effect is applied, and handed to the
    // ritual runtime; the action returns without touching the target.
    if (action.type === 'ability' && action.abilityId) {
      const castAbility = startCharacter.abilities.find(a => a.id === action.abilityId);
      const ceremonySpell = getCeremonySpell(castAbility);

      if (ceremonySpell) {
        if (!dispatch) {
          onLogEntry({
            id: generateId(), timestamp: Date.now(), type: 'action',
            message: `${startCharacter.name} cannot begin the ritual of ${ceremonySpell.name}: no game state is available to hold it.`,
            characterId: startCharacter.id,
            data: { spellId: ceremonySpell.id, rejectedReason: 'ritual_state_unavailable' },
          });
          return false;
        }

        let ritual: RitualState;
        try {
          ritual = startRitual(startCharacter, ceremonySpell, turnState.currentTurn);
        } catch (error) {
          // RitualManager refuses a spell whose casting time it cannot model.
          // That refusal is reported, never swallowed into a normal cast.
          onLogEntry({
            id: generateId(), timestamp: Date.now(), type: 'action',
            message: `${startCharacter.name} cannot begin the ritual of ${ceremonySpell.name}: ${error instanceof Error ? error.message : String(error)}`,
            characterId: startCharacter.id,
            data: { spellId: ceremonySpell.id, rejectedReason: 'ritual_start_failed' },
          });
          return false;
        }

        dispatch({ type: 'START_RITUAL', payload: ritual });
        onLogEntry({
          id: generateId(), timestamp: Date.now(), type: 'action',
          message: `${startCharacter.name} begins the ritual of ${ceremonySpell.name}.`,
          characterId: startCharacter.id,
          targetIds: action.targetCharacterIds || [],
          data: { spellId: ceremonySpell.id, spellName: ceremonySpell.name },
        });
        // The action was accepted, so this returns true — but "accepted" and
        // "resolved" are not the same outcome, and a caller that cannot tell
        // them apart casts the spell instantly on top of the ceremony it just
        // started (agora-f821.38; Remy, combat sheet q4, 2026-09-20 23:21Z:
        // "start the ceremony only"). The verdict rides back on the envelope
        // the caller handed in, so every caller that would go on to resolve
        // spell effects can stop here instead.
        action.ritualStarted = true;
        return true;
      }
    }

    // Claim the complete movement delivery before any resource, position, HP,
    // or log mutation. Invalid first delivery remains an atomic rejection, and
    // a simultaneous or later replay of the same stable id is a silent no-op.
    if (action.type === 'move') {
      if (processedMovementActionIdsRef.current.has(action.id)) {
        return true;
      }
      processedMovementActionIdsRef.current.add(action.id);
    }
    const movementPreparation = prepareActionMovement(startCharacter, action, characters, mapData, {
      generateId, now: () => Date.now(),
    });
    if (movementPreparation.rejection) {
      onLogEntry(movementPreparation.rejection);
      return false;
    }
    resolvedAction = movementPreparation.resolvedAction;
    aerialMovement = movementPreparation.aerialMovement ?? null;


    // Frenzy (Path of the Berserker) is only legal while the barbarian is
    // actively raging. Gate it before resource payment so a bonus action is
    // never consumed for an attack the subclass does not currently permit.
    if (
      action.type === 'ability'
      && action.abilityId === FRENZY_ABILITY_ID
      && !isRaging(startCharacter)
    ) {
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${startCharacter.name} cannot use Frenzy while not raging.`,
        characterId: startCharacter.id,
        data: { rejectedReason: 'frenzy_requires_rage' }
      });
      return false;
    }

    // Ability prerequisites: conditions, disarm, cooldown, use limits, reach,
    // and the authored `Ability.prerequisites` block. This runs before payment
    // for the same reason the Frenzy gate above does — an ability the character
    // may not use must never consume an action, a bonus action, or a use.
    if (action.type === 'ability' && action.abilityId) {
      const gatedAbility = startCharacter.abilities.find(a => a.id === action.abilityId);
      if (gatedAbility) {
        const usability = checkAbilityUsable(startCharacter, gatedAbility);
        if (!usability.usable) {
          onLogEntry({
            id: generateId(), timestamp: Date.now(), type: 'action',
            message: usability.reason
              ?? `${startCharacter.name} cannot use ${gatedAbility.name} right now.`,
            characterId: startCharacter.id,
            // The refusal carries a typed code of its own. `rejectedReason`
            // names the family of the refusal; `prerequisiteCode` names which
            // prerequisite failed, so no reader parses a string prefix.
            data: {
              rejectedReason: 'ability_prerequisite',
              prerequisiteCode: usability.code ?? 'unspecified',
            },
          });
          return false;
        }
      }
    }

    // --------------------------------------------------------------------
    // Subclass bonus-action riders (agora-db71.14)
    // --------------------------------------------------------------------
    // Cunning Action and the Beast Master command both PAY the bonus action
    // inside their own rider, so they are dispatched before the generic
    // payment below. Dispatching after it would charge the bonus action twice.
    // --------------------------------------------------------------------
    if (action.type === 'ability' && action.abilityId?.startsWith(CUNNING_ACTION_ABILITY_PREFIX)) {
      const optionId = action.abilityId.slice(CUNNING_ACTION_ABILITY_PREFIX.length);
      const beforeCunning = characters;
      const cunning = resolveCunningAction(
        buildRiderState(beforeCunning),
        { rogueId: startCharacter.id, actionType: optionId },
      );
      if (!cunning.resolved) {
        onLogEntry({
          id: generateId(), timestamp: Date.now(), type: 'action',
          message: `${startCharacter.name} cannot take that Cunning Action right now.`,
          characterId: startCharacter.id,
          data: { rejectedReason: `cunning_action:${cunning.failure ?? 'unspecified'}` },
        });
        return false;
      }
      publishRiderChanges(beforeCunning, cunning.state.characters);
      recordAction(action);
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${startCharacter.name} uses Cunning Action: ${optionId.replace(/_/g, ' ')}.`,
        characterId: startCharacter.id,
        data: { action, actionType: 'bonus_action' },
      });
      return true;
    }

    if (action.type === 'ability' && action.abilityId === PRIMAL_COMPANION_COMMAND_ABILITY_ID) {
      const beastId = action.targetCharacterIds?.[0];
      if (!beastId) {
        onLogEntry({
          id: generateId(), timestamp: Date.now(), type: 'action',
          message: `${startCharacter.name} cannot command a companion without naming one.`,
          characterId: startCharacter.id,
          data: { rejectedReason: 'primal_companion:no_target' },
        });
        return false;
      }
      const beforeCommand = characters;
      const command = resolveBeastCommand(
        buildRiderState(beforeCommand),
        { rangerId: startCharacter.id, beastId },
      );
      if (!command.resolved) {
        onLogEntry({
          id: generateId(), timestamp: Date.now(), type: 'action',
          message: `${startCharacter.name} cannot command their Primal Companion right now.`,
          characterId: startCharacter.id, targetIds: [beastId],
          data: { rejectedReason: `primal_companion:${command.failure ?? 'unspecified'}` },
        });
        return false;
      }
      publishRiderChanges(beforeCommand, command.state.characters);
      recordAction(action);
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${startCharacter.name} commands their Primal Companion.`,
        characterId: startCharacter.id, targetIds: [beastId],
        data: { action, actionType: 'bonus_action' },
      });

      // The command grants the beast its action. A second target id names the
      // creature the ranger commands it to strike; the strike is a real attack
      // command, so it rolls against AC and deals its own damage. Commanding
      // without naming a target is a legitimate command of its own and the
      // beast simply does not swing.
      const strikeTargetId = action.targetCharacterIds?.[1];
      if (strikeTargetId) {
        const rosterBeforeStrike = command.state.characters;
        const beast = rosterBeforeStrike.find(character => character.id === beastId);
        const strike = await resolveBeastsStrikeAttack(
          { ...buildRiderState(rosterBeforeStrike), mapData: mapData ?? undefined },
          { beastId, targetId: strikeTargetId },
        );
        if (beast) {
          publishExtraStrike({
            outcome: strike,
            riderName: "Beast's Strike",
            attacker: beast,
            targetId: strikeTargetId,
            rosterBefore: rosterBeforeStrike,
            rejectedReason: 'beasts_strike',
          });
        }
      }
      return true;
    }

    if (!aerialMovement && !canAfford(startCharacter, resolvedAction.cost)) {
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${startCharacter.name} cannot perform this action (not enough resources or action already used).`,
        characterId: startCharacter.id
      });
      return false;
    }

    let updatedCharacter = aerialMovement?.character
      ?? consumeAction(startCharacter, resolvedAction.cost);
    let followUpActionLogs: CombatLogEntry[] = [];

    // Immediate turn-resource effects (Dash, Disengage, Stand Up)
    if (action.type === 'ability' && action.abilityId) {
      const ability = updatedCharacter.abilities.find(a => a.id === action.abilityId);
      if (ability) {
        const result = applyImmediateAbilityTurnEffects(updatedCharacter, ability, turnState.currentTurn);
        updatedCharacter = result.character;
        followUpActionLogs = result.followUpLogs;
      }
    }

    // Sustain concentration
    if (action.type === 'sustain' && updatedCharacter.concentratingOn) {
      updatedCharacter.concentratingOn.sustainedThisTurn = true;
      combatEvents.emit({
        type: 'unit_sustain',
        casterId: updatedCharacter.id,
        spellId: updatedCharacter.concentratingOn.spellId,
        actionType: action.cost.type as 'action' | 'bonus_action' | 'reaction'
      });
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${updatedCharacter.name} sustains ${updatedCharacter.concentratingOn.spellName}`,
        characterId: updatedCharacter.id,
        data: { actionType: action.cost.type }
      });

      // Trigger sustain effects (e.g., Witch Bolt damage). This runs through the
      // same selector and damage applicator as the on-target-attack resolver;
      // the sustain action already wrote its own log line, so no extra log entry
      // or floating number is requested here.
      const sustainTriggers = selectReactiveTriggers({
        triggerType: 'on_caster_action',
        casterId: updatedCharacter.id,
      });
      for (const trigger of sustainTriggers) {
        if (!trigger.targetId) continue;
        const target = characters.find(c => c.id === trigger.targetId);
        if (!target) continue;
        applyReactiveTriggerDamage({
          trigger,
          recipient: target,
          damageSource: 'sustained spell',
        });
      }
    }

    // Break free from restraint/grapple
    if (action.type === 'break_free' && action.targetEffectId) {
      updatedCharacter = processRepeatSaves(updatedCharacter, 'on_action', action.targetEffectId);
    }

    // Movement: delegate to full movement handler
    if (action.type === 'move' && action.targetPosition) {
      // A controlled descent to the surface closes through CS32's canonical
      // landing transaction with zero falling distance. This preserves one
      // placement/receipt path without applying fall damage to paid descent.
      if (aerialMovement && !aerialMovement.character.aerialMovement?.isFlying && mapData) {
        const landing = resolveAerialLandingImpact({
          eventId: `${resolvedAction.id}-controlled-landing`,
          character: aerialMovement.character,
          landingPosition: resolvedAction.targetPosition!,
          mapData,
          characters,
          fallDistanceFeet: 0,
        });
        if (landing.status !== 'resolved' || !landing.faller) {
          onLogEntry({
            id: generateId(), timestamp: Date.now(), type: 'action',
            message: `${startCharacter.name} cannot complete the landing: ${landing.reason}`,
            characterId: startCharacter.id,
          });
          return false;
        }
        updatedCharacter = landing.faller;
      }

      updatedCharacter = await handleMoveExecution(
        startCharacter,
        resolvedAction,
        updatedCharacter,
      );
      processTenserFloatingDiskFollow(updatedCharacter, resolvedAction.targetPosition!);
    }

    onCharacterUpdate(updatedCharacter);
    // Hand the paid, immediately updated actor to the ability continuation.
    // React may batch publication, so its old roster cannot stand in for this result.
    // The callback stays outside the recorded action and saved combat history.
    onCharacterCommitted?.(updatedCharacter);
    recordAction(resolvedAction);
    onLogEntry({
      id: generateId(), timestamp: Date.now(), type: 'action',
      message: getActionMessage(resolvedAction, updatedCharacter),
      characterId: updatedCharacter.id,
      // Preserve the full resolved action so history readers can replay or
      // inspect the transaction without re-deriving it from the message.
      data: { action: resolvedAction }
    });
    followUpActionLogs.forEach(entry => onLogEntry(entry));

    // Post-update ability side effects: event emission + reactive triggers.
    // Command-backed attacks can suppress this first pass because their hit or
    // miss is not known until commands execute. useAbilitySystem replays a
    // reactive-only action with the resolved attackResults afterward.
    if (!action.suppressAbilityEvents) {
      handleAbilityEvents(resolvedAction, updatedCharacter);
    } else {
      // The crater is not a hit-or-miss fact, so a suppressed first pass
      // still digs it (queueGroundImpact, GG-533).
      queueGroundImpact(resolvedAction, updatedCharacter);
    }

    return true;
  }, [
    characters, turnState, mapData, endTurn, canAfford, consumeAction,
    onCharacterUpdate, onLogEntry, recordAction, dispatch,
    processRepeatSaves, selectReactiveTriggers, applyReactiveTriggerDamage,
    checkAbilityUsable, buildRiderState, publishRiderChanges, publishExtraStrike,
    resolveHordeBreakerRider, resolveGiantKillerRider,
    handleMoveExecution, handleAbilityEvents, queueGroundImpact, processTenserFloatingDiskFollow
  ]);

  // Encounter initialization and Reset Board need a fresh delivery namespace.
  // Clearing only execution receipts preserves all combat state while allowing
  // the same deterministic fixture id to resolve once in the new encounter.
  const resetActionReceipts = useCallback(() => {
    processedMovementActionIdsRef.current.clear();
  }, []);

  return { executeAction, resetActionReceipts };
};

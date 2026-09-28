/**
 * @file systems/combat/riderExtraStrikes.ts
 * The one place a subclass rider turns into a SECOND real attack roll.
 *
 * Three riders grant an extra strike that the rules resolve as an ordinary
 * attack: the Hunter's Horde Breaker (a second swing on the Attack action),
 * the Hunter's Giant Killer (a reaction swing at a Large+ attacker that missed),
 * and the Beast Master's Beast's Strike (the commanded companion's swing).
 * Each rider module already owns its own rules and hands the caller an attack
 * to resolve; none of them may roll it. `resolveExtraStrike` below builds that
 * swing as a `WeaponAttackCommand` through `AbilityCommandFactory.createCommands`
 * and runs it through `CommandExecutor`, exactly as the opportunity attack does
 * since agora-f821.41.
 *
 * That is the whole point of this file: there is no fourth attack-roll
 * implementation and no fabricated hit, miss, or damage anywhere in it. An
 * extra strike that cannot reach the command layer reports a typed failure and
 * the caller says so; it never invents a result.
 */

import type { Ability, CombatCharacter, CombatLogEntry, CombatState } from '../../types/combat';
import type { CombatAttackResult } from '../events/CombatEvents';
import { AbilityCommandFactory, CommandExecutor } from '../../commands';
import { combatEvents } from '../events/CombatEvents';
import { buildCommandGameState } from '../../hooks/actionUtils';
import {
  resolveGiantKillerReaction,
  resolveHordeBreakerAttack,
  type GiantKillerResult,
  type HordeBreakerResult,
} from '../../utils/combat/hunterUtils';
import {
  PRIMAL_BEAST_STRIKE_ABILITY_ID,
  validateBeastsStrike,
  type BeastsStrikeFailure,
} from '../../utils/combat/beastMasterUtils';

// ============================================================================
// Shared Extra-Strike Runner
// ============================================================================

/** Pinned dice sources, the same pair every command path already accepts. */
export interface ExtraStrikeRandomSources {
  attackRollRng?: () => number;
  damageRng?: () => number;
}

export type ExtraStrikeFailure =
  | 'attacker_missing'
  | 'target_missing'
  | 'attack_ability_missing'
  | 'command_failed'
  | 'no_attack_roll';

export interface ExtraStrikeOutcome {
  /**
   * The roster after the swing. On failure this is the state that came in, so a
   * caller can publish it unconditionally.
   */
  state: CombatState;
  resolved: boolean;
  failure?: ExtraStrikeFailure;
  /** The command-produced hit/miss. Present exactly when `resolved` is true. */
  attackResult?: CombatAttackResult;
  /** Only the log lines this swing produced, never the caller's earlier log. */
  logEntries: CombatLogEntry[];
  /** The ability the swing was made with, for the caller's receipt line. */
  ability?: Ability;
  error?: string;
}

export interface ExtraStrikeRequest {
  attackerId: string;
  targetId: string;
  /** The attack ability to swing with. Omitted means "pick the attacker's melee reach". */
  abilityId?: string;
  randomSources?: ExtraStrikeRandomSources;
  surprisedTargetIds?: string[];
}

/**
 * The attacker's reach swing: the first equipped melee attack, else the Unarmed
 * Strike. This is the same selection the opportunity-attack lane makes, and it
 * is a selection, not a fallback result — when the attacker owns no attack
 * ability at all the strike reports `attack_ability_missing`.
 */
export function selectMeleeAttackAbility(attacker: CombatCharacter): Ability | undefined {
  const meleeWeapon = attacker.abilities.find(ability =>
    ability.type === 'attack' && ability.weapon && ability.range <= 2
  );
  if (meleeWeapon) return meleeWeapon;
  const unarmed = attacker.abilities.find(ability => ability.id === 'unarmed_strike');
  if (unarmed) return unarmed;
  return attacker.abilities.find(ability => ability.type === 'attack');
}

/**
 * Builds and runs one extra strike as a real command.
 *
 * The command runs against a copy of `state` whose combat log is empty, so
 * `logEntries` holds this swing's lines alone and the caller can publish them
 * without republishing its own history.
 */
export async function resolveExtraStrike(
  state: CombatState,
  request: ExtraStrikeRequest,
): Promise<ExtraStrikeOutcome> {
  const attacker = state.characters.find(character => character.id === request.attackerId);
  if (!attacker) return { state, resolved: false, failure: 'attacker_missing', logEntries: [] };

  const target = state.characters.find(character => character.id === request.targetId);
  if (!target) return { state, resolved: false, failure: 'target_missing', logEntries: [] };

  const ability = request.abilityId
    ? attacker.abilities.find(candidate => candidate.id === request.abilityId)
    : selectMeleeAttackAbility(attacker);
  if (!ability || ability.type !== 'attack') {
    return { state, resolved: false, failure: 'attack_ability_missing', logEntries: [] };
  }

  const commandState: CombatState = { ...state, combatLog: [] };
  const commands = AbilityCommandFactory.createCommands(
    ability,
    attacker,
    [target],
    buildCommandGameState(state.characters, state.mapData ?? null),
    undefined,
    undefined,
    request.randomSources,
    { surprisedTargetIds: request.surprisedTargetIds },
  );

  // Bracket the run so hit/miss is read off the event bus the command itself
  // published, rather than inferred from the roster or parsed out of prose.
  const sequenceStart = combatEvents.createReplaySnapshot().nextSequence;
  const commandResult = await CommandExecutor.execute(commands, commandState);

  if (!commandResult.success) {
    return {
      state,
      resolved: false,
      failure: 'command_failed',
      logEntries: [],
      ability,
      error: commandResult.error?.message,
    };
  }

  const [attackResult] = combatEvents.getAttackResultsSince(sequenceStart, {
    attackerId: attacker.id,
    targetIds: [target.id],
  });
  if (!attackResult) {
    // WeaponAttackCommand publishes one attack result per target. Its absence
    // means the swing never reached the roll: a defect to report, not a miss
    // to invent.
    return { state, resolved: false, failure: 'no_attack_roll', logEntries: [], ability };
  }

  return {
    state: {
      ...commandResult.finalState,
      combatLog: [...state.combatLog, ...commandResult.finalState.combatLog],
    },
    resolved: true,
    attackResult,
    logEntries: commandResult.finalState.combatLog,
    ability,
  };
}

// ============================================================================
// Horde Breaker
// ============================================================================

export interface HordeBreakerStrikeOutcome extends ExtraStrikeOutcome {
  /** Why the rider itself declined, before any swing was built. */
  riderFailure?: HordeBreakerResult['failure'];
  secondaryTargetId?: string;
}

/**
 * The second creature Horde Breaker strikes: a living hostile, other than the
 * original target, standing within 5 feet of it.
 *
 * Roster order decides between equally eligible creatures. The rules let the
 * Hunter choose and the game has no prompt for that choice yet, so the engine
 * picks the first eligible creature deterministically instead of rolling for
 * one. Replace this with the player's pick when a prompt exists.
 */
export function selectHordeBreakerSecondaryTarget(
  state: CombatState,
  request: { rangerId: string; originalTargetId: string },
): CombatCharacter | undefined {
  const ranger = state.characters.find(character => character.id === request.rangerId);
  const original = state.characters.find(character => character.id === request.originalTargetId);
  if (!ranger || !original) return undefined;

  return state.characters.find(candidate =>
    candidate.id !== ranger.id
    && candidate.id !== original.id
    && candidate.team !== ranger.team
    && candidate.currentHP > 0
    && Math.max(
      Math.abs(candidate.position.x - original.position.x),
      Math.abs(candidate.position.y - original.position.y),
    ) <= 1
  );
}

/**
 * Horde Breaker's extra attack. The rider validates reach and spends the
 * once-per-turn ledger; the swing itself is a real command.
 */
export async function resolveHordeBreakerStrike(
  state: CombatState,
  request: {
    rangerId: string;
    originalTargetId: string;
    secondaryTargetId: string;
    abilityId?: string;
    randomSources?: ExtraStrikeRandomSources;
    surprisedTargetIds?: string[];
  },
): Promise<HordeBreakerStrikeOutcome> {
  const rider = resolveHordeBreakerAttack(state, {
    rangerId: request.rangerId,
    originalTargetId: request.originalTargetId,
    secondaryTargetId: request.secondaryTargetId,
  });
  if (!rider.resolved) {
    return { state: rider.state, resolved: false, riderFailure: rider.failure, logEntries: [] };
  }

  const strike = await resolveExtraStrike(rider.state, {
    attackerId: request.rangerId,
    targetId: request.secondaryTargetId,
    abilityId: request.abilityId,
    randomSources: request.randomSources,
    surprisedTargetIds: request.surprisedTargetIds,
  });

  // The ledger is spent whatever the swing rolls, so a failed swing still
  // returns the rider's state rather than the one handed in.
  return {
    ...strike,
    state: strike.resolved ? strike.state : rider.state,
    secondaryTargetId: rider.secondaryTargetId,
  };
}

// ============================================================================
// Giant Killer
// ============================================================================

export interface GiantKillerStrikeOutcome extends ExtraStrikeOutcome {
  riderFailure?: GiantKillerResult['failure'];
}

/**
 * Giant Killer's reaction attack. The rider checks the attacker's size, reach,
 * and the Hunter's reaction and spends it; the swing itself is a real command.
 */
export async function resolveGiantKillerStrike(
  state: CombatState,
  request: {
    rangerId: string;
    targetId: string;
    targetMissedRangerThisTurn: boolean;
    abilityId?: string;
    randomSources?: ExtraStrikeRandomSources;
    surprisedTargetIds?: string[];
  },
): Promise<GiantKillerStrikeOutcome> {
  const rider = resolveGiantKillerReaction(state, {
    rangerId: request.rangerId,
    targetId: request.targetId,
    targetMissedRangerThisTurn: request.targetMissedRangerThisTurn,
  });
  if (!rider.resolved) {
    return { state: rider.state, resolved: false, riderFailure: rider.failure, logEntries: [] };
  }

  const strike = await resolveExtraStrike(rider.state, {
    attackerId: request.rangerId,
    targetId: request.targetId,
    abilityId: request.abilityId,
    randomSources: request.randomSources,
    surprisedTargetIds: request.surprisedTargetIds,
  });

  // The reaction is spent whatever the swing rolls.
  return { ...strike, state: strike.resolved ? strike.state : rider.state };
}

// ============================================================================
// Beast's Strike
// ============================================================================

export interface BeastsStrikeOutcome extends ExtraStrikeOutcome {
  riderFailure?: BeastsStrikeFailure;
}

/**
 * The commanded companion's swing. `validateBeastsStrike` owns the form and
 * reach rules; the attack roll and the damage are the beast's own
 * `primal_beast_strike` ability resolved as a command, which is what gives the
 * strike an AC check, cover, advantage, and a real damage log.
 */
export async function resolveBeastsStrikeAttack(
  state: CombatState,
  request: {
    beastId: string;
    targetId: string;
    randomSources?: ExtraStrikeRandomSources;
    surprisedTargetIds?: string[];
  },
): Promise<BeastsStrikeOutcome> {
  const rider = validateBeastsStrike(state, { beastId: request.beastId, targetId: request.targetId });
  if (!rider.resolved) {
    return { state, resolved: false, riderFailure: rider.failure, logEntries: [] };
  }

  return resolveExtraStrike(state, {
    attackerId: request.beastId,
    targetId: request.targetId,
    abilityId: PRIMAL_BEAST_STRIKE_ABILITY_ID,
    randomSources: request.randomSources,
    surprisedTargetIds: request.surprisedTargetIds,
  });
}

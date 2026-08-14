// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file is an isolated Race-domain leaf with no sibling-leaf imports.
 *
 * MULTI-AGENT SAFETY:
 * The registry discovers this module automatically. Keep Frost Giant Goliath
 * work inside this file so other race leaves can continue independently.
 */
// @dependencies-end

import React, { useState } from 'react';
import { getRacialTraitLibrary } from '../../../../../data/races';
import { applyRacialSpellGrantsByLevel, resolveRacialResourceId } from '../../../../../utils/character/characterUtils';
import { getAbilityModifierValue } from '../../../../../utils/character/statUtils';
import { calculateProficiencyBonus } from '../../../../../utils/character/savingThrowUtils';
import { applyDamageAndCheckDowned } from '../../../../../utils/combat/deathSaveUtils';
import {
  calculateDamage,
  createPlayerCombatCharacter,
  resolveAttack,
  rollD20,
  rollDamage,
} from '../../../../../utils/combat/combatUtils';
import {
  canAffordActionCost,
  consumeActionCost,
  resetEconomy,
} from '../../../../../utils/combat/actionEconomyUtils';
import {
  applyRuntimeStatusCondition,
  removeRuntimeStatusCondition,
} from '../../../../../utils/combat/statusConditionUtils';
import {
  createQuickCharacter,
  createQuickCombatCharacter,
} from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { Race } from '../../../../../types';
import type { ActiveCondition, CombatCharacter, StatusEffect } from '../../../../../types/combat';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file gives Frost Giant Goliath a deterministic Frost's Chill attack
 * transaction inside the Tactical Sandbox Race domain.
 *
 * The leaf assembles a production-shaped actor from canonical Race data,
 * carries the parsed Proficiency Bonus/Long Rest resource across the current
 * persistent-to-combat bridge, and resolves a native attack, damage, HP,
 * Action, cold rider, and owned speed-status transition. The target's speed
 * changes through the shared movement calculation, not by mutating its base
 * speed. Large Form and Powerful Build remain canonical facts and boundaries.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Frost Giant Goliath data, racial trait parsing,
 * quick-character assembly, combat/action/status helpers, and the leaf contract.
 */

// ============================================================================
// Canonical Frost Giant Goliath Facts
// ============================================================================
// These readers keep the preview tied to authored Race data and the production
// racial-resource library instead of duplicating rule text or charge limits.
// ============================================================================

export const FROST_GIANT_GOLIATH_FROSTS_CHILL_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'frost_giant_goliath__frost_s_chill__resource',
);
export const FROST_GIANT_GOLIATH_ACTOR_ID = 'frost-giant-goliath-frosts-chill-actor';
export const FROST_GIANT_GOLIATH_TARGET_ID = 'frost-giant-goliath-frosts-chill-target';
export const FROST_GIANT_GOLIATH_TARGET_AC = 16;
export const FROST_GIANT_GOLIATH_TARGET_HP = 40;
export const FROST_GIANT_GOLIATH_TARGET_BASE_SPEED = 30;
export const FROST_GIANT_GOLIATH_BASE_ATTACK_DICE = '1d8+3';
export const FROST_GIANT_GOLIATH_FROSTS_CHILL_DICE = '1d6';
export const FROST_GIANT_GOLIATH_HIT_ROLL = 12;
export const FROST_GIANT_GOLIATH_MISS_ROLL = 5;
export const FROST_GIANT_GOLIATH_SLOW_NAME = "Frost's Chill Slow";
export const FROST_GIANT_GOLIATH_SLOW_SOURCE = "Frost's Chill";

const FROST_GIANT_GOLIATH_SPEED_TRAIT = /^Speed:\s*/i;
const FROST_GIANT_GOLIATH_FROSTS_CHILL_TRAIT = /^Frost's Chill:\s*/i;
const FROST_GIANT_GOLIATH_LARGE_FORM_TRAIT = /^Large Form:\s*/i;
const FROST_GIANT_GOLIATH_POWERFUL_BUILD_TRAIT = /^Powerful Build:\s*/i;

/** Return the canonical walking-speed text shown in the facts panel. */
export function getCanonicalFrostGiantGoliathSpeedTrait(race: Race): string | null {
  return race.traits.find(trait => FROST_GIANT_GOLIATH_SPEED_TRAIT.test(trait.trim())) ?? null;
}

/** Parse the authored walking speed used by the narrow production adapter. */
export function getCanonicalFrostGiantGoliathSpeedFeet(race: Race): number | null {
  const match = getCanonicalFrostGiantGoliathSpeedTrait(race)?.match(/(\d+)\s+feet/i);
  return match ? Number(match[1]) : null;
}

/** Return the exact canonical Frost's Chill trait supplied to this leaf. */
export function getCanonicalFrostGiantGoliathFrostsChillTrait(race: Race): string | null {
  return race.traits.find(trait => FROST_GIANT_GOLIATH_FROSTS_CHILL_TRAIT.test(trait.trim())) ?? null;
}

/** Return the canonical Large Form fact shown beside the supported attack. */
export function getCanonicalFrostGiantGoliathLargeFormTrait(race: Race): string | null {
  return race.traits.find(trait => FROST_GIANT_GOLIATH_LARGE_FORM_TRAIT.test(trait.trim())) ?? null;
}

/** Return the canonical Powerful Build fact shown beside the supported attack. */
export function getCanonicalFrostGiantGoliathPowerfulBuildTrait(race: Race): string | null {
  return race.traits.find(trait => FROST_GIANT_GOLIATH_POWERFUL_BUILD_TRAIT.test(trait.trim())) ?? null;
}

/** Read Frost's Chill's parsed resource without rebuilding the parser. */
export function getCanonicalFrostGiantGoliathFrostsChillResource(race: Race) {
  const trait = getRacialTraitLibrary().byRaceId[race.id]?.find(candidate => (
    candidate.type !== 'spell' && candidate.traitName === "Frost's Chill"
  ));
  if (!trait || trait.type === 'spell') return undefined;
  return trait.resources?.find(resource => (
    resolveRacialResourceId('feature', resource.id) === FROST_GIANT_GOLIATH_FROSTS_CHILL_RESOURCE_ID
  ));
}

/** Confirm that the supplied Race still authorizes this bounded transaction. */
export function hasCanonicalFrostGiantGoliathFrostsChill(race: Race): boolean {
  const frostChill = getCanonicalFrostGiantGoliathFrostsChillTrait(race);
  const resource = getCanonicalFrostGiantGoliathFrostsChillResource(race);
  return race.id === 'frost_giant_goliath'
    && race.name === 'Frost Giant Goliath'
    && getCanonicalFrostGiantGoliathSpeedFeet(race) === 35
    && !!frostChill
    && /hit a target with an attack roll/i.test(frostChill)
    && /extra 1d6 cold damage/i.test(frostChill)
    && /reduce the target's speed by 10 feet/i.test(frostChill)
    && /start of your next turn/i.test(frostChill)
    && /proficiency bonus/i.test(frostChill)
    && /long rest/i.test(frostChill)
    && resource?.maxUses === 'proficiency_bonus'
    && resource.resetOn === 'long_rest'
    && !!getCanonicalFrostGiantGoliathLargeFormTrait(race)
    && !!getCanonicalFrostGiantGoliathPowerfulBuildTrait(race);
}

// ============================================================================
// Deterministic Production Assembly
// ============================================================================
// The preview has no mounted combat snapshot to borrow. It therefore creates
// a real actor and target through existing quick-character seams, then carries
// only the parsed racial resource across the known bridge gap.
// ============================================================================

const FIXED_DAMAGE_RNG = (): number => 0.5;

function fixedD20Rng(roll: number): () => number {
  // The midpoint preserves rollD20's ordinary random contract while making
  // the selected hit or miss face deterministic for repeatable proof.
  return () => (roll - 0.5) / 20;
}

function getFrostGiantGoliathResource(actor: CombatCharacter) {
  return actor.limitedUses?.[FROST_GIANT_GOLIATH_FROSTS_CHILL_RESOURCE_ID];
}

function getFrostGiantGoliathAttackBonus(actor: CombatCharacter): number {
  return getAbilityModifierValue(actor.stats.strength) + calculateProficiencyBonus(actor.level);
}

function createFrostGiantGoliathActor(race: Race): CombatCharacter | null {
  // The canonical race controls the resource and speed; the quick character
  // supplies a deterministic level-5 body for this focused transaction.
  const quickCharacter = createQuickCharacter({
    name: "Frost Giant Goliath · Frost's Chill Tester",
    raceId: race.id,
    classId: 'fighter',
    level: 5,
    stats: [16, 12, 14, 10, 10, 10],
  });
  const speedFeet = getCanonicalFrostGiantGoliathSpeedFeet(race);
  if (!quickCharacter || speedFeet === null || !hasCanonicalFrostGiantGoliathFrostsChill(race)) return null;

  // Apply the production racial parser before the persistent-to-combat bridge
  // so the actor starts with the real PB number of Frost's Chill charges.
  const assembledCharacter = applyRacialSpellGrantsByLevel(quickCharacter, quickCharacter.level ?? 1);
  const generatedActor = createPlayerCombatCharacter(assembledCharacter);
  const resource = assembledCharacter.limitedUses?.[FROST_GIANT_GOLIATH_FROSTS_CHILL_RESOURCE_ID];
  if (!resource) return null;

  // DEBT: createPlayerCombatCharacter currently does not project racial
  // limitedUses into CombatCharacter. This adapter carries only the canonical
  // parsed resource forward; the shared bridge should own this projection once
  // it is widened, and no other Frost Giant mechanic is materialized here.
  // DEBT: quick character assembly also needs to derive Race speed centrally.
  // This leaf projects the canonical 35-foot speed only at this narrow seam.
  return resetEconomy({
    ...generatedActor,
    id: FROST_GIANT_GOLIATH_ACTOR_ID,
    name: `${race.name} · Frost's Chill Tester`,
    position: { x: 2, y: 4 },
    stats: { ...generatedActor.stats, speed: speedFeet },
    limitedUses: {
      [FROST_GIANT_GOLIATH_FROSTS_CHILL_RESOURCE_ID]: { ...resource },
    },
  });
}

function createFrostGiantGoliathTarget(): CombatCharacter | null {
  // The target is a native combat character with fixed AC, HP, and speed so
  // attack legality, damage, and the temporary movement pool stay inspectable.
  const target = createQuickCombatCharacter({
    name: 'Iron Target · AC 16',
    raceId: 'human',
    classId: 'fighter',
    level: 1,
    stats: [12, 10, 12, 10, 10, 10],
  });
  if (!target) return null;

  return {
    ...target,
    id: FROST_GIANT_GOLIATH_TARGET_ID,
    name: 'Iron Target · AC 16 · 40 HP',
    team: 'enemy',
    position: { x: 4, y: 4 },
    armorClass: FROST_GIANT_GOLIATH_TARGET_AC,
    baseAC: FROST_GIANT_GOLIATH_TARGET_AC,
    currentHP: FROST_GIANT_GOLIATH_TARGET_HP,
    maxHP: FROST_GIANT_GOLIATH_TARGET_HP,
    stats: { ...target.stats, speed: FROST_GIANT_GOLIATH_TARGET_BASE_SPEED },
    resistances: [],
    immunities: [],
    vulnerabilities: [],
  };
}

export interface FrostGiantGoliathFrostsChillScenarioState {
  actor: CombatCharacter | null;
  target: CombatCharacter | null;
  outcome: string;
  lastResolution: FrostGiantGoliathFrostsChillResolution | null;
}

export type FrostGiantGoliathFrostsChillAttackMode = 'hit' | 'miss';

export type FrostGiantGoliathFrostsChillReason =
  | 'hit'
  | 'miss'
  | 'chill_declined'
  | 'chill_exhausted'
  | 'action_unavailable'
  | 'assembly_unavailable'
  | 'no_active_slow'
  | 'slow_expired';

export interface FrostGiantGoliathFrostsChillResolution {
  status: 'resolved' | 'rejected';
  reason: FrostGiantGoliathFrostsChillReason;
  attackRoll: number;
  attackTotal: number;
  baseDamage: number;
  coldDamage: number;
  targetHpBefore: number;
  targetHpAfter: number;
  targetSpeedBefore: number;
  targetSpeedAfter: number;
  frostChillUsed: boolean;
  slowApplied: boolean;
}

function createResolution(
  status: FrostGiantGoliathFrostsChillResolution['status'],
  reason: FrostGiantGoliathFrostsChillReason,
  values: Omit<FrostGiantGoliathFrostsChillResolution, 'status' | 'reason'>,
): FrostGiantGoliathFrostsChillResolution {
  // One complete result packet keeps the visible log and focused tests aligned
  // on attack face, damage, HP, movement, and resource decisions.
  return { status, reason, ...values };
}

function getFrostGiantGoliathSlow(target: CombatCharacter | null): StatusEffect | undefined {
  // Ownership keeps expiry scoped to this Frost's Chill rider if another slow
  // is ever present on the same target.
  return target?.statusEffects.find(status => (
    status.id === `${FROST_GIANT_GOLIATH_SLOW_SOURCE}-${FROST_GIANT_GOLIATH_TARGET_ID}`
  ));
}

function createFrostGiantGoliathSlowRecords(actor: CombatCharacter): {
  status: StatusEffect;
  condition: ActiveCondition;
} {
  // The shared movement calculator reads this stat modifier and refreshes the
  // target's movement pool without changing its authored base speed.
  const status: StatusEffect = {
    id: `${FROST_GIANT_GOLIATH_SLOW_SOURCE}-${FROST_GIANT_GOLIATH_TARGET_ID}`,
    name: FROST_GIANT_GOLIATH_SLOW_NAME,
    type: 'debuff',
    duration: 1,
    description: "Speed reduced by 10 feet until the start of the Frost Giant Goliath's next turn.",
    source: FROST_GIANT_GOLIATH_SLOW_SOURCE,
    sourceCasterId: actor.id,
    effect: { type: 'stat_modifier', stat: 'speed', value: -10 },
  };
  const condition: ActiveCondition = {
    name: FROST_GIANT_GOLIATH_SLOW_NAME,
    duration: { type: 'special', value: 1 },
    appliedTurn: 1,
    source: FROST_GIANT_GOLIATH_SLOW_SOURCE,
    sourceCasterId: actor.id,
  };
  return { status, condition };
}

/** Resolve one deterministic attack and optional Frost's Chill rider. */
export function resolveFrostGiantGoliathFrostsChill(
  scenario: FrostGiantGoliathFrostsChillScenarioState,
  mode: FrostGiantGoliathFrostsChillAttackMode,
  useFrostsChill: boolean,
): FrostGiantGoliathFrostsChillScenarioState {
  const actor = scenario.actor;
  const target = scenario.target;
  if (!actor || !target) {
    return {
      ...scenario,
      outcome: 'Attack rejected: the production-assembled actor or target is missing.',
      lastResolution: createResolution('rejected', 'assembly_unavailable', {
        attackRoll: 0,
        attackTotal: 0,
        baseDamage: 0,
        coldDamage: 0,
        targetHpBefore: target?.currentHP ?? 0,
        targetHpAfter: target?.currentHP ?? 0,
        targetSpeedBefore: target?.actionEconomy.movement.total ?? 0,
        targetSpeedAfter: target?.actionEconomy.movement.total ?? 0,
        frostChillUsed: false,
        slowApplied: false,
      }),
    };
  }

  const actionCost = { type: 'action' as const };
  if (!canAffordActionCost(actor, actionCost)) {
    return {
      ...scenario,
      outcome: "Attack rejected atomically: Action already used; HP, speed, and Frost's Chill uses unchanged.",
      lastResolution: createResolution('rejected', 'action_unavailable', {
        attackRoll: 0,
        attackTotal: 0,
        baseDamage: 0,
        coldDamage: 0,
        targetHpBefore: target.currentHP,
        targetHpAfter: target.currentHP,
        targetSpeedBefore: target.actionEconomy.movement.total,
        targetSpeedAfter: target.actionEconomy.movement.total,
        frostChillUsed: false,
        slowApplied: false,
      }),
    };
  }

  // Native d20 and attack helpers own AC legality and critical-face behavior.
  const attackRoll = rollD20({
    rng: fixedD20Rng(mode === 'hit' ? FROST_GIANT_GOLIATH_HIT_ROLL : FROST_GIANT_GOLIATH_MISS_ROLL),
  });
  const attack = resolveAttack(
    attackRoll,
    getFrostGiantGoliathAttackBonus(actor),
    target.armorClass,
  );
  const paidActor = consumeActionCost(actor, actionCost);
  const targetHpBefore = target.currentHP;
  const targetSpeedBefore = target.actionEconomy.movement.total;

  if (!attack.isHit) {
    // A miss pays the ordinary Action, but the hit-gated rider stays untouched.
    const resolution = createResolution('resolved', 'miss', {
      attackRoll,
      attackTotal: attack.total,
      baseDamage: 0,
      coldDamage: 0,
      targetHpBefore,
      targetHpAfter: targetHpBefore,
      targetSpeedBefore,
      targetSpeedAfter: targetSpeedBefore,
      frostChillUsed: false,
      slowApplied: false,
    });
    return {
      ...scenario,
      actor: paidActor,
      outcome: `Attack missed: ${attackRoll}+${getFrostGiantGoliathAttackBonus(actor)} = ${attack.total}; Action paid; Frost's Chill not used.`,
      lastResolution: resolution,
    };
  }

  // Native dice, damage, and HP helpers resolve the physical hit first. The
  // fixed RNG makes the base and cold damage repeatable without replacing them.
  const baseRolledDamage = rollDamage(
    FROST_GIANT_GOLIATH_BASE_ATTACK_DICE,
    attack.isCritical,
    1,
    FIXED_DAMAGE_RNG,
  );
  const baseDamage = calculateDamage(baseRolledDamage, actor, target, 'bludgeoning');
  let nextTarget = applyDamageAndCheckDowned(target, baseDamage, attack.isCritical);
  let nextActor = paidActor;
  let coldDamage = 0;
  let reason: FrostGiantGoliathFrostsChillReason = useFrostsChill ? 'hit' : 'chill_declined';
  let frostChillUsed = false;
  let slowApplied = false;
  const resource = getFrostGiantGoliathResource(actor);

  if (useFrostsChill && (!resource || resource.current <= 0)) {
    // Exhaustion is a successful base attack with an atomic no-op for the
    // optional rider; the resource never underflows and speed is unchanged.
    reason = 'chill_exhausted';
  } else if (useFrostsChill && resource) {
    const rolledColdDamage = rollDamage(FROST_GIANT_GOLIATH_FROSTS_CHILL_DICE, false, 1, FIXED_DAMAGE_RNG);
    coldDamage = calculateDamage(rolledColdDamage, actor, nextTarget, 'cold');
    nextTarget = applyDamageAndCheckDowned(nextTarget, coldDamage);
    nextActor = {
      ...paidActor,
      limitedUses: {
        ...paidActor.limitedUses,
        [FROST_GIANT_GOLIATH_FROSTS_CHILL_RESOURCE_ID]: {
          ...resource,
          current: Math.max(0, resource.current - 1),
        },
      },
    };
    // Build the paired records once so the status and condition mirrors share
    // exactly the same ownership metadata for later native removal.
    const slowRecords = createFrostGiantGoliathSlowRecords(actor);
    const applied = applyRuntimeStatusCondition(nextTarget, slowRecords.status, slowRecords.condition);
    nextTarget = applied.character;
    frostChillUsed = true;
    slowApplied = true;
  }

  const resolution = createResolution('resolved', reason, {
    attackRoll,
    attackTotal: attack.total,
    baseDamage,
    coldDamage,
    targetHpBefore,
    targetHpAfter: nextTarget.currentHP,
    targetSpeedBefore,
    targetSpeedAfter: nextTarget.actionEconomy.movement.total,
    frostChillUsed,
    slowApplied,
  });
  const resourceAfter = getFrostGiantGoliathResource(nextActor);
  return {
    ...scenario,
    actor: nextActor,
    target: nextTarget,
    outcome: frostChillUsed
      ? `Attack hit: ${attack.total}; base ${baseDamage} bludgeoning + ${coldDamage} Frost's Chill cold; target speed ${targetSpeedBefore} → ${nextTarget.actionEconomy.movement.total} ft; Action paid; uses ${resourceAfter?.current ?? 0}/${calculateProficiencyBonus(actor.level)}.`
      : reason === 'chill_exhausted'
        ? `Attack hit: ${attack.total}; base ${baseDamage} bludgeoning; Frost's Chill exhausted atomically; target speed unchanged; Action paid.`
        : `Attack hit: ${attack.total}; base ${baseDamage} bludgeoning; Frost's Chill declined; target speed unchanged; Action paid; uses ${resource?.current ?? 0}/${calculateProficiencyBonus(actor.level)}.`,
    lastResolution: resolution,
  };
}

/** Remove only Frost's Chill's owned slow and reset the actor's next turn. */
export function advanceFrostGiantGoliathTurn(
  scenario: FrostGiantGoliathFrostsChillScenarioState,
): FrostGiantGoliathFrostsChillScenarioState {
  const actor = scenario.actor;
  const target = scenario.target;
  if (!actor || !target) {
    return {
      ...scenario,
      outcome: 'Next-turn expiry rejected: the production-assembled actor or target is missing.',
      lastResolution: createResolution('rejected', 'assembly_unavailable', {
        attackRoll: 0,
        attackTotal: 0,
        baseDamage: 0,
        coldDamage: 0,
        targetHpBefore: target?.currentHP ?? 0,
        targetHpAfter: target?.currentHP ?? 0,
        targetSpeedBefore: target?.actionEconomy.movement.total ?? 0,
        targetSpeedAfter: target?.actionEconomy.movement.total ?? 0,
        frostChillUsed: false,
        slowApplied: false,
      }),
    };
  }

  const slow = getFrostGiantGoliathSlow(target);
  const nextActor = resetEconomy(actor);
  if (!slow) {
    return {
      ...scenario,
      actor: nextActor,
      outcome: "Next turn prepared through the native Action reset; no Frost's Chill slow was active.",
      lastResolution: createResolution('rejected', 'no_active_slow', {
        attackRoll: 0,
        attackTotal: 0,
        baseDamage: 0,
        coldDamage: 0,
        targetHpBefore: target.currentHP,
        targetHpAfter: target.currentHP,
        targetSpeedBefore: target.actionEconomy.movement.total,
        targetSpeedAfter: target.actionEconomy.movement.total,
        frostChillUsed: false,
        slowApplied: false,
      }),
    };
  }

  // Native owned removal refreshes the target's effective movement pool back to
  // its base speed while preserving any other status or movement effects.
  const removed = removeRuntimeStatusCondition(target, slow);
  const nextTarget = removed.character;
  return {
    ...scenario,
    actor: nextActor,
    target: nextTarget,
    outcome: `Frost's Chill expired at the start of the actor's next turn: target speed restored to ${nextTarget.actionEconomy.movement.total} ft; Action ready; uses unchanged.`,
    lastResolution: createResolution('resolved', 'slow_expired', {
      attackRoll: 0,
      attackTotal: 0,
      baseDamage: 0,
      coldDamage: 0,
      targetHpBefore: target.currentHP,
      targetHpAfter: target.currentHP,
      targetSpeedBefore: target.actionEconomy.movement.total,
      targetSpeedAfter: nextTarget.actionEconomy.movement.total,
      frostChillUsed: false,
      slowApplied: false,
    }),
  };
}

/** Build the exact baseline restored whenever the parent shell increments resetCount. */
export function createFrostGiantGoliathFrostsChillScenario(
  race: Race,
): FrostGiantGoliathFrostsChillScenarioState {
  const actor = createFrostGiantGoliathActor(race);
  const target = createFrostGiantGoliathTarget();
  const resource = actor ? getFrostGiantGoliathResource(actor) : undefined;
  const usable = !!actor && !!target && hasCanonicalFrostGiantGoliathFrostsChill(race);
  return {
    actor,
    target,
    outcome: usable
      ? `Ready: ${actor.name}; Speed ${actor.stats.speed} ft; Move ${actor.actionEconomy.movement.used}/${actor.actionEconomy.movement.total}; Action ready; Frost's Chill uses ${resource?.current ?? 0}/${calculateProficiencyBonus(actor.level)}; reset ${resource?.resetOn ?? 'unknown'}.`
      : "Frost's Chill unavailable: canonical trait, racial resource, or production character assembly was incomplete.",
    lastResolution: null,
  };
}

// ============================================================================
// Frost Giant Goliath Leaf UI
// ============================================================================
// The controls expose actor/target HP, base/effective speed, Action, PB
// resource, native status, result log, canonical facts, and honest boundaries.
// Parent Reset remounts this content so no local combat state survives it.
// ============================================================================

const FrostGiantGoliathRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  state,
  onScenarioEvent,
}) => {
  const [scenario, setScenario] = useState<FrostGiantGoliathFrostsChillScenarioState>(
    () => createFrostGiantGoliathFrostsChillScenario(race),
  );
  const actor = scenario.actor;
  const target = scenario.target;
  const resource = actor ? getFrostGiantGoliathResource(actor) : undefined;
  const slow = getFrostGiantGoliathSlow(target);
  const attackBonus = actor ? getFrostGiantGoliathAttackBonus(actor) : 0;
  const frostChillTrait = getCanonicalFrostGiantGoliathFrostsChillTrait(race);
  const speedTrait = getCanonicalFrostGiantGoliathSpeedTrait(race);
  const largeFormTrait = getCanonicalFrostGiantGoliathLargeFormTrait(race);
  const powerfulBuildTrait = getCanonicalFrostGiantGoliathPowerfulBuildTrait(race);

  const handleAttack = (mode: FrostGiantGoliathFrostsChillAttackMode, useFrostsChill: boolean) => {
    // Publish the same native result shown in the leaf so the parent log cannot
    // claim the rider succeeded when the transaction rejected or missed.
    const nextScenario = resolveFrostGiantGoliathFrostsChill(scenario, mode, useFrostsChill);
    setScenario(nextScenario);
    onScenarioEvent(`Frost Giant Goliath FROST'S CHILL: ${nextScenario.outcome}`);
  };

  const handleNextTurn = () => {
    // This deterministic control exercises native owned removal and Action
    // reset while honestly standing in for the not-mounted actor turn event.
    const nextScenario = advanceFrostGiantGoliathTurn(scenario);
    setScenario(nextScenario);
    onScenarioEvent(`Frost Giant Goliath TURN: ${nextScenario.outcome}`);
  };

  return (
    <section aria-labelledby="frost-giant-goliath-frosts-chill-title" data-testid="frost-giant-goliath-race-leaf">
      {/* The heading identifies the canonical Frost's Chill transaction. */}
      <h4 id="frost-giant-goliath-frosts-chill-title">Frost Giant Goliath · Frost&apos;s Chill</h4>
      <p data-testid="frost-giant-goliath-canonical-trait">Canonical: {frostChillTrait ?? "Frost's Chill trait missing"}</p>
      <p data-testid="frost-giant-goliath-canonical-speed">Canonical: {speedTrait ?? 'Speed trait missing'}</p>

      {/* Each attack button fixes only the d20 branch; native attack and damage helpers decide the result. */}
      <Button type="button" onClick={() => handleAttack('hit', true)}>
        Resolve hit with Frost&apos;s Chill
      </Button>
      <Button type="button" onClick={() => handleAttack('hit', false)}>
        Resolve hit without Frost&apos;s Chill
      </Button>
      <Button type="button" onClick={() => handleAttack('miss', true)}>
        Resolve miss with Frost&apos;s Chill requested
      </Button>
      <Button type="button" onClick={handleNextTurn}>
        Advance actor next turn
      </Button>

      {/* These facts expose live native HP, speed, movement pool, Action, and resource state. */}
      <p data-testid="frost-giant-goliath-actor">
        Actor: {actor?.name ?? 'missing'}; HP {actor?.currentHP ?? 'unknown'}/{actor?.maxHP ?? 'unknown'}; Speed {actor?.stats.speed ?? 'unknown'} ft; Move {actor?.actionEconomy.movement.used ?? 'unknown'}/{actor?.actionEconomy.movement.total ?? 'unknown'}; Attack +{attackBonus}; Action {actor?.actionEconomy.action.used ? 'used' : 'ready'}; Uses {resource?.current ?? 0}/{actor ? calculateProficiencyBonus(actor.level) : 0}; Reset {resource?.resetOn ?? 'unknown'}.
      </p>
      <p data-testid="frost-giant-goliath-target">
        Target: {target?.name ?? 'missing'}; HP {target?.currentHP ?? 'unknown'}/{target?.maxHP ?? 'unknown'}; Base Speed {target?.stats.speed ?? 'unknown'} ft; Effective Speed {target?.actionEconomy.movement.total ?? 'unknown'} ft; Frost&apos;s Chill {slow ? 'active' : 'inactive'}; AC {target?.armorClass ?? 'unknown'}.
      </p>
      <p aria-live="polite" role="status" data-testid="frost-giant-goliath-outcome">{scenario.outcome}</p>

      {/* Large Form and Powerful Build remain canonical facts, not fake runtime systems. */}
      <p data-testid="frost-giant-goliath-giant-facts">
        Large Form: {largeFormTrait ?? 'missing'} Powerful Build: {powerfulBuildTrait ?? 'missing'}
      </p>

      {/* The resource bridge gap is explicit so this leaf cannot be mistaken for a shared migration. */}
      <p data-testid="frost-giant-goliath-assembly-boundary">
        Assembly boundary: production quick-character assembly plus canonical racial parsing supply the PB/Long Rest resource; this leaf carries limitedUses across the combat bridge because that bridge does not currently project racial resources.
      </p>
      <p data-testid="frost-giant-goliath-unsupported-boundary">
        Unsupported boundary: this leaf does not implement Large Form size transformation, Powerful Build grapple/carry rules, long-rest orchestration, or mounted 2D/3D proof. The explicit next-turn control uses native owned status removal and Action reset; the mounted actor turn-event bus is not claimed here.
      </p>
      <span hidden>{state.resetCount}</span>
    </section>
  );
};

// Parent Reset increments resetCount. This keyed boundary restores actor,
// target HP/speed, Action, resource charges, status, and the baseline outcome.
export const FrostGiantGoliathRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <FrostGiantGoliathRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />
);

// Automatic discovery requires this exact named registration export.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'frost-giant-goliath-frosts-chill',
  raceId: 'frost_giant_goliath',
  label: "Frost Giant Goliath · Frost's Chill",
  description: "Resolve canonical Frost's Chill through native attack, cold damage, HP, Action, resource, and speed-status helpers.",
  Component: FrostGiantGoliathRaceLeaf,
};

export default RACE_DOMAIN_LEAF;

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file is an isolated Race-domain leaf with no sibling-leaf imports.
 *
 * MULTI-AGENT SAFETY:
 * The registry discovers this module automatically. Keep Fire Giant Goliath
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
  createQuickCharacter,
  createQuickCombatCharacter,
} from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { Race } from '../../../../../types';
import type { CombatCharacter } from '../../../../../types/combat';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file gives Fire Giant Goliath a deterministic Fire's Burn attack
 * transaction inside the Tactical Sandbox Race domain.
 *
 * The leaf builds a real combat actor from the canonical race, carries the
 * parsed racial limited-use entry across the current persistent-to-combat
 * bridge, and resolves an attack through native d20, attack, dice, damage,
 * HP, action-economy, and resource helpers. It displays Large Form and
 * Powerful Build as canonical facts only; neither unsupported size/grapple nor
 * speed behavior is invented here.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Fire Giant Goliath data, racial trait parsing,
 * quick-character assembly, combat helpers, and the shared leaf contract.
 */

// ============================================================================
// Canonical Fire Giant Goliath Facts
// ============================================================================
// These identifiers and readers keep the preview tied to authored Race data
// and the production racial-resource library instead of duplicating rule text.
// ============================================================================

export const FIRE_GIANT_GOLIATH_FIRE_BURN_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'fire_giant_goliath__fire_s_burn__resource',
);
export const FIRE_GIANT_GOLIATH_ACTOR_ID = 'fire-giant-goliath-fire-burn-actor';
export const FIRE_GIANT_GOLIATH_TARGET_ID = 'fire-giant-goliath-fire-burn-target';
export const FIRE_GIANT_GOLIATH_TARGET_AC = 16;
export const FIRE_GIANT_GOLIATH_TARGET_HP = 40;
export const FIRE_GIANT_GOLIATH_BASE_ATTACK_DICE = '1d8+3';
export const FIRE_GIANT_GOLIATH_FIRE_BURN_DICE = '1d10';
export const FIRE_GIANT_GOLIATH_HIT_ROLL = 12;
export const FIRE_GIANT_GOLIATH_MISS_ROLL = 5;

const FIRE_GIANT_GOLIATH_FIRE_BURN_TRAIT = /^Fire's Burn:\s*/i;
const FIRE_GIANT_GOLIATH_LARGE_FORM_TRAIT = /^Large Form:\s*/i;
const FIRE_GIANT_GOLIATH_POWERFUL_BUILD_TRAIT = /^Powerful Build:\s*/i;

/** Return the exact canonical Fire's Burn trait supplied to this leaf. */
export function getCanonicalFireGiantGoliathFireBurnTrait(race: Race): string | null {
  return race.traits.find(trait => FIRE_GIANT_GOLIATH_FIRE_BURN_TRAIT.test(trait.trim())) ?? null;
}

/** Return the canonical Large Form fact shown beside the supported attack. */
export function getCanonicalFireGiantGoliathLargeFormTrait(race: Race): string | null {
  return race.traits.find(trait => FIRE_GIANT_GOLIATH_LARGE_FORM_TRAIT.test(trait.trim())) ?? null;
}

/** Return the canonical Powerful Build fact shown beside the supported attack. */
export function getCanonicalFireGiantGoliathPowerfulBuildTrait(race: Race): string | null {
  return race.traits.find(trait => FIRE_GIANT_GOLIATH_POWERFUL_BUILD_TRAIT.test(trait.trim())) ?? null;
}

/**
 * Read Fire's Burn's parsed resource from the shared racial trait library.
 * This proves the PB and long-rest contract without rebuilding its parser.
 */
export function getCanonicalFireGiantGoliathFireBurnResource(race: Race) {
  const trait = getRacialTraitLibrary().byRaceId[race.id]?.find(candidate => (
    candidate.type !== 'spell' && candidate.traitName === "Fire's Burn"
  ));
  if (!trait || trait.type === 'spell') return undefined;
  return trait.resources?.find(resource => (
    resolveRacialResourceId('feature', resource.id) === FIRE_GIANT_GOLIATH_FIRE_BURN_RESOURCE_ID
  ));
}

/** Confirm that the supplied Race still authorizes this bounded transaction. */
export function hasCanonicalFireGiantGoliathFireBurn(race: Race): boolean {
  const fireBurn = getCanonicalFireGiantGoliathFireBurnTrait(race);
  const resource = getCanonicalFireGiantGoliathFireBurnResource(race);
  const largeForm = getCanonicalFireGiantGoliathLargeFormTrait(race);
  const powerfulBuild = getCanonicalFireGiantGoliathPowerfulBuildTrait(race);

  return race.id === 'fire_giant_goliath'
    && race.name === 'Fire Giant Goliath'
    && !!fireBurn
    && /hit a target with an attack roll/i.test(fireBurn)
    && /extra 1d10 fire damage/i.test(fireBurn)
    && /proficiency bonus/i.test(fireBurn)
    && /long rest/i.test(fireBurn)
    && resource?.maxUses === 'proficiency_bonus'
    && resource.resetOn === 'long_rest'
    && !!largeForm
    && !!powerfulBuild;
}

// ============================================================================
// Deterministic Production Assembly
// ============================================================================
// The preview has no live combat snapshot to borrow. It therefore creates a
// player actor and target through the existing quick-character seams, then
// carries only the canonical racial resource across the known bridge gap.
// ============================================================================

const FIXED_DAMAGE_RNG = (): number => 0.5;

function fixedD20Rng(roll: number): () => number {
  // This midpoint value makes the native rollD20 helper return exactly the
  // authored face while retaining the helper's ordinary random contract.
  return () => (roll - 0.5) / 20;
}

function getFireGiantGoliathResource(actor: CombatCharacter) {
  return actor.limitedUses?.[FIRE_GIANT_GOLIATH_FIRE_BURN_RESOURCE_ID];
}

function getFireGiantGoliathAttackBonus(actor: CombatCharacter): number {
  return getAbilityModifierValue(actor.stats.strength) + calculateProficiencyBonus(actor.level);
}

function createFireGiantGoliathActor(race: Race): CombatCharacter | null {
  // The canonical race controls the resource entry; the quick character only
  // supplies a deterministic level-5 combat body for this focused proof.
  const quickCharacter = createQuickCharacter({
    name: "Fire Giant Goliath · Fire's Burn Tester",
    raceId: race.id,
    classId: 'fighter',
    level: 5,
    stats: [16, 12, 14, 10, 10, 10],
  });
  if (!quickCharacter || !hasCanonicalFireGiantGoliathFireBurn(race)) return null;

  // Apply the production racial parser before the persistent-to-combat bridge
  // so Fire's Burn starts with the real Proficiency Bonus number of charges.
  const assembledCharacter = applyRacialSpellGrantsByLevel(quickCharacter, quickCharacter.level ?? 1);
  const generatedActor = createPlayerCombatCharacter(assembledCharacter);
  const resource = assembledCharacter.limitedUses?.[FIRE_GIANT_GOLIATH_FIRE_BURN_RESOURCE_ID];
  if (!resource) return null;

  // DEBT: createPlayerCombatCharacter currently does not project racial
  // limitedUses into CombatCharacter. This adapter carries only the canonical
  // parsed resource forward; the shared bridge should own this projection once
  // it is widened, and no other Fire Giant mechanic is materialized here.
  return resetEconomy({
    ...generatedActor,
    id: FIRE_GIANT_GOLIATH_ACTOR_ID,
    name: `${race.name} · Fire's Burn Tester`,
    position: { x: 2, y: 4 },
    limitedUses: {
      [FIRE_GIANT_GOLIATH_FIRE_BURN_RESOURCE_ID]: { ...resource },
    },
  });
}

function createFireGiantGoliathTarget(): CombatCharacter | null {
  // The target is a native combat character with an authored AC and HP packet
  // so attack legality and native damage/HP bookkeeping remain inspectable.
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
    id: FIRE_GIANT_GOLIATH_TARGET_ID,
    name: 'Iron Target · AC 16 · 40 HP',
    team: 'enemy',
    position: { x: 4, y: 4 },
    armorClass: FIRE_GIANT_GOLIATH_TARGET_AC,
    baseAC: FIRE_GIANT_GOLIATH_TARGET_AC,
    currentHP: FIRE_GIANT_GOLIATH_TARGET_HP,
    maxHP: FIRE_GIANT_GOLIATH_TARGET_HP,
    resistances: [],
    immunities: [],
    vulnerabilities: [],
  };
}

export interface FireGiantGoliathFireBurnScenarioState {
  actor: CombatCharacter | null;
  target: CombatCharacter | null;
  outcome: string;
  lastResolution: FireGiantGoliathFireBurnResolution | null;
}

export type FireGiantGoliathFireBurnAttackMode = 'hit' | 'miss';

export type FireGiantGoliathFireBurnReason =
  | 'hit'
  | 'miss'
  | 'burn_declined'
  | 'burn_exhausted'
  | 'action_unavailable'
  | 'assembly_unavailable';

export interface FireGiantGoliathFireBurnResolution {
  status: 'resolved' | 'rejected';
  reason: FireGiantGoliathFireBurnReason;
  attackRoll: number;
  attackTotal: number;
  baseDamage: number;
  fireDamage: number;
  targetHpBefore: number;
  targetHpAfter: number;
  fireBurnUsed: boolean;
}

function createResolution(
  status: FireGiantGoliathFireBurnResolution['status'],
  reason: FireGiantGoliathFireBurnReason,
  values: Omit<FireGiantGoliathFireBurnResolution, 'status' | 'reason'>,
): FireGiantGoliathFireBurnResolution {
  // Keeping one complete result packet makes the visible log and focused tests
  // agree on the exact attack face, damage, HP, and resource decision.
  return { status, reason, ...values };
}

/**
 * Resolve one deterministic attack and optional Fire's Burn rider.
 *
 * The action is paid for every legal attack attempt, including a miss. Fire's
 * Burn is paid only after a hit and an explicit opt-in, so a miss, decline, or
 * exhausted resource cannot consume a racial charge or apply fire damage.
 */
export function resolveFireGiantGoliathFireBurn(
  scenario: FireGiantGoliathFireBurnScenarioState,
  mode: FireGiantGoliathFireBurnAttackMode,
  useFireBurn: boolean,
): FireGiantGoliathFireBurnScenarioState {
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
        fireDamage: 0,
        targetHpBefore: target?.currentHP ?? 0,
        targetHpAfter: target?.currentHP ?? 0,
        fireBurnUsed: false,
      }),
    };
  }

  const actionCost = { type: 'action' as const };
  if (!canAffordActionCost(actor, actionCost)) {
    return {
      ...scenario,
      outcome: 'Attack rejected atomically: Action already used; HP and Fire\'s Burn uses unchanged.',
      lastResolution: createResolution('rejected', 'action_unavailable', {
        attackRoll: 0,
        attackTotal: 0,
        baseDamage: 0,
        fireDamage: 0,
        targetHpBefore: target.currentHP,
        targetHpAfter: target.currentHP,
        fireBurnUsed: false,
      }),
    };
  }

  // Native d20 and attack helpers own natural-1, natural-20, and AC legality.
  const attackRoll = rollD20({
    rng: fixedD20Rng(mode === 'hit' ? FIRE_GIANT_GOLIATH_HIT_ROLL : FIRE_GIANT_GOLIATH_MISS_ROLL),
  });
  const attack = resolveAttack(
    attackRoll,
    getFireGiantGoliathAttackBonus(actor),
    target.armorClass,
  );
  const paidActor = consumeActionCost(actor, actionCost);
  const targetHpBefore = target.currentHP;

  if (!attack.isHit) {
    // A miss spends the ordinary Action, but the hit-gated racial rider remains
    // untouched. The target object is reused to make that atomic boundary clear.
    const resolution = createResolution('resolved', 'miss', {
      attackRoll,
      attackTotal: attack.total,
      baseDamage: 0,
      fireDamage: 0,
      targetHpBefore,
      targetHpAfter: targetHpBefore,
      fireBurnUsed: false,
    });
    return {
      ...scenario,
      actor: paidActor,
      outcome: `Attack missed: ${attackRoll}+${getFireGiantGoliathAttackBonus(actor)} = ${attack.total}; Action paid; Fire's Burn not used.`,
      lastResolution: resolution,
    };
  }

  // Native dice and damage helpers calculate the physical strike before HP is
  // changed. The fixed RNG makes this proof repeatable without replacing them.
  const baseRolledDamage = rollDamage(
    FIRE_GIANT_GOLIATH_BASE_ATTACK_DICE,
    attack.isCritical,
    1,
    FIXED_DAMAGE_RNG,
  );
  const baseDamage = calculateDamage(baseRolledDamage, actor, target, 'bludgeoning');
  let nextTarget = applyDamageAndCheckDowned(target, baseDamage, attack.isCritical);
  let nextActor = paidActor;
  let fireDamage = 0;
  let reason: FireGiantGoliathFireBurnReason = useFireBurn ? 'hit' : 'burn_declined';
  let fireBurnUsed = false;
  const resource = getFireGiantGoliathResource(actor);

  if (useFireBurn && (!resource || resource.current <= 0)) {
    // Exhaustion is a successful base attack with an atomic no-op for the
    // optional rider; it never drives the resource below zero.
    reason = 'burn_exhausted';
  } else if (useFireBurn && resource) {
    const rolledFireDamage = rollDamage(FIRE_GIANT_GOLIATH_FIRE_BURN_DICE, false, 1, FIXED_DAMAGE_RNG);
    fireDamage = calculateDamage(rolledFireDamage, actor, nextTarget, 'fire');
    nextTarget = applyDamageAndCheckDowned(nextTarget, fireDamage);
    nextActor = {
      ...paidActor,
      limitedUses: {
        ...paidActor.limitedUses,
        [FIRE_GIANT_GOLIATH_FIRE_BURN_RESOURCE_ID]: {
          ...resource,
          current: Math.max(0, resource.current - 1),
        },
      },
    };
    fireBurnUsed = true;
  }

  const resolution = createResolution('resolved', reason, {
    attackRoll,
    attackTotal: attack.total,
    baseDamage,
    fireDamage,
    targetHpBefore,
    targetHpAfter: nextTarget.currentHP,
    fireBurnUsed,
  });
  const resourceAfter = getFireGiantGoliathResource(nextActor);
  return {
    ...scenario,
    actor: nextActor,
    target: nextTarget,
    outcome: fireBurnUsed
      ? `Attack hit: ${attack.total}; base ${baseDamage} bludgeoning + ${fireDamage} Fire's Burn fire; Action paid; uses ${resourceAfter?.current ?? 0}/${calculateProficiencyBonus(actor.level)}.`
      : reason === 'burn_exhausted'
        ? `Attack hit: ${attack.total}; base ${baseDamage} bludgeoning; Fire's Burn exhausted atomically; Action paid.`
        : `Attack hit: ${attack.total}; base ${baseDamage} bludgeoning; Fire's Burn declined; Action paid; uses ${resource?.current ?? 0}/${calculateProficiencyBonus(actor.level)}.`,
    lastResolution: resolution,
  };
}

/** Restore only the per-turn Action so the same persistent resource can be audited across turns. */
export function prepareNextFireGiantGoliathTurn(
  scenario: FireGiantGoliathFireBurnScenarioState,
): FireGiantGoliathFireBurnScenarioState {
  if (!scenario.actor) return scenario;
  return {
    ...scenario,
    actor: resetEconomy(scenario.actor),
    outcome: 'Next turn prepared through the native action-economy reset; Fire\'s Burn uses unchanged.',
  };
}

/** Build the exact baseline restored whenever the parent shell increments resetCount. */
export function createFireGiantGoliathFireBurnScenario(
  race: Race,
): FireGiantGoliathFireBurnScenarioState {
  const actor = createFireGiantGoliathActor(race);
  const target = createFireGiantGoliathTarget();
  const resource = actor ? getFireGiantGoliathResource(actor) : undefined;
  const usable = !!actor && !!target && hasCanonicalFireGiantGoliathFireBurn(race);
  return {
    actor,
    target,
    outcome: usable
      ? `Ready: ${actor.name}; Action ready; Fire's Burn uses ${resource?.current ?? 0}/${calculateProficiencyBonus(actor.level)}; reset ${resource?.resetOn ?? 'unknown'}.`
      : 'Fire\'s Burn unavailable: canonical trait, racial resource, or production character assembly was incomplete.',
    lastResolution: null,
  };
}

// ============================================================================
// Fire Giant Goliath Leaf UI
// ============================================================================
// The controls expose the actor, target HP, Action, PB resource, result log,
// canonical facts, next-turn action reset, and honest unsupported boundaries.
// Parent Reset remounts this content so no local combat state survives it.
// ============================================================================

const FireGiantGoliathRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  onScenarioEvent,
}) => {
  const [scenario, setScenario] = useState<FireGiantGoliathFireBurnScenarioState>(
    () => createFireGiantGoliathFireBurnScenario(race),
  );
  const actor = scenario.actor;
  const target = scenario.target;
  const resource = actor ? getFireGiantGoliathResource(actor) : undefined;
  const attackBonus = actor ? getFireGiantGoliathAttackBonus(actor) : 0;
  const fireBurnTrait = getCanonicalFireGiantGoliathFireBurnTrait(race);
  const largeFormTrait = getCanonicalFireGiantGoliathLargeFormTrait(race);
  const powerfulBuildTrait = getCanonicalFireGiantGoliathPowerfulBuildTrait(race);

  const handleAttack = (mode: FireGiantGoliathFireBurnAttackMode, useFireBurn: boolean) => {
    // Publish the exact native result shown in the leaf so the parent log
    // cannot claim a rider succeeded when the transaction rejected it.
    const nextScenario = resolveFireGiantGoliathFireBurn(scenario, mode, useFireBurn);
    setScenario(nextScenario);
    onScenarioEvent(`Fire Giant Goliath FIRE'S BURN: ${nextScenario.outcome}`);
  };

  const handleNextTurn = () => {
    // Turn preparation changes only native action counters; it never refreshes
    // the long-rest racial resource and therefore remains an auditable control.
    const nextScenario = prepareNextFireGiantGoliathTurn(scenario);
    setScenario(nextScenario);
    onScenarioEvent(`Fire Giant Goliath TURN: ${nextScenario.outcome}`);
  };

  return (
    <section aria-labelledby="fire-giant-goliath-fire-burn-title" data-testid="fire-giant-goliath-race-leaf">
      {/* The heading identifies the canonical Fire's Burn transaction. */}
      <h4 id="fire-giant-goliath-fire-burn-title">Fire Giant Goliath · Fire&apos;s Burn</h4>
      <p data-testid="fire-giant-goliath-canonical-trait">
        Canonical: {fireBurnTrait ?? "Fire's Burn trait missing"}
      </p>

      {/* Each attack button fixes only the d20 branch; native attack and damage helpers decide the result. */}
      <Button type="button" onClick={() => handleAttack('hit', true)}>
        Resolve hit with Fire&apos;s Burn
      </Button>
      <Button type="button" onClick={() => handleAttack('hit', false)}>
        Resolve hit without Fire&apos;s Burn
      </Button>
      <Button type="button" onClick={() => handleAttack('miss', true)}>
        Resolve miss with Fire&apos;s Burn requested
      </Button>
      <Button type="button" onClick={handleNextTurn}>
        Prepare next turn
      </Button>

      {/* These lines expose live native HP, Action, attack bonus, and resource state. */}
      <p data-testid="fire-giant-goliath-actor">
        Actor: {actor?.name ?? 'missing'}; HP {actor?.currentHP ?? 'unknown'}/{actor?.maxHP ?? 'unknown'}; Attack +{attackBonus}; Action {actor?.actionEconomy.action.used ? 'used' : 'ready'}; Uses {resource?.current ?? 0}/{actor ? calculateProficiencyBonus(actor.level) : 0}; Reset {resource?.resetOn ?? 'unknown'}.
      </p>
      <p data-testid="fire-giant-goliath-target">
        Target: {target?.name ?? 'missing'}; HP {target?.currentHP ?? 'unknown'}/{target?.maxHP ?? 'unknown'}; AC {target?.armorClass ?? 'unknown'}.
      </p>
      <p aria-live="polite" role="status" data-testid="fire-giant-goliath-outcome">
        {scenario.outcome}
      </p>

      {/* Large Form and Powerful Build remain canonical facts, not fake runtime systems. */}
      <p data-testid="fire-giant-goliath-giant-facts">
        Large Form: {largeFormTrait ?? 'missing'} Powerful Build: {powerfulBuildTrait ?? 'missing'}
      </p>

      {/* The bridge gap is explicit so this leaf cannot be mistaken for a shared resource migration. */}
      <p data-testid="fire-giant-goliath-assembly-boundary">
        Assembly boundary: production quick character assembly plus canonical racial resource parsing; this leaf carries limitedUses across the combat bridge because that bridge does not currently project racial resources.
      </p>
      <p data-testid="fire-giant-goliath-unsupported-boundary">
        Unsupported boundary: this leaf does not implement Large Form size, Powerful Build grapple/carry rules, speed changes, long-rest orchestration, or mounted 2D/3D proof; parent Reset restores the canonical Proficiency Bonus charges.
      </p>
    </section>
  );
};

// Parent Reset increments resetCount. The keyed content boundary restores the
// actor, target HP, Action, resource charges, and unresolved result packet.
export const FireGiantGoliathRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <FireGiantGoliathRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />
);

// Automatic discovery requires this exact named registration export.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'fire-giant-goliath-fire-burn',
  raceId: 'fire_giant_goliath',
  label: "Fire Giant Goliath · Fire's Burn",
  description: "Resolve canonical Fire's Burn through native attack, dice, damage, HP, action, and resource helpers.",
  Component: FireGiantGoliathRaceLeaf,
};

export default RACE_DOMAIN_LEAF;

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This leaf is intentionally isolated from the shared race shell.
 *
 * MULTI-AGENT SAFETY:
 * Race 33 owns this file and its focused test only. Keep the automatic registry
 * contract intact so other race leaves do not need to edit a shared list.
 */
// @dependencies-end

import React, { useState } from 'react';
import { buildRacialTraitLibrary } from '../../../../../data/races/racialTraits';
import { applyRacialSpellGrantsByLevel, resolveRacialResourceId } from '../../../../../utils/character/characterUtils';
import { rollAbilityCheck, type CheckResult } from '../../../../../utils/character/checkUtils';
import { calculateProficiencyBonus, rollSavingThrow, type SavingThrowResult } from '../../../../../utils/character/savingThrowUtils';
import { getAbilityModifierValue } from '../../../../../utils/character/statUtils';
import { canAffordActionCost, consumeActionCost, resetEconomy } from '../../../../../utils/combat/actionEconomyUtils';
import { resolveAttack, rollDice, type AttackResult } from '../../../../../utils/combat/combatUtils';
import { createQuickCharacter, createQuickCombatCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { PlayerCharacter, Race } from '../../../../../types';
import type { CombatCharacter } from '../../../../../types/combat';
import type { RaceDomainLeafProps, RaceDomainLeafRegistration } from '../raceDomainTypes';

/**
 * This file demonstrates the Giff's Astral Spark after-roll choice in the
 * Tactical Sandbox Race domain.
 *
 * It assembles production player and combat actors, lets the shared d20,
 * ability-check, saving-throw, attack, dice, resource, and action helpers do
 * the rules work, then adds the parsed Proficiency Bonus only when the user
 * explicitly accepts the post-roll choice. The remaining Giff traits stay
 * visible as canonical facts because this leaf does not own firearm items,
 * carrying capacity, push/drag/lift, or swimming movement resolution.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Giff data, racial parser/resource projection,
 * production quick-character assembly, native roll helpers, and the shared
 * Race domain contract.
 */

// ============================================================================
// Canonical Giff Facts And Resource Identity
// ============================================================================
// These readers keep the board tied to the active race record. The leaf never
// copies a second Astral Spark rule into its state, so canonical drift makes the
// transaction unavailable instead of silently proving stale text.
// ============================================================================

export const GIFF_ASTRAL_SPARK_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'giff__astral_spark__resource',
);
export const GIFF_ASTRAL_SPARK_CONTROL_ID = 'giff-astral-spark-roll';
export const GIFF_ACTOR_ID = 'giff-astral-spark-actor';
export const GIFF_COMBAT_ACTOR_ID = 'giff-astral-spark-combat-actor';
export const GIFF_ATTACK_TARGET_AC = 15;
export const GIFF_SAVE_DC = 15;
export const GIFF_SCENARIO_LEVEL = 5;

const GIFF_ASTRAL_SPARK_TRAIT = /^Astral Spark:\s*/i;
const GIFF_FIREARMS_MASTERY_TRAIT = /^Firearms Mastery:\s*/i;
const GIFF_HIPPO_BUILD_TRAIT = /^Hippo Build:\s*/i;
const GIFF_SPEED_TRAIT = /^Speed:\s*/i;

export type GiffAstralSparkTransaction = 'ability-check' | 'saving-throw' | 'attack';

/** Return the exact canonical text for one named Giff trait. */
export function getCanonicalGiffTrait(race: Race, traitName: string): string | null {
  return race.traits.find(trait => trait.trim().startsWith(`${traitName}:`)) ?? null;
}

/** Return canonical Astral Spark text for both the UI and focused proof. */
export function getCanonicalGiffAstralSparkTrait(race: Race): string | null {
  return race.traits.find(trait => GIFF_ASTRAL_SPARK_TRAIT.test(trait.trim())) ?? null;
}

/** Confirm that every fact surfaced by this leaf still exists canonically. */
export function hasCanonicalGiffFeatures(race: Race): boolean {
  const astralSpark = getCanonicalGiffAstralSparkTrait(race);
  const firearmsMastery = race.traits.find(trait => GIFF_FIREARMS_MASTERY_TRAIT.test(trait.trim()));
  const hippoBuild = race.traits.find(trait => GIFF_HIPPO_BUILD_TRAIT.test(trait.trim()));
  const speed = race.traits.find(trait => GIFF_SPEED_TRAIT.test(trait.trim()));

  return race.id === 'giff'
    && race.name === 'Giff'
    && !!astralSpark
    && /attack roll/i.test(astralSpark)
    && /saving throw/i.test(astralSpark)
    && /ability check/i.test(astralSpark)
    && /after you see the d20 roll/i.test(astralSpark)
    && /Proficiency Bonus/i.test(astralSpark)
    && /long rest/i.test(astralSpark)
    && !!firearmsMastery
    && /all firearms/i.test(firearmsMastery)
    && !!hippoBuild
    && /advantage on Strength checks and saving throws/i.test(hippoBuild)
    && /carrying capacity/i.test(hippoBuild)
    && !!speed
    && /30 feet/i.test(speed)
    && /swim 30 feet/i.test(speed);
}

/** Read the parser-owned Astral Spark resource from the player actor. */
export function getGiffAstralSparkResource(actor: PlayerCharacter | null) {
  return actor?.limitedUses?.[GIFF_ASTRAL_SPARK_RESOURCE_ID];
}

// ============================================================================
// Production Actor Assembly And Roll State
// ============================================================================
// The player actor owns the parsed racial resource. The combat actor owns the
// native save/attack shape and action economy. A narrow bridge carries the
// parser-derived resource into that combat snapshot so Apply and Reset remain
// visibly synchronized without pretending the shared combat model parses races.
// ============================================================================

const GIFF_ACTOR_CONFIG = {
  name: 'Giff · Astral Spark Tester',
  raceId: 'giff',
  classId: 'fighter',
  level: GIFF_SCENARIO_LEVEL,
  stats: [16, 10, 14, 10, 10, 10] as [number, number, number, number, number, number],
};

export interface GiffPendingRoll {
  transaction: GiffAstralSparkTransaction;
  d20: number;
  baseModifier: number;
  baseTotal: number;
  baseOutcome: string;
}

export type GiffAstralSparkResolutionReason =
  | 'applied'
  | 'declined'
  | 'resource_exhausted'
  | 'canonical_trait_missing'
  | 'assembly_unavailable'
  | 'pending_roll'
  | 'action_unavailable';

export interface GiffAstralSparkResolution {
  status: 'resolved' | 'rejected';
  reason: GiffAstralSparkResolutionReason;
  transaction: GiffAstralSparkTransaction | null;
  d20: number | null;
  baseTotal: number | null;
  finalTotal: number | null;
  proficiencyBonusAdded: number;
  usesRemaining: number | null;
}

export interface GiffAstralSparkScenarioState {
  actor: PlayerCharacter | null;
  combatActor: CombatCharacter | null;
  pendingRoll: GiffPendingRoll | null;
  outcome: string;
  lastResolution: GiffAstralSparkResolution | null;
}

function createRejectedResolution(
  reason: GiffAstralSparkResolutionReason,
  scenario: GiffAstralSparkScenarioState,
): GiffAstralSparkResolution {
  return {
    status: 'rejected',
    reason,
    transaction: scenario.pendingRoll?.transaction ?? null,
    d20: scenario.pendingRoll?.d20 ?? null,
    baseTotal: scenario.pendingRoll?.baseTotal ?? null,
    finalTotal: null,
    proficiencyBonusAdded: 0,
    usesRemaining: getGiffAstralSparkResource(scenario.actor)?.current ?? null,
  };
}

function withCombatResource(
  combatActor: CombatCharacter,
  resource: NonNullable<ReturnType<typeof getGiffAstralSparkResource>>,
): CombatCharacter {
  // The combat snapshot does not currently parse racial feature resources, so
  // this bridge carries only the already-parsed limited-use entry. It does not
  // create a second source of truth or add any Giff mechanic to combat rules.
  return {
    ...combatActor,
    limitedUses: {
      ...(combatActor.limitedUses ?? {}),
      [GIFF_ASTRAL_SPARK_RESOURCE_ID]: { ...resource },
    },
  };
}

/** Assemble both production actor shapes and require the parsed resource. */
export function createGiffAstralSparkScenario(race: Race): GiffAstralSparkScenarioState {
  if (!hasCanonicalGiffFeatures(race)) {
    return {
      actor: null,
      combatActor: null,
      pendingRoll: null,
      outcome: 'Astral Spark unavailable: canonical Giff traits changed.',
      lastResolution: {
        status: 'rejected',
        reason: 'canonical_trait_missing',
        transaction: null,
        d20: null,
        baseTotal: null,
        finalTotal: null,
        proficiencyBonusAdded: 0,
        usesRemaining: null,
      },
    };
  }

  const quickCharacter = createQuickCharacter(GIFF_ACTOR_CONFIG);
  const quickCombatCharacter = createQuickCombatCharacter(GIFF_ACTOR_CONFIG);
  if (!quickCharacter || !quickCombatCharacter) {
    return {
      actor: null,
      combatActor: null,
      pendingRoll: null,
      outcome: 'Astral Spark unavailable: production actor assembly returned no actor.',
      lastResolution: {
        status: 'rejected',
        reason: 'assembly_unavailable',
        transaction: null,
        d20: null,
        baseTotal: null,
        finalTotal: null,
        proficiencyBonusAdded: 0,
        usesRemaining: null,
      },
    };
  }

  // Replace the generated race with the active record before parsing so this
  // leaf proves the selected canonical race rather than a duplicated fixture.
  const parsedActor = applyRacialSpellGrantsByLevel(
    { ...quickCharacter, race },
    GIFF_SCENARIO_LEVEL,
  );
  const parsedResource = getGiffAstralSparkResource(parsedActor);
  const canonicalTrait = buildRacialTraitLibrary({ [race.id]: race }).byRaceId[race.id]
    ?.find(trait => trait.traitName === 'Astral Spark' && 'resources' in trait);
  const canonicalResource = canonicalTrait && 'resources' in canonicalTrait
    ? canonicalTrait.resources?.find(resource => resource.id === 'giff__astral_spark__resource')
    : undefined;
  if (!parsedResource || !canonicalResource) {
    return {
      actor: null,
      combatActor: null,
      pendingRoll: null,
      outcome: 'Astral Spark unavailable: the production racial parser did not expose its PB/Long Rest resource.',
      lastResolution: {
        status: 'rejected',
        reason: 'assembly_unavailable',
        transaction: null,
        d20: null,
        baseTotal: null,
        finalTotal: null,
        proficiencyBonusAdded: 0,
        usesRemaining: null,
      },
    };
  }

  const actor: PlayerCharacter = {
    ...parsedActor,
    id: GIFF_ACTOR_ID,
    name: `${race.name} · Astral Spark Tester`,
  };
  const combatActor = withCombatResource(resetEconomy({
    ...quickCombatCharacter,
    id: GIFF_COMBAT_ACTOR_ID,
    name: `${race.name} · Astral Spark Combat Tester`,
  }), parsedResource);

  return {
    actor,
    combatActor,
    pendingRoll: null,
    outcome: `Ready: ${actor.name}; Astral Spark ${parsedResource.current}/${actor.proficiencyBonus} uses; Long Rest reset.`,
    lastResolution: null,
  };
}

function fixedD20Random(d20: number): () => number {
  // rollDice floors a [0,1) value into a d20 face. This preserves the shared
  // dice parser while letting Apply rerun the same face after the choice.
  return () => (d20 - 1) / 20 + 0.001;
}

function getAttackBaseTotal(actor: CombatCharacter, d20: number): AttackResult {
  return resolveAttack(
    d20,
    getAbilityModifierValue(actor.stats.dexterity ?? 10),
    GIFF_ATTACK_TARGET_AC,
    actor.critThreshold ?? 20,
  );
}

function getBaseSavingActor(actor: CombatCharacter): CombatCharacter {
  // Remove only save proficiency for the pre-choice roll. All other native
  // actor modifiers remain in place, so Apply adds exactly one PB afterward.
  return { ...actor, savingThrowProficiencies: [] };
}

/** Roll one deterministic native transaction and expose its d20 before choice. */
export function rollGiffAstralSpark(
  scenario: GiffAstralSparkScenarioState,
  transaction: GiffAstralSparkTransaction,
  rng: () => number = Math.random,
): GiffAstralSparkScenarioState {
  if (!scenario.actor || !scenario.combatActor) {
    return {
      ...scenario,
      outcome: 'Astral Spark rejected: the production-assembled actor is unavailable.',
      lastResolution: createRejectedResolution('assembly_unavailable', scenario),
    };
  }
  if (scenario.pendingRoll) {
    return {
      ...scenario,
      outcome: 'Astral Spark rejected atomically: resolve or decline the visible d20 before rolling again.',
      lastResolution: createRejectedResolution('pending_roll', scenario),
    };
  }

  let d20: number;
  let baseModifier: number;
  let baseTotal: number;
  let baseOutcome: string;
  let nextCombatActor = scenario.combatActor;

  if (transaction === 'ability-check') {
    const check = rollAbilityCheck(scenario.actor, 'Intelligence', undefined, { rng });
    d20 = check.roll;
    baseModifier = check.total - check.roll;
    baseTotal = check.total;
    baseOutcome = `Intelligence check ${check.total}`;
  } else if (transaction === 'saving-throw') {
    const save = rollSavingThrow(
      getBaseSavingActor(scenario.combatActor),
      'Dexterity',
      GIFF_SAVE_DC,
      [],
      undefined,
      undefined,
      { rng },
    );
    d20 = save.roll ?? 0;
    baseModifier = save.total - d20;
    baseTotal = save.total;
    baseOutcome = `Dexterity save ${save.total} vs DC ${GIFF_SAVE_DC}`;
  } else {
    const actionCost = { type: 'action' as const };
    if (!canAffordActionCost(scenario.combatActor, actionCost)) {
      return {
        ...scenario,
        outcome: 'Astral Spark attack rejected atomically: Action is already used; no d20 or resource changed.',
        lastResolution: createRejectedResolution('action_unavailable', scenario),
      };
    }
    d20 = rollDice('1d20', { rng });
    const attack = getAttackBaseTotal(scenario.combatActor, d20);
    baseModifier = attack.total - d20;
    baseTotal = attack.total;
    baseOutcome = `Attack ${attack.isHit ? 'hit' : 'miss'} at ${attack.total} vs AC ${GIFF_ATTACK_TARGET_AC}`;
    // The attack's Action is paid by the native economy when the attack roll is made.
    nextCombatActor = consumeActionCost(scenario.combatActor, actionCost);
  }

  return {
    ...scenario,
    combatActor: nextCombatActor,
    pendingRoll: { transaction, d20, baseModifier, baseTotal, baseOutcome },
    outcome: `d20 seen: ${d20}; ${baseOutcome}; Astral Spark is optional.`,
    lastResolution: null,
  };
}

/** Apply the PB after the visible d20, paying exactly one parsed resource use. */
export function applyGiffAstralSpark(
  scenario: GiffAstralSparkScenarioState,
): GiffAstralSparkScenarioState {
  const actor = scenario.actor;
  const combatActor = scenario.combatActor;
  const pending = scenario.pendingRoll;
  const resource = getGiffAstralSparkResource(actor);
  if (!actor || !combatActor || !pending || !resource) {
    return {
      ...scenario,
      outcome: 'Astral Spark apply rejected: no visible pending roll or parsed resource is available.',
      lastResolution: createRejectedResolution('assembly_unavailable', scenario),
    };
  }
  if (resource.current <= 0) {
    return {
      ...scenario,
      outcome: 'Astral Spark apply rejected atomically: no Proficiency Bonus uses remain; actor and roll are unchanged.',
      lastResolution: createRejectedResolution('resource_exhausted', scenario),
    };
  }

  const proficiencyBonus = actor.proficiencyBonus ?? calculateProficiencyBonus(actor.level ?? 1);
  let finalTotal = pending.baseTotal;
  let finalOutcome = pending.baseOutcome;
  if (pending.transaction === 'ability-check') {
    const check: CheckResult = rollAbilityCheck(actor, 'Intelligence', undefined, {
      externalModifier: proficiencyBonus,
      rng: fixedD20Random(pending.d20),
    });
    finalTotal = check.total;
    finalOutcome = `Intelligence check ${check.total}`;
  } else if (pending.transaction === 'saving-throw') {
    const save: SavingThrowResult = rollSavingThrow(
      getBaseSavingActor(combatActor),
      'Dexterity',
      GIFF_SAVE_DC,
      [{ source: 'Astral Spark', flat: proficiencyBonus }],
      undefined,
      undefined,
      { rng: fixedD20Random(pending.d20) },
    );
    finalTotal = save.total;
    finalOutcome = `Dexterity save ${save.total} vs DC ${GIFF_SAVE_DC}`;
  } else {
    const attack = resolveAttack(
      pending.d20,
      getAbilityModifierValue(combatActor.stats.dexterity ?? 10) + proficiencyBonus,
      GIFF_ATTACK_TARGET_AC,
      combatActor.critThreshold ?? 20,
    );
    finalTotal = attack.total;
    finalOutcome = `Attack ${attack.isHit ? 'hit' : 'miss'} at ${attack.total} vs AC ${GIFF_ATTACK_TARGET_AC}`;
  }

  const nextResource = { ...resource, current: resource.current - 1 };
  const nextActor: PlayerCharacter = {
    ...actor,
    limitedUses: { ...(actor.limitedUses ?? {}), [GIFF_ASTRAL_SPARK_RESOURCE_ID]: nextResource },
  };
  const nextCombatActor = withCombatResource(combatActor, nextResource);
  return {
    ...scenario,
    actor: nextActor,
    combatActor: nextCombatActor,
    pendingRoll: null,
    outcome: `Astral Spark applied: d20 ${pending.d20} + base modifier ${pending.baseModifier} + PB ${proficiencyBonus} = ${finalTotal}; ${finalOutcome}; uses ${nextResource.current}/${actor.proficiencyBonus}.`,
    lastResolution: {
      status: 'resolved',
      reason: 'applied',
      transaction: pending.transaction,
      d20: pending.d20,
      baseTotal: pending.baseTotal,
      finalTotal,
      proficiencyBonusAdded: proficiencyBonus,
      usesRemaining: nextResource.current,
    },
  };
}

/** Decline the offer without spending the parsed resource. */
export function declineGiffAstralSpark(
  scenario: GiffAstralSparkScenarioState,
): GiffAstralSparkScenarioState {
  const pending = scenario.pendingRoll;
  if (!pending) {
    return {
      ...scenario,
      outcome: 'Astral Spark decline ignored: no visible d20 choice is pending.',
      lastResolution: createRejectedResolution('pending_roll', scenario),
    };
  }
  const usesRemaining = getGiffAstralSparkResource(scenario.actor)?.current ?? null;
  return {
    ...scenario,
    pendingRoll: null,
    outcome: `Astral Spark declined: ${pending.baseOutcome}; d20 ${pending.d20}; resource unchanged at ${usesRemaining ?? 'unknown'} uses.`,
    lastResolution: {
      status: 'resolved',
      reason: 'declined',
      transaction: pending.transaction,
      d20: pending.d20,
      baseTotal: pending.baseTotal,
      finalTotal: pending.baseTotal,
      proficiencyBonusAdded: 0,
      usesRemaining,
    },
  };
}

// ============================================================================
// Visible Giff Race Leaf Surface
// ============================================================================
// This compact board exposes the d20, base result, PB choice, resource, action
// payment, canonical facts, reset boundary, and exact unsupported mechanics.
// Parent Reset changes the key so no pending choice or spent resource survives.
// ============================================================================

const GiffRaceLeafContent: React.FC<RaceDomainLeafProps> = ({ race, state, onScenarioEvent }) => {
  const [transaction, setTransaction] = useState<GiffAstralSparkTransaction>('ability-check');
  const [scenario, setScenario] = useState(() => createGiffAstralSparkScenario(race));
  const resource = getGiffAstralSparkResource(scenario.actor);
  const proficiencyBonus = scenario.actor?.proficiencyBonus ?? calculateProficiencyBonus(GIFF_SCENARIO_LEVEL);
  const astralSpark = getCanonicalGiffAstralSparkTrait(race);
  const firearmsMastery = getCanonicalGiffTrait(race, 'Firearms Mastery');
  const hippoBuild = getCanonicalGiffTrait(race, 'Hippo Build');
  const speed = getCanonicalGiffTrait(race, 'Speed');

  const publish = (nextScenario: GiffAstralSparkScenarioState) => {
    setScenario(nextScenario);
    const resolution = nextScenario.lastResolution;
    onScenarioEvent(resolution?.reason === 'applied'
      ? `Giff ASTRAL SPARK APPLIED: ${nextScenario.outcome}`
      : resolution?.reason === 'declined'
        ? `Giff ASTRAL SPARK DECLINED: ${nextScenario.outcome}`
        : `Giff ASTRAL SPARK: ${nextScenario.outcome}`);
  };

  const handleRoll = () => publish(rollGiffAstralSpark(scenario, transaction));
  const handleApply = () => publish(applyGiffAstralSpark(scenario));
  const handleDecline = () => publish(declineGiffAstralSpark(scenario));

  return (
    <section aria-labelledby="giff-astral-spark-title" data-testid="giff-race-leaf">
      {/* The heading names the canonical post-roll choice for assistive tools. */}
      <h4 id="giff-astral-spark-title">Giff · Astral Spark</h4>
      <p data-testid="giff-astral-spark-trait">Canonical: {astralSpark ?? 'Astral Spark trait missing'}</p>

      {/* The selector changes only which native d20 helper is demonstrated. */}
      <label htmlFor="giff-astral-spark-transaction">Roll type</label>
      <select
        id="giff-astral-spark-transaction"
        value={transaction}
        onChange={event => setTransaction(event.target.value as GiffAstralSparkTransaction)}
      >
        <option value="ability-check">Ability check · Intelligence</option>
        <option value="saving-throw">Saving throw · Dexterity</option>
        <option value="attack">Attack · Dexterity vs AC {GIFF_ATTACK_TARGET_AC}</option>
      </select>
      <Button type="button" variant="primary" size="sm" id={GIFF_ASTRAL_SPARK_CONTROL_ID} onClick={handleRoll}>
        Roll d20 and show Astral Spark choice
      </Button>

      {/* This line makes the parsed resource and attack Action payment visible. */}
      <p data-testid="giff-actor-facts">
        Actor: {scenario.actor?.name ?? 'missing'}; PB +{proficiencyBonus}; Astral Spark uses {resource?.current ?? 0}/{proficiencyBonus} ({resource?.resetOn ?? 'unavailable'}); Attack Action {scenario.combatActor?.actionEconomy.action.used ? 'used' : 'ready'}.
      </p>
      <p data-testid="giff-roll-facts">
        {scenario.pendingRoll
          ? `Visible d20 ${scenario.pendingRoll.d20}; base modifier ${scenario.pendingRoll.baseModifier}; base total ${scenario.pendingRoll.baseTotal}; ${scenario.pendingRoll.baseOutcome}.`
          : scenario.lastResolution?.d20 !== null && scenario.lastResolution?.d20 !== undefined
            ? `Last d20 ${scenario.lastResolution.d20}; base total ${scenario.lastResolution.baseTotal}; final total ${scenario.lastResolution.finalTotal}; PB added ${scenario.lastResolution.proficiencyBonusAdded}.`
            : 'No d20 has been rolled yet.'}
      </p>

      {/* Apply and Decline are deliberately separate controls after the face is visible. */}
      {scenario.pendingRoll && (
        <div data-testid="giff-astral-spark-choice">
          <Button type="button" variant="primary" size="sm" onClick={handleApply}>Apply PB</Button>
          <Button type="button" variant="secondary" size="sm" onClick={handleDecline}>Decline</Button>
        </div>
      )}
      <p aria-live="polite" role="status" data-testid="giff-astral-spark-outcome">{scenario.outcome}</p>

      {/* These are canonical Giff facts, not fake firearm, carrying, or movement controls. */}
      <div data-testid="giff-canonical-facts">
        <strong>Canonical facts:</strong> {speed ?? 'Speed trait missing'} | {firearmsMastery ?? 'Firearms Mastery trait missing'} | {hippoBuild ?? 'Hippo Build trait missing'}
      </div>

      {/* The parser bridge and unsupported mechanics are named so the board cannot overclaim. */}
      <p data-testid="giff-boundary">
        Boundary: Astral Spark uses the production racial parser/resource and native d20/check/save/attack helpers; the combat snapshot receives only that parsed resource through a narrow bridge. Firearms Mastery is fact-only here: no firearm item, loading rule, long-range rule, or weapon-proficiency transaction is fabricated. Hippo Build is fact-only here: no carrying capacity or push/drag/lift engine is invoked. Swim 30 is fact-only here: no swim movement or 2D/3D render proof is claimed. Parent Reset restores the parsed PB/Long Rest uses and pending-choice state.
      </p>
      <span hidden>{state.resetCount}</span>
    </section>
  );
};

// Parent Reset increments resetCount. The keyed content remount restores the
// selected transaction, d20 choice, action economy, and PB/Long Rest resource.
export const GiffRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <GiffRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />
);

// Automatic discovery requires this exact named registration export.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'giff-astral-spark',
  raceId: 'giff',
  label: 'Giff · Astral Spark',
  description: 'Show a native attack, save, or ability-check d20 before an optional parser-backed PB/Long Rest Astral Spark spend.',
  Component: GiffRaceLeaf,
};

export default RACE_DOMAIN_LEAF;

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This leaf is intentionally isolated from the shared race shell.
 *
 * MULTI-AGENT SAFETY:
 * Race 36 owns this file and its focused test only. Keep the automatic registry
 * contract intact so other race leaves do not need a shared-list edit.
 */
// @dependencies-end

import React, { useState } from 'react';
import { buildRacialTraitLibrary } from '../../../../../data/races/racialTraits';
import { applyRacialSpellGrantsByLevel, resolveRacialResourceId } from '../../../../../utils/character/characterUtils';
import { applyDamageAndCheckDowned } from '../../../../../utils/combat/deathSaveUtils';
import { canAffordActionCost, consumeActionCost, resetEconomy } from '../../../../../utils/combat/actionEconomyUtils';
import { resolveAttack } from '../../../../../utils/combat/combatUtils';
import { createQuickCharacter, createQuickCombatCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { PlayerCharacter, Race } from '../../../../../types';
import type { CombatCharacter } from '../../../../../types/combat';
import type { RaceDomainLeafProps, RaceDomainLeafRegistration } from '../raceDomainTypes';

/**
 * This file gives the canonical Goblin race one deterministic Fury of the Small
 * attack inside the Tactical Sandbox Race domain.
 *
 * The player actor is assembled by the production quick-character path so the
 * racial parser owns the PB/Long Rest resource. The combat actor then uses the
 * native attack, Action, HP, and damage helpers. The optional Fury choice is
 * applied only after a larger target is damaged, while Nimble Escape, Fey
 * Ancestry, and darkvision remain visible facts or explicit boundaries because
 * this leaf does not own Hide, visibility, opportunity-attack, or sensing truth.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Goblin data, racial parser/resource projection,
 * production quick-character assembly, and native combat helpers.
 */

// ============================================================================
// Canonical Goblin Facts And Resource Identity
// ============================================================================
// These readers keep the board tied to the selected canonical Race. If the
// source rule text changes, the leaf becomes unavailable instead of proving a
// stale copied version of Fury of the Small.
// ============================================================================

export const GOBLIN_FURY_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'goblin__fury_of_the_small__resource',
);
export const GOBLIN_FURY_CONTROL_ID = 'goblin-fury-of-the-small-attack';
export const GOBLIN_ACTOR_ID = 'goblin-fury-actor';
export const GOBLIN_TARGET_ID = 'goblin-fury-target';
export const GOBLIN_SCENARIO_LEVEL = 5;
export const GOBLIN_FIXED_ATTACK_ROLL = 12;
export const GOBLIN_BASE_DAMAGE = 7;
export const GOBLIN_TARGET_HP = 30;
export const GOBLIN_TARGET_AC = 15;

const GOBLIN_FURY_TRAIT = /^Fury of the Small:\s*/i;
const GOBLIN_NIMBLE_ESCAPE_TRAIT = /^Nimble Escape:\s*/i;
const GOBLIN_FEY_ANCESTRY_TRAIT = /^Fey Ancestry:\s*/i;
const GOBLIN_VISION_TRAIT = /^Vision:\s*/i;
const GOBLIN_SIZE_TRAIT = /^Size:\s*/i;

export type GoblinTargetId = 'larger-hit' | 'larger-miss' | 'equal-size';

export interface GoblinTargetOption {
  id: GoblinTargetId;
  label: string;
  size: NonNullable<CombatCharacter['stats']['size']>;
  armorClass: number;
}

export const GOBLIN_TARGET_OPTIONS: readonly GoblinTargetOption[] = [
  { id: 'larger-hit', label: 'Large target · hit', size: 'Large', armorClass: GOBLIN_TARGET_AC },
  { id: 'larger-miss', label: 'Large target · miss', size: 'Large', armorClass: 21 },
  { id: 'equal-size', label: 'Small target · equal size', size: 'Small', armorClass: GOBLIN_TARGET_AC },
];

/** Return the exact canonical text for one named Goblin trait. */
export function getCanonicalGoblinTrait(race: Race, traitName: string): string | null {
  return race.traits.find(trait => trait.trim().startsWith(`${traitName}:`)) ?? null;
}

/** Return the canonical Fury rule text used by both the board and the proof. */
export function getCanonicalGoblinFuryTrait(race: Race): string | null {
  return race.traits.find(trait => GOBLIN_FURY_TRAIT.test(trait.trim())) ?? null;
}

/** Return the canonical size fact without inventing a second race-size table. */
export function getCanonicalGoblinSize(race: Race): NonNullable<CombatCharacter['stats']['size']> | null {
  const size = race.traits.find(trait => GOBLIN_SIZE_TRAIT.test(trait.trim()))?.split(':')[1]?.trim();
  return size && ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'].includes(size)
    ? size as NonNullable<CombatCharacter['stats']['size']>
    : null;
}

/** Confirm that every visible Goblin fact still exists in canonical data. */
export function hasCanonicalGoblinFeatures(race: Race): boolean {
  const fury = getCanonicalGoblinFuryTrait(race);
  const nimbleEscape = race.traits.find(trait => GOBLIN_NIMBLE_ESCAPE_TRAIT.test(trait.trim()));
  const feyAncestry = race.traits.find(trait => GOBLIN_FEY_ANCESTRY_TRAIT.test(trait.trim()));
  const vision = race.traits.find(trait => GOBLIN_VISION_TRAIT.test(trait.trim()));

  return race.id === 'goblin'
    && race.name === 'Goblin'
    && getCanonicalGoblinSize(race) === 'Small'
    && !!fury
    && /damage a creature with an attack or a spell/i.test(fury)
    && /larger than yours/i.test(fury)
    && /extra damage equals your proficiency bonus/i.test(fury)
    && /proficiency bonus/i.test(fury)
    && /long rest/i.test(fury)
    && !!nimbleEscape
    && /Disengage or Hide action as a bonus action/i.test(nimbleEscape)
    && !!feyAncestry
    && /advantage on saving throws/i.test(feyAncestry)
    && !!vision
    && /darkness/i.test(vision);
}

/** Read the parser-owned Fury resource from the player actor. */
export function getGoblinFuryResource(actor: PlayerCharacter | null) {
  return actor?.limitedUses?.[GOBLIN_FURY_RESOURCE_ID];
}

// ============================================================================
// Production Actor And Target Assembly
// ============================================================================
// The player actor owns the parsed racial resource. The combat snapshot owns
// native Action and HP state, so this leaf carries only the parsed resource and
// canonical size across that existing preview boundary.
// ============================================================================

const GOBLIN_ACTOR_CONFIG = {
  name: 'Goblin · Fury Tester',
  raceId: 'goblin',
  classId: 'fighter',
  level: GOBLIN_SCENARIO_LEVEL,
  stats: [16, 12, 14, 10, 10, 10] as [number, number, number, number, number, number],
};

function getProficiencyBonus(actor: CombatCharacter): number {
  return 2 + Math.floor((actor.level - 1) / 4);
}

function getAttackBonus(actor: CombatCharacter): number {
  return Math.floor((actor.stats.strength - 10) / 2) + getProficiencyBonus(actor);
}

function withGoblinSize(actor: CombatCharacter, size: NonNullable<CombatCharacter['stats']['size']>): CombatCharacter {
  // CombatCharacter has a size field, but player snapshots do not populate it
  // from Race. This adapter fills that gap from the canonical Race before the
  // size gate runs and does not create a general-purpose second size resolver.
  return { ...actor, stats: { ...actor.stats, size } };
}

function withGoblinFuryResource(
  actor: CombatCharacter,
  resource: NonNullable<ReturnType<typeof getGoblinFuryResource>>,
): CombatCharacter {
  // The combat snapshot does not parse racial resources itself. Keeping the
  // same parsed entry in the snapshot makes the visible resource and player
  // actor update together without moving Goblin rules into combat globals.
  return {
    ...actor,
    limitedUses: {
      ...(actor.limitedUses ?? {}),
      [GOBLIN_FURY_RESOURCE_ID]: { ...resource },
    },
  };
}

function getCanonicalFuryResource(race: Race) {
  const traits = buildRacialTraitLibrary({ [race.id]: race }).byRaceId[race.id] ?? [];
  const furyTrait = traits.find(
    trait => trait.traitName === 'Fury of the Small' && 'resources' in trait,
  );
  return furyTrait && 'resources' in furyTrait
    ? furyTrait.resources?.find(resource => resource.id === 'goblin__fury_of_the_small__resource')
    : undefined;
}

function createGoblinTarget(targetId: GoblinTargetId): CombatCharacter | null {
  const option = GOBLIN_TARGET_OPTIONS.find(candidate => candidate.id === targetId);
  const assembled = createQuickCombatCharacter({
    name: 'Goblin Fury Target',
    raceId: 'human',
    classId: 'fighter',
    level: 1,
    stats: [10, 10, 10, 10, 10, 10],
  });
  if (!option || !assembled) return null;

  // Target HP, AC, and size are deterministic scenario facts; attack and
  // damage resolution still use the native CombatCharacter helpers below.
  return {
    ...assembled,
    id: GOBLIN_TARGET_ID,
    name: `${option.size} target · AC ${option.armorClass}`,
    team: 'enemy',
    armorClass: option.armorClass,
    baseAC: option.armorClass,
    currentHP: GOBLIN_TARGET_HP,
    maxHP: GOBLIN_TARGET_HP,
    abilities: [],
    stats: { ...assembled.stats, size: option.size },
  };
}

export interface GoblinPendingFury {
  targetId: GoblinTargetId;
  d20: number;
  attackTotal: number;
  baseDamage: number;
  targetSize: NonNullable<CombatCharacter['stats']['size']>;
}

export type GoblinFuryResolutionReason =
  | 'hit_pending_choice'
  | 'miss'
  | 'equal_size'
  | 'fury_applied'
  | 'declined'
  | 'resource_exhausted'
  | 'action_unavailable'
  | 'canonical_trait_missing'
  | 'assembly_unavailable'
  | 'pending_choice';

export interface GoblinFuryResolution {
  status: 'resolved' | 'rejected';
  reason: GoblinFuryResolutionReason;
  targetSize: NonNullable<CombatCharacter['stats']['size']> | null;
  d20: number | null;
  attackTotal: number | null;
  baseDamage: number;
  extraDamage: number;
  usesRemaining: number | null;
}

export interface GoblinFuryScenarioState {
  actor: PlayerCharacter | null;
  combatActor: CombatCharacter | null;
  target: CombatCharacter | null;
  pendingFury: GoblinPendingFury | null;
  outcome: string;
  lastResolution: GoblinFuryResolution | null;
}

function createRejectedResolution(
  reason: GoblinFuryResolutionReason,
  scenario: GoblinFuryScenarioState,
  targetSize: NonNullable<CombatCharacter['stats']['size']> | null = scenario.target?.stats.size ?? null,
): GoblinFuryResolution {
  return {
    status: 'rejected',
    reason,
    targetSize,
    d20: scenario.pendingFury?.d20 ?? null,
    attackTotal: scenario.pendingFury?.attackTotal ?? null,
    baseDamage: scenario.pendingFury?.baseDamage ?? 0,
    extraDamage: 0,
    usesRemaining: getGoblinFuryResource(scenario.actor)?.current ?? null,
  };
}

/** Assemble the player/combat pair and require the parser's canonical resource. */
export function createGoblinFuryScenario(
  race: Race,
  targetId: GoblinTargetId = 'larger-hit',
): GoblinFuryScenarioState {
  if (!hasCanonicalGoblinFeatures(race)) {
    return {
      actor: null,
      combatActor: null,
      target: null,
      pendingFury: null,
      outcome: 'Fury of the Small unavailable: canonical Goblin traits changed.',
      lastResolution: {
        status: 'rejected',
        reason: 'canonical_trait_missing',
        targetSize: null,
        d20: null,
        attackTotal: null,
        baseDamage: 0,
        extraDamage: 0,
        usesRemaining: null,
      },
    };
  }

  const quickCharacter = createQuickCharacter(GOBLIN_ACTOR_CONFIG);
  const quickCombatCharacter = createQuickCombatCharacter(GOBLIN_ACTOR_CONFIG);
  const canonicalSize = getCanonicalGoblinSize(race);
  const canonicalResource = getCanonicalFuryResource(race);
  if (!quickCharacter || !quickCombatCharacter || !canonicalSize || !canonicalResource) {
    return {
      actor: null,
      combatActor: null,
      target: null,
      pendingFury: null,
      outcome: 'Fury of the Small unavailable: production actor or racial resource assembly is incomplete.',
      lastResolution: {
        status: 'rejected',
        reason: 'assembly_unavailable',
        targetSize: null,
        d20: null,
        attackTotal: null,
        baseDamage: 0,
        extraDamage: 0,
        usesRemaining: null,
      },
    };
  }

  // Parse the active Race record through production character setup so the
  // resource max and reset policy come from the real racial parser.
  const parsedActor = applyRacialSpellGrantsByLevel({ ...quickCharacter, race }, GOBLIN_SCENARIO_LEVEL);
  const parsedResource = getGoblinFuryResource(parsedActor);
  const target = createGoblinTarget(targetId);
  if (!parsedResource || !target) {
    return {
      actor: null,
      combatActor: null,
      target: null,
      pendingFury: null,
      outcome: 'Fury of the Small unavailable: parser resource or target assembly is incomplete.',
      lastResolution: {
        status: 'rejected',
        reason: 'assembly_unavailable',
        targetSize: null,
        d20: null,
        attackTotal: null,
        baseDamage: 0,
        extraDamage: 0,
        usesRemaining: null,
      },
    };
  }

  const combatActor = resetEconomy(withGoblinFuryResource(
    withGoblinSize({
      ...quickCombatCharacter,
      id: GOBLIN_ACTOR_ID,
      name: `${race.name} · Fury Tester`,
      team: 'player',
      position: { x: 2, y: 2 },
    }, canonicalSize),
    parsedResource,
  ));

  return {
    actor: parsedActor,
    combatActor,
    target,
    pendingFury: null,
    outcome: `Ready: ${race.name}; size ${canonicalSize}; PB +${parsedActor.proficiencyBonus}; Action ready; Fury uses ${parsedResource.current}/${parsedResource.max} (${parsedResource.resetOn}).`,
    lastResolution: null,
  };
}

function replaceCombatState(
  scenario: GoblinFuryScenarioState,
  combatActor: CombatCharacter,
  target: CombatCharacter,
): GoblinFuryScenarioState {
  // Return a new scenario snapshot so rejected transactions can preserve the
  // exact actor/target references and remain visibly atomic in focused tests.
  return { ...scenario, combatActor, target };
}

/** Resolve the native attack and base damage, then offer Fury only when legal. */
export function resolveGoblinAttack(
  scenario: GoblinFuryScenarioState,
  targetId: GoblinTargetId,
): GoblinFuryScenarioState {
  const actor = scenario.combatActor;
  const targetOption = GOBLIN_TARGET_OPTIONS.find(candidate => candidate.id === targetId);
  const currentTarget = scenario.target;
  if (!actor || !currentTarget || !targetOption) {
    return {
      ...scenario,
      outcome: 'Goblin attack unavailable: production actor or target assembly is incomplete.',
      lastResolution: createRejectedResolution('assembly_unavailable', scenario, targetOption?.size ?? null),
    };
  }

  // Each target choice supplies only AC and size. The native attack resolver
  // remains responsible for hit, miss, and critical outcomes.
  const target = {
    ...currentTarget,
    name: `${targetOption.size} target · AC ${targetOption.armorClass}`,
    armorClass: targetOption.armorClass,
    baseAC: targetOption.armorClass,
    stats: { ...currentTarget.stats, size: targetOption.size },
  };
  const actionCost = { type: 'action' as const };
  if (!canAffordActionCost(actor, actionCost)) {
    return {
      ...scenario,
      target,
      outcome: 'Goblin attack rejected atomically: Action is already used; target HP and Fury resource are unchanged.',
      lastResolution: createRejectedResolution('action_unavailable', scenario, targetOption.size),
    };
  }

  const attack = resolveAttack(
    GOBLIN_FIXED_ATTACK_ROLL,
    getAttackBonus(actor),
    targetOption.armorClass,
    actor.critThreshold,
  );
  const paidActor = consumeActionCost(actor, actionCost);
  if (!attack.isHit) {
    const next = replaceCombatState(scenario, paidActor, target);
    return {
      ...next,
      pendingFury: null,
      outcome: `Goblin attack MISS: d20 ${GOBLIN_FIXED_ATTACK_ROLL} + ${getAttackBonus(actor)} = ${attack.total} vs AC ${targetOption.armorClass}; Action paid; target HP remains ${target.currentHP}/${target.maxHP}; Fury resource unchanged.`,
      lastResolution: {
        status: 'resolved',
        reason: 'miss',
        targetSize: targetOption.size,
        d20: GOBLIN_FIXED_ATTACK_ROLL,
        attackTotal: attack.total,
        baseDamage: 0,
        extraDamage: 0,
        usesRemaining: getGoblinFuryResource(scenario.actor)?.current ?? null,
      },
    };
  }

  // Base attack damage is native HP damage and occurs before the optional
  // racial rider choice. The Action is already paid even if Fury is declined.
  const damagedTarget = applyDamageAndCheckDowned(target, GOBLIN_BASE_DAMAGE, attack.isCritical);
  const largerTarget = targetOption.size !== 'Small';
  const next = replaceCombatState(scenario, paidActor, damagedTarget);
  if (!largerTarget) {
    return {
      ...next,
      pendingFury: null,
      outcome: `Goblin attack HIT: equal-size ${targetOption.size} target; d20 ${GOBLIN_FIXED_ATTACK_ROLL} + ${getAttackBonus(actor)} = ${attack.total}; base damage ${GOBLIN_BASE_DAMAGE}; Action paid; Fury rejected by size gate; target HP ${target.currentHP} → ${damagedTarget.currentHP}.`,
      lastResolution: {
        status: 'resolved',
        reason: 'equal_size',
        targetSize: targetOption.size,
        d20: GOBLIN_FIXED_ATTACK_ROLL,
        attackTotal: attack.total,
        baseDamage: GOBLIN_BASE_DAMAGE,
        extraDamage: 0,
        usesRemaining: getGoblinFuryResource(scenario.actor)?.current ?? null,
      },
    };
  }

  return {
    ...next,
    pendingFury: {
      targetId,
      d20: GOBLIN_FIXED_ATTACK_ROLL,
      attackTotal: attack.total,
      baseDamage: GOBLIN_BASE_DAMAGE,
      targetSize: targetOption.size,
    },
    outcome: `Goblin attack HIT: ${targetOption.size} target; d20 ${GOBLIN_FIXED_ATTACK_ROLL} + ${getAttackBonus(actor)} = ${attack.total}; base damage ${GOBLIN_BASE_DAMAGE}; Action paid; choose Fury of the Small or Decline; target HP ${target.currentHP} → ${damagedTarget.currentHP}.`,
    lastResolution: {
      status: 'resolved',
      reason: 'hit_pending_choice',
      targetSize: targetOption.size,
      d20: GOBLIN_FIXED_ATTACK_ROLL,
      attackTotal: attack.total,
      baseDamage: GOBLIN_BASE_DAMAGE,
      extraDamage: 0,
      usesRemaining: getGoblinFuryResource(scenario.actor)?.current ?? null,
    },
  };
}

/** Apply the optional PB rider atomically after the larger target was damaged. */
export function applyGoblinFury(scenario: GoblinFuryScenarioState): GoblinFuryScenarioState {
  const actor = scenario.combatActor;
  const playerActor = scenario.actor;
  const target = scenario.target;
  const pending = scenario.pendingFury;
  if (!actor || !playerActor || !target) {
    return { ...scenario, outcome: 'Fury of the Small rejected: actor or target assembly is unavailable.', lastResolution: createRejectedResolution('assembly_unavailable', scenario) };
  }
  if (!pending) {
    return { ...scenario, outcome: 'Fury of the Small ignored: no larger-target hit is awaiting a choice.', lastResolution: createRejectedResolution('pending_choice', scenario) };
  }

  const resource = getGoblinFuryResource(playerActor);
  const proficiencyBonus = playerActor.proficiencyBonus ?? getProficiencyBonus(actor);
  if (!resource || resource.current <= 0) {
    // Do not clear the pending choice or mutate HP when the optional resource
    // is exhausted. This preserves an auditable atomic rejection.
    return {
      ...scenario,
      outcome: `Fury of the Small rejected atomically: ${resource?.resetOn ?? 'Long Rest'} resource exhausted; base hit and Action remain; target HP ${target.currentHP}/${target.maxHP} unchanged.`,
      lastResolution: createRejectedResolution('resource_exhausted', scenario, pending.targetSize),
    };
  }

  const nextResource = { ...resource, current: resource.current - 1 };
  const damagedTarget = applyDamageAndCheckDowned(target, proficiencyBonus);
  const nextActor = withGoblinFuryResource(actor, nextResource);
  const nextPlayerActor: PlayerCharacter = {
    ...playerActor,
    limitedUses: { ...(playerActor.limitedUses ?? {}), [GOBLIN_FURY_RESOURCE_ID]: nextResource },
  };
  return {
    ...replaceCombatState(scenario, nextActor, damagedTarget),
    actor: nextPlayerActor,
    pendingFury: null,
    outcome: `Fury of the Small APPLIED: +${proficiencyBonus} damage to larger ${pending.targetSize} target; target HP ${target.currentHP} → ${damagedTarget.currentHP}; Fury uses ${nextResource.current}/${resource.max}; Action remains used.`,
    lastResolution: {
      status: 'resolved',
      reason: 'fury_applied',
      targetSize: pending.targetSize,
      d20: pending.d20,
      attackTotal: pending.attackTotal,
      baseDamage: pending.baseDamage,
      extraDamage: proficiencyBonus,
      usesRemaining: nextResource.current,
    },
  };
}

/** Decline Fury without spending the parsed resource or changing base damage. */
export function declineGoblinFury(scenario: GoblinFuryScenarioState): GoblinFuryScenarioState {
  const pending = scenario.pendingFury;
  if (!pending) {
    return { ...scenario, outcome: 'Fury of the Small decline ignored: no larger-target hit is awaiting a choice.', lastResolution: createRejectedResolution('pending_choice', scenario) };
  }

  const usesRemaining = getGoblinFuryResource(scenario.actor)?.current ?? null;
  return {
    ...scenario,
    pendingFury: null,
    outcome: `Fury of the Small DECLINED: base damage ${pending.baseDamage} kept; target HP ${scenario.target?.currentHP ?? 'unknown'}/${scenario.target?.maxHP ?? 'unknown'}; resource unchanged at ${usesRemaining ?? 'unknown'} uses.`,
    lastResolution: {
      status: 'resolved',
      reason: 'declined',
      targetSize: pending.targetSize,
      d20: pending.d20,
      attackTotal: pending.attackTotal,
      baseDamage: pending.baseDamage,
      extraDamage: 0,
      usesRemaining,
    },
  };
}

// ============================================================================
// Visible Goblin Race Leaf Surface
// ============================================================================
// The board exposes the native attack transaction, target size, HP, Action,
// resource, optional choice, reset boundary, and exact unsupported mechanics.
// ============================================================================

const GoblinRaceLeafContent: React.FC<RaceDomainLeafProps> = ({ race, state, onScenarioEvent }) => {
  const [targetId, setTargetId] = useState<GoblinTargetId>('larger-hit');
  const [scenario, setScenario] = useState(() => createGoblinFuryScenario(race));
  const actor = scenario.combatActor;
  const target = scenario.target;
  const playerActor = scenario.actor;
  const resource = getGoblinFuryResource(playerActor);
  const targetOption = GOBLIN_TARGET_OPTIONS.find(option => option.id === targetId);
  const fury = getCanonicalGoblinFuryTrait(race);
  const nimbleEscape = getCanonicalGoblinTrait(race, 'Nimble Escape');
  const feyAncestry = getCanonicalGoblinTrait(race, 'Fey Ancestry');
  const vision = getCanonicalGoblinTrait(race, 'Vision');

  const publish = (nextScenario: GoblinFuryScenarioState) => {
    setScenario(nextScenario);
    onScenarioEvent(nextScenario.lastResolution?.reason === 'fury_applied'
      ? `Goblin FURY APPLIED: ${nextScenario.outcome}`
      : nextScenario.lastResolution?.reason === 'declined'
        ? `Goblin FURY DECLINED: ${nextScenario.outcome}`
        : `Goblin FURY: ${nextScenario.outcome}`);
  };

  const handleAttack = () => publish(resolveGoblinAttack(scenario, targetId));
  const handleApply = () => publish(applyGoblinFury(scenario));
  const handleDecline = () => publish(declineGoblinFury(scenario));

  return (
    <section aria-labelledby="goblin-fury-title" data-testid="goblin-race-leaf">
      {/* The heading names the canonical Goblin transaction for assistive tools. */}
      <h4 id="goblin-fury-title">Goblin · Fury of the Small</h4>
      <p data-testid="goblin-fury-trait">Canonical: {fury ?? 'Fury of the Small trait missing'}</p>

      {/* Target size is visible before the native attack so the size gate is auditable. */}
      <label htmlFor="goblin-fury-target">Attack target</label>
      <select
        id="goblin-fury-target"
        value={targetId}
        onChange={event => setTargetId(event.target.value as GoblinTargetId)}
      >
        {GOBLIN_TARGET_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
      <Button type="button" variant="primary" size="sm" id={GOBLIN_FURY_CONTROL_ID} onClick={handleAttack}>
        Resolve native attack
      </Button>

      {/* These facts come from production actors plus the narrow canonical size/resource adapter. */}
      <p data-testid="goblin-actor-facts">
        Actor: {actor?.name ?? 'missing'}; size {actor?.stats.size ?? 'unknown'}; PB +{playerActor?.proficiencyBonus ?? 'unknown'}; Action {actor?.actionEconomy.action.used ? 'used' : 'ready'}; Fury uses {resource?.current ?? 0}/{resource?.max ?? 'unknown'} ({resource?.resetOn ?? 'unavailable'}).
      </p>
      <p data-testid="goblin-target-facts">
        Target: {targetOption?.label ?? 'missing'}; size {targetOption?.size ?? target?.stats.size ?? 'unknown'}; HP {target?.currentHP ?? 'unknown'}/{target?.maxHP ?? 'unknown'}; AC {targetOption?.armorClass ?? target?.armorClass ?? 'unknown'}.
      </p>

      {/* Apply and Decline are available only after a legal larger-target hit. */}
      {scenario.pendingFury && (
        <div data-testid="goblin-fury-choice">
          <Button type="button" variant="primary" size="sm" onClick={handleApply}>Apply Fury of the Small</Button>
          <Button type="button" variant="secondary" size="sm" onClick={handleDecline}>Decline Fury</Button>
        </div>
      )}
      <p aria-live="polite" role="status" data-testid="goblin-fury-outcome">{scenario.outcome}</p>

      {/* These facts are shown without inventing hide, sensing, or charm-save mechanics. */}
      <div data-testid="goblin-canonical-facts">
        <strong>Canonical facts:</strong> {nimbleEscape ?? 'Nimble Escape trait missing'} | {feyAncestry ?? 'Fey Ancestry trait missing'} | {vision ?? 'Vision trait missing'}
      </div>
      <p data-testid="goblin-boundary">
        Boundary: Fury is proven through the native attack, HP, Action, and parsed PB/Long Rest resource path. The spell-damage path is not mounted here. Nimble Escape is fact-only: no fake Bonus Action Hide/Disengage, hidden state, visibility, or opportunity-attack suppression is claimed. Fey Ancestry and darkvision remain canonical facts; no charmed-save or sensing resolver is fabricated. Combat snapshots omit player race size, so this leaf uses a narrow canonical Size adapter. Parent Reset restores actor HP, Action, target selection, pending choice, and Fury uses.
      </p>
      <span hidden>{state.resetCount}</span>
    </section>
  );
};

// Parent Reset increments resetCount. A keyed remount restores every local
// transaction state instead of allowing a spent Action or resource to leak.
export const GoblinRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <GoblinRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />
);

// Automatic discovery requires this exact named registration export.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'goblin-fury-of-the-small',
  raceId: 'goblin',
  label: 'Goblin · Fury of the Small',
  description: 'Resolve a native attack and optionally add parsed PB damage against a larger target.',
  Component: GoblinRaceLeaf,
};

export default RACE_DOMAIN_LEAF;

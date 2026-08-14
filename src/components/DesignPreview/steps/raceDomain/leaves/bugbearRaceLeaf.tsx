import React, { useState } from 'react';
import { Button } from '../../../../ui/Button';
import { applyDamageAndCheckDowned } from '../../../../../utils/combat/deathSaveUtils';
import {
  canAffordActionCost,
  consumeActionCost,
  resetEconomy,
} from '../../../../../utils/combat/actionEconomyUtils';
import {
  getCharacterDistance,
  resolveAttack,
} from '../../../../../utils/combat/combatUtils';
import { createQuickCombatCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import type { Race } from '../../../../../types';
import type { Ability, CombatCharacter } from '../../../../../types/combat';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file gives the canonical Bugbear race one deterministic Long-Limbed
 * strike inside the Tactical Sandbox Race domain.
 *
 * The leaf assembles a real combat character, checks native footprint distance,
 * resolves a fixed attack roll with the shared attack helper, pays the shared
 * Action economy, and applies real HP damage. The production bridge does not
 * currently understand Bugbear Surprise Attack or automatically widen every
 * Bugbear melee ability, so those boundaries stay visible instead of being
 * represented by a UI-only success claim.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Bugbear data, quick combat assembly, combat geometry,
 * attack, damage, and action-economy helpers.
 */

// ============================================================================
// Canonical Trait And Deterministic Control Facts
// ============================================================================
// These values describe only the small proof board. The rule text still comes
// from the supplied canonical Race object, while the authored positions make
// the range boundary repeatable for both tests and mounted play.
// ============================================================================

export const BUGBEAR_STRIKE_CONTROL_ID = 'resolve-bugbear-long-limbed-strike';
export const BUGBEAR_STRIKE_TARGET_CONTROL_ID = 'bugbear-strike-target';
export const BUGBEAR_ACTOR_ID = 'bugbear-long-limbed-actor';
export const BUGBEAR_TARGET_ID = 'bugbear-long-limbed-target';
export const BUGBEAR_TARGET_AC = 15;
export const BUGBEAR_TARGET_HP = 30;
export const BUGBEAR_BASE_DAMAGE = 7;
export const BUGBEAR_FIXED_ATTACK_ROLL = 12;
export const BUGBEAR_LONG_LIMBED_REACH_TILES = 2;

export type BugbearStrikeTargetId = 'in-range' | 'out-of-range';

export interface BugbearStrikeTarget {
  id: BugbearStrikeTargetId;
  label: string;
  position: { x: number; y: number };
}

export const BUGBEAR_STRIKE_TARGETS: readonly BugbearStrikeTarget[] = [
  { id: 'in-range', label: '10 ft target · Long-Limbed legal', position: { x: 4, y: 2 } },
  { id: 'out-of-range', label: '15 ft target · beyond Long-Limbed reach', position: { x: 5, y: 2 } },
];

const LONG_LIMBED_TRAIT = /^Long-Limbed:\s*/i;
const SURPRISE_ATTACK_TRAIT = /^Surprise Attack:\s*/i;

/** Return the exact canonical Long-Limbed text instead of copying the rule. */
export function getCanonicalBugbearLongLimbedTrait(race: Race): string | null {
  return race.traits.find(trait => LONG_LIMBED_TRAIT.test(trait.trim())) ?? null;
}

/** Return the exact canonical Surprise Attack text for the visible boundary. */
export function getCanonicalBugbearSurpriseAttackTrait(race: Race): string | null {
  return race.traits.find(trait => SURPRISE_ATTACK_TRAIT.test(trait.trim())) ?? null;
}

/** Confirm that the supplied race still carries the facts this leaf demonstrates. */
export function hasCanonicalBugbearRules(race: Race): boolean {
  const longLimbed = getCanonicalBugbearLongLimbedTrait(race);
  const surpriseAttack = getCanonicalBugbearSurpriseAttackTrait(race);
  return race.id === 'bugbear'
    && race.name === 'Bugbear'
    && !!longLimbed
    && /5 feet greater than normal/i.test(longLimbed)
    && !!surpriseAttack
    && /extra 2d6 damage/i.test(surpriseAttack)
    && /hasn.t taken a turn/i.test(surpriseAttack);
}

// ============================================================================
// Production-Assembly Adapter
// ============================================================================
// The preview has no live combat snapshot to borrow, so it uses the same quick
// character assembly seam as other Tactical Sandbox scenarios. The only local
// fixture facts are stable IDs, positions, target AC/HP, and the fixed roll;
// actor stats and action economy still come from production helpers.
// ============================================================================

function getProficiencyBonus(actor: CombatCharacter): number {
  return 2 + Math.floor((actor.level - 1) / 4);
}

function getAttackBonus(actor: CombatCharacter): number {
  return Math.floor((actor.stats.strength - 10) / 2) + getProficiencyBonus(actor);
}

function createBugbearLongLimbedAbility(): Ability {
  return {
    id: BUGBEAR_STRIKE_CONTROL_ID,
    name: 'Long-Limbed Strike',
    description: 'A deterministic melee attack using the Bugbear 10-foot Long-Limbed reach subset.',
    type: 'attack',
    cost: { type: 'action' },
    targeting: 'single_enemy',
    range: BUGBEAR_LONG_LIMBED_REACH_TILES,
    effects: [{ type: 'damage', value: BUGBEAR_BASE_DAMAGE, damageType: 'bludgeoning' }],
    attackType: 'weapon',
    attackBonus: undefined,
    isProficient: true,
  };
}

function createBugbearActor(race: Race): CombatCharacter | null {
  // Canonical identity is a hard gate so a stale or substituted Race cannot
  // make this leaf report a Bugbear mechanic for another selectable race.
  if (!hasCanonicalBugbearRules(race)) return null;

  const assembled = createQuickCombatCharacter({
    name: 'Bugbear · Long-Limbed Tester',
    raceId: race.id,
    classId: 'fighter',
    level: 5,
    stats: [16, 12, 14, 10, 10, 10],
  });
  if (!assembled) return null;

  // Keep the combat actor assembled by production code while giving the leaf
  // a stable position, identity, and one explicitly authored proof ability.
  return resetEconomy({
    ...assembled,
    id: BUGBEAR_ACTOR_ID,
    name: `${race.name} · Long-Limbed Tester`,
    position: { x: 2, y: 2 },
    team: 'player',
    abilities: [createBugbearLongLimbedAbility()],
  });
}

function createBugbearTarget(targetId: BugbearStrikeTargetId): CombatCharacter | null {
  const target = BUGBEAR_STRIKE_TARGETS.find(candidate => candidate.id === targetId);
  const assembled = createQuickCombatCharacter({
    name: 'Bugbear Strike Target',
    raceId: 'human',
    classId: 'fighter',
    level: 1,
    stats: [10, 10, 10, 10, 10, 10],
  });
  if (!target || !assembled) return null;

  // The target uses a production combat character with a small deterministic
  // HP/AC fixture so the native attack and damage helpers have observable work.
  return {
    ...assembled,
    id: BUGBEAR_TARGET_ID,
    name: 'Strike Target · AC 15 · 30 HP',
    position: { ...target.position },
    team: 'enemy',
    armorClass: BUGBEAR_TARGET_AC,
    baseAC: BUGBEAR_TARGET_AC,
    currentHP: BUGBEAR_TARGET_HP,
    maxHP: BUGBEAR_TARGET_HP,
    abilities: [],
  };
}

export interface BugbearStrikeScenarioState {
  characters: CombatCharacter[];
  outcome: string;
  lastResolution: BugbearStrikeResolution | null;
}

export type BugbearStrikeReason =
  | 'hit'
  | 'miss'
  | 'out_of_range'
  | 'action_unavailable'
  | 'assembly_unavailable';

export interface BugbearStrikeResolution {
  status: 'resolved' | 'rejected';
  reason: BugbearStrikeReason;
  distanceFeet: number;
  reachFeet: number;
  attackTotal?: number;
  damage: number;
}

function getActor(scenario: BugbearStrikeScenarioState): CombatCharacter | undefined {
  return scenario.characters.find(character => character.id === BUGBEAR_ACTOR_ID);
}

function getTarget(scenario: BugbearStrikeScenarioState): CombatCharacter | undefined {
  return scenario.characters.find(character => character.id === BUGBEAR_TARGET_ID);
}

function replaceCharacters(
  characters: CombatCharacter[],
  replacements: readonly CombatCharacter[],
): CombatCharacter[] {
  const replacementById = new Map(replacements.map(character => [character.id, character]));
  return characters.map(character => replacementById.get(character.id) ?? character);
}

function createRejectedResolution(
  reason: BugbearStrikeReason,
  distanceFeet: number,
  reachFeet: number,
): BugbearStrikeResolution {
  return {
    status: 'rejected',
    reason,
    distanceFeet,
    reachFeet,
    damage: 0,
  };
}

/**
 * Resolve the real Long-Limbed subset through native distance, attack, damage,
 * and action-economy helpers. Surprise Attack is intentionally not added here:
 * no production resolver currently carries the target's turn-start state.
 */
export function resolveBugbearStrike(
  scenario: BugbearStrikeScenarioState,
  targetId: BugbearStrikeTargetId,
): BugbearStrikeScenarioState {
  const actor = getActor(scenario);
  const targetPosition = BUGBEAR_STRIKE_TARGETS.find(candidate => candidate.id === targetId)?.position;
  const target = getTarget(scenario);
  if (!actor || !target || !targetPosition) {
    const lastResolution = createRejectedResolution('assembly_unavailable', 0, BUGBEAR_LONG_LIMBED_REACH_TILES * 5);
    return {
      ...scenario,
      outcome: 'Bugbear strike unavailable: production actor or target assembly is incomplete.',
      lastResolution,
    };
  }

  // Target selection changes only the authored target position. The native
  // nearest-footprint distance remains the authority for range legality.
  const positionedTarget = target.position.x === targetPosition.x && target.position.y === targetPosition.y
    ? target
    : { ...target, position: { ...targetPosition } };
  const distanceFeet = getCharacterDistance(actor, positionedTarget) * 5;
  const reachFeet = BUGBEAR_LONG_LIMBED_REACH_TILES * 5;
  if (distanceFeet > reachFeet) {
    const lastResolution = createRejectedResolution('out_of_range', distanceFeet, reachFeet);
    return {
      ...scenario,
      outcome: `Long-Limbed strike rejected atomically: native footprint distance ${distanceFeet} ft exceeds ${reachFeet} ft reach; Action remains ready.`,
      lastResolution,
    };
  }

  const actionCost = { type: 'action' as const };
  if (!canAffordActionCost(actor, actionCost)) {
    const lastResolution = createRejectedResolution('action_unavailable', distanceFeet, reachFeet);
    return {
      ...scenario,
      outcome: 'Long-Limbed strike rejected atomically: Action is already used; target HP is unchanged.',
      lastResolution,
    };
  }

  // The fixed roll makes the proof repeatable while the modifier and AC remain
  // visible facts from the assembled actor and authored target respectively.
  const attack = resolveAttack(
    BUGBEAR_FIXED_ATTACK_ROLL,
    getAttackBonus(actor),
    positionedTarget.armorClass ?? BUGBEAR_TARGET_AC,
    actor.critThreshold,
  );
  const paidActor = consumeActionCost(actor, actionCost);
  const damagedTarget = attack.isHit
    ? applyDamageAndCheckDowned(positionedTarget, BUGBEAR_BASE_DAMAGE, attack.isCritical)
    : positionedTarget;
  const characters = replaceCharacters(scenario.characters, [paidActor, damagedTarget]);
  const reason: BugbearStrikeReason = attack.isHit ? 'hit' : 'miss';
  const lastResolution: BugbearStrikeResolution = {
    status: 'resolved',
    reason,
    distanceFeet,
    reachFeet,
    attackTotal: attack.total,
    damage: attack.isHit ? BUGBEAR_BASE_DAMAGE : 0,
  };

  return {
    characters,
    outcome: attack.isHit
      ? `Long-Limbed strike HIT: ${distanceFeet} ft of ${reachFeet} ft reach; d20 ${BUGBEAR_FIXED_ATTACK_ROLL} + ${getAttackBonus(actor)} = ${attack.total} vs AC ${positionedTarget.armorClass ?? BUGBEAR_TARGET_AC}; Action paid; HP ${positionedTarget.currentHP} → ${damagedTarget.currentHP}. Surprise Attack extra 2d6 not resolved by the production bridge.`
      : `Long-Limbed strike MISS: ${distanceFeet} ft of ${reachFeet} ft reach; d20 ${BUGBEAR_FIXED_ATTACK_ROLL} + ${getAttackBonus(actor)} = ${attack.total} vs AC ${positionedTarget.armorClass ?? BUGBEAR_TARGET_AC}; Action paid. Surprise Attack extra 2d6 not resolved by the production bridge.`,
    lastResolution,
  };
}

/** Build the exact baseline restored whenever the parent shell increments resetCount. */
export function createBugbearStrikeScenario(
  race: Race,
  targetId: BugbearStrikeTargetId = 'in-range',
): BugbearStrikeScenarioState {
  const actor = createBugbearActor(race);
  const target = createBugbearTarget(targetId);
  const characters = [actor, target].filter((character): character is CombatCharacter => character !== null);
  const usable = actor !== null && target !== null && hasCanonicalBugbearRules(race);
  return {
    characters,
    outcome: usable
      ? `Ready: ${actor.name}; Long-Limbed reach ${BUGBEAR_LONG_LIMBED_REACH_TILES * 5} ft; Action ready; target HP ${target.currentHP}/${target.maxHP}.`
      : 'Bugbear strike unavailable: canonical Bugbear traits or production assembly are incomplete.',
    lastResolution: null,
  };
}

// ============================================================================
// Bugbear Leaf UI
// ============================================================================
// The controls expose canonical text, actor/resource facts, native transaction
// results, and the exact unsupported Surprise Attack boundary. Parent Reset
// remounts this keyed content so target selection and Action state cannot leak.
// ============================================================================

const BugbearRaceLeafContent: React.FC<RaceDomainLeafProps> = ({ race, onScenarioEvent }) => {
  const [targetId, setTargetId] = useState<BugbearStrikeTargetId>('in-range');
  const [scenario, setScenario] = useState(() => createBugbearStrikeScenario(race));
  const actor = getActor(scenario);
  const target = getTarget(scenario);
  const targetOption = BUGBEAR_STRIKE_TARGETS.find(candidate => candidate.id === targetId);
  const longLimbedTrait = getCanonicalBugbearLongLimbedTrait(race);
  const surpriseAttackTrait = getCanonicalBugbearSurpriseAttackTrait(race);

  const handleResolve = () => {
    const nextScenario = resolveBugbearStrike(scenario, targetId);
    setScenario(nextScenario);
    const result = nextScenario.lastResolution;
    onScenarioEvent(result?.status === 'resolved' && result.reason === 'hit'
      ? `Bugbear LONG-LIMBED STRIKE HIT: ${result.distanceFeet} ft; Action paid; target HP ${getTarget(nextScenario)?.currentHP ?? 'unknown'}. Surprise Attack boundary visible.`
      : `Bugbear LONG-LIMBED STRIKE ${result?.reason?.toUpperCase() ?? 'UNAVAILABLE'}: ${nextScenario.outcome}`);
  };

  return (
    <section aria-labelledby="bugbear-long-limbed-title" data-testid="bugbear-race-leaf">
      {/* The heading names the canonical trait transaction for assistive tools. */}
      <h4 id="bugbear-long-limbed-title">Bugbear · Long-Limbed Strike</h4>
      <p data-testid="bugbear-canonical-long-limbed">Canonical: {longLimbedTrait ?? 'Long-Limbed trait missing'}</p>
      <p data-testid="bugbear-canonical-surprise-attack">Canonical: {surpriseAttackTrait ?? 'Surprise Attack trait missing'}</p>

      {/* The selector chooses only authored positions; native footprint distance decides legality. */}
      <label htmlFor={BUGBEAR_STRIKE_TARGET_CONTROL_ID}>Strike target</label>
      <select
        id={BUGBEAR_STRIKE_TARGET_CONTROL_ID}
        value={targetId}
        onChange={event => setTargetId(event.target.value as BugbearStrikeTargetId)}
      >
        {BUGBEAR_STRIKE_TARGETS.map(option => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      <Button type="button" onClick={handleResolve}>Resolve Long-Limbed Strike</Button>

      {/* These facts expose production assembly and shared action payment rather than a success label. */}
      <p data-testid="bugbear-actor-facts">
        Actor: {actor?.name ?? 'missing'}; Position {actor?.position.x},{actor?.position.y}; Reach {BUGBEAR_LONG_LIMBED_REACH_TILES * 5} ft; Action {actor?.actionEconomy.action.used ? 'used' : 'ready'}; PB +{actor ? getProficiencyBonus(actor) : 'unknown'}.
      </p>
      <p data-testid="bugbear-target-facts">
        Target: {targetOption?.label ?? 'missing'}; Position {targetOption?.position.x},{targetOption?.position.y}; HP {target?.currentHP ?? 'unknown'}/{target?.maxHP ?? 'unknown'}; AC {target?.armorClass ?? BUGBEAR_TARGET_AC}.
      </p>
      <p aria-live="polite" role="status" data-testid="bugbear-outcome">{scenario.outcome}</p>

      {/* This is the exact production gap: no runtime state tracks whether a target has taken a turn. */}
      <p data-testid="bugbear-unsupported-boundary">
        Unsupported boundary: the production bridge has no Bugbear-aware Long-Limbed weapon projection or Surprise Attack resolver keyed to a target&apos;s first turn. This leaf proves one 10-foot reach adapter through native footprint distance, attack, damage, and Action helpers; it does not claim the extra 2d6 Surprise Attack damage, initiative-turn state, Stealth/Sneaky resolution, or 2D/3D render proof.
      </p>
    </section>
  );
};

// Parent Reset increments resetCount. A keyed boundary restores target choice,
// actor position, Action state, target HP, and the canonical baseline outcome.
export const BugbearRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <BugbearRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />
);

// Automatic discovery requires this exact named registration export. Both ids
// intentionally stay canonical and local; no shared registry edit is needed.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'bugbear',
  raceId: 'bugbear',
  label: 'Bugbear',
  description: 'Resolve one native-helper-backed Long-Limbed strike while exposing the unsupported Surprise Attack boundary.',
  Component: BugbearRaceLeaf,
};

export default RACE_DOMAIN_LEAF;

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
  rollDamage,
} from '../../../../../utils/combat/combatUtils';
import { createQuickCombatCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import type { Race } from '../../../../../types';
import type { CombatCharacter, Position } from '../../../../../types/combat';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file gives the canonical Centaur race one deterministic Charge
 * sequence inside the Tactical Sandbox Race domain.
 *
 * The leaf uses production character assembly, movement accounting, footprint
 * distance, attack resolution, damage, and action-economy helpers. It exists
 * so the preview can show the 30-foot straight-line prerequisite, the melee
 * hit, and the follow-up Hooves Bonus Action without inventing a second combat
 * engine. The runtime still has no race-aware Charge resolver, so Equine Build,
 * Natural Affinity, opportunity attacks, and mounted 2D/3D proof stay visible
 * as boundaries instead of being claimed as implemented.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Centaur data, quick combat assembly, combat geometry,
 * attack, damage, and action-economy helpers.
 */

// ============================================================================
// Canonical Trait And Deterministic Control Facts
// ============================================================================
// These helpers read the supplied Race object so the preview remains tied to
// the selectable canonical record. The authored positions make the Charge
// prerequisite repeatable while native helpers decide distances and payment.
// ============================================================================

export const CENTAUR_CHARGE_CONTROL_ID = 'resolve-centaur-charge';
export const CENTAUR_CHARGE_TARGET_CONTROL_ID = 'centaur-charge-target';
export const CENTAUR_ACTOR_ID = 'centaur-charge-actor';
export const CENTAUR_TARGET_ID = 'centaur-charge-target-creature';
export const CENTAUR_TARGET_AC = 15;
export const CENTAUR_TARGET_HP = 40;
export const CENTAUR_CHARGE_ATTACK_ROLL = 12;
export const CENTAUR_HOOVES_ATTACK_ROLL = 12;
export const CENTAUR_CHARGE_DAMAGE_DICE = '1d8';
export const CENTAUR_HOOVES_DAMAGE_DICE = '1d6';
export const CENTAUR_MIN_CHARGE_FEET = 30;
export const CENTAUR_MELEE_REACH_FEET = 5;

export type CentaurChargeTargetId = 'legal' | 'short' | 'off-axis';

export interface CentaurChargeTarget {
  id: CentaurChargeTargetId;
  label: string;
  destination: Position;
  targetPosition: Position;
}

export const CENTAUR_CHARGE_TARGETS: readonly CentaurChargeTarget[] = [
  {
    id: 'legal',
    label: '30 ft straight charge · melee finish',
    destination: { x: 7, y: 2 },
    targetPosition: { x: 8, y: 2 },
  },
  {
    id: 'short',
    label: '15 ft approach · Charge too short',
    destination: { x: 4, y: 2 },
    targetPosition: { x: 5, y: 2 },
  },
  {
    id: 'off-axis',
    label: '30 ft angled approach · not straight',
    destination: { x: 7, y: 4 },
    targetPosition: { x: 7, y: 5 },
  },
];

const CENTAUR_SPEED_TRAIT = /^Speed:\s*/i;
const CENTAUR_CHARGE_TRAIT = /^Charge:\s*/i;
const CENTAUR_HOOVES_TRAIT = /^Hooves:\s*/i;

/** Return the canonical Speed trait rather than copying its prose into the UI. */
export function getCanonicalCentaurSpeedTrait(race: Race): string | null {
  return race.traits.find(trait => CENTAUR_SPEED_TRAIT.test(trait.trim())) ?? null;
}

/** Parse the canonical walking speed for the production-assembled actor. */
export function getCanonicalCentaurSpeedFeet(race: Race): number | null {
  const match = getCanonicalCentaurSpeedTrait(race)?.match(/(\d+)\s+feet/i);
  return match ? Number(match[1]) : null;
}

/** Return the canonical Charge trigger used by the deterministic proof. */
export function getCanonicalCentaurChargeTrait(race: Race): string | null {
  return race.traits.find(trait => CENTAUR_CHARGE_TRAIT.test(trait.trim())) ?? null;
}

/** Return the canonical Hooves damage rule used by the follow-up attack. */
export function getCanonicalCentaurHoovesTrait(race: Race): string | null {
  return race.traits.find(trait => CENTAUR_HOOVES_TRAIT.test(trait.trim())) ?? null;
}

/** Confirm that the supplied race still carries the representative Centaur facts. */
export function hasCanonicalCentaurRules(race: Race): boolean {
  const speed = getCanonicalCentaurSpeedFeet(race);
  const charge = getCanonicalCentaurChargeTrait(race);
  const hooves = getCanonicalCentaurHoovesTrait(race);
  return race.id === 'centaur'
    && race.name === 'Centaur'
    && speed === 40
    && !!charge
    && /move at least 30 feet straight toward a target/i.test(charge)
    && /melee weapon attack/i.test(charge)
    && /bonus action/i.test(charge)
    && !!hooves
    && /1d6/i.test(hooves)
    && /Strength modifier/i.test(hooves);
}

// ============================================================================
// Production-Assembly Adapter
// ============================================================================
// The preview has no live combat snapshot to borrow, so it uses the same quick
// character assembly seam as other Tactical Sandbox scenarios. Stable ids,
// positions, target AC/HP, and fixed rolls are local proof fixtures; the actor
// and all resource transitions remain production-shaped objects.
// ============================================================================

function getProficiencyBonus(actor: CombatCharacter): number {
  return 2 + Math.floor((actor.level - 1) / 4);
}

function getStrengthModifier(actor: CombatCharacter): number {
  return Math.floor((actor.stats.strength - 10) / 2);
}

function getAttackBonus(actor: CombatCharacter): number {
  return getStrengthModifier(actor) + getProficiencyBonus(actor);
}

function createCentaurActor(race: Race): CombatCharacter | null {
  // Canonical identity is a hard gate so a stale or substituted Race cannot
  // make this leaf report a Centaur mechanic for another selectable race.
  if (!hasCanonicalCentaurRules(race)) return null;

  const assembled = createQuickCombatCharacter({
    name: 'Centaur · Charge Tester',
    raceId: race.id,
    classId: 'fighter',
    level: 5,
    stats: [16, 12, 14, 10, 10, 10],
  });
  const speedFeet = getCanonicalCentaurSpeedFeet(race);
  if (!assembled || speedFeet === null) return null;

  // DEBT: quickCharacterGenerator currently gives most races a 30-foot speed.
  // Project the canonical Centaur speed at this narrow adapter boundary so the
  // shared reset and movement helpers enforce the real 40-foot pool. The proper
  // long-term fix is for character assembly to derive speed from Race data.
  return resetEconomy({
    ...assembled,
    id: CENTAUR_ACTOR_ID,
    name: `${race.name} · Charge Tester`,
    position: { x: 1, y: 2 },
    team: 'player',
    stats: { ...assembled.stats, speed: speedFeet },
  });
}

function createCentaurTarget(target: CentaurChargeTarget): CombatCharacter | null {
  const assembled = createQuickCombatCharacter({
    name: 'Centaur Charge Target',
    raceId: 'human',
    classId: 'fighter',
    level: 1,
    stats: [10, 10, 10, 10, 10, 10],
  });
  if (!assembled) return null;

  // The target uses a production combat character with deterministic HP and AC
  // so both native attack resolutions produce visible, testable damage.
  return {
    ...assembled,
    id: CENTAUR_TARGET_ID,
    name: 'Charge Target · AC 15 · 40 HP',
    position: { ...target.targetPosition },
    team: 'enemy',
    armorClass: CENTAUR_TARGET_AC,
    baseAC: CENTAUR_TARGET_AC,
    currentHP: CENTAUR_TARGET_HP,
    maxHP: CENTAUR_TARGET_HP,
    abilities: [],
  };
}

export interface CentaurChargeScenarioState {
  characters: CombatCharacter[];
  outcome: string;
  lastResolution: CentaurChargeResolution | null;
}

export type CentaurChargeReason =
  | 'charge_resolved'
  | 'attack_missed'
  | 'assembly_unavailable'
  | 'charge_too_short'
  | 'not_straight_toward_target'
  | 'not_melee_after_move'
  | 'insufficient_movement'
  | 'action_unavailable'
  | 'bonus_action_unavailable';

export interface CentaurChargeResolution {
  status: 'resolved' | 'rejected';
  reason: CentaurChargeReason;
  movementFeet: number;
  requiredMovementFeet: number;
  meleeDistanceFeet: number;
  chargeAttackTotal?: number;
  hoovesAttackTotal?: number;
  chargeDamage: number;
  hoovesDamage: number;
  movementPaid: boolean;
  actionPaid: boolean;
  bonusActionPaid: boolean;
}

function getActor(scenario: CentaurChargeScenarioState): CombatCharacter | undefined {
  return scenario.characters.find(character => character.id === CENTAUR_ACTOR_ID);
}

function getTarget(scenario: CentaurChargeScenarioState): CombatCharacter | undefined {
  return scenario.characters.find(character => character.id === CENTAUR_TARGET_ID);
}

function replaceCharacters(
  characters: CombatCharacter[],
  replacements: readonly CombatCharacter[],
): CombatCharacter[] {
  const replacementById = new Map(replacements.map(character => [character.id, character]));
  return characters.map(character => replacementById.get(character.id) ?? character);
}

function createRejectedResolution(
  reason: Exclude<CentaurChargeReason, 'charge_resolved' | 'attack_missed'>,
  movementFeet = 0,
  meleeDistanceFeet = 0,
): CentaurChargeResolution {
  return {
    status: 'rejected',
    reason,
    movementFeet,
    requiredMovementFeet: CENTAUR_MIN_CHARGE_FEET,
    meleeDistanceFeet,
    chargeDamage: 0,
    hoovesDamage: 0,
    movementPaid: false,
    actionPaid: false,
    bonusActionPaid: false,
  };
}

/** Check that the authored destination lies on the straight vector to target. */
function isStraightTowardTarget(
  origin: Position,
  destination: Position,
  target: Position,
): boolean {
  const moveX = destination.x - origin.x;
  const moveY = destination.y - origin.y;
  const targetX = target.x - origin.x;
  const targetY = target.y - origin.y;
  const crossProduct = moveX * targetY - moveY * targetX;
  const dotProduct = moveX * targetX + moveY * targetY;
  const doesNotOvershoot = Math.abs(moveX) <= Math.abs(targetX)
    && Math.abs(moveY) <= Math.abs(targetY);

  // A zero-length move is not a Charge, and a negative dot product means the
  // destination is behind the actor rather than toward the chosen target.
  return (moveX !== 0 || moveY !== 0)
    && crossProduct === 0
    && dotProduct > 0
    && doesNotOvershoot;
}

/** Resolve the canonical Charge sequence through native combat helpers. */
export function resolveCentaurCharge(
  scenario: CentaurChargeScenarioState,
  targetId: CentaurChargeTargetId,
): CentaurChargeScenarioState {
  const actor = getActor(scenario);
  const targetFixture = CENTAUR_CHARGE_TARGETS.find(candidate => candidate.id === targetId);
  const target = getTarget(scenario);
  if (!actor || !target || !targetFixture) {
    return {
      ...scenario,
      outcome: 'Centaur Charge unavailable: production actor, target, or authored path is missing.',
      lastResolution: createRejectedResolution('assembly_unavailable'),
    };
  }

  const positionedTarget = target.position.x === targetFixture.targetPosition.x
    && target.position.y === targetFixture.targetPosition.y
    ? target
    : { ...target, position: { ...targetFixture.targetPosition } };
  const movedActor = { ...actor, position: { ...targetFixture.destination } };
  const movementFeet = getCharacterDistance(actor, movedActor) * 5;
  const meleeDistanceFeet = getCharacterDistance(movedActor, positionedTarget) * 5;

  // Every prerequisite is checked before any resource or HP mutation so an
  // illegal path leaves the actor, target, and bookkeeping exactly unchanged.
  if (movementFeet < CENTAUR_MIN_CHARGE_FEET) {
    return {
      ...scenario,
      outcome: `Centaur Charge rejected atomically: ${movementFeet} ft is less than the canonical 30 ft straight movement; resources and HP unchanged.`,
      lastResolution: createRejectedResolution('charge_too_short', movementFeet, meleeDistanceFeet),
    };
  }
  if (!isStraightTowardTarget(actor.position, targetFixture.destination, targetFixture.targetPosition)) {
    return {
      ...scenario,
      outcome: 'Centaur Charge rejected atomically: the authored path is not straight toward the target; resources and HP unchanged.',
      lastResolution: createRejectedResolution('not_straight_toward_target', movementFeet, meleeDistanceFeet),
    };
  }
  if (meleeDistanceFeet > CENTAUR_MELEE_REACH_FEET) {
    return {
      ...scenario,
      outcome: `Centaur Charge rejected atomically: native footprint distance after movement is ${meleeDistanceFeet} ft, beyond melee reach; resources and HP unchanged.`,
      lastResolution: createRejectedResolution('not_melee_after_move', movementFeet, meleeDistanceFeet),
    };
  }

  const movementCost = { type: 'movement-only' as const, movementCost: movementFeet };
  if (!canAffordActionCost(actor, movementCost)) {
    return {
      ...scenario,
      outcome: `Centaur Charge rejected atomically: movement pool cannot pay ${movementFeet} ft; Action, Bonus Action, and HP unchanged.`,
      lastResolution: createRejectedResolution('insufficient_movement', movementFeet, meleeDistanceFeet),
    };
  }

  const actionCost = { type: 'action' as const };
  if (!canAffordActionCost(actor, actionCost)) {
    return {
      ...scenario,
      outcome: 'Centaur Charge rejected atomically: Action is already used; movement, Bonus Action, and HP unchanged.',
      lastResolution: createRejectedResolution('action_unavailable', movementFeet, meleeDistanceFeet),
    };
  }

  // The proof button represents the complete Charge sequence. Preflight the
  // follow-up Bonus Action so a used Bonus Action cannot leave a partial charge.
  const bonusActionCost = { type: 'bonus' as const };
  if (!canAffordActionCost(actor, bonusActionCost)) {
    return {
      ...scenario,
      outcome: 'Centaur Charge rejected atomically: Bonus Action is already used; movement, Action, and HP unchanged.',
      lastResolution: createRejectedResolution('bonus_action_unavailable', movementFeet, meleeDistanceFeet),
    };
  }

  const actorAfterMovement = {
    ...consumeActionCost(actor, movementCost),
    position: { ...targetFixture.destination },
  };
  const actorAfterAction = consumeActionCost(actorAfterMovement, actionCost);
  const chargeAttack = resolveAttack(
    CENTAUR_CHARGE_ATTACK_ROLL,
    getAttackBonus(actor),
    positionedTarget.armorClass ?? CENTAUR_TARGET_AC,
    actor.critThreshold,
  );

  if (!chargeAttack.isHit) {
    const characters = replaceCharacters(scenario.characters, [actorAfterAction, positionedTarget]);
    return {
      ...scenario,
      characters,
      outcome: `Centaur Charge approach resolved but the melee attack MISSED: ${movementFeet} ft moved; Action paid; Hooves not available because Charge requires a hit.`,
      lastResolution: {
        status: 'resolved',
        reason: 'attack_missed',
        movementFeet,
        requiredMovementFeet: CENTAUR_MIN_CHARGE_FEET,
        meleeDistanceFeet,
        chargeAttackTotal: chargeAttack.total,
        chargeDamage: 0,
        hoovesDamage: 0,
        movementPaid: true,
        actionPaid: true,
        bonusActionPaid: false,
      },
    };
  }

  // The first hit uses native deterministic damage, then the Charge rider pays
  // and resolves one Hooves attack as a real Bonus Action transaction.
  const chargeDamage = rollDamage(CENTAUR_CHARGE_DAMAGE_DICE, chargeAttack.isCritical, 1, () => 0.5);
  const targetAfterCharge = applyDamageAndCheckDowned(
    positionedTarget,
    chargeDamage,
    chargeAttack.isCritical,
  );
  const actorAfterBonus = consumeActionCost(actorAfterAction, bonusActionCost);
  const hoovesAttack = resolveAttack(
    CENTAUR_HOOVES_ATTACK_ROLL,
    getAttackBonus(actor),
    targetAfterCharge.armorClass ?? CENTAUR_TARGET_AC,
    actor.critThreshold,
  );
  const hoovesDamage = hoovesAttack.isHit
    ? rollDamage(`${CENTAUR_HOOVES_DAMAGE_DICE} + ${getStrengthModifier(actor)}`, hoovesAttack.isCritical, 1, () => 0.5)
    : 0;
  const finalTarget = hoovesAttack.isHit
    ? applyDamageAndCheckDowned(targetAfterCharge, hoovesDamage, hoovesAttack.isCritical)
    : targetAfterCharge;
  const characters = replaceCharacters(scenario.characters, [actorAfterBonus, finalTarget]);

  return {
    ...scenario,
    characters,
    outcome: `Centaur Charge RESOLVED: ${movementFeet} ft straight; melee d20 ${CENTAUR_CHARGE_ATTACK_ROLL} + ${getAttackBonus(actor)} = ${chargeAttack.total} HIT for ${chargeDamage}; Action paid; Hooves d20 ${CENTAUR_HOOVES_ATTACK_ROLL} + ${getAttackBonus(actor)} = ${hoovesAttack.total} ${hoovesAttack.isHit ? `HIT for ${hoovesDamage}` : 'MISS'}; Bonus Action paid; target HP ${positionedTarget.currentHP} → ${finalTarget.currentHP}.`,
    lastResolution: {
      status: 'resolved',
      reason: 'charge_resolved',
      movementFeet,
      requiredMovementFeet: CENTAUR_MIN_CHARGE_FEET,
      meleeDistanceFeet,
      chargeAttackTotal: chargeAttack.total,
      hoovesAttackTotal: hoovesAttack.total,
      chargeDamage,
      hoovesDamage,
      movementPaid: true,
      actionPaid: true,
      bonusActionPaid: true,
    },
  };
}

/** Build the exact baseline restored whenever the parent shell increments resetCount. */
export function createCentaurChargeScenario(
  race: Race,
  targetId: CentaurChargeTargetId = 'legal',
): CentaurChargeScenarioState {
  const targetFixture = CENTAUR_CHARGE_TARGETS.find(candidate => candidate.id === targetId)
    ?? CENTAUR_CHARGE_TARGETS[0];
  const actor = createCentaurActor(race);
  const target = createCentaurTarget(targetFixture);
  const characters = [actor, target].filter((character): character is CombatCharacter => character !== null);
  const usable = actor !== null && target !== null && hasCanonicalCentaurRules(race);
  return {
    characters,
    outcome: usable
      ? `Ready: ${actor.name}; Speed ${actor.stats.speed} ft; Move ${actor.actionEconomy.movement.used}/${actor.actionEconomy.movement.total}; Action ready; Bonus Action ready; target HP ${target.currentHP}/${target.maxHP}.`
      : 'Centaur Charge unavailable: canonical Centaur traits or production assembly are incomplete.',
    lastResolution: null,
  };
}

// ============================================================================
// Centaur Leaf UI
// ============================================================================
// The controls expose canonical text, actor/resource facts, native transaction
// results, and the exact unsupported boundaries. Parent Reset remounts this
// keyed content so target selection, position, resources, and HP cannot leak.
// ============================================================================

const CentaurRaceLeafContent: React.FC<RaceDomainLeafProps> = ({ race, onScenarioEvent }) => {
  const [targetId, setTargetId] = useState<CentaurChargeTargetId>('legal');
  const [scenario, setScenario] = useState(() => createCentaurChargeScenario(race));
  const actor = getActor(scenario);
  const target = getTarget(scenario);
  const targetOption = CENTAUR_CHARGE_TARGETS.find(candidate => candidate.id === targetId);
  const speedTrait = getCanonicalCentaurSpeedTrait(race);
  const chargeTrait = getCanonicalCentaurChargeTrait(race);
  const hoovesTrait = getCanonicalCentaurHoovesTrait(race);

  const handleResolve = () => {
    const nextScenario = resolveCentaurCharge(scenario, targetId);
    setScenario(nextScenario);
    const result = nextScenario.lastResolution;
    onScenarioEvent(result?.reason === 'charge_resolved'
      ? `Centaur CHARGE RESOLVED: ${result.movementFeet} ft; Action and Hooves Bonus Action paid; target HP ${getTarget(nextScenario)?.currentHP ?? 'unknown'}.`
      : `Centaur CHARGE ${result?.reason?.toUpperCase() ?? 'UNAVAILABLE'}: ${nextScenario.outcome}`);
  };

  return (
    <section aria-labelledby="centaur-charge-title" data-testid="centaur-race-leaf">
      {/* The heading names the canonical multi-step trait for assistive tools. */}
      <h4 id="centaur-charge-title">Centaur · Charge and Hooves</h4>
      <p data-testid="centaur-canonical-speed">Canonical: {speedTrait ?? 'Speed trait missing'}</p>
      <p data-testid="centaur-canonical-charge">Canonical: {chargeTrait ?? 'Charge trait missing'}</p>
      <p data-testid="centaur-canonical-hooves">Canonical: {hoovesTrait ?? 'Hooves trait missing'}</p>

      {/* The selector changes only authored positions; native helpers decide legality. */}
      <label htmlFor={CENTAUR_CHARGE_TARGET_CONTROL_ID}>Charge path</label>
      <select
        id={CENTAUR_CHARGE_TARGET_CONTROL_ID}
        value={targetId}
        onChange={event => setTargetId(event.target.value as CentaurChargeTargetId)}
      >
        {CENTAUR_CHARGE_TARGETS.map(option => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      <Button type="button" onClick={handleResolve}>Resolve Centaur Charge</Button>

      {/* These facts expose production assembly and shared resource payment. */}
      <p data-testid="centaur-actor-facts">
        Actor: {actor?.name ?? 'missing'}; Position {actor?.position.x},{actor?.position.y}; Speed {actor?.stats.speed ?? 'unknown'} ft; Move {actor?.actionEconomy.movement.used ?? 'unknown'}/{actor?.actionEconomy.movement.total ?? 'unknown'}; Action {actor?.actionEconomy.action.used ? 'used' : 'ready'}; Bonus Action {actor?.actionEconomy.bonusAction.used ? 'used' : 'ready'}; Strength modifier {actor ? getStrengthModifier(actor) : 'unknown'}.
      </p>
      <p data-testid="centaur-target-facts">
        Target: {targetOption?.label ?? 'missing'}; Position {targetOption?.targetPosition.x},{targetOption?.targetPosition.y}; HP {target?.currentHP ?? 'unknown'}/{target?.maxHP ?? 'unknown'}; AC {target?.armorClass ?? CENTAUR_TARGET_AC}.
      </p>
      <p aria-live="polite" role="status" data-testid="centaur-outcome">{scenario.outcome}</p>

      {/* This is the exact current production gap, not a hidden success claim. */}
      <p data-testid="centaur-unsupported-boundary">
        Unsupported boundary: the production bridge has no Centaur-aware Charge resolver that derives the trigger from race data. This leaf proves the representative 30-foot straight movement, melee hit, Hooves attack, native movement/attack/damage/Action/Bonus Action bookkeeping, and keyed Reset through a narrow adapter; it does not claim Equine Build carrying/climbing rules, Natural Affinity skill choice, opportunity-attack handling, mounted movement, or mounted 2D/3D render proof.
      </p>
    </section>
  );
};

// Parent Reset increments resetCount. A keyed boundary restores the authored
// path, actor position, movement pool, Action, Bonus Action, target HP, and log baseline.
export const CentaurRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <CentaurRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />
);

// Automatic discovery requires this exact named registration export. Both ids
// intentionally stay canonical and local; no shared registry edit is needed.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'centaur',
  raceId: 'centaur',
  label: 'Centaur',
  description: 'Resolve the canonical 30-foot Charge sequence through native movement, attack, damage, and action-economy helpers while exposing unsupported race-aware boundaries.',
  Component: CentaurRaceLeaf,
};

export default RACE_DOMAIN_LEAF;

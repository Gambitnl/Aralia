import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { CENTAUR_DATA } from '../../../../../../data/races/centaur';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  CENTAUR_ACTOR_ID,
  CENTAUR_HOOVES_DAMAGE_DICE,
  CENTAUR_MIN_CHARGE_FEET,
  CENTAUR_TARGET_ID,
  CentaurRaceLeaf,
  createCentaurChargeScenario,
  getCanonicalCentaurChargeTrait,
  getCanonicalCentaurHoovesTrait,
  getCanonicalCentaurSpeedFeet,
  hasCanonicalCentaurRules,
  resolveCentaurCharge,
  RACE_DOMAIN_LEAF,
} from '../centaurRaceLeaf';

/**
 * This file proves that the Centaur Race leaf stays linked to canonical rule
 * text and that its deterministic Charge adapter performs native movement,
 * attack, damage, and action-economy work without claiming absent runtime
 * Charge, Equine Build, or mounted-render mechanics.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, the Race registry discovery seam, and the Centaur
 * leaf's production assembly and immutable Charge transaction.
 */

// ============================================================================
// Canonical Identity And Discovery
// ============================================================================
// These checks prevent a plausible-looking preview from drifting away from
// the active Centaur record or automatic leaves/ discovery contract.
// ============================================================================

describe('Centaur Race domain leaf', () => {
  it('exports the canonical Centaur identity and representative trait facts', () => {
    expect(ACTIVE_RACES.some(race => race.id === 'centaur')).toBe(true);
    expect(RACE_DOMAIN_LEAF.id).toBe('centaur');
    expect(RACE_DOMAIN_LEAF.raceId).toBe('centaur');
    expect(RACE_DOMAIN_LEAF.label).toBe('Centaur');
    expect(RACE_DOMAIN_LEAF.Component).toBe(CentaurRaceLeaf);
    expect(hasCanonicalCentaurRules(CENTAUR_DATA)).toBe(true);
    expect(getCanonicalCentaurSpeedFeet(CENTAUR_DATA)).toBe(40);
    expect(getCanonicalCentaurChargeTrait(CENTAUR_DATA)).toContain('at least 30 feet straight');
    expect(getCanonicalCentaurHoovesTrait(CENTAUR_DATA)).toContain('1d6 + your Strength modifier');
    expect(CENTAUR_HOOVES_DAMAGE_DICE).toBe('1d6');
  });

  it('is discovered for centaur by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    expect(registry.getLeavesForRace('centaur')).toEqual([RACE_DOMAIN_LEAF]);
  });

  // ========================================================================
  // Native-Helper Charge Transaction And Atomic Limits
  // ========================================================================
  // The legal path must pay movement, Action, and Bonus Action while applying
  // both native damage transitions. Illegal paths must return the same state.
  // ========================================================================

  it('resolves 30 ft straight movement, melee hit, and Hooves Bonus Action atomically', () => {
    const baseline = createCentaurChargeScenario(CENTAUR_DATA, 'legal');
    const actor = baseline.characters.find(character => character.id === CENTAUR_ACTOR_ID)!;
    const target = baseline.characters.find(character => character.id === CENTAUR_TARGET_ID)!;
    const resolved = resolveCentaurCharge(baseline, 'legal');
    const resolvedActor = resolved.characters.find(character => character.id === CENTAUR_ACTOR_ID)!;
    const resolvedTarget = resolved.characters.find(character => character.id === CENTAUR_TARGET_ID)!;

    expect(actor.stats.speed).toBe(40);
    expect(actor.actionEconomy.movement.total).toBe(40);
    expect(resolved.lastResolution).toMatchObject({
      status: 'resolved',
      reason: 'charge_resolved',
      movementFeet: CENTAUR_MIN_CHARGE_FEET,
      meleeDistanceFeet: 5,
      movementPaid: true,
      actionPaid: true,
      bonusActionPaid: true,
      chargeDamage: 5,
      // The native actor supplies the Strength modifier for canonical 1d6 + Str.
      hoovesDamage: 4 + Math.floor((actor.stats.strength - 10) / 2),
    });
    expect(resolvedActor.position).toEqual({ x: 7, y: 2 });
    expect(resolvedActor.actionEconomy.movement.used).toBe(30);
    expect(resolvedActor.actionEconomy.action.used).toBe(true);
    expect(resolvedActor.actionEconomy.bonusAction.used).toBe(true);
    expect(target.currentHP).toBe(40);
    expect(resolvedTarget.currentHP).toBe(28);
    expect(resolved.outcome).toContain('30 ft straight');
    expect(resolved.outcome).toContain('Hooves');
  });

  it.each([
    ['short', 'charge_too_short'],
    ['off-axis', 'not_straight_toward_target'],
  ] as const)('rejects %s Charge path atomically before bookkeeping', (targetId, reason) => {
    const baseline = createCentaurChargeScenario(CENTAUR_DATA, targetId);
    const rejected = resolveCentaurCharge(baseline, targetId);
    const actor = rejected.characters.find(character => character.id === CENTAUR_ACTOR_ID)!;
    const target = rejected.characters.find(character => character.id === CENTAUR_TARGET_ID)!;

    expect(rejected.lastResolution?.reason).toBe(reason);
    expect(rejected.characters).toBe(baseline.characters);
    expect(actor.position).toEqual({ x: 1, y: 2 });
    expect(actor.actionEconomy.movement.used).toBe(0);
    expect(actor.actionEconomy.action.used).toBe(false);
    expect(actor.actionEconomy.bonusAction.used).toBe(false);
    expect(target.currentHP).toBe(40);
  });

  it('rejects when a resource is already used without partial Charge payment', () => {
    const baseline = createCentaurChargeScenario(CENTAUR_DATA, 'legal');
    const actor = baseline.characters.find(character => character.id === CENTAUR_ACTOR_ID)!;
    const spentAction = {
      ...actor,
      actionEconomy: {
        ...actor.actionEconomy,
        action: { ...actor.actionEconomy.action, used: true, remaining: 0 },
      },
    };
    const actionBlocked = {
      ...baseline,
      characters: baseline.characters.map(character => character.id === CENTAUR_ACTOR_ID ? spentAction : character),
    };
    const rejectedAction = resolveCentaurCharge(actionBlocked, 'legal');
    expect(rejectedAction.lastResolution?.reason).toBe('action_unavailable');
    expect(rejectedAction.characters).toBe(actionBlocked.characters);
    expect(rejectedAction.characters.find(character => character.id === CENTAUR_TARGET_ID)?.currentHP).toBe(40);

    const spentBonus = {
      ...actor,
      actionEconomy: {
        ...actor.actionEconomy,
        bonusAction: { ...actor.actionEconomy.bonusAction, used: true },
      },
    };
    const bonusBlocked = {
      ...baseline,
      characters: baseline.characters.map(character => character.id === CENTAUR_ACTOR_ID ? spentBonus : character),
    };
    const rejectedBonus = resolveCentaurCharge(bonusBlocked, 'legal');
    expect(rejectedBonus.lastResolution?.reason).toBe('bonus_action_unavailable');
    expect(rejectedBonus.characters).toBe(bonusBlocked.characters);
    expect(rejectedBonus.characters.find(character => character.id === CENTAUR_TARGET_ID)?.currentHP).toBe(40);
  });

  it('rejects insufficient movement without moving, attacking, or paying resources', () => {
    const baseline = createCentaurChargeScenario(CENTAUR_DATA, 'legal');
    const actor = baseline.characters.find(character => character.id === CENTAUR_ACTOR_ID)!;
    const movementLimitedActor = {
      ...actor,
      actionEconomy: {
        ...actor.actionEconomy,
        movement: { ...actor.actionEconomy.movement, total: 20 },
      },
    };
    const movementLimited = {
      ...baseline,
      characters: baseline.characters.map(character => character.id === CENTAUR_ACTOR_ID ? movementLimitedActor : character),
    };
    const rejected = resolveCentaurCharge(movementLimited, 'legal');

    expect(rejected.lastResolution?.reason).toBe('insufficient_movement');
    expect(rejected.characters).toBe(movementLimited.characters);
    expect(rejected.characters.find(character => character.id === CENTAUR_ACTOR_ID)?.position).toEqual({ x: 1, y: 2 });
    expect(rejected.characters.find(character => character.id === CENTAUR_ACTOR_ID)?.actionEconomy.action.used).toBe(false);
    expect(rejected.characters.find(character => character.id === CENTAUR_TARGET_ID)?.currentHP).toBe(40);
  });

  // ========================================================================
  // Visible Event, Reset, And Honest Boundary
  // ========================================================================
  // The component publishes the native result through the shell callback and
  // remounts from resetCount without pretending to provide a rendered map.
  // ========================================================================

  it('shows native facts, logs the result, restores on keyed Reset, and names the gap', () => {
    const events: string[] = [];
    const { rerender } = render(
      <CentaurRaceLeaf
        race={CENTAUR_DATA}
        state={createRaceDomainScenarioState(CENTAUR_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('centaur-canonical-charge')).toHaveTextContent('at least 30 feet straight');
    expect(screen.getByTestId('centaur-canonical-hooves')).toHaveTextContent('1d6 + your Strength modifier');
    expect(screen.getByTestId('centaur-actor-facts')).toHaveTextContent('Speed 40 ft');
    expect(screen.getByTestId('centaur-actor-facts')).toHaveTextContent('Move 0/40');
    expect(screen.getByTestId('centaur-unsupported-boundary')).toHaveTextContent('no Centaur-aware Charge resolver');

    fireEvent.click(screen.getByRole('button', { name: /resolve centaur charge/i }));

    expect(screen.getByTestId('centaur-outcome')).toHaveTextContent('Charge RESOLVED');
    expect(screen.getByTestId('centaur-actor-facts')).toHaveTextContent('Move 30/40');
    expect(screen.getByTestId('centaur-actor-facts')).toHaveTextContent('Action used');
    expect(screen.getByTestId('centaur-actor-facts')).toHaveTextContent('Bonus Action used');
    expect(screen.getByTestId('centaur-target-facts')).toHaveTextContent('HP 28/40');
    expect(events.at(-1)).toContain('Centaur CHARGE RESOLVED');

    rerender(
      <CentaurRaceLeaf
        race={CENTAUR_DATA}
        state={createRaceDomainScenarioState(CENTAUR_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('centaur-actor-facts')).toHaveTextContent('Position 1,2');
    expect(screen.getByTestId('centaur-actor-facts')).toHaveTextContent('Move 0/40');
    expect(screen.getByTestId('centaur-actor-facts')).toHaveTextContent('Action ready');
    expect(screen.getByTestId('centaur-target-facts')).toHaveTextContent('HP 40/40');
    expect(screen.getByTestId('centaur-unsupported-boundary')).toHaveTextContent('mounted 2D/3D render proof');
  });
});

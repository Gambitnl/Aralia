import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { FIRE_GIANT_GOLIATH_DATA } from '../../../../../../data/races/fire_giant_goliath';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  FIRE_GIANT_GOLIATH_FIRE_BURN_RESOURCE_ID,
  FireGiantGoliathRaceLeaf,
  createFireGiantGoliathFireBurnScenario,
  getCanonicalFireGiantGoliathFireBurnResource,
  getCanonicalFireGiantGoliathFireBurnTrait,
  hasCanonicalFireGiantGoliathFireBurn,
  prepareNextFireGiantGoliathTurn,
  RACE_DOMAIN_LEAF,
  resolveFireGiantGoliathFireBurn,
} from '../fireGiantGoliathRaceLeaf';

/**
 * This file proves that the Fire Giant Goliath leaf stays linked to canonical
 * Race data and that its bounded attack/rider transaction uses native d20,
 * damage, HP, action, and racial-resource seams. It deliberately makes no
 * mounted browser or 2D/3D rendering claim.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, automatic registry discovery, and the leaf's
 * exported production-assembly transaction helpers.
 */

// ============================================================================
// Canonical Identity And Discovery
// ============================================================================
// These checks prevent a plausible-looking preview from drifting away from
// the active Fire Giant Goliath record or automatic leaves/ discovery contract.
// ============================================================================

describe('Fire Giant Goliath Race domain leaf', () => {
  it('links to the active canonical race and preserves Fire\'s Burn facts', () => {
    const trait = getCanonicalFireGiantGoliathFireBurnTrait(FIRE_GIANT_GOLIATH_DATA);
    const resource = getCanonicalFireGiantGoliathFireBurnResource(FIRE_GIANT_GOLIATH_DATA);

    expect(ACTIVE_RACES.some(race => race.id === 'fire_giant_goliath')).toBe(true);
    expect(RACE_DOMAIN_LEAF.raceId).toBe('fire_giant_goliath');
    expect(RACE_DOMAIN_LEAF.label).toContain('Fire Giant Goliath');
    expect(hasCanonicalFireGiantGoliathFireBurn(FIRE_GIANT_GOLIATH_DATA)).toBe(true);
    expect(trait).toContain('extra 1d10 fire damage');
    expect(trait).toContain('Proficiency Bonus');
    expect(trait).toContain('Long Rest');
    expect(resource).toMatchObject({
      id: 'fire_giant_goliath__fire_s_burn__resource',
      maxUses: 'proficiency_bonus',
      resetOn: 'long_rest',
    });
    expect(FIRE_GIANT_GOLIATH_FIRE_BURN_RESOURCE_ID).toBe(
      'racial_feature_fire_giant_goliath__fire_s_burn__resource',
    );
  });

  it('is discovered for fire_giant_goliath by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    const leaves = registry.getLeavesForRace('fire_giant_goliath');

    expect(leaves).toContainEqual(RACE_DOMAIN_LEAF);
  });

  // ========================================================================
  // Native Attack, Rider, HP, Action, And Resource Transaction
  // ========================================================================
  // A level-5 Strength-16 actor derives +6. The fixed hit is 12 (18 vs AC 16),
  // base 1d8+3 is 8, and Fire's Burn 1d10 is 6.
  // ========================================================================

  it('assembles the production actor and resolves a hit with the optional rider', () => {
    const baseline = createFireGiantGoliathFireBurnScenario(FIRE_GIANT_GOLIATH_DATA);
    const actor = baseline.actor!;
    const target = baseline.target!;
    const resolved = resolveFireGiantGoliathFireBurn(baseline, 'hit', true);

    expect(actor.level).toBe(5);
    expect(actor.actionEconomy.action.used).toBe(false);
    expect(actor.limitedUses?.[FIRE_GIANT_GOLIATH_FIRE_BURN_RESOURCE_ID]).toMatchObject({
      current: 3,
      max: 'proficiency_bonus',
      resetOn: 'long_rest',
    });
    expect(resolved.lastResolution).toMatchObject({
      status: 'resolved',
      reason: 'hit',
      attackRoll: 12,
      attackTotal: 18,
      baseDamage: 8,
      fireDamage: 6,
      targetHpBefore: 40,
      targetHpAfter: 26,
      fireBurnUsed: true,
    });
    expect(resolved.actor?.actionEconomy.action.used).toBe(true);
    expect(resolved.actor?.limitedUses?.[FIRE_GIANT_GOLIATH_FIRE_BURN_RESOURCE_ID]?.current).toBe(2);
    expect(resolved.target?.currentHP).toBe(target.currentHP - 14);
  });

  it('keeps a miss and a declined rider atomic for Fire\'s Burn', () => {
    const missBaseline = createFireGiantGoliathFireBurnScenario(FIRE_GIANT_GOLIATH_DATA);
    const miss = resolveFireGiantGoliathFireBurn(missBaseline, 'miss', true);
    expect(miss.lastResolution).toMatchObject({
      reason: 'miss',
      baseDamage: 0,
      fireDamage: 0,
      fireBurnUsed: false,
      targetHpAfter: 40,
    });
    expect(miss.actor?.actionEconomy.action.used).toBe(true);
    expect(miss.actor?.limitedUses?.[FIRE_GIANT_GOLIATH_FIRE_BURN_RESOURCE_ID]?.current).toBe(3);

    const declineBaseline = createFireGiantGoliathFireBurnScenario(FIRE_GIANT_GOLIATH_DATA);
    const decline = resolveFireGiantGoliathFireBurn(declineBaseline, 'hit', false);
    expect(decline.lastResolution).toMatchObject({
      reason: 'burn_declined',
      baseDamage: 8,
      fireDamage: 0,
      fireBurnUsed: false,
      targetHpAfter: 32,
    });
    expect(decline.actor?.limitedUses?.[FIRE_GIANT_GOLIATH_FIRE_BURN_RESOURCE_ID]?.current).toBe(3);
  });

  it('exhausts exactly PB charges and rejects further rider use without underflow', () => {
    let scenario = createFireGiantGoliathFireBurnScenario(FIRE_GIANT_GOLIATH_DATA);

    // Each legal attack is a new native turn; only the racial resource persists.
    for (let index = 0; index < 3; index += 1) {
      scenario = resolveFireGiantGoliathFireBurn(scenario, 'hit', true);
      if (index < 2) scenario = prepareNextFireGiantGoliathTurn(scenario);
    }
    expect(scenario.actor?.limitedUses?.[FIRE_GIANT_GOLIATH_FIRE_BURN_RESOURCE_ID]?.current).toBe(0);

    scenario = prepareNextFireGiantGoliathTurn(scenario);
    const exhausted = resolveFireGiantGoliathFireBurn(scenario, 'hit', true);
    expect(exhausted.lastResolution).toMatchObject({
      reason: 'burn_exhausted',
      baseDamage: 8,
      fireDamage: 0,
      fireBurnUsed: false,
    });
    expect(exhausted.actor?.limitedUses?.[FIRE_GIANT_GOLIATH_FIRE_BURN_RESOURCE_ID]?.current).toBe(0);
  });

  it('rejects a second attack before payment when the Action is unavailable', () => {
    const baseline = createFireGiantGoliathFireBurnScenario(FIRE_GIANT_GOLIATH_DATA);
    const spent = resolveFireGiantGoliathFireBurn(baseline, 'hit', false);
    const rejected = resolveFireGiantGoliathFireBurn(spent, 'hit', true);

    expect(rejected.lastResolution?.reason).toBe('action_unavailable');
    expect(rejected.actor).toBe(spent.actor);
    expect(rejected.target).toBe(spent.target);
    expect(rejected.actor?.limitedUses?.[FIRE_GIANT_GOLIATH_FIRE_BURN_RESOURCE_ID]?.current).toBe(3);
  });

  // ========================================================================
  // Visible Event, Reset, Facts, And Honest Boundaries
  // ========================================================================
  // The component publishes native outcomes, remounts on parent Reset, and
  // keeps Large Form/Powerful Build visibly factual rather than executable.
  // ========================================================================

  it('shows HP/resource/action/facts, logs outcomes, resets, and names boundaries', () => {
    const events: string[] = [];
    const { rerender } = render(
      <FireGiantGoliathRaceLeaf
        race={FIRE_GIANT_GOLIATH_DATA}
        state={createRaceDomainScenarioState(FIRE_GIANT_GOLIATH_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('fire-giant-goliath-canonical-trait')).toHaveTextContent('extra 1d10 fire damage');
    expect(screen.getByTestId('fire-giant-goliath-actor')).toHaveTextContent('HP');
    expect(screen.getByTestId('fire-giant-goliath-actor')).toHaveTextContent('Action ready');
    expect(screen.getByTestId('fire-giant-goliath-actor')).toHaveTextContent('Uses 3/3');
    expect(screen.getByTestId('fire-giant-goliath-target')).toHaveTextContent('HP 40/40');
    expect(screen.getByTestId('fire-giant-goliath-giant-facts')).toHaveTextContent('Large Form');
    expect(screen.getByTestId('fire-giant-goliath-giant-facts')).toHaveTextContent('Powerful Build');

    fireEvent.click(screen.getByRole('button', { name: /resolve hit with fire's burn/i }));
    expect(screen.getByTestId('fire-giant-goliath-outcome')).toHaveTextContent('base 8');
    expect(screen.getByTestId('fire-giant-goliath-actor')).toHaveTextContent('Uses 2/3');
    expect(screen.getByTestId('fire-giant-goliath-target')).toHaveTextContent('HP 26/40');
    expect(events.at(-1)).toContain("Fire Giant Goliath FIRE'S BURN");

    rerender(
      <FireGiantGoliathRaceLeaf
        race={FIRE_GIANT_GOLIATH_DATA}
        state={createRaceDomainScenarioState(FIRE_GIANT_GOLIATH_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('fire-giant-goliath-actor')).toHaveTextContent('HP');
    expect(screen.getByTestId('fire-giant-goliath-actor')).toHaveTextContent('Action ready');
    expect(screen.getByTestId('fire-giant-goliath-actor')).toHaveTextContent('Uses 3/3');
    expect(screen.getByTestId('fire-giant-goliath-target')).toHaveTextContent('HP 40/40');
    expect(screen.getByTestId('fire-giant-goliath-assembly-boundary')).toHaveTextContent('does not currently project racial resources');
    expect(screen.getByTestId('fire-giant-goliath-unsupported-boundary')).toHaveTextContent('does not implement Large Form size');
    expect(screen.getByTestId('fire-giant-goliath-unsupported-boundary')).toHaveTextContent('mounted 2D/3D proof');
  });
});

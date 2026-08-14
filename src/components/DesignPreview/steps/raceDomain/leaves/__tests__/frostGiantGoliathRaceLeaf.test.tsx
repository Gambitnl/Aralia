import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { FROST_GIANT_GOLIATH_DATA } from '../../../../../../data/races/frost_giant_goliath';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  advanceFrostGiantGoliathTurn,
  FROST_GIANT_GOLIATH_FROSTS_CHILL_RESOURCE_ID,
  FrostGiantGoliathRaceLeaf,
  createFrostGiantGoliathFrostsChillScenario,
  getCanonicalFrostGiantGoliathFrostsChillResource,
  getCanonicalFrostGiantGoliathFrostsChillTrait,
  getCanonicalFrostGiantGoliathLargeFormTrait,
  getCanonicalFrostGiantGoliathPowerfulBuildTrait,
  hasCanonicalFrostGiantGoliathFrostsChill,
  RACE_DOMAIN_LEAF,
  resolveFrostGiantGoliathFrostsChill,
} from '../frostGiantGoliathRaceLeaf';

/**
 * This file proves that the Frost Giant Goliath leaf stays linked to canonical
 * Race data and that its bounded attack/rider transaction uses native d20,
 * damage, HP, Action, resource, movement, and paired status seams. It also
 * proves the explicit next-turn expiry control without claiming mounted UI.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, automatic registry discovery, canonical Frost
 * Giant Goliath data, and the leaf's production-assembly helpers.
 */

// ============================================================================
// Canonical Identity And Discovery
// ============================================================================
// These checks prevent a plausible-looking preview from drifting away from
// the active Frost Giant Goliath record or automatic leaves/ discovery.
// ============================================================================

describe('Frost Giant Goliath Race domain leaf', () => {
  it('links to the active canonical race and preserves Frost\'s Chill facts', () => {
    const trait = getCanonicalFrostGiantGoliathFrostsChillTrait(FROST_GIANT_GOLIATH_DATA);
    const resource = getCanonicalFrostGiantGoliathFrostsChillResource(FROST_GIANT_GOLIATH_DATA);

    expect(ACTIVE_RACES.some(race => race.id === 'frost_giant_goliath')).toBe(true);
    expect(RACE_DOMAIN_LEAF.raceId).toBe('frost_giant_goliath');
    expect(RACE_DOMAIN_LEAF.label).toContain('Frost Giant Goliath');
    expect(hasCanonicalFrostGiantGoliathFrostsChill(FROST_GIANT_GOLIATH_DATA)).toBe(true);
    expect(trait).toContain('extra 1d6 cold damage');
    expect(trait).toContain('reduce the target\'s speed by 10 feet');
    expect(trait).toContain('start of your next turn');
    expect(trait).toContain('Proficiency Bonus');
    expect(trait).toContain('Long Rest');
    expect(resource).toMatchObject({
      id: 'frost_giant_goliath__frost_s_chill__resource',
      maxUses: 'proficiency_bonus',
      resetOn: 'long_rest',
    });
    expect(FROST_GIANT_GOLIATH_FROSTS_CHILL_RESOURCE_ID).toBe(
      'racial_feature_frost_giant_goliath__frost_s_chill__resource',
    );
    expect(getCanonicalFrostGiantGoliathLargeFormTrait(FROST_GIANT_GOLIATH_DATA)).toContain('change your size to Large');
    expect(getCanonicalFrostGiantGoliathPowerfulBuildTrait(FROST_GIANT_GOLIATH_DATA)).toContain('carrying capacity');
  });

  it('is discovered for frost_giant_goliath by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    const leaves = registry.getLeavesForRace('frost_giant_goliath');

    expect(leaves).toContainEqual(RACE_DOMAIN_LEAF);
  });

  // ========================================================================
  // Native Attack, Rider, HP, Action, Resource, And Movement Transaction
  // ========================================================================
  // The level-5 Strength-16 actor derives +6. The fixed hit is 12 (18 vs AC
  // 16), base 1d8+3 is 8, and Frost's Chill 1d6 is 4.
  // ========================================================================

  it('assembles production state and resolves a hit with cold damage and slow', () => {
    const baseline = createFrostGiantGoliathFrostsChillScenario(FROST_GIANT_GOLIATH_DATA);
    const resolved = resolveFrostGiantGoliathFrostsChill(baseline, 'hit', true);

    expect(baseline.actor?.stats.speed).toBe(35);
    expect(baseline.target?.stats.speed).toBe(30);
    expect(baseline.target?.actionEconomy.movement.total).toBe(30);
    expect(baseline.actor?.limitedUses?.[FROST_GIANT_GOLIATH_FROSTS_CHILL_RESOURCE_ID]).toMatchObject({
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
      coldDamage: 4,
      targetHpBefore: 40,
      targetHpAfter: 28,
      targetSpeedBefore: 30,
      targetSpeedAfter: 20,
      frostChillUsed: true,
      slowApplied: true,
    });
    expect(resolved.actor?.actionEconomy.action.used).toBe(true);
    expect(resolved.actor?.limitedUses?.[FROST_GIANT_GOLIATH_FROSTS_CHILL_RESOURCE_ID]?.current).toBe(2);
    expect(resolved.target?.stats.speed).toBe(30);
    expect(resolved.target?.actionEconomy.movement.total).toBe(20);
    expect(resolved.target?.statusEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Frost's Chill Slow", source: "Frost's Chill" }),
    ]));
    expect(resolved.target?.conditions).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Frost's Chill Slow", source: "Frost's Chill" }),
    ]));
  });

  it('keeps miss and declined rider atomic for Frost\'s Chill', () => {
    const missBaseline = createFrostGiantGoliathFrostsChillScenario(FROST_GIANT_GOLIATH_DATA);
    const miss = resolveFrostGiantGoliathFrostsChill(missBaseline, 'miss', true);
    expect(miss.lastResolution).toMatchObject({
      reason: 'miss',
      baseDamage: 0,
      coldDamage: 0,
      frostChillUsed: false,
      targetHpAfter: 40,
      targetSpeedAfter: 30,
    });
    expect(miss.actor?.actionEconomy.action.used).toBe(true);
    expect(miss.actor?.limitedUses?.[FROST_GIANT_GOLIATH_FROSTS_CHILL_RESOURCE_ID]?.current).toBe(3);

    const declineBaseline = createFrostGiantGoliathFrostsChillScenario(FROST_GIANT_GOLIATH_DATA);
    const decline = resolveFrostGiantGoliathFrostsChill(declineBaseline, 'hit', false);
    expect(decline.lastResolution).toMatchObject({
      reason: 'chill_declined',
      baseDamage: 8,
      coldDamage: 0,
      frostChillUsed: false,
      targetHpAfter: 32,
      targetSpeedAfter: 30,
    });
    expect(decline.actor?.limitedUses?.[FROST_GIANT_GOLIATH_FROSTS_CHILL_RESOURCE_ID]?.current).toBe(3);
  });

  it('uses exactly PB charges and rejects further rider use without underflow', () => {
    let scenario = createFrostGiantGoliathFrostsChillScenario(FROST_GIANT_GOLIATH_DATA);

    // Each legal attack is a new actor turn; only the long-rest resource persists.
    for (let index = 0; index < 3; index += 1) {
      scenario = resolveFrostGiantGoliathFrostsChill(scenario, 'hit', true);
      scenario = advanceFrostGiantGoliathTurn(scenario);
    }
    expect(scenario.actor?.limitedUses?.[FROST_GIANT_GOLIATH_FROSTS_CHILL_RESOURCE_ID]?.current).toBe(0);

    const exhausted = resolveFrostGiantGoliathFrostsChill(scenario, 'hit', true);
    expect(exhausted.lastResolution).toMatchObject({
      reason: 'chill_exhausted',
      baseDamage: 8,
      coldDamage: 0,
      frostChillUsed: false,
      slowApplied: false,
    });
    expect(exhausted.actor?.limitedUses?.[FROST_GIANT_GOLIATH_FROSTS_CHILL_RESOURCE_ID]?.current).toBe(0);
    expect(exhausted.target?.actionEconomy.movement.total).toBe(30);
  });

  it('rejects a second attack before payment when the Action is unavailable', () => {
    const baseline = createFrostGiantGoliathFrostsChillScenario(FROST_GIANT_GOLIATH_DATA);
    const spent = resolveFrostGiantGoliathFrostsChill(baseline, 'hit', false);
    const rejected = resolveFrostGiantGoliathFrostsChill(spent, 'hit', true);

    expect(rejected.lastResolution?.reason).toBe('action_unavailable');
    expect(rejected.actor).toBe(spent.actor);
    expect(rejected.target).toBe(spent.target);
    expect(rejected.actor?.limitedUses?.[FROST_GIANT_GOLIATH_FROSTS_CHILL_RESOURCE_ID]?.current).toBe(3);
  });

  // ========================================================================
  // Native Expiry, Visible Event, Reset, Facts, And Boundaries
  // ========================================================================
  // Expiry calls shared owned removal, while the component publishes the same
  // result and remounts from resetCount without claiming mounted proof.
  // ========================================================================

  it('removes the owned slow at the actor next-turn boundary without refunding the charge', () => {
    const active = resolveFrostGiantGoliathFrostsChill(
      createFrostGiantGoliathFrostsChillScenario(FROST_GIANT_GOLIATH_DATA),
      'hit',
      true,
    );
    const expired = advanceFrostGiantGoliathTurn(active);

    expect(expired.lastResolution).toMatchObject({
      status: 'resolved',
      reason: 'slow_expired',
      targetSpeedBefore: 20,
      targetSpeedAfter: 30,
    });
    expect(expired.target?.stats.speed).toBe(30);
    expect(expired.target?.actionEconomy.movement.total).toBe(30);
    expect(expired.target?.statusEffects).toEqual([]);
    expect(expired.target?.conditions).toEqual([]);
    expect(expired.actor?.actionEconomy.action.used).toBe(false);
    expect(expired.actor?.limitedUses?.[FROST_GIANT_GOLIATH_FROSTS_CHILL_RESOURCE_ID]?.current).toBe(2);
  });

  it('shows HP/speed/resource/economy/facts, logs outcomes, resets, and names boundaries', () => {
    const events: string[] = [];
    const { rerender } = render(
      <FrostGiantGoliathRaceLeaf
        race={FROST_GIANT_GOLIATH_DATA}
        state={createRaceDomainScenarioState(FROST_GIANT_GOLIATH_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('frost-giant-goliath-canonical-trait')).toHaveTextContent('extra 1d6 cold damage');
    expect(screen.getByTestId('frost-giant-goliath-actor')).toHaveTextContent('HP');
    expect(screen.getByTestId('frost-giant-goliath-actor')).toHaveTextContent('Speed 35 ft');
    expect(screen.getByTestId('frost-giant-goliath-actor')).toHaveTextContent('Move 0/35');
    expect(screen.getByTestId('frost-giant-goliath-actor')).toHaveTextContent('Action ready');
    expect(screen.getByTestId('frost-giant-goliath-actor')).toHaveTextContent('Uses 3/3');
    expect(screen.getByTestId('frost-giant-goliath-target')).toHaveTextContent('HP 40/40');
    expect(screen.getByTestId('frost-giant-goliath-target')).toHaveTextContent('Effective Speed 30 ft');
    expect(screen.getByTestId('frost-giant-goliath-giant-facts')).toHaveTextContent('Large Form');
    expect(screen.getByTestId('frost-giant-goliath-giant-facts')).toHaveTextContent('Powerful Build');

    fireEvent.click(screen.getByRole('button', { name: /resolve hit with frost's chill/i }));
    expect(screen.getByTestId('frost-giant-goliath-outcome')).toHaveTextContent('cold');
    expect(screen.getByTestId('frost-giant-goliath-actor')).toHaveTextContent('Uses 2/3');
    expect(screen.getByTestId('frost-giant-goliath-target')).toHaveTextContent('HP 28/40');
    expect(screen.getByTestId('frost-giant-goliath-target')).toHaveTextContent('Effective Speed 20 ft');
    expect(events.at(-1)).toContain("Frost Giant Goliath FROST'S CHILL");

    fireEvent.click(screen.getByRole('button', { name: /advance actor next turn/i }));
    expect(screen.getByTestId('frost-giant-goliath-target')).toHaveTextContent('Effective Speed 30 ft');
    expect(events.at(-1)).toContain('Frost Giant Goliath TURN');

    rerender(
      <FrostGiantGoliathRaceLeaf
        race={FROST_GIANT_GOLIATH_DATA}
        state={createRaceDomainScenarioState(FROST_GIANT_GOLIATH_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('frost-giant-goliath-actor')).toHaveTextContent('Action ready');
    expect(screen.getByTestId('frost-giant-goliath-actor')).toHaveTextContent('Uses 3/3');
    expect(screen.getByTestId('frost-giant-goliath-target')).toHaveTextContent('HP 40/40');
    expect(screen.getByTestId('frost-giant-goliath-assembly-boundary')).toHaveTextContent('does not currently project racial resources');
    expect(screen.getByTestId('frost-giant-goliath-unsupported-boundary')).toHaveTextContent('mounted actor turn-event bus is not claimed');
  });
});

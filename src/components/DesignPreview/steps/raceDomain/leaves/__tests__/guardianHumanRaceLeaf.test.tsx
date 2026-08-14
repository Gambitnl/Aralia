import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { MARK_OF_SENTINEL_HUMAN_DATA as GUARDIAN_HUMAN_DATA } from '../../../../../../data/races/guardian_human';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  createGuardianHumanScenario,
  createGuardianHumanDeterministicRng,
  GuardianHumanRaceLeaf,
  getCanonicalGuardianHumanSentinelRider,
  getCanonicalGuardianHumanSentinelSkills,
  getCanonicalGuardianHumanSentinelTrait,
  hasCanonicalGuardianHumanFeatures,
  resolveGuardianHumanSentinelIntuition,
  RACE_DOMAIN_LEAF,
  GUARDIAN_HUMAN_ACTOR_ID,
} from '../guardianHumanRaceLeaf';

/**
 * This file proves the Guardian Human leaf against canonical race data,
 * automatic discovery, production actor assembly, and native check/dice
 * helpers. It also proves the visible receipt, reset, and explicit unsupported
 * mechanics boundary; mounted 2D/3D proof remains outside this focused suite.
 */

// ============================================================================
// Canonical Linkage And Automatic Discovery
// ============================================================================
// These assertions prevent a plausible-looking panel from drifting away from
// ACTIVE_RACES or the authored Sentinel's Intuition feature.
// ============================================================================

describe('Guardian Human Race domain leaf', () => {
  it('exports exactly one discoverable registration linked to ACTIVE_RACES', () => {
    const guardianHuman = ACTIVE_RACES.find(race => race.id === 'guardian_human');
    expect(guardianHuman).toBeDefined();

    const discovered = createRaceDomainRegistry(ACTIVE_RACES)
      .getLeavesForRace('guardian_human');

    expect(discovered).toHaveLength(1);
    expect(RACE_DOMAIN_LEAF.id).toBe('guardian-human-sentinels-intuition');
    expect(RACE_DOMAIN_LEAF.label).toContain('Guardian Human');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(guardianHuman?.id);
    expect(RACE_DOMAIN_LEAF.Component).toBe(GuardianHumanRaceLeaf);
    expect(discovered).toContainEqual(RACE_DOMAIN_LEAF);
  });

  it('links every requested fact and the scoped d4 rider to canonical data', () => {
    expect(GUARDIAN_HUMAN_DATA.id).toBe('guardian_human');
    expect(GUARDIAN_HUMAN_DATA.name).toBe('Guardian Human');
    expect(hasCanonicalGuardianHumanFeatures(GUARDIAN_HUMAN_DATA)).toBe(true);
    expect(getCanonicalGuardianHumanSentinelTrait(GUARDIAN_HUMAN_DATA)).toContain('Wisdom (Insight)');
    expect(getCanonicalGuardianHumanSentinelRider(GUARDIAN_HUMAN_DATA)).toMatch(/d4/i);
    expect(getCanonicalGuardianHumanSentinelSkills(GUARDIAN_HUMAN_DATA)).toEqual(['Insight', 'Perception']);
    expect(GUARDIAN_HUMAN_DATA.traits).toEqual(expect.arrayContaining([
      expect.stringContaining('Resourceful:'),
      expect.stringContaining('Skillful:'),
      expect.stringContaining('Versatile:'),
      expect.stringContaining("Guardian's Shield:"),
      expect.stringContaining('Vigilant Guardian:'),
      expect.stringContaining('Spells of the Mark:'),
    ]));
  });

  // ========================================================================
  // Production Assembly And Deterministic Native Checks
  // ========================================================================
  // The d4 and each d20 face are pinned through the shared dice parser and the
  // native check resolver, while the Arcana comparison receives no d4.
  // ========================================================================

  it('assembles the native actor and resolves Insight/Perception but not Arcana', () => {
    const baseline = createGuardianHumanScenario(GUARDIAN_HUMAN_DATA);
    expect(baseline.actor?.id).toBe(GUARDIAN_HUMAN_ACTOR_ID);
    expect(baseline.actor?.class.id).toBe('cleric');
    expect(baseline.actor?.finalAbilityScores.Wisdom).toBe(17);
    expect(baseline.actor?.modifiers?.bonuses).toContain('d4 to the ability check');
    expect(baseline.parsedSentinelRider).toBe('d4 to the ability check');

    // Insight d4/d20, Perception d4/d20, then Arcana d20.
    const resolved = resolveGuardianHumanSentinelIntuition(
      baseline,
      GUARDIAN_HUMAN_DATA,
      createGuardianHumanDeterministicRng(),
    );
    const results = resolved.lastResolutions ?? [];

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      id: 'insight', applies: true, d20Roll: 10, d4Roll: 3, baseTotal: 15, total: 18,
    });
    expect(results[1]).toMatchObject({
      id: 'perception', applies: true, d20Roll: 10, d4Roll: 3, baseTotal: 15, total: 18,
    });
    expect(results[2]).toMatchObject({
      id: 'arcana', applies: false, d20Roll: 10, d4Roll: null, baseTotal: 11, total: 11,
    });
    expect(resolved.outcome).toContain('Insight base 15 + d4 3 = 18');
    expect(resolved.outcome).toContain('Perception base 15 + d4 3 = 18');
    expect(resolved.outcome).toContain('Arcana base 11 + no d4 = 11');
  });

  // ========================================================================
  // Visible Receipt, Parent Reset, And Honest Boundaries
  // ========================================================================
  // The component must show the same native results it emits to the parent,
  // then return to its baseline when the parent increments resetCount.
  // ========================================================================

  it('shows facts, publishes the receipt, resets, and states unsupported boundaries', () => {
    const events: string[] = [];
    const { rerender } = render(
      <GuardianHumanRaceLeaf
        race={GUARDIAN_HUMAN_DATA}
        state={createRaceDomainScenarioState(GUARDIAN_HUMAN_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('guardian-human-sentinel-trait')).toHaveTextContent('roll a d4');
    expect(screen.getByTestId('guardian-human-actor')).toHaveTextContent('Class Cleric');
    expect(screen.getByTestId('guardian-human-facts')).toHaveTextContent('Resourceful:');
    expect(screen.getByTestId('guardian-human-facts')).toHaveTextContent("Guardian's Shield:");
    expect(screen.getByTestId('guardian-human-facts')).toHaveTextContent('Vigilant Guardian:');
    expect(screen.getByTestId('guardian-human-facts')).toHaveTextContent('Spells of the Mark:');
    expect(screen.getByTestId('guardian-human-check-results')).toHaveTextContent('No Sentinel\'s Intuition checks resolved yet');

    fireEvent.click(screen.getByRole('button', { name: /resolve sentinel's intuition checks/i }));

    expect(screen.getByTestId('guardian-human-insight-result')).toHaveTextContent('base 15');
    expect(screen.getByTestId('guardian-human-insight-result')).toHaveTextContent('canonical d4 bonus 3');
    expect(screen.getByTestId('guardian-human-perception-result')).toHaveTextContent('canonical d4 bonus 3');
    expect(screen.getByTestId('guardian-human-arcana-result')).toHaveTextContent('d4 not applicable');
    expect(screen.getByTestId('guardian-human-outcome')).toHaveTextContent('resolved through native checks');
    expect(events.at(-1)).toContain("Guardian Human SENTINEL'S INTUITION");
    expect(events.at(-1)).toMatch(/Arcana base \d+ \+ no d4 = \d+/);

    rerender(
      <GuardianHumanRaceLeaf
        race={GUARDIAN_HUMAN_DATA}
        state={createRaceDomainScenarioState(GUARDIAN_HUMAN_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('guardian-human-check-results')).toHaveTextContent('No Sentinel\'s Intuition checks resolved yet');
    expect(screen.getByTestId('guardian-human-boundary')).toHaveTextContent(/no fake choices/i);
    expect(screen.getByTestId('guardian-human-boundary')).toHaveTextContent(/reaction interception/i);
    expect(screen.getByTestId('guardian-human-boundary')).toHaveTextContent(/spell-list mutation/i);
    expect(screen.getByTestId('guardian-human-boundary')).toHaveTextContent(/native rollAbilityCheck/i);
    expect(screen.getByTestId('guardian-human-boundary')).toHaveTextContent(/Arcana receives no d4/i);
    expect(screen.getByTestId('guardian-human-boundary')).toHaveTextContent(/2D\/3D rendering/i);
  });
});

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { GITHYANKI_DATA } from '../../../../../../data/races/githyanki';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  createGithyankiPsychicScenario,
  GITHYANKI_PSYCHIC_RAW_DAMAGE,
  GithyankiRaceLeaf,
  getGithyankiCanonicalFacts,
  hasCanonicalGithyankiFacts,
  resolveGithyankiPsychicResilience,
  RACE_DOMAIN_LEAF,
} from '../githyankiRaceLeaf';

/**
 * This file proves that the Githyanki Race leaf stays linked to canonical
 * traits and that its Psychic Resilience transaction uses native helpers.
 *
 * Called by: focused and cumulative Vitest Race-domain checks.
 * Depends on: ACTIVE_RACES, the automatic registry, the canonical Githyanki
 * record, and the leaf's production actor and damage adapter.
 */

// ============================================================================
// Canonical Identity And Discovery
// ============================================================================
// These checks prevent a plausible-looking leaf from drifting away from the
// active race record or from the automatic leaves/ discovery contract.
// ============================================================================

describe('Githyanki Race domain leaf', () => {
  it('links to the active race and exposes the canonical fact set', () => {
    const facts = getGithyankiCanonicalFacts(GITHYANKI_DATA);

    expect(ACTIVE_RACES.some(race => race.id === 'githyanki')).toBe(true);
    expect(RACE_DOMAIN_LEAF.raceId).toBe('githyanki');
    expect(RACE_DOMAIN_LEAF.id).toBe('githyanki-psychic-resilience');
    expect(hasCanonicalGithyankiFacts(GITHYANKI_DATA)).toBe(true);
    expect(facts.astralKnowledge).toContain('long rest');
    expect(facts.githyankiPsionics).toContain('mage hand');
    expect(facts.psychicResilience).toContain('psychic damage');
    expect(facts.spellGates).toEqual([
      'Level 1: mage-hand',
      'Level 3: jump',
      'Level 5: misty-step',
    ]);
    expect(facts.spellAbilityChoice).toContain('Choose your spellcasting ability');
  });

  it('is discovered for githyanki by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    const leaves = registry.getLeavesForRace('githyanki');

    expect(leaves.some(leaf => leaf.id === RACE_DOMAIN_LEAF.id)).toBe(true);
  });

  // ========================================================================
  // Native Resistance And HP Transaction
  // ========================================================================
  // The parser assembles the defense, ResistanceCalculator halves the odd
  // psychic hit, and the shared HP helper owns the actual HP transition.
  // ========================================================================

  it('uses the production actor/parser and resolves raw 15 psychic to 7 HP damage', () => {
    const baseline = createGithyankiPsychicScenario(GITHYANKI_DATA);
    const resolved = resolveGithyankiPsychicResilience(baseline);

    expect(baseline.actor.id).toBe('githyanki-psychic-resilience-actor');
    expect(baseline.defenseBridge).toBe('narrow canonical defense adapter');
    expect(baseline.actor.resistances?.map(type => type.toLowerCase())).toContain('psychic');
    expect(resolved.resolution).toMatchObject({
      rawDamage: GITHYANKI_PSYCHIC_RAW_DAMAGE,
      finalDamage: 7,
      resistanceApplied: true,
      hitPointsAfter: baseline.actor.currentHP - 7,
    });
    expect(resolved.actor.currentHP).toBe(baseline.actor.currentHP - 7);
    expect(resolved.outcome).toContain('15 raw -> 7 Psychic');
  });

  it('repeats the same native transaction without losing the cumulative HP fact', () => {
    const baseline = createGithyankiPsychicScenario(GITHYANKI_DATA);
    const first = resolveGithyankiPsychicResilience(baseline);
    const repeated = resolveGithyankiPsychicResilience(first);

    expect(repeated.resolutionCount).toBe(2);
    expect(repeated.resolution?.finalDamage).toBe(7);
    expect(repeated.actor.currentHP).toBe(baseline.actor.currentHP - 14);
    expect(repeated.eventLog).toHaveLength(2);
    expect(repeated.eventLog[1]).toContain('Repeat 2');
  });

  // ========================================================================
  // Visible Receipt, Reset, And Honest Boundaries
  // ========================================================================
  // The component must show actor identity, HP, log, canonical facts, and the
  // unsupported rest/spell boundary while preserving the parent reset seam.
  // ========================================================================

  it('shows HP and log, resets the local transaction, and names unsupported mechanics', () => {
    const events: string[] = [];
    const { rerender } = render(
      <GithyankiRaceLeaf
        race={GITHYANKI_DATA}
        state={createRaceDomainScenarioState(GITHYANKI_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    const baselineHp = screen.getByTestId('githyanki-hp').textContent;
    expect(screen.getByTestId('githyanki-actor-facts')).toHaveTextContent('Level 5');
    expect(screen.getByTestId('githyanki-canonical-facts')).toHaveTextContent('Astral Knowledge');
    expect(screen.getByTestId('githyanki-canonical-facts')).toHaveTextContent('Level 5: misty-step');
    expect(screen.getByTestId('githyanki-unsupported-boundary')).toHaveTextContent('does not grant rest proficiencies');

    fireEvent.click(screen.getByRole('button', { name: /resolve 15 psychic damage/i }));
    expect(screen.getByTestId('githyanki-outcome')).toHaveTextContent('15 raw -> 7 Psychic');
    expect(screen.getByTestId('githyanki-event-log')).toHaveTextContent('HP');
    expect(events.at(-1)).toContain('Githyanki PSYCHIC RESILIENCE');

    fireEvent.click(screen.getByRole('button', { name: /repeat 15 psychic damage/i }));
    expect(screen.getByTestId('githyanki-event-log')).toHaveTextContent('Repeat 2');

    fireEvent.click(screen.getByRole('button', { name: /reset proof/i }));
    expect(screen.getByTestId('githyanki-hp').textContent).toBe(baselineHp);
    expect(screen.getByTestId('githyanki-event-log')).toHaveTextContent('No psychic damage transaction yet.');

    rerender(
      <GithyankiRaceLeaf
        race={GITHYANKI_DATA}
        state={createRaceDomainScenarioState(GITHYANKI_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );
    expect(screen.getByTestId('githyanki-event-log')).toHaveTextContent('No psychic damage transaction yet.');
    expect(screen.getByTestId('githyanki-defense-boundary')).toHaveTextContent('production racial parser');
  });
});

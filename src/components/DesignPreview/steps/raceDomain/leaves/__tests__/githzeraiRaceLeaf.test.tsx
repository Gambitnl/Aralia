import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { GITHZERAI_DATA } from '../../../../../../data/races/githzerai';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  applyGithzeraiMentalDisciplineContext,
  createGithzeraiScenario,
  getCanonicalGithzeraiTrait,
  getGithzeraiCanonicalFacts,
  getGithzeraiMentalDisciplineSaveAdapter,
  GithzeraiRaceLeaf,
  hasCanonicalGithzeraiFeatures,
  hasGithzeraiMentalDisciplineParserProjection,
  resolveGithzeraiMentalDiscipline,
  resolveGithzeraiPsychicResilience,
  RACE_DOMAIN_LEAF,
} from '../githzeraiRaceLeaf';

/**
 * This file proves that the Githzerai leaf stays linked to canonical race
 * data, uses production parsing and native save/damage helpers, and exposes
 * visible reset, logging, facts, and unsupported boundaries.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, the Race registry, canonical Githzerai data, and
 * the leaf's production-backed scenario helpers.
 */

// ============================================================================
// Canonical Identity And Discovery
// ============================================================================
// These checks prevent a plausible-looking leaf from drifting away from the
// active race record or automatic discovery contract.
// ============================================================================

describe('Githzerai Race domain leaf', () => {
  it('links identity and surfaced facts to canonical data', () => {
    const facts = getGithzeraiCanonicalFacts(GITHZERAI_DATA);

    expect(ACTIVE_RACES.some(race => race.id === 'githzerai')).toBe(true);
    expect(RACE_DOMAIN_LEAF.id).toBe('githzerai-mental-discipline');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(GITHZERAI_DATA.id);
    expect(RACE_DOMAIN_LEAF.label).toContain('Githzerai');
    expect(hasCanonicalGithzeraiFeatures(GITHZERAI_DATA)).toBe(true);
    expect(facts.psionics).toContain('mage hand');
    expect(facts.mentalDiscipline).toContain('charmed');
    expect(facts.mentalDiscipline).toContain('frightened');
    expect(facts.psychicResilience).toContain('psychic damage');
    expect(facts.spellGates).toEqual([
      'Level 1: mage-hand',
      'Level 3: shield',
      'Level 5: detect-thoughts',
    ]);
    expect(facts.spellAbilityChoice).toContain('Choose your spellcasting ability');
  });

  it('is discovered for githzerai by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    expect(registry.getLeavesForRace('githzerai')).toContainEqual(RACE_DOMAIN_LEAF);
  });

  // ========================================================================
  // Production Assembly And Native Advantage Comparison
  // ========================================================================
  // The parser owns the raw projection. The adapter narrows it to the two
  // canonical conditions, leaving the ordinary save as a true baseline.
  // ========================================================================

  it('assembles the production actor and exposes the parser-backed projection', () => {
    const scenario = createGithzeraiScenario(GITHZERAI_DATA);

    expect(scenario.actor?.id).toBe('githzerai-mental-discipline-actor');
    expect(scenario.actor?.level).toBe(5);
    expect(hasGithzeraiMentalDisciplineParserProjection(scenario.actor)).toBe(true);
    expect(getGithzeraiMentalDisciplineSaveAdapter(GITHZERAI_DATA, 'charmed')).toMatchObject({
      type: 'advantage',
      context: 'saving_throw',
      against: ['charmed'],
    });
    expect(getGithzeraiMentalDisciplineSaveAdapter(GITHZERAI_DATA, 'frightened')).toMatchObject({
      against: ['frightened'],
    });
  });

  it('compares ordinary, Charmed, and Frightened saves with deterministic native dice', () => {
    const scenario = createGithzeraiScenario(GITHZERAI_DATA);
    const randomValues = [0.15, 0.15, 0.75, 0.15, 0.75];
    const resolved = resolveGithzeraiMentalDiscipline(
      scenario,
      GITHZERAI_DATA,
      () => randomValues.shift() ?? 0.5,
    );

    expect(resolved.lastMentalDiscipline).toMatchObject({ status: 'resolved', reason: 'resolved' });
    expect(resolved.lastMentalDiscipline?.ordinary?.d20Rolls).toEqual([4]);
    expect(resolved.lastMentalDiscipline?.ordinary?.save.roll).toBe(4);
    expect(resolved.lastMentalDiscipline?.charmed?.d20Rolls).toEqual([4, 16]);
    expect(resolved.lastMentalDiscipline?.charmed?.save.roll).toBe(16);
    expect(resolved.lastMentalDiscipline?.frightened?.d20Rolls).toEqual([4, 16]);
    expect(resolved.lastMentalDiscipline?.frightened?.save.roll).toBe(16);
    expect(resolved.lastMentalDiscipline?.ordinary?.save.success).toBe(false);
    expect(resolved.lastMentalDiscipline?.charmed?.save.success).toBe(true);
    expect(resolved.lastMentalDiscipline?.frightened?.save.success).toBe(true);
    expect(resolved.outcome).toContain('Charmed kept 16');
    expect(resolved.outcome).toContain('Frightened kept 16');
  });

  it('strips only the parser projection from the ordinary baseline', () => {
    const scenario = createGithzeraiScenario(GITHZERAI_DATA);
    if (!scenario.actor) throw new Error('Expected the production Githzerai actor.');

    const ordinary = applyGithzeraiMentalDisciplineContext(scenario.actor);
    expect(hasGithzeraiMentalDisciplineParserProjection(scenario.actor)).toBe(true);
    expect(hasGithzeraiMentalDisciplineParserProjection(ordinary)).toBe(false);
    expect(getCanonicalGithzeraiTrait(GITHZERAI_DATA, 'Mental Discipline')).toContain('advantage');
  });

  // ========================================================================
  // Native Psychic Resistance Transaction
  // ========================================================================
  // The fixed odd damage amount proves the native resistance floor and HP
  // transition without inventing a spell cast or a visual combat scene.
  // ========================================================================

  it('resolves native Psychic Resilience from 15 raw damage to 7', () => {
    const baseline = createGithzeraiScenario(GITHZERAI_DATA);
    const resolved = resolveGithzeraiPsychicResilience(baseline);

    expect(baseline.actor?.resistances?.map(type => type.toLowerCase())).toContain('psychic');
    expect(resolved.lastPsychicResilience).toMatchObject({
      rawDamage: 15,
      finalDamage: 7,
      resistanceApplied: true,
      hitPointsAfter: (baseline.actor?.currentHP ?? 0) - 7,
    });
    expect(resolved.actor?.currentHP).toBe((baseline.actor?.currentHP ?? 0) - 7);
    expect(resolved.eventLog[0]).toContain('15 raw Psychic -> 7');
  });

  // ========================================================================
  // Visible Receipt, Reset, And Honest Boundaries
  // ========================================================================
  // The mounted proof checks callback logging and the keyed reset without
  // making a 2D or 3D render claim.
  // ========================================================================

  it('shows facts, logs both transactions, resets, and names unsupported mechanics', () => {
    const events: string[] = [];
    const { rerender } = render(
      <GithzeraiRaceLeaf
        race={GITHZERAI_DATA}
        state={createRaceDomainScenarioState(GITHZERAI_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('githzerai-actor-facts')).toHaveTextContent('parser projection native');
    expect(screen.getByTestId('githzerai-canonical-facts')).toHaveTextContent('mage hand');
    expect(screen.getByTestId('githzerai-canonical-facts')).toHaveTextContent('Level 3: shield');
    expect(screen.getByTestId('githzerai-canonical-facts')).toHaveTextContent('Level 5: detect-thoughts');
    expect(screen.getByTestId('githzerai-canonical-facts')).toHaveTextContent('Choose your spellcasting ability');

    fireEvent.click(screen.getByRole('button', { name: /resolve mental discipline saves/i }));
    fireEvent.click(screen.getByRole('button', { name: /resolve 15 psychic damage/i }));

    expect(screen.getByTestId('githzerai-save-result')).toHaveTextContent('Avoid/end Charmed');
    expect(screen.getByTestId('githzerai-save-result')).toHaveTextContent('Avoid/end Frightened');
    expect(screen.getByTestId('githzerai-save-result')).toHaveTextContent('advantage applied');
    expect(screen.getByTestId('githzerai-hp')).toHaveTextContent('last damage 15 -> 7');
    expect(screen.getByTestId('githzerai-event-log')).toHaveTextContent('Mental Discipline resolved');
    expect(screen.getByTestId('githzerai-event-log')).toHaveTextContent('15 raw Psychic -> 7');
    expect(events.at(-1)).toContain('Githzerai PSYCHIC RESILIENCE');

    rerender(
      <GithzeraiRaceLeaf
        race={GITHZERAI_DATA}
        state={createRaceDomainScenarioState(GITHZERAI_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('githzerai-save-result')).toHaveTextContent('No Mental Discipline save comparison resolved yet');
    expect(screen.getByTestId('githzerai-hp')).not.toHaveTextContent('last damage');
    expect(screen.getByTestId('githzerai-event-log')).toHaveTextContent('No Githzerai transaction yet');
    expect(screen.getByTestId('githzerai-boundary')).toHaveTextContent('canonical Charmed and Frightened effect tags');
    expect(screen.getByTestId('githzerai-boundary')).toHaveTextContent('does not apply or remove conditions');
    expect(screen.getByTestId('githzerai-boundary')).toHaveTextContent('does not cast Mage Hand, Shield, or Detect Thoughts');
    expect(screen.getByTestId('githzerai-boundary')).toHaveTextContent('choose Intelligence/Wisdom/Charisma');
    expect(screen.getByTestId('githzerai-boundary')).toHaveTextContent('2D/3D render proof');
  });
});

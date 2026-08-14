import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { MARK_OF_MAKING_HUMAN_DATA as FORGEBORN_HUMAN_DATA } from '../../../../../../data/races/forgeborn_human';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  createForgebornHumanArtisanScenario,
  ForgebornHumanRaceLeaf,
  getCanonicalForgebornHumanArcanaRider,
  getCanonicalForgebornHumanArtisanTrait,
  hasCanonicalForgebornHumanFeatures,
  resolveForgebornHumanArtisanIntuition,
  RACE_DOMAIN_LEAF,
  FORGEBORN_HUMAN_ACTOR_ID,
} from '../forgebornHumanRaceLeaf';

/**
 * This file proves that the Forgeborn Human leaf stays linked to canonical race
 * data, automatic discovery, production actor assembly, and native check/dice
 * helpers. It also proves the pinned d4 transaction, visible logging, reset,
 * facts-only traits, and the explicit parser adapter boundary.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, the Race registry, canonical Forgeborn Human data,
 * and the Forgeborn Human leaf transaction helpers.
 */

// ============================================================================
// Canonical Linkage And Discovery
// ============================================================================
// These checks prevent a plausible-looking panel from drifting from the active
// race record or automatic leaf discovery contract.
// ============================================================================

describe('Forgeborn Human Race domain leaf', () => {
  it('links identity and all requested facts to canonical data', () => {
    expect(ACTIVE_RACES.some(race => race.id === 'forgeborn_human')).toBe(true);
    expect(RACE_DOMAIN_LEAF.id).toBe('forgeborn-human-artisans-intuition');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(FORGEBORN_HUMAN_DATA.id);
    expect(hasCanonicalForgebornHumanFeatures(FORGEBORN_HUMAN_DATA)).toBe(true);
    expect(getCanonicalForgebornHumanArtisanTrait(FORGEBORN_HUMAN_DATA)).toContain('roll a d4');
    expect(getCanonicalForgebornHumanArcanaRider(FORGEBORN_HUMAN_DATA)).toBe('d4 to Arcana');
    expect(FORGEBORN_HUMAN_DATA.traits).toEqual(expect.arrayContaining([
      expect.stringContaining('Resourceful:'),
      expect.stringContaining('Skillful:'),
      expect.stringContaining('Versatile:'),
      expect.stringContaining("Maker's Gift:"),
      expect.stringContaining('Spellsmith:'),
      expect.stringContaining('Spells of the Mark:'),
    ]));
  });

  it('is discovered for forgeborn_human by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    const leaves = registry.getLeavesForRace('forgeborn_human');

    expect(leaves.some(leaf => leaf.id === RACE_DOMAIN_LEAF.id)).toBe(true);
  });

  // ========================================================================
  // Native Assembly And Deterministic Arcana Transaction
  // ========================================================================
  // The actor is production assembled. The separate d4 and d20 faces are
  // pinned through the shared dice parser and native check helper contract.
  // ========================================================================

  it('assembles the native actor and resolves the Arcana check with a pinned d4', () => {
    const baseline = createForgebornHumanArtisanScenario(FORGEBORN_HUMAN_DATA);
    expect(baseline.actor?.id).toBe(FORGEBORN_HUMAN_ACTOR_ID);
    expect(baseline.actor?.skills.some(skill => skill.id === 'arcana' && skill.proficient)).toBe(true);
    expect(baseline.parsedArcanaRider).toBe('d4 to Arcana');

    const randomValues = [0.5, 0.45];
    const resolved = resolveForgebornHumanArtisanIntuition(
      baseline,
      FORGEBORN_HUMAN_DATA,
      () => randomValues.shift() ?? 0.5,
    );

    expect(resolved.lastResolution).toMatchObject({
      status: 'resolved',
      reason: 'resolved',
      d20Roll: 10,
      d4Roll: 3,
      baseTotal: 15,
      total: 18,
    });
    expect(resolved.outcome).toContain('Arcana base 15 + d4 bonus 3 = 18');
  });

  // ========================================================================
  // Visible Event, Reset, Facts, And Explicit Boundary Proof
  // ========================================================================
  // The component must publish the result, restore baseline state on Reset,
  // and keep unsupported traits visible without pretending to execute them.
  // ========================================================================

  it('shows base/bonus/total, logs the result, resets, and states facts-only boundaries', () => {
    const events: string[] = [];
    const { rerender } = render(
      <ForgebornHumanRaceLeaf
        race={FORGEBORN_HUMAN_DATA}
        state={createRaceDomainScenarioState(FORGEBORN_HUMAN_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('forgeborn-human-artisan-trait')).toHaveTextContent('roll a d4');
    expect(screen.getByTestId('forgeborn-human-actor')).toHaveTextContent('Arcana) proficiency native');
    expect(screen.getByTestId('forgeborn-human-facts')).toHaveTextContent('Resourceful:');
    expect(screen.getByTestId('forgeborn-human-facts')).toHaveTextContent("Maker's Gift:");
    expect(screen.getByTestId('forgeborn-human-facts')).toHaveTextContent('Spellsmith:');
    expect(screen.getByTestId('forgeborn-human-facts')).toHaveTextContent('Spells of the Mark:');

    fireEvent.click(screen.getByRole('button', { name: /resolve artisan's intuition arcana check/i }));

    expect(screen.getByTestId('forgeborn-human-check-result')).toHaveTextContent('base');
    expect(screen.getByTestId('forgeborn-human-check-result')).toHaveTextContent('d4 bonus');
    expect(screen.getByTestId('forgeborn-human-check-result')).toHaveTextContent('total');
    expect(screen.getByTestId('forgeborn-human-outcome')).toHaveTextContent("Artisan's Intuition resolved");
    expect(events.at(-1)).toContain("Forgeborn Human ARTISAN'S INTUITION RESOLVED");

    rerender(
      <ForgebornHumanRaceLeaf
        race={FORGEBORN_HUMAN_DATA}
        state={createRaceDomainScenarioState(FORGEBORN_HUMAN_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('forgeborn-human-check-result')).toHaveTextContent('No Artisan\'s Intuition Arcana check resolved yet');
    expect(screen.getByTestId('forgeborn-human-boundary')).toHaveTextContent(/no fake choices/i);
    expect(screen.getByTestId('forgeborn-human-boundary')).toHaveTextContent(/no fake rest recovery/i);
    expect(screen.getByTestId('forgeborn-human-boundary')).toHaveTextContent(/no fake crafting/i);
    expect(screen.getByTestId('forgeborn-human-boundary')).toHaveTextContent(/no fake spell casts/i);
    expect(screen.getByTestId('forgeborn-human-boundary')).toHaveTextContent(/nested racial-bonus RNG is not injectable/i);
  });
});

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { calculatePathMovementCost } from '../../../../../../utils/combat/movementUtils';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  EARTH_GENASI_ACTOR_ID,
  EarthGenasiRaceLeaf,
  RACE_DOMAIN_LEAF,
  calculateEarthWalkPathMovementCost,
  createEarthGenasiPath,
  createEarthGenasiScenario,
  getCanonicalBladeWardUseLimit,
  getCanonicalEarthGenasiSpellAbilityChoices,
  getCanonicalEarthGenasiSpellProgression,
  getCanonicalEarthWalkTrait,
  getCanonicalMergeWithStoneTrait,
  getCanonicalPassWithoutTraceMinLevel,
  hasCanonicalEarthWalk,
  resolveEarthGenasiEarthWalk,
} from '../earthGenasiRaceLeaf';

/**
 * This file proves that the Earth Genasi leaf stays linked to canonical Race
 * data and that its deterministic Earth Walk adapter preserves native movement
 * and action-economy boundaries.
 *
 * It covers identity/discovery, difficult-terrain cost comparison, position and
 * economy payment, atomic rejection, reset/event UI evidence, and the honest
 * spell-only boundary. It does not claim mounted browser or 2D/3D render proof.
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, Race registry discovery, and the Earth Genasi leaf
 * exported test seams.
 */

// ============================================================================
// Canonical Identity And Discovery
// ============================================================================
// These assertions stop a plausible-looking preview from drifting away from
// the active Earth Genasi record or automatic leaves/ discovery contract.
// ============================================================================

describe('Earth Genasi Race domain leaf', () => {
  const earthGenasi = ACTIVE_RACES.find(race => race.id === 'earth_genasi')!;

  it('exports the canonical identity and automatic-discovery registration', () => {
    expect(RACE_DOMAIN_LEAF.id).toBe('earth-genasi-earth-walk');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(earthGenasi.id);
    expect(RACE_DOMAIN_LEAF.label).toContain('Earth Genasi');
    expect(RACE_DOMAIN_LEAF.Component).toBe(EarthGenasiRaceLeaf);
    expect(createRaceDomainRegistry(ACTIVE_RACES).getLeavesForRace('earth_genasi')).toEqual([RACE_DOMAIN_LEAF]);
  });

  it('reads Earth Walk and Merge with Stone facts from canonical data', () => {
    expect(hasCanonicalEarthWalk(earthGenasi)).toBe(true);
    expect(getCanonicalEarthWalkTrait(earthGenasi)).toContain('without expending extra movement');
    expect(getCanonicalMergeWithStoneTrait(earthGenasi)).toContain('Blade Ward');
    expect(getCanonicalEarthGenasiSpellProgression(earthGenasi)).toEqual([
      { minLevel: 1, spellId: 'blade-ward' },
      { minLevel: 5, spellId: 'pass-without-trace' },
    ]);
    expect(getCanonicalBladeWardUseLimit(earthGenasi)).toBe('proficiency_bonus');
    expect(getCanonicalPassWithoutTraceMinLevel(earthGenasi)).toBe(5);
    expect(getCanonicalEarthGenasiSpellAbilityChoices(earthGenasi)).toEqual([
      'Intelligence',
      'Wisdom',
      'or Charisma',
    ]);
  });

  // ========================================================================
  // Earth Walk Cost Comparison
  // ========================================================================
  // The legal three-square route is difficult terrain. Ordinary movement pays
  // 30 ft while Earth Walk preserves the 15 ft horizontal path distance.
  // ========================================================================

  it('removes only the difficult-terrain surcharge from the native path cost', () => {
    const path = createEarthGenasiPath(3);
    const ordinaryCost = calculatePathMovementCost([...path]);

    expect(ordinaryCost).toBe(30);
    expect(calculateEarthWalkPathMovementCost(path)).toBe(15);
  });

  it('resolves Earth Walk with position and movement bookkeeping only', () => {
    const baseline = createEarthGenasiScenario(earthGenasi);
    const resolved = resolveEarthGenasiEarthWalk(baseline, 'legal');
    const actor = resolved.actor!;

    expect(actor.id).toBe(EARTH_GENASI_ACTOR_ID);
    expect(resolved.resolution).toMatchObject({
      status: 'resolved',
      reason: 'earth_walk_resolved',
      ordinaryMovementFeet: 30,
      earthWalkMovementFeet: 15,
      movementSavedFeet: 15,
      endPosition: { x: 3, y: 0 },
    });
    expect(actor.position).toEqual({ x: 3, y: 0 });
    expect(actor.actionEconomy.movement.used).toBe(15);
    expect(actor.actionEconomy.movement.total).toBe(30);
    expect(actor.actionEconomy.action.used).toBe(false);
    expect(actor.actionEconomy.bonusAction.used).toBe(false);
  });

  it('rejects an over-budget Earth Walk path atomically', () => {
    const baseline = createEarthGenasiScenario(earthGenasi);
    const rejected = resolveEarthGenasiEarthWalk(baseline, 'over-budget');

    expect(rejected.resolution).toMatchObject({
      status: 'rejected',
      reason: 'insufficient_movement',
      earthWalkMovementFeet: 35,
    });
    expect(rejected.actor).toBe(baseline.actor);
    expect(rejected.actor?.position).toEqual({ x: 0, y: 0 });
    expect(rejected.actor?.actionEconomy.movement.used).toBe(0);
    expect(rejected.actor?.actionEconomy.action.used).toBe(false);
    expect(rejected.actor?.actionEconomy.bonusAction.used).toBe(false);
  });

  // ========================================================================
  // Visible Event, Reset, And Honest Spell Boundary
  // ========================================================================
  // The component publishes the native result, remounts from resetCount, and
  // labels canonical spell facts as facts rather than pretending to cast them.
  // ========================================================================

  it('shows facts, logs the result, resets, and names unsupported spell execution', () => {
    const events: string[] = [];
    const { rerender } = render(
      <EarthGenasiRaceLeaf
        race={earthGenasi}
        state={createRaceDomainScenarioState(earthGenasi.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('earth-genasi-canonical-facts')).toHaveTextContent('Blade Ward uses PB +2');
    expect(screen.getByTestId('earth-genasi-canonical-facts')).toHaveTextContent('Pass without Trace from level 5');
    expect(screen.getByTestId('earth-genasi-canonical-facts')).toHaveTextContent('ability choices: Intelligence, Wisdom, or Charisma');
    expect(screen.getByTestId('earth-genasi-movement-comparison')).toHaveTextContent('ordinary actor cost 30 ft; Earth Genasi cost 15 ft');
    expect(screen.getByTestId('earth-genasi-actor-facts')).toHaveTextContent('Position 0,0');
    expect(screen.getByTestId('earth-genasi-actor-facts')).toHaveTextContent('Move 0/30 (30 remaining)');

    fireEvent.click(screen.getByRole('button', { name: /traverse earth walk path/i }));

    expect(screen.getByTestId('earth-genasi-outcome')).toHaveTextContent('Earth Walk RESOLVED');
    expect(screen.getByTestId('earth-genasi-actor-facts')).toHaveTextContent('Position 3,0');
    expect(screen.getByTestId('earth-genasi-actor-facts')).toHaveTextContent('Move 15/30 (15 remaining)');
    expect(events.at(-1)).toContain('Earth Genasi EARTH WALK RESOLVED');

    rerender(
      <EarthGenasiRaceLeaf
        race={earthGenasi}
        state={createRaceDomainScenarioState(earthGenasi.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('earth-genasi-actor-facts')).toHaveTextContent('Position 0,0');
    expect(screen.getByTestId('earth-genasi-actor-facts')).toHaveTextContent('Move 0/30 (30 remaining)');
    expect(screen.getByTestId('earth-genasi-spell-boundary')).toHaveTextContent('does not cast Blade Ward');
    expect(screen.getByTestId('earth-genasi-movement-boundary')).toHaveTextContent('canonical-derived adapter only around the difficult-terrain multiplier');
  });
});

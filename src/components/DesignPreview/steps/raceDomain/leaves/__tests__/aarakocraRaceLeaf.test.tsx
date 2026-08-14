import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import { discoverRaceDomainLeaves } from '../../raceDomainRegistry';
import {
  AARAKOCRA_FLIGHT_TARGETS,
  AarakocraRaceLeaf,
  RACE_DOMAIN_LEAF,
  createAarakocraFlightScenario,
  getCanonicalWalkingSpeedFeet,
  hasCanonicalAarakocraFlight,
  resolveAarakocraFlight,
} from '../aarakocraRaceLeaf';

/**
 * This file proves that the Aarakocra leaf is discoverable, linked to the
 * canonical race record, and backed by the native aerial movement resolver.
 *
 * It intentionally stays at the disjoint leaf boundary. The parent
 * orchestrator still owns mounted Race-tab and 2D/3D proof for the integrated
 * shell, while these checks protect the leaf's deterministic transaction.
 * Called by: focused Vitest checks for the Race domain.
 * Depends on: ACTIVE_RACES and the Aarakocra leaf's exported test seams.
 */

// ============================================================================
// Canonical Registration And Mechanics Proof
// ============================================================================
// These assertions protect the source-data link and the production resolver
// outcome before any browser integration pass is attempted.
// ============================================================================

describe('Aarakocra Race leaf', () => {
  const aarakocra = ACTIVE_RACES.find(race => race.id === 'aarakocra')!;

  it('exports the automatic-discovery registration for the canonical race', () => {
    expect(RACE_DOMAIN_LEAF.id).toBe('aarakocra-flight');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(aarakocra.id);
    expect(RACE_DOMAIN_LEAF.Component).toBe(AarakocraRaceLeaf);
    expect(discoverRaceDomainLeaves()).toContainEqual(RACE_DOMAIN_LEAF);
  });

  it('links Flight and walking speed to canonical Aarakocra traits', () => {
    expect(getCanonicalWalkingSpeedFeet(aarakocra)).toBe(30);
    expect(hasCanonicalAarakocraFlight(aarakocra)).toBe(true);

    const baseline = createAarakocraFlightScenario(aarakocra);
    const flyer = baseline.characters.find(character => character.id === 'flying_aerial_movement-flyer')!;
    expect(flyer.stats.speed).toBe(30);
    expect(flyer.class.id).toBe('fighter');
    expect(flyer.stats.extraMovementSpeeds?.fly).toBe(30);
    expect(flyer.actionEconomy.movement.total).toBe(30);
  });

  it('resolves the legal first leg through native aerial movement and pays movement', () => {
    const baseline = createAarakocraFlightScenario(aarakocra);
    const resolved = resolveAarakocraFlight(baseline, 'first-leg');

    expect(resolved.lastResolution?.allowed).toBe(true);
    expect(resolved.lastResolution?.costFeet).toBe(25);
    expect(resolved.lastResolution?.flySpeedFeet).toBe(30);
    expect(resolved.characters.find(character => character.id === 'flying_aerial_movement-flyer')).toMatchObject({
      position: { x: 6, y: 6 },
      actionEconomy: { movement: { used: 25, total: 30 } },
    });
    expect(resolved.outcome).toContain('Flight resolved');
  });

  it('rejects the next leg atomically when only five feet remain', () => {
    const firstLeg = resolveAarakocraFlight(
      createAarakocraFlightScenario(aarakocra),
      'first-leg',
    );
    const rejected = resolveAarakocraFlight(firstLeg, 'next-leg');
    const flyer = rejected.characters.find(character => character.id === 'flying_aerial_movement-flyer')!;

    expect(rejected.lastResolution?.allowed).toBe(false);
    expect(rejected.lastResolution?.reason).toContain('only 5 ft');
    expect(flyer.position).toEqual({ x: 6, y: 6 });
    expect(flyer.actionEconomy.movement.used).toBe(25);
    expect(rejected.outcome).toContain('Unchanged: 6,6@20 ft; Move 25/30');
  });

  it('rejects blocked airspace without changing the baseline actor', () => {
    const baseline = createAarakocraFlightScenario(aarakocra);
    const rejected = resolveAarakocraFlight(baseline, 'blocked-airspace');
    const flyer = rejected.characters.find(character => character.id === 'flying_aerial_movement-flyer')!;

    expect(rejected.lastResolution?.allowed).toBe(false);
    expect(rejected.lastResolution?.reason).toContain('Airspace is sealed');
    expect(flyer.position).toEqual(FLYING_AARAKOCRA_TARGET_START);
    expect(flyer.actionEconomy.movement.used).toBe(0);
  });

  // ========================================================================
  // Visible Event And Parent Reset Proof
  // ========================================================================
  // The component must publish the same outcome that the pure transaction
  // produced, and a parent resetCount change must restore the baseline.
  // ========================================================================

  it('shows actor/resource/outcome facts, publishes the event, and resets', () => {
    const events: string[] = [];
    const { rerender } = render(
      <AarakocraRaceLeaf
        race={aarakocra}
        state={createRaceDomainScenarioState(aarakocra.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('aarakocra-flight-actor')).toHaveTextContent('Fly 30 ft');
    expect(screen.getByTestId('aarakocra-flight-actor')).toHaveTextContent('Move 0/30');
    fireEvent.click(screen.getByRole('button', { name: /resolve aarakocra flight/i }));

    expect(screen.getByTestId('aarakocra-flight-outcome')).toHaveTextContent('Flight resolved');
    expect(events.at(-1)).toContain('Aarakocra FLIGHT RESOLVED');

    rerender(
      <AarakocraRaceLeaf
        race={aarakocra}
        state={createRaceDomainScenarioState(aarakocra.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('aarakocra-flight-actor')).toHaveTextContent('3,6@10 ft');
    expect(screen.getByTestId('aarakocra-flight-actor')).toHaveTextContent('Move 0/30');
    expect(screen.getByTestId('aarakocra-armor-boundary')).toHaveTextContent('does not fake enforcement');
  });

  it('keeps the deterministic target set explicit for the integrated control surface', () => {
    expect(AARAKOCRA_FLIGHT_TARGETS.map(target => target.id)).toEqual([
      'first-leg',
      'next-leg',
      'blocked-airspace',
      'off-board',
    ]);
  });
});

const FLYING_AARAKOCRA_TARGET_START = { x: 3, y: 6 };

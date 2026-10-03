import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import { discoverRaceDomainLeaves } from '../../raceDomainRegistry';
import {
  FAIRY_ARMOR_CASES,
  FAIRY_FLYER_ID,
  FairyRaceLeaf,
  RACE_DOMAIN_LEAF,
  canFairyFlyWithArmor,
  createFairyFlightScenario,
  getCanonicalFairyMagicFacts,
  getCanonicalFairyWalkingSpeedFeet,
  hasCanonicalFairyFlight,
  resolveFairyFlight,
} from '../fairyRaceLeaf';

/**
 * This file proves that the Fairy leaf is discoverable, linked to canonical
 * Fairy data, and backed by the native aerial movement transaction.
 *
 * The tests stay at the disjoint leaf boundary. The parent orchestrator owns
 * mounted Race-tab and 2D/3D proof, while these checks protect deterministic
 * actor state, real armour projection, movement payment, atomic rejection,
 * visible event logging, Reset remounting, and the no-fake-spell boundary.
 * Called by: focused Vitest checks for the Race domain.
 * Depends on: ACTIVE_RACES and the Fairy leaf's exported test seams.
 */

// ============================================================================
// Canonical Registration And Fairy Magic Facts
// ============================================================================
// These assertions ensure the leaf is found automatically and the displayed
// racial spell facts remain source-backed rather than hand-authored controls.
// ============================================================================

describe('Fairy Race leaf', () => {
  const fairy = ACTIVE_RACES.find(race => race.id === 'fairy')!;

  it('exports the automatic-discovery registration for canonical Fairy', () => {
    expect(RACE_DOMAIN_LEAF.id).toBe('fairy-flight');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(fairy.id);
    expect(RACE_DOMAIN_LEAF.Component).toBe(FairyRaceLeaf);
    expect(discoverRaceDomainLeaves()).toContainEqual(RACE_DOMAIN_LEAF);
  });

  it('links Speed, Flight, and Fairy Magic to canonical data', () => {
    expect(getCanonicalFairyWalkingSpeedFeet(fairy)).toBe(30);
    expect(hasCanonicalFairyFlight(fairy)).toBe(true);

    const magic = getCanonicalFairyMagicFacts(fairy);
    expect(magic.traitName).toBe('Fairy Magic');
    expect(magic.spellGates).toEqual([
      { minLevel: 1, spellId: 'druidcraft' },
      { minLevel: 3, spellId: 'faerie-fire' },
      { minLevel: 5, spellId: 'enlarge-reduce' },
    ]);
    expect(magic.availableAbilities).toEqual(['Intelligence', 'Wisdom', 'Charisma']);
    expect(magic.chosenAbility).toBeNull();
  });

  // ========================================================================
  // Canonical Flight And Armour Boundary
  // ========================================================================
  // No/light armour reaches the native resolver. Medium/heavy armour stops at
  // the narrow Fairy adapter and must leave all live state unchanged.
  // ========================================================================

  it('keeps the deterministic armour cases explicit', () => {
    expect(FAIRY_ARMOR_CASES).toEqual(['none', 'light', 'medium', 'heavy']);
  });

  it.each(['none', 'light'] as const)('allows legal %s-armour Flight', armorCase => {
    const baseline = createFairyFlightScenario(fairy, armorCase);
    const flyer = baseline.characters.find(character => character.id === FAIRY_FLYER_ID)!;
    const resolved = resolveFairyFlight(baseline);

    expect(canFairyFlyWithArmor(flyer)).toBe(true);
    expect(flyer.stats.extraMovementSpeeds?.fly).toBe(30);
    expect(resolved.lastResolution?.allowed).toBe(true);
    expect(resolved.lastResolution).toMatchObject({
      horizontalDistanceFeet: 15,
      verticalDistanceFeet: 10,
      costFeet: 25,
      flySpeedFeet: 30,
    });
    expect(resolved.characters.find(character => character.id === FAIRY_FLYER_ID)).toMatchObject({
      position: { x: 5, y: 2 },
      aerialMovement: { altitudeFeet: 10, isFlying: true },
      actionEconomy: { movement: { used: 25, total: 30 } },
    });
    expect(resolved.outcome).toContain('Flight resolved');
  });

  it.each(['medium', 'heavy'] as const)('rejects %s armour atomically', armorCase => {
    const baseline = createFairyFlightScenario(fairy, armorCase);
    const before = baseline.characters.find(character => character.id === FAIRY_FLYER_ID)!;
    const rejected = resolveFairyFlight(baseline);
    const after = rejected.characters.find(character => character.id === FAIRY_FLYER_ID)!;

    expect(canFairyFlyWithArmor(before)).toBe(false);
    expect(rejected.lastResolution).toBeNull();
    expect(after.position).toEqual(before.position);
    expect(after.aerialMovement).toEqual(before.aerialMovement);
    expect(after.actionEconomy.movement).toEqual(before.actionEconomy.movement);
    expect(rejected.outcome).toContain(`blocked by canonical ${armorCase} armor`);
    expect(rejected.outcome).toContain('Unchanged: 2,2@0 ft; Move 0/30');
  });

  // ========================================================================
  // Visible Event, Reset, And Spell Boundary
  // ========================================================================
  // The component must publish the pure transaction outcome, restore baseline
  // state when the parent increments resetCount, and show Fairy Magic without
  // inventing a cast/effect transaction.
  // ========================================================================

  it('shows actor/resource/facts, logs the event, and resets', () => {
    const events: string[] = [];
    const { rerender } = render(
      <FairyRaceLeaf
        race={fairy}
        state={createRaceDomainScenarioState(fairy.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('fairy-canonical-traits')).toHaveTextContent('Speed 30 ft');
    expect(screen.getByTestId('fairy-flight-actor')).toHaveTextContent('Armor none');
    expect(screen.getByTestId('fairy-flight-actor')).toHaveTextContent('Move 0/30');
    expect(screen.getByTestId('fairy-magic-facts')).toHaveTextContent('druidcraft at level 1');
    expect(screen.getByTestId('fairy-magic-facts')).toHaveTextContent('chosen ability not selected');
    expect(screen.getByTestId('fairy-magic-boundary')).toHaveTextContent('does not choose an ability');

    fireEvent.click(screen.getByRole('button', { name: /resolve fairy flight/i }));
    expect(screen.getByTestId('fairy-flight-outcome')).toHaveTextContent('Flight resolved');
    expect(screen.getByTestId('fairy-flight-actor')).toHaveTextContent('Position 5,2@10 ft');
    expect(screen.getByTestId('fairy-flight-actor')).toHaveTextContent('Move 25/30');
    expect(events.at(-1)).toContain('Fairy FLIGHT RESOLVED');

    // Parent Reset is represented by resetCount. The keyed leaf remount returns
    // to the canonical no-armour baseline without a separate fake reset action.
    rerender(
      <FairyRaceLeaf
        race={fairy}
        state={createRaceDomainScenarioState(fairy.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );
    expect(screen.getByTestId('fairy-flight-actor')).toHaveTextContent('Position 2,2@0 ft');
    expect(screen.getByTestId('fairy-flight-actor')).toHaveTextContent('Move 0/30');
    expect(screen.getByTestId('fairy-armor-boundary')).toHaveTextContent('canonical-derived leaf adapter');
  });

  it('changes armour case through real catalogue projection before resolving', () => {
    const events: string[] = [];
    render(
      <FairyRaceLeaf
        race={fairy}
        state={createRaceDomainScenarioState(fairy.id)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    fireEvent.change(screen.getByLabelText('Worn armor'), { target: { value: 'medium' } });
    expect(screen.getByTestId('fairy-flight-actor')).toHaveTextContent('Armor Medium');
    fireEvent.click(screen.getByRole('button', { name: /resolve fairy flight/i }));
    expect(screen.getByTestId('fairy-flight-outcome')).toHaveTextContent('blocked by canonical medium armor');
    expect(events.at(-1)).toContain('Fairy FLIGHT REJECTED ATOMICALLY');
  });
});

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import { discoverRaceDomainLeaves } from '../../raceDomainRegistry';
import {
  AQUATIC_HALF_ELF_SWIM_DISTANCE_FEET,
  AquaticHalfElfRaceLeaf,
  RACE_DOMAIN_LEAF,
  createAquaticHalfElfSwimScenario,
  getAquaticHalfElfSwimCostComparison,
  getCanonicalAquaticHalfElfSwimSpeedFeet,
  getCanonicalAquaticHalfElfSwimSpeedsFeet,
  hasCanonicalAquaticHalfElfSwimSpeed,
  resolveAquaticHalfElfSwim,
} from '../aquaticHalfElfRaceLeaf';

/**
 * This file proves that the Aquatic Half-Elf leaf is discoverable, linked to
 * canonical duplicate Swim Speed traits, and backed by native movement physics
 * and action-economy payment. It stays within the leaf boundary and does not
 * claim mounted 2D/3D or BattleMap swimming-pathfinding proof.
 * Called by: focused Vitest checks for the Race domain.
 * Depends on: ACTIVE_RACES and the Aquatic Half-Elf leaf's exported seams.
 */

// ============================================================================
// Canonical Registration And Trait Proof
// ============================================================================
// These assertions protect the source-data link and duplicate-resolution rule
// before the movement transaction is exercised.
// ============================================================================

describe('Aquatic Half-Elf Race leaf', () => {
  const aquaticHalfElf = ACTIVE_RACES.find(race => race.id === 'half_elf_aquatic')!;

  it('exports the automatic-discovery registration for the canonical race', () => {
    expect(RACE_DOMAIN_LEAF.id).toBe('aquatic-half-elf-swim-speed');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(aquaticHalfElf.id);
    expect(RACE_DOMAIN_LEAF.Component).toBe(AquaticHalfElfRaceLeaf);
    expect(discoverRaceDomainLeaves()).toContainEqual(RACE_DOMAIN_LEAF);
  });

  it('deduplicates both canonical Swim Speed trait entries to 30 feet', () => {
    expect(getCanonicalAquaticHalfElfSwimSpeedsFeet(aquaticHalfElf)).toEqual([30]);
    expect(getCanonicalAquaticHalfElfSwimSpeedFeet(aquaticHalfElf)).toBe(30);
    expect(hasCanonicalAquaticHalfElfSwimSpeed(aquaticHalfElf)).toBe(true);
  });

  it('creates a production Aquatic Half-Elf actor and projects only the missing swim speed', () => {
    const baseline = createAquaticHalfElfSwimScenario(aquaticHalfElf);

    expect(baseline.actor).toMatchObject({
      id: 'aquatic-half-elf-swim-actor',
      class: { id: 'fighter' },
      level: 1,
      stats: { extraMovementSpeeds: { swim: 30 } },
    });
    expect(baseline.actor?.actionEconomy.movement).toEqual({ used: 0, total: 30 });
    expect(baseline.comparisonActor?.stats.extraMovementSpeeds?.swim).toBeUndefined();
    expect(baseline.comparisonActor?.actionEconomy.movement).toEqual({ used: 0, total: 30 });
  });
});

// ============================================================================
// Native Movement Cost And Resource Proof
// ============================================================================
// The same production physics helper computes both outcomes. The action
// economy helper then makes the movement ledger change real and rejects an
// over-budget attempt without mutating the prior actor snapshot.
// ============================================================================

describe('Aquatic Half-Elf native swim transaction', () => {
  const aquaticHalfElf = ACTIVE_RACES.find(race => race.id === 'half_elf_aquatic')!;

  it('proves 15 feet costs 15 with native speed and 30 without it', () => {
    const comparison = getAquaticHalfElfSwimCostComparison();

    expect(AQUATIC_HALF_ELF_SWIM_DISTANCE_FEET).toBe(15);
    expect(comparison).toEqual({ nativeCostFeet: 15, comparisonCostFeet: 30 });
  });

  it('charges native movement through the canonical action-economy helpers', () => {
    const baseline = createAquaticHalfElfSwimScenario(aquaticHalfElf);
    const resolved = resolveAquaticHalfElfSwim(baseline, 'native');

    expect(resolved.lastResolution).toMatchObject({
      mode: 'native',
      allowed: true,
      costFeet: 15,
      movementBeforeFeet: 0,
      movementAfterFeet: 15,
      movementTotalFeet: 30,
    });
    expect(resolved.actor?.actionEconomy.movement).toEqual({ used: 15, total: 30 });
    expect(resolved.outcome).toContain('cost 15 ft');
  });

  it('charges the no-speed comparison at the native doubled cost', () => {
    const baseline = createAquaticHalfElfSwimScenario(aquaticHalfElf);
    const resolved = resolveAquaticHalfElfSwim(baseline, 'without-native-speed');

    expect(resolved.lastResolution).toMatchObject({
      mode: 'without-native-speed',
      allowed: true,
      costFeet: 30,
      movementAfterFeet: 30,
      movementTotalFeet: 30,
    });
    expect(resolved.comparisonActor?.actionEconomy.movement).toEqual({ used: 30, total: 30 });
  });

  it('rejects an over-budget swim atomically and preserves the ledger', () => {
    const firstSwim = resolveAquaticHalfElfSwim(
      createAquaticHalfElfSwimScenario(aquaticHalfElf),
      'without-native-speed',
    );
    const rejected = resolveAquaticHalfElfSwim(firstSwim, 'without-native-speed');

    expect(rejected.lastResolution).toMatchObject({
      allowed: false,
      costFeet: 30,
      movementBeforeFeet: 30,
      movementAfterFeet: 30,
    });
    expect(rejected.comparisonActor?.actionEconomy.movement).toEqual({ used: 30, total: 30 });
    expect(rejected.outcome).toContain('rejected atomically');
  });
});

// ============================================================================
// Visible Controls, Event, Reset, And Boundary Proof
// ============================================================================
// The component must show both ledgers, publish the native outcome, restore
// default state from resetCount, and label the missing pathfinding integration.
// ============================================================================

describe('Aquatic Half-Elf visible leaf contract', () => {
  const aquaticHalfElf = ACTIVE_RACES.find(race => race.id === 'half_elf_aquatic')!;

  it('shows default native controls, publishes events, compares costs, and resets', () => {
    const events: string[] = [];
    const { rerender } = render(
      <AquaticHalfElfRaceLeaf
        race={aquaticHalfElf}
        state={createRaceDomainScenarioState(aquaticHalfElf.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('aquatic-half-elf-canonical-traits')).toHaveTextContent('Swim Speed 30 ft');
    expect(screen.getByTestId('aquatic-half-elf-swim-actor')).toHaveTextContent('Swim 30 ft; Move 0/30');
    expect(screen.getByTestId('aquatic-half-elf-swim-comparison')).toHaveTextContent('Native cost 15 ft vs without speed 30 ft');
    expect(screen.getByRole('combobox', { name: /swim speed mode/i })).toHaveValue('native');

    fireEvent.click(screen.getByRole('button', { name: /resolve 15-foot swim/i }));

    expect(screen.getByTestId('aquatic-half-elf-swim-actor')).toHaveTextContent('Move 15/30');
    expect(screen.getByTestId('aquatic-half-elf-swim-outcome')).toHaveTextContent('Swim resolved (native)');
    expect(events.at(-1)).toContain('Aquatic Half-Elf SWIM NATIVE');

    fireEvent.change(screen.getByRole('combobox', { name: /swim speed mode/i }), {
      target: { value: 'without-native-speed' },
    });
    fireEvent.click(screen.getByRole('button', { name: /resolve 15-foot swim/i }));
    expect(screen.getByTestId('aquatic-half-elf-swim-comparison')).toHaveTextContent('Move 30/30');
    expect(events.at(-1)).toContain('WITHOUT-NATIVE-SPEED');

    rerender(
      <AquaticHalfElfRaceLeaf
        race={aquaticHalfElf}
        state={createRaceDomainScenarioState(aquaticHalfElf.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByRole('combobox', { name: /swim speed mode/i })).toHaveValue('native');
    expect(screen.getByTestId('aquatic-half-elf-swim-actor')).toHaveTextContent('Move 0/30');
    expect(screen.getByTestId('aquatic-half-elf-swim-boundary')).toHaveTextContent('does not yet integrate swimming mode');
  });
});

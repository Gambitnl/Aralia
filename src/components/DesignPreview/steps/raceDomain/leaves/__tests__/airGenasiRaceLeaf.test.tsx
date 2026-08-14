import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import { discoverRaceDomainLeaves } from '../../raceDomainRegistry';
import {
  AIR_GENASI_RESISTANCE_DAMAGE,
  AirGenasiRaceLeaf,
  RACE_DOMAIN_LEAF,
  createAirGenasiResistanceScenario,
  getCanonicalAirGenasiDamageResistances,
  getCanonicalAirGenasiSpeedFeet,
  getCanonicalAirGenasiSpellProgression,
  hasCanonicalAirGenasiLightningResistance,
  resolveAirGenasiResistance,
} from '../airGenasiRaceLeaf';

/**
 * This file proves that the Air Genasi leaf is discoverable, linked to
 * canonical Race traits, and backed by the native damage-resistance pipeline.
 *
 * It stays at the disjoint leaf boundary. The parent orchestrator still owns
 * mounted Race-tab and 2D/3D proof, while these checks protect the deterministic
 * actor, damage transaction, visible event, reset contract, and unsupported
 * mechanics boundary.
 * Called by: focused Vitest checks for the Race domain.
 * Depends on: ACTIVE_RACES and the Air Genasi leaf's exported test seams.
 */

// ============================================================================
// Canonical Registration And Mechanics Proof
// ============================================================================
// These assertions protect source-data linkage and native resolver outcomes
// before any browser integration pass is attempted.
// ============================================================================

describe('Air Genasi Race leaf', () => {
  const airGenasi = ACTIVE_RACES.find(race => race.id === 'air_genasi')!;

  it('exports the automatic-discovery registration for the canonical race', () => {
    expect(RACE_DOMAIN_LEAF.id).toBe('air-genasi-resistance');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(airGenasi.id);
    expect(RACE_DOMAIN_LEAF.Component).toBe(AirGenasiRaceLeaf);
    expect(discoverRaceDomainLeaves()).toContainEqual(RACE_DOMAIN_LEAF);
  });

  it('links resistance, speed, and Mingle with the Wind facts to canonical data', () => {
    expect(getCanonicalAirGenasiDamageResistances(airGenasi)).toContain('lightning');
    expect(hasCanonicalAirGenasiLightningResistance(airGenasi)).toBe(true);
    expect(getCanonicalAirGenasiSpeedFeet(airGenasi)).toBe(35);
    expect(getCanonicalAirGenasiSpellProgression(airGenasi)).toEqual([
      { minLevel: 1, spellId: 'shocking-grasp' },
      { minLevel: 3, spellId: 'levitate' },
    ]);

    const baseline = createAirGenasiResistanceScenario(airGenasi);
    expect(baseline.actor).toMatchObject({
      class: { id: 'fighter' },
      level: 1,
      resistances: ['lightning'],
    });
    expect(baseline.actor?.currentHP).toBe(baseline.actor?.maxHP);
  });

  it('uses native calculateDamage resistance and floors odd damage', () => {
    const baseline = createAirGenasiResistanceScenario(airGenasi);
    const resolved = resolveAirGenasiResistance(baseline, 'lightning');

    expect(AIR_GENASI_RESISTANCE_DAMAGE).toBe(15);
    expect(resolved.finalDamage).toBe(7);
    expect(resolved.actor?.currentHP).toBe((baseline.actor?.maxHP ?? 0) - 7);
    expect(resolved.outcome).toContain('resistance applied');
  });

  it('keeps a non-lightning packet unchanged through the same native boundary', () => {
    const baseline = createAirGenasiResistanceScenario(airGenasi);
    const resolved = resolveAirGenasiResistance(baseline, 'fire');

    expect(resolved.finalDamage).toBe(AIR_GENASI_RESISTANCE_DAMAGE);
    expect(resolved.outcome).toContain('unchanged boundary');
    expect(resolved.actor?.currentHP).toBe(0);
  });

  // ========================================================================
  // Visible Event, Reset, And Unsupported Boundary Proof
  // ========================================================================
  // The component must publish the native outcome, while resetCount restores
  // baseline state and the UI remains honest about mechanics outside this leaf.
  // ========================================================================

  it('shows facts, publishes an event, resets, and labels unsupported mechanics', () => {
    const events: string[] = [];
    const { rerender } = render(
      <AirGenasiRaceLeaf
        race={airGenasi}
        state={createRaceDomainScenarioState(airGenasi.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('air-genasi-canonical-traits')).toHaveTextContent('Speed 35 ft');
    expect(screen.getByTestId('air-genasi-canonical-traits')).toHaveTextContent('level 1 shocking-grasp');
    expect(screen.getByTestId('air-genasi-resistance-actor')).toHaveTextContent('Resistance: lightning');
    expect(screen.getByTestId('air-genasi-resistance-packet')).toHaveTextContent('Raw 15; Final not resolved');
    fireEvent.click(screen.getByRole('button', { name: /resolve air genasi damage/i }));

    expect(screen.getByTestId('air-genasi-resistance-packet')).toHaveTextContent('Packet: lightning; Raw 15; Final 7');
    expect(screen.getByTestId('air-genasi-resistance-outcome')).toHaveTextContent('Native damage resolved');
    expect(events.at(-1)).toContain('Air Genasi RESISTANCE LIGHTNING');

    rerender(
      <AirGenasiRaceLeaf
        race={airGenasi}
        state={createRaceDomainScenarioState(airGenasi.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('air-genasi-resistance-packet')).toHaveTextContent('Raw 15; Final not resolved');
    expect(screen.getByTestId('air-genasi-resistance-actor')).toHaveTextContent(/HP \d+\/\d+/);
    expect(screen.getByTestId('air-genasi-assembly-boundary')).toHaveTextContent('materialized into CombatCharacter.resistances');
    expect(screen.getByTestId('air-genasi-unsupported-boundaries')).toHaveTextContent('Unending Breath');
    expect(screen.getByTestId('air-genasi-unsupported-boundaries')).toHaveTextContent('spell execution are not claimed');
  });
});

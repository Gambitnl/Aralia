import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import { discoverRaceDomainLeaves } from '../../raceDomainRegistry';
import {
  ABYSSAL_RESISTANCE_DAMAGE,
  AbyssalTieflingRaceLeaf,
  RACE_DOMAIN_LEAF,
  createAbyssalResistanceScenario,
  getCanonicalDamageResistances,
  hasCanonicalAbyssalResistance,
  resolveAbyssalResistance,
} from '../abyssalTieflingRaceLeaf';

/**
 * This file proves that the Abyssal Tiefling leaf is discoverable, linked to
 * canonical Race traits, and backed by the native damage-resistance pipeline.
 *
 * It stays at the disjoint leaf boundary. The parent orchestrator still owns
 * mounted Race-tab and 2D/3D proof, while these checks protect the deterministic
 * actor, damage transaction, visible event, and reset contract.
 * Called by: focused Vitest checks for the Race domain.
 * Depends on: ACTIVE_RACES and the Abyssal Tiefling leaf's exported test seams.
 */

// ============================================================================
// Canonical Registration And Mechanics Proof
// ============================================================================
// These assertions protect the source-data link and native resolver outcome
// before any browser integration pass is attempted.
// ============================================================================

describe('Abyssal Tiefling Race leaf', () => {
  const abyssalTiefling = ACTIVE_RACES.find(race => race.id === 'abyssal_tiefling')!;

  it('exports the automatic-discovery registration for the canonical race', () => {
    expect(RACE_DOMAIN_LEAF.id).toBe('abyssal-tiefling-resistance');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(abyssalTiefling.id);
    expect(RACE_DOMAIN_LEAF.Component).toBe(AbyssalTieflingRaceLeaf);
    expect(discoverRaceDomainLeaves()).toContainEqual(RACE_DOMAIN_LEAF);
  });

  it('links poison resistance to the canonical Abyssal Resistance trait', () => {
    expect(getCanonicalDamageResistances(abyssalTiefling)).toContain('poison');
    expect(hasCanonicalAbyssalResistance(abyssalTiefling)).toBe(true);

    const baseline = createAbyssalResistanceScenario(abyssalTiefling);
    expect(baseline.actor).toMatchObject({
      class: { id: 'fighter' },
      level: 1,
      resistances: ['poison'],
    });
    expect(baseline.actor?.currentHP).toBe(baseline.actor?.maxHP);
  });

  it('uses native calculateDamage resistance and floors odd damage', () => {
    const baseline = createAbyssalResistanceScenario(abyssalTiefling);
    const resolved = resolveAbyssalResistance(baseline, 'poison');

    expect(ABYSSAL_RESISTANCE_DAMAGE).toBe(15);
    expect(resolved.finalDamage).toBe(7);
    expect(resolved.actor?.currentHP).toBe((baseline.actor?.maxHP ?? 0) - 7);
    expect(resolved.outcome).toContain('resistance applied');
  });

  it('keeps a non-poison packet unchanged through the same native boundary', () => {
    const baseline = createAbyssalResistanceScenario(abyssalTiefling);
    const resolved = resolveAbyssalResistance(baseline, 'cold');

    expect(resolved.finalDamage).toBe(ABYSSAL_RESISTANCE_DAMAGE);
    expect(resolved.outcome).toContain('unchanged boundary');
    expect(resolved.actor?.currentHP).toBe(0);
  });

  // ========================================================================
  // Visible Event And Parent Reset Proof
  // ========================================================================
  // The component must publish the same native outcome that the pure
  // transaction produced, and a parent resetCount change must restore the
  // baseline packet, HP, and unresolved result.
  // ========================================================================

  it('shows actor/packet/outcome facts, publishes an event, and resets', () => {
    const events: string[] = [];
    const { rerender } = render(
      <AbyssalTieflingRaceLeaf
        race={abyssalTiefling}
        state={createRaceDomainScenarioState(abyssalTiefling.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('abyssal-resistance-actor')).toHaveTextContent('Resistance: poison');
    expect(screen.getByTestId('abyssal-resistance-packet')).toHaveTextContent('Raw 15; Final not resolved');
    fireEvent.click(screen.getByRole('button', { name: /resolve abyssal damage/i }));

    expect(screen.getByTestId('abyssal-resistance-packet')).toHaveTextContent('Packet: poison; Raw 15; Final 7');
    expect(screen.getByTestId('abyssal-resistance-outcome')).toHaveTextContent('Native damage resolved');
    expect(events.at(-1)).toContain('Abyssal RESISTANCE POISON');

    rerender(
      <AbyssalTieflingRaceLeaf
        race={abyssalTiefling}
        state={createRaceDomainScenarioState(abyssalTiefling.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('abyssal-resistance-packet')).toHaveTextContent('Raw 15; Final not resolved');
    expect(screen.getByTestId('abyssal-resistance-actor')).toHaveTextContent('HP 12/12');
    expect(screen.getByTestId('abyssal-assembly-boundary')).toHaveTextContent('materialized into CombatCharacter.resistances');
  });
});

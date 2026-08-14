import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ThunderwaveScenario from '../thunderwaveScenario';
import { SPELL_SCENARIO_REGISTRY } from '../spellRegistry';

/**
 * This file proves the Thunderwave leaf through its rendered deterministic
 * controls and the canonical resolver-backed result projection.
 *
 * The assertions protect save outcomes, full/half damage, exact Action and
 * slot payment, Reset, registry availability, and the honest movement boundary.
 *
 * Called by: focused Vitest proof for the disjoint Spells domain folder.
 * Depends on: ThunderwaveScenario and spellRegistry.ts.
 */

// ============================================================================
// Registry Wiring
// ============================================================================
// Thunderwave becomes the second executable starter while Fire Bolt remains
// available through its original component and registry entry.
// ============================================================================

describe('Thunderwave registry wiring', () => {
  it('registers Thunderwave as available without changing Fire Bolt', () => {
    expect(SPELL_SCENARIO_REGISTRY[0]).toMatchObject({
      id: 'fire-bolt',
      availability: 'available',
    });
    expect(SPELL_SCENARIO_REGISTRY[1]).toMatchObject({
      id: 'thunderwave',
      availability: 'available',
      scenarioComponent: ThunderwaveScenario,
    });
  });
});

// ============================================================================
// Canonical Save Outcomes And Payment
// ============================================================================
// Each control runs a fresh fixture through resolveDamageSpellCast, so these
// tests inspect the returned transaction fields rather than duplicate damage or
// save calculations in the component test.
// ============================================================================

describe('ThunderwaveScenario canonical outcomes', () => {
  it('shows failed save, full damage, HP change, and exact payment', () => {
    render(<ThunderwaveScenario spell={SPELL_SCENARIO_REGISTRY[1]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resolve failed Constitution save' }));

    expect(screen.getByTestId('thunderwave-target-hp')).toHaveTextContent('30 before → 14 after');
    expect(screen.getByTestId('thunderwave-save')).toHaveTextContent('5 vs DC 13 (FAILURE)');
    expect(screen.getByTestId('thunderwave-damage')).toHaveTextContent('16 rolled → 16 after save → 16 final Thunder');
    expect(screen.getByTestId('thunderwave-payment')).toHaveTextContent('Action: 1 before → 0 after; level-1 slot: 1 before → 0 after');
    expect(screen.getByRole('list', { name: 'Thunderwave transaction receipt' }).querySelectorAll('li')).toHaveLength(5);
  });

  it('shows successful save, half damage, HP change, and exact payment', () => {
    render(<ThunderwaveScenario spell={SPELL_SCENARIO_REGISTRY[1]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resolve successful Constitution save' }));

    expect(screen.getByTestId('thunderwave-target-hp')).toHaveTextContent('30 before → 22 after');
    expect(screen.getByTestId('thunderwave-save')).toHaveTextContent('15 vs DC 13 (SUCCESS)');
    expect(screen.getByTestId('thunderwave-damage')).toHaveTextContent('16 rolled → 8 after save → 8 final Thunder');
    expect(screen.getByTestId('thunderwave-payment')).toHaveTextContent('Action: 1 before → 0 after; level-1 slot: 1 before → 0 after');
  });
});

// ============================================================================
// Exact Reset And Forced-Movement Boundary
// ============================================================================
// Reset must restore the untouched baseline, and the leaf must not claim a push
// that its chosen canonical transaction does not return.
// ============================================================================

describe('ThunderwaveScenario boundaries', () => {
  it('restores the exact baseline after a cast', () => {
    render(<ThunderwaveScenario spell={SPELL_SCENARIO_REGISTRY[1]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resolve failed Constitution save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset scenario' }));

    expect(screen.getByTestId('thunderwave-identities')).toHaveTextContent('Caster: Thunder Adept');
    expect(screen.getByTestId('thunderwave-target-hp')).toHaveTextContent('30 before → 30 after');
    expect(screen.getByTestId('thunderwave-save')).toHaveTextContent('Not cast');
    expect(screen.getByTestId('thunderwave-damage')).toHaveTextContent('0 rolled → 0 after save → 0 final Thunder');
    expect(screen.getByTestId('thunderwave-payment')).toHaveTextContent('Action: 1 before → 1 after; level-1 slot: 1 before → 1 after');
    expect(screen.getByRole('list', { name: 'Thunderwave transaction receipt' })).toHaveTextContent('No canonical transaction yet.');
  });

  it('states the forced-movement receipt boundary without fake displacement', () => {
    render(<ThunderwaveScenario spell={SPELL_SCENARIO_REGISTRY[1]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resolve failed Constitution save' }));

    expect(screen.getByTestId('thunderwave-forced-movement-boundary')).toHaveTextContent('resolveDamageSpellCast returns no position or movement receipt');
    expect(screen.getByTestId('thunderwave-forced-movement-boundary')).toHaveTextContent('does not claim the push is executed here');
    expect(screen.getByTestId('thunderwave-receipt-source')).toHaveTextContent('not engine-emitted combat log entries');
  });
});

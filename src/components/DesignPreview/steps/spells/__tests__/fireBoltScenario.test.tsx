import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FireBoltScenario from '../fireBoltScenario';
import { SPELL_SCENARIO_REGISTRY } from '../spellRegistry';

/**
 * This file proves the Fire Bolt leaf through the same rendered controls that
 * a Rules host uses.
 *
 * Each cast runs through the leaf's production-helper transaction, and the
 * assertions inspect its adapter-created receipt projection and HP state. The
 * suite also protects the cantrip slot boundary, exact Reset baseline, and
 * registry availability without claiming full SpellCommandFactory execution.
 *
 * Called by: focused Vitest proof for the Spells domain.
 * Depends on: FireBoltScenario and the source-backed spell registry.
 */

// ============================================================================
// Fire Bolt Registry Wiring
// ============================================================================
// The first starter must be available and point at the executable leaf while
// the remaining starter entries keep their pending status.
// ============================================================================

describe('Fire Bolt registry wiring', () => {
  it('registers Fire Bolt as the available executable starter', () => {
    expect(SPELL_SCENARIO_REGISTRY[0]).toMatchObject({
      id: 'fire-bolt',
      availability: 'available',
      scenarioComponent: FireBoltScenario,
    });
  });
});

// ============================================================================
// Helper-Derived Hit And Miss Controls
// ============================================================================
// These controls prove materially different production outcomes without
// calculating attack success or damage inside the test or component.
// ============================================================================

describe('FireBoltScenario canonical outcomes', () => {
  it('shows helper-derived hit damage, HP transition, ordered receipt, and no-slot truth', async () => {
    render(<FireBoltScenario spell={SPELL_SCENARIO_REGISTRY[0]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resolve deterministic hit' }));
    await waitFor(() => expect(screen.getByText(/Attack:/)).toHaveTextContent('HIT'));

    expect(screen.getByTestId('fire-bolt-target-hp')).toHaveTextContent('30 before → 22 after');
    expect(screen.getByTestId('fire-bolt-outcome')).toHaveTextContent('Fire damage: 8 (Fire)');
    expect(screen.getByTestId('fire-bolt-resource')).toHaveTextContent('Spell slot: none consumed');
    expect(screen.getByRole('list', { name: 'Fire Bolt helper receipt' }).querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByTestId('fire-bolt-unsupported-boundary')).toHaveTextContent('does not expose deterministic RNG inputs');
  });

  it('shows helper-derived miss with unchanged HP and no damage receipt', async () => {
    render(<FireBoltScenario spell={SPELL_SCENARIO_REGISTRY[0]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resolve deterministic miss' }));
    await waitFor(() => expect(screen.getByText(/Attack:/)).toHaveTextContent('MISS'));

    expect(screen.getByTestId('fire-bolt-target-hp')).toHaveTextContent('30 before → 30 after');
    expect(screen.getByTestId('fire-bolt-outcome')).toHaveTextContent('Fire damage: 0 (no hit-conditioned damage)');
    expect(screen.getByRole('list', { name: 'Fire Bolt helper receipt' }).querySelectorAll('li')).toHaveLength(1);
  });
});

// ============================================================================
// Exact Reset Boundary
// ============================================================================
// Reset clears the result snapshot and returns the rendered fixture to its
// original identity, HP, resource, and empty-log state.
// ============================================================================

describe('FireBoltScenario reset', () => {
  it('restores the exact baseline after a helper-derived hit', async () => {
    render(<FireBoltScenario spell={SPELL_SCENARIO_REGISTRY[0]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resolve deterministic hit' }));
    await waitFor(() => expect(screen.getByText(/Attack:/)).toHaveTextContent('HIT'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset scenario' }));

    expect(screen.getByTestId('fire-bolt-identities')).toHaveTextContent('Caster: Evoker');
    expect(screen.getByTestId('fire-bolt-target-hp')).toHaveTextContent('30 before → 30 after');
    expect(screen.getByTestId('fire-bolt-outcome')).toHaveTextContent('Attack: Not cast');
    expect(screen.getByRole('list', { name: 'Fire Bolt helper receipt' })).toHaveTextContent('No helper transaction yet.');
    expect(screen.getByTestId('fire-bolt-unsupported-boundary')).toHaveTextContent('does not expose deterministic RNG inputs');
  });
});

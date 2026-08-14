import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CureWoundsScenario from '../cureWoundsScenario';
import { SPELL_SCENARIO_REGISTRY } from '../spellRegistry';

/**
 * This file proves the Cure Wounds preview is connected to the atomic healing
 * transaction rather than changing HP or resources in the rendered component.
 *
 * The cases cover the level-one formula, max-HP cap, downed restoration,
 * pre-payment Undead rejection, exact Reset baseline, and registry availability.
 *
 * Called by: focused Vitest proof for the Spells Design Preview domain.
 * Depends on: CureWoundsScenario and spellRegistry.ts.
 */

// ============================================================================
// Registry Availability
// ============================================================================
// The registry is the shell's source of truth for whether a scenario is
// executable. This assertion prevents the component from existing as an
// orphaned file that the Rules host still presents as pending.
// ============================================================================

describe('Cure Wounds registry entry', () => {
  it('registers the scenario as available with its canonical evidence', () => {
    const entry = SPELL_SCENARIO_REGISTRY.find(spell => spell.id === 'cure-wounds');

    expect(entry).toMatchObject({
      name: 'Cure Wounds',
      level: 1,
      kind: 'healing',
      availability: 'available',
      scenarioComponent: CureWoundsScenario,
    });
    expect(entry?.canonicalEvidence.catalogPaths).toContain('src/data/spells/level-1/cure-wounds.json');
    expect(entry?.canonicalEvidence.resolverPaths).toContain('src/systems/spells/mechanics/healingTemporaryHitPointResolution.ts');
  });
});

// ============================================================================
// Canonical Healing Controls
// ============================================================================
// Each button starts a fresh fixture. The visible resource and HP facts must
// therefore match one atomic resolver return, not a sequence of UI patches.
// ============================================================================

describe('CureWoundsScenario', () => {
  it('caps level-one healing and pays one Action and one level-one slot', () => {
    render(<CureWoundsScenario spell={SPELL_SCENARIO_REGISTRY[2]} />);

    expect(screen.getByTestId('cure-wounds-target-hp')).toHaveTextContent('20 before → 20 after');
    fireEvent.click(screen.getByRole('button', { name: 'Heal wounded target (max cap)' }));

    expect(screen.getByTestId('cure-wounds-target-hp')).toHaveTextContent('20 before → 24 after');
    expect(screen.getByTestId('cure-wounds-healing')).toHaveTextContent('17 rolled; requested 17, applied 4');
    expect(screen.getByTestId('cure-wounds-payment')).toHaveTextContent('Action: 1 before → 0 after; level-1 slot: 2 before → 1 after');
    expect(screen.getByRole('list', { name: 'Cure Wounds transaction receipt' })).toHaveTextContent('Production return: resolveHitPointAction resolved');
    expect(screen.getByTestId('cure-wounds-receipt-source')).toHaveTextContent('adapter projection');
  });

  it('restores a downed living target and clears the canonical dying state', () => {
    render(<CureWoundsScenario spell={SPELL_SCENARIO_REGISTRY[2]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Heal downed living target' }));

    expect(screen.getByTestId('cure-wounds-target-hp')).toHaveTextContent('0 before → 17 after');
    expect(screen.getByTestId('cure-wounds-downed')).toHaveTextContent('Downed: yes before → no after');
    expect(screen.getByTestId('cure-wounds-healing')).toHaveTextContent('17 rolled; requested 17, applied 17');
    expect(screen.getByTestId('cure-wounds-payment')).toHaveTextContent('level-1 slot: 2 before → 1 after');
  });

  it('rejects an Undead target before payment', () => {
    render(<CureWoundsScenario spell={SPELL_SCENARIO_REGISTRY[2]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reject Undead target' }));

    expect(screen.getByRole('list', { name: 'Cure Wounds transaction receipt' })).toHaveTextContent('invalid_target:target_filter_failed');
    expect(screen.getByTestId('cure-wounds-target-hp')).toHaveTextContent('20 before → 20 after');
    expect(screen.getByTestId('cure-wounds-payment')).toHaveTextContent('Action: 1 before → 1 after; level-1 slot: 2 before → 2 after');
    expect(screen.getByTestId('cure-wounds-eligibility-boundary')).toHaveTextContent('rejects Undead and Constructs before payment');
  });

  // ========================================================================
  // Exact Reset Baseline
  // ========================================================================
  // Reset clears the transaction snapshot. It does not run a compensating
  // heal, so its HP, downed, and resource facts are the original baseline.
  // ========================================================================

  it('returns the exact baseline after a canonical cast', () => {
    render(<CureWoundsScenario spell={SPELL_SCENARIO_REGISTRY[2]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Heal wounded target (max cap)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset scenario' }));

    expect(screen.getByTestId('cure-wounds-target-hp')).toHaveTextContent('20 before → 20 after');
    expect(screen.getByTestId('cure-wounds-downed')).toHaveTextContent('Downed: no before → no after');
    expect(screen.getByTestId('cure-wounds-payment')).toHaveTextContent('Action: 1 before → 1 after; level-1 slot: 2 before → 2 after');
    expect(screen.getByRole('list', { name: 'Cure Wounds transaction receipt' })).toHaveTextContent('No canonical transaction yet.');
  });
});

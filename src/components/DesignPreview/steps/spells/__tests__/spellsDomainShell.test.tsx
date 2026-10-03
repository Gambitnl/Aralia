import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SpellsDomainShell from '../SpellsDomainShell';
import { SPELL_SCENARIO_REGISTRY } from '../spellRegistry';
import { SPELLS_DOMAIN_TAB } from '../spellsDomainTab';
import type { SpellScenarioDefinition } from '../types';

/**
 * This file protects the small Spells domain contract before the Rules host
 * mounts it.
 *
 * The tests check source-backed registry integrity, deterministic selection and
 * Reset behavior, and the executable Shield reaction leaf. A custom
 * available entry also proves that future scenario leaves can use the
 * extension seam without changing the shell.
 *
 * Called by: focused Vitest proof for the disjoint Spells domain folder.
 * Depends on: SpellsDomainShell, spellRegistry, and Testing Library.
 */

// ============================================================================
// Registry Integrity
// ============================================================================
// A source-backed starter registry is more useful to later leaves than a list
// of names that cannot point back to canonical data and runtime proof.
// ============================================================================

describe('SPELL_SCENARIO_REGISTRY', () => {
  it('contains four unique, source-backed representative starters', () => {
    const ids = SPELL_SCENARIO_REGISTRY.map(spell => spell.id);

    expect(new Set(ids).size).toBe(4);
    expect(SPELL_SCENARIO_REGISTRY.map(spell => spell.name)).toEqual([
      'Fire Bolt',
      'Thunderwave',
      'Cure Wounds',
      'Shield',
    ]);
    expect(SPELL_SCENARIO_REGISTRY.map(spell => spell.kind)).toEqual([
      'attack-roll',
      'saving-throw',
      'healing',
      'reaction-defense',
    ]);

    // All four starter entries now have executable leaves. The Shield leaf
    // proves only the supported when-hit arbitration and labels Magic Missile
    // as a separate runtime boundary.
    for (const spell of SPELL_SCENARIO_REGISTRY) {
      expect(spell.availability).toBe(
        'available',
      );
      expect(spell.canonicalEvidence.catalogPaths.length).toBeGreaterThan(0);
      expect(spell.canonicalEvidence.resolverPaths.length).toBeGreaterThan(0);
      expect(spell.canonicalEvidence.rationale.length).toBeGreaterThan(20);
    }
    expect(SPELL_SCENARIO_REGISTRY[0].scenarioComponent).toBeDefined();
    expect(SPELL_SCENARIO_REGISTRY[2].scenarioComponent).toBeDefined();
    expect(SPELL_SCENARIO_REGISTRY[3].scenarioComponent).toBeDefined();
  });
});

// ============================================================================
// Shared Domain-Tab Contract
// ============================================================================
// This proves the Rules host can mount Spells through the peer contract without
// passing props or importing the shell implementation directly.
// ============================================================================

describe('SPELLS_DOMAIN_TAB', () => {
  it('exports the finalized id, copy, and no-props renderer contract', () => {
    expect(SPELLS_DOMAIN_TAB).toMatchObject({
      id: 'spells',
      label: 'Spells',
      description: expect.any(String),
    });

    // The renderer returns the self-contained shell as ReactNode, so the host
    // can call it without inventing a prop bridge or a second default state.
    render(SPELLS_DOMAIN_TAB.render());
    expect(screen.getByRole('region', { name: 'Spells' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fire Bolt' })).toBeInTheDocument();
  });
});

// ============================================================================
// Selection and Reset
// ============================================================================
// The shell should make selection visible and always return to the registry's
// first entry when Reset is pressed, regardless of which spell was selected.
// ============================================================================

describe('SpellsDomainShell selection', () => {
  it('selects a spell and Reset returns to the deterministic first entry', () => {
    const onSelectionChange = vi.fn();
    render(<SpellsDomainShell onSelectionChange={onSelectionChange} />);

    expect(screen.getByRole('heading', { name: 'Fire Bolt' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Thunderwave/i }));
    expect(screen.getByRole('heading', { name: 'Thunderwave' })).toBeInTheDocument();
    expect(onSelectionChange).toHaveBeenLastCalledWith(SPELL_SCENARIO_REGISTRY[1]);

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('heading', { name: 'Fire Bolt' })).toBeInTheDocument();
    expect(onSelectionChange).toHaveBeenLastCalledWith(SPELL_SCENARIO_REGISTRY[0]);
  });
});

// ============================================================================
// Honest Pending Boundary and Extension Seam
// ============================================================================
// Pending entries must not advertise fake casts or outcomes. The custom entry
// proves that an actual component can be registered when canonical proof exists.
// ============================================================================

describe('SpellsDomainShell scenario content', () => {
  it('renders the executable Shield scenario through the registry', () => {
    render(<SpellsDomainShell initialSpellId="shield" />);

    expect(screen.getByTestId('shield-scenario')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Choose Shield/i })).toBeInTheDocument();
    expect(screen.getByTestId('shield-magic-missile-boundary')).toHaveTextContent(/does not claim Magic Missile execution/i);
  });

  it('renders an available scenario through the extension seam', () => {
    const AvailableScenario = ({ spell }: { spell: SpellScenarioDefinition }) => (
      <div data-testid="available-scenario">Canonical scenario for {spell.name}</div>
    );
    const registry: readonly SpellScenarioDefinition[] = [
      {
        ...SPELL_SCENARIO_REGISTRY[0],
        availability: 'available',
        scenarioComponent: AvailableScenario,
      },
    ];

    render(<SpellsDomainShell registry={registry} />);

    expect(screen.getByTestId('available-scenario')).toHaveTextContent('Canonical scenario for Fire Bolt');
    expect(screen.queryByTestId('spell-scenario-pending')).not.toBeInTheDocument();
  });
});

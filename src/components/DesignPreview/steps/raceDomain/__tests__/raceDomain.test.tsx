import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../data/races';
import { Button } from '../../../../ui/Button';
import {
  RaceDomainShell,
  RaceDomainSurface,
  RACE_DOMAIN_TAB_MODULE,
  RACE_DOMAIN_INTEGRATION,
} from '..';
import {
  createRaceDomainRegistry,
  extractRaceDomainLeafRegistrations,
} from '../raceDomainRegistry';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file proves the Race domain's canonical roster, accessible selection,
 * tab contract, automatic leaf discovery contract, registry filtering,
 * registered-leaf seam, and reset behavior.
 *
 * It intentionally tests the disjoint shell rather than the locked shared
 * Tactical Sandbox host. That proves the integration contract without changing
 * current combat mechanics or claiming mounted host proof that is unavailable.
 * Called by: focused Vitest checks for the Race domain.
 * Depends on: ACTIVE_RACES and the local Race domain exports.
 */

// ============================================================================
// Focused Leaf Fixture
// ============================================================================
// This leaf publishes a visible event through the real shell callback. It is a
// contract fixture, not a race mechanic implementation; production-backed
// mechanics remain the responsibility of future race-specific leaves.
// ============================================================================

function EventLeaf({
  race,
  state,
  onScenarioEvent,
}: RaceDomainLeafProps) {
  return (
    <Button
      type="button"
      onClick={() => onScenarioEvent(`Leaf inspected canonical Race: ${race.id}`)}
    >
      Inspect {race.name} ({state.resetCount} resets)
    </Button>
  );
}

function createLeaf(raceId: string): RaceDomainLeafRegistration {
  return {
    id: 'canonical-inspection',
    raceId,
    label: 'Canonical inspection leaf',
    description: 'Reports a real leaf event through the shell seam.',
    Component: EventLeaf,
  };
}

// ============================================================================
// Canonical Roster And Registry Proof
// ============================================================================
// These checks protect the most important boundary: selectable Races come from
// ACTIVE_RACES and stale registrations cannot create a phantom roster entry.
// ============================================================================

describe('Race domain shell and registry', () => {
  it('exports the singular Race tab module with a prop-free surface renderer', () => {
    expect(RACE_DOMAIN_TAB_MODULE.id).toBe('races');
    expect(RACE_DOMAIN_TAB_MODULE.label).toBe('Races');
    expect(RACE_DOMAIN_TAB_MODULE.description).toContain('Canonical Race');

    render(RACE_DOMAIN_TAB_MODULE.render());
    expect(screen.getByTestId('race-domain-shell')).toBeInTheDocument();
  });

  it('exposes the Rules integration record and the complete canonical roster', () => {
    expect(RACE_DOMAIN_INTEGRATION.id).toBe('race');
    expect(RACE_DOMAIN_INTEGRATION.label).toBe('Races');
    expect(RACE_DOMAIN_INTEGRATION.Shell).toBe(RaceDomainSurface);

    render(<RaceDomainSurface />);

    const selector = screen.getByRole('combobox', { name: 'Race' });
    // Scope the roster assertion to the Race selector. Discovered leaf controls
    // may add their own options elsewhere in the mounted domain surface.
    const options = within(selector).getAllByRole('option');
    expect(options).toHaveLength(ACTIVE_RACES.length);
    expect(options.map(option => option.textContent)).toEqual(
      ACTIVE_RACES.map(race => race.name),
    );
    expect(selector).toHaveValue(ACTIVE_RACES[0].id);
  });

  it('keeps selection canonical and reports the selected Race visibly', () => {
    render(<RaceDomainShell />);

    const selectedRace = ACTIVE_RACES.at(-1)!;
    fireEvent.change(screen.getByRole('combobox', { name: 'Race' }), {
      target: { value: selectedRace.id },
    });

    expect(screen.getByTestId('race-domain-status')).toHaveTextContent(
      `Selected Race: ${selectedRace.name}`,
    );
    expect(screen.getByTestId('race-domain-selected')).toHaveTextContent(
      selectedRace.description,
    );
    expect(screen.getByTestId('race-domain-event-log')).toHaveTextContent(
      `Selected Race: ${selectedRace.name}`,
    );
  });

  it('registers leaves only for canonical Races and exposes them through lookup', () => {
    const canonicalRace = ACTIVE_RACES[0];
    const registry = createRaceDomainRegistry(ACTIVE_RACES, [
      createLeaf(canonicalRace.id),
      createLeaf('not-a-canonical-race'),
    ]);

    expect(registry.races).toBe(ACTIVE_RACES);
    expect(registry.leaves).toHaveLength(1);
    expect(registry.getRaceById(canonicalRace.id)).toBe(canonicalRace);
    expect(registry.getLeavesForRace(canonicalRace.id)).toHaveLength(1);
    expect(registry.getLeavesForRace('not-a-canonical-race')).toEqual([]);
  });

  it('extracts only valid named glob leaves for canonical Races', () => {
    const canonicalRace = ACTIVE_RACES[0];
    const validLeaf = createLeaf(canonicalRace.id);
    const representativeGlobModules: Record<string, unknown> = {
      './validLeaf.tsx': { RACE_DOMAIN_LEAF: validLeaf },
      './staleLeaf.tsx': { RACE_DOMAIN_LEAF: createLeaf('not-a-canonical-race') },
      './wrongExport.tsx': { default: validLeaf },
      './malformedLeaf.tsx': { RACE_DOMAIN_LEAF: { id: 'missing-component' } },
      './duplicateLeaf.tsx': { RACE_DOMAIN_LEAF: validLeaf },
    };

    const registrations = extractRaceDomainLeafRegistrations(
      representativeGlobModules,
      ACTIVE_RACES,
    );

    expect(registrations).toEqual([validLeaf]);
    expect(createRaceDomainRegistry(ACTIVE_RACES, registrations).leaves).toEqual([validLeaf]);
  });

  // ========================================================================
  // Reset And Leaf Event Proof
  // ========================================================================
  // Reset must restore the canonical baseline and clear prior selection/event
  // history. The leaf callback must then be able to publish a visible event.
  // ========================================================================

  it('mounts a registered leaf, publishes its event, and resets deterministically', () => {
    const canonicalRace = ACTIVE_RACES[0];
    render(<RaceDomainShell registrations={[createLeaf(canonicalRace.id)]} />);

    fireEvent.click(screen.getByRole('button', { name: /inspect/i }));
    expect(screen.getByTestId('race-domain-event-log')).toHaveTextContent(
      `Leaf inspected canonical Race: ${canonicalRace.id}`,
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Race' }), {
      target: { value: ACTIVE_RACES.at(-1)!.id },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByRole('combobox', { name: 'Race' })).toHaveValue(canonicalRace.id);
    expect(screen.getByTestId('race-domain-status')).toHaveTextContent(
      `Selected Race: ${canonicalRace.name}`,
    );
    expect(screen.getByTestId('race-domain-event-log')).toHaveTextContent(
      `Reset Race domain to ${canonicalRace.name}`,
    );
    expect(screen.getByTestId('race-leaf-canonical-inspection')).toBeInTheDocument();
  });

  it('shows the honest unsupported boundary when no leaf is registered', () => {
    // The default shell discovers production leaves. Supplying an empty list
    // makes this test explicitly exercise the shell's empty-registration seam.
    render(<RaceDomainShell registrations={[]} />);

    expect(screen.getByTestId('race-domain-no-leaf')).toHaveTextContent(
      'does not invent race mechanics',
    );
  });
});

/**
 * This file proves the shared Tactical Sandbox domain-tab contract and behavior.
 *
 * The tests use small panel probes instead of mounting the full combat host, which keeps
 * navigation proof focused while still checking the state-preservation guarantee that the
 * Rules panel must retain when a player visits another domain.
 *
 * Called by: Vitest through the Design Preview component test suite.
 * Depends on: PreviewCombatDomainTabs and Testing Library's DOM assertions.
 */

import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../ui/Button';
import {
  createPreviewCombatDomainTabRegistry,
  definePreviewCombatDomainTab,
  PreviewCombatDomainTabs,
  type PreviewCombatDomainTabModule,
} from './PreviewCombatDomainTabs';
import { classesDomainModule } from './classes';
import { RACE_DOMAIN_TAB_MODULE } from './raceDomain';

// ============================================================================
// Small Domain Fixtures
// ============================================================================
// The shared test uses the real Classes and Races modules so their public import
// contracts and representative mounted content remain part of shell proof. Spells
// stays a small fixture because its own focused shell owns its richer content proof.
// ============================================================================

function makeTabs(rulesPanel: React.ReactNode): readonly PreviewCombatDomainTabModule[] {
  return createPreviewCombatDomainTabRegistry([
    definePreviewCombatDomainTab({
      id: 'spells',
      label: 'Spells',
      description: 'Spell rules',
      render: () => <p>Spell content</p>,
    }),
    definePreviewCombatDomainTab({
      id: 'rules',
      label: 'Rules',
      description: 'Combat rules',
      render: () => rulesPanel,
    }),
    RACE_DOMAIN_TAB_MODULE,
    classesDomainModule,
  ]);
}

// ============================================================================
// Registry and Landing Behavior
// ============================================================================
// Rules is sorted to the first position and remains the landing panel even when
// peer modules register in a different order.
// ============================================================================

describe('PreviewCombatDomainTabs', () => {
  it('sorts the four domain registrations with Rules first', () => {
    const registry = makeTabs(<p>Rules content</p>);

    expect(registry.map(tab => tab.id)).toEqual(['rules', 'classes', 'races', 'spells']);
  });

  it('lands on Rules and renders the existing Rules panel contract', () => {
    render(
      <PreviewCombatDomainTabs
        tabs={makeTabs(<p>Existing scenario content</p>)}
      />,
    );

    expect(screen.getByRole('tab', { name: /rulescombat rules/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Existing scenario content')).toBeVisible();
    expect(screen.getByRole('tabpanel', { name: /rulescombat rules/i })).toBeVisible();
  });

  it('rejects duplicate registrations before rendering ambiguous tab relationships', () => {
    const rulesTab = definePreviewCombatDomainTab({
      id: 'rules',
      label: 'Rules',
      description: 'Combat rules',
      render: () => <p>Rules</p>,
    });

    expect(() => createPreviewCombatDomainTabRegistry([rulesTab, rulesTab])).toThrow(
      'Duplicate Tactical Sandbox domain tab: rules',
    );
  });

  // ========================================================================
  // Keyboard Navigation and Selection Clarity
  // ========================================================================
  // Roving tabIndex plus selected-state attributes make the strip usable by
  // keyboard and understandable without relying on colour alone.
  // ========================================================================

  it('supports Arrow, Home, and End navigation with roving focus', () => {
    const onActiveTabChange = vi.fn();
    render(
      <PreviewCombatDomainTabs
        onActiveTabChange={onActiveTabChange}
        tabs={makeTabs(<p>Rules content</p>)}
      />,
    );

    const rulesTab = screen.getByRole('tab', { name: /rulescombat rules/i });
    const classesTab = screen.getByRole('tab', { name: /classesclass and subclass mechanics/i });
    const racesTab = screen.getByRole('tab', { name: /racescanonical race selection/i });
    const spellsTab = screen.getByRole('tab', { name: /spellsspell rules/i });

    rulesTab.focus();
    fireEvent.keyDown(rulesTab, { key: 'ArrowRight' });
    expect(classesTab).toHaveFocus();
    expect(classesTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(classesTab, { key: 'ArrowRight' });
    expect(racesTab).toHaveFocus();
    expect(racesTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(racesTab, { key: 'End' });
    expect(spellsTab).toHaveFocus();
    expect(spellsTab).toHaveAttribute('data-selected', 'true');

    fireEvent.keyDown(spellsTab, { key: 'Home' });
    expect(rulesTab).toHaveFocus();
    expect(onActiveTabChange).toHaveBeenCalledWith('classes');
    expect(onActiveTabChange).toHaveBeenCalledWith('races');
    expect(onActiveTabChange).toHaveBeenCalledWith('spells');
    expect(onActiveTabChange).toHaveBeenCalledWith('rules');
  });

  // ========================================================================
  // Rules State Preservation Across Domain Changes
  // ========================================================================
  // The Rules probe increments local state, changes domain, then comes back.
  // If hidden panels were unmounted, the count would incorrectly return to zero.
  // ========================================================================

  it('keeps Rules content mounted so scenario state survives a domain switch', () => {
    function RulesStateProbe(): React.ReactElement {
      const [logCount, setLogCount] = useState(0);

      return (
        <div>
          <p>Scenario logs: {logCount}</p>
          <Button type="button" onClick={() => setLogCount(count => count + 1)}>
            Record scenario event
          </Button>
        </div>
      );
    }

    render(<PreviewCombatDomainTabs tabs={makeTabs(<RulesStateProbe />)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Record scenario event' }));
    fireEvent.click(screen.getByRole('tab', { name: /classesclass and subclass mechanics/i }));
    fireEvent.click(screen.getByRole('tab', { name: /rulescombat rules/i }));

    expect(screen.getByText('Scenario logs: 1')).toBeVisible();
  });

  // ========================================================================
  // Real Classes Module Activation
  // ========================================================================
  // Activating the shared tab must mount the peer-owned Classes surface rather
  // than a placeholder, while the shell keeps the canonical selection visible.
  // ========================================================================

  it('activates the real Classes module and renders representative content', () => {
    render(<PreviewCombatDomainTabs tabs={makeTabs(<p>Rules content</p>)} />);

    fireEvent.click(
      screen.getByRole('tab', { name: /classesclass and subclass mechanics/i }),
    );

    expect(screen.getByRole('heading', { name: 'Classes' })).toBeVisible();
    expect(screen.getByText(/Selected class:/i)).toBeVisible();
  });

  // ========================================================================
  // Real Races Module Activation
  // ========================================================================
  // Activating Races must mount the public peer module and expose canonical
  // selection content, rather than a placeholder owned by the shared shell.
  // ========================================================================

  it('activates the real Races module and renders representative content', () => {
    render(<PreviewCombatDomainTabs tabs={makeTabs(<p>Rules content</p>)} />);

    fireEvent.click(
      screen.getByRole('tab', { name: /racescanonical race selection/i }),
    );

    expect(screen.getByRole('heading', { name: 'Tactical Sandbox Race' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Race' })).toBeVisible();
    expect(screen.getByTestId('race-domain-selected')).toBeVisible();
    expect(screen.getByTestId('race-domain-status')).toHaveTextContent(/Selected Race:/i);
  });
});

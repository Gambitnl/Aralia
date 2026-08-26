/**
 * @file src/components/Compendium/__tests__/CombatActionsTable.test.tsx
 *
 * Unit tests for the CombatActionsTable component and PHB 2024 combat actions dataset.
 *
 * Tests:
 * - Rendering of standard actions (Attack, Magic, Dash, Disengage, Dodge, Help, Hide, Ready, Search, Study, Utilize, Opportunity Attack).
 * - Action economy badges (Action, Reaction).
 * - Economy filter buttons.
 * - PHB 2024 modern rules updates (Study action, Magic action, DC 15 Hide check).
 * - Search keyword filtering and cross-referencing.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CombatActionsTable } from '../CombatActionsTable';

describe('CombatActionsTable Component', () => {
  it('renders all canonical PHB 2024 combat actions', () => {
    render(<CombatActionsTable />);

    const expectedActions = [
      'Attack',
      'Magic (Cast a Spell / Use Magic)',
      'Dash',
      'Disengage',
      'Dodge',
      'Help',
      'Hide',
      'Ready',
      'Search',
      'Study',
      'Utilize (Use an Object)',
      'Opportunity Attack',
    ];

    expectedActions.forEach((name) => {
      expect(screen.getByText(name)).toBeDefined();
    });
  });

  it('displays action economy badges and trigger information', () => {
    render(<CombatActionsTable />);

    const actionBadges = screen.getAllByText('Action');
    expect(actionBadges.length).toBeGreaterThanOrEqual(10);

    const reactionBadges = screen.getAllByText('Reaction');
    expect(reactionBadges.length).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByText(/Trigger:/i).length).toBeGreaterThanOrEqual(1);
  });

  it('filters by action economy cost', () => {
    render(<CombatActionsTable />);

    // Click Reaction filter button
    const reactionButtons = screen.getAllByRole('button', { name: /Reaction/i });
    fireEvent.click(reactionButtons[0]);

    expect(screen.getByText('Opportunity Attack')).toBeDefined();
    expect(screen.queryByText('Attack')).toBeNull();
    expect(screen.queryByText('Dash')).toBeNull();
  });

  it('displays PHB 2024 updates including Study action and DC 15 Hide', () => {
    render(<CombatActionsTable />);

    // Study action should explain monster lore checks
    expect(screen.getByText('Study')).toBeDefined();
    expect(screen.getByText(/Brand new dedicated Action in 2024 rules/i)).toBeDefined();

    // Hide action should detail DC 15 check
    expect(screen.getAllByText(/DC 15 Dexterity \(Stealth\) check/i).length).toBeGreaterThanOrEqual(1);
  });

  it('filters actions by search keyword', () => {
    render(<CombatActionsTable />);

    const searchInput = screen.getByLabelText('Search combat actions');
    fireEvent.change(searchInput, { target: { value: 'grapple' } });

    expect(screen.getByText('Attack')).toBeDefined();
    expect(screen.queryByText('Dash')).toBeNull();
  });

  it('calls onNavigate callback when clicking cross-reference terms', () => {
    const handleNavigate = vi.fn();
    render(<CombatActionsTable onNavigate={handleNavigate} />);

    const seeAlsoButtons = screen.getAllByRole('button', { name: /unarmed strike|concentration|speed/i });
    expect(seeAlsoButtons.length).toBeGreaterThan(0);

    fireEvent.click(seeAlsoButtons[0]);
    expect(handleNavigate).toHaveBeenCalled();
  });
});

/**
 * @file src/components/Compendium/__tests__/ConditionTable.test.tsx
 *
 * Unit tests for the ConditionTable component and PHB 2024 conditions dataset.
 *
 * Tests:
 * - Rendering of all 14 standard conditions and Exhaustion.
 * - Attack advantage/disadvantage modifier badges.
 * - Expanding and inspecting the 6-tier Exhaustion system.
 * - Search keyword filtering and clear button behavior.
 * - Cross-reference navigation callback triggers.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConditionTable } from '../ConditionTable';

describe('ConditionTable Component', () => {
  it('renders all canonical PHB 2024 conditions and exhaustion', () => {
    render(<ConditionTable />);

    // Verify all 14 standard conditions + Exhaustion are present in the table
    const expectedConditions = [
      'Blinded',
      'Charmed',
      'Deafened',
      'Frightened',
      'Grappled',
      'Incapacitated',
      'Invisible',
      'Paralyzed',
      'Petrified',
      'Poisoned',
      'Prone',
      'Restrained',
      'Stunned',
      'Unconscious',
      'Exhaustion',
    ];

    expectedConditions.forEach((name) => {
      expect(screen.getByText(name)).toBeDefined();
    });
  });

  it('displays tactical attack modifiers (Advantage/Disadvantage/Critical Hit badges)', () => {
    render(<ConditionTable />);

    // Paralyzed and Unconscious should display the Auto-Crit within 5 ft badge
    const critBadges = screen.getAllByText(/Auto-Crit within 5 ft/i);
    expect(critBadges.length).toBeGreaterThanOrEqual(2);

    // Advantage against / Disadvantage on attacks badges
    const advantageBadges = screen.getAllByText(/Attacks Against/i);
    expect(advantageBadges.length).toBeGreaterThanOrEqual(5);
  });

  it('toggles the 6-tier Exhaustion drawer to reveal d20 penalties and speed reductions', () => {
    render(<ConditionTable />);

    // Initially, individual level details are hidden
    expect(screen.queryByText(/FATAL: You immediately die/i)).toBeNull();

    // Click the toggle button
    const toggleButton = screen.getByTestId('toggle-exhaustion-tiers');
    expect(toggleButton.textContent).toContain('Show 6 Tiers');
    fireEvent.click(toggleButton);

    // Now exhaustion tiers 1 through 6 should be visible
    expect(screen.getAllByText(/Level 1/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/-2 to d20 Tests/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Level 6/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/FATAL: You immediately die/i).length).toBeGreaterThanOrEqual(1);

    // Click again to hide
    fireEvent.click(toggleButton);
    expect(screen.queryByText(/FATAL: You immediately die/i)).toBeNull();
  });

  it('filters conditions by search query and shows matching results', () => {
    render(<ConditionTable />);

    const searchInput = screen.getByLabelText('Search conditions');

    // Search for "invisible"
    fireEvent.change(searchInput, { target: { value: 'invisible' } });

    expect(screen.getByText('Invisible')).toBeDefined();
    expect(screen.queryByText('Blinded')).toBeNull();
    expect(screen.queryByText('Charmed')).toBeNull();

    // Search for an effect term like "speed is 0"
    fireEvent.change(searchInput, { target: { value: 'speed is 0' } });

    // Grappled and Restrained reduce speed to 0
    expect(screen.getByText('Grappled')).toBeDefined();
    expect(screen.getByText('Restrained')).toBeDefined();
    expect(screen.queryByText('Invisible')).toBeNull();
  });

  it('clears search when clear button is clicked', () => {
    render(<ConditionTable />);

    const searchInput = screen.getByLabelText('Search conditions');
    fireEvent.change(searchInput, { target: { value: 'paralyzed' } });

    expect(screen.getByText('Paralyzed')).toBeDefined();
    expect(screen.queryByText('Blinded')).toBeNull();

    const clearButton = screen.getByLabelText('Clear condition search');
    fireEvent.click(clearButton);

    expect(screen.getByText('Blinded')).toBeDefined();
    expect(screen.getByText('Paralyzed')).toBeDefined();
  });

  it('calls onNavigate callback when clicking a cross-reference term', () => {
    const handleNavigate = vi.fn();
    render(<ConditionTable onNavigate={handleNavigate} />);

    // Find a see-also button (e.g. "advantage" or "disadvantage")
    const seeAlsoButtons = screen.getAllByRole('button', { name: /advantage|disadvantage|d20 test/i });
    expect(seeAlsoButtons.length).toBeGreaterThan(0);

    fireEvent.click(seeAlsoButtons[0]);
    expect(handleNavigate).toHaveBeenCalled();
  });
});

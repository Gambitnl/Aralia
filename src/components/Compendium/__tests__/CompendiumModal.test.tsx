/**
 * @file src/components/Compendium/__tests__/CompendiumModal.test.tsx
 *
 * Unit tests for the CompendiumModal and CompendiumRuleTables unified dashboard.
 *
 * Tests:
 * - Modal mounting/unmounting based on isOpen prop.
 * - Tab switching across Conditions, Cover, Actions, Masteries, and All Tables.
 * - Unified cross-table search on the All Tables tab.
 * - Escape key dismissing the modal.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompendiumModal } from '../CompendiumModal';
import { CompendiumRuleTables } from '../CompendiumRuleTables';

describe('CompendiumModal and CompendiumRuleTables', () => {
  it('does not render when isOpen is false', () => {
    render(<CompendiumModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('compendium-modal')).toBeNull();
  });

  it('renders correctly when isOpen is true', () => {
    render(<CompendiumModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('compendium-modal')).toBeDefined();
    expect(screen.getByText('PHB 2024 Rules Compendium')).toBeDefined();
  });

  it('switches between rule table tabs seamlessly', () => {
    render(<CompendiumRuleTables />);

    // Default tab is conditions
    expect(screen.getByTestId('condition-table-container')).toBeDefined();

    // Click Cover tab
    fireEvent.click(screen.getByTestId('tab-cover'));
    expect(screen.getByTestId('cover-obscurement-table-container')).toBeDefined();
    expect(screen.queryByTestId('condition-table-container')).toBeNull();

    // Click Actions tab
    fireEvent.click(screen.getByTestId('tab-actions'));
    expect(screen.getByTestId('combat-actions-table-container')).toBeDefined();

    // Click Masteries tab
    fireEvent.click(screen.getByTestId('tab-masteries'));
    expect(screen.getByTestId('weapon-mastery-table-container')).toBeDefined();
  });

  it('performs unified search across all 4 rule categories on the All Tables tab', () => {
    render(<CompendiumRuleTables initialTab="all" />);

    expect(screen.getByTestId('unified-search-results')).toBeDefined();

    const searchInput = screen.getByLabelText('Global rule search');
    fireEvent.change(searchInput, { target: { value: 'prone' } });

    // Should find results matching prone
    expect(screen.getAllByText(/Prone/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Mastery: Topple')).toBeDefined();
  });

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(<CompendiumModal isOpen={true} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalled();
  });
});

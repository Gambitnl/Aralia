/**
 * @file src/components/Compendium/__tests__/CoverObscurementTable.test.tsx
 *
 * Unit tests for the CoverObscurementTable component and Cover & Obscurement dataset.
 *
 * Tests:
 * - Rendering of Half Cover, Three-Quarters Cover, Total Cover, Lightly Obscured, and Heavily Obscured.
 * - AC and Dexterity saving throw bonus badges (+2, +5).
 * - Type tabs filtering (All vs Cover vs Obscurement).
 * - Search keyword filtering.
 * - Cross-reference navigation.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CoverObscurementTable } from '../CoverObscurementTable';

describe('CoverObscurementTable Component', () => {
  it('renders all 3 cover tiers and 2 obscurement levels', () => {
    render(<CoverObscurementTable />);

    expect(screen.getByText('Half Cover')).toBeDefined();
    expect(screen.getByText('Three-Quarters Cover')).toBeDefined();
    expect(screen.getByText('Total Cover')).toBeDefined();
    expect(screen.getByText('Lightly Obscured')).toBeDefined();
    expect(screen.getByText('Heavily Obscured')).toBeDefined();
  });

  it('displays accurate AC and Dex Save bonuses (+2 and +5)', () => {
    render(<CoverObscurementTable />);

    expect(screen.getByText('+2 to AC')).toBeDefined();
    expect(screen.getByText('+2 to Dex Saves')).toBeDefined();
    expect(screen.getByText('+5 to AC')).toBeDefined();
    expect(screen.getByText('+5 to Dex Saves')).toBeDefined();
  });

  it('filters by category tabs (Cover vs Obscurement)', () => {
    render(<CoverObscurementTable />);

    // Click Cover tab
    const coverTab = screen.getByRole('button', { name: /Cover \(3\)/i });
    fireEvent.click(coverTab);

    expect(screen.getByText('Half Cover')).toBeDefined();
    expect(screen.getByText('Three-Quarters Cover')).toBeDefined();
    expect(screen.getByText('Total Cover')).toBeDefined();
    expect(screen.queryByText('Lightly Obscured')).toBeNull();
    expect(screen.queryByText('Heavily Obscured')).toBeNull();

    // Click Obscurement tab
    const obscurementTab = screen.getByRole('button', { name: /Obscurement \(2\)/i });
    fireEvent.click(obscurementTab);

    expect(screen.queryByText('Half Cover')).toBeNull();
    expect(screen.getByText('Lightly Obscured')).toBeDefined();
    expect(screen.getByText('Heavily Obscured')).toBeDefined();
  });

  it('filters by search keyword', () => {
    render(<CoverObscurementTable />);

    const searchInput = screen.getByLabelText('Search cover and obscurement');
    fireEvent.change(searchInput, { target: { value: 'arrow slit' } });

    expect(screen.getByText('Three-Quarters Cover')).toBeDefined();
    expect(screen.queryByText('Half Cover')).toBeNull();
    expect(screen.queryByText('Lightly Obscured')).toBeNull();
  });

  it('calls onNavigate callback when clicking cross-reference terms', () => {
    const handleNavigate = vi.fn();
    render(<CoverObscurementTable onNavigate={handleNavigate} />);

    const seeAlsoButtons = screen.getAllByRole('button', { name: /armor class|dexterity|darkness/i });
    expect(seeAlsoButtons.length).toBeGreaterThan(0);

    fireEvent.click(seeAlsoButtons[0]);
    expect(handleNavigate).toHaveBeenCalled();
  });
});

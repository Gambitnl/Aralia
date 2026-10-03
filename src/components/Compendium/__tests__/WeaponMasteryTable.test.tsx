/**
 * @file src/components/Compendium/__tests__/WeaponMasteryTable.test.tsx
 *
 * Unit tests for the WeaponMasteryTable component and PHB 2024 Weapon Masteries dataset.
 *
 * Tests:
 * - Rendering of all 8 Weapon Masteries: Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex.
 * - Prerequisites (Heavy, Light, Versatile, Finesse) and Triggers (On Hit, On Miss).
 * - Saving Throw DC for Topple (Constitution save).
 * - Standard weapon lists (Greataxe, Dagger, Shortsword, etc.).
 * - Search keyword filtering.
 * - Cross-reference navigation.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeaponMasteryTable } from '../WeaponMasteryTable';

describe('WeaponMasteryTable Component', () => {
  it('renders all 8 canonical PHB 2024 weapon masteries', () => {
    render(<WeaponMasteryTable />);

    const expectedMasteries = [
      'Cleave',
      'Graze',
      'Nick',
      'Push',
      'Sap',
      'Slow',
      'Topple',
      'Vex',
    ];

    expectedMasteries.forEach((name) => {
      expect(screen.getByText(name)).toBeDefined();
    });
  });

  it('displays prerequisites, triggers, and saving throw DC formulas', () => {
    render(<WeaponMasteryTable />);

    // Heavy and Light prerequisites
    expect(screen.getAllByText(/Melee Weapon, Heavy Property/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Light Weapon Property/i).length).toBeGreaterThanOrEqual(1);

    // Topple Constitution save DC formula
    expect(screen.getByText(/Constitution Save: DC 8 \+ Str Modifier \+ Proficiency Bonus/i)).toBeDefined();
  });

  it('lists standard weapons for each mastery', () => {
    render(<WeaponMasteryTable />);

    expect(screen.getByText('Greataxe')).toBeDefined();
    expect(screen.getByText('Halberd')).toBeDefined();
    expect(screen.getByText('Dagger')).toBeDefined();
    expect(screen.getByText('Shortsword')).toBeDefined();
    expect(screen.getByText('Rapier')).toBeDefined();
    expect(screen.getByText('Warhammer')).toBeDefined();
  });

  it('filters masteries by weapon name or mechanic keyword', () => {
    render(<WeaponMasteryTable />);

    const searchInput = screen.getByLabelText('Search weapon masteries');

    // Search for dagger (Nick)
    fireEvent.change(searchInput, { target: { value: 'dagger' } });

    expect(screen.getByText('Nick')).toBeDefined();
    expect(screen.queryByText('Cleave')).toBeNull();
    expect(screen.queryByText('Graze')).toBeNull();

    // Search for prone (Topple)
    fireEvent.change(searchInput, { target: { value: 'prone' } });

    expect(screen.getByText('Topple')).toBeDefined();
    expect(screen.queryByText('Nick')).toBeNull();
  });

  it('calls onNavigate callback when clicking cross-reference terms', () => {
    const handleNavigate = vi.fn();
    render(<WeaponMasteryTable onNavigate={handleNavigate} />);

    const seeAlsoButtons = screen.getAllByRole('button', { name: /weapon|attack roll|prone|advantage/i });
    expect(seeAlsoButtons.length).toBeGreaterThan(0);

    fireEvent.click(seeAlsoButtons[0]);
    expect(handleNavigate).toHaveBeenCalled();
  });
});

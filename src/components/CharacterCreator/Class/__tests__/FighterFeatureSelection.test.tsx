import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FighterFeatureSelection from '../FighterFeatureSelection';
import { FightingStyle } from '../../../../types';

/**
 * Tests for the Fighter Feature Selection component.
 *
 * When a player chooses the Fighter class, this component prompts them to pick their
 * Level 1 Fighting Style (e.g. Archery, Defense, Dueling, Great Weapon Fighting, Two-Weapon Fighting).
 *
 * Connected to: CharacterCreator (Step 2b: Fighter Class Feature Selection)
 * Tests: Fighting style options rendering, card selection, confirmation gating, submit callbacks.
 */

// ============================================================================
// Mock Data
// ============================================================================

const mockFightingStyles: FightingStyle[] = [
  {
    id: 'archery',
    name: 'Archery',
    description: 'You gain a +2 bonus to attack rolls you make with ranged weapons.',
  },
  {
    id: 'defense',
    name: 'Defense',
    description: 'While you are wearing armor, you gain a +1 bonus to AC.',
  },
  {
    id: 'dueling',
    name: 'Dueling',
    description: 'When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls.',
  },
];

describe('FighterFeatureSelection', () => {
  // ============================================================================
  // Initial Render Tests
  // ============================================================================

  it('renders all fighting styles and keeps submit disabled until one is selected', () => {
    const onStyleSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <FighterFeatureSelection
        styles={mockFightingStyles}
        onStyleSelect={onStyleSelect}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Choose Fighting Style')).toBeInTheDocument();
    expect(screen.getByText('Archery')).toBeInTheDocument();
    expect(screen.getByText('Defense')).toBeInTheDocument();
    expect(screen.getByText('Dueling')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Style/i });
    expect(confirmButton).toBeDisabled();
  });

  // ============================================================================
  // Selection and Submit Tests
  // ============================================================================

  it('selects Defense fighting style and submits successfully', () => {
    const onStyleSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <FighterFeatureSelection
        styles={mockFightingStyles}
        onStyleSelect={onStyleSelect}
        onBack={onBack}
      />
    );

    const defenseButton = screen.getByRole('button', { name: /Defense/i });
    fireEvent.click(defenseButton);
    expect(defenseButton).toHaveAttribute('aria-pressed', 'true');

    const confirmButton = screen.getByRole('button', { name: /Confirm Style/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onStyleSelect).toHaveBeenCalledTimes(1);
    expect(onStyleSelect).toHaveBeenCalledWith(mockFightingStyles[1]);
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('calls onBack when back button is pressed', () => {
    const onStyleSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <FighterFeatureSelection
        styles={mockFightingStyles}
        onStyleSelect={onStyleSelect}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

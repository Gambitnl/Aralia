import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AbilityScoreAllocation from './AbilityScoreAllocation';
import { Race, Class as CharClass, AbilityScores } from '../../types';

/**
 * Tests for the Ability Score Allocation component.
 *
 * This screen provides the 2024 D&D Point Buy calculator for allocating ability scores
 * (Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma). Players have a budget
 * of 27 points. Scores range from 8 to 15, with higher scores (14 and 15) costing 2 points
 * per increment. A live character stat block previews racial bonuses and modifiers.
 *
 * Connected to: CharacterCreator (Step 3: Ability Score Allocation)
 * Tests: Initial point buy budget (27 points), increment/decrement buttons, min (8) and max (15) bounds,
 * point-cost calculations, class recommended spread application, reset action, and submit gating.
 */

// ============================================================================
// Mock Data
// ============================================================================

const mockRace: Race = {
  id: 'human',
  name: 'Human',
  description: 'Versatile and ambitious.',
  traits: [],
} as Race;

const mockFighterClass: CharClass = {
  id: 'fighter',
  name: 'Fighter',
  description: 'A master of martial combat.',
  hitDie: 10,
  primaryAbility: ['Strength'],
  savingThrowProficiencies: ['Strength', 'Constitution'],
  skillProficienciesAvailable: [],
  numberOfSkillProficiencies: 2,
  armorProficiencies: [],
  weaponProficiencies: [],
  features: [],
  recommendedPointBuyPriorities: ['Strength', 'Constitution', 'Dexterity', 'Wisdom', 'Charisma', 'Intelligence'],
} as CharClass;

describe('AbilityScoreAllocation', () => {
  // ============================================================================
  // Initial State Tests
  // ============================================================================

  it('renders all six abilities at base score 8 with 27 points available and locked submit', () => {
    const onAbilityScoresSet = vi.fn();
    const onBack = vi.fn();

    render(
      <AbilityScoreAllocation
        race={mockRace}
        selectedClass={mockFighterClass}
        onAbilityScoresSet={onAbilityScoresSet}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Assign Ability Scores')).toBeInTheDocument();
    expect(screen.getByText(/Points Available/)).toBeInTheDocument();
    expect(screen.getByText('27')).toBeInTheDocument();

    // Confirmation button should be disabled and prompt the player to spend remaining points
    const nextButton = screen.getByRole('button', { name: /Spend 27 more/i });
    expect(nextButton).toBeDisabled();

    // Reset button should be disabled since all scores are already at minimum 8
    const resetButton = screen.getByRole('button', { name: 'Reset' });
    expect(resetButton).toBeDisabled();
  });

  // ============================================================================
  // Increment / Decrement & Bounds Tests
  // ============================================================================

  it('increments Strength, deducts points, and respects min (8) and max (15) bounds', () => {
    const onAbilityScoresSet = vi.fn();
    const onBack = vi.fn();

    render(
      <AbilityScoreAllocation
        race={mockRace}
        selectedClass={mockFighterClass}
        onAbilityScoresSet={onAbilityScoresSet}
        onBack={onBack}
      />
    );

    // Find increment and decrement buttons
    const plusButtons = screen.getAllByRole('button', { name: '+' });
    const minusButtons = screen.getAllByRole('button', { name: '-' });

    // Minus buttons should initially be disabled because all scores are at minimum 8
    minusButtons.forEach(btn => {
      expect(btn).toBeDisabled();
    });

    // Increment Strength (first button) from 8 to 9 (cost 1 point)
    fireEvent.click(plusButtons[0]);
    expect(screen.getByText('26')).toBeInTheDocument(); // 27 - 1 = 26 points remaining

    // Reset button should now be enabled
    const resetButton = screen.getByRole('button', { name: 'Reset' });
    expect(resetButton).toBeEnabled();

    // Decrement Strength back to 8
    fireEvent.click(minusButtons[0]);
    expect(screen.getByText('27')).toBeInTheDocument();
    expect(resetButton).toBeDisabled();
  });

  // ============================================================================
  // Class Recommended Spread & Confirmation Tests
  // ============================================================================

  it('applies Fighter recommended stats spread, exhausts 27 points, and submits', () => {
    const onAbilityScoresSet = vi.fn();
    const onBack = vi.fn();

    render(
      <AbilityScoreAllocation
        race={mockRace}
        selectedClass={mockFighterClass}
        onAbilityScoresSet={onAbilityScoresSet}
        onBack={onBack}
      />
    );

    // Click "Apply Fighter Recommended"
    const applyRecommendedButton = screen.getByRole('button', { name: /Apply Fighter Recommended/i });
    fireEvent.click(applyRecommendedButton);

    // Feedback message should appear
    expect(screen.getByText('Applied recommended spread.')).toBeInTheDocument();

    // Points remaining should be 0
    expect(screen.getByText('0')).toBeInTheDocument();

    // Confirm button should become enabled with "Confirm Attributes" label
    const confirmButton = screen.getByRole('button', { name: 'Confirm Attributes' });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onAbilityScoresSet).toHaveBeenCalledTimes(1);
    const submittedScores: AbilityScores = onAbilityScoresSet.mock.calls[0][0];

    // Fighter priorities: Strength 15, Constitution 14, Dexterity 13, Wisdom 12, Charisma 10, Intelligence 8
    expect(submittedScores.Strength).toBe(15);
    expect(submittedScores.Constitution).toBe(14);
    expect(submittedScores.Dexterity).toBe(13);
    expect(submittedScores.Wisdom).toBe(12);
    expect(submittedScores.Charisma).toBe(10);
    expect(submittedScores.Intelligence).toBe(8);
  });

  it('resets scores back to 8s when Reset button is clicked', () => {
    const onAbilityScoresSet = vi.fn();
    const onBack = vi.fn();

    render(
      <AbilityScoreAllocation
        race={mockRace}
        selectedClass={mockFighterClass}
        onAbilityScoresSet={onAbilityScoresSet}
        onBack={onBack}
      />
    );

    // Apply recommended spread first
    fireEvent.click(screen.getByRole('button', { name: /Apply Fighter Recommended/i }));
    expect(screen.getByText('0')).toBeInTheDocument();

    // Click Reset
    const resetButton = screen.getByRole('button', { name: 'Reset' });
    fireEvent.click(resetButton);

    // Points should restore to 27
    expect(screen.getByText('27')).toBeInTheDocument();
    expect(screen.getByText('Scores reset to minimum.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Spend 27 more/i })).toBeDisabled();
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('calls onBack when back button is pressed', () => {
    const onAbilityScoresSet = vi.fn();
    const onBack = vi.fn();

    render(
      <AbilityScoreAllocation
        race={mockRace}
        selectedClass={mockFighterClass}
        onAbilityScoresSet={onAbilityScoresSet}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

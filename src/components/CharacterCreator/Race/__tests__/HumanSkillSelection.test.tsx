import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HumanSkillSelection from '../HumanSkillSelection';
import { AbilityScores } from '../../../../types';

/**
 * Tests for the Human Skill Selection component.
 *
 * In the 2024 rules, Human characters gain the "Skillful" racial trait, which grants
 * them proficiency in one extra skill of their choice from the complete skill list.
 *
 * Connected to: CharacterCreator (during Human racial skill configuration)
 * Tests: Skill grid rendering, modifier calculations based on ability scores, selection state, and submit action.
 */

// ============================================================================
// Mock Ability Scores
// ============================================================================

const mockAbilityScores: AbilityScores = {
  Strength: 16,     // +3
  Dexterity: 14,    // +2
  Constitution: 12, // +1
  Intelligence: 10, // +0
  Wisdom: 8,        // -1
  Charisma: 13,     // +1
};

describe('HumanSkillSelection', () => {
  // ============================================================================
  // Rendering Tests
  // ============================================================================

  it('renders skill options with calculated ability score modifiers', () => {
    const onSkillSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <HumanSkillSelection
        abilityScores={mockAbilityScores}
        onSkillSelect={onSkillSelect}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Human: Skillful')).toBeInTheDocument();
    expect(screen.getByText(/As a Human, you gain proficiency in one additional skill/i)).toBeInTheDocument();

    // Athletics is based on Strength (+3 modifier with 16)
    expect(screen.getByText('Athletics')).toBeInTheDocument();
    expect(screen.getAllByText('+3').length).toBeGreaterThanOrEqual(1);

    // Perception is based on Wisdom (-1 modifier with 8)
    expect(screen.getByText('Perception')).toBeInTheDocument();
    expect(screen.getAllByText('-1').length).toBeGreaterThanOrEqual(1);

    const confirmButton = screen.getByRole('button', { name: /Confirm Skill/i });
    expect(confirmButton).toBeDisabled();
  });

  // ============================================================================
  // Selection and Submit Tests
  // ============================================================================

  it('allows picking a skill and submitting the selection', () => {
    const onSkillSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <HumanSkillSelection
        abilityScores={mockAbilityScores}
        onSkillSelect={onSkillSelect}
        onBack={onBack}
      />
    );

    // Click Acrobatics
    const acrobaticsBtn = screen.getByRole('button', { name: /Acrobatics/i });
    fireEvent.click(acrobaticsBtn);
    expect(acrobaticsBtn).toHaveAttribute('aria-pressed', 'true');

    // Confirm button should be enabled
    const confirmButton = screen.getByRole('button', { name: /Confirm Skill/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onSkillSelect).toHaveBeenCalledTimes(1);
    expect(onSkillSelect).toHaveBeenCalledWith('acrobatics');
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('calls onBack when back button is pressed', () => {
    const onSkillSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <HumanSkillSelection
        abilityScores={mockAbilityScores}
        onSkillSelect={onSkillSelect}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

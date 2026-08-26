import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CentaurNaturalAffinitySkillSelection from '../CentaurNaturalAffinitySkillSelection';

/**
 * Tests for the Centaur Natural Affinity Skill Selection component.
 *
 * Centaur heroes have a primal bond with nature and choose one skill proficiency
 * from: Animal Handling, Medicine, Nature, or Survival.
 *
 * Connected to: CharacterCreator (during Centaur race configuration)
 * Tests: Specialized skill options, selection highlighting, confirmation gating, submit callbacks.
 */

describe('CentaurNaturalAffinitySkillSelection', () => {
  // ============================================================================
  // Initial Render & State Tests
  // ============================================================================

  it('renders all four natural affinity options and disables confirm initially', () => {
    const onSkillSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <CentaurNaturalAffinitySkillSelection
        onSkillSelect={onSkillSelect}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Natural Affinity')).toBeInTheDocument();
    expect(screen.getByText('Animal Handling')).toBeInTheDocument();
    expect(screen.getByText('Medicine')).toBeInTheDocument();
    expect(screen.getByText('Nature')).toBeInTheDocument();
    expect(screen.getByText('Survival')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Skill/i });
    expect(confirmButton).toBeDisabled();
  });

  // ============================================================================
  // Selection and Submit Tests
  // ============================================================================

  it('selects Survival and submits selection', () => {
    const onSkillSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <CentaurNaturalAffinitySkillSelection
        onSkillSelect={onSkillSelect}
        onBack={onBack}
      />
    );

    const survivalButton = screen.getByRole('button', { name: /Survival/i });
    fireEvent.click(survivalButton);
    expect(survivalButton).toHaveAttribute('aria-pressed', 'true');

    const confirmButton = screen.getByRole('button', { name: /Confirm Skill/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onSkillSelect).toHaveBeenCalledTimes(1);
    expect(onSkillSelect).toHaveBeenCalledWith('survival');
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('calls onBack when back button is pressed', () => {
    const onSkillSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <CentaurNaturalAffinitySkillSelection
        onSkillSelect={onSkillSelect}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

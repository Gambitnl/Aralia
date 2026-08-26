import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChangelingInstinctsSelection from '../ChangelingInstinctsSelection';

/**
 * Tests for the Changeling Instincts Selection component.
 *
 * Changeling heroes select exactly two skill proficiencies from the social arts:
 * Deception, Insight, Intimidation, Performance, or Persuasion.
 *
 * Connected to: CharacterCreator (during Changeling race configuration)
 * Tests: Skill pool rendering, 2-skill quota validation, toggle behavior, submit gating.
 */

describe('ChangelingInstinctsSelection', () => {
  // ============================================================================
  // Initial Render Tests
  // ============================================================================

  it('renders changeling instinct skill choices and starts with 2 selections remaining', () => {
    const onSkillsSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <ChangelingInstinctsSelection
        onSkillsSelect={onSkillsSelect}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Changeling Instincts')).toBeInTheDocument();
    expect(screen.getByText('Deception')).toBeInTheDocument();
    expect(screen.getByText('Insight')).toBeInTheDocument();
    expect(screen.getByText('Intimidation')).toBeInTheDocument();
    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('Persuasion')).toBeInTheDocument();

    expect(screen.getByText('Selections Remaining:')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Skills/i });
    expect(confirmButton).toBeDisabled();
  });

  // ============================================================================
  // Multi-Selection and Toggle Tests
  // ============================================================================

  it('allows selecting 2 skills and enables confirmation only when exactly 2 are selected', () => {
    const onSkillsSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <ChangelingInstinctsSelection
        onSkillsSelect={onSkillsSelect}
        onBack={onBack}
      />
    );

    const confirmButton = screen.getByRole('button', { name: /Confirm Skills/i });

    // Select Deception (1/2)
    const deceptionBtn = screen.getByRole('button', { name: /Deception/i });
    fireEvent.click(deceptionBtn);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(confirmButton).toBeDisabled();

    // Select Persuasion (2/2)
    const persuasionBtn = screen.getByRole('button', { name: /Persuasion/i });
    fireEvent.click(persuasionBtn);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(confirmButton).toBeEnabled();

    // Submit selection
    fireEvent.click(confirmButton);
    expect(onSkillsSelect).toHaveBeenCalledTimes(1);
    const selectedSkills = onSkillsSelect.mock.calls[0][0];
    expect(selectedSkills).toContain('deception');
    expect(selectedSkills).toContain('persuasion');
  });

  it('allows unselecting a skill to choose a different one', () => {
    const onSkillsSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <ChangelingInstinctsSelection
        onSkillsSelect={onSkillsSelect}
        onBack={onBack}
      />
    );

    const deceptionBtn = screen.getByRole('button', { name: /Deception/i });
    const insightBtn = screen.getByRole('button', { name: /Insight/i });
    const performanceBtn = screen.getByRole('button', { name: /Performance/i });

    // Select Deception and Insight
    fireEvent.click(deceptionBtn);
    fireEvent.click(insightBtn);

    // Unselect Insight
    fireEvent.click(insightBtn);
    expect(screen.getByText('1')).toBeInTheDocument();

    // Select Performance
    fireEvent.click(performanceBtn);
    expect(screen.getByText('0')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Skills/i });
    fireEvent.click(confirmButton);

    const selectedSkills = onSkillsSelect.mock.calls[0][0];
    expect(selectedSkills).toContain('deception');
    expect(selectedSkills).toContain('performance');
    expect(selectedSkills).not.toContain('insight');
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('calls onBack when back button is pressed', () => {
    const onSkillsSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <ChangelingInstinctsSelection
        onSkillsSelect={onSkillsSelect}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

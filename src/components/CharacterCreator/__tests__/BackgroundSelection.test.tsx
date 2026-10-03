import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BackgroundSelection from '../BackgroundSelection';
import { Race } from '../../../types';

/**
 * Tests for the Background Selection component.
 *
 * In character creation, players pick their character's background (such as Acolyte,
 * Criminal, Folk Hero, Noble, Soldier). Backgrounds are filtered by character age
 * (Child, Young, Adult) to ensure narrative coherence.
 *
 * Connected to: CharacterCreator (Step 4: Background Selection)
 * Tests: Age category display, available backgrounds list, detail pane preview updates, selection callbacks.
 */

// ============================================================================
// Mock Data
// ============================================================================

const mockHumanRace: Race = {
  id: 'human',
  name: 'Human',
  description: 'Versatile and adaptable.',
  traits: [],
} as Race;

describe('BackgroundSelection', () => {
  // ============================================================================
  // Rendering & Initial State Tests
  // ============================================================================

  it('renders available adult backgrounds for a 25-year-old human and previews first background', () => {
    const onBackgroundChange = vi.fn();
    const onNext = vi.fn();
    const onBack = vi.fn();

    render(
      <BackgroundSelection
        selectedRace={mockHumanRace}
        characterAge={25}
        currentBackground={null}
        onBackgroundChange={onBackgroundChange}
        onNext={onNext}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Background Selection')).toBeInTheDocument();
    expect(screen.getByText(/Showing backgrounds appropriate for a 25-year-old Human/i)).toBeInTheDocument();

    // Confirm button should be visible for the initial default selection
    const confirmButton = screen.getByRole('button', { name: /Confirm/i });
    expect(confirmButton).toBeInTheDocument();
  });

  // ============================================================================
  // Selection and Submit Tests
  // ============================================================================

  it('selects a background from the list, updates preview, and triggers callbacks on confirm', () => {
    const onBackgroundChange = vi.fn();
    const onNext = vi.fn();
    const onBack = vi.fn();

    render(
      <BackgroundSelection
        selectedRace={mockHumanRace}
        characterAge={25}
        currentBackground={null}
        onBackgroundChange={onBackgroundChange}
        onNext={onNext}
        onBack={onBack}
      />
    );

    // Click Soldier background
    const soldierButton = screen.getByRole('button', { name: /Soldier/i });
    fireEvent.click(soldierButton);

    // Confirm button should say "Confirm Soldier"
    const confirmButton = screen.getByRole('button', { name: 'Confirm Soldier' });
    fireEvent.click(confirmButton);

    expect(onBackgroundChange).toHaveBeenCalledWith('soldier');
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  // ============================================================================
  // Age Filtering Tests
  // ============================================================================

  it('displays child age category for a 10-year-old human', () => {
    const onBackgroundChange = vi.fn();
    const onNext = vi.fn();
    const onBack = vi.fn();

    render(
      <BackgroundSelection
        selectedRace={mockHumanRace}
        characterAge={10}
        currentBackground={null}
        onBackgroundChange={onBackgroundChange}
        onNext={onNext}
        onBack={onBack}
      />
    );

    expect(screen.getByText(/Age Category:/i)).toBeInTheDocument();
    expect(screen.getByText('child')).toBeInTheDocument();
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('calls onBack when back button is pressed', () => {
    const onBackgroundChange = vi.fn();
    const onNext = vi.fn();
    const onBack = vi.fn();

    render(
      <BackgroundSelection
        selectedRace={mockHumanRace}
        characterAge={25}
        currentBackground={null}
        onBackgroundChange={onBackgroundChange}
        onNext={onNext}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

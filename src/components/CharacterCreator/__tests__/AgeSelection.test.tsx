import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AgeSelection from '../AgeSelection';
import { Race } from '../../../types';

/**
 * Tests for the Age Selection component.
 *
 * This screen allows the player to choose their character's age, with lifespan boundaries
 * and age categories (Child, Adolescent, Adult, Middle-aged, Elderly) tailored to the
 * chosen race. Age categories modify ability scores and size appropriately.
 *
 * Connected to: CharacterCreator (Step 5: Age Selection)
 * Tests: Race-specific lifespan display, age category determination, stat penalty warnings, input validation, and submit gating.
 */

// ============================================================================
// Mock Data
// ============================================================================

const mockHumanRace: Race = {
  id: 'human',
  name: 'Human',
  description: 'Versatile and adaptable.',
  traits: ['Size: Medium'],
} as Race;

const mockElfRace: Race = {
  id: 'elf',
  name: 'Elf',
  description: 'Magical people of otherworldly grace.',
  traits: ['Size: Medium'],
} as Race;

describe('AgeSelection', () => {
  // ============================================================================
  // Lifespan & Category Display Tests
  // ============================================================================

  it('renders Human lifespan (5-90 years) and adult category for age 25', () => {
    const onAgeChange = vi.fn();
    const onNext = vi.fn();
    const onBack = vi.fn();

    render(
      <AgeSelection
        selectedRace={mockHumanRace}
        currentAge={25}
        onAgeChange={onAgeChange}
        onNext={onNext}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Age Selection')).toBeInTheDocument();
    expect(screen.getByText(/Total lifespan: 5-90 years/i)).toBeInTheDocument();
    expect(screen.getByText('Adult')).toBeInTheDocument();
    expect(screen.getByText(/Adult characters have full ability scores/i)).toBeInTheDocument();

    const nextButton = screen.getByRole('button', { name: /Next/i });
    expect(nextButton).toBeEnabled();
  });

  it('renders Elf lifespan (50-800 years) and adolescent category for age 90', () => {
    const onAgeChange = vi.fn();
    const onNext = vi.fn();
    const onBack = vi.fn();

    render(
      <AgeSelection
        selectedRace={mockElfRace}
        currentAge={90}
        onAgeChange={onAgeChange}
        onNext={onNext}
        onBack={onBack}
      />
    );

    expect(screen.getByText(/Total lifespan: 50-800 years/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Adolescent/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/-1 to all/i).length).toBeGreaterThan(0);
  });

  // ============================================================================
  // Input Validation and Change Tests
  // ============================================================================

  it('validates age input and disables submit when out of range', () => {
    const onAgeChange = vi.fn();
    const onNext = vi.fn();
    const onBack = vi.fn();

    render(
      <AgeSelection
        selectedRace={mockHumanRace}
        currentAge={25}
        onAgeChange={onAgeChange}
        onNext={onNext}
        onBack={onBack}
      />
    );

    const input = screen.getByRole('spinbutton');

    // Change to valid age 30
    fireEvent.change(input, { target: { value: '30' } });
    expect(onAgeChange).toHaveBeenCalledWith(30);

    // Change to invalid age 200 (Human max is 90)
    fireEvent.change(input, { target: { value: '200' } });
    expect(screen.getByText(/Age must be between 5 and 90 years/i)).toBeInTheDocument();

    const nextButton = screen.getByRole('button', { name: /Next/i });
    expect(nextButton).toBeDisabled();
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('calls onNext on submit with valid age', () => {
    const onAgeChange = vi.fn();
    const onNext = vi.fn();
    const onBack = vi.fn();

    render(
      <AgeSelection
        selectedRace={mockHumanRace}
        currentAge={25}
        onAgeChange={onAgeChange}
        onNext={onNext}
        onBack={onBack}
      />
    );

    const nextButton = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextButton);

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('calls onBack when back button is clicked', () => {
    const onAgeChange = vi.fn();
    const onNext = vi.fn();
    const onBack = vi.fn();

    render(
      <AgeSelection
        selectedRace={mockHumanRace}
        currentAge={25}
        onAgeChange={onAgeChange}
        onNext={onNext}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

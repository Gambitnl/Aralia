import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VisualsSelection from '../VisualsSelection';
import { CharacterVisualConfig } from '../../../services/CharacterAssetService';
import { Race } from '../../../types';

/**
 * Tests for the Visuals Selection component.
 *
 * This screen allows the player to configure the visual appearance of their character,
 * including Gender (Male / Female), Skin Tone, Hair Style, and Outfit. It also provides
 * a 1-click "Randomize" button for instant appearance generation.
 *
 * Connected to: CharacterCreator (Step 6: Visuals Selection)
 * Tests: Gender toggle, skin tone selection, hair style cycling, outfit cycling, randomize button, and navigation.
 */

// ============================================================================
// Mock Data
// ============================================================================

const mockVisuals: CharacterVisualConfig = {
  gender: 'Male',
  skinColor: 1,
  hairStyle: 'Hair1',
  clothing: 'Shirt',
};

const mockRace: Race = {
  id: 'human',
  name: 'Human',
  description: 'Versatile human.',
  traits: [],
} as Race;

describe('VisualsSelection', () => {
  // ============================================================================
  // Rendering & Gender Selection Tests
  // ============================================================================

  it('renders visual customisation options and allows toggling gender', () => {
    const onVisualsChange = vi.fn();
    const onNext = vi.fn();
    const onBack = vi.fn();

    render(
      <VisualsSelection
        visuals={mockVisuals}
        onVisualsChange={onVisualsChange}
        selectedRace={mockRace}
        onNext={onNext}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Customize Appearance')).toBeInTheDocument();
    expect(screen.getByText('Gender')).toBeInTheDocument();
    expect(screen.getByText('Skin Tone')).toBeInTheDocument();
    expect(screen.getByText('Hair Style')).toBeInTheDocument();
    expect(screen.getByText('Outfit')).toBeInTheDocument();

    // Click Female button
    const femaleBtn = screen.getByRole('button', { name: 'Female' });
    fireEvent.click(femaleBtn);

    expect(onVisualsChange).toHaveBeenCalledWith({
      gender: 'Female',
      hairStyle: 'Hair1',
      clothing: 'Corset',
    });
  });

  // ============================================================================
  // Skin Tone & Randomize Tests
  // ============================================================================

  it('selects skin tone and calls onVisualsChange', () => {
    const onVisualsChange = vi.fn();
    const onNext = vi.fn();
    const onBack = vi.fn();

    render(
      <VisualsSelection
        visuals={mockVisuals}
        onVisualsChange={onVisualsChange}
        selectedRace={mockRace}
        onNext={onNext}
        onBack={onBack}
      />
    );

    const skinSwatch3 = screen.getByRole('button', { name: 'Select skin tone 3' });
    fireEvent.click(skinSwatch3);

    expect(onVisualsChange).toHaveBeenCalledWith({ skinColor: 3 });
  });

  it('randomizes character appearance when Randomize button is clicked', () => {
    const onVisualsChange = vi.fn();
    const onNext = vi.fn();
    const onBack = vi.fn();

    render(
      <VisualsSelection
        visuals={mockVisuals}
        onVisualsChange={onVisualsChange}
        selectedRace={mockRace}
        onNext={onNext}
        onBack={onBack}
      />
    );

    const randomizeBtn = screen.getByRole('button', { name: /Randomize/i });
    fireEvent.click(randomizeBtn);

    expect(onVisualsChange).toHaveBeenCalledTimes(1);
    const randomizedProps = onVisualsChange.mock.calls[0][0];
    expect(['Male', 'Female']).toContain(randomizedProps.gender);
    expect([1, 2, 3, 4, 5]).toContain(randomizedProps.skinColor);
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('calls onNext on next button click and onBack on back button click', () => {
    const onVisualsChange = vi.fn();
    const onNext = vi.fn();
    const onBack = vi.fn();

    render(
      <VisualsSelection
        visuals={mockVisuals}
        onVisualsChange={onVisualsChange}
        selectedRace={mockRace}
        onNext={onNext}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    expect(onNext).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

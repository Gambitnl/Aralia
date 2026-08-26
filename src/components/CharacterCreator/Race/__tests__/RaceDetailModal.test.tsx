import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RaceDetailModal, { RaceForModal } from '../RaceDetailModal';

/**
 * Tests for the Race Detail Modal component.
 *
 * This modal pops up when a player clicks a race card or detail button in the character
 * creator. It gives a full breakdown of the race's lore, speed, darkvision, size,
 * ancestral traits, and spell progression tables.
 *
 * Connected to: RaceSelection, CharacterCreator
 * Tests: Lore and base traits display, collapsible trait headers, confirm selection trigger, and close modal.
 */

// ============================================================================
// Mock Data
// ============================================================================

const mockRace: RaceForModal = {
  id: 'air_genasi',
  name: 'Air Genasi',
  description: 'Air genasi are descendants of the djinn, carrying the breath of the endless sky.',
  baseTraits: {
    type: 'Humanoid',
    size: 'Medium',
    speed: 35,
    darkvision: 60,
  },
  feats: [
    {
      name: 'Unending Breath',
      description: 'You can hold your breath indefinitely while you are not incapacitated.',
    },
    {
      name: 'Mingle with the Wind',
      description: 'You know the shocking grasp cantrip. Starting at 3rd level, you can also cast the feather fall spell with this trait, without requiring a material component.',
    },
  ],
  furtherChoicesNote: 'You must choose a spellcasting ability for your innate spells.',
};

describe('RaceDetailModal', () => {
  // ============================================================================
  // Rendering Tests
  // ============================================================================

  it('renders race traits, speed, darkvision, and description', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <RaceDetailModal
        race={mockRace}
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    expect(screen.getByText('Air Genasi')).toBeInTheDocument();
    expect(screen.getByText(/Air genasi are descendants of the djinn/i)).toBeInTheDocument();
    expect(screen.getByText(/35 ft\./i)).toBeInTheDocument();
    expect(screen.getByText(/Yes \(60 ft\.\)/i)).toBeInTheDocument();
    expect(screen.getByText('Unending Breath')).toBeInTheDocument();
    expect(screen.getByText('Mingle with the Wind')).toBeInTheDocument();
    expect(screen.getByText(/You must choose a spellcasting ability/i)).toBeInTheDocument();
  });

  // ============================================================================
  // Interaction Tests
  // ============================================================================

  it('calls onSelect with the race ID when the select button is clicked', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <RaceDetailModal
        race={mockRace}
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    const selectButton = screen.getByRole('button', { name: /Select Air Genasi/i });
    fireEvent.click(selectButton);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('air_genasi');
  });

  it('calls onClose when the back to list button is clicked', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <RaceDetailModal
        race={mockRace}
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: /Back to List/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

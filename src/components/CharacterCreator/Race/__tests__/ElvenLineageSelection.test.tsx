import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ElvenLineageSelection from '../ElvenLineageSelection';
import { ElvenLineage } from '../../../../types';

/**
 * Tests for the Elven Lineage Selection component.
 *
 * When creating an Elf hero, this component allows the player to pick between Drow,
 * High Elf, or Wood Elf lineages. Because elven lineages grant innate racial spells,
 * the player must also choose which mental ability (Intelligence, Wisdom, or Charisma)
 * powers their innate magic.
 *
 * Connected to: CharacterCreator (during Elf race configuration)
 * Tests: Lineage card selection, spellcasting ability choice, submit gating, and callback values.
 */

// ============================================================================
// Mock Data
// ============================================================================
// Sample lineages representing the core elven heritage choices.
// ============================================================================

const mockLineages: ElvenLineage[] = [
  {
    id: 'drow',
    name: 'Drow',
    description: 'Dwellers of the Underdark with innate magical darkness.',
    traits: ['Superior Darkvision'],
    benefits: [
      { level: 1, description: 'Darkvision 120ft and dancing lights cantrip', cantripId: 'dancing_lights' },
      { level: 3, description: 'Faerie Fire spell' },
      { level: 5, description: 'Darkness spell' },
    ],
  },
  {
    id: 'high_elf',
    name: 'High Elf',
    description: 'Scholarly aristocrats with a focus on arcane study.',
    traits: ['Arcane Heritage'],
    benefits: [
      { level: 1, description: 'One wizard cantrip of your choice', cantripId: 'prestidigitation' },
      { level: 3, description: 'Detect Magic spell' },
      { level: 5, description: 'Misty Step spell' },
    ],
  },
  {
    id: 'wood_elf',
    name: 'Wood Elf',
    description: 'Keen-eyed guardians of the deep forests.',
    traits: ['Fleet of Foot'],
    benefits: [
      { level: 1, description: 'Druidcraft cantrip and 35ft movement speed', cantripId: 'druidcraft' },
      { level: 3, description: 'Longstrider spell' },
      { level: 5, description: 'Pass without Trace spell' },
    ],
  },
];

describe('ElvenLineageSelection', () => {
  // ============================================================================
  // Initial State Tests
  // ============================================================================
  // Ensure lineage cards are rendered and confirm button is initially locked.
  // ============================================================================

  it('renders all lineages and disables confirmation until lineage and ability are chosen', () => {
    const onLineageSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <ElvenLineageSelection
        lineages={mockLineages}
        onLineageSelect={onLineageSelect}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Choose Your Elven Lineage')).toBeInTheDocument();
    expect(screen.getByText('Drow')).toBeInTheDocument();
    expect(screen.getByText('High Elf')).toBeInTheDocument();
    expect(screen.getByText('Wood Elf')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Lineage/i });
    expect(confirmButton).toBeDisabled();
  });

  // ============================================================================
  // Lineage & Ability Selection Tests
  // ============================================================================
  // Verify that picking a lineage reveals the spellcasting ability selector,
  // and choosing an ability enables the confirmation button.
  // ============================================================================

  it('allows selecting High Elf and Intelligence spellcasting ability', () => {
    const onLineageSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <ElvenLineageSelection
        lineages={mockLineages}
        onLineageSelect={onLineageSelect}
        onBack={onBack}
      />
    );

    // Pick High Elf
    const highElfCard = screen.getByRole('button', { name: /High Elf/i });
    fireEvent.click(highElfCard);
    expect(highElfCard).toHaveAttribute('aria-pressed', 'true');

    // Spellcasting ability selector should now appear
    expect(screen.getByText('Spellcasting Ability')).toBeInTheDocument();

    // Select Intelligence
    const intButton = screen.getByRole('button', { name: 'Intelligence' });
    fireEvent.click(intButton);
    expect(intButton).toHaveAttribute('aria-pressed', 'true');

    // Confirm button should now be enabled
    const confirmButton = screen.getByRole('button', { name: /Confirm Lineage/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onLineageSelect).toHaveBeenCalledTimes(1);
    expect(onLineageSelect).toHaveBeenCalledWith('high_elf', 'Intelligence');
  });

  it('allows selecting Wood Elf and Wisdom spellcasting ability', () => {
    const onLineageSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <ElvenLineageSelection
        lineages={mockLineages}
        onLineageSelect={onLineageSelect}
        onBack={onBack}
      />
    );

    // Pick Wood Elf
    fireEvent.click(screen.getByRole('button', { name: /Wood Elf/i }));

    // Pick Wisdom
    fireEvent.click(screen.getByRole('button', { name: 'Wisdom' }));

    const confirmButton = screen.getByRole('button', { name: /Confirm Lineage/i });
    fireEvent.click(confirmButton);

    expect(onLineageSelect).toHaveBeenCalledWith('wood_elf', 'Wisdom');
  });

  // ============================================================================
  // Back Navigation Tests
  // ============================================================================

  it('calls onBack when back button is pressed', () => {
    const onLineageSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <ElvenLineageSelection
        lineages={mockLineages}
        onLineageSelect={onLineageSelect}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

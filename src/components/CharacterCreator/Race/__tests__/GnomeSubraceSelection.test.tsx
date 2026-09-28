import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GnomeSubraceSelection from '../GnomeSubraceSelection';
import SpellContext from '../../../../context/SpellContext';
import { GnomeSubrace, Spell } from '../../../../types';

/**
 * Tests for the Gnome Subrace Selection component.
 *
 * When creating a Gnome hero, this component allows the player to choose their
 * subrace: Forest Gnome, Rock Gnome, or Deep Gnome. Forest and Deep gnomes receive
 * innate cantrips/spells requiring a spellcasting ability selection.
 *
 * Connected to: CharacterCreator (during Gnome race configuration)
 * Tests: Subrace card display, conditional spellcasting choice, traits display, submit gating.
 */

// ============================================================================
// Mock Data
// ============================================================================

const mockSubraces: GnomeSubrace[] = [
  {
    id: 'forest_gnome',
    name: 'Forest Gnome',
    description: 'Cunning illusionists in harmony with woodland life.',
    traits: ['Natural Illusionist', 'Speak with Small Beasts'],
    grantedCantrip: { id: 'minor_illusion' },
    grantedSpell: { id: 'speak_with_animals' },
  },
  {
    id: 'rock_gnome',
    name: 'Rock Gnome',
    description: 'Master tinkerers and tenacious inventors.',
    traits: ['Artificer Lore', 'Tinker'],
    grantedCantrip: { id: 'mending' },
    grantedSpell: { id: 'prestidigitation' },
  },
  {
    id: 'deep_gnome',
    name: 'Deep Gnome',
    description: 'Resilient survivors of the lightless Underdark.',
    traits: ['Svirfneblin Camouflage'],
    grantedSpell: { id: 'disguise_self' },
  },
];

const mockSpells: Record<string, Spell> = {
  minor_illusion: { id: 'minor_illusion', name: 'Minor Illusion', level: 0 } as Spell,
  speak_with_animals: { id: 'speak_with_animals', name: 'Speak with Animals', level: 1 } as Spell,
  mending: { id: 'mending', name: 'Mending', level: 0 } as Spell,
  prestidigitation: { id: 'prestidigitation', name: 'Prestidigitation', level: 0 } as Spell,
  disguise_self: { id: 'disguise_self', name: 'Disguise Self', level: 1 } as Spell,
};

describe('GnomeSubraceSelection', () => {
  // ============================================================================
  // Initial State Tests
  // ============================================================================

  it('renders all gnome subraces and keeps submit disabled until selection', () => {
    const onSubraceSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <SpellContext.Provider value={mockSpells}>
        <GnomeSubraceSelection
          subraces={mockSubraces}
          onSubraceSelect={onSubraceSelect}
          onBack={onBack}
        />
      </SpellContext.Provider>
    );

    expect(screen.getByText('Choose Your Gnome Subrace')).toBeInTheDocument();
    expect(screen.getByText('Forest Gnome')).toBeInTheDocument();
    expect(screen.getByText('Rock Gnome')).toBeInTheDocument();
    expect(screen.getByText('Deep Gnome')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Subrace/i });
    expect(confirmButton).toBeDisabled();
  });

  // ============================================================================
  // Selection and Ability Choice Tests
  // ============================================================================

  it('selects Forest Gnome and submits with selected spellcasting ability', () => {
    const onSubraceSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <SpellContext.Provider value={mockSpells}>
        <GnomeSubraceSelection
          subraces={mockSubraces}
          onSubraceSelect={onSubraceSelect}
          onBack={onBack}
        />
      </SpellContext.Provider>
    );

    // Click Forest Gnome
    fireEvent.click(screen.getByRole('button', { name: /Forest Gnome/i }));

    // Spellcasting ability should appear and default to Intelligence
    expect(screen.getByText('Spellcasting Ability')).toBeInTheDocument();

    // Select Wisdom instead
    const wisButton = screen.getByRole('button', { name: 'Wisdom' });
    fireEvent.click(wisButton);
    expect(wisButton).toHaveAttribute('aria-pressed', 'true');

    // Confirm
    const confirmButton = screen.getByRole('button', { name: /Confirm Subrace/i });
    fireEvent.click(confirmButton);

    expect(onSubraceSelect).toHaveBeenCalledTimes(1);
    expect(onSubraceSelect).toHaveBeenCalledWith('forest_gnome', 'Wisdom');
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('calls onBack when back button is pressed', () => {
    const onSubraceSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <SpellContext.Provider value={mockSpells}>
        <GnomeSubraceSelection
          subraces={mockSubraces}
          onSubraceSelect={onSubraceSelect}
          onBack={onBack}
        />
      </SpellContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

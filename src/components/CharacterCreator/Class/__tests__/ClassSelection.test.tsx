import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ClassSelection from '../ClassSelection';
import { Class as CharClass } from '../../../../types';

/**
 * Tests for the Class Selection component.
 *
 * In character creation, this component renders the available character classes in a
 * two-column split view (class selection list on the left, detailed preview with hit dice,
 * proficiencies, and armor/weapon proficiencies on the right).
 *
 * Connected to: CharacterCreator (Step 2: Class Selection)
 * Tests: Class list rendering, split-pane preview updates on selection, and confirmation callback.
 */

// ============================================================================
// Mock Data
// ============================================================================

const mockClasses: CharClass[] = [
  {
    id: 'cleric',
    name: 'Cleric',
    description: 'A priestly champion who wields divine magic.',
    hitDie: 8,
    primaryAbility: ['Wisdom'],
    savingThrowProficiencies: ['Wisdom', 'Charisma'],
    skillProficienciesAvailable: ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'],
    numberOfSkillProficiencies: 2,
    armorProficiencies: ['Light', 'Medium', 'Shields'],
    weaponProficiencies: ['Simple'],
    features: [{ id: 'spellcasting', name: 'Spellcasting', level: 1, description: 'Divine spellcasting' }],
    spellcasting: { ability: 'Wisdom', knownCantrips: 3, knownSpellsL1: 2, spellList: [] },
  },
  {
    id: 'fighter',
    name: 'Fighter',
    description: 'A master of martial combat.',
    hitDie: 10,
    primaryAbility: ['Strength', 'Dexterity'],
    savingThrowProficiencies: ['Strength', 'Constitution'],
    skillProficienciesAvailable: ['Acrobatics', 'Athletics', 'History', 'Insight', 'Intimidation', 'Perception', 'Survival'],
    numberOfSkillProficiencies: 2,
    armorProficiencies: ['All armor', 'Shields'],
    weaponProficiencies: ['Simple', 'Martial'],
    features: [{ id: 'second-wind', name: 'Second Wind', level: 1, description: 'Regain hit points' }],
  },
  {
    id: 'wizard',
    name: 'Wizard',
    description: 'A scholarly magic-user capable of manipulating reality.',
    hitDie: 6,
    primaryAbility: ['Intelligence'],
    savingThrowProficiencies: ['Intelligence', 'Wisdom'],
    skillProficienciesAvailable: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion'],
    numberOfSkillProficiencies: 2,
    armorProficiencies: [],
    weaponProficiencies: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light Crossbows'],
    features: [{ id: 'arcane-recovery', name: 'Arcane Recovery', level: 1, description: 'Regain spell slots' }],
    spellcasting: { ability: 'Intelligence', knownCantrips: 3, knownSpellsL1: 6, spellList: [] },
  },
] as unknown as CharClass[];

describe('ClassSelection', () => {
  // ============================================================================
  // Rendering & Initial Selection Tests
  // ============================================================================

  it('renders all available classes and defaults preview to the first alphabetical class', () => {
    const onClassSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <ClassSelection
        classes={mockClasses}
        onClassSelect={onClassSelect}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Choose Your Class')).toBeInTheDocument();

    // Classes should appear in sorted list buttons
    expect(screen.getByRole('button', { name: /Cleric icon/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fighter icon/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wizard icon/i })).toBeInTheDocument();

    // The first class (Cleric) is selected by default in the preview
    expect(screen.getByText('A priestly champion who wields divine magic.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Cleric/i })).toBeInTheDocument();
  });

  // ============================================================================
  // Selection Switching & Confirmation Tests
  // ============================================================================

  it('updates the preview and confirmation button when selecting a different class', () => {
    const onClassSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <ClassSelection
        classes={mockClasses}
        onClassSelect={onClassSelect}
        onBack={onBack}
      />
    );

    // Click Fighter in the list
    const fighterListItem = screen.getByRole('button', { name: /Fighter icon/i });
    fireEvent.click(fighterListItem);

    // Preview should now show Fighter details
    expect(screen.getByText('A master of martial combat.')).toBeInTheDocument();

    // Click confirm button
    const confirmButton = screen.getByRole('button', { name: /Confirm Fighter/i });
    fireEvent.click(confirmButton);

    expect(onClassSelect).toHaveBeenCalledTimes(1);
    expect(onClassSelect).toHaveBeenCalledWith('fighter');
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('triggers onBack when back button is clicked', () => {
    const onClassSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <ClassSelection
        classes={mockClasses}
        onClassSelect={onClassSelect}
        onBack={onBack}
      />
    );

    const backButton = screen.getByRole('button', { name: /Back/i });
    fireEvent.click(backButton);

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

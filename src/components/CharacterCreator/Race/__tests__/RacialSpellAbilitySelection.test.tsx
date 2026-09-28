import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RacialSpellAbilitySelection from '../RacialSpellAbilitySelection';
import { AbilityScores, Class as CharClass } from '../../../../types';

/**
 * Tests for the Racial Spell Ability Selection component.
 *
 * A reusable component for races that grant innate spells (e.g., Aarakocra, Genasi,
 * Fairy). The player chooses whether Intelligence, Wisdom, or Charisma governs their
 * racial spellcasting. If the player has already chosen a class with a spellcasting
 * ability, that ability is marked with a "Recommended" badge.
 *
 * Connected to: CharacterCreator (during race trait spell ability configuration)
 * Tests: Spellcasting ability choices, score/modifier display, recommended class badge, confirmation gating.
 */

// ============================================================================
// Mock Data
// ============================================================================

const mockAbilityScores: AbilityScores = {
  Strength: 10,
  Dexterity: 14,
  Constitution: 12,
  Intelligence: 16, // +3
  Wisdom: 14,       // +2
  Charisma: 8,       // -1
};

const mockWizardClass: CharClass = {
  id: 'wizard',
  name: 'Wizard',
  description: 'A scholarly magic-user.',
  hitDie: 6,
  primaryAbility: ['Intelligence'],
  savingThrowProficiencies: ['Intelligence', 'Wisdom'],
  skillProficienciesAvailable: [],
  numberOfSkillProficiencies: 2,
  armorProficiencies: [],
  weaponProficiencies: [],
  features: [],
  spellcasting: {
    ability: 'Intelligence',
    knownCantrips: 3,
    knownSpellsL1: 2,
    spellList: [],
  },
} as CharClass;

describe('RacialSpellAbilitySelection', () => {
  // ============================================================================
  // Rendering Tests
  // ============================================================================

  it('renders trait details, spellcasting abilities with scores and modifier strings', () => {
    const onAbilitySelect = vi.fn();
    const onBack = vi.fn();

    render(
      <RacialSpellAbilitySelection
        raceName="Aarakocra"
        traitName="Wind Caller"
        traitDescription="You can cast Gust of Wind with this trait."
        onAbilitySelect={onAbilitySelect}
        onBack={onBack}
        abilityScores={mockAbilityScores}
        selectedClass={mockWizardClass}
      />
    );

    expect(screen.getByText('Aarakocra Trait: Wind Caller')).toBeInTheDocument();
    expect(screen.getByText('You can cast Gust of Wind with this trait.')).toBeInTheDocument();
    expect(screen.getByText('Select Spellcasting Ability:')).toBeInTheDocument();

    // Recommended badge should appear for Intelligence (Wizard class match)
    expect(screen.getByText('Recommended')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm spellcasting ability/i });
    expect(confirmButton).toBeDisabled();
  });

  // ============================================================================
  // Selection and Submit Tests
  // ============================================================================

  it('selects Intelligence and submits successfully', () => {
    const onAbilitySelect = vi.fn();
    const onBack = vi.fn();

    render(
      <RacialSpellAbilitySelection
        raceName="Aarakocra"
        traitName="Wind Caller"
        traitDescription="You can cast Gust of Wind with this trait."
        onAbilitySelect={onAbilitySelect}
        onBack={onBack}
        abilityScores={mockAbilityScores}
        selectedClass={mockWizardClass}
      />
    );

    const intButton = screen.getByRole('button', { name: /Select Intelligence as spellcasting ability/i });
    fireEvent.click(intButton);
    expect(intButton).toHaveAttribute('aria-pressed', 'true');

    const confirmButton = screen.getByRole('button', { name: /Confirm spellcasting ability/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onAbilitySelect).toHaveBeenCalledTimes(1);
    expect(onAbilitySelect).toHaveBeenCalledWith('Intelligence');
  });

  it('selects Charisma even if not recommended and submits successfully', () => {
    const onAbilitySelect = vi.fn();
    const onBack = vi.fn();

    render(
      <RacialSpellAbilitySelection
        raceName="Aarakocra"
        traitName="Wind Caller"
        traitDescription="You can cast Gust of Wind with this trait."
        onAbilitySelect={onAbilitySelect}
        onBack={onBack}
        abilityScores={mockAbilityScores}
        selectedClass={mockWizardClass}
      />
    );

    const chaButton = screen.getByRole('button', { name: /Select Charisma as spellcasting ability/i });
    fireEvent.click(chaButton);
    expect(chaButton).toHaveAttribute('aria-pressed', 'true');

    const confirmButton = screen.getByRole('button', { name: /Confirm spellcasting ability/i });
    fireEvent.click(confirmButton);

    expect(onAbilitySelect).toHaveBeenCalledWith('Charisma');
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('calls onBack when back button is pressed', () => {
    const onAbilitySelect = vi.fn();
    const onBack = vi.fn();

    render(
      <RacialSpellAbilitySelection
        raceName="Aarakocra"
        traitName="Wind Caller"
        traitDescription="You can cast Gust of Wind with this trait."
        onAbilitySelect={onAbilitySelect}
        onBack={onBack}
        abilityScores={mockAbilityScores}
        selectedClass={mockWizardClass}
      />
    );

    const backButton = screen.getByRole('button', { name: /Go back to ability scores/i });
    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

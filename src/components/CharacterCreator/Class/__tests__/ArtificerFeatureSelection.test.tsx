import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ArtificerFeatureSelection from '../ArtificerFeatureSelection';
import { Spell, Class as CharClass, AbilityScores } from '../../../../types';

/**
 * Tests for the Artificer Feature Selection component.
 *
 * Artificers prepare spells dynamically based on their Intelligence modifier:
 * numPreparedSpells = Math.max(1, intModifier + Math.floor(1 / 2)).
 *
 * Connected to: CharacterCreator (Step 2b: Artificer Feature Selection)
 * Tests: Dynamic spell preparation calculations from Intelligence, cantrip quota, submit gating.
 */

// ============================================================================
// Mock Data
// ============================================================================

const createMockSpell = (id: string, name: string, level: number): Spell => ({
  id,
  name,
  level,
  school: 'Evocation',
  classes: [],
  subClasses: [],
  description: `${name} description.`,
  castingTime: { unit: 'action', value: 1 },
  range: { type: 'self' },
  components: { verbal: true, somatic: false, material: false },
  duration: { duration: 'Instantaneous', concentration: false },
  effects: [],
} as unknown as Spell);

const mockSpellcastingInfo = {
  ability: 'Intelligence',
  knownCantrips: 2,
  knownSpellsL1: 2,
  spellList: ['mending', 'guidance', 'shocking_grasp', 'cure_wounds', 'faerie_fire', 'absorb_elements'],
} as NonNullable<CharClass['spellcasting']>;

const mockSpells: Record<string, Spell> = {
  mending: createMockSpell('mending', 'Mending', 0),
  guidance: createMockSpell('guidance', 'Guidance', 0),
  shocking_grasp: createMockSpell('shocking_grasp', 'Shocking Grasp', 0),
  cure_wounds: createMockSpell('cure_wounds', 'Cure Wounds', 1),
  faerie_fire: createMockSpell('faerie_fire', 'Faerie Fire', 1),
  absorb_elements: createMockSpell('absorb_elements', 'Absorb Elements', 1),
};

const mockAbilityScores: AbilityScores = {
  Strength: 10,
  Dexterity: 12,
  Constitution: 14,
  Intelligence: 16, // +3 Modifier -> numPreparedSpells = 3 + 0 = 3
  Wisdom: 10,
  Charisma: 8,
};

describe('ArtificerFeatureSelection', () => {
  // ============================================================================
  // Dynamic Calculation & Render Tests
  // ============================================================================

  it('calculates prepared spell limit from Intelligence modifier (+3 -> 3 prepared spells)', () => {
    const onArtificerFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <ArtificerFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        abilityScores={mockAbilityScores}
        onArtificerFeaturesSelect={onArtificerFeaturesSelect}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Artificer Spell Selection')).toBeInTheDocument();
    expect(screen.getByText('Select Cantrips')).toBeInTheDocument();
    expect(screen.getByText('0 / 2')).toBeInTheDocument(); // Cantrips limit
    expect(screen.getByText('0 / 3')).toBeInTheDocument(); // Prepared spells limit (+3 Int mod)
    expect(screen.getByText(/Calculated from Intelligence modifier \(\+3\)/i)).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Spells/i });
    expect(confirmButton).toBeDisabled();
  });

  // ============================================================================
  // Selection and Submit Tests
  // ============================================================================

  it('selects 2 cantrips and 3 Level 1 spells, then submits successfully', () => {
    const onArtificerFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <ArtificerFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        abilityScores={mockAbilityScores}
        onArtificerFeaturesSelect={onArtificerFeaturesSelect}
        onBack={onBack}
      />
    );

    // Select 2 Cantrips
    fireEvent.click(screen.getByRole('checkbox', { name: /Mending/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Guidance/i }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    // Select 3 Level 1 Spells
    fireEvent.click(screen.getByRole('checkbox', { name: /Cure Wounds/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Faerie Fire/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Absorb Elements/i }));
    expect(screen.getByText('3 / 3')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Spells/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onArtificerFeaturesSelect).toHaveBeenCalledTimes(1);
    const [cantrips, spellsL1] = onArtificerFeaturesSelect.mock.calls[0];
    expect(cantrips).toHaveLength(2);
    expect(spellsL1).toHaveLength(3);
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('calls onBack when back button is pressed', () => {
    const onArtificerFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <ArtificerFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        abilityScores={mockAbilityScores}
        onArtificerFeaturesSelect={onArtificerFeaturesSelect}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

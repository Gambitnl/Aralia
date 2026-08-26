import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PaladinFeatureSelection from '../PaladinFeatureSelection';
import { Spell, Class as CharClass } from '../../../../types';

/**
 * Tests for the Paladin Feature Selection component.
 *
 * In the 2024 rules, Paladins gain Level 1 spellcasting and select their initial
 * known Level 1 spells during character creation according to their spellcasting info.
 *
 * Connected to: CharacterCreator (Step 2b: Paladin Spell Selection)
 * Tests: Level 1 spell list rendering, selection quota limits, toggle behavior, and submit action.
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
  ability: 'Charisma',
  knownCantrips: 0,
  knownSpellsL1: 2,
  spellList: ['bless', 'cure_wounds', 'heroism', 'divine_favor'],
} as NonNullable<CharClass['spellcasting']>;

const mockSpells: Record<string, Spell> = {
  bless: createMockSpell('bless', 'Bless', 1),
  cure_wounds: createMockSpell('cure_wounds', 'Cure Wounds', 1),
  heroism: createMockSpell('heroism', 'Heroism', 1),
  divine_favor: createMockSpell('divine_favor', 'Divine Favor', 1),
};

describe('PaladinFeatureSelection', () => {
  // ============================================================================
  // Rendering & Selection Gating Tests
  // ============================================================================

  it('renders available Level 1 spells and requires picking exactly 2 spells', () => {
    const onPaladinFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <PaladinFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onPaladinFeaturesSelect={onPaladinFeaturesSelect}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Paladin Spell Selection')).toBeInTheDocument();
    expect(screen.getByText('Select Level 1 Spells')).toBeInTheDocument();
    expect(screen.getByText('0 / 2')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Spells/i });
    expect(confirmButton).toBeDisabled();
  });

  // ============================================================================
  // Toggle & Submit Tests
  // ============================================================================

  it('selects 2 spells and enables confirmation', () => {
    const onPaladinFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <PaladinFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onPaladinFeaturesSelect={onPaladinFeaturesSelect}
        onBack={onBack}
      />
    );

    const blessCheckbox = screen.getByRole('checkbox', { name: /Bless/i });
    const cureWoundsCheckbox = screen.getByRole('checkbox', { name: /Cure Wounds/i });

    // Select Bless
    fireEvent.click(blessCheckbox);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Spells/i })).toBeDisabled();

    // Select Cure Wounds
    fireEvent.click(cureWoundsCheckbox);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Spells/i });
    expect(confirmButton).toBeEnabled();

    // Submit selection
    fireEvent.click(confirmButton);
    expect(onPaladinFeaturesSelect).toHaveBeenCalledTimes(1);
    const selectedSpells = onPaladinFeaturesSelect.mock.calls[0][0];
    expect(selectedSpells.map((s: Spell) => s.id)).toEqual(['bless', 'cure_wounds']);
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('calls onBack when back button is pressed', () => {
    const onPaladinFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <PaladinFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onPaladinFeaturesSelect={onPaladinFeaturesSelect}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

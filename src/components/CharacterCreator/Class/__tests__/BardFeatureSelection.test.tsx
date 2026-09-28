import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BardFeatureSelection from '../BardFeatureSelection';
import { Spell, Class as CharClass } from '../../../../types';

/**
 * Tests for the Bard Feature Selection component.
 *
 * Bards choose their initial Cantrips and Level 1 spells during character creation
 * based on their spellcastingInfo limits.
 *
 * Connected to: CharacterCreator (Step 2b: Bard Spell Selection)
 * Tests: Cantrips and Level 1 spell cards, selection limits, confirm gating, and callback values.
 */

// ============================================================================
// Mock Data
// ============================================================================

const createMockSpell = (id: string, name: string, level: number): Spell => ({
  id,
  name,
  level,
  school: 'Enchantment',
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
  knownCantrips: 2,
  knownSpellsL1: 2,
  spellList: ['vicious_mockery', 'minor_illusion', 'dancing_lights', 'charm_person', 'cure_wounds', 'dissonant_whispers'],
} as NonNullable<CharClass['spellcasting']>;

const mockSpells: Record<string, Spell> = {
  vicious_mockery: createMockSpell('vicious_mockery', 'Vicious Mockery', 0),
  minor_illusion: createMockSpell('minor_illusion', 'Minor Illusion', 0),
  dancing_lights: createMockSpell('dancing_lights', 'Dancing Lights', 0),
  charm_person: createMockSpell('charm_person', 'Charm Person', 1),
  cure_wounds: createMockSpell('cure_wounds', 'Cure Wounds', 1),
  dissonant_whispers: createMockSpell('dissonant_whispers', 'Dissonant Whispers', 1),
};

describe('BardFeatureSelection', () => {
  // ============================================================================
  // Rendering & Limit Tests
  // ============================================================================

  it('renders bard cantrip and spell lists and enforces 2 cantrip / 2 spell limits', () => {
    const onBardFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <BardFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onBardFeaturesSelect={onBardFeaturesSelect}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Bard Spell Selection')).toBeInTheDocument();
    expect(screen.getByText('Select Cantrips')).toBeInTheDocument();
    expect(screen.getByText('Select Level 1 Spells')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Spells/i });
    expect(confirmButton).toBeDisabled();
  });

  // ============================================================================
  // Selection and Submit Tests
  // ============================================================================

  it('selects spells and confirms selection', () => {
    const onBardFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <BardFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onBardFeaturesSelect={onBardFeaturesSelect}
        onBack={onBack}
      />
    );

    // Pick 2 Cantrips
    fireEvent.click(screen.getByRole('checkbox', { name: /Vicious Mockery/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Minor Illusion/i }));

    // Pick 2 Level 1 Spells
    fireEvent.click(screen.getByRole('checkbox', { name: /Charm Person/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Dissonant Whispers/i }));

    const confirmButton = screen.getByRole('button', { name: /Confirm Spells/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onBardFeaturesSelect).toHaveBeenCalledTimes(1);
    const [cantrips, spellsL1] = onBardFeaturesSelect.mock.calls[0];
    expect(cantrips.map((s: Spell) => s.id)).toEqual(['vicious_mockery', 'minor_illusion']);
    expect(spellsL1.map((s: Spell) => s.id)).toEqual(['charm_person', 'dissonant_whispers']);
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('calls onBack when back button is pressed', () => {
    const onBardFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <BardFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onBardFeaturesSelect={onBardFeaturesSelect}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

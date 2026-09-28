import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SorcererFeatureSelection from '../SorcererFeatureSelection';
import { Spell, Class as CharClass } from '../../../../types';

/**
 * Tests for the Sorcerer Feature Selection component.
 *
 * Sorcerers choose their innate Cantrips and Level 1 spells during character
 * creation based on their spellcastingInfo allocation (e.g. 4 cantrips, 2 L1 spells).
 *
 * Connected to: CharacterCreator (Step 2b: Sorcerer Spell Selection)
 * Tests: Cantrips and Level 1 spell cards, selection limits, confirm gating, and callback values.
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
  knownCantrips: 4,
  knownSpellsL1: 2,
  spellList: ['fire_bolt', 'ray_of_frost', 'shocking_grasp', 'minor_illusion', 'mage_hand', 'magic_missile', 'shield', 'burning_hands'],
} as NonNullable<CharClass['spellcasting']>;

const mockOrigins = [
  { id: 'draconic', name: 'Draconic Sorcery', description: 'A sorcerer whose magic springs from draconic blood.' },
  { id: 'wild_magic', name: 'Wild Magic Sorcery', description: 'A sorcerer whose power crackles with chaos.' },
];

const mockSpells: Record<string, Spell> = {
  fire_bolt: createMockSpell('fire_bolt', 'Fire Bolt', 0),
  ray_of_frost: createMockSpell('ray_of_frost', 'Ray of Frost', 0),
  shocking_grasp: createMockSpell('shocking_grasp', 'Shocking Grasp', 0),
  minor_illusion: createMockSpell('minor_illusion', 'Minor Illusion', 0),
  mage_hand: createMockSpell('mage_hand', 'Mage Hand', 0),
  magic_missile: createMockSpell('magic_missile', 'Magic Missile', 1),
  shield: createMockSpell('shield', 'Shield', 1),
  burning_hands: createMockSpell('burning_hands', 'Burning Hands', 1),
};

/**
 * Click a spell checkbox by its input id.
 *
 * `getByRole('checkbox', { name })` computes an accessible name for every node,
 * and SpellSummaryCard wraps each checkbox in a <label> holding the entire spell
 * summary, so one such query costs ~half a second in jsdom. A test that picks
 * five or six spells spent most of its five-second budget on name computation
 * alone. SpellCard already gives every input a deterministic id
 * (`${idPrefix}-${spell.id}`), so look it up directly.
 */
const clickSpell = (inputId: string) => {
  const input = document.getElementById(inputId);
  if (!input) throw new Error(`No spell checkbox with id "${inputId}"`);
  fireEvent.click(input);
};

describe('SorcererFeatureSelection', () => {
  // ============================================================================
  // Rendering & Limit Tests
  // ============================================================================

  it('renders sorcerer cantrips and spells and requires 4 cantrips and 2 level 1 spells', () => {
    const onSorcererFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <SorcererFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        origins={mockOrigins}
        rulesEdition="2024"
        allSpells={mockSpells}
        onSorcererFeaturesSelect={onSorcererFeaturesSelect}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Sorcerer Spell Selection')).toBeInTheDocument();
    expect(screen.getByText('0 / 4')).toBeInTheDocument();
    expect(screen.getByText('0 / 2')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Spells/i });
    expect(confirmButton).toBeDisabled();
  });

  // ============================================================================
  // Selection and Submit Tests
  // ============================================================================

  it('selects 4 cantrips and 2 level 1 spells and submits successfully', () => {
    const onSorcererFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <SorcererFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        origins={mockOrigins}
        rulesEdition="2024"
        allSpells={mockSpells}
        onSorcererFeaturesSelect={onSorcererFeaturesSelect}
        onBack={onBack}
      />
    );

    // Pick 4 Cantrips
    clickSpell('cantrip-fire_bolt');
    clickSpell('cantrip-ray_of_frost');
    clickSpell('cantrip-shocking_grasp');
    clickSpell('cantrip-mage_hand');
    expect(screen.getByText('4 / 4')).toBeInTheDocument();

    // Pick 2 Level 1 Spells
    clickSpell('spell1-magic_missile');
    clickSpell('spell1-shield');
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Spells/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onSorcererFeaturesSelect).toHaveBeenCalledTimes(1);
    const [cantrips, spellsL1] = onSorcererFeaturesSelect.mock.calls[0];
    expect(cantrips).toHaveLength(4);
    expect(spellsL1).toHaveLength(2);
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('calls onBack when back button is pressed', () => {
    const onSorcererFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <SorcererFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        origins={mockOrigins}
        rulesEdition="2024"
        allSpells={mockSpells}
        onSorcererFeaturesSelect={onSorcererFeaturesSelect}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // ============================================================================
  // Rules Edition Tests (agora-f821.57)
  // ============================================================================

  it('defers the Sorcerous Origin to level 3 under the 2024 rules', () => {
    render(
      <SorcererFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        origins={mockOrigins}
        rulesEdition="2024"
        allSpells={mockSpells}
        onSorcererFeaturesSelect={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText('Sorcerer Spell Selection')).toBeInTheDocument();
    expect(screen.queryByText('Choose Your Sorcerous Origin')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Draconic Sorcery/i })).not.toBeInTheDocument();
    expect(screen.getByText(/choose a Sorcerous Origin at level 3/i)).toBeInTheDocument();
  });

  it('offers the Sorcerous Origin at level 1 under the 2014 rules', () => {
    render(
      <SorcererFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        origins={mockOrigins}
        rulesEdition="2014"
        allSpells={mockSpells}
        onSorcererFeaturesSelect={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText('Sorcerous Origin & Spells')).toBeInTheDocument();
    expect(screen.getByText('Choose Your Sorcerous Origin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Draconic Sorcery/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wild Magic Sorcery/i })).toBeInTheDocument();
  });

  it('blocks confirmation under 2014 until a Sorcerous Origin is chosen, then reports it', () => {
    const onSorcererFeaturesSelect = vi.fn();

    render(
      <SorcererFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        origins={mockOrigins}
        rulesEdition="2014"
        allSpells={mockSpells}
        onSorcererFeaturesSelect={onSorcererFeaturesSelect}
        onBack={vi.fn()}
      />
    );

    clickSpell('cantrip-fire_bolt');
    clickSpell('cantrip-ray_of_frost');
    clickSpell('cantrip-shocking_grasp');
    clickSpell('cantrip-mage_hand');
    clickSpell('spell1-magic_missile');
    clickSpell('spell1-shield');

    // Every spell is picked, but the origin is not.
    expect(screen.getByRole('button', { name: /Confirm Spells/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Draconic Sorcery/i }));
    const confirmButton = screen.getByRole('button', { name: /Confirm Spells/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onSorcererFeaturesSelect).toHaveBeenCalledTimes(1);
    expect(onSorcererFeaturesSelect.mock.calls[0][2]).toBe('draconic');
  });

  it('sends no Sorcerous Origin under the 2024 rules', () => {
    const onSorcererFeaturesSelect = vi.fn();

    render(
      <SorcererFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        origins={mockOrigins}
        rulesEdition="2024"
        allSpells={mockSpells}
        onSorcererFeaturesSelect={onSorcererFeaturesSelect}
        onBack={vi.fn()}
      />
    );

    clickSpell('cantrip-fire_bolt');
    clickSpell('cantrip-ray_of_frost');
    clickSpell('cantrip-shocking_grasp');
    clickSpell('cantrip-mage_hand');
    clickSpell('spell1-magic_missile');
    clickSpell('spell1-shield');
    fireEvent.click(screen.getByRole('button', { name: /Confirm Spells/i }));

    expect(onSorcererFeaturesSelect).toHaveBeenCalledTimes(1);
    expect(onSorcererFeaturesSelect.mock.calls[0][2]).toBeUndefined();
  });
});

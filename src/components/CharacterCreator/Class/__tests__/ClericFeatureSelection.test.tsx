import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ClericFeatureSelection from '../ClericFeatureSelection';
import { DivineOrderOption, Spell, Class as CharClass } from '../../../../types';

/**
 * Tests for the Cleric Feature Selection component.
 *
 * In the 2024 rules, Clerics choose a Divine Order (Protector or Thaumaturge) at Level 1.
 * Thaumaturge grants an extra cantrip (+1 to cantrip allocation). After choosing the order,
 * the player selects cantrips and Level 1 spells.
 *
 * Connected to: CharacterCreator (Step 2b: Cleric Feature Selection)
 * Tests: Divine Order selection, dynamic cantrip quotas, Level 1 spell selection, submit callback.
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
  description: `${name} spell description.`,
  castingTime: { unit: 'action', value: 1 },
  range: { type: 'self' },
  components: { verbal: true, somatic: false, material: false },
  duration: { duration: 'Instantaneous', concentration: false },
  effects: [],
} as unknown as Spell);

const mockDivineDomains = [
  { id: 'life_domain', name: 'Life Domain', description: 'A cleric of healing and vitality.' },
  { id: 'light_domain', name: 'Light Domain', description: 'A cleric who wields radiant fire.' },
];

const mockDivineOrders: DivineOrderOption[] = [
  {
    id: 'Protector',
    name: 'Protector',
    description: 'Martial training: proficiency with martial weapons and heavy armor.',
  },
  {
    id: 'Thaumaturge',
    name: 'Thaumaturge',
    description: 'Magical training: one extra cantrip and bonus to Religion checks.',
  },
];

const mockSpellcastingInfo = {
  ability: 'Wisdom',
  knownCantrips: 3,
  knownSpellsL1: 2,
  spellList: ['sacred_flame', 'guidance', 'thaumaturgy', 'light', 'cure_wounds', 'bless', 'healing_word'],
} as NonNullable<CharClass['spellcasting']>;

const mockSpells: Record<string, Spell> = {
  sacred_flame: createMockSpell('sacred_flame', 'Sacred Flame', 0),
  guidance: createMockSpell('guidance', 'Guidance', 0),
  thaumaturgy: createMockSpell('thaumaturgy', 'Thaumaturgy', 0),
  light: createMockSpell('light', 'Light', 0),
  cure_wounds: createMockSpell('cure_wounds', 'Cure Wounds', 1),
  bless: createMockSpell('bless', 'Bless', 1),
  healing_word: createMockSpell('healing_word', 'Healing Word', 1),
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

describe('ClericFeatureSelection', () => {
  // ============================================================================
  // Initial Render & Order Selection Tests
  // ============================================================================

  it('renders divine orders and hides spell lists until an order is picked', () => {
    const onClericFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <ClericFeatureSelection
        divineOrders={mockDivineOrders}
        divineDomains={mockDivineDomains}
        rulesEdition="2024"
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onClericFeaturesSelect={onClericFeaturesSelect}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Cleric Choices')).toBeInTheDocument();
    expect(screen.getByText('Choose Divine Order')).toBeInTheDocument();
    expect(screen.getByText('Protector')).toBeInTheDocument();
    expect(screen.getByText('Thaumaturge')).toBeInTheDocument();

    // Spells section is not displayed until an order is chosen
    expect(screen.queryByText('Select Cantrips')).not.toBeInTheDocument();
  });

  // ============================================================================
  // Protector Order (3 cantrips, 2 L1 spells)
  // ============================================================================

  it('handles Protector order with 3 cantrips and 2 level 1 spells', () => {
    const onClericFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <ClericFeatureSelection
        divineOrders={mockDivineOrders}
        divineDomains={mockDivineDomains}
        rulesEdition="2024"
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onClericFeaturesSelect={onClericFeaturesSelect}
        onBack={onBack}
      />
    );

    // Pick Protector
    fireEvent.click(screen.getByText('Protector'));

    // Cantrip limit should be 3 for Protector
    expect(screen.getByText('0 / 3')).toBeInTheDocument();
    expect(screen.getByText('0 / 2')).toBeInTheDocument();

    // Select 3 cantrips
    clickSpell('cantrip-sacred_flame');
    clickSpell('cantrip-guidance');
    clickSpell('cantrip-thaumaturgy');
    expect(screen.getByText('3 / 3')).toBeInTheDocument();

    // Select 2 Level 1 spells
    clickSpell('spell1-cure_wounds');
    clickSpell('spell1-bless');
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Choices/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onClericFeaturesSelect).toHaveBeenCalledTimes(1);
    const [order, cantrips, spellsL1] = onClericFeaturesSelect.mock.calls[0];
    expect(order).toBe('Protector');
    expect(cantrips.map((s: Spell) => s.id)).toEqual(['sacred_flame', 'guidance', 'thaumaturgy']);
    expect(spellsL1.map((s: Spell) => s.id)).toEqual(['cure_wounds', 'bless']);
  });

  // ============================================================================
  // Thaumaturge Order (Dynamic +1 Cantrip: 4 cantrips, 2 L1 spells)
  // ============================================================================

  it('dynamically increases cantrip quota to 4 when selecting Thaumaturge order', () => {
    const onClericFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <ClericFeatureSelection
        divineOrders={mockDivineOrders}
        divineDomains={mockDivineDomains}
        rulesEdition="2024"
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onClericFeaturesSelect={onClericFeaturesSelect}
        onBack={onBack}
      />
    );

    // Pick Thaumaturge
    fireEvent.click(screen.getByText('Thaumaturge'));

    // Cantrip limit should now be 4
    expect(screen.getByText('0 / 4')).toBeInTheDocument();

    // Select 4 cantrips
    clickSpell('cantrip-sacred_flame');
    clickSpell('cantrip-guidance');
    clickSpell('cantrip-thaumaturgy');
    clickSpell('cantrip-light');
    expect(screen.getByText('4 / 4')).toBeInTheDocument();

    // Select 2 Level 1 spells
    clickSpell('spell1-cure_wounds');
    clickSpell('spell1-healing_word');

    const confirmButton = screen.getByRole('button', { name: /Confirm Choices/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onClericFeaturesSelect).toHaveBeenCalledTimes(1);
    expect(onClericFeaturesSelect.mock.calls[0][0]).toBe('Thaumaturge');
    expect(onClericFeaturesSelect.mock.calls[0][1]).toHaveLength(4);
  });

  // ============================================================================
  // Rules Edition Tests (agora-f821.56)
  // ============================================================================

  it('defers the Divine Domain to level 3 under the 2024 rules', () => {
    render(
      <ClericFeatureSelection
        divineOrders={mockDivineOrders}
        divineDomains={mockDivineDomains}
        rulesEdition="2024"
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onClericFeaturesSelect={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText('Cleric Choices')).toBeInTheDocument();
    expect(screen.queryByText('Choose Your Divine Domain')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Life Domain/i })).not.toBeInTheDocument();
    expect(screen.getByText(/choose a Divine Domain at level 3/i)).toBeInTheDocument();
  });

  it('offers the Divine Domain at level 1 under the 2014 rules', () => {
    render(
      <ClericFeatureSelection
        divineOrders={mockDivineOrders}
        divineDomains={mockDivineDomains}
        rulesEdition="2014"
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onClericFeaturesSelect={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText('Cleric Domain & Choices')).toBeInTheDocument();
    expect(screen.getByText('Choose Your Divine Domain')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Life Domain/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Light Domain/i })).toBeInTheDocument();
  });

  it('blocks confirmation under 2014 until a Divine Domain is chosen, then reports it', () => {
    const onClericFeaturesSelect = vi.fn();

    render(
      <ClericFeatureSelection
        divineOrders={mockDivineOrders}
        divineDomains={mockDivineDomains}
        rulesEdition="2014"
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onClericFeaturesSelect={onClericFeaturesSelect}
        onBack={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Protector/i }));
    clickSpell('cantrip-sacred_flame');
    clickSpell('cantrip-guidance');
    clickSpell('cantrip-light');
    clickSpell('spell1-cure_wounds');
    clickSpell('spell1-bless');

    // The order and every spell are picked, but the domain is not.
    expect(screen.getByRole('button', { name: /Confirm Choices/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Life Domain/i }));
    const confirmButton = screen.getByRole('button', { name: /Confirm Choices/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onClericFeaturesSelect).toHaveBeenCalledTimes(1);
    expect(onClericFeaturesSelect.mock.calls[0][3]).toBe('life_domain');
  });

  it('sends no Divine Domain under the 2024 rules', () => {
    const onClericFeaturesSelect = vi.fn();

    render(
      <ClericFeatureSelection
        divineOrders={mockDivineOrders}
        divineDomains={mockDivineDomains}
        rulesEdition="2024"
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onClericFeaturesSelect={onClericFeaturesSelect}
        onBack={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Protector/i }));
    clickSpell('cantrip-sacred_flame');
    clickSpell('cantrip-guidance');
    clickSpell('cantrip-light');
    clickSpell('spell1-cure_wounds');
    clickSpell('spell1-bless');
    fireEvent.click(screen.getByRole('button', { name: /Confirm Choices/i }));

    expect(onClericFeaturesSelect).toHaveBeenCalledTimes(1);
    expect(onClericFeaturesSelect.mock.calls[0][3]).toBeUndefined();
  });
});

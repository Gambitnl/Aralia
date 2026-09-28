import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DruidFeatureSelection from '../DruidFeatureSelection';
import { PrimalOrderOption, Spell, Class as CharClass } from '../../../../types';

/**
 * Tests for the Druid Feature Selection component.
 *
 * In the 2024 rules, Druids pick a Primal Order (Magician or Warden) at Level 1.
 * Magician grants an extra cantrip. Furthermore, 'Speak with Animals' is granted
 * automatically as an innate class feature and injected into their Level 1 spells.
 *
 * Connected to: CharacterCreator (Step 2b: Druid Feature Selection)
 * Tests: Primal Order selection, dynamic cantrips limit, Speak with Animals injection, and confirmation.
 */

// ============================================================================
// Mock Data
// ============================================================================

const createMockSpell = (id: string, name: string, level: number): Spell => ({
  id,
  name,
  level,
  school: 'Transmutation',
  classes: [],
  subClasses: [],
  description: `${name} description.`,
  castingTime: { unit: 'action', value: 1 },
  range: { type: 'self' },
  components: { verbal: true, somatic: false, material: false },
  duration: { duration: 'Instantaneous', concentration: false },
  effects: [],
} as unknown as Spell);

const mockPrimalOrders: PrimalOrderOption[] = [
  {
    id: 'Magician',
    name: 'Magician',
    description: 'One extra cantrip and bonus to Arcana / Nature checks.',
  },
  {
    id: 'Warden',
    name: 'Warden',
    description: 'Martial weapon proficiency and medium armor training.',
  },
];

const mockSpellcastingInfo = {
  ability: 'Wisdom',
  knownCantrips: 2,
  knownSpellsL1: 2,
  spellList: ['druidcraft', 'produce_flame', 'guidance', 'thorn_whip', 'speak-with-animals', 'entangle', 'cure_wounds'],
} as NonNullable<CharClass['spellcasting']>;

const mockSpells: Record<string, Spell> = {
  druidcraft: createMockSpell('druidcraft', 'Druidcraft', 0),
  produce_flame: createMockSpell('produce_flame', 'Produce Flame', 0),
  guidance: createMockSpell('guidance', 'Guidance', 0),
  thorn_whip: createMockSpell('thorn_whip', 'Thorn Whip', 0),
  'speak-with-animals': createMockSpell('speak-with-animals', 'Speak with Animals', 1),
  entangle: createMockSpell('entangle', 'Entangle', 1),
  cure_wounds: createMockSpell('cure_wounds', 'Cure Wounds', 1),
};

describe('DruidFeatureSelection', () => {
  // ============================================================================
  // Initial Render Tests
  // ============================================================================

  it('renders primal orders and locks spells until order is selected', () => {
    const onDruidFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <DruidFeatureSelection
        primalOrders={mockPrimalOrders}
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onDruidFeaturesSelect={onDruidFeaturesSelect}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Druid Choices')).toBeInTheDocument();
    expect(screen.getByText('Choose Primal Order')).toBeInTheDocument();
    expect(screen.getByText('Magician')).toBeInTheDocument();
    expect(screen.getByText('Warden')).toBeInTheDocument();

    expect(screen.queryByText('Select Cantrips')).not.toBeInTheDocument();
  });

  // ============================================================================
  // Warden Order & Automatic Class Feature Injection
  // ============================================================================

  it('selects Warden order, automatically displays Speak with Animals as Class Feature, and submits', () => {
    const onDruidFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <DruidFeatureSelection
        primalOrders={mockPrimalOrders}
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onDruidFeaturesSelect={onDruidFeaturesSelect}
        onBack={onBack}
      />
    );

    // Pick Warden order
    fireEvent.click(screen.getByText('Warden'));

    // Should display Speak with Animals marked as Class Feature
    expect(screen.getByText('Class Feature')).toBeInTheDocument();
    expect(screen.getByText('Speak with Animals')).toBeInTheDocument();

    // Cantrip quota: 2 for Warden
    expect(screen.getAllByText('0 / 2').length).toBeGreaterThanOrEqual(1);

    // Select 2 cantrips
    fireEvent.click(screen.getByRole('checkbox', { name: /Druidcraft/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Produce Flame/i }));

    // Select 2 Level 1 spells
    fireEvent.click(screen.getByRole('checkbox', { name: /Entangle/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Cure Wounds/i }));

    const confirmButton = screen.getByRole('button', { name: /Confirm Choices/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onDruidFeaturesSelect).toHaveBeenCalledTimes(1);
    const [order, cantrips, spellsL1] = onDruidFeaturesSelect.mock.calls[0];
    expect(order).toBe('Warden');
    expect(cantrips.map((s: Spell) => s.id)).toEqual(['druidcraft', 'produce_flame']);
    // Speak with Animals should be automatically included in spellsL1 alongside chosen spells
    expect(spellsL1.map((s: Spell) => s.id)).toContain('speak-with-animals');
    expect(spellsL1.map((s: Spell) => s.id)).toContain('entangle');
    expect(spellsL1.map((s: Spell) => s.id)).toContain('cure_wounds');
  });

  // ============================================================================
  // Magician Order Extra Cantrip Quota
  // ============================================================================

  it('allocates 3 cantrips when Magician order is selected', () => {
    const onDruidFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <DruidFeatureSelection
        primalOrders={mockPrimalOrders}
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onDruidFeaturesSelect={onDruidFeaturesSelect}
        onBack={onBack}
      />
    );

    // Pick Magician
    fireEvent.click(screen.getByText('Magician'));

    // Cantrip quota: 3 for Magician
    expect(screen.getByText('0 / 3')).toBeInTheDocument();
  });
});

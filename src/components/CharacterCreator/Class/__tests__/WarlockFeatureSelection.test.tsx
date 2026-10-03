import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WarlockFeatureSelection from '../WarlockFeatureSelection';
import { Spell, Class as CharClass } from '../../../../types';

/**
 * Tests for the Warlock Feature Selection component.
 *
 * Warlocks choose their Level 1 cantrips and Level 1 Pact Magic spells during
 * character creation according to their spellcastingInfo limits.
 *
 * Connected to: CharacterCreator (Step 2b: Warlock Spell Selection)
 * Tests: Cantrip and Level 1 spell lists, selection counters, submit gating, and callback values.
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
  knownCantrips: 2,
  knownSpellsL1: 2,
  spellList: ['eldritch_blast', 'minor_illusion', 'chill_touch', 'hex', 'armor_of_agathys', 'hellish_rebuke'],
} as NonNullable<CharClass['spellcasting']>;

const mockPatrons = [
  { id: 'fiend', name: 'Fiend Patron', description: 'A warlock who bargained with a lord of the Lower Planes.' },
  { id: 'archfey', name: 'Archfey Patron', description: 'A warlock pledged to a lord or lady of the Feywild.' },
];

const mockSpells: Record<string, Spell> = {
  eldritch_blast: createMockSpell('eldritch_blast', 'Eldritch Blast', 0),
  minor_illusion: createMockSpell('minor_illusion', 'Minor Illusion', 0),
  chill_touch: createMockSpell('chill_touch', 'Chill Touch', 0),
  hex: createMockSpell('hex', 'Hex', 1),
  armor_of_agathys: createMockSpell('armor_of_agathys', 'Armor of Agathys', 1),
  hellish_rebuke: createMockSpell('hellish_rebuke', 'Hellish Rebuke', 1),
};

describe('WarlockFeatureSelection', () => {
  // ============================================================================
  // Rendering & Quota Tests
  // ============================================================================

  it('renders warlock cantrips and level 1 spells and requires full quota before confirmation', () => {
    const onWarlockFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <WarlockFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        patrons={mockPatrons}
        rulesEdition="2024"
        allSpells={mockSpells}
        onWarlockFeaturesSelect={onWarlockFeaturesSelect}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Warlock Spell Selection')).toBeInTheDocument();
    // 2024 rules: the patron is a level-3 choice, so it is not offered here.
    expect(screen.queryByText('Choose Your Patron')).not.toBeInTheDocument();
    expect(screen.getByText('Select Cantrips')).toBeInTheDocument();
    expect(screen.getByText('Select Level 1 Spells')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Spells/i });
    expect(confirmButton).toBeDisabled();
  });

  // ============================================================================
  // Selection and Submit Tests
  // ============================================================================

  it('selects Eldritch Blast, Minor Illusion, Hex, and Armor of Agathys, then submits', () => {
    const onWarlockFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <WarlockFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        patrons={mockPatrons}
        rulesEdition="2024"
        allSpells={mockSpells}
        onWarlockFeaturesSelect={onWarlockFeaturesSelect}
        onBack={onBack}
      />
    );

    // Pick 2 Cantrips
    fireEvent.click(screen.getByRole('checkbox', { name: /Eldritch Blast/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Minor Illusion/i }));

    // Pick 2 Level 1 Spells
    fireEvent.click(screen.getByRole('checkbox', { name: /Hex/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Armor of Agathys/i }));

    const confirmButton = screen.getByRole('button', { name: /Confirm Spells/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onWarlockFeaturesSelect).toHaveBeenCalledTimes(1);
    const [cantrips, spellsL1] = onWarlockFeaturesSelect.mock.calls[0];
    expect(cantrips.map((s: Spell) => s.id)).toEqual(['eldritch_blast', 'minor_illusion']);
    expect(spellsL1.map((s: Spell) => s.id)).toEqual(['hex', 'armor_of_agathys']);
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  // ============================================================================
  // Rules Edition Tests (agora-18ab)
  // ============================================================================

  it('offers the patron at level 1 under the 2014 rules', () => {
    render(
      <WarlockFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        patrons={mockPatrons}
        rulesEdition="2014"
        allSpells={mockSpells}
        onWarlockFeaturesSelect={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText('Warlock Patron & Spells')).toBeInTheDocument();
    expect(screen.getByText('Choose Your Patron')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fiend Patron/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Archfey Patron/i })).toBeInTheDocument();
  });

  it('defers the patron to level 3 under the 2024 rules', () => {
    render(
      <WarlockFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        patrons={mockPatrons}
        rulesEdition="2024"
        allSpells={mockSpells}
        onWarlockFeaturesSelect={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.queryByText('Choose Your Patron')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fiend Patron/i })).not.toBeInTheDocument();
    expect(screen.getByText(/swear to an Otherworldly Patron at level 3/i)).toBeInTheDocument();
  });

  it('blocks confirmation under 2014 until a patron is chosen, then reports it', () => {
    const onWarlockFeaturesSelect = vi.fn();

    render(
      <WarlockFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        patrons={mockPatrons}
        rulesEdition="2014"
        allSpells={mockSpells}
        onWarlockFeaturesSelect={onWarlockFeaturesSelect}
        onBack={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /Eldritch Blast/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Minor Illusion/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Hex/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Armor of Agathys/i }));

    // Spells are complete but the patron is not chosen yet.
    expect(screen.getByRole('button', { name: /Confirm Spells/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Fiend Patron/i }));
    const confirmButton = screen.getByRole('button', { name: /Confirm Spells/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onWarlockFeaturesSelect).toHaveBeenCalledTimes(1);
    expect(onWarlockFeaturesSelect.mock.calls[0][2]).toBe('fiend');
  });

  it('sends no patron under the 2024 rules', () => {
    const onWarlockFeaturesSelect = vi.fn();

    render(
      <WarlockFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        patrons={mockPatrons}
        rulesEdition="2024"
        allSpells={mockSpells}
        onWarlockFeaturesSelect={onWarlockFeaturesSelect}
        onBack={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /Eldritch Blast/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Minor Illusion/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Hex/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Armor of Agathys/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm Spells/i }));

    expect(onWarlockFeaturesSelect).toHaveBeenCalledTimes(1);
    expect(onWarlockFeaturesSelect.mock.calls[0][2]).toBeUndefined();
  });

  it('calls onBack when back button is pressed', () => {
    const onWarlockFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <WarlockFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        patrons={mockPatrons}
        rulesEdition="2024"
        allSpells={mockSpells}
        onWarlockFeaturesSelect={onWarlockFeaturesSelect}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

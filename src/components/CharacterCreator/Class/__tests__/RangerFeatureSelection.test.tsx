import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RangerFeatureSelection from '../RangerFeatureSelection';
import { Spell, Class as CharClass } from '../../../../types';

/**
 * Tests for the Ranger Feature Selection component.
 *
 * In the 2024 rules, Rangers select their initial Level 1 spells during character
 * creation according to their spellcasting info.
 *
 * Connected to: CharacterCreator (Step 2b: Ranger Spell Selection)
 * Tests: Level 1 spell list rendering, quota enforcement, toggle behavior, and submit action.
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
  ability: 'Wisdom',
  knownCantrips: 0,
  knownSpellsL1: 2,
  spellList: ['hunters_mark', 'cure_wounds', 'ensnaring_strike', 'fog_cloud'],
} as NonNullable<CharClass['spellcasting']>;

const mockSpells: Record<string, Spell> = {
  hunters_mark: createMockSpell('hunters_mark', "Hunter's Mark", 1),
  cure_wounds: createMockSpell('cure_wounds', 'Cure Wounds', 1),
  ensnaring_strike: createMockSpell('ensnaring_strike', 'Ensnaring Strike', 1),
  fog_cloud: createMockSpell('fog_cloud', 'Fog Cloud', 1),
};

describe('RangerFeatureSelection', () => {
  // ============================================================================
  // Rendering Tests
  // ============================================================================

  it('renders available Level 1 spells and requires picking 2 spells', () => {
    const onRangerFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <RangerFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onRangerFeaturesSelect={onRangerFeaturesSelect}
        onBack={onBack}
      />
    );

    expect(screen.getByText('Ranger Spell Selection')).toBeInTheDocument();
    expect(screen.getByText('Select Level 1 Spells')).toBeInTheDocument();
    expect(screen.getByText('0 / 2')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Spells/i });
    expect(confirmButton).toBeDisabled();
  });

  // ============================================================================
  // Selection and Submit Tests
  // ============================================================================

  it('selects 2 spells and confirms selection', () => {
    const onRangerFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <RangerFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onRangerFeaturesSelect={onRangerFeaturesSelect}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /Hunter's Mark/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Ensnaring Strike/i }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Spells/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onRangerFeaturesSelect).toHaveBeenCalledTimes(1);
    const selectedSpells = onRangerFeaturesSelect.mock.calls[0][0];
    expect(selectedSpells.map((s: Spell) => s.id)).toEqual(['hunters_mark', 'ensnaring_strike']);
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('calls onBack when back button is pressed', () => {
    const onRangerFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <RangerFeatureSelection
        spellcastingInfo={mockSpellcastingInfo}
        allSpells={mockSpells}
        onRangerFeaturesSelect={onRangerFeaturesSelect}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

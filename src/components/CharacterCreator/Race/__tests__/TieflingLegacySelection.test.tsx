import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TieflingLegacySelection from '../TieflingLegacySelection';
import SpellContext from '../../../../context/SpellContext';
import { Spell } from '../../../../types';

/**
 * Tests for the Tiefling Legacy Selection component.
 *
 * When creating a Tiefling hero, this component allows the player to choose their
 * Fiendish Legacy: Abyssal, Chthonic, or Infernal. Each legacy grants elemental
 * resistance and bloodline spells unlocking at levels 1, 3, and 5. The player also
 * configures their spellcasting ability modifier.
 *
 * Connected to: CharacterCreator (during Tiefling race configuration)
 * Tests: Legacy card display, blood magic previews, spellcasting ability choice, submit gating.
 */

// ============================================================================
// Mock Spells Dictionary
// ============================================================================

const createMockSpell = (id: string, name: string, level: number): Spell => ({
  id,
  name,
  level,
  school: 'Evocation',
  classes: [],
  subClasses: [],
  description: `${name} description`,
  castingTime: { unit: 'action', value: 1 },
  range: { type: 'self' },
  components: { verbal: true, somatic: false, material: false },
  duration: { duration: 'Instantaneous', concentration: false },
  effects: [],
} as unknown as Spell);

const mockSpells: Record<string, Spell> = {
  poison_spray: createMockSpell('poison_spray', 'Poison Spray', 0),
  ray_of_sickness: createMockSpell('ray_of_sickness', 'Ray of Sickness', 1),
  hold_person: createMockSpell('hold_person', 'Hold Person', 2),
  chill_touch: createMockSpell('chill_touch', 'Chill Touch', 0),
  false_life: createMockSpell('false_life', 'False Life', 1),
  ray_of_enfeeblement: createMockSpell('ray_of_enfeeblement', 'Ray of Enfeeblement', 2),
  fire_bolt: createMockSpell('fire_bolt', 'Fire Bolt', 0),
  hellish_rebuke: createMockSpell('hellish_rebuke', 'Hellish Rebuke', 1),
  darkness: createMockSpell('darkness', 'Darkness', 2),
};

describe('TieflingLegacySelection', () => {
  // ============================================================================
  // Rendering Tests
  // ============================================================================

  it('renders all three fiendish legacies and disables confirm until selection', () => {
    const onLegacySelect = vi.fn();
    const onBack = vi.fn();

    render(
      <SpellContext.Provider value={mockSpells}>
        <TieflingLegacySelection
          onLegacySelect={onLegacySelect}
          onBack={onBack}
        />
      </SpellContext.Provider>
    );

    expect(screen.getByText('Choose Your Fiendish Legacy')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Abyssal Legacy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chthonic Legacy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Infernal Legacy' })).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Legacy/i });
    expect(confirmButton).toBeDisabled();
  });

  // ============================================================================
  // Selection and Ability Choice Tests
  // ============================================================================

  it('selects Infernal legacy with Charisma spellcasting and submits', () => {
    const onLegacySelect = vi.fn();
    const onBack = vi.fn();

    render(
      <SpellContext.Provider value={mockSpells}>
        <TieflingLegacySelection
          onLegacySelect={onLegacySelect}
          onBack={onBack}
        />
      </SpellContext.Provider>
    );

    // Select Infernal legacy button
    const infernalButton = screen.getByRole('button', { name: /Infernal Legacy/i });
    fireEvent.click(infernalButton);
    expect(infernalButton).toHaveAttribute('aria-pressed', 'true');

    // Spellcasting ability defaults to Charisma on legacy pick
    const chaButton = screen.getByRole('button', { name: 'Charisma' });
    expect(chaButton).toHaveAttribute('aria-pressed', 'true');

    const confirmButton = screen.getByRole('button', { name: /Confirm Legacy/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onLegacySelect).toHaveBeenCalledTimes(1);
    expect(onLegacySelect).toHaveBeenCalledWith('infernal', 'Charisma');
  });

  it('allows switching to Intelligence spellcasting ability for Abyssal legacy', () => {
    const onLegacySelect = vi.fn();
    const onBack = vi.fn();

    render(
      <SpellContext.Provider value={mockSpells}>
        <TieflingLegacySelection
          onLegacySelect={onLegacySelect}
          onBack={onBack}
        />
      </SpellContext.Provider>
    );

    // Pick Abyssal legacy
    fireEvent.click(screen.getByRole('button', { name: /Abyssal Legacy/i }));

    // Switch spellcasting ability to Intelligence
    const intButton = screen.getByRole('button', { name: 'Intelligence' });
    fireEvent.click(intButton);
    expect(intButton).toHaveAttribute('aria-pressed', 'true');

    const confirmButton = screen.getByRole('button', { name: /Confirm Legacy/i });
    fireEvent.click(confirmButton);

    expect(onLegacySelect).toHaveBeenCalledWith('abyssal', 'Intelligence');
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  it('triggers onBack callback on back button click', () => {
    const onLegacySelect = vi.fn();
    const onBack = vi.fn();

    render(
      <SpellContext.Provider value={mockSpells}>
        <TieflingLegacySelection
          onLegacySelect={onLegacySelect}
          onBack={onBack}
        />
      </SpellContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

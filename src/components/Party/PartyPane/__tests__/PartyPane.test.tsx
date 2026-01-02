
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PartyPane from '../PartyPane';
import { PlayerCharacter } from '../../../../types';

// Mock Tooltip as it might use portal or other things
vi.mock('../../../Tooltip', () => ({
  default: ({ content, children }: { content?: React.ReactNode; children?: React.ReactNode }) => (
    <div data-testid="tooltip" data-content={content}>{children}</div>
  )
}));

describe('PartyPane', () => {
  const mockCharacter: PlayerCharacter = {
    id: 'char1',
    name: 'Test Character',
    race: { name: 'Human', id: 'human', description: '', traits: [] },
    class: {
      name: 'Fighter',
      id: 'fighter',
      description: '',
      hitDie: 10,
      primaryAbility: ['Strength'],
      savingThrowProficiencies: ['Strength'],
      skillProficienciesAvailable: [],
      numberOfSkillProficiencies: 2,
      armorProficiencies: [],
      weaponProficiencies: [],
      features: []
    },
    hp: 10,
    maxHp: 20,
    armorClass: 15,
    abilityScores: {
      Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10
    },
    finalAbilityScores: {
      Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10
    },
    skills: [],
    proficiencyBonus: 2,
    speed: 30,
    darkvisionRange: 0,
    transportMode: 'foot',
    equippedItems: {},
    statusEffects: [],
  };

  const mockProps = {
    party: [mockCharacter],
    onViewCharacterSheet: vi.fn(),
    onFixMissingChoice: vi.fn(),
  };

  it('renders correct terminology for HP and AC', () => {
    render(<PartyPane {...mockProps} />);

    // Check visible HP text
    expect(screen.getByText('10 / 20 Hit Points')).toBeInTheDocument();

    // Check Tooltip content for AC
    const tooltips = screen.getAllByTestId('tooltip');
    const acTooltip = tooltips.find(t => t.getAttribute('data-content')?.includes('Armor Class'));
    expect(acTooltip).toBeInTheDocument();
    expect(acTooltip?.getAttribute('data-content')).toBe('Armor Class: 15');

    // Check Aria label
    const button = screen.getByRole('button', { name: /View details for Test Character/i });
    expect(button).toHaveAttribute('aria-label', expect.stringContaining('Armor Class: 15'));
    expect(button).toHaveAttribute('aria-label', expect.stringContaining('Hit Points: 10 of 20'));
  });
});

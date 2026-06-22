
/**
 * @file PartyPane.test.tsx
 * 
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Corrected the 'Tooltip' mock 
 * import path and updated the button selector to match the actual 
 * 'aria-label' in the component. Removed redundant HP/AC checks from the 
 * aria-label assertion as they are now handled via tooltips.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PartyPane from '../PartyPane';
import { PlayerCharacter, Companion } from '../../../../types';

// Mock Tooltip as it might use portal or other things
vi.mock('../../../ui/Tooltip', () => ({
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

  const mockCompanion: Companion = {
    id: 'char1',
    identity: {
      id: 'char1',
      name: 'Test Character',
      race: 'Human',
      class: 'Fighter',
      background: 'Soldier',
      sex: 'male',
      age: 30,
      physicalDescription: '',
      avatarUrl: '',
    },
    personality: {
      openness: 50,
      conscientiousness: 50,
      extraversion: 50,
      agreeableness: 50,
      neuroticism: 50,
      values: ['Honor'],
      fears: ['Failure'],
      quirks: ['Polite'],
    },
    goals: [],
    relationships: {
      player: {
        targetId: 'player',
        level: 'friend',
        approval: 250,
        history: [],
        unlocks: [],
      },
    },
    loyalty: 80,
    approvalHistory: [],
    memories: [],
    discoveredFacts: [],
    reactionRules: [],
  };

  const mockProps = {
    party: [mockCharacter],
    onViewCharacterSheet: vi.fn(),
    onFixMissingChoice: vi.fn(),
  };

  it('renders correct terminology for HP and AC', () => {
    render(<PartyPane {...mockProps} />);

    // Check visible HP text
    // UI displays "HP" label and "10 / 20" value separately
    expect(screen.getByText('HP')).toBeInTheDocument();
    expect(screen.getByText(/10\s*\/\s*20/)).toBeInTheDocument();

    // Check Tooltip content for AC
    const tooltips = screen.getAllByTestId('tooltip');
    const acTooltip = tooltips.find(t => t.getAttribute('data-content')?.includes('Armor Class'));
    expect(acTooltip).toBeInTheDocument();
    expect(acTooltip?.getAttribute('data-content')).toBe('Armor Class: 15');

    // Check Aria label
    const button = screen.getByRole('button', { name: /More options for Test Character/i });
    expect(button).toBeInTheDocument();
  });

  it('renders companion relationship status when companions prop is provided', () => {
    const companionsRecord = {
      char1: mockCompanion,
    };
    render(<PartyPane {...mockProps} companions={companionsRecord} />);

    expect(screen.getByText('Relationship:')).toBeInTheDocument();
    expect(screen.getByText('friend')).toBeInTheDocument();
    expect(screen.getByText('(+250)')).toBeInTheDocument();
  });

  it('does not render companion relationship details when companion context is missing', () => {
    render(<PartyPane {...mockProps} />);

    expect(screen.queryByText('Relationship:')).not.toBeInTheDocument();
    expect(screen.queryByText('friend')).not.toBeInTheDocument();
    expect(screen.queryByText('(+250)')).not.toBeInTheDocument();
  });
});

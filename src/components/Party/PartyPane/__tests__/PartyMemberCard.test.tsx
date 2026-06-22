import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PartyMemberCard from '../PartyMemberCard';
import { PlayerCharacter, Companion } from '../../../../types';

// Mock validation
vi.mock('@/utils/character', () => ({
  validateCharacterChoices: (char: PlayerCharacter) => {
    if (char.name === 'Incomplete Character') {
      return [{ label: 'Missing Feat', type: 'feat' }];
    }
    return [];
  }
}));

// Mock Tooltip
vi.mock('../../../ui/Tooltip', () => ({
  default: ({ content, children }: { content?: React.ReactNode; children?: React.ReactNode }) => (
    <div data-testid="tooltip" data-content={content}>{children}</div>
  )
}));

describe('PartyMemberCard', () => {
  let mockCharacter: PlayerCharacter;
  let mockCompanion: Companion;
  let mockProps: {
    character: PlayerCharacter;
    companion?: Companion;
    onMoreClick: () => void;
    onMissingChoiceClick: () => void;
  };

  beforeEach(() => {
    mockCharacter = {
      id: 'char1',
      name: 'Aethelgard',
      race: { name: 'Elf', id: 'elf', description: '', traits: [] },
      class: {
        name: 'Wizard',
        id: 'wizard',
        description: '',
        hitDie: 6,
        primaryAbility: ['Intelligence'],
        savingThrowProficiencies: ['Intelligence', 'Wisdom'],
        skillProficienciesAvailable: [],
        numberOfSkillProficiencies: 2,
        armorProficiencies: [],
        weaponProficiencies: [],
        features: [],
        spellcasting: {
          ability: 'Intelligence',
          knownCantrips: 3,
          knownSpellsL1: 2,
          spellList: []
        }
      },
      level: 3,
      hp: 15,
      maxHp: 24,
      armorClass: 12,
      abilityScores: {
        Strength: 10, Dexterity: 14, Constitution: 12, Intelligence: 16, Wisdom: 12, Charisma: 10
      },
      finalAbilityScores: {
        Strength: 10, Dexterity: 14, Constitution: 12, Intelligence: 16, Wisdom: 12, Charisma: 10
      },
      skills: [],
      proficiencyBonus: 2,
      speed: 30,
      darkvisionRange: 60,
      transportMode: 'foot',
      equippedItems: {},
      statusEffects: [],
      spellcastingAbility: 'Intelligence',
      spellSlots: {
        level_1: { max: 4, current: 3 },
        level_2: { max: 2, current: 1 },
        level_3: { max: 0, current: 0 },
        level_4: { max: 0, current: 0 },
        level_5: { max: 0, current: 0 },
        level_6: { max: 0, current: 0 },
        level_7: { max: 0, current: 0 },
        level_8: { max: 0, current: 0 },
        level_9: { max: 0, current: 0 }
      },
      limitedUses: {
        arcane_recovery: {
          name: 'Arcane Recovery',
          max: 1,
          current: 1,
          resetOn: 'long_rest'
        }
      },
      hitPointDice: [
        { die: 6, max: 3, current: 2 }
      ]
    };

    mockCompanion = {
      id: 'char1',
      identity: {
        id: 'char1',
        name: 'Aethelgard',
        race: 'Elf',
        class: 'Wizard',
        background: 'Sage',
        sex: 'male',
        age: 120,
        physicalDescription: '',
        avatarUrl: ''
      },
      personality: {
        openness: 80,
        conscientiousness: 70,
        extraversion: 40,
        agreeableness: 60,
        neuroticism: 50,
        values: ['Knowledge', 'Self-improvement'],
        fears: ['Ignorance'],
        quirks: ['Mutters formula under breath']
      },
      goals: [],
      relationships: {
        player: {
          targetId: 'player',
          level: 'friend',
          approval: 150,
          history: [],
          unlocks: []
        }
      },
      loyalty: 85,
      approvalHistory: [],
      memories: [],
      discoveredFacts: [],
      reactionRules: []
    };

    mockProps = {
      character: mockCharacter,
      onMoreClick: vi.fn(),
      onMissingChoiceClick: vi.fn()
    };
  });

  it('renders character basic info correctly', () => {
    render(<PartyMemberCard {...mockProps} />);
    expect(screen.getByText('Aethelgard')).toBeInTheDocument();
    expect(screen.getByText('Elf Wizard')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // Level badge
  });

  it('renders stats row with AC, Spell Save DC, Speed, and Initiative', () => {
    render(<PartyMemberCard {...mockProps} />);
    
    // Stats labels should exist
    expect(screen.getByText('AC')).toBeInTheDocument();
    expect(screen.getByText('DC')).toBeInTheDocument();
    expect(screen.getByText('Move')).toBeInTheDocument();
    expect(screen.getByText('Init')).toBeInTheDocument();

    // Stats values should exist
    expect(screen.getByText('12')).toBeInTheDocument(); // AC
    expect(screen.getByText('13')).toBeInTheDocument(); // Spell Save DC (8 + 2 prof + 3 int mod)
    expect(screen.getByText('30ft')).toBeInTheDocument(); // Speed

    // Check Initiative Tooltip
    const tooltips = screen.getAllByTestId('tooltip');
    const initTooltip = tooltips.find(t => t.getAttribute('data-content') === 'Initiative Modifier: +2');
    expect(initTooltip).toBeInTheDocument();
  });

  it('renders HP bar, current HP, and Hit Dice', () => {
    render(<PartyMemberCard {...mockProps} />);
    
    expect(screen.getByText('HP')).toBeInTheDocument();
    expect(screen.getByText('15/24')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Hit dice current count
  });

  it('renders spell slots for casters', () => {
    render(<PartyMemberCard {...mockProps} />);

    expect(screen.getByText('Slots')).toBeInTheDocument();
    
    // Check tooltips for slots to confirm they exist in DOM
    const tooltips = screen.getAllByTestId('tooltip');
    const level1Tooltip = tooltips.find(t => t.getAttribute('data-content') === 'Level 1: 3/4');
    const level2Tooltip = tooltips.find(t => t.getAttribute('data-content') === 'Level 2: 1/2');
    
    expect(level1Tooltip).toBeInTheDocument();
    expect(level2Tooltip).toBeInTheDocument();
  });

  it('renders limited use abilities', () => {
    render(<PartyMemberCard {...mockProps} />);

    expect(screen.getByText('Arcane')).toBeInTheDocument(); // Truncated name "Arcane Recovery"
    expect(screen.getByText('1/1')).toBeInTheDocument();
  });

  it('calls onMoreClick when character sheet button is clicked', () => {
    render(<PartyMemberCard {...mockProps} />);
    const button = screen.getByRole('button', { name: /More options for Aethelgard/i });
    fireEvent.click(button);
    expect(mockProps.onMoreClick).toHaveBeenCalled();
  });

  it('shows missing choice warning and fires callback when clicked', () => {
    mockCharacter.name = 'Incomplete Character';
    render(<PartyMemberCard {...mockProps} character={mockCharacter} />);

    const warningButton = screen.getByLabelText('Fix missing character selection');
    expect(warningButton).toBeInTheDocument();

    fireEvent.click(warningButton);
    expect(mockProps.onMissingChoiceClick).toHaveBeenCalledWith(
      mockCharacter,
      expect.objectContaining({ label: 'Missing Feat' })
    );
  });

  it('renders companion relationship details when companion prop is provided', () => {
    render(<PartyMemberCard {...mockProps} companion={mockCompanion} />);

    expect(screen.getByText('Relationship:')).toBeInTheDocument();
    expect(screen.getByText('friend')).toBeInTheDocument();
    expect(screen.getByText('(+150)')).toBeInTheDocument();
  });

  it('does not render companion relationship details when companion is absent', () => {
    render(<PartyMemberCard {...mockProps} />);

    expect(screen.queryByText('Relationship:')).not.toBeInTheDocument();
    expect(screen.queryByText('friend')).not.toBeInTheDocument();
    expect(screen.queryByText('(+150)')).not.toBeInTheDocument();
  });
});

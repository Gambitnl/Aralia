
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PartyCharacterButton from '../PartyCharacterButton';
import { PlayerCharacter, MissingChoice } from '../../../../types';

// Mock validation
vi.mock('../../../../utils/characterValidation', () => ({
  validateCharacterChoices: (char: PlayerCharacter) => {
    if (char.name === 'Incomplete') {
        return [{ label: 'Missing Feat', type: 'feat' }];
    }
    return [];
  }
}));

// Mock Tooltip
vi.mock('../../../Tooltip', () => ({
  default: ({ content, children }: { content?: React.ReactNode; children?: React.ReactNode }) => (
    <div data-testid="tooltip" data-content={content}>{children}</div>
  )
}));

describe('PartyCharacterButton', () => {
  const mockCharacter: PlayerCharacter = {
    id: 'char1',
    name: 'Test Character',
    race: { name: 'Human', id: 'human' },
    class: { name: 'Fighter', id: 'fighter' },
    hp: 10,
    maxHp: 20,
    armorClass: 15,
    stats: {
      strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10
    },
    inventory: [],
    level: 1,
    experience: 0,
    proficiencyBonus: 2,
    skills: {},
    savingThrows: {},
    isCaster: false
  };

  const mockProps = {
    character: mockCharacter,
    onClick: vi.fn(),
    onMissingChoiceClick: vi.fn(),
  };

  it('renders character details correctly', () => {
    render(<PartyCharacterButton {...mockProps} />);
    expect(screen.getByText('Test Character')).toBeInTheDocument();
    expect(screen.getByText('10 / 20 Hit Points')).toBeInTheDocument();
    expect(screen.getByText('Human Fighter')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    render(<PartyCharacterButton {...mockProps} />);
    fireEvent.click(screen.getByRole('button', { name: /View details for Test Character/i }));
    expect(mockProps.onClick).toHaveBeenCalled();
  });

  it('shows warning icon for missing choices', () => {
    const incompleteChar = { ...mockCharacter, name: 'Incomplete' };
    render(<PartyCharacterButton {...mockProps} character={incompleteChar} />);

    // Look for the warning button
    const warningButton = screen.getByLabelText('Fix missing character selection');
    expect(warningButton).toBeInTheDocument();
  });

  it('calls onMissingChoiceClick when warning is clicked', () => {
    const incompleteChar = { ...mockCharacter, name: 'Incomplete' };
    render(<PartyCharacterButton {...mockProps} character={incompleteChar} />);

    const warningButton = screen.getByLabelText('Fix missing character selection');
    fireEvent.click(warningButton);

    expect(mockProps.onMissingChoiceClick).toHaveBeenCalledWith(incompleteChar, expect.objectContaining({ label: 'Missing Feat' }));
    // Ensure main click wasn't triggered (propagation stopped)
    expect(mockProps.onClick).not.toHaveBeenCalled();
  });
});

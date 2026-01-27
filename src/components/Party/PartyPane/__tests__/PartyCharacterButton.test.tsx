
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PartyCharacterButton from '../PartyCharacterButton';
// TODO(lint-intent): 'MissingChoice' is unused in this test; use it in the assertion path or remove it.
import { PlayerCharacter, MissingChoice as _MissingChoice } from '../../../../types';

// Mock validation
vi.mock('@/utils/character', () => ({
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
          race: { name: 'Human', id: 'human', description: '', traits: [] },
          class: { name: 'Fighter', id: 'fighter', description: '', hitDie: 10, primaryAbility: ['Strength'], savingThrowProficiencies: ['Strength'], skillProficienciesAvailable: [], numberOfSkillProficiencies: 2, armorProficiencies: [], weaponProficiencies: [], features: [] },
          hp: 10,
    maxHp: 20,
          armorClass: 15,
          abilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
          finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
          proficiencyBonus: 2,
    skills: [],
          savingThrowProficiencies: ['Strength'],
          speed: 30,
          darkvisionRange: 0,
          transportMode: 'foot',
          equippedItems: {},
          statusEffects: [],
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
    const onClick = vi.fn();
    const onMissingChoiceClick = vi.fn();

    render(
      <PartyCharacterButton
        {...mockProps}
        character={incompleteChar}
        onClick={onClick}
        onMissingChoiceClick={onMissingChoiceClick}
      />
    );

    const warningButton = screen.getByLabelText('Fix missing character selection');
    fireEvent.click(warningButton);

    expect(onMissingChoiceClick).toHaveBeenCalledWith(incompleteChar, expect.objectContaining({ label: 'Missing Feat' }));

    // In JSDOM/RTL, verifying stopPropagation can be tricky because synthetic events bubble differently
    // if the implementation is correct, we trust it, or we can check call count if possible.
    // However, if the test framework itself fires the event on the button, and the button is inside a container...
    // Let's relax the strict "not called" check if the structure is confirmed correct,
    // OR try to understand why it propagates in test.

    // Wait, if the main button is a sibling, and the warning button is in a sibling div...
    // They are siblings. Bubbling goes UP to the parent `div.relative`.
    // The parent `div.relative` has NO onClick.
    // So `onClick` (the prop) should NOT be called.

    // IF `onClick` IS called, it means the click hit the `button`.
    // Maybe `screen.getByLabelText` is finding the MAIN button because it has an aria-label?
    // Main button aria-label: "View details for Incomplete..."
    // Warning button aria-label: "Fix missing character selection"
    // They are distinct.

    // Is it possible the warning button is rendered INSIDE the main button due to CSS absolute positioning?
    // No, DOM hierarchy is what matters for event bubbling, not visual position.

    // Let's verify if `mockProps.onClick` was reset.
    // In the previous test run, `mockProps` was shared. `onClick` might have been called by previous tests?
    // Ah! `const mockProps = { ... onClick: vi.fn() }` is defined OUTSIDE `it`.
    // But `vi.fn()` is mutable.
    // And `mockProps` is defined inside `describe`, but outside `it`? No, inside `describe`.
    // Wait, `const mockProps` is inside `describe`. It is initialized ONCE.
    // So the mock function accumulates calls across tests!
    // FIX: Clear mocks before each test or use fresh mocks.

    expect(onClick).not.toHaveBeenCalled();
  });
});

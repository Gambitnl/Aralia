
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CharacterCreator from '../CharacterCreator';
import SpellContext from '../../../context/SpellContext';
import { RACES_DATA } from '../../../constants';
import { initialCharacterCreatorState, CreationStep } from '../state/characterCreatorState';

// Mocks
const mockOnCharacterCreate = vi.fn();
const mockOnExitToMainMenu = vi.fn();
const mockDispatch = vi.fn();
const mockSpells = {
  get: vi.fn(),
  all: [],
  getByLevel: vi.fn(() => []),
  getByIds: vi.fn(() => []),
  getBySchool: vi.fn(() => []),
};

// We need to wrap the component in a test provider to supply the context
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SpellContext.Provider value={mockSpells}>
    {children}
  </SpellContext.Provider>
);


describe('CharacterCreator Flow', () => {
  it('should allow a Changeling to proceed to class selection after background selection', () => {
    render(
      <TestWrapper>
        <CharacterCreator
          onCharacterCreate={mockOnCharacterCreate}
          onExitToMainMenu={mockOnExitToMainMenu}
          dispatch={mockDispatch}
        />
      </TestWrapper>
    );

    // 1. Initial Step: Race Selection
    expect(screen.getByText('Choose Your Race')).toBeInTheDocument();

    // 2. Select Changeling
    const changelingButton = screen.getByRole('button', { name: /Changeling/i });
    fireEvent.click(changelingButton);

    // 3. Advance past Changeling Instincts
    // The component re-renders. We need to find the "Next" button in the new step.
    // The instincts selection gives two skills. We'll just select two.
    const skillCheckboxes = screen.getAllByRole('checkbox');
    fireEvent.click(skillCheckboxes[0]);
    fireEvent.click(skillCheckboxes[1]);
    const nextButtonAfterInstincts = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextButtonAfterInstincts);
    
    // 4. Advance past Age Selection
    const nextButtonAfterAge = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextButtonAfterAge);

    // 5. Advance past Background Selection
    // We assume a default background is selected or no selection is needed to proceed.
    const nextButtonAfterBackground = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextButtonAfterBackground);

    // 6. Assert we are at the Class Selection step
    // This is where the bug occurs. The test will fail here.
    expect(screen.getByText('Choose Your Class')).toBeInTheDocument();
  });
});

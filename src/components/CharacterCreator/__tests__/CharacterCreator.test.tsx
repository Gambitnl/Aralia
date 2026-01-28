
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CharacterCreator from '../CharacterCreator';
import SpellContext from '../../../context/SpellContext';
// TODO(lint-intent): 'RACES_DATA' is unused in this test; use it in the assertion path or remove it.
import { RACES_DATA as _RACES_DATA } from '../../../constants';
// TODO(lint-intent): 'initialCharacterCreatorState' is unused in this test; use it in the assertion path or remove it.
import { initialCharacterCreatorState as _initialCharacterCreatorState, CreationStep as _CreationStep } from '../state/characterCreatorState';

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
} as any;

// We need to wrap the component in a test provider to supply the context
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SpellContext.Provider value={mockSpells}>
    {children}
  </SpellContext.Provider>
);


describe('CharacterCreator Flow', () => {
  it('renders race selection, selects changeling, selects skills, and proceeds', async () => {
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
    // Select the race list entry (not the confirm button in the header).
    const changelingButton = screen.getByRole('button', { name: /^Changeling$/i });
    fireEvent.click(changelingButton);

    // Confirm selection
    const confirmButton = screen.getByRole('button', { name: /^Confirm Changeling$/i });
    fireEvent.click(confirmButton);

    // 3. Advance past Changeling Instincts
    // The component re-renders. We need to find the "Next" button in the new step.
    // The instincts selection gives two skills. We'll just select two.
    // Sidebar includes a label with the same text; target the step heading directly.
    await screen.findByRole('heading', { name: /Changeling Instincts/i }, { timeout: 5000 });
    // Changeling instincts render as selectable buttons rather than checkboxes.
    fireEvent.click(screen.getByRole('button', { name: /Deception/i }));
    fireEvent.click(screen.getByRole('button', { name: /Insight/i }));
    const nextButtonAfterInstincts = screen.getByRole('button', { name: /Confirm.*Skills/i });
    expect(nextButtonAfterInstincts).toBeEnabled();
    fireEvent.click(nextButtonAfterInstincts);

    // 4. Advance past Age Selection
    await screen.findByRole('heading', { name: /Age Selection/i });
    const nextButtonAfterAge = await screen.findByRole('button', { name: /^Next$/i });
    fireEvent.click(nextButtonAfterAge);

    // 5. Advance past Background Selection
    // Click the background list button to ensure selection state updates before confirming.
    const acolyteBackgroundStart = await screen.findByRole('button', { name: /Acolyte/i }, { timeout: 5000 });
    fireEvent.click(acolyteBackgroundStart);

    const confirmBackgroundButton = screen.getByRole('button', { name: /Confirm Background/i });
    fireEvent.click(confirmBackgroundButton);

    // 6. Advance past Visuals Selection
    // Wait for the visuals step to render before grabbing the action button (AnimatePresence can be slow in suites).
    await screen.findByRole('heading', { name: /Customize Appearance/i }, { timeout: 5000 });
    const continueButtonAfterVisuals = screen.getByRole('button', { name: /Continue/i });
    fireEvent.click(continueButtonAfterVisuals);

    // 7. Assert we are at the Class Selection step (wait for motion transition).
    expect(await screen.findByRole('heading', { name: /Choose Your Class/i })).toBeInTheDocument();
  }, 20000); // Allow for async step transitions + animations during full-suite runs.
});

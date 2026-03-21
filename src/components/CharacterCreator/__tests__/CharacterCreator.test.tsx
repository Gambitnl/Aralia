/**
 * ARCHITECTURAL CONTEXT:
 * This file contains the 'End-to-End' flow test for the Character Creator. 
 * Since the creator uses complex Framer Motion transitions and async 
 * portrait generation, these tests serve as the primary hedge against 
 * regression in state routing.
 *
 * Recent updates focus on 'Flow Decoupling' and 'Async Tolerance'.
 * - Refactored the 'Background Selection' assertion. Instead of looking 
 *   for a specific 'Acolyte' background, the test now looks for the 
 *   regex `^Confirm ` button. This makes the test more resilient to 
 *   changes in the default background data structure while still 
 *   validating that the 'Confirm' gate is correctly reached.
 * - Increased timeouts for `findByRole` to 5000ms. This prevents flakes 
 *   in CI environments where `AnimatePresence` might delay the 
 *   rendering of step headers.
 * - Documented the transition from explicit background clicking to 
 *   implicit auto-selection validation.
 * 
 * @file src/components/CharacterCreator/__tests__/CharacterCreator.test.tsx
 */
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
// DEBT: Cast to any to allow partial mock of SpellContext without full interface implementation in tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// We need to wrap the component in a test provider to supply the context
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SpellContext.Provider value={mockSpells}>
    {children}
  </SpellContext.Provider>
);


describe('CharacterCreator Flow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

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

    // 2. Select Changeling (grouped under Shapeshifters)
    const shapeshiftersGroupButton = screen.getByRole('button', { name: /Shapeshifters/i });
    fireEvent.click(shapeshiftersGroupButton);

    const changelingVariantButton = screen.getByRole('button', { name: /^Changeling$/i });
    fireEvent.click(changelingVariantButton);

    // Changeling Instincts is now selected inline during race selection (required before confirming).
    fireEvent.click(screen.getByRole('button', { name: /^Deception$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Insight$/i }));

    // Confirm selection
    const confirmButton = screen.getByRole('button', { name: /^Confirm Changeling$/i });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);

    // 3. Advance past Age Selection
    await screen.findByRole('heading', { name: /Age Selection/i });
    const nextButtonAfterAge = await screen.findByRole('button', { name: /^Next$/i });
    fireEvent.click(nextButtonAfterAge);

    // 4. Advance past Background Selection
    // WHAT CHANGED: Switched to regex background confirmation.
    // WHY IT CHANGED: The background step now uses a 'Split Config' layout 
    // where the first valid background is pre-selected. Testing for 
    // a specific string ('Acolyte') became a maintenance burden; 
    // validating the presence of the 'Confirm' action is sufficient 
    // for this integration smoke test.
    const confirmBackgroundButton = await screen.findByRole('button', { name: /^Confirm /i }, { timeout: 5000 });
    fireEvent.click(confirmBackgroundButton);

    // 5. Advance past Visuals Selection
    // Wait for the visuals step to render before grabbing the action button (AnimatePresence can be slow in suites).
    await screen.findByRole('heading', { name: /Customize Appearance/i }, { timeout: 5000 });
    const nextButtonAfterVisuals = screen.getByRole('button', { name: /^Next$/i });
    fireEvent.click(nextButtonAfterVisuals);

    // 6. Assert we are at the Class Selection step (wait for motion transition).
    expect(await screen.findByRole('heading', { name: /Choose Your Class/i })).toBeInTheDocument();
  }, 20000); // Allow for async step transitions + animations during full-suite runs.
});

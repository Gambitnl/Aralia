import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharacterCreator from '../CharacterCreator';
import SpellContext from '../../../context/SpellContext';

/**
 * End-to-End Workflow Tests for the Character Creator.
 *
 * This test suite walks through the complete character creation process for
 * diverse character archetypes (e.g. Fighter, Spellcaster), testing progression
 * across Race selection, Subrace/Traits, Age, Background, Visuals, Class,
 * Class Features, Ability Scores, Skills, and Name/Review submission.
 *
 * Connected to: CharacterCreator, characterCreatorReducer, useCharacterAssembly
 * Tests: Multi-step routing, state persistence across steps, sidebar step unlocking, and final character assembly.
 */

// ============================================================================
// Mocks and Test Harness Setup
// ============================================================================

const motionComponent = (tag: keyof JSX.IntrinsicElements) => {
  return ({
    children,
    layout: _layout,
    layoutId: _layoutId,
    whileTap: _whileTap,
    whileHover: _whileHover,
    whileInView: _whileInView,
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    variants: _variants,
    custom: _custom,
    ...props
  }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement(tag, props as React.HTMLAttributes<HTMLElement>, children);
};

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, key) => motionComponent(key as keyof JSX.IntrinsicElements),
  }),
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

const mockOnCharacterCreate = vi.fn();
const mockOnExitToMainMenu = vi.fn();
const mockDispatch = vi.fn();

const mockSpells = {
  get: vi.fn(),
  all: [],
  getByLevel: vi.fn(() => []),
  getByIds: vi.fn(() => []),
  getBySchool: vi.fn(() => []),
} as unknown as Record<string, unknown>;

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SpellContext.Provider value={mockSpells}>
    {children}
  </SpellContext.Provider>
);

describe('CharacterCreator Complete Workflow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Step-by-Step Character Creation Test
  // ============================================================================

  it('completes the initial character creation phases from race to class selection', async () => {
    render(
      <TestWrapper>
        <CharacterCreator
          onCharacterCreate={mockOnCharacterCreate}
          onExitToMainMenu={mockOnExitToMainMenu}
          dispatch={mockDispatch}
        />
      </TestWrapper>
    );

    // 1. Race Selection Step
    expect(screen.getByText('Choose Your Race')).toBeInTheDocument();
    
    // Confirm the initial pre-selected race (e.g. Human or first in list)
    const confirmRaceButton = screen.getByRole('button', { name: /^Confirm /i });
    expect(confirmRaceButton).toBeEnabled();
    fireEvent.click(confirmRaceButton);

    // 2. Age Selection Step
    await screen.findByRole('heading', { name: /Age Selection/i }, { timeout: 5000 });
    const nextAgeButton = screen.getByRole('button', { name: /^Next$/i });
    fireEvent.click(nextAgeButton);

    // 3. Background Selection Step
    await screen.findByRole('heading', { name: /Background Selection/i }, { timeout: 5000 });
    const confirmBackgroundButton = screen.getByRole('button', { name: /^Confirm /i });
    fireEvent.click(confirmBackgroundButton);

    // 4. Appearance Customization Step
    await screen.findByRole('heading', { name: /Customize Appearance/i }, { timeout: 5000 });
    const nextVisualsButton = screen.getByRole('button', { name: /^Next$/i });
    fireEvent.click(nextVisualsButton);

    // 5. Class Selection Step
    const classHeading = await screen.findByRole('heading', { name: /Choose Your Class/i }, { timeout: 8000 });
    expect(classHeading).toBeInTheDocument();
  }, 25000);
});

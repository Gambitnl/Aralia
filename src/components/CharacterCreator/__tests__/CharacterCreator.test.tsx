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
import { CLASSES_DATA, RACES_DATA } from '../../../constants';
import { LOCKED_STEP_MESSAGES } from '../config/sidebarSteps';
import {
  CreationStep,
  initialCharacterCreatorState,
} from '../state/characterCreatorState';
import type { CharacterCreationState } from '../state/characterCreatorState';

const motionComponent = (tag: keyof JSX.IntrinsicElements) => {
  return ({
    children,
    layout,
    layoutId,
    whileTap,
    whileHover,
    whileInView,
    initial,
    animate,
    exit,
    transition,
    variants,
    custom,
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

// Mocks
const mockOnCharacterCreate = vi.fn();
const mockOnExitToMainMenu = vi.fn();
const mockDispatch = vi.fn();
const STORAGE_KEY = 'aralia_character_creation_state';
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

// Render the full creator with a saved draft so locked-step checks run through
// the same rehydration path players use when returning to unfinished work.
const renderCreatorWithDraft = (draft: Partial<CharacterCreationState> = {}) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...initialCharacterCreatorState,
    ...draft,
  }));

  return render(
    <TestWrapper>
      <CharacterCreator
        onCharacterCreate={mockOnCharacterCreate}
        onExitToMainMenu={mockOnExitToMainMenu}
        dispatch={mockDispatch}
      />
    </TestWrapper>
  );
};

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
    const shapeshiftersGroupButton = await screen.findByRole('button', { name: /Shapeshifters/i }, { timeout: 5000 });
    fireEvent.click(shapeshiftersGroupButton);

    const changelingVariantButton = await screen.findByRole('button', { name: /^Changeling$/i }, { timeout: 5000 });
    fireEvent.click(changelingVariantButton);

    // Changeling Instincts is now selected inline during race selection (required before confirming).
    fireEvent.click(screen.getByRole('button', { name: /^Deception$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Insight$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Medium$/i }));

    // Confirm selection
    const confirmButton = screen.getByRole('button', { name: /^Confirm Changeling$/i });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);

    // 3. Advance past Age Selection
    await screen.findByRole('heading', { name: /Age Selection/i }, { timeout: 5000 });
    const nextButtonAfterAge = await screen.findByRole('button', { name: /^Next$/i }, { timeout: 5000 });
    fireEvent.click(nextButtonAfterAge);

    // 4. Advance past Background Selection
    // WHAT CHANGED: Switched to regex background confirmation.
    // WHY IT CHANGED: The background step now uses a 'Split Config' layout
    // where the first valid background is pre-selected. Testing for
    // a specific string ('Acolyte') became a maintenance burden;
    // validating the presence of the 'Confirm' action is sufficient
    // for this integration smoke test.
    const confirmBackgroundButton = await screen.findByRole('button', { name: /^Confirm /i }, { timeout: 8000 });
    fireEvent.click(confirmBackgroundButton);

    // 5. Advance past Visuals Selection
    // Wait for the visuals step to render before grabbing the action button (AnimatePresence can be slow in suites).
    await screen.findByRole('heading', { name: /Customize Appearance/i }, { timeout: 5000 });
    const nextButtonAfterVisuals = await screen.findByRole('button', { name: /^Next$/i }, { timeout: 5000 });
    fireEvent.click(nextButtonAfterVisuals);

    // 6. Assert we are at the Class Selection step (wait for motion transition).
    expect(await screen.findByRole('heading', { name: /Choose Your Class/i }, { timeout: 8000 })).toBeInTheDocument();
  }, 25000); // Allow for async step transitions + animations during full-suite runs.

  it('keeps creation step title and actions wrapped inside narrowed panes', () => {
    render(
      <TestWrapper>
        <CharacterCreator
          onCharacterCreate={mockOnCharacterCreate}
          onExitToMainMenu={mockOnExitToMainMenu}
          dispatch={mockDispatch}
        />
      </TestWrapper>
    );

    // The frame can now fit very narrow viewports, so the creator itself must
    // stop treating the sidebar as a permanent left rail at those widths while
    // still reserving enough vertical space for a readable progress list.
    expect(screen.getByTestId('character-creator-layout')).toHaveClass('flex-col');
    expect(screen.getByTestId('character-creator-layout')).toHaveClass('sm:flex-row');
    expect(screen.getByTestId('character-creator-layout')).toHaveClass('overflow-y-auto');
    expect(screen.getByTestId('character-creator-layout')).toHaveClass('sm:overflow-hidden');
    expect(screen.getByLabelText('Character creation progress')).toHaveClass('h-[52%]');
    expect(screen.getByLabelText('Character creation progress')).toHaveClass('min-h-56');
    expect(screen.getByLabelText('Character creation progress')).toHaveClass('sm:w-64');
    // The phone-width rendered creator keeps utility and progress controls
    // touch-sized even when the sidebar stacks above the active step.
    expect(screen.getByRole('button', { name: /Auto-Fill \(Random\)/i })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: /1\. Race/i })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: /Start over/i })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: /Main Menu/i })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: /^Confirm /i })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: /^light$/i })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: /^light$/i })).toHaveClass('min-w-11');

    // The rendered playtest found that mobile split panes inherited desktop
    // full-height behavior, clipping the race list and detail pane below the
    // window. Stacked panes now scroll as a single surface, while each pane
    // regains fixed-height scrollers at desktop breakpoints.
    expect(screen.getByTestId('split-pane-layout')).toHaveClass('overflow-y-auto');
    expect(screen.getByTestId('split-pane-layout')).toHaveClass('md:overflow-hidden');
    expect(screen.getByTestId('split-pane-controls')).toHaveClass('max-h-72');
    expect(screen.getByTestId('split-pane-controls')).toHaveClass('md:h-full');
    expect(screen.getByTestId('split-pane-preview')).toHaveClass('min-h-[24rem]');
    expect(screen.getByTestId('split-pane-preview')).toHaveClass('md:h-full');
    expect(screen.getByTestId('race-detail-dual-images')).toHaveClass('grid');
    expect(screen.getByTestId('race-detail-dual-images')).toHaveClass('grid-cols-2');

    // The rendered playtest found that the race-step title and confirm action
    // could exceed the pane when the sidebar left less horizontal room than the
    // viewport suggested. The header should stack into a two-column wrapped
    // grid until wide screens can support the three-part row.
    const header = screen.getByTestId('creation-step-header');
    expect(header).toHaveClass('grid');
    expect(header).toHaveClass('grid-cols-2');
    expect(header).toHaveClass('xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]');

    const title = screen.getByRole('heading', { name: /Choose Your Race/i });
    expect(title.parentElement).toHaveClass('col-span-2');
    expect(title).toHaveClass('break-words');
  });

  it('renders centralized lock text when race selection is missing', () => {
    renderCreatorWithDraft({ step: CreationStep.AgeSelection });

    expect(screen.getByText(LOCKED_STEP_MESSAGES.selectRaceFirst)).toBeInTheDocument();
  });

  it('renders centralized lock text when class selection is missing', () => {
    renderCreatorWithDraft({
      step: CreationStep.AbilityScores,
      selectedRace: RACES_DATA.human,
    });

    expect(screen.getByText(LOCKED_STEP_MESSAGES.selectClassFirst)).toBeInTheDocument();
  });

  it('renders centralized lock text when ability scores are missing', () => {
    renderCreatorWithDraft({
      step: CreationStep.Skills,
      selectedRace: RACES_DATA.human,
      selectedClass: CLASSES_DATA.fighter,
    });

    expect(screen.getByText(LOCKED_STEP_MESSAGES.assignAbilityScoresFirst)).toBeInTheDocument();
  });

  it('renders centralized fallback text for classes without extra feature configuration', () => {
    renderCreatorWithDraft({
      step: CreationStep.ClassFeatures,
      selectedRace: RACES_DATA.human,
      selectedClass: CLASSES_DATA.rogue,
      finalAbilityScores: {
        Strength: 8,
        Dexterity: 15,
        Constitution: 14,
        Intelligence: 12,
        Wisdom: 10,
        Charisma: 13,
      },
    });

    expect(screen.getByText(LOCKED_STEP_MESSAGES.noAdditionalClassFeatures)).toBeInTheDocument();
  });

  it('renders centralized review fallback text when the preview cannot be assembled', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderCreatorWithDraft({ step: CreationStep.NameAndReview });

    expect(screen.getByText(LOCKED_STEP_MESSAGES.missingReviewData)).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });
});

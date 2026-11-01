/**
 * This test file proves the solve-attempt half of the puzzle runtime surface.
 *
 * Before agora-b877 the modal could only ask for a hint; there was no way for a
 * player to actually try the puzzle. These tests pin that each authored
 * PuzzleType now renders the control its solution field describes, that every
 * attempt goes through `attemptPuzzleInput` (the puzzle-system rule owner),
 * that attempts dispatch `PUZZLE_ATTEMPT` to `uiReducer` so `state.activePuzzle`
 * advances immutably rather than mutating the passed-in prop in place (WF-G231),
 * and that a resolved puzzle stops accepting input.
 *
 * The hint path stays covered by PuzzleRuntimeModal.test.tsx.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameState, PlayerCharacter } from '../../types';
import type { AppAction } from '../../state/actionTypes';
import type { Puzzle } from '../../systems/puzzles/types';
import { uiReducer } from '../../state/reducers/uiReducer';
import PuzzleRuntimeModal, {
  getAuthoredSequenceSteps,
  getUnplacedRequiredItems,
} from './PuzzleRuntimeModal';

// ============================================================================
// Frame Test Double
// ============================================================================
// The test cares about the attempt controls, not window chrome.
// ============================================================================

vi.mock('../ui/WindowFrame', () => ({
  WindowFrame: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section role="dialog" aria-label={title} data-testid="window-puzzle-runtime-window">
      {children}
    </section>
  ),
}));

vi.mock('../../systems/puzzles/puzzleRuntime', () => ({
  requestPuzzleHint: vi.fn(),
}));

// ============================================================================
// Rule-Owner Spy
// ============================================================================
// The modal must delegate every solve decision to puzzleSystem. Spying on the
// real module (rather than replacing it) keeps the live rules in play while
// proving the delegation.
// ============================================================================

const { attemptPuzzleInputMock } = vi.hoisted(() => ({
  attemptPuzzleInputMock: vi.fn(),
}));

vi.mock('../../systems/puzzles/puzzleSystem', async () => {
  const actual = await vi.importActual<typeof import('../../systems/puzzles/puzzleSystem')>(
    '../../systems/puzzles/puzzleSystem'
  );
  attemptPuzzleInputMock.mockImplementation(actual.attemptPuzzleInput);
  return { ...actual, attemptPuzzleInput: attemptPuzzleInputMock };
});

const character = {
  id: 'party-1',
  name: 'Test Hero',
  level: 1,
  proficiencyBonus: 2,
  race: { id: 'human', name: 'Human', description: '', traits: [] },
  class: {
    id: 'wizard',
    name: 'Wizard',
    description: '',
    hitDie: 6,
    primaryAbility: ['Intelligence'],
    savingThrowProficiencies: ['Intelligence'],
    skillProficienciesAvailable: [],
    numberOfSkillProficiencies: 0,
    armorProficiencies: [],
    weaponProficiencies: [],
    features: [],
  },
  abilityScores: {
    Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 16, Wisdom: 10, Charisma: 10,
  },
  finalAbilityScores: {
    Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 16, Wisdom: 10, Charisma: 10,
  },
  stats: {
    strength: 10, dexterity: 10, constitution: 10, intelligence: 16, wisdom: 10, charisma: 10,
    baseInitiative: 0, speed: 30, cr: '1',
  },
  skills: [],
  hp: 8,
  maxHp: 8,
  armorClass: 10,
  speed: 30,
  darkvisionRange: 0,
  transportMode: 'foot',
  statusEffects: [],
  equippedItems: {},
} satisfies PlayerCharacter;

function riddlePuzzle(): Puzzle {
  return {
    id: 'puzzle-moon-gate',
    name: 'Moon Gate Riddle',
    type: 'riddle',
    description: 'A silver door asks what grows brighter in darkness.',
    hint: 'Think about moonlight.',
    hintDC: 12,
    acceptedAnswers: ['moon'],
    maxAttempts: 3,
    isSolved: false,
    isFailed: false,
    currentAttempts: 0,
    currentInputSequence: [],
    onSuccess: { message: 'The moon gate opens.' },
    onFailure: { message: 'The silver door remains shut.' },
  };
}

function sequencePuzzle(): Puzzle {
  return {
    id: 'puzzle-lever-hall',
    name: 'Lever Hall',
    type: 'sequence',
    description: 'Three levers sit in a row.',
    hintDC: 12,
    // Authored order is zeta, alpha, mu — the buttons must NOT reveal it.
    solutionSequence: ['zeta', 'alpha', 'mu'],
    isSolved: false,
    isFailed: false,
    currentAttempts: 0,
    currentInputSequence: [],
    onSuccess: { message: 'The hall grinds open.' },
    onFailure: { message: 'The levers snap back.' },
  };
}

function itemPuzzle(): Puzzle {
  return {
    id: 'puzzle-altar',
    name: 'Offering Altar',
    type: 'item_placement',
    description: 'Two empty sockets await offerings.',
    hintDC: 12,
    requiredItems: ['sun_shard', 'moon_shard'],
    isSolved: false,
    isFailed: false,
    currentAttempts: 0,
    currentInputSequence: [],
    onSuccess: { message: 'The altar blazes.' },
    onFailure: { message: 'The altar stays cold.' },
  };
}

function renderModal(puzzle: Puzzle, dispatch = vi.fn<(action: AppAction) => void>()) {
  return {
    dispatch,
    ...render(
      <PuzzleRuntimeModal
        isOpen
        onClose={vi.fn()}
        puzzle={puzzle}
        character={character}
        dispatch={dispatch}
      />
    ),
  };
}

describe('authored input derivation', () => {
  it('lists sequence steps sorted so the authored order stays secret', () => {
    expect(getAuthoredSequenceSteps(sequencePuzzle())).toEqual(['alpha', 'mu', 'zeta']);
  });

  it('de-duplicates repeated steps in a combination', () => {
    const puzzle = sequencePuzzle();
    puzzle.solutionSequence = ['alpha', 'alpha', 'mu'];
    expect(getAuthoredSequenceSteps(puzzle)).toEqual(['alpha', 'mu']);
  });

  it('drops items that are already placed', () => {
    const puzzle = itemPuzzle();
    puzzle.currentInputSequence = ['sun_shard'];
    expect(getUnplacedRequiredItems(puzzle)).toEqual(['moon_shard']);
  });
});

describe('PuzzleRuntimeModal solve attempts', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sends a riddle answer to the puzzle system, dispatches PUZZLE_ATTEMPT, and leaves the incoming prop unmutated', () => {
    const puzzle = riddlePuzzle();
    const { dispatch } = renderModal(puzzle);

    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'moon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(attemptPuzzleInputMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: puzzle.id }),
      'moon'
    );
    // WF-G231: the passed-in puzzle prop is not mutated in place; progression
    // flows through the PUZZLE_ATTEMPT reducer action.
    expect(puzzle.isSolved).toBe(false);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PUZZLE_ATTEMPT',
      payload: { puzzleId: 'puzzle-moon-gate', input: 'moon' },
    });
    expect(screen.getByTestId('puzzle-attempt-result')).toHaveTextContent('The moon gate opens.');
    // A solved puzzle stops offering input.
    expect(screen.queryByLabelText('Your answer')).not.toBeInTheDocument();
    expect(screen.getByTestId('puzzle-resolved-state')).toBeInTheDocument();
  });

  it('reports a wrong riddle answer, dispatches PUZZLE_ATTEMPT, and advances the rendered attempt counter without mutating the prop', () => {
    const puzzle = riddlePuzzle();
    const { dispatch } = renderModal(puzzle);

    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'sun' } });
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(screen.getByTestId('puzzle-attempt-result')).toHaveTextContent('The silver door remains shut.');
    expect(puzzle.currentAttempts).toBe(0);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PUZZLE_ATTEMPT',
      payload: { puzzleId: 'puzzle-moon-gate', input: 'sun' },
    });
    expect(screen.getByTestId('puzzle-attempt-counter')).toHaveTextContent('Attempts 1 / 3');
  });

  it('refuses an empty riddle answer instead of burning an attempt', () => {
    const puzzle = riddlePuzzle();
    const { dispatch } = renderModal(puzzle);

    expect(screen.getByRole('button', { name: 'Answer' })).toBeDisabled();
    expect(attemptPuzzleInputMock).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(puzzle.currentAttempts).toBe(0);
  });

  it('renders one button per distinct sequence step and records entered order via PUZZLE_ATTEMPT', () => {
    const puzzle = sequencePuzzle();
    const { dispatch } = renderModal(puzzle);

    // Buttons appear in sorted order, not in the authored solution order.
    const labels = ['alpha', 'mu', 'zeta'];
    labels.forEach(label => expect(screen.getByRole('button', { name: label })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'zeta' }));

    expect(attemptPuzzleInputMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: puzzle.id }),
      'zeta'
    );
    expect(puzzle.currentInputSequence).toEqual([]);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PUZZLE_ATTEMPT',
      payload: { puzzleId: 'puzzle-lever-hall', input: 'zeta' },
    });
    expect(screen.getByTestId('puzzle-entered-steps')).toHaveTextContent('Entered: zeta');
    expect(screen.getByTestId('puzzle-attempt-result')).toHaveTextContent('Something clicks into place.');
  });

  it('says so honestly when a sequence puzzle authors no steps', () => {
    const puzzle = sequencePuzzle();
    puzzle.solutionSequence = [];
    renderModal(puzzle);

    expect(screen.getByTestId('puzzle-missing-steps')).toBeInTheDocument();
  });

  it('offers each unplaced required item and drops it once placed', () => {
    const puzzle = itemPuzzle();
    const { dispatch } = renderModal(puzzle);

    fireEvent.click(screen.getByRole('button', { name: 'Place sun_shard' }));

    expect(attemptPuzzleInputMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: puzzle.id }),
      'sun_shard'
    );
    expect(puzzle.currentInputSequence).toEqual([]);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PUZZLE_ATTEMPT',
      payload: { puzzleId: 'puzzle-altar', input: 'sun_shard' },
    });
    expect(screen.queryByRole('button', { name: 'Place sun_shard' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place moon_shard' })).toBeInTheDocument();
  });

  it('blocks input on a puzzle the system already failed', () => {
    const puzzle = riddlePuzzle();
    puzzle.isFailed = true;
    renderModal(puzzle);

    expect(screen.queryByLabelText('Your answer')).not.toBeInTheDocument();
    expect(screen.getByTestId('puzzle-resolved-state')).toHaveTextContent('jammed or broken');
  });

  it('uiReducer PUZZLE_ATTEMPT advances activePuzzle immutably without mutating prior state', () => {
    const original = sequencePuzzle();
    const state = {
      isPuzzleRuntimeVisible: true,
      activePuzzle: original,
    } as unknown as GameState;

    const step1 = uiReducer(state, {
      type: 'PUZZLE_ATTEMPT',
      payload: { puzzleId: original.id, input: 'zeta' },
    });

    expect(step1.activePuzzle).toBeDefined();
    expect(step1.activePuzzle).not.toBe(original);
    expect(original.currentInputSequence).toEqual([]);
    expect(original.isSolved).toBe(false);
    expect(step1.activePuzzle?.currentInputSequence).toEqual(['zeta']);

    const step2 = uiReducer(
      { ...state, ...step1 } as GameState,
      { type: 'PUZZLE_ATTEMPT', payload: { puzzleId: original.id, input: 'alpha' } }
    );
    const step3 = uiReducer(
      { ...state, ...step2 } as GameState,
      { type: 'PUZZLE_ATTEMPT', payload: { puzzleId: original.id, input: 'mu' } }
    );

    expect(step3.activePuzzle?.isSolved).toBe(true);
    expect(step3.activePuzzle?.currentInputSequence).toEqual(['zeta', 'alpha', 'mu']);
  });
});

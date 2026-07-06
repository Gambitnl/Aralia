/**
 * This test file proves the first rendered gameplay caller for puzzle hints.
 *
 * The modal is the puzzle-owned runtime surface approved by PZ-007. These tests
 * make sure a player-facing button asks the puzzle runtime for a hint instead of
 * duplicating hint math inside UI code.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlayerCharacter } from '../../types';
import type { Puzzle } from '../../systems/puzzles/types';
import PuzzleRuntimeModal from './PuzzleRuntimeModal';

// ============================================================================
// Animation and Frame Test Doubles
// ============================================================================
// The test cares about the puzzle caller, not animation timing or window chrome.
// These light doubles keep the rendered surface stable in jsdom.
// ============================================================================

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentPropsWithoutRef<'div'>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('../ui/WindowFrame', () => ({
  WindowFrame: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section role="dialog" aria-label={title} data-testid="window-puzzle-runtime-window">
      {children}
    </section>
  ),
}));

// ============================================================================
// Runtime Spy
// ============================================================================
// Mock only the runtime boundary so this test proves the modal calls the correct
// puzzle-owned surface. The runtime itself is covered by puzzleRuntime.test.ts.
// ============================================================================

const { requestPuzzleHintMock } = vi.hoisted(() => ({
  requestPuzzleHintMock: vi.fn(),
}));

vi.mock('../../systems/puzzles/puzzleRuntime', () => ({
  requestPuzzleHint: requestPuzzleHintMock,
}));

const puzzle: Puzzle = {
  id: 'puzzle-moon-gate',
  name: 'Moon Gate Riddle',
  type: 'riddle',
  description: 'A silver door asks what grows brighter in darkness.',
  hint: 'Think about moonlight.',
  hintDC: 12,
  acceptedAnswers: ['moon'],
  isSolved: false,
  isFailed: false,
  currentAttempts: 0,
  currentInputSequence: [],
  onSuccess: { message: 'The moon gate opens.' },
  onFailure: { message: 'The silver door remains shut.' },
};

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
    Strength: 10,
    Dexterity: 10,
    Constitution: 10,
    Intelligence: 16,
    Wisdom: 10,
    Charisma: 10,
  },
  finalAbilityScores: {
    Strength: 10,
    Dexterity: 10,
    Constitution: 10,
    Intelligence: 16,
    Wisdom: 10,
    Charisma: 10,
  },
  stats: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 16,
    wisdom: 10,
    charisma: 10,
    baseInitiative: 0,
    speed: 30,
    cr: '1',
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

describe('PuzzleRuntimeModal', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('asks the puzzle runtime for a hint from the rendered hint action', () => {
    requestPuzzleHintMock.mockReturnValue({
      kind: 'hint',
      puzzleId: 'puzzle-moon-gate',
      message: 'Think about moonlight.',
    });

    render(
      <PuzzleRuntimeModal
        isOpen
        onClose={vi.fn()}
        puzzle={puzzle}
        character={character}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ask for Hint' }));

    expect(screen.getAllByRole('dialog', { name: 'Moon Gate Riddle' })).toHaveLength(1);
    expect(requestPuzzleHintMock).toHaveBeenCalledWith({ character: character.stats, puzzle });
    expect(screen.getByText('Think about moonlight.')).toBeInTheDocument();
  });
});

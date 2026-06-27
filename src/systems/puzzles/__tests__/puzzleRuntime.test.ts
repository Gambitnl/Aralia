/**
 * This test file proves the gameplay-facing puzzle runtime surface.
 *
 * The lower-level puzzle system already knows how to calculate hints. These
 * tests protect the new runtime layer that gameplay/UI callers should use
 * instead of reaching into the helper directly.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import type { CharacterStats } from '../../../types/combat';
import type { Puzzle } from '../types';
import { requestPuzzleHint } from '../puzzleRuntime';

// ============================================================================
// Test Fixtures
// ============================================================================
// These fixtures describe one real riddle-style puzzle and one character asking
// for help. Keeping them here makes the runtime contract visible to future
// puzzle gameplay tests.
// ============================================================================

const hintCharacter: CharacterStats = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 16,
  wisdom: 10,
  charisma: 10,
  baseInitiative: 0,
  speed: 30,
  cr: '1',
};

const riddlePuzzle: Puzzle = {
  id: 'runtime-riddle',
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

// ============================================================================
// Hint Requests
// ============================================================================
// The runtime surface is the first puzzle-owned gameplay caller for getPuzzleHint.
// It should preserve the helper behavior while adding a stable result envelope
// for UI/gameplay code to render.
// ============================================================================

describe('puzzle runtime surface', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a successful hint result through the puzzle-owned runtime caller', () => {
    // Force the live 1d20 check to meet the puzzle's hint DC.
    vi.spyOn(Math, 'random').mockReturnValue(0.4);

    const result = requestPuzzleHint({
      character: hintCharacter,
      puzzle: riddlePuzzle,
    });

    expect(result).toEqual({
      kind: 'hint',
      puzzleId: 'runtime-riddle',
      message: 'Think about moonlight.',
    });
  });
});

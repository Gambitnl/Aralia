/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/__tests__/puzzleSystem.test.ts
 * Tests for the Puzzle system.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { attemptPuzzleInput, checkPuzzleHint } from '../puzzleSystem';
import { Puzzle } from '../types';

describe('Puzzle System', () => {
  let riddlePuzzle: Puzzle;
  let sequencePuzzle: Puzzle;

  beforeEach(() => {
    riddlePuzzle = {
      id: 'p1',
      name: 'Sphinx Riddle',
      type: 'riddle',
      description: 'What walks on four legs...',
      hint: 'Think about aging.',
      hintDC: 12,
      acceptedAnswers: ['Man', 'Human'],
      isSolved: false,
      isFailed: false,
      currentAttempts: 0,
      currentInputSequence: [],
      onSuccess: { message: 'The door opens.' },
      onFailure: { message: 'The sphinx glares at you.' }
    };

    sequencePuzzle = {
      id: 'p2',
      name: 'Lever Sequence',
      type: 'sequence',
      description: 'Three levers.',
      hintDC: 10,
      solutionSequence: ['left', 'right', 'center'],
      maxAttempts: 3,
      isSolved: false,
      isFailed: false,
      currentAttempts: 0,
      currentInputSequence: [],
      onSuccess: { message: 'Clank!' },
      onFailure: { message: 'Bzzt!', damage: { count: 1, sides: 6, bonus: 0 } }
    };
  });

  describe('Riddle Puzzles', () => {
    it('solves with correct answer (case insensitive)', () => {
      const result = attemptPuzzleInput(riddlePuzzle, 'man');
      expect(result.success).toBe(true);
      expect(result.isSolved).toBe(true);
      expect(riddlePuzzle.isSolved).toBe(true);
    });

    it('fails with incorrect answer', () => {
      const result = attemptPuzzleInput(riddlePuzzle, 'cat');
      expect(result.success).toBe(false);
      expect(result.isSolved).toBe(false);
      expect(riddlePuzzle.currentAttempts).toBe(1);
    });
  });

  describe('Sequence Puzzles', () => {
    it('advances sequence on correct step', () => {
      const result = attemptPuzzleInput(sequencePuzzle, 'left');
      expect(result.success).toBe(true);
      expect(result.isSolved).toBe(false);
      expect(sequencePuzzle.currentInputSequence).toEqual(['left']);
    });

    it('solves when full sequence is entered', () => {
      attemptPuzzleInput(sequencePuzzle, 'left');
      attemptPuzzleInput(sequencePuzzle, 'right');
      const result = attemptPuzzleInput(sequencePuzzle, 'center');

      expect(result.success).toBe(true);
      expect(result.isSolved).toBe(true);
    });

    it('resets sequence on wrong step', () => {
      attemptPuzzleInput(sequencePuzzle, 'left');
      const result = attemptPuzzleInput(sequencePuzzle, 'center'); // Wrong, expects 'right'

      expect(result.success).toBe(false);
      expect(sequencePuzzle.currentInputSequence).toEqual([]); // Should reset
    });

    it('locks out after max attempts', () => {
      attemptPuzzleInput(sequencePuzzle, 'wrong'); // 1
      attemptPuzzleInput(sequencePuzzle, 'wrong'); // 2
      const result = attemptPuzzleInput(sequencePuzzle, 'wrong'); // 3

      expect(result.isFailed).toBe(true);
      expect(sequencePuzzle.isFailed).toBe(true);
      expect(result.consequence?.damage).toBeDefined();
    });

    it('rejects input if already failed', () => {
      sequencePuzzle.isFailed = true;
      const result = attemptPuzzleInput(sequencePuzzle, 'left');
      expect(result.message).toContain('broken');
    });
  });

  describe('Hints', () => {
    it('returns hint if check passes', () => {
      const hint = checkPuzzleHint(15, riddlePuzzle); // DC is 12
      expect(hint).toBe('Think about aging.');
    });

    it('returns null if check fails', () => {
      const hint = checkPuzzleHint(5, riddlePuzzle);
      expect(hint).toBeNull();
    });
  });
});

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/puzzleSystem.ts
 * Implements logic for interacting with Puzzles.
 */

import { Puzzle, PuzzleResult } from './types';
import { CharacterStats } from '../../types/combat';
// TODO(lint-intent): 'rollDice' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { rollDice as _rollDice } from '../../utils/combatUtils';

/**
 * Attempts to solve a step of the puzzle or the whole puzzle.
 * @param puzzle The puzzle instance.
 * @param input The user input (text answer, lever ID, or item ID).
 */
export function attemptPuzzleInput(
  puzzle: Puzzle,
  input: string
): PuzzleResult {
  // 1. Validation
  if (puzzle.isSolved) {
    return { success: false, isSolved: true, isFailed: false, message: 'Puzzle is already solved.' };
  }
  if (puzzle.isFailed) {
    return { success: false, isSolved: false, isFailed: true, message: 'The mechanism is jammed or broken.' };
  }

  // 2. Logic based on Type
  let correctStep = false;
  let puzzleSolved = false;
  let puzzleFailed = false;

  switch (puzzle.type) {
    case 'riddle':
      // Direct text comparison
      if (puzzle.acceptedAnswers?.some(ans => ans.toLowerCase() === input.toLowerCase())) {
        correctStep = true;
        puzzleSolved = true;
      }
      break;

    case 'sequence':
    case 'combination': {
      // Add to sequence
      puzzle.currentInputSequence.push(input);

      // Check if the sequence so far matches the solution prefix
      // TODO(lint-intent): This switch case declares new bindings, implying scoped multi-step logic.
      // TODO(lint-intent): Wrap the case in braces or extract a helper to keep scope and intent clear.
      // TODO(lint-intent): If shared state is intended, lift the declarations outside the switch.
      const currentIndex = puzzle.currentInputSequence.length - 1;
      // TODO(lint-intent): This switch case declares new bindings, implying scoped multi-step logic.
      // TODO(lint-intent): Wrap the case in braces or extract a helper to keep scope and intent clear.
      // TODO(lint-intent): If shared state is intended, lift the declarations outside the switch.
      const expected = puzzle.solutionSequence?.[currentIndex];

      if (input === expected) {
        correctStep = true;
        // Check if full sequence is done
        if (puzzle.currentInputSequence.length === puzzle.solutionSequence?.length) {
          puzzleSolved = true;
        }
      } else {
        // Wrong step in sequence
        correctStep = false;
        puzzle.currentInputSequence = []; // Reset sequence on mistake usually, or just fail?
        // Standard RPG trope: Reset sequence on mistake.
      }
      break;
    }

    case 'item_placement':
      // Check if item is required
      if (puzzle.requiredItems?.includes(input)) {
        // Logic: Add to placed items. (Assuming currentInputSequence stores placed item IDs for this type)
        if (!puzzle.currentInputSequence.includes(input)) {
           puzzle.currentInputSequence.push(input);
           correctStep = true;

           // Check if all items are placed
           if (puzzle.requiredItems.every(id => puzzle.currentInputSequence.includes(id))) {
             puzzleSolved = true;
           }
        } else {
           return { success: false, isSolved: false, isFailed: false, message: 'Item already placed.' };
        }
      }
      break;
  }

  // 3. Handle Outcomes
  if (puzzleSolved) {
    puzzle.isSolved = true;
    return {
      success: true,
      isSolved: true,
      isFailed: false,
      message: puzzle.onSuccess.message
    };
  }

  if (correctStep) {
    return {
      success: true,
      isSolved: false,
      isFailed: false,
      message: 'Something clicks into place.'
    };
  } else {
    // Failure logic
    puzzle.currentAttempts++;

    // Check if max attempts reached
    if (puzzle.maxAttempts && puzzle.currentAttempts >= puzzle.maxAttempts) {
      puzzle.isFailed = true;
      puzzleFailed = true;
    }

    const result: PuzzleResult = {
      success: false,
      isSolved: false,
      isFailed: puzzleFailed,
      message: puzzle.onFailure?.message || 'Nothing happens, or something went wrong.'
    };

    // Apply penalties
    if (puzzle.onFailure?.damage) {
      result.consequence = { damage: puzzle.onFailure.damage };
    }
    if (puzzle.onFailure?.trapId) {
      result.consequence = { ...result.consequence, trapId: puzzle.onFailure.trapId };
    }

    return result;
  }

// TODO(Lockpick): Integrate this system with the Dungeon Map generation (Submap) to place puzzles.
}

/**
 * Checks if a character can deduce a hint for the puzzle.
 * @param character The character attempting to find a hint.
 * @param puzzle The puzzle.
 */
export function getPuzzleHint(
  character: CharacterStats, // Using simplified stats or just passing the object with stats
  puzzle: Puzzle
): string | null {
  if (!puzzle.hint) return null;

  // Assuming character has ability modifiers.
  // We need to calculate the check.
  // Since CharacterStats in types/combat might differ, we'll assume we pass an object with ability modifiers map
  // or we pass the 'intelligence' score.

  // For now, let's assume we pass the roll result or we need to access the modifier.
  // But to keep this pure and simple given imports:

  // Actually, we should probably pass the check result (roll + mod) to this function,
  // rather than calculating it here to avoid dependency coupling with Character implementation details.
  // OR we accept a number: "checkResult".

  return null;
}

/**
 * Returns the hint if the check result meets the DC.
 */
export function checkPuzzleHint(
  checkResult: number,
  puzzle: Puzzle
): string | null {
  if (!puzzle.hint) return null;
  if (checkResult >= puzzle.hintDC) {
    return puzzle.hint;
  }
  return null;
}

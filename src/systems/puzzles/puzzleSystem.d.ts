/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/puzzleSystem.ts
 * Implements logic for interacting with Puzzles.
 */
import { Puzzle, PuzzleResult } from './types';
import { CharacterStats } from '../../types/combat';
/**
 * Attempts to solve a step of the puzzle or the whole puzzle.
 * @param puzzle The puzzle instance.
 * @param input The user input (text answer, lever ID, or item ID).
 */
export declare function attemptPuzzleInput(puzzle: Puzzle, input: string): PuzzleResult;
/**
 * Checks if a character can deduce a hint for the puzzle.
 * @param character The character attempting to find a hint.
 * @param puzzle The puzzle.
 */
export declare function getPuzzleHint(character: CharacterStats, puzzle: Puzzle): string | null;
/**
 * Returns the hint if the check result meets the DC.
 */
export declare function checkPuzzleHint(checkResult: number, puzzle: Puzzle): string | null;

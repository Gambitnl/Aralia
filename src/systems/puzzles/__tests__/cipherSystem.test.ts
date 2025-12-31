/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/__tests__/cipherSystem.test.ts
 * Tests for the Cipher System logic.
 */

import { describe, it, expect, vi } from 'vitest';
import { caesarCipher, attemptDecipherCheck, getDisplayedText, attemptCipherSolution } from '../cipherSystem';
import { Puzzle, CipherData } from '../types';
import { createMockPlayerCharacter } from '../../../utils/factories';

// Mock rollDice to control outcomes
vi.mock('../../../utils/combatUtils', () => ({
  rollDice: vi.fn(),
  calculateDamage: vi.fn(),
}));
import { rollDice } from '../../../utils/combatUtils';

describe('Cipher System', () => {
  const mockCipherData: CipherData = {
    encryptedText: '',
    decryptedText: 'HELLO WORLD',
    method: 'shift',
    shiftAmount: 1,
    revealedIndices: []
  };

  const mockPuzzle: Puzzle = {
    id: 'cipher1',
    name: 'Test Cipher',
    type: 'cipher',
    description: 'A simple shift cipher',
    hintDC: 10,
    cipherData: mockCipherData,
    isSolved: false,
    isFailed: false,
    currentAttempts: 0,
    currentInputSequence: [],
    onSuccess: { message: 'You solved it!' },
    onFailure: { message: 'You failed.' }
  };

  it('correctly shifts text with caesar cipher', () => {
    expect(caesarCipher('ABC', 1)).toBe('BCD');
    expect(caesarCipher('ZOO', 1)).toBe('APP');
    expect(caesarCipher('ABC', -1)).toBe('ZAB');
    expect(caesarCipher('Hello, World!', 13)).toBe('Uryyb, Jbeyq!');
  });

  it('displays mixed text based on revealed indices', () => {
    const puzzle = { ...mockPuzzle, cipherData: { ...mockCipherData, encryptedText: 'IFMMP XPSME' } }; // Shift 1

    // Nothing revealed
    expect(getDisplayedText(puzzle)).toBe('IFMMP XPSME');

    // Reveal 'H' (index 0) and 'D' (index 10)
    puzzle.cipherData.revealedIndices = [0, 10];
    // H (decrypted) F M M P (encrypted) ... D (decrypted)
    expect(getDisplayedText(puzzle)).toBe('HFMMP XPSMD');
  });

  it('reveals characters on successful skill check', () => {
    const character = createMockPlayerCharacter({
        stats: { intelligence: 10 }, // Mod +0
        proficiencyBonus: 2 // Explicitly set proficiency bonus
    });
    const puzzle = { ...mockPuzzle, cipherData: { ...mockCipherData, encryptedText: 'IFMMP XPSME', revealedIndices: [] } };

    // DC is 10. Roll 15 (Margin 5). Should reveal 1 + floor(5/3) = 2 chars.
    (rollDice as any).mockReturnValue(15);

    const result = attemptDecipherCheck(character, puzzle);

    expect(result.success).toBe(true);
    expect(result.revealedCount).toBeGreaterThanOrEqual(1);
    expect(puzzle.cipherData.revealedIndices.length).toBeGreaterThanOrEqual(1);
  });

  it('solves the puzzle when input matches decrypted text', () => {
      const puzzle = { ...mockPuzzle, cipherData: { ...mockCipherData, encryptedText: 'IFMMP XPSME' } };

      const result = attemptCipherSolution(puzzle, 'HELLO WORLD');
      expect(result.success).toBe(true);
      expect(result.isSolved).toBe(true);
      expect(puzzle.isSolved).toBe(true);
  });

  it('handles case insensitive solution', () => {
      const puzzle = { ...mockPuzzle, cipherData: { ...mockCipherData, encryptedText: 'IFMMP XPSME' } };

      const result = attemptCipherSolution(puzzle, 'hello world');
      expect(result.success).toBe(true);
      expect(result.isSolved).toBe(true);
  });
});

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/cipherSystem.ts
 * Implements logic for Cipher puzzles, including encryption, decryption attempts, and partial solving.
 */

import { Puzzle, CipherData } from './types';
import { PlayerCharacter } from '../../types/character';
import { rollDice } from '../../utils/combatUtils';
import { getAbilityModifierValue } from '../../utils/statUtils';

/**
 * Enciphers text using a Caesar shift.
 * @param text The plain text.
 * @param shift The shift amount.
 */
export function caesarCipher(text: string, shift: number): string {
  return text.split('').map(char => {
    if (char.match(/[a-z]/i)) {
      const code = char.charCodeAt(0);
      const start = char >= 'a' ? 97 : 65;
      // Javascript % operator handles negative numbers differently, so we ensure positive result
      return String.fromCharCode(((code - start + shift) % 26 + 26) % 26 + start);
    }
    return char;
  }).join('');
}

/**
 * Initializes the encrypted text for a cipher puzzle if not already set.
 * Useful for procedural generation.
 */
export function initializeCipher(puzzle: Puzzle): Puzzle {
  if (puzzle.type !== 'cipher' || !puzzle.cipherData) {
    return puzzle;
  }

  const data = puzzle.cipherData;
  if (!data.encryptedText && data.decryptedText) {
    if (data.method === 'shift' && typeof data.shiftAmount === 'number') {
      data.encryptedText = caesarCipher(data.decryptedText, data.shiftAmount);
    }
    // Substitution logic would go here
  }

  // Ensure revealedIndices is initialized
  if (!data.revealedIndices) {
      data.revealedIndices = [];
  }

  return puzzle;
}

/**
 * Helper to get the current state of the text (mix of encrypted and revealed).
 */
export function getDisplayedText(puzzle: Puzzle): string {
    if (puzzle.type !== 'cipher' || !puzzle.cipherData) return '';

    const { encryptedText, decryptedText, revealedIndices } = puzzle.cipherData;

    if (puzzle.isSolved) return decryptedText;

    return encryptedText.split('').map((char, index) => {
        // If it's a non-letter, show it as is
        if (!char.match(/[a-z]/i)) return char;

        // If this index is revealed, show the decrypted char
        if (revealedIndices.includes(index)) return decryptedText[index];

        // Otherwise show encrypted char
        return char;
    }).join('');
}

/**
 * Attempts to decipher the puzzle using a skill check (Intelligence/Investigation).
 * Success reveals characters.
 *
 * @param character The character attempting the check.
 * @param puzzle The puzzle instance.
 * @param useLanguage Use a language proficiency instead of generic intelligence? (Optional)
 */
export function attemptDecipherCheck(
    character: PlayerCharacter,
    puzzle: Puzzle,
    useLanguage?: string
): { success: boolean; revealedCount: number; message: string } {
    if (puzzle.type !== 'cipher' || !puzzle.cipherData) {
        return { success: false, revealedCount: 0, message: "Not a cipher." };
    }

    if (puzzle.isSolved) {
        return { success: true, revealedCount: 0, message: "Already solved." };
    }

    // Check language requirement first
    if (puzzle.cipherData.language) {
        // Placeholder for language proficiency check
    }

    const intMod = getAbilityModifierValue(character.stats.intelligence);
    const profBonus = character.proficiencyBonus || 0; // Fixed: Default to 0

    // Determine DC.
    const dc = puzzle.hintDC || 15;

    const roll = rollDice('1d20');
    const total = roll + intMod + profBonus;

    if (total >= dc) {
        const margin = total - dc;
        // Reveal 1 character per 3 points of margin + 1 base
        const numToReveal = 1 + Math.floor(margin / 3);

        const data = puzzle.cipherData;
        const unrevealedIndices: number[] = [];

        for (let i = 0; i < data.decryptedText.length; i++) {
             if (data.decryptedText[i].match(/[a-z]/i) && !data.revealedIndices.includes(i)) {
                 unrevealedIndices.push(i);
             }
        }

        let actualRevealed = 0;
        // Shuffle unrevealed
        const shuffled = unrevealedIndices.sort(() => 0.5 - Math.random());

        for (let i = 0; i < numToReveal && i < shuffled.length; i++) {
            data.revealedIndices.push(shuffled[i]);
            actualRevealed++;
        }

        // Check if fully solved
        const remaining = data.decryptedText.length - (data.decryptedText.match(/[^a-z]/gi)?.length || 0); // Total letters
        if (data.revealedIndices.length >= remaining) {
            puzzle.isSolved = true;
            return { success: true, revealedCount: actualRevealed, message: puzzle.onSuccess.message };
        }

        return {
            success: true,
            revealedCount: actualRevealed,
            message: `You decipher part of the text. (${actualRevealed} characters revealed)`
        };
    }

    puzzle.currentAttempts++;
    if (puzzle.maxAttempts && puzzle.currentAttempts >= puzzle.maxAttempts) {
        puzzle.isFailed = true;
        return { success: false, revealedCount: 0, message: puzzle.onFailure?.message || "You fail to make sense of it." };
    }

    return { success: false, revealedCount: 0, message: "The cipher baffles you." };
}

/**
 * Attempts to solve the cipher by guessing the plaintext.
 */
export function attemptCipherSolution(
    puzzle: Puzzle,
    input: string
): PuzzleResult {
    if (puzzle.type !== 'cipher' || !puzzle.cipherData) {
         return { success: false, isSolved: false, isFailed: false, message: "Not a cipher." };
    }

    if (input.toLowerCase() === puzzle.cipherData.decryptedText.toLowerCase()) {
        puzzle.isSolved = true;
        // Reveal all
        const allIndices = [];
        for (let i=0; i<puzzle.cipherData.decryptedText.length; i++) allIndices.push(i);
        puzzle.cipherData.revealedIndices = allIndices;

        return {
            success: true,
            isSolved: true,
            isFailed: false,
            message: puzzle.onSuccess.message
        };
    }

    puzzle.currentAttempts++;
    // Logic for failure...
    return {
        success: false,
        isSolved: false,
        isFailed: false,
        message: "That is not the correct translation."
    };
}

// TODO(Lockpick): Link cipher solving to the Item Identification system (e.g. deciphering ancient scrolls).

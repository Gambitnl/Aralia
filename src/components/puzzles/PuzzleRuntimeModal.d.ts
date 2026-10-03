/**
 * This file renders the first puzzle-owned runtime surface for gameplay.
 *
 * Locations can now open this modal with a live `Puzzle` object. The surface
 * keeps puzzle hint requests inside the Puzzles project by calling
 * `requestPuzzleHint`, which preserves the existing PZ-002 helper behavior
 * while giving players a visible place to ask for help.
 *
 * Called by: GameModals.tsx when `activePuzzle` is present in game state.
 * Depends on: puzzleRuntime.ts for hint requests and WindowFrame for modal chrome.
 */
import React from 'react';
import type { PlayerCharacter } from '../../types';
import type { Puzzle } from '../../systems/puzzles/types';
interface PuzzleRuntimeModalProps {
    isOpen: boolean;
    onClose: () => void;
    puzzle: Puzzle;
    character: PlayerCharacter;
}
export declare const PuzzleRuntimeModal: React.FC<PuzzleRuntimeModalProps>;
export default PuzzleRuntimeModal;

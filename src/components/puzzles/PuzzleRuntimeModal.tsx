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

import React, { useCallback, useEffect, useState } from 'react';
import { Lightbulb, ScrollText } from 'lucide-react';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import type { PlayerCharacter } from '../../types';
import type { Puzzle } from '../../systems/puzzles/types';
import { requestPuzzleHint, type PuzzleRuntimeHintResult } from '../../systems/puzzles/puzzleRuntime';

interface PuzzleRuntimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  puzzle: Puzzle;
  character: PlayerCharacter;
}

// ============================================================================
// Character Stat Bridge
// ============================================================================
// Puzzle helpers still use the legacy lowercase CharacterStats shape. Player
// characters can already carry that shim, so the modal prefers it and falls back
// to final ability scores only when the shim is absent.
// ============================================================================

function getPuzzleHintStats(character: PlayerCharacter): NonNullable<PlayerCharacter['stats']> {
  if (character.stats) {
    return character.stats;
  }

  // Convert the modern sheet scores into the legacy stats shape without
  // changing the helper contract in this PZ-007 slice.
  return {
    strength: character.finalAbilityScores.Strength,
    dexterity: character.finalAbilityScores.Dexterity,
    constitution: character.finalAbilityScores.Constitution,
    intelligence: character.finalAbilityScores.Intelligence,
    wisdom: character.finalAbilityScores.Wisdom,
    charisma: character.finalAbilityScores.Charisma,
    baseInitiative: 0,
    speed: character.speed,
    cr: String(character.level),
  };
}

// ============================================================================
// Puzzle Runtime Modal
// ============================================================================
// This surface is intentionally narrow: it owns the live Puzzle object and the
// first hint caller, while solve attempts and authored puzzle input controls
// remain deferred to later puzzle progression slices.
// ============================================================================

export const PuzzleRuntimeModal: React.FC<PuzzleRuntimeModalProps> = ({
  isOpen,
  onClose,
  puzzle,
  character,
}) => {
  const [hintResult, setHintResult] = useState<PuzzleRuntimeHintResult | null>(null);

  // Reset transient output whenever a new puzzle opens.
  useEffect(() => {
    if (isOpen) {
      setHintResult(null);
    }
  }, [isOpen, puzzle.id]);

  const handleHintRequest = useCallback(() => {
    // Route the first gameplay hint request through the puzzle runtime surface.
    const result = requestPuzzleHint({
      character: getPuzzleHintStats(character),
      puzzle,
    });
    setHintResult(result);
  }, [character, puzzle]);

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={puzzle.name}>
      <WindowFrame
        title={puzzle.name}
        onClose={onClose}
        storageKey={WINDOW_KEYS.PUZZLE_RUNTIME_MODAL}
      >
        <div className="flex h-full flex-col bg-slate-950 text-slate-100">
          <div className="border-b border-slate-700 bg-slate-900 px-6 py-4">
            <div className="flex items-center gap-3 text-amber-300">
              <ScrollText className="h-5 w-5" aria-hidden="true" />
              <span className="text-sm font-semibold uppercase tracking-wide">Puzzle</span>
            </div>
            <h2 className="mt-2 text-xl font-bold text-white">{puzzle.name}</h2>
          </div>

          <div className="flex flex-1 flex-col gap-5 p-6">
            <p className="rounded border border-slate-700 bg-slate-900/70 p-4 text-sm leading-6 text-slate-200">
              {puzzle.description}
            </p>

            {hintResult && (
              <div
                className={`rounded border p-4 text-sm ${
                  hintResult.kind === 'hint'
                    ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-100'
                    : 'border-amber-500/60 bg-amber-950/40 text-amber-100'
                }`}
              >
                {hintResult.message}
              </div>
            )}

            <div className="mt-auto flex justify-end">
              <button
                type="button"
                onClick={handleHintRequest}
                className="inline-flex items-center gap-2 rounded border border-amber-500 bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                <Lightbulb className="h-4 w-4" aria-hidden="true" />
                Ask for Hint
              </button>
            </div>
          </div>
        </div>
      </WindowFrame>
    </div>
  );
};

export default PuzzleRuntimeModal;

/**
 * This file renders the first puzzle-owned runtime surface for gameplay.
 *
 * Locations can now open this modal with a live `Puzzle` object. The surface
 * keeps puzzle hint requests inside the Puzzles project by calling
 * `requestPuzzleHint`, which preserves the existing PZ-002 helper behavior
 * while giving players a visible place to ask for help.
 *
 * As of agora-b877 the surface also owns solve attempts: it renders the input
 * controls the authored puzzle actually defines (riddle answers, ordered
 * sequence/combination steps, item placements) and sends each one to
 * `attemptPuzzleInput`, the existing puzzle-system rule owner.
 *
 * Called by: GameModals.tsx when `activePuzzle` is present in game state.
 * Depends on: puzzleRuntime.ts for hint requests, puzzleSystem.ts for solve
 * attempts, and WindowFrame for modal chrome.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Lightbulb, ScrollText } from 'lucide-react';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import type { PlayerCharacter } from '../../types';
import type { Puzzle, PuzzleResult } from '../../systems/puzzles/types';
import { requestPuzzleHint, type PuzzleRuntimeHintResult } from '../../systems/puzzles/puzzleRuntime';
import { attemptPuzzleInput } from '../../systems/puzzles/puzzleSystem';

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
// Authored Input Controls
// ============================================================================
// The controls a player sees are derived from the puzzle the author wrote, not
// from a generic form. Each PuzzleType in systems/puzzles/types.ts carries a
// different solution field, so each gets the control that field describes.
//
// Sequence and combination steps are listed in sorted order on purpose: the set
// of levers is visible in the room anyway, and it is the ORDER that is the
// secret. Presenting them in `solutionSequence` order would hand over the answer.
// ============================================================================

/** The distinct steps a sequence or combination puzzle accepts, order hidden. */
export function getAuthoredSequenceSteps(puzzle: Puzzle): string[] {
  return Array.from(new Set(puzzle.solutionSequence ?? [])).sort();
}

/** The required items a placement puzzle is still waiting for. */
export function getUnplacedRequiredItems(puzzle: Puzzle): string[] {
  return (puzzle.requiredItems ?? []).filter(id => !puzzle.currentInputSequence.includes(id));
}

// ============================================================================
// Puzzle Runtime Modal
// ============================================================================
// This surface owns the live Puzzle object, the hint caller, and — since
// agora-b877 — solve attempts.
//
// Attempts are sent to `attemptPuzzleInput` against the LIVE puzzle record that
// GameModals passes down from `state.activePuzzle`. That is deliberate:
// puzzleSystem.ts is written to advance puzzle state in place
// (`puzzle.isSolved = true`, `puzzle.currentInputSequence.push(...)`), and the
// reducer holds that same object, so progress survives the player closing and
// reopening the modal. The React re-render is driven by the stored attempt
// result, and the render body reads the mutated record directly.
//
// What this does NOT do: there is no PUZZLE_ATTEMPT reducer action, so the
// mutation never flows through the reducer pipeline and a save written from a
// snapshot-copying path would not carry it. Filed as a workflow/system gap
// rather than papered over here.
// ============================================================================

export const PuzzleRuntimeModal: React.FC<PuzzleRuntimeModalProps> = ({
  isOpen,
  onClose,
  puzzle,
  character,
}) => {
  const [hintResult, setHintResult] = useState<PuzzleRuntimeHintResult | null>(null);
  const [attemptResult, setAttemptResult] = useState<PuzzleResult | null>(null);
  const [riddleAnswer, setRiddleAnswer] = useState('');

  // Reset transient output whenever a new puzzle opens.
  useEffect(() => {
    if (isOpen) {
      setHintResult(null);
      setAttemptResult(null);
      setRiddleAnswer('');
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

  const handleAttempt = useCallback((input: string) => {
    // puzzleSystem owns every puzzle rule. The modal only decides WHICH input
    // the player just chose; it never re-implements the solve check.
    const result = attemptPuzzleInput(puzzle, input);
    setAttemptResult(result);
  }, [puzzle]);

  const handleRiddleSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const answer = riddleAnswer.trim();
    if (!answer) return;
    handleAttempt(answer);
    setRiddleAnswer('');
  }, [handleAttempt, riddleAnswer]);

  if (!isOpen) return null;

  // Read straight off the live record so the panel reflects the mutation
  // puzzleSystem just made.
  const isResolved = puzzle.isSolved || puzzle.isFailed;
  const sequenceSteps = getAuthoredSequenceSteps(puzzle);
  const unplacedItems = getUnplacedRequiredItems(puzzle);
  const isSequenceType = puzzle.type === 'sequence' || puzzle.type === 'combination';

  return (
    // WindowFrame already provides the named dialog surface for this puzzle.
    // Avoid wrapping it in a second zero-height dialog, because browsers and
    // assistive tools will find the hidden wrapper before the visible window.
    <WindowFrame
      title={puzzle.name}
      onClose={onClose}
      storageKey={WINDOW_KEYS.PUZZLE_RUNTIME_MODAL}
    >
        <div className="flex h-full min-h-0 flex-col bg-slate-950 text-slate-100">
          <div className="border-b border-slate-700 bg-slate-900 px-6 py-4">
            <div className="flex items-center gap-3 text-amber-300">
              <ScrollText className="h-5 w-5" aria-hidden="true" />
              <span className="text-sm font-semibold uppercase tracking-wide">Puzzle</span>
            </div>
            <h2 className="mt-2 text-xl font-bold text-white">{puzzle.name}</h2>
          </div>

          <div className="scrollable-content flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6">
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

            {/* ------------------------------------------------------------
                Solve attempts (agora-b877)
                ------------------------------------------------------------ */}
            <section aria-label="Solve attempts" className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                <span>Attempt</span>
                {typeof puzzle.maxAttempts === 'number' && (
                  <span data-testid="puzzle-attempt-counter">
                    Attempts {puzzle.currentAttempts} / {puzzle.maxAttempts}
                  </span>
                )}
              </div>

              {isSequenceType && puzzle.currentInputSequence.length > 0 && (
                <p className="text-sm text-slate-300" data-testid="puzzle-entered-steps">
                  Entered: {puzzle.currentInputSequence.join(' → ')}
                </p>
              )}

              {isResolved ? (
                <p
                  className={`rounded border p-3 text-sm ${
                    puzzle.isSolved
                      ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-100'
                      : 'border-rose-500/60 bg-rose-950/40 text-rose-100'
                  }`}
                  data-testid="puzzle-resolved-state"
                >
                  {puzzle.isSolved
                    ? 'This puzzle is solved. Nothing more to try.'
                    : 'The mechanism is jammed or broken. No further attempts are possible.'}
                </p>
              ) : (
                <>
                  {puzzle.type === 'riddle' && (
                    <form onSubmit={handleRiddleSubmit} className="flex flex-col gap-2 sm:flex-row">
                      <label className="sr-only" htmlFor="puzzle-riddle-answer">
                        Your answer
                      </label>
                      <input
                        id="puzzle-riddle-answer"
                        type="text"
                        value={riddleAnswer}
                        onChange={event => setRiddleAnswer(event.target.value)}
                        placeholder="Speak your answer"
                        className="flex-1 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                      <button
                        type="submit"
                        disabled={riddleAnswer.trim().length === 0}
                        className="rounded border border-emerald-500 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-800 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      >
                        Answer
                      </button>
                    </form>
                  )}

                  {isSequenceType && (
                    sequenceSteps.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {sequenceSteps.map(step => (
                          <button
                            key={step}
                            type="button"
                            onClick={() => handleAttempt(step)}
                            className="rounded border border-slate-500 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:border-amber-400 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
                          >
                            {step}
                          </button>
                        ))}
                      </div>
                    ) : (
                      // Honest failure: a sequence puzzle with no authored steps
                      // is unplayable data, and saying so beats a dead control.
                      <p className="text-sm text-rose-300" data-testid="puzzle-missing-steps">
                        This puzzle defines no input steps, so it cannot be attempted.
                      </p>
                    )
                  )}

                  {puzzle.type === 'item_placement' && (
                    unplacedItems.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {unplacedItems.map(itemId => (
                          <button
                            key={itemId}
                            type="button"
                            onClick={() => handleAttempt(itemId)}
                            className="rounded border border-slate-500 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:border-amber-400 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
                          >
                            Place {itemId}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-rose-300" data-testid="puzzle-missing-steps">
                        This puzzle names no required items, so nothing can be placed.
                      </p>
                    )
                  )}
                </>
              )}

              {attemptResult && (
                <div
                  role="status"
                  data-testid="puzzle-attempt-result"
                  className={`rounded border p-4 text-sm ${
                    attemptResult.success
                      ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-100'
                      : 'border-rose-500/60 bg-rose-950/40 text-rose-100'
                  }`}
                >
                  {attemptResult.message}
                </div>
              )}
            </section>

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
  );
};

export default PuzzleRuntimeModal;

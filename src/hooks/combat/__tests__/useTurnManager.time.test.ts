/**
 * This file tests how the combat turn manager reports elapsed world time.
 *
 * Combat does not own gameTime directly. The turn manager only announces that a
 * complete round has elapsed, and App.tsx converts that announcement into the
 * shared ADVANCE_TIME action.
 *
 * Called by: Vitest
 * Depends on: useTurnManager.ts, mock combat characters, and the shared
 * ROUND_DURATION_SECONDS constant
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTurnManager } from '../useTurnManager';
import { createMockCombatCharacter } from '../../../utils/core';
import { ROUND_DURATION_SECONDS } from '../../../utils/core/spellTimeUtils';
import type { CombatCharacter, CombatLogEntry } from '../../../types/combat';

// The time test is about round boundaries, not AI timing. Disabling the AI hook
// keeps the test focused and prevents background timers from ending turns for us.
vi.mock('../useCombatAI', () => ({
  useCombatAI: () => ({ aiState: 'idle' }),
}));

// ============================================================================
// Combatant Builder
// ============================================================================
// These characters are deliberately simple, living player-side combatants. That
// lets the test advance turns manually and prove that only a completed full
// round reports elapsed world time.
// ============================================================================
const createRoundTimeCombatant = (id: string, name: string): CombatCharacter => {
  const baseCombatant = createMockCombatCharacter();

  // Preserve the factory's full stat shape while making initiative deterministic
  // once Math.random is mocked in the test setup.
  return createMockCombatCharacter({
    id,
    name,
    team: 'player',
    stats: {
      ...baseCombatant.stats,
      baseInitiative: 0,
    },
  });
};

// ============================================================================
// Round-Time Reporting
// ============================================================================
// A full D&D combat round means every living combatant has had a turn. Aralia
// converts that full round into six seconds of world time, but only by calling a
// callback that the app can route into ADVANCE_TIME.
// ============================================================================
describe('useTurnManager combat time reporting', () => {
  beforeEach(() => {
    // Initiative is not the behavior under test, so keep it stable.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports six seconds exactly once when a full round completes', () => {
    const characters = [
      createRoundTimeCombatant('hero', 'Hero'),
      createRoundTimeCombatant('ally', 'Ally'),
    ];
    const onCharacterUpdate = vi.fn<(character: CombatCharacter) => void>();
    const onLogEntry = vi.fn<(entry: CombatLogEntry) => void>();
    const onRoundElapsed = vi.fn<(seconds: number) => void>();

    const { result } = renderHook(() => useTurnManager({
      characters,
      mapData: null,
      onCharacterUpdate,
      onLogEntry,
      onRoundElapsed,
    }));

    // Initializing combat starts round one but does not mean a full round has
    // elapsed yet.
    act(() => {
      result.current.initializeCombat(characters);
    });
    expect(onRoundElapsed).not.toHaveBeenCalled();

    // Ending only the first combatant's turn is not enough to spend a full
    // six-second round of world time.
    act(() => {
      result.current.endTurn();
    });
    expect(onRoundElapsed).not.toHaveBeenCalled();

    // Once turn order wraps back to the first combatant, the completed round is
    // reported exactly once with the shared six-second duration constant.
    act(() => {
      result.current.endTurn();
    });
    expect(onRoundElapsed).toHaveBeenCalledTimes(1);
    expect(onRoundElapsed).toHaveBeenCalledWith(ROUND_DURATION_SECONDS);
  });
});

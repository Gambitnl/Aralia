/**
 * @file handleTownRoutineEvents.test.ts
 * Acceptance for the Worldforge routine bridge (agora-13a9.1): advancing the
 * world clock across an hour boundary in a town WITH a roster must emit at
 * least one NPC location event.
 *
 * The burg resolver is stubbed because the real one reads the FMG atlas; the
 * roster is injected for the same reason. Everything under test — the schedule
 * diff and the event emission — is the real code.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleTownRoutineEvents, townRoutineChanges } from '../handleWorldEvents';
import type React from 'react';
import type { GameState } from '../../../types';
import type { AppAction } from '../../../state/actionTypes';
import type { TownRoster } from '../../../systems/worldforge/roster/types';

vi.mock('../../../systems/worldforge/townsim/chronicleForLocation', () => ({
  burgIdForLocation: (input: { cellId?: number | null }) =>
    input.cellId === 42 ? 7 : undefined,
}));

const ROSTER: TownRoster = {
  burgId: 7,
  occupants: [
    { id: 1, name: 'Hedda Barrow', ageBand: 'adult', homePlotId: 3, workPlotId: 11, occupation: 'shopkeeper' },
    { id: 2, name: 'Orin Fell', ageBand: 'adult', homePlotId: 4, workPlotId: 12, occupation: 'artisan' },
    { id: 3, name: 'Bess Tully', ageBand: 'child', homePlotId: 3, occupation: 'resident' },
  ],
};

function stateAt(hour: number, cellId: number | null): GameState {
  const gameTime = new Date(2024, 0, 1, hour, 0, 0);
  return {
    gameTime,
    worldSeed: 1234,
    playerCell: cellId === null ? null : { cellId, localeCoords: null },
  } as unknown as GameState;
}

describe('handleTownRoutineEvents', () => {
  let dispatch: ReturnType<typeof vi.fn>;
  const dispatchFn = () => dispatch as unknown as React.Dispatch<AppAction>;

  beforeEach(() => {
    dispatch = vi.fn();
  });

  it('emits at least one NPC location event when an hour passes in a town with a roster', async () => {
    // 03:00 (everyone asleep at home) -> 04:00 is still night, so advance into
    // the working day: 11:00, one hour on from 10:00.
    const changes = await handleTownRoutineEvents(stateAt(12, 42), dispatchFn(), {
      hoursAdvanced: 8,
      resolveRoster: () => ROSTER,
    });

    expect(changes.length).toBeGreaterThan(0);
    expect(dispatch).toHaveBeenCalled();

    const entry = dispatch.mock.calls[0][0];
    expect(entry.type).toBe('ADD_DISCOVERY_ENTRY');
    expect(entry.payload.title).toBe('Town Routine');
    // The event carries the concrete plot the NPC moved to.
    const plotFlag = entry.payload.flags.find((f: { key: string }) => f.key === 'plotId');
    expect(typeof plotFlag.value).toBe('number');
    const occupantFlag = entry.payload.flags.find((f: { key: string }) => f.key === 'occupantId');
    expect(ROSTER.occupants.some(o => o.id === occupantFlag.value)).toBe(true);
  });

  it('emits nothing when the player is not standing in a burg', async () => {
    const changes = await handleTownRoutineEvents(stateAt(12, null), dispatchFn(), {
      hoursAdvanced: 8,
      resolveRoster: () => ROSTER,
    });
    expect(changes).toEqual([]);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('emits nothing when the advance stays inside one hour', async () => {
    // 12:15 -> 12:30: the clock moved but never crossed an hour boundary, so no
    // schedule block can have changed.
    const inHour = stateAt(12, 42);
    (inHour as { gameTime: Date }).gameTime = new Date(2024, 0, 1, 12, 30, 0);
    const changes = await handleTownRoutineEvents(inHour, dispatchFn(), {
      hoursAdvanced: 0.25,
      resolveRoster: () => ROSTER,
    });
    expect(changes).toEqual([]);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('townRoutineChanges is pure, deterministic and capped', () => {
    const a = townRoutineChanges(ROSTER, 4, 12);
    const b = townRoutineChanges(ROSTER, 4, 12);
    expect(a).toEqual(b);
    expect(townRoutineChanges(ROSTER, 4, 12, 1).length).toBe(1);
    expect(townRoutineChanges(ROSTER, 12, 12)).toEqual([]);
  });
});

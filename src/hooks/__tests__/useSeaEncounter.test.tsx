import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Dispatch } from 'react';
import { useSeaEncounter } from '../useSeaEncounter';
import type { PendingSeaEncounter } from '../../types/naval';
import type { AppAction } from '../../state/actionTypes';

// The hook lazy-imports handleEncounter; mock it so we can assert the fight
// starts. vi.hoisted lets the (hoisted) vi.mock factory reference the mock fn.
const { startBattleMock } = vi.hoisted(() => ({
  startBattleMock: vi.fn(async (_dispatch: unknown, _payload: unknown) => {}),
}));
vi.mock('../actions/handleEncounter', () => ({
  handleStartBattleMapEncounter: startBattleMock,
}));
// Warm the module cache so the hook's dynamic import() resolves synchronously in
// every test (removes a first-test-only import race).
import '../actions/handleEncounter';

/** Flush macro + micro tasks so a dynamic import() + async chain settles. */
const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const makePending = (): PendingSeaEncounter => ({
  id: 'pirates',
  summary: 'A pirate cutter runs up the black flag!',
  monsters: [{ name: 'Bandit', quantity: 3, cr: '1/8', description: 'A pirate.' }],
});

describe('useSeaEncounter', () => {
  let mockDispatch: ReturnType<typeof vi.fn>;
  let dispatch: Dispatch<AppAction>;

  beforeEach(() => {
    mockDispatch = vi.fn();
    dispatch = mockDispatch as unknown as Dispatch<AppAction>;
    vi.clearAllMocks();
  });

  it('does nothing when there is no pending encounter', () => {
    renderHook(() => useSeaEncounter({ pendingSeaEncounter: null, dispatch }));
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(startBattleMock).not.toHaveBeenCalled();
  });

  it('clears the marker and enters an exact no-roster source gap', async () => {
    const pending = makePending();
    renderHook(() => useSeaEncounter({ pendingSeaEncounter: pending, dispatch }));

    // Clears first so the fight-start re-render cannot double-fire.
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'NAVAL_CLEAR_SEA_ENCOUNTER' });

    // The dynamic import() of handleEncounter + async battle start resolve on a
    // macrotask; a real timeout flushes them.
    await flush();

    expect(startBattleMock).toHaveBeenCalledTimes(1);
    const [, payload] = startBattleMock.mock.calls[0];
    expect(payload).toEqual({
      monsters: [],
      sourceGap: {
        code: 'sea-encounter-no-worldforge-battlefield',
        encounterLabel: 'Daily sea encounter: pirates',
        locationLabel: 'Open-sea voyage without a tactical location artifact',
        missingSourceFacts: [
          'WorldForge sea surface',
          'vessel deck geometry',
          'relative vessel headings',
          'weather and boarding context',
        ],
        detail: expect.stringContaining(
          '3 proposed foes were not converted into combatants',
        ),
      },
    });
    expect(JSON.stringify(payload)).not.toContain('Bandit');
  });

  it('does not re-fire for the same encounter id on re-render', async () => {
    const pending = makePending();
    const { rerender } = renderHook(
      (props: { pendingSeaEncounter: PendingSeaEncounter | null }) =>
        useSeaEncounter({ pendingSeaEncounter: props.pendingSeaEncounter, dispatch }),
      { initialProps: { pendingSeaEncounter: pending } },
    );
    await flush();

    rerender({ pendingSeaEncounter: pending }); // same id → no new fight
    await flush();

    expect(startBattleMock).toHaveBeenCalledTimes(1);
  });
});

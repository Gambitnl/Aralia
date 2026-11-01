import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKnownPortsSync } from '../useKnownPortsSync';

// ---------------------------------------------------------------------------
// Mock legacySubmapBridge — we don't want to generate a real FMG world in a
// unit test (costs ~1 s and requires heavy browser APIs). The mock returns a
// tiny deterministic pack that knownPortsFromPack can run against.
// ---------------------------------------------------------------------------
vi.mock('../../systems/worldforge/bridge/legacySubmapBridge', () => ({
  // GG-575: the hook reads the atlas through useOffThreadBridgeAtlas, which
  // checks the bridge cache first. An empty cache and no Worker (jsdom) send it
  // to getBridgeAtlas at once, as before.
  peekBridgeAtlas: vi.fn(() => undefined),
  getBridgeAtlas: vi.fn((worldSeed: number) => ({
    pack: {
      burgs: [
        0,                                // hole sentinel — skip
        { i: 1, port: 1, cell: 10 },     // port
        { i: 2, port: 0, cell: 20 },     // not a port — skip
        { i: 3, port: 5, cell: 30 },     // port (truthy)
        // Different ports for seed 999
        ...(worldSeed === 999
          ? [{ i: 7, port: 1, cell: 70 }]
          : []),
      ],
    },
  })),
}));

import { getBridgeAtlas } from '../../systems/worldforge/bridge/legacySubmapBridge';

describe('useKnownPortsSync', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dispatch: any;

  beforeEach(() => {
    dispatch = vi.fn();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. With a valid seed + empty knownPorts → dispatches NAVAL_SET_KNOWN_PORTS
  //    once with the port ids knownPortsFromPack derives from the fake pack.
  // -------------------------------------------------------------------------
  it('dispatches NAVAL_SET_KNOWN_PORTS once when seed is set and knownPorts is empty', () => {
    renderHook(() => useKnownPortsSync(42, [], dispatch));

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'NAVAL_SET_KNOWN_PORTS',
      payload: { ports: ['1', '3'] }, // sorted ascending, as knownPortsFromPack returns
    });
    expect(getBridgeAtlas).toHaveBeenCalledWith(42);
  });

  // -------------------------------------------------------------------------
  // 2. With already-populated knownPorts → does NOT dispatch (idempotent).
  // -------------------------------------------------------------------------
  it('does NOT dispatch when knownPorts is already populated', () => {
    renderHook(() => useKnownPortsSync(42, ['1', '3'], dispatch));

    expect(dispatch).not.toHaveBeenCalled();
    expect(getBridgeAtlas).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 3. With null worldSeed → does NOT dispatch.
  // -------------------------------------------------------------------------
  it('does NOT dispatch when worldSeed is null', () => {
    renderHook(() => useKnownPortsSync(null, [], dispatch));

    expect(dispatch).not.toHaveBeenCalled();
    expect(getBridgeAtlas).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 4. With undefined worldSeed → does NOT dispatch.
  // -------------------------------------------------------------------------
  it('does NOT dispatch when worldSeed is undefined', () => {
    renderHook(() => useKnownPortsSync(undefined, [], dispatch));

    expect(dispatch).not.toHaveBeenCalled();
    expect(getBridgeAtlas).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 5. Changing the seed to a new value while knownPorts is empty → dispatches
  //    again for the new seed.
  // -------------------------------------------------------------------------
  it('re-dispatches when seed changes to a new value with empty knownPorts', () => {
    let seed = 42;
    let ports: string[] = [];

    const { rerender } = renderHook(() => useKnownPortsSync(seed, ports, dispatch));

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'NAVAL_SET_KNOWN_PORTS',
      payload: { ports: ['1', '3'] },
    });

    // Simulate moving to a new world — seed changes, knownPorts reset to [].
    // These are plain variable reassignments (not React state updates), so the
    // rerender below is what re-runs the effect with the new seed.
    seed = 999;
    ports = [];
    rerender();

    expect(dispatch).toHaveBeenCalledTimes(2);
    // Seed 999 adds burg 7 on top of burgs 1 & 3 (from the mock above).
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'NAVAL_SET_KNOWN_PORTS',
      payload: { ports: ['1', '3', '7'] },
    });
    expect(getBridgeAtlas).toHaveBeenCalledWith(999);
  });

  // -------------------------------------------------------------------------
  // 6. Multiple re-renders with the SAME seed + empty ports → only one dispatch.
  //    Verifies the effect doesn't re-fire on unrelated re-renders.
  // -------------------------------------------------------------------------
  it('does not re-dispatch on unrelated re-renders with the same seed', () => {
    const ports: string[] = [];
    const { rerender } = renderHook(() => useKnownPortsSync(42, ports, dispatch));

    // Trigger several re-renders (e.g. parent component re-renders)
    rerender();
    rerender();
    rerender();

    // Still only one dispatch — the effect is keyed on `worldSeed` and fires once.
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // 7. C9 (agora-9ed9.9) regression: START_GAME_SUCCESS and LOAD_GAME_SUCCESS
  //    reset naval.knownPorts to [] but keep the SAME seed. The old seed-only
  //    key never re-ran, so the list stayed empty for the whole session.
  // -------------------------------------------------------------------------
  it('re-dispatches when knownPorts is emptied again under the same seed', () => {
    let ports: string[] = [];
    const { rerender } = renderHook(() => useKnownPortsSync(42, ports, dispatch));
    expect(dispatch).toHaveBeenCalledTimes(1);

    // The reducer applies NAVAL_SET_KNOWN_PORTS: the list is now populated.
    ports = ['1', '3'];
    rerender();
    expect(dispatch).toHaveBeenCalledTimes(1);

    // START_GAME_SUCCESS spreads initialGameState: same seed, empty list.
    ports = [];
    rerender();
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'NAVAL_SET_KNOWN_PORTS',
      payload: { ports: ['1', '3'] },
    });
  });
});

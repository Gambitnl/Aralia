/**
 * Measured re-render reduction for useGameSelector (C6, agora-9ed9.6).
 *
 * All consumers are React.memo, so only context or store changes can
 * re-render them. A useGameState consumer re-renders on every state change; a
 * useGameSelector consumer re-renders only when its slice changes. Renders are
 * counted in each component body: React's Profiler onRender also fires when a
 * memoized child inside it bails out, so it counts commits, not renders.
 *
 * GG-439 adds two commit-boundary tests: an abandoned (suspended) render never
 * reaches the store, and a consumer that renders with the provider still ends
 * on the new state.
 *
 * Exercises: src/state/GameContext.tsx, src/state/useGameSelector.ts
 */
import React, { Suspense, memo, startTransition, use, useContext, useEffect, useReducer, useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GameProvider, GameStoreContext, useGameState, type GameStore } from '../GameContext';
import { shallowEqual, useGameSelector } from '../useGameSelector';
import type { GameState } from '../../types';
import type { AppAction } from '../actionTypes';

type Fake = { gold: number; turn: number; party: { leader: string; size: number } };
const asGame = (fake: Fake) => fake as unknown as GameState;
const asFake = (state: GameState) => state as unknown as Fake;

type TestAction = { type: 'GOLD' } | { type: 'TURN' } | { type: 'PARTY_SAME' } | { type: 'PARTY_SIZE' };
function reducer(state: GameState, action: TestAction): GameState {
  const s = asFake(state);
  switch (action.type) {
    case 'GOLD': return asGame({ ...s, gold: s.gold + 1 });
    case 'TURN': return asGame({ ...s, turn: s.turn + 1 });
    case 'PARTY_SAME': return asGame({ ...s, party: { ...s.party } });
    case 'PARTY_SIZE': return asGame({ ...s, party: { ...s.party, size: s.party.size + 1 } });
  }
}

const renders: Record<string, number> = {};
const count = (id: string) => { renders[id] = (renders[id] ?? 0) + 1; };

const WholeStateReader = memo(function WholeStateReader() {
  const { state } = useGameState();
  count('whole');
  return <span data-testid="whole">{asFake(state).gold}</span>;
});
const GoldSelector = memo(function GoldSelector() {
  const gold = useGameSelector((state) => asFake(state).gold);
  count('gold');
  return <span data-testid="gold">{gold}</span>;
});
const PartySelector = memo(function PartySelector() {
  const party = useGameSelector((state) => asFake(state).party, shallowEqual);
  count('party');
  return <span data-testid="party">{party.leader}:{party.size}</span>;
});

let send: (action: TestAction) => void = () => undefined;
function Harness() {
  const [state, dispatch] = useReducer(reducer, asGame({ gold: 0, turn: 0, party: { leader: 'Ada', size: 2 } }));
  // Hand the dispatcher to the test after commit, not during render.
  useEffect(() => { send = dispatch; }, [dispatch]);
  return (
    <GameProvider state={state} dispatch={dispatch as unknown as React.Dispatch<AppAction>}>
      <WholeStateReader />
      <GoldSelector />
      <PartySelector />
    </GameProvider>
  );
}

describe('useGameSelector', () => {
  it('re-renders only consumers whose slice changed (Profiler render counts)', () => {
    for (const key of Object.keys(renders)) delete renders[key];
    render(<Harness />);
    expect(renders).toEqual({ whole: 1, gold: 1, party: 1 });

    // An unrelated change: only the whole-state reader re-renders.
    act(() => send({ type: 'TURN' }));
    expect(renders).toEqual({ whole: 2, gold: 1, party: 1 });

    // A new but shallow-equal party object: shallowEqual keeps the selector quiet.
    act(() => send({ type: 'PARTY_SAME' }));
    expect(renders).toEqual({ whole: 3, gold: 1, party: 1 });

    // The selected slice changes: that selector re-renders with the new value.
    act(() => send({ type: 'GOLD' }));
    expect(renders).toEqual({ whole: 4, gold: 2, party: 1 });
    expect(screen.getByTestId('gold').textContent).toBe('1');

    act(() => send({ type: 'PARTY_SIZE' }));
    expect(renders).toEqual({ whole: 5, gold: 2, party: 2 });
    expect(screen.getByTestId('party').textContent).toBe('Ada:3');
  });

  it('throws a clear error outside a GameProvider', () => {
    const Lonely = () => { useGameSelector((state) => state); return null; };
    expect(() => render(<Lonely />)).toThrow('useGameSelector must be used within a GameProvider');
  });

  it('recomputes when an inline selector closes over a new value with the same state', () => {
    function Picker({ field }: { field: 'gold' | 'turn' }) {
      const value = useGameSelector((state) => asFake(state)[field]);
      return <span data-testid="picked">{value}</span>;
    }
    const state = asGame({ gold: 7, turn: 3, party: { leader: 'Ada', size: 2 } });
    const dispatch = (() => undefined) as React.Dispatch<AppAction>;
    const { rerender } = render(<GameProvider state={state} dispatch={dispatch}><Picker field="gold" /></GameProvider>);
    expect(screen.getByTestId('picked').textContent).toBe('7');
    rerender(<GameProvider state={state} dispatch={dispatch}><Picker field="turn" /></GameProvider>);
    expect(screen.getByTestId('picked').textContent).toBe('3');
  });

  // GG-439: the store must expose only committed state. A transition that
  // suspends is abandoned, and React keeps the old UI; a store that copied the
  // new state during render would hand that never-shown state to subscribers.
  it('never publishes state from an abandoned (suspended) render', async () => {
    const never = new Promise<never>(() => undefined);
    function SuspendOnTurn() {
      const { state } = useGameState();
      if (asFake(state).turn > 0) use(never);
      return null;
    }
    let store: GameStore | undefined;
    function StoreSpy() {
      const current = useContext(GameStoreContext);
      // Hand the store to the test after commit, not during render.
      useEffect(() => { store = current; }, [current]);
      return null;
    }
    let setGame: (state: GameState) => void = () => undefined;
    const dispatch = (() => undefined) as React.Dispatch<AppAction>;
    function Root() {
      const [state, set] = useState(asGame({ gold: 1, turn: 0, party: { leader: 'Ada', size: 2 } }));
      useEffect(() => { setGame = set; }, []);
      return (
        <GameProvider state={state} dispatch={dispatch}>
          <StoreSpy />
          <GoldSelector />
          <Suspense fallback={<span data-testid="fallback" />}><SuspendOnTurn /></Suspense>
        </GameProvider>
      );
    }
    render(<Root />);
    const committed = store!.getState();
    await act(async () => {
      startTransition(() => setGame(asGame({ gold: 2, turn: 1, party: { leader: 'Ada', size: 2 } })));
    });
    // The suspended transition did not commit: the old UI stays, no fallback.
    expect(screen.queryByTestId('fallback')).toBeNull();
    expect(screen.getByTestId('gold').textContent).toBe('1');
    expect(store!.getState()).toBe(committed);
  });

  it('a consumer that renders in the same pass as the provider shows the new state after commit', () => {
    function Picker() {
      const gold = useGameSelector((state) => asFake(state).gold);
      return <span data-testid="same-pass">{gold}</span>;
    }
    const dispatch = (() => undefined) as React.Dispatch<AppAction>;
    const { rerender } = render(<GameProvider state={asGame({ gold: 1, turn: 0, party: { leader: 'Ada', size: 2 } })} dispatch={dispatch}><Picker /></GameProvider>);
    rerender(<GameProvider state={asGame({ gold: 5, turn: 0, party: { leader: 'Ada', size: 2 } })} dispatch={dispatch}><Picker /></GameProvider>);
    expect(screen.getByTestId('same-pass').textContent).toBe('5');
  });
});

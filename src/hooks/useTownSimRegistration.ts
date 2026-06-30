/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useTownSimRegistration.ts
 * Registers the town the player is currently standing in into the living-world
 * sim (gameState.townSim), so it starts accruing a persisted chronicle.
 *
 * This covers ANY arrival — 2D world travel as well as 3D entry — by watching
 * `currentLocationId`. (Enter-3D also dispatches registration directly for the
 * case where it enters a town cell without changing currentLocationId.) The
 * TOWNSIM_REGISTER_BURG reducer is idempotent, so repeated fires are harmless.
 *
 * Mirrors the seed-keyed idempotent pattern of useKnownPortsSync / the other
 * townsim sync hooks. No fallback: when the location isn't a town tile,
 * burgIdForLocation returns undefined and this is a clean no-op.
 */
import { useEffect, useMemo } from 'react';
import type { Dispatch } from 'react';
import { GameState } from '../types';
import { AppAction } from '../state/actionTypes';
import { burgIdForLocation } from '../systems/worldforge/townsim/chronicleForLocation';

export function useTownSimRegistration(
  gameState: GameState,
  dispatch: Dispatch<AppAction>,
): void {
  const { worldSeed } = gameState;
  // Grid retirement: the canonical cell is the sole "which town am I in?" source.
  const cellId = gameState.playerCell?.cellId ?? null;
  const burgId = useMemo(() => {
    if (cellId == null) return undefined;
    return burgIdForLocation({ worldSeed, cellId });
  }, [worldSeed, cellId]);
  const alreadyTracked = burgId !== undefined && (gameState.townSim ?? {})[burgId] !== undefined;

  useEffect(() => {
    if (burgId === undefined || alreadyTracked) return;
    dispatch({ type: 'TOWNSIM_REGISTER_BURG', payload: { burgId } });
  }, [burgId, alreadyTracked, dispatch]);
}

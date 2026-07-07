/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useDungeonRumorsSync.ts
 * Pillar 2, Task 7: bridges WORLD-GROWN DUNGEON rumor hooks into the tavern-
 * gossip RUMOR system.
 *
 * While the player stands in a tracked town, every dungeon within earshot of that
 * town (a hook's own loudness-scaled `radiusFt`, computed by `rumorsForBurg`)
 * contributes its spoken-register rumor lines as WorldRumors — the SAME
 * `activeRumors` channel the existing TavernGossipSystem already surfaces for
 * purchase, and the same one town-chronicle news rides via `useChronicleRumorsSync`.
 * So a dungeon's history reaches the player exactly where town gossip already does.
 *
 * Idempotency: keyed on [burgId, currentLocationId]. Dungeon rumors are stable
 * per (world, burg) — they don't change day to day — so the effect only needs to
 * re-run when the player moves to a new town. The converter emits stable ids and
 * the ADD_RUMORS reducer dedups by id, so repeated fires never duplicate rumors.
 *
 * Cost: `rumorsForBurg` pre-filters sites by distance and only generates the
 * plans of dungeons within the loudest possible earshot, cached per (seed, site)
 * — it never generates the whole world's dungeons (see rumors.ts).
 *
 * No fallback (no-fallback directive): `burgIdForLocation` returns undefined when
 * the player isn't in a burg (a legitimate no-op); a real error surfaces honestly.
 *
 * Mirrors the town-resolved, id-keyed idempotent pattern in useChronicleRumorsSync.
 */
import { useEffect, useMemo } from 'react';
import type { Dispatch } from 'react';
import { GameState } from '../types';
import { AppAction } from '../state/actionTypes';
import { getGameDay } from '../utils/core';
import { burgIdForLocation } from '../systems/worldforge/townsim/chronicleForLocation';
import { rumorsForBurg } from '../systems/worldforge/dungeon/world/rumors';
import { dungeonRumorsToWorldRumors } from '../utils/world/dungeonRumorsToWorldRumors';

export function useDungeonRumorsSync(
  gameState: GameState,
  dispatch: Dispatch<AppAction>,
): void {
  const { currentLocationId, gameTime, worldSeed } = gameState;
  const currentDay = getGameDay(gameTime);

  // The burg at the player's canonical cell (undefined when not in a burg). Only
  // the burg id matters for dungeon earshot — resolved in render so the effect
  // re-runs the moment the player stands in (or moves between) burgs.
  const burgId = useMemo(
    () =>
      burgIdForLocation({
        worldSeed: worldSeed ?? 0,
        cellId: gameState.playerCell?.cellId ?? null,
      }),
    [worldSeed, gameState.playerCell?.cellId],
  );

  // Pillar 2, Task 8: cleared dungeons speak past-tense rumors. Key the sync on a
  // stable join of the cleared set so clearing a nearby dungeon re-syncs its line.
  const clearedDungeons = gameState.clearedDungeons;
  const clearedKey = useMemo(
    () => [...(clearedDungeons ?? [])].sort().join(','),
    [clearedDungeons],
  );

  useEffect(() => {
    if (burgId === undefined || worldSeed == null) return; // not in a burg

    const rumors = rumorsForBurg(worldSeed, burgId, clearedDungeons ?? undefined);
    if (rumors.length === 0) return;

    const worldRumors = dungeonRumorsToWorldRumors(rumors, currentDay, currentLocationId);
    if (worldRumors.length === 0) return;

    dispatch({ type: 'ADD_RUMORS', payload: { rumors: worldRumors } });
    // currentDay is intentionally excluded: dungeon rumors are stable per
    // (world, burg, clearedSet), so only a move (new burgId / location) or a
    // clear (clearedKey) should re-sync. The stable-id dedup keeps a re-fire
    // harmless regardless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burgId, currentLocationId, worldSeed, clearedKey]);
}

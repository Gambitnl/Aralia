// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 13:55:01
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback, useState } from 'react';
import { useGameState } from '../../../state/GameContext';
import type { GameState } from '../../../types';
import type {
  GroundDungeonEntrance,
  GroundWorld,
} from '../../../systems/worldforge/bridge/groundChunkLoader';
import type { ClickMoveIntent } from '../clickMoveAuthority';
import {
  createDungeonEntry,
  nearestEnterableDungeon,
  type ActiveDungeonEntry,
} from '../dungeonEntryRuntime';

/**
 * Hook for managing transitions between the 3D exterior world and interior dungeon instances.
 *
 * When the player approaches a dungeon entrance in the 3D ground view, this hook manages
 * detecting that doorway, offering the player the entry action, creating the validated dungeon
 * instance with exact return coordinates, and handling the return from the dungeon back to the
 * exact spot in the 3D world without regenerating terrain.
 *
 * Called by: World3DWrapper.tsx
 * Depends on: GameContext for dungeon state actions, dungeonEntryRuntime for generating valid entries
 */

// ============================================================================
// Types
// ============================================================================

export interface UseInteriorTransitionOptions {
  /** Reference to the currently loaded ground world data */
  groundRef: React.MutableRefObject<GroundWorld | null>;
  /** Active ground view configuration including tile coordinates */
  wfGroundView: {
    tile: { x: number; y: number };
  } | null;
  /** Reference to the latest player ground position in game state */
  playerGroundPosRef: React.MutableRefObject<GameState['playerGroundPos']>;
  /** Reference to the most recently tracked ground coordinates */
  lastGroundXZ: React.MutableRefObject<{ x: number; z: number }>;
  /** Reference to click-move navigation intent */
  clickMoveIntent: React.MutableRefObject<ClickMoveIntent>;
}

export interface UseInteriorTransitionResult {
  /** The nearest enterable dungeon entrance if within interaction range */
  nearbyDungeonEntrance: GroundDungeonEntrance | null;
  /** Active dungeon expedition overlay data if currently inside a dungeon */
  activeDungeonEntry: ActiveDungeonEntry | null;
  /** Error message to display if dungeon entry fails validation */
  dungeonEntryError: string | null;
  /**
   * Refreshes the nearest dungeon entrance based on player coordinates.
   *
   * @param xM - Position X in tile-local ground meters
   * @param zM - Position Z in tile-local ground meters
   */
  refreshNearbyDungeonEntrance: (xM: number, zM: number) => void;
  /** Triggers entry into the currently nearby dungeon entrance */
  handleEnterDungeon: () => void;
  /** Handles returning from the active dungeon back to the 3D world */
  handleReturnFromDungeon: () => void;
}

// ============================================================================
// Interior Transition Hook Implementation
// ============================================================================

export function useInteriorTransition({
  groundRef,
  wfGroundView,
  playerGroundPosRef,
  lastGroundXZ,
  clickMoveIntent,
}: UseInteriorTransitionOptions): UseInteriorTransitionResult {
  const { dispatch, state } = useGameState();

  // ========================================================================
  // Persistent Dungeon Entry State
  // ========================================================================
  // The 3D world remains mounted underneath the expedition overlay. Keeping its
  // loader, tile, and movement state alive makes return an exact restoration
  // rather than a second world-generation request.
  const [nearbyDungeonEntrance, setNearbyDungeonEntrance] =
    useState<GroundDungeonEntrance | null>(null);
  const [activeDungeonEntry, setActiveDungeonEntry] = useState<ActiveDungeonEntry | null>(null);
  const [dungeonEntryError, setDungeonEntryError] = useState<string | null>(null);

  /**
   * Refresh the doorway interaction prompt from one accepted player position.
   *
   * Camera walking, 2D Locale movement, and 3D ground clicking all report the same
   * tile-local meter coordinates through this boundary.
   */
  const refreshNearbyDungeonEntrance = useCallback((xM: number, zM: number) => {
    const enterableDungeon = nearestEnterableDungeon(
      groundRef.current?.dungeonEntrances ?? [],
      xM,
      zM,
    );

    // Reuse existing entrance object while the player remains near the same doorway
    // to prevent redundant re-renders during high-frequency camera movement.
    setNearbyDungeonEntrance((current) => {
      if (current?.id === enterableDungeon?.id) return current;
      return enterableDungeon;
    });
  }, [groundRef]);

  /**
   * Enter the nearby canonical dungeon and freeze an exact return point.
   *
   * Generation validates the entrance receipt against the active world. Any stale
   * or unavailable attachment surfaces as an honest prompt error.
   */
  const handleEnterDungeon = useCallback(() => {
    const entrance = nearbyDungeonEntrance;
    const tile = wfGroundView?.tile;
    if (!entrance || !tile) return;

    // Read the authoritative avatar position when it belongs to this tile.
    // During the small interval before throttled dispatch, the live ground tracker is freshest.
    const savedPosition = playerGroundPosRef.current;
    const origin =
      savedPosition && savedPosition.tileX === tile.x && savedPosition.tileY === tile.y
        ? { xM: savedPosition.xM, zM: savedPosition.zM }
        : { xM: lastGroundXZ.current.x, zM: lastGroundXZ.current.z };

    try {
      const entry = createDungeonEntry(entrance, {
        worldSeed: state.worldSeed ?? 42,
        cellId: state.playerCell?.cellId ?? entrance.cellId,
        tileX: tile.x,
        tileY: tile.y,
        xM: origin.xM,
        zM: origin.zM,
      });

      // Persist entry to GameState only after generation succeeds
      dispatch({ type: 'DUNGEON_ENTERED', payload: { identity: entry.identity } });
      setDungeonEntryError(null);
      setActiveDungeonEntry(entry);
    } catch (error) {
      setDungeonEntryError(
        `This dungeon entrance is unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, [
    dispatch,
    lastGroundXZ,
    nearbyDungeonEntrance,
    playerGroundPosRef,
    state.playerCell?.cellId,
    state.worldSeed,
    wfGroundView?.tile,
  ]);

  /**
   * Return to the exact tile-local position recorded before the dungeon overlay opened.
   */
  const handleReturnFromDungeon = useCallback(() => {
    if (!activeDungeonEntry) return;
    const origin = activeDungeonEntry.returnContext;

    // Reassert the saved movement state before closing the overlay
    clickMoveIntent.current = null;
    lastGroundXZ.current = { x: origin.xM, z: origin.zM };

    dispatch({
      type: 'SET_PLAYER_GROUND_POS',
      payload: {
        position: {
          tileX: origin.tileX,
          tileY: origin.tileY,
          xM: origin.xM,
          zM: origin.zM,
        },
      },
    });

    // Record retreat in game state and close the overlay
    dispatch({
      type: 'DUNGEON_RETREATED',
      payload: { dungeonId: activeDungeonEntry.identity.dungeonId },
    });
    setActiveDungeonEntry(null);
  }, [activeDungeonEntry, clickMoveIntent, dispatch, lastGroundXZ]);

  return {
    nearbyDungeonEntrance,
    activeDungeonEntry,
    dungeonEntryError,
    refreshNearbyDungeonEntrance,
    handleEnterDungeon,
    handleReturnFromDungeon,
  };
}

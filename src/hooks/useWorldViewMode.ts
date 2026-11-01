/**
 * @file src/hooks/useWorldViewMode.ts
 * Clean API for reading and updating the 3D world view mode from game state.
 * Part of the world-3d-ui surface (Plan 4, Slice 1).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 01:16:06
 * Dependents: components/World3D/ViewModeToggle.tsx, components/World3D/World3DWrapper.tsx, components/Worldforge/MapSurfaceToggle.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback } from 'react';
import { useGameState } from '../state/GameContext';
import { WorldViewMode, MapSurface, PlayerWorldPosition } from '../types';

/**
 * Hook for managing the 3D world view mode.
 * Returns the current mode and a setter that dispatches SET_WORLD_VIEW_MODE.
 */
export function useWorldViewMode() {
  const { state, dispatch } = useGameState();

  const mode = state.worldViewMode;

  const setMode = (newMode: WorldViewMode) => {
    dispatch({ type: 'SET_WORLD_VIEW_MODE', payload: newMode });
  };

  return { mode, setMode };
}

/**
 * Hook for reading and switching the 2D cartographic surface:
 * 'classic' (legacy GameLayout) ↔ 'worldforge' (native cartographer).
 * Falls back to 'classic' for legacy states without the field.
 */
export function useMapSurface() {
  const { state, dispatch } = useGameState();

  const surface: MapSurface = state.mapSurface ?? 'classic';

  const setSurface = (next: MapSurface) => {
    dispatch({ type: 'SET_MAP_SURFACE', payload: next });
  };

  const toggleSurface = () => {
    setSurface(surface === 'classic' ? 'worldforge' : 'classic');
  };

  return { surface, setSurface, toggleSurface };
}

/**
 * Hook for reading and updating the player's 3D world position.
 * Returns the current position and a setter that dispatches SET_PLAYER_WORLD_POS.
 */
export function usePlayerWorldPos() {
  const { state, dispatch } = useGameState();

  const position = state.playerWorldPos;

  // World entry holds this callback for the lifetime of its worker. Keep it
  // stable across clock ticks and walking updates so those do not rebuild towns.
  const setPosition = useCallback((newPos: PlayerWorldPosition) => {
    dispatch({ type: 'SET_PLAYER_WORLD_POS', payload: newPos });
  }, [dispatch]);

  const clearPosition = () => {
    dispatch({ type: 'CLEAR_PLAYER_WORLD_POS' });
  };

  return { position, setPosition, clearPosition };
}

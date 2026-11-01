/** Restores controls after an abandoned loading request. App keeps message and state ownership; the original timeout and cleanup remain unchanged. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 01:23:21
 * Dependents: App.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useEffect, type Dispatch } from "react";
import type { GameState } from "../../types/state";
import type { AppAction } from "../../state/actionTypes";

const LOADING_WATCHDOG_MS = 60_000;

export function useAppLoadingWatchdog(
  gameState: GameState,
  dispatch: Dispatch<AppAction>,
  addMessage: (text: string, sender?: "system" | "player" | "npc") => void,
) {
  // Loading-state fail-safe: `isUIInteractive` gates the action menus on
  // `!isLoading`, so if an async op (e.g. an AI/Ollama call) never resolves —
  // backend offline, hung request, missing catch — the UI would stay disabled
  // forever ("stuck menus"). This watchdog force-clears a loading state that
  // outlives the ceiling, so a dead backend can never permanently lock controls.
  useEffect(() => {
    if (!gameState.isLoading) return;
    const timer = setTimeout(() => {
      dispatch({ type: "SET_LOADING", payload: { isLoading: false } });
      addMessage(
        "The world took too long to respond — controls re-enabled. (Is the AI backend running?)",
        "system",
      );
    }, LOADING_WATCHDOG_MS);
    return () => clearTimeout(timer);
  }, [gameState.isLoading, dispatch, addMessage]);

}

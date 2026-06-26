// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/05/2026, 23:32:33
 * Dependents: App.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback, useEffect, useRef } from 'react';
import { GamePhase, GameState } from '../types';
import { AppAction } from '../state/actionTypes';
import { getPhaseSlug, getPhaseFromSlug } from '../routes';

export const useHistorySync = (gameState: GameState, dispatch: React.Dispatch<AppAction>) => {
  const isInitialMount = useRef(true);

  // Guard Logic Helper
  const safeNavigate = useCallback((targetPhase: GamePhase, silent: boolean = false) => {
    const protectedPhases = [GamePhase.PLAYING, GamePhase.COMBAT, GamePhase.VILLAGE_VIEW, GamePhase.BATTLE_MAP_DEMO];
    if (protectedPhases.includes(targetPhase) && gameState.party.length === 0) {
      if (!silent) {
        console.warn(`[Ranger] Blocked nav to ${GamePhase[targetPhase]} - no party.`);

        // Notify user why navigation was blocked
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            message: "You cannot travel there without an active party.",
            type: 'warning',
            duration: 4000
          }
        });
      }

      const params = new URLSearchParams(window.location.search);
      params.set('phase', getPhaseSlug(gameState.phase));
      window.history.replaceState({ phase: gameState.phase }, '', `${window.location.pathname}?${params.toString()}`);
      return;
    }
    if (targetPhase !== gameState.phase) dispatch({ type: 'SET_GAME_PHASE', payload: targetPhase });
  }, [dispatch, gameState.party.length, gameState.phase]);

  // Helper to sync state params.
  // Only the phase is a meaningful deep link. Player position (submap coords +
  // location id) is session/save state, not something to expose in the URL —
  // and the legacy x/y grid no longer reflects the WF-atlas spawn — so we never
  // write x/y/loc and strip any stale ones left over from old links.
  const syncParams = useCallback((params: URLSearchParams, phase: GamePhase) => {
    params.set('phase', getPhaseSlug(phase));
    ['x', 'y', 'loc'].forEach((k) => params.delete(k));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPhase = getPhaseFromSlug(params.get('phase'));

    // Initial Load: URL takes precedence (if valid)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const rawPhase = params.get('phase');

      if (urlPhase !== null) {
        // Use silent mode on mount to avoid confusing "no party" warnings if deep-linking
        // while the app is still initializing its state.
        safeNavigate(urlPhase, true);
      } else if (rawPhase && urlPhase === null) {
        // Ranger: Handle 404 (valid parameter but invalid phase)
        safeNavigate(GamePhase.NOT_FOUND);
      } else {
        // No URL param? Sync state to URL without pushing history
        syncParams(params, gameState.phase);
        window.history.replaceState({ phase: gameState.phase }, '', `${window.location.pathname}?${params.toString()}`);
      }
      return;
    }

    // State -> URL Sync (User Action)
    // TODO(lint-intent): 'stateSlug' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    const _stateSlug = getPhaseSlug(gameState.phase);
    const shouldUpdatePhase = getPhaseFromSlug(params.get('phase')) !== gameState.phase;

    syncParams(params, gameState.phase);

    // Use pushState for phase changes, replaceState for updates (like movement)
    const method = shouldUpdatePhase ? 'pushState' : 'replaceState';

    // Only update if URL actually changed to avoid thrashing
    const currentSearch = new URLSearchParams(window.location.search).toString();
    if (currentSearch !== params.toString()) {
      window.history[method]({ phase: gameState.phase }, '', `${window.location.pathname}?${params.toString()}`);
    }
    // TODO(lint-intent): If history sync needs to ignore some transitions, add an explicit guard for those phases.
  }, [
    dispatch,
    gameState.phase,
    gameState.party.length,
    safeNavigate,
    syncParams
  ]);

  // PopState (Back/Forward) Listener
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const params = new URLSearchParams(window.location.search);
      const target = e.state?.phase ?? getPhaseFromSlug(params.get('phase'));

      if (target !== null) {
        safeNavigate(target);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // TODO(lint-intent): If popstate should ignore deep links in some phases, add a guard for those phases.
  }, [dispatch, gameState.party.length, safeNavigate]);
};

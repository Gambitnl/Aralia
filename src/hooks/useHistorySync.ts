import { useCallback, useEffect, useRef } from 'react';
import { GamePhase, GameState } from '../types';
import { AppAction } from '../state/actionTypes';
import { LOCATIONS } from '../constants';
import { determineActiveDynamicNpcsForLocation } from '@/utils/spatial';

// Helper to convert GamePhase enum <-> URL slug
const getPhaseSlug = (phase: GamePhase): string => GamePhase[phase]?.toLowerCase() || '';
const getPhaseFromSlug = (slug: string | null): GamePhase | null => {
  if (!slug) return null;
  if (slug.toLowerCase() === 'design_preview') {
    console.warn("[Decoupling] 'design_preview' is now a standalone tool. Access it at /Aralia/misc/design.html");
    return null;
  }
  const key = slug.toUpperCase() as keyof typeof GamePhase;
  return key in GamePhase ? GamePhase[key] : (parseInt(slug, 10) in GamePhase ? parseInt(slug, 10) : null);
};

export const useHistorySync = (gameState: GameState, dispatch: React.Dispatch<AppAction>) => {
  const isInitialMount = useRef(true);

  // Guard Logic Helper
  const safeNavigate = useCallback((targetPhase: GamePhase) => {
    const protectedPhases = [GamePhase.PLAYING, GamePhase.COMBAT, GamePhase.VILLAGE_VIEW, GamePhase.BATTLE_MAP_DEMO];
    if (protectedPhases.includes(targetPhase) && gameState.party.length === 0) {
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

      const params = new URLSearchParams(window.location.search);
      params.set('phase', getPhaseSlug(gameState.phase));
      window.history.replaceState({ phase: gameState.phase }, '', `${window.location.pathname}?${params.toString()}`);
      return;
    }
    if (targetPhase !== gameState.phase) dispatch({ type: 'SET_GAME_PHASE', payload: targetPhase });
  }, [dispatch, gameState.party.length, gameState.phase]);

  // Helper to sync state params
  const syncParams = useCallback((params: URLSearchParams, phase: GamePhase) => {
    params.set('phase', getPhaseSlug(phase));
    if (phase === GamePhase.PLAYING || phase === GamePhase.VILLAGE_VIEW) {
      if (gameState.subMapCoordinates) {
        params.set('x', gameState.subMapCoordinates.x.toString());
        params.set('y', gameState.subMapCoordinates.y.toString());
      }
      if (gameState.currentLocationId) params.set('loc', gameState.currentLocationId);
    } else {
      ['x', 'y', 'loc'].forEach(k => params.delete(k));
    }
  }, [gameState.subMapCoordinates, gameState.currentLocationId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPhase = getPhaseFromSlug(params.get('phase'));

    // Initial Load: URL takes precedence (if valid)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const rawPhase = params.get('phase');

      if (urlPhase !== null) {
        safeNavigate(urlPhase); // Deep link
        // Ranger: Restore location context if available and safe
        const [x, y, loc] = [params.get('x'), params.get('y'), params.get('loc')];
        if (x && y && loc && urlPhase === GamePhase.PLAYING && gameState.party.length > 0) {
          dispatch({
            type: 'MOVE_PLAYER', payload: {
              newLocationId: loc,
              newSubMapCoordinates: { x: parseInt(x), y: parseInt(y) },
              activeDynamicNpcIds: determineActiveDynamicNpcsForLocation(loc, LOCATIONS)
            }
          });
        }
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
    gameState.currentLocationId,
    gameState.subMapCoordinates,
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

        // Restore coordinates on Back/Forward
        const [x, y, loc] = [params.get('x'), params.get('y'), params.get('loc')];
        if (x && y && loc && target === GamePhase.PLAYING) {
          dispatch({
            type: 'MOVE_PLAYER', payload: {
              newLocationId: loc,
              newSubMapCoordinates: { x: parseInt(x), y: parseInt(y) },
              activeDynamicNpcIds: determineActiveDynamicNpcsForLocation(loc, LOCATIONS)
            }
          });
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // TODO(lint-intent): If popstate should ignore deep links in some phases, add a guard for those phases.
  }, [dispatch, gameState.party.length, safeNavigate]);
};

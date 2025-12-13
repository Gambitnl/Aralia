import { useEffect, useRef } from 'react';
import { GamePhase, GameState } from '../types';
import { AppAction } from '../state/actionTypes';

// Helper to convert GamePhase enum <-> URL slug
const getPhaseSlug = (phase: GamePhase): string => GamePhase[phase]?.toLowerCase() || '';
const getPhaseFromSlug = (slug: string | null): GamePhase | null => {
  if (!slug) return null;
  const key = slug.toUpperCase() as keyof typeof GamePhase;
  return key in GamePhase ? GamePhase[key] : (parseInt(slug, 10) in GamePhase ? parseInt(slug, 10) : null);
};

export const useHistorySync = (gameState: GameState, dispatch: React.Dispatch<AppAction>) => {
  const isInitialMount = useRef(true);

  // Guard Logic Helper
  const safeNavigate = (targetPhase: GamePhase) => {
    const protectedPhases = [GamePhase.PLAYING, GamePhase.COMBAT, GamePhase.VILLAGE_VIEW, GamePhase.BATTLE_MAP_DEMO];
    if (protectedPhases.includes(targetPhase) && gameState.party.length === 0) {
      console.warn(`[Ranger] Blocked nav to ${GamePhase[targetPhase]} - no party.`);
      // Revert URL to current safe state
      const params = new URLSearchParams(window.location.search);
      params.set('phase', getPhaseSlug(gameState.phase));
      window.history.replaceState({ phase: gameState.phase }, '', `${window.location.pathname}?${params.toString()}`);
      return;
    }
    if (targetPhase !== gameState.phase) dispatch({ type: 'SET_GAME_PHASE', payload: targetPhase });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPhase = getPhaseFromSlug(params.get('phase'));

    // Initial Load: URL takes precedence (if valid)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const rawPhase = params.get('phase');

      if (urlPhase !== null) {
        safeNavigate(urlPhase); // Deep link
      } else if (rawPhase && urlPhase === null) {
        // Ranger: Handle 404 (valid parameter but invalid phase)
        safeNavigate(GamePhase.NOT_FOUND);
      } else {
        // No URL param? Sync state to URL without pushing history
        params.set('phase', getPhaseSlug(gameState.phase));
        window.history.replaceState({ phase: gameState.phase }, '', `${window.location.pathname}?${params.toString()}`);
      }
      return;
    }

    // State -> URL Sync (User Action)
    const stateSlug = getPhaseSlug(gameState.phase);
    if (getPhaseFromSlug(params.get('phase')) !== gameState.phase) {
      params.set('phase', stateSlug);
      window.history.pushState({ phase: gameState.phase }, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, [gameState.phase]); // Only re-run when state phase changes

  // PopState (Back/Forward) Listener
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const target = e.state?.phase ?? getPhaseFromSlug(new URLSearchParams(window.location.search).get('phase'));
      if (target !== null) safeNavigate(target);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [dispatch, gameState.party.length, gameState.phase]);
};

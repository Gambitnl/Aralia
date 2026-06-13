import { useEffect, useMemo, useRef } from 'react';
import type { GameState } from '../types';
import { GamePhase } from '../types';
import * as SaveLoadService from '../services/saveLoadService';

const AUTO_SAVE_DEBOUNCE_MS = 1500;
const AUTO_SAVE_THROTTLE_MS = 10_000;

// Combat runtime is hook-local and never serialized, so autosaving mid-combat
// would silently resume the player on the exploration surface. Exploration
// phases are eligible for the rolling autosave; combat is handled by a one-shot
// pre-combat checkpoint (see useAutoSave) instead.
const isGameplayPhase = (phase: GamePhase) =>
  phase === GamePhase.PLAYING ||
  phase === GamePhase.VILLAGE_VIEW;

const isCombatPhase = (phase: GamePhase) =>
  phase === GamePhase.COMBAT ||
  phase === GamePhase.BATTLE_MAP_DEMO;

/**
 * Auto-saves the running game to the autosave slot (localStorage).
 *
 * Design intent:
 * - This is for "refresh safety" and crash resilience.
 * - It should not spam notifications.
 * - It should be throttled/debounced to avoid excessive localStorage writes.
 */
export function useAutoSave(gameState: GameState, enabledOverride?: boolean) {
  const enabled = enabledOverride ?? (gameState.autoSaveEnabled ?? true);
  const eligible = useMemo(() => {
    if (!enabled) return false;
    if (!isGameplayPhase(gameState.phase)) return false;
    if (gameState.isLoading) return false;
    if (!gameState.party || gameState.party.length === 0) return false;
    return true;
  }, [enabled, gameState.isLoading, gameState.party, gameState.phase]);

  const latestStateRef = useRef(gameState);
  latestStateRef.current = gameState;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveAtRef = useRef<number>(0);
  const isSavingRef = useRef(false);
  const prevPhaseRef = useRef<GamePhase>(gameState.phase);

  const saveNow = async () => {
    if (isSavingRef.current) return;
    const state = latestStateRef.current;
    const isEnabled = state.autoSaveEnabled ?? true;
    if (!isEnabled || !isGameplayPhase(state.phase) || state.isLoading) return;
    if (!state.party || state.party.length === 0) return;

    isSavingRef.current = true;
    try {
      const result = await SaveLoadService.saveGame(
        state,
        SaveLoadService.AUTO_SAVE_SLOT_KEY,
        undefined,
        { displayName: 'Auto-Save', isAutoSave: true },
      );
      if (result.success) {
        lastSaveAtRef.current = Date.now();
      }
    } finally {
      isSavingRef.current = false;
    }
  };

  // One-shot pre-combat checkpoint: when the player crosses from an exploration
  // phase into combat, snapshot the (still-exploration) GameState to the autosave
  // slot. Combat itself never autosaves, so this checkpoint becomes the resume
  // point if the player refreshes or closes mid-fight. The loader heals the
  // checkpoint's phase back to PLAYING.
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = gameState.phase;

    if (!enabled) return;
    if (isCombatPhase(gameState.phase) && isGameplayPhase(prevPhase)) {
      const state = latestStateRef.current;
      if (!state.party || state.party.length === 0) return;
      if (isSavingRef.current) return;
      isSavingRef.current = true;
      void (async () => {
        try {
          const result = await SaveLoadService.saveGame(
            state,
            SaveLoadService.AUTO_SAVE_SLOT_KEY,
            undefined,
            { displayName: 'Pre-Combat Checkpoint', isAutoSave: true },
          );
          if (result.success) lastSaveAtRef.current = Date.now();
        } finally {
          isSavingRef.current = false;
        }
      })();
    }
  }, [enabled, gameState.phase]);

  useEffect(() => {
    if (!eligible) return undefined;

    // Debounce + throttle: frequent actions reschedule, but we still guarantee
    // a save at least every AUTO_SAVE_THROTTLE_MS while the player is active.
    if (timerRef.current) clearTimeout(timerRef.current);
    const now = Date.now();
    const sinceLast = now - lastSaveAtRef.current;
    const throttleDelay = sinceLast >= AUTO_SAVE_THROTTLE_MS ? 0 : (AUTO_SAVE_THROTTLE_MS - sinceLast);
    const delay = Math.max(AUTO_SAVE_DEBOUNCE_MS, throttleDelay);

    timerRef.current = setTimeout(() => {
      void saveNow();
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [eligible, gameState]);

  useEffect(() => {
    if (!eligible) return undefined;

    const handleVisibility = () => {
      // Flush an autosave when the tab is backgrounded.
      if (document.visibilityState === 'hidden') {
        void saveNow();
      }
    };

    const handleBeforeUnload = () => {
      // Write a synchronous emergency save to localStorage as a safety net.
      // IndexedDB is async and may not complete before the browser kills
      // the page. The emergency save is recovered into IDB on next startup
      // via recoverEmergencySave() in saveLoadService.
      SaveLoadService.emergencySaveSync(latestStateRef.current);
      // Also attempt the normal async save — it may complete in time.
      void saveNow();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [eligible]);
}

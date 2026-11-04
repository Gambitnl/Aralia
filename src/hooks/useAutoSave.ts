// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 03/11/2026, 12:44:43
 * Dependents: hooks/app/useAppPreferences.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useEffect, useMemo, useRef } from 'react';
import type { GameState } from '../types';
import { GamePhase } from '../types';
import * as SaveLoadService from '../services/saveLoadService';

/**
 * This hook protects an active adventure from refreshes, crashes, and accidental
 * closure. It writes a regularly refreshed auto-save, preserves the last safe
 * exploration state before combat, and now creates slower checkpoint tiers that
 * let a player recover from mistakes discovered after the rapid auto-save changed.
 *
 * App.tsx supplies the live GameState. The save service owns serialization,
 * storage selection, slot metadata, and migration behavior.
 *
 * agora-f821.63: this hook deliberately does NOT dispatch the dice counter that
 * `saveGame` returns back into state, unlike the manual save paths. Every
 * autosave therefore writes the same counter for the whole session, so an
 * autosave slot reloaded twice replays the same dice — which is exactly the
 * property the save-scum setting is protecting. The rolling timer reads the
 * latest state ref, so the one-second clock updates do not reset its cadence.
 */

const AUTO_SAVE_THROTTLE_MS = 10_000;

// Combat runtime is hook-local and never serialized, so autosaving mid-combat
// would silently resume the player on the exploration surface. Exploration
// phases are eligible for the rolling autosave; combat is handled by a one-shot
// pre-combat checkpoint (see useAutoSave) instead.
const isGameplayPhase = (phase: GamePhase) =>
  phase === GamePhase.PLAYING;

const isCombatPhase = (phase: GamePhase) =>
  phase === GamePhase.COMBAT ||
  phase === GamePhase.BATTLE_MAP_DEMO;

/**
 * Auto-saves the running game to the autosave slot (IndexedDB when available).
 *
 * Design intent:
 * - This is for "refresh safety" and crash resilience.
 * - It should not spam notifications.
 * - It writes immediately, then on a stable ten-second cadence while eligible.
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

  const timerRef = useRef<number | null>(null);
  const initialSaveTimerRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const activeSaveRef = useRef<Promise<unknown> | null>(null);
  const checkpointSavingRef = useRef<Set<string>>(new Set());
  const prevPhaseRef = useRef<GamePhase>(gameState.phase);

  const saveNow = async () => {
    if (isSavingRef.current) return;
    const state = latestStateRef.current;
    const isEnabled = state.autoSaveEnabled ?? true;
    if (!isEnabled || !isGameplayPhase(state.phase) || state.isLoading) return;
    if (!state.party || state.party.length === 0) return;

    isSavingRef.current = true;
    const pendingSave = SaveLoadService.saveGame(
      state,
      SaveLoadService.AUTO_SAVE_SLOT_KEY,
      undefined,
      { displayName: 'Auto-Save', isAutoSave: true },
    );
    activeSaveRef.current = pendingSave;
    try {
      await pendingSave;
    } finally {
      isSavingRef.current = false;
      if (activeSaveRef.current === pendingSave) activeSaveRef.current = null;
    }
  };

  // One-shot pre-combat checkpoint: when the player crosses from an exploration
  // phase into combat, snapshot the transition GameState to the autosave
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
      void (async () => {
        // A periodic rolling write may already be serializing the prior state.
        // Let it finish, then write this transition snapshot so combat entry
        // cannot silently lose its dedicated recovery point.
        const inFlight = activeSaveRef.current;
        if (inFlight) {
          try {
            await inFlight;
          } catch {
            // The transition checkpoint is still useful if the rolling write failed.
          }
        }
        if (isSavingRef.current) return;
        isSavingRef.current = true;
        const checkpointSave = SaveLoadService.saveGame(
          state,
          SaveLoadService.AUTO_SAVE_SLOT_KEY,
          undefined,
          { displayName: 'Pre-Combat Checkpoint', isAutoSave: true },
        );
        activeSaveRef.current = checkpointSave;
        try {
          await checkpointSave;
        } finally {
          isSavingRef.current = false;
          if (activeSaveRef.current === checkpointSave) activeSaveRef.current = null;
        }
      })();
    }
  }, [enabled, gameState.phase]);

  useEffect(() => {
    if (!eligible) return undefined;

    // Keep one rolling cadence for the whole eligible session. The game clock
    // replaces GameState every second, so tying timer setup to that object did
    // needless timer churn even though the save itself is throttled. Reads from
    // latestStateRef keep each checkpoint current without restarting the clock.
    // Preserve the old zero-delay first save so an eligibility change before
    // the next task turn can cancel it (for example, leaving play immediately).
    initialSaveTimerRef.current = window.setTimeout(() => {
      void saveNow();
    }, 0);
    timerRef.current = window.setInterval(() => {
      void saveNow();
    }, AUTO_SAVE_THROTTLE_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (initialSaveTimerRef.current) clearTimeout(initialSaveTimerRef.current);
      timerRef.current = null;
      initialSaveTimerRef.current = null;
    };
  }, [eligible]);

  // ========================================================================
  // Recovery Checkpoint Tiers
  // ========================================================================
  // The rapid auto-save protects the latest moment, but it cannot recover an
  // earlier healthy state after several bad actions. Each tier periodically
  // snapshots the same current adventure into its own durable slot. Timers run
  // only while normal exploration is eligible, so menus, loading, and combat do
  // not create misleading recovery points.
  // ========================================================================
  useEffect(() => {
    if (!eligible) return undefined;

    const timers = SaveLoadService.CHECKPOINT_TIERS.map((tier) =>
      window.setInterval(() => {
        const state = latestStateRef.current;
        if (!isGameplayPhase(state.phase) || state.isLoading || !state.party?.length) return;

        // A slow storage write must not let the same tier overlap itself. Other
        // tiers remain independent because several recovery horizons can become
        // due at the same moment.
        if (checkpointSavingRef.current.has(tier.id)) return;
        checkpointSavingRef.current.add(tier.id);

        void SaveLoadService.saveGame(
          state,
          tier.slotKey,
          undefined,
          { displayName: tier.displayLabel },
        ).finally(() => {
          checkpointSavingRef.current.delete(tier.id);
        });
      }, tier.intervalSeconds * 1000),
    );

    return () => {
      timers.forEach((timer) => window.clearInterval(timer));
      checkpointSavingRef.current.clear();
    };
  }, [eligible]);

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

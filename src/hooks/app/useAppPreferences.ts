/**
 * Keeps saved startup preferences and deferred catalogs beside the existing
 * autosave hook. App still owns game state; these effects register at the same
 * point and in the same order as the former App block. Catalog loading stays
 * off the main-menu path and hydration still gates preference writes/autosave.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 01:23:21
 * Dependents: App.tsx
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useEffect, useState, type Dispatch } from "react";
import { GamePhase, type Item } from "../../types";
import type { GameState } from "../../types/state";
import type { AppAction } from "../../state/actionTypes";
import * as SaveLoadService from "../../services/saveLoadService";
import { SafeStorage } from "../../utils/core/storageUtils";
import { isCombatDifficulty } from "../../config/combatConfig";
import { getRulesEdition } from "../../config/rulesEdition";
import { getAllowSaveScum } from "../../config/saveScum";
import { loadMonstersData } from "../../data/monsters";
import { useAutoSave } from "../useAutoSave";

const AUTO_SAVE_PREF_KEY = "aralia_rpg_pref_auto_save_enabled";
const COMBAT_DIFFICULTY_PREF_KEY = "aralia_rpg_pref_combat_difficulty";

export function useAppPreferences(gameState: GameState, dispatch: Dispatch<AppAction>) {
  // ── Storage initialization (GAP-001) ──────────────────────────────────
  // Initializes IndexedDB, recovers emergency saves, and migrates legacy
  // localStorage payloads to IDB. Runs once on mount, before any save/load
  // UI checks can read stale data. Safe to call multiple times (idempotent).
  useEffect(() => {
    SaveLoadService.initializeStorage();
  }, []);

  const autoSaveEnabled = gameState.autoSaveEnabled ?? true;
  const [isAutoSavePrefHydrated, setIsAutoSavePrefHydrated] = useState(false);
  const [itemsById, setItemsById] = useState<Record<string, Item> | null>(null);

  useEffect(() => {
    if (gameState.phase === GamePhase.MAIN_MENU || itemsById) return;
    let cancelled = false;

    // The item registry includes generated glossary-backed items, so keep it
    // out of the main-menu startup path and load it only for playable screens
    // that can actually show location item interactions.
    import("../../data/items").then(({ ITEMS: loadedItems }) => {
      if (!cancelled) {
        setItemsById(loadedItems);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [gameState.phase, itemsById]);

  // Load monster data in the background once the player leaves the Main Menu.
  // This keeps the massive generated bestiary chunk completely out of the Main Menu bundle.
  useEffect(() => {
    if (gameState.phase === GamePhase.MAIN_MENU) return;
    loadMonstersData().catch((err) => {
      console.error(
        "Failed to pre-load dynamic monster data in background:",
        err,
      );
    });
  }, [gameState.phase]);

  // Load persisted preference once (default is ON if absent).
  useEffect(() => {
    const stored = SafeStorage.getItem(AUTO_SAVE_PREF_KEY);
    if (stored) {
      const normalized = stored.trim().toLowerCase();
      const enabled =
        normalized === "1" || normalized === "true" || normalized === "on";
      dispatch({ type: "SET_AUTO_SAVE_ENABLED", payload: enabled });
    }
    // Combat difficulty (agora-a46a.1): same persistence pattern as auto-save.
    const storedDifficulty = SafeStorage.getItem(COMBAT_DIFFICULTY_PREF_KEY);
    if (isCombatDifficulty(storedDifficulty)) {
      dispatch({ type: "SET_COMBAT_DIFFICULTY", payload: storedDifficulty });
    }
    setIsAutoSavePrefHydrated(true);
  }, [dispatch]);

  const combatDifficulty = gameState.combatDifficulty ?? "normal";
  // Rules edition lives on GameState and travels with the save, so it needs no
  // separate localStorage pref. `getRulesEdition` supplies the only default.
  const rulesEdition = getRulesEdition(gameState);
  // Same story for save-scum: it travels with the save, and `getAllowSaveScum`
  // supplies the only default (agora-f821.63).
  const allowSaveScum = getAllowSaveScum(gameState);
  useEffect(() => {
    if (!isAutoSavePrefHydrated) return;
    SafeStorage.trySetItem(COMBAT_DIFFICULTY_PREF_KEY, combatDifficulty);
  }, [combatDifficulty, isAutoSavePrefHydrated]);

  // Persist preference any time the user toggles it.
  useEffect(() => {
    if (!isAutoSavePrefHydrated) return;
    SafeStorage.trySetItem(AUTO_SAVE_PREF_KEY, autoSaveEnabled ? "1" : "0");
  }, [autoSaveEnabled, isAutoSavePrefHydrated]);

  // Best-effort autosave for refresh safety.
  // Gate on preference hydration so we don't accidentally autosave if the user
  // previously disabled the feature.
  useAutoSave(gameState, isAutoSavePrefHydrated ? autoSaveEnabled : false);

  return { autoSaveEnabled, combatDifficulty, rulesEdition, allowSaveScum, itemsById };
}

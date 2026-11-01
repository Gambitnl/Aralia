/** Routes developer-menu commands to the established action and initialization paths. Menu toggles, asynchronous party generation and glossary selection preserve their original ordering and failure behavior. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 01:42:47
 * Dependents: App.tsx, components/layout/AppShell.tsx, components/screens/AppPhaseContent.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback } from "react";
import type { Dispatch } from "react";
import type { GameState } from "../../types/state";
import type { AppAction } from "../../state/actionTypes";
import { GamePhase, type PlayerCharacter } from "../../types";
import type { useGameInitialization } from "../useGameInitialization";
import type { useGameActions } from "../useGameActions";

export function useAppDeveloperMenu(
  gameState: GameState, dispatch: Dispatch<AppAction>, handleNewGame: () => void,
  processAction: ReturnType<typeof useGameActions>["processAction"],
  handleLoadGameFlow: ReturnType<typeof useGameInitialization>["handleLoadGameFlow"],
  handleSkipCharacterCreator: ReturnType<typeof useGameInitialization>["handleSkipCharacterCreator"],
) {
  const handleDevMenuAction = useCallback(
    async (actionType: string) => {
      const actionsThatNeedMenuToggle = [
        "save",
        "battle_map_demo",
        "combat_messaging_demo",
        "generate_encounter",
        "restart_dynamic_party",
        "quick_start_dev",
        "open_ai_provider_config",
      ];

      if (actionsThatNeedMenuToggle.includes(actionType)) {
        dispatch({ type: "TOGGLE_DEV_MENU" });
      }

      switch (
        actionType as
          | (typeof actionsThatNeedMenuToggle)[number]
          | "main_menu"
          | "char_creator"
          | "toggle_log_viewer"
          | "toggle_unified_log_viewer"
          | "toggle_party_editor"
          | "toggle_npc_test_plan"
          | "inspect_noble_houses"
          | "load"
          | "toggle_naval_dashboard"
          | "toggle_trade_route_dashboard"
          | "toggle_economy_ledger"
          | "toggle_courier_pouch"
          | "combat_messaging_demo"
      ) {
        case "restart_dynamic_party":
          dispatch({
            type: "SET_LOADING",
            payload: { isLoading: true, message: "Generating new party..." },
          });
          try {
            // Load the procedural companion generator only for this dev action.
            // It pulls in character, NPC, and local-AI helpers that the main menu
            // does not need during normal startup.
            const { generateCompanion } =
              await import("../../services/CompanionGenerator");
            const newParty: PlayerCharacter[] = [];
            // Generate a party of 3 for now
            const configs = [
              { level: 1, classId: "fighter", raceId: "human" },
              { level: 1, classId: "rogue", raceId: "tiefling" },
              { level: 1, classId: "wizard", raceId: "elf" },
            ];

            for (const config of configs) {
              const companion = await generateCompanion(config);
              if (companion) {
                newParty.push(companion);
              }
            }

            if (newParty.length === configs.length) {
              dispatch({
                type: "RESTART_WITH_PROCEDURAL_PARTY",
                payload: newParty,
              });
            } else {
              throw new Error("Failed to generate one or more companions.");
            }
          } catch (error) {
            console.error("Failed to restart with procedural party:", error);
            window.alert(`Failed to restart with procedural party: ${error}`);
            dispatch({
              type: "SET_ERROR",
              payload:
                "Failed to generate a new party. Check the console for details.",
            });
          } finally {
            dispatch({ type: "SET_LOADING", payload: { isLoading: false } });
          }
          break;
        case "main_menu":
          dispatch({ type: "SET_GAME_PHASE", payload: GamePhase.MAIN_MENU });
          break;
        case "char_creator":
          handleNewGame();
          break;
        case "quick_start_dev":
          // This route used to be a standalone main-menu button. It now lives inside the
          // shared Dev Menu so all developer-only start flows are grouped in one place.
          await handleSkipCharacterCreator();
          break;
        case "save":
          processAction({ type: "save_game", label: "Force Save" });
          break;
        case "load":
          handleLoadGameFlow();
          break;
        case "toggle_log_viewer":
          dispatch({ type: "TOGGLE_GEMINI_LOG_VIEWER" });
          break;
        case "toggle_unified_log_viewer":
          dispatch({ type: "TOGGLE_UNIFIED_LOG_VIEWER" });
          break;
        case "open_ai_provider_config":
          // Reuse the shared provider pane so Gemini fallback and Groq cloud
          // setup stay in one place instead of drifting across debug surfaces.
          dispatch({ type: "SHOW_OLLAMA_DEPENDENCY_MODAL" });
          break;
        // 'design_preview' removed - access via /Aralia/misc/design.html
        // 'battle_map_demo' moved to the design preview - misc/design.html?step=battlemap
        case "combat_messaging_demo":
          dispatch({
            type: "SET_GAME_PHASE",
            payload: GamePhase.COMBAT_MESSAGING_DEMO,
          });
          break;
        case "toggle_party_editor":
          dispatch({ type: "TOGGLE_PARTY_EDITOR_MODAL" });
          break;
        case "generate_encounter":
          processAction({
            type: "GENERATE_ENCOUNTER",
            label: "Generate Encounter",
          });
          break;
        case "toggle_npc_test_plan":
          processAction({
            type: "TOGGLE_NPC_TEST_MODAL",
            label: "Toggle NPC Test Plan",
          });
          break;
        case "inspect_noble_houses":
          dispatch({ type: "TOGGLE_NOBLE_HOUSE_LIST" });
          break;
        case "toggle_naval_dashboard":
          dispatch({ type: "TOGGLE_NAVAL_DASHBOARD" });
          break;
        case "toggle_trade_route_dashboard":
          dispatch({ type: "TOGGLE_TRADE_ROUTE_DASHBOARD" });
          break;
        case "toggle_economy_ledger":
          dispatch({ type: "TOGGLE_ECONOMY_LEDGER" });
          break;
        case "toggle_courier_pouch":
          dispatch({ type: "TOGGLE_COURIER_POUCH" });
          break;
        case "test_lockpicking":
          // Open lockpicking modal with a sample test lock
          dispatch({
            type: "OPEN_LOCKPICKING_MODAL",
            payload: {
              id: "test-lock-1",
              dc: 15,
              breakDC: 20,
              isLocked: true,
              isBroken: false,
              isTrapped: true,
              trap: {
                id: "test-trap-1",
                name: "Poison Needle Trap",
                detectionDC: 12,
                disarmDC: 14,
                triggerCondition: "touch",
                effect: {
                  damage: { count: 1, sides: 4, bonus: 0 },
                  damageType: "poison",
                },
                resetable: false,
                isDisarmed: false,
                isTriggered: false,
              },
            },
          });
          break;
        case "test_dice_roller":
          dispatch({ type: "TOGGLE_DICE_ROLLER" });
          break;
      }
    },
    [
      dispatch,
      handleNewGame,
      processAction,
      handleLoadGameFlow,
      handleSkipCharacterCreator,
    ],
  );

  const handleModelChange = useCallback(
    (model: string | null) => {
      dispatch({ type: "SET_DEV_MODEL_OVERRIDE", payload: model });
    },
    [dispatch],
  );

  // The main-menu dev entry now opens the same shared developer modal that gameplay uses,
  // but it should not silently change the user's Dev Mode choice just because the modal
  // was reopened. The modal itself exposes the real toggle, so this handler only opens
  // the shared surface and preserves whatever state the user last chose.
  const handleOpenDevMenuFromMainMenu = useCallback(() => {
    if (!gameState.isDevMenuVisible) {
      dispatch({ type: "TOGGLE_DEV_MENU" });
    }
  }, [dispatch, gameState.isDevMenuVisible]);

  const handleNavigateToGlossaryFromTooltip = useCallback(
    (termId: string) => {
      if (!gameState.isGlossaryVisible) {
        // Opening and selecting must be one reducer action. A separate selection
        // dispatch is cleared by the glossary toggle while it closes the other
        // overlays, which previously made spell links fall back to Acolyte.
        processAction({
          type: "TOGGLE_GLOSSARY_VISIBILITY",
          label: "Open Glossary",
          payload: { initialTermId: termId },
        });
      } else {
        // An already-open glossary only needs to move its current selection;
        // toggling here would close the modal instead of following the link.
        dispatch({ type: "SET_GLOSSARY_TERM_FOR_MODAL", payload: termId });
      }
    },
    [dispatch, processAction, gameState.isGlossaryVisible],
  );

  return { handleDevMenuAction, handleModelChange, handleOpenDevMenuFromMainMenu, handleNavigateToGlossaryFromTooltip };
}

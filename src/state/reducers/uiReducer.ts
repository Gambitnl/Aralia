// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/06/2026, 01:55:55
 * Dependents: state/appState.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/state/reducers/uiReducer.ts
 * A slice reducer that handles UI-related state changes.
 */
import { GameState, GamePhase, Notification } from '../../types';
import { AppAction } from '../actionTypes';
import { MOCK_SHIP_SLOOP } from '../../data/dev/mockShips';
import { generateId } from '../../utils/core/idGenerator';

export function uiReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'ADD_NOTIFICATION': {
      const newNotification: Notification = {
        id: generateId(),
        message: action.payload.message,
        type: action.payload.type,
        duration: action.payload.duration,
      };
      return { notifications: [...state.notifications, newNotification] };
    }

    case 'REMOVE_NOTIFICATION': {
      return { notifications: state.notifications.filter(n => n.id !== action.payload.id) };
    }

    case 'SET_LOADING':
      return {
        isLoading: action.payload.isLoading,
        loadingMessage: action.payload.isLoading ? (action.payload.message || "Aralia is weaving fate...") : null
      };

    case 'SET_IMAGE_LOADING':
      return {
        isImageLoading: action.payload,
        loadingMessage: action.payload ? "A vision forms in the æther..." : null
      };

    case 'SET_ERROR':
      return { error: action.payload, isLoading: false, isImageLoading: false, loadingMessage: null };

    case 'SET_RATE_LIMIT_ERROR_FLAG':
      return { hasNewRateLimitError: true };

    case 'SET_DEV_MODEL_OVERRIDE':
      return { devModelOverride: action.payload };

    case 'SET_DEV_MODE_ENABLED':
      return { isDevModeEnabled: action.payload };

    case 'TOGGLE_MAP_VISIBILITY':
      return { isMapVisible: !state.isMapVisible, isThreeDVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };

    case 'TOGGLE_MINIMAP_VISIBILITY': {
      const nextVisibility = !(state as unknown as { isMinimapVisible?: boolean }).isMinimapVisible;
      return { isMinimapVisible: nextVisibility } as Partial<GameState>;
    }

    case 'TOGGLE_THREE_D_VISIBILITY':
      // PLAYING uses SET_WORLD_VIEW_MODE via toggle_three_d; legacy modal is for other phases only (W3DUI-22).
      if (state.phase === GamePhase.PLAYING) {
        return { isThreeDVisible: false };
      }
      return { isThreeDVisible: !state.isThreeDVisible, isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };

    case 'TOGGLE_PARTY_OVERLAY':
      return { isPartyOverlayVisible: !state.isPartyOverlayVisible, isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };

    case 'OPEN_CHARACTER_SHEET':
      return { characterSheetModal: { isOpen: true, character: action.payload }, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };

    case 'CLOSE_CHARACTER_SHEET':
      return { characterSheetModal: { isOpen: false, character: null } };

    case 'TOGGLE_DEV_MENU':
      return { isDevMenuVisible: !state.isDevMenuVisible, hasNewRateLimitError: false, isMapVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyEditorVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };

    case 'TOGGLE_NPC_TEST_MODAL':
      return { isNpcTestModalVisible: !state.isNpcTestModalVisible, isDevMenuVisible: false };

    case 'TOGGLE_PARTY_EDITOR_MODAL':
      return { isPartyEditorVisible: !state.isPartyEditorVisible, isDevMenuVisible: false, isPartyOverlayVisible: false };

    case 'TOGGLE_GEMINI_LOG_VIEWER':
      return { isGeminiLogViewerVisible: !state.isGeminiLogViewerVisible, hasNewRateLimitError: false, isDevMenuVisible: false, isOllamaLogViewerVisible: false };

    case 'TOGGLE_OLLAMA_LOG_VIEWER':
      return { isOllamaLogViewerVisible: !state.isOllamaLogViewerVisible, isDevMenuVisible: false, isGeminiLogViewerVisible: false };

    case 'TOGGLE_DISCOVERY_LOG_VISIBILITY':
      return { isDiscoveryLogVisible: !state.isDiscoveryLogVisible, isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };

    case 'TOGGLE_LOGBOOK':
      return { isLogbookVisible: !state.isLogbookVisible, isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isDiscoveryLogVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isQuestLogVisible: false };

    case 'TOGGLE_LONG_REST_MODAL':
      return { isLongRestModalVisible: !state.isLongRestModalVisible, isPartyOverlayVisible: false, isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isNpcTestModalVisible: false, isDiscoveryLogVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isQuestLogVisible: false };

    case 'TOGGLE_SHORT_REST_MODAL':
      return { isShortRestModalVisible: !state.isShortRestModalVisible, isPartyOverlayVisible: false, isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isNpcTestModalVisible: false, isDiscoveryLogVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isQuestLogVisible: false };

    case 'TOGGLE_QUEST_LOG':
      return { isQuestLogVisible: !state.isQuestLogVisible, isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isDiscoveryLogVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isLogbookVisible: false };

    case 'SET_NOTICE_BOARD_VISIBLE':
      // Opening the notice board closes other conflicting overlays (mirrors the
      // other visibility toggles); closing it leaves the rest of the UI alone.
      return action.payload
        ? { isNoticeBoardVisible: true, isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isDiscoveryLogVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isLogbookVisible: false, isQuestLogVisible: false }
        : { isNoticeBoardVisible: false };

    case 'SET_BROADSHEET_VISIBLE':
      // Opening the broadsheet closes other conflicting overlays (mirrors the
      // notice-board toggle); closing it leaves the rest of the UI alone.
      // Opening here is the LIVE path (the in-town action), so any frozen
      // keepsake snapshot is cleared; closing also clears it so a later live
      // open never inherits a stale snapshot.
      return action.payload
        ? { isBroadsheetVisible: true, broadsheetSnapshot: undefined, isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isDiscoveryLogVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isLogbookVisible: false, isQuestLogVisible: false, isNoticeBoardVisible: false }
        : { isBroadsheetVisible: false, broadsheetSnapshot: undefined };

    case 'READ_ITEM': {
      // Reading a readable Book item (e.g. a broadsheet keepsake) opens the
      // broadsheet modal on its FROZEN snapshot — works anywhere, even after
      // the player has left the town. Non-readable items are a no-op.
      const item = state.inventory.find(i => i.id === action.payload.itemId);
      if (!item?.readableContent) return {};
      return { isBroadsheetVisible: true, broadsheetSnapshot: item.readableContent, isNoticeBoardVisible: false };
    }

    case 'TOGGLE_GLOSSARY_VISIBILITY': {
      const openingGlossary = !state.isGlossaryVisible;
      return {
        isGlossaryVisible: openingGlossary,
        selectedGlossaryTermForModal: openingGlossary && action.payload?.initialTermId ? action.payload.initialTermId : undefined,
        isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false,
        characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }
      };
    }

    case 'TOGGLE_GAME_GUIDE':
      return {
        isGameGuideVisible: !state.isGameGuideVisible,
        isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false,
        characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGlossaryVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isThievesGuildVisible: false
      };

    case 'SHOW_OLLAMA_DEPENDENCY_MODAL':
      return { isOllamaDependencyModalVisible: true };

    case 'HIDE_OLLAMA_DEPENDENCY_MODAL':
      return { isOllamaDependencyModalVisible: false };

    case 'TOGGLE_THIEVES_GUILD':
      return {
        isThievesGuildVisible: !state.isThievesGuildVisible,
        isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false,
        characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGlossaryVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isGameGuideVisible: false
      };

    case 'TOGGLE_THIEVES_GUILD_SAFEHOUSE':
      return {
        isThievesGuildSafehouseVisible: !state.isThievesGuildSafehouseVisible,
        isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false,
        characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGlossaryVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isGameGuideVisible: false, isThievesGuildVisible: false
      };

    case 'TOGGLE_UNIFIED_LOG_VIEWER':
      return {
        isUnifiedLogViewerVisible: !state.isUnifiedLogViewerVisible,
        isDevMenuVisible: false,
        isGeminiLogViewerVisible: false,
        isOllamaLogViewerVisible: false
      };

    case 'TOGGLE_NAVAL_DASHBOARD': {
      const nextVisible = !state.isNavalDashboardVisible;
      let activeShip = state.naval?.activeShipId
        ? state.naval.playerShips.find(s => s.id === state.naval.activeShipId)
        : undefined;

      let nextNavalState = state.naval;

      // Auto-inject mock ship if in Dev Mode and no ship exists
      // Complex object creation and state traversal inside a reducer case makes the reducer bloated and harder to test.
      if (nextVisible && state.isDevModeEnabled && !activeShip) {
        activeShip = MOCK_SHIP_SLOOP;
        // Ensure we don't duplicate if it somehow exists but wasn't active
        const existingShip = state.naval?.playerShips?.find(s => s.id === MOCK_SHIP_SLOOP.id);
        const newPlayerShips = state.naval?.playerShips ?
          (existingShip ? state.naval.playerShips : [...state.naval.playerShips, MOCK_SHIP_SLOOP]) :
          [MOCK_SHIP_SLOOP];

        nextNavalState = {
          ...(state.naval || {
            playerShips: [],
            activeShipId: null,
            currentVoyage: null,
            knownPorts: []
          }),
          playerShips: newPlayerShips,
          activeShipId: MOCK_SHIP_SLOOP.id
        };
      }

      return {
        isNavalDashboardVisible: nextVisible,
        ship: activeShip,
        naval: nextNavalState,
        isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false,
        characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGlossaryVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isGameGuideVisible: false, isThievesGuildVisible: false
      };
    }

    case 'TOGGLE_NOBLE_HOUSE_LIST':
      return {
        isNobleHouseListVisible: !state.isNobleHouseListVisible,
        isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false,
        characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGlossaryVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isGameGuideVisible: false, isThievesGuildVisible: false, isNavalDashboardVisible: false
      };

    case 'TOGGLE_TRADE_ROUTE_DASHBOARD':
      return {
        isTradeRouteDashboardVisible: !state.isTradeRouteDashboardVisible,
        isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false,
        characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGlossaryVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isGameGuideVisible: false, isThievesGuildVisible: false, isNavalDashboardVisible: false
      };

    case 'TOGGLE_INVESTMENT_BOARD':
      return {
        isInvestmentBoardVisible: !state.isInvestmentBoardVisible,
        isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false,
        characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGlossaryVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isGameGuideVisible: false, isThievesGuildVisible: false, isNavalDashboardVisible: false,
        isTradeRouteDashboardVisible: false, isEconomyLedgerVisible: false, isCourierPouchVisible: false
      };

    case 'TOGGLE_LOCKPICKING_MODAL':
      return {
        isLockpickingModalVisible: !state.isLockpickingModalVisible,
        activeLock: state.isLockpickingModalVisible ? null : state.activeLock,
      };

    case 'OPEN_LOCKPICKING_MODAL':
      return {
        isLockpickingModalVisible: true,
        activeLock: action.payload,
        isDevMenuVisible: false,
      };

    case 'CLOSE_LOCKPICKING_MODAL':
      return {
        isLockpickingModalVisible: false,
        activeLock: null,
      };

    case 'OPEN_PUZZLE_RUNTIME':
      return {
        isPuzzleRuntimeVisible: true,
        activePuzzle: action.payload,
        isDevMenuVisible: false,
      };

    case 'CLOSE_PUZZLE_RUNTIME':
      return {
        isPuzzleRuntimeVisible: false,
        activePuzzle: null,
      };

    case 'TOGGLE_DICE_ROLLER':
      return {
        isDiceRollerVisible: !state.isDiceRollerVisible,
        isDevMenuVisible: false,
      };

    case 'SET_VISUAL_DICE_ENABLED':
      return { visualDiceEnabled: action.payload };

    case 'SET_GLOSSARY_TERM_FOR_MODAL':
      return { selectedGlossaryTermForModal: action.payload };

    case 'CLEAR_GLOSSARY_TERM_FOR_MODAL':
      return { selectedGlossaryTermForModal: undefined };

    case 'END_BATTLE':
      // Return to Playing Phase and clear enemies
      return { phase: GamePhase.PLAYING, currentEnemies: null };

    case 'OPEN_MERCHANT':
      return {
        merchantModal: {
          isOpen: true,
          merchantName: action.payload.merchantName,
          merchantInventory: action.payload.inventory,
          economy: (action.payload as { economy?: GameState['economy'] }).economy // Persist economy state
        },
        economy: (action.payload as { economy?: GameState['economy'] }).economy || state.economy,
        // Close other potentially conflicting UIs
        isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false
      };

    case 'CLOSE_MERCHANT':
      return {
        merchantModal: {
          isOpen: false,
          merchantName: '',
          merchantInventory: [],
          economy: undefined
        },
        economy: state.economy,
      };

    case 'START_HEIST_PLANNING':
      // Close other UIs to focus on Heist Planning
      return {
        isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }
      };

    case 'ABORT_HEIST':
      // Return to normal view
      return {};

    default:
      return {};
  }
}

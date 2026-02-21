// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 21/02/2026, 02:40:52
 * Dependents: appState.ts
 * Imports: 4 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
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
      return { isMapVisible: !state.isMapVisible, isSubmapVisible: false, isThreeDVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };

    case 'TOGGLE_MINIMAP_VISIBILITY': {
      // TODO(2026-01-03 pass 4 Codex-CLI): Minimap visibility is not part of GameState; casting placeholder until UI state is extended.
      const nextVisibility = !(state as unknown as { isMinimapVisible?: boolean }).isMinimapVisible;
      return { isMinimapVisible: nextVisibility } as Partial<GameState>;
    }

    case 'TOGGLE_SUBMAP_VISIBILITY':
      return { isSubmapVisible: !state.isSubmapVisible, isMapVisible: false, isThreeDVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };

    case 'TOGGLE_THREE_D_VISIBILITY':
      return { isThreeDVisible: !state.isThreeDVisible, isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };

    case 'TOGGLE_PARTY_OVERLAY':
      return { isPartyOverlayVisible: !state.isPartyOverlayVisible, isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };

    case 'OPEN_CHARACTER_SHEET':
      return { characterSheetModal: { isOpen: true, character: action.payload }, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };

    case 'CLOSE_CHARACTER_SHEET':
      return { characterSheetModal: { isOpen: false, character: null } };

    case 'TOGGLE_DEV_MENU':
      return { isDevMenuVisible: !state.isDevMenuVisible, hasNewRateLimitError: false, isMapVisible: false, isSubmapVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyEditorVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };

    case 'TOGGLE_NPC_TEST_MODAL':
      return { isNpcTestModalVisible: !state.isNpcTestModalVisible, isDevMenuVisible: false };

    case 'TOGGLE_PARTY_EDITOR_MODAL':
      return { isPartyEditorVisible: !state.isPartyEditorVisible, isDevMenuVisible: false, isPartyOverlayVisible: false };

    case 'TOGGLE_GEMINI_LOG_VIEWER':
      return { isGeminiLogViewerVisible: !state.isGeminiLogViewerVisible, hasNewRateLimitError: false, isDevMenuVisible: false, isOllamaLogViewerVisible: false };

    case 'TOGGLE_OLLAMA_LOG_VIEWER':
      return { isOllamaLogViewerVisible: !state.isOllamaLogViewerVisible, isDevMenuVisible: false, isGeminiLogViewerVisible: false };

    case 'TOGGLE_DISCOVERY_LOG_VISIBILITY':
      return { isDiscoveryLogVisible: !state.isDiscoveryLogVisible, isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };

    case 'TOGGLE_LOGBOOK':
      return { isLogbookVisible: !state.isLogbookVisible, isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isDiscoveryLogVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isQuestLogVisible: false };

    case 'TOGGLE_QUEST_LOG':
      return { isQuestLogVisible: !state.isQuestLogVisible, isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isDiscoveryLogVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isLogbookVisible: false };

    case 'TOGGLE_GLOSSARY_VISIBILITY': {
      const openingGlossary = !state.isGlossaryVisible;
      return {
        isGlossaryVisible: openingGlossary,
        selectedGlossaryTermForModal: openingGlossary && action.payload?.initialTermId ? action.payload.initialTermId : undefined,
        isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false,
        characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }
      };
    }

    case 'TOGGLE_GAME_GUIDE':
      return {
        isGameGuideVisible: !state.isGameGuideVisible,
        isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false,
        characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGlossaryVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isThievesGuildVisible: false
      };

    case 'SHOW_OLLAMA_DEPENDENCY_MODAL':
      return { isOllamaDependencyModalVisible: true };

    case 'HIDE_OLLAMA_DEPENDENCY_MODAL':
      return { isOllamaDependencyModalVisible: false };

    case 'TOGGLE_THIEVES_GUILD':
      return {
        isThievesGuildVisible: !state.isThievesGuildVisible,
        isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false,
        characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGlossaryVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isGameGuideVisible: false
      };

    case 'TOGGLE_THIEVES_GUILD_SAFEHOUSE':
      return {
        isThievesGuildSafehouseVisible: !state.isThievesGuildSafehouseVisible,
        isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false,
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
      // TODO: Extract this auto-injection logic into a helper function (e.g., ensureDevShipState) or a dedicated thunk/saga.
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
        isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false,
        characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGlossaryVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isGameGuideVisible: false, isThievesGuildVisible: false
      };
    }

    case 'TOGGLE_NOBLE_HOUSE_LIST':
      return {
        isNobleHouseListVisible: !state.isNobleHouseListVisible,
        isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false,
        characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGlossaryVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isGameGuideVisible: false, isThievesGuildVisible: false, isNavalDashboardVisible: false
      };

    case 'TOGGLE_TRADE_ROUTE_DASHBOARD':
      return {
        isTradeRouteDashboardVisible: !state.isTradeRouteDashboardVisible,
        isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false,
        characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGlossaryVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isGameGuideVisible: false, isThievesGuildVisible: false, isNavalDashboardVisible: false
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
          // TODO(2026-01-03 pass 4 Codex-CLI): economy stored on merchant modal as placeholder; align modal typing when UI supports it.
          economy: (action.payload as { economy?: GameState['economy'] }).economy // Persist economy state
        },
        // TODO(2026-01-03 pass 4 Codex-CLI): carry economy separately from modal to satisfy GameState typing until modal includes it.
        economy: (action.payload as { economy?: GameState['economy'] }).economy || state.economy,
        // Close other potentially conflicting UIs
        isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false
      };

    case 'CLOSE_MERCHANT':
      return {
        merchantModal: {
          isOpen: false,
          merchantName: '',
          merchantInventory: [],
          // TODO(2026-01-03 pass 4 Codex-CLI): economy cleared placeholder; real modal typing should handle this.
          economy: undefined
        },
        economy: state.economy,
      };

    case 'START_HEIST_PLANNING':
      // Close other UIs to focus on Heist Planning
      return {
        isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }
      };

    case 'ABORT_HEIST':
      // Return to normal view
      return {};

    default:
      return {};
  }
}

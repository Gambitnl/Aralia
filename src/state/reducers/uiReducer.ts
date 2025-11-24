
/**
 * @file src/state/reducers/uiReducer.ts
 * A slice reducer that handles UI-related state changes.
 */
import { GameState, GamePhase, Notification } from '../../types';
import { AppAction } from '../actionTypes';

export function uiReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'ADD_NOTIFICATION': {
      const newNotification: Notification = {
        id: crypto.randomUUID(),
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

    case 'TOGGLE_MAP_VISIBILITY':
      return { isMapVisible: !state.isMapVisible, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };

    case 'TOGGLE_SUBMAP_VISIBILITY':
      return { isSubmapVisible: !state.isSubmapVisible, isMapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };
      
    case 'TOGGLE_PARTY_OVERLAY':
      return { isPartyOverlayVisible: !state.isPartyOverlayVisible, isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };
      
    case 'OPEN_CHARACTER_SHEET':
      return { characterSheetModal: { isOpen: true, character: action.payload }, isDevMenuVisible: false, isGeminiLogViewerVisible: false, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };
      
    case 'CLOSE_CHARACTER_SHEET':
      return { characterSheetModal: { isOpen: false, character: null } };

    case 'TOGGLE_DEV_MENU':
      return { isDevMenuVisible: !state.isDevMenuVisible, hasNewRateLimitError: false, isMapVisible: false, isSubmapVisible: false, isGeminiLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyEditorVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };

    case 'TOGGLE_NPC_TEST_MODAL':
      return { isNpcTestModalVisible: !state.isNpcTestModalVisible, isDevMenuVisible: false };

    case 'TOGGLE_PARTY_EDITOR_MODAL':
      return { isPartyEditorVisible: !state.isPartyEditorVisible, isDevMenuVisible: false, isPartyOverlayVisible: false };
      
    case 'TOGGLE_GEMINI_LOG_VIEWER':
      return { isGeminiLogViewerVisible: !state.isGeminiLogViewerVisible, hasNewRateLimitError: false, isDevMenuVisible: false };

    case 'TOGGLE_DISCOVERY_LOG_VISIBILITY':
      return { isDiscoveryLogVisible: !state.isDiscoveryLogVisible, isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false } };
      
    case 'TOGGLE_LOGBOOK':
      return { isLogbookVisible: !state.isLogbookVisible, isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isDiscoveryLogVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isQuestLogVisible: false };

    case 'TOGGLE_QUEST_LOG':
      return { isQuestLogVisible: !state.isQuestLogVisible, isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isDiscoveryLogVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }, isLogbookVisible: false };

    case 'TOGGLE_GLOSSARY_VISIBILITY': {
      const openingGlossary = !state.isGlossaryVisible;
      return {
        isGlossaryVisible: openingGlossary,
        selectedGlossaryTermForModal: openingGlossary && action.payload?.initialTermId ? action.payload.initialTermId : undefined,
        isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false,
        characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }
      };
    }

    case 'TOGGLE_GAME_GUIDE':
      return { 
          isGameGuideVisible: !state.isGameGuideVisible,
          isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false,
          characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGlossaryVisible: false, merchantModal: { ...state.merchantModal, isOpen: false }
      };

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
                economy: action.payload.economy // Persist economy state
            },
            // Close other potentially conflicting UIs
            isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isGeminiLogViewerVisible: false, characterSheetModal: { isOpen: false, character: null }, isDiscoveryLogVisible: false, isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isPartyOverlayVisible: false, isNpcTestModalVisible: false, isLogbookVisible: false, isGameGuideVisible: false
        };

    case 'CLOSE_MERCHANT':
        return {
            merchantModal: {
                isOpen: false,
                merchantName: '',
                merchantInventory: [],
                economy: undefined
            }
        };
      
    default:
      return {};
  }
}

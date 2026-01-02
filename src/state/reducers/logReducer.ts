/**
 * @file src/state/reducers/logReducer.ts
 * A slice reducer that handles logging-related state changes.
 */
import { GameState, DiscoveryEntry, DiscoveryType } from '../../types';
import { AppAction } from '../actionTypes';

export function logReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return { messages: [...state.messages, action.payload] };

    case 'ADD_GEMINI_LOG_ENTRY':
      return {
        geminiInteractionLog: [action.payload, ...(state.geminiInteractionLog || [])].slice(0, 100),
      };

    case 'ADD_OLLAMA_LOG_ENTRY':
      return {
        ollamaInteractionLog: [action.payload, ...(state.ollamaInteractionLog || [])].slice(0, 100),
      };

    case 'ADD_DISCOVERY_ENTRY': {
      const newEntryData: DiscoveryEntry = {
        ...action.payload,
        id: action.payload.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        timestamp: Date.now(),
        isRead: false,
      };
      if (newEntryData.type === DiscoveryType.LOCATION_DISCOVERY) {
        const existingEntry = state.discoveryLog.find(entry =>
          entry.type === newEntryData.type &&
          entry.flags.some(f => f.key === 'locationId' && f.value === newEntryData.flags.find(nf => nf.key === 'locationId')?.value)
        );
        if (existingEntry) return {};
      }
      return {
        discoveryLog: [newEntryData, ...state.discoveryLog],
        unreadDiscoveryCount: state.unreadDiscoveryCount + 1,
      };
    }

    case 'MARK_DISCOVERY_READ': {
      let newUnreadCount = state.unreadDiscoveryCount;
      const updatedLog = state.discoveryLog.map(entry => {
        if (entry.id === action.payload.entryId && !entry.isRead) {
          newUnreadCount = Math.max(0, newUnreadCount - 1);
          return { ...entry, isRead: true };
        }
        return entry;
      });
      return { discoveryLog: updatedLog, unreadDiscoveryCount: newUnreadCount };
    }

    case 'MARK_ALL_DISCOVERIES_READ':
      return {
        discoveryLog: state.discoveryLog.map(entry => ({ ...entry, isRead: true })),
        unreadDiscoveryCount: 0,
      };

    case 'CLEAR_DISCOVERY_LOG':
      return { discoveryLog: [], unreadDiscoveryCount: 0 };

    case 'UPDATE_QUEST_IN_DISCOVERY_LOG': {
      // TODO(lint-intent): This switch case declares new bindings, implying scoped multi-step logic.
      // TODO(lint-intent): Wrap the case in braces or extract a helper to keep scope and intent clear.
      // TODO(lint-intent): If shared state is intended, lift the declarations outside the switch.
      const unreadIncrement = state.discoveryLog.some(entry => entry.isQuestRelated && entry.questId === action.payload.questId && !entry.isRead) ? 0 : 1;
      return {
        discoveryLog: state.discoveryLog.map(entry => {
          if (entry.isQuestRelated && entry.questId === action.payload.questId) {
            return {
              ...entry,
              content: action.payload.newContent ? `${entry.content}\n\nUpdate: ${action.payload.newContent}` : entry.content,
              questStatus: action.payload.newStatus,
              isRead: false,
            };
          }
          return entry;
        }),
        unreadDiscoveryCount: state.unreadDiscoveryCount + unreadIncrement,
      };
    }

    default:
      return {};
  }
}

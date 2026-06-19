// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/06/2026, 00:47:31
 * Dependents: services/saveLoadService.ts, state/appState.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/state/reducers/logReducer.ts
 * This file handles game-state changes for player-visible and debug logs.
 *
 * It exists so message history, AI debug traces, and the player's discovery
 * Logbook all update through one reducer surface. Gameplay systems dispatch
 * actions here, and the returned partial state is merged into the central
 * GameState by the app state layer.
 */
import { GameState, DiscoveryEntry, DiscoveryType } from '../../types';
import { AppAction } from '../actionTypes';

// ============================================================================
// Discovery Log Retention Policy
// ============================================================================
// The discovery log is player-facing memory, so it should retain enough recent
// history to be useful while preventing long campaigns and legacy saves from
// growing without bound.
// ============================================================================

export const MAX_DISCOVERY_LOG_ENTRIES = 200;

export function retainDiscoveryLogEntries(discoveryLog: DiscoveryEntry[]): DiscoveryEntry[] {
  // Keep the newest entries because the reducer stores discovery memories with
  // the newest item first. This preserves the current display order and prunes
  // only the oldest memories when the cap is exceeded.
  return discoveryLog.slice(0, MAX_DISCOVERY_LOG_ENTRIES);
}

export function countUnreadDiscoveryEntries(discoveryLog: DiscoveryEntry[]): number {
  // Count the unread entries that still exist after retention. This keeps the
  // badge tied to visible Logbook state instead of historical entries that were
  // pruned away or loaded from older saves.
  return discoveryLog.filter(entry => !entry.isRead).length;
}

// ============================================================================
// Log Reducer
// ============================================================================
// Each case below updates one log-related part of GameState while preserving
// existing behaviors such as location dedupe and explicit read/clear actions.
// ============================================================================

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

    case 'UPDATE_OLLAMA_LOG_ENTRY': {
      const { id, response, model } = action.payload;
      return {
        ollamaInteractionLog: (state.ollamaInteractionLog || []).map(entry =>
          entry.id === id
            ? { ...entry, response, model: model || entry.model, isPending: false }
            : entry
        ),
      };
    }

    case 'ADD_BANTER_DEBUG_LOG':
      return {
        banterDebugLog: [action.payload, ...(state.banterDebugLog || [])].slice(0, 50),
      };

    case 'CLEAR_BANTER_DEBUG_LOG':
      return { banterDebugLog: [] };

    case 'ADD_DISCOVERY_ENTRY': {
      const payload = (action.payload as Partial<DiscoveryEntry>) || {};
      // Fill in a complete discovery entry even when older callers provide
      // partial data. The new entry starts unread because it represents fresh
      // information for the player.
      const newEntryData: DiscoveryEntry = {
        ...payload,
        id: payload.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        timestamp: Date.now(),
        type: payload.type || DiscoveryType.MISC_EVENT,
        // TODO(2026-01-03 pass 4 Codex-CLI): placeholder gameTime/source/title/content/flags defaults to satisfy DiscoveryEntry; replace when caller guarantees full shape.
        gameTime: payload.gameTime || new Date().toISOString(),
        title: payload.title || 'Discovery',
        content: payload.content || '',
        source: payload.source || { type: 'SYSTEM' },
        flags: payload.flags || [],
        isRead: false,
      };
      if (newEntryData.type === DiscoveryType.LOCATION_DISCOVERY) {
        // Preserve the existing location dedupe rule so revisiting the same
        // discovered place does not create duplicate Logbook rows or badge noise.
        const existingEntry = state.discoveryLog.find(entry =>
          entry.type === newEntryData.type &&
          entry.flags.some(f => f.key === 'locationId' && f.value === newEntryData.flags.find(nf => nf.key === 'locationId')?.value)
        );
        if (existingEntry) return {};
      }
      const retainedDiscoveryLog = retainDiscoveryLogEntries([newEntryData, ...state.discoveryLog]);
      return {
        discoveryLog: retainedDiscoveryLog,
        unreadDiscoveryCount: countUnreadDiscoveryEntries(retainedDiscoveryLog),
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
      // Quest updates refresh every discovery tied to the quest. Recount after
      // the update so every read entry that becomes unread is represented in
      // the badge, while already-unread entries are not double-counted.
      const updatedDiscoveryLog = state.discoveryLog.map(entry => {
        if (entry.isQuestRelated && entry.questId === action.payload.questId) {
          return {
            ...entry,
            content: action.payload.newContent ? `${entry.content}\n\nUpdate: ${action.payload.newContent}` : entry.content,
            questStatus: action.payload.newStatus,
            isRead: false,
          };
        }
        return entry;
      });
      return {
        discoveryLog: updatedDiscoveryLog,
        unreadDiscoveryCount: countUnreadDiscoveryEntries(updatedDiscoveryLog),
      };
    }

    default:
      return {};
  }
}

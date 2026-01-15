/**
 * @file src/state/reducers/journalReducer.ts
 * Reducer for managing journal state including entries, events, and sessions.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { JournalState, JournalEntry, JournalEvent, createInitialJournalState } from '../../types/journal';

/**
 * Generates a unique ID for journal entries/events.
 */
function generateJournalId(): string {
    return `journal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Reducer for journal-related actions.
 */
export function journalReducer(state: GameState, action: AppAction): Partial<GameState> {
    switch (action.type) {
        case 'INIT_JOURNAL_STATE': {
            // Don't reinitialize if already exists
            if (state.journal) return {};

            return {
                journal: createInitialJournalState(),
            };
        }

        case 'ADD_JOURNAL_ENTRY': {
            const journal = state.journal ?? createInitialJournalState();
            const entry = action.payload as JournalEntry;

            // Ensure the entry has an ID
            const entryWithId: JournalEntry = {
                ...entry,
                id: entry.id || generateJournalId(),
                createdAt: entry.createdAt || Date.now(),
                updatedAt: Date.now(),
            };

            return {
                journal: {
                    ...journal,
                    entries: [...journal.entries, entryWithId],
                    currentPageNumber: journal.currentPageNumber + 2, // Journal pages come in pairs
                },
            };
        }

        case 'UPDATE_JOURNAL_ENTRY': {
            const journal = state.journal;
            if (!journal) return {};

            const { entryId, updates } = action.payload as { entryId: string; updates: Partial<JournalEntry> };

            const entryIndex = journal.entries.findIndex(e => e.id === entryId);
            if (entryIndex === -1) return {};

            const updatedEntries = [...journal.entries];
            updatedEntries[entryIndex] = {
                ...updatedEntries[entryIndex],
                ...updates,
                updatedAt: Date.now(),
            };

            return {
                journal: {
                    ...journal,
                    entries: updatedEntries,
                },
            };
        }

        case 'LOG_JOURNAL_EVENT': {
            const journal = state.journal ?? createInitialJournalState();
            const event = action.payload as JournalEvent;

            // Add ID if missing
            const eventWithId: JournalEvent = {
                ...event,
                id: event.id || generateJournalId(),
                timestamp: event.timestamp || Date.now(),
            };

            return {
                journal: {
                    ...journal,
                    pendingEvents: [...journal.pendingEvents, eventWithId],
                },
            };
        }

        case 'CLEAR_PENDING_EVENTS': {
            const journal = state.journal;
            if (!journal) return {};

            return {
                journal: {
                    ...journal,
                    pendingEvents: [],
                },
            };
        }

        case 'INCREMENT_SESSION': {
            const journal = state.journal ?? createInitialJournalState();

            return {
                journal: {
                    ...journal,
                    currentSessionNumber: journal.currentSessionNumber + 1,
                },
            };
        }

        default:
            return {};
    }
}

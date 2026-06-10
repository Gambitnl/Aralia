// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 07:25:51
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
 * @file src/state/reducers/journalReducer.ts
 * Reducer for managing journal state including entries, events, and sessions.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { JournalState, JournalEntry, JournalEvent, createInitialJournalState } from '../../types/journal';
import { formatGameDate } from '../../utils/core';

/**
 * Generates a unique ID for journal entries/events.
 */
function generateJournalId(): string {
    return `journal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Materializes queued journal events into the entry that is about to become
 * visible.
 *
 * The quest bridge keeps events pending until a real journal entry is added.
 * At that point, the entry should already contain the queued trail so the UI
 * can render one coherent page instead of a separate queue artifact.
 */
function mergePendingEventsIntoEntry(entry: JournalEntry, pendingEvents: JournalEvent[]): JournalEntry {
    if (pendingEvents.length === 0) {
        return entry;
    }

    return {
        ...entry,
        autoLoggedEvents: [...entry.autoLoggedEvents, ...pendingEvents],
    };
}

/**
 * Resolves a journal entry from the live reducer state.
 *
 * The long-rest runtime flow now only needs to supply a lightweight prompt
 * instead of a fully prebuilt entry. That keeps the reducer in charge of the
 * authoritative page/session numbering while still preserving any caller
 * provided prose or sketch notes.
 */
function resolveJournalEntry(state: GameState, journal: JournalState, payload: Partial<JournalEntry>): JournalEntry {
    const gameTime = state.gameTime ?? new Date();
    const now = Date.now();
    const sessionNumber = payload.sessionNumber ?? journal.currentSessionNumber;
    const pageNumber = payload.pageNumber ?? journal.currentPageNumber;

    return {
        id: payload.id || generateJournalId(),
        sessionNumber,
        gameDate: payload.gameDate || formatGameDate(gameTime, { month: 'long', day: 'numeric' }),
        gameYear: payload.gameYear || `Year ${gameTime.getUTCFullYear()} DR`,
        pageNumber,
        narrativeText: payload.narrativeText || 'The party records the day before moving on.',
        sketchNotes: payload.sketchNotes,
        recap: payload.recap || {
            sessionNumber,
            keyEvents: [],
            loot: [],
            currentObjectives: [],
        },
        autoLoggedEvents: payload.autoLoggedEvents ?? [],
        createdAt: payload.createdAt || now,
        updatedAt: now,
    };
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
            const entry = resolveJournalEntry(state, journal, action.payload);

            // Ensure the entry has an ID before it is stored as the visible
            // journal page for this session.
            const entryWithId: JournalEntry = {
                ...entry,
                id: entry.id || generateJournalId(),
                createdAt: entry.createdAt || Date.now(),
                updatedAt: Date.now(),
                autoLoggedEvents: entry.autoLoggedEvents ?? [],
            };

            // Consume any queued quest/system events into the new entry so the
            // journal page and the pending queue stay in sync.
            const visibleEntry = mergePendingEventsIntoEntry(entryWithId, journal.pendingEvents);
            const nextSessionNumber = Math.max(journal.currentSessionNumber + 1, visibleEntry.sessionNumber + 1);
            const nextPageNumber = Math.max(journal.currentPageNumber + 2, visibleEntry.pageNumber + 2);

            return {
                journal: {
                    ...journal,
                    entries: [...journal.entries, visibleEntry],
                    currentSessionNumber: nextSessionNumber,
                    currentPageNumber: nextPageNumber, // Journal pages come in pairs
                    pendingEvents: [],
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

/**
 * This file proves queued journal events materialize into visible entries.
 *
 * The quest bridge already writes pending events first. The journal reducer
 * owns the point where those events become part of a real journal page, so
 * this test pins the merge contract in one place instead of letting the UI or
 * quest code invent its own flush behavior.
 */

import { describe, expect, it } from 'vitest';
import { journalReducer } from '../journalReducer';
import { createInitialJournalState, type JournalEntry, type JournalEvent } from '../../../types/journal';
import { createMockGameState } from '../../../utils/factories';

describe('journalReducer', () => {
  it('merges pending events into a new journal entry and clears the queue', () => {
    const pendingEvents: JournalEvent[] = [
      {
        id: 'pending-quest-1',
        type: 'quest_accepted',
        timestamp: 1710000000000,
        gameTime: '2026-06-09T00:00:00.000Z',
        title: 'Quest Accepted: Courier Run',
        description: 'Accepted "Courier Run" and added it to the quest log.',
        questId: 'quest-1',
      },
      {
        id: 'pending-quest-2',
        type: 'quest_completed',
        timestamp: 1710000100000,
        gameTime: '2026-06-09T00:10:00.000Z',
        title: 'Quest Completed: Courier Run',
        description: 'Completed "Courier Run" and claimed its rewards.',
        questId: 'quest-1',
      },
    ];

    const existingEvent: JournalEvent = {
      id: 'existing-event-1',
      type: 'custom',
      timestamp: 1710000200000,
      gameTime: '2026-06-09T00:20:00.000Z',
      title: 'Campfire notes',
      description: 'The party reviewed the day before resting.',
    };

    const state = createMockGameState({
      journal: {
        ...createInitialJournalState(),
        pendingEvents,
      },
    });

    const entry: JournalEntry = {
      id: 'journal-entry-1',
      sessionNumber: 1,
      gameDate: 'The 14th of Kythorn',
      gameYear: 'Year 1492 DR',
      pageNumber: 1,
      narrativeText: 'A journal page for the current session.',
      recap: {
        sessionNumber: 1,
        keyEvents: [],
        loot: [],
        currentObjectives: [],
      },
      autoLoggedEvents: [existingEvent],
      createdAt: 1710000300000,
      updatedAt: 1710000300000,
    };

    const nextState = journalReducer(state, {
      type: 'ADD_JOURNAL_ENTRY',
      payload: entry,
    });

    expect(nextState.journal?.entries).toHaveLength(1);
    expect(nextState.journal?.entries[0]?.autoLoggedEvents).toHaveLength(3);
    expect(nextState.journal?.entries[0]?.autoLoggedEvents.map(event => event.type)).toEqual([
      'custom',
      'quest_accepted',
      'quest_completed',
    ]);
    expect(nextState.journal?.currentSessionNumber).toBe(2);
    expect(nextState.journal?.pendingEvents).toEqual([]);
    expect(nextState.journal?.currentPageNumber).toBe(3);
  });

  it('fills in visible entry defaults when the runtime producer only supplies a narrative prompt', () => {
    const pendingEvents: JournalEvent[] = [
      {
        id: 'pending-quest-3',
        type: 'quest_failed',
        timestamp: 1710000400000,
        gameTime: '2026-06-09T00:40:00.000Z',
        title: 'Quest Failed: Courier Run',
        description: 'Missed the deadline for "Courier Run".',
        questId: 'quest-1',
      },
    ];

    const state = createMockGameState({
      gameTime: new Date(Date.UTC(351, 0, 9, 18, 0, 0)),
      journal: {
        ...createInitialJournalState(),
        currentSessionNumber: 4,
        currentPageNumber: 7,
        pendingEvents,
      },
    });

    const nextState = journalReducer(state, {
      type: 'ADD_JOURNAL_ENTRY',
      payload: {
        narrativeText: 'The party settles in for a long rest and records the day before sleep.',
      },
    });

    expect(nextState.journal?.entries).toHaveLength(1);
    expect(nextState.journal?.entries[0]).toMatchObject({
      sessionNumber: 4,
      pageNumber: 7,
      narrativeText: 'The party settles in for a long rest and records the day before sleep.',
    });
    expect(nextState.journal?.entries[0]?.autoLoggedEvents).toHaveLength(1);
    expect(nextState.journal?.currentSessionNumber).toBe(5);
    expect(nextState.journal?.currentPageNumber).toBe(9);
    expect(nextState.journal?.pendingEvents).toEqual([]);
  });
});
